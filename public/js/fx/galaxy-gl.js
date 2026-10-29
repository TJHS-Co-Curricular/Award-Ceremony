/*
 * 特效 · 旋涡星系的 WebGL 画法（默认；网址 &gl=0、导出影片、浏览器不支持时用 galaxy.js 原本的 canvas 2D 画法）。
 * 原本用 canvas 2D 一个粒子一笔，每帧约 2.6 万笔画图指令；Chrome / OBS 用显卡画时，这些指令全部交给浏览器唯一的
 * GPU 进程逐条执行，这个进程会吃满一个核心（2026-10-29 Win11 + OBS 实测，缩小画面也不变快）。
 * 这里把粒子资料一次放进显卡，位置、亮度、闪烁都在显卡里算，每帧只有 4 次画图指令（背景、光痕、金粉、亮金点）。
 * 画出来的样子按 galaxy.js 的公式照做（光痕改成沿圆弧画、没有圆头，肉眼几乎一样）。
 * 静态背景（galaxy.js 的 gyBg）重建时上传成贴图，每帧在同一次 WebGL 里先画背景、再「相加」画粒子，
 * 画好的整张由 galaxy.js 一次贴到 #goldfx（省掉一次全屏叠加）。
 * 提供：gyGlOk、gyGlUpload()、gyGlDraw(now)
 * 需要：galaxy.js（gyG、gyBg、gyStreaks、gyDust、gyDots、gyT、gyCanvas、GY_COLORS）、FXC、SW / SH、FX_GL、mkCanvas
 */
'use strict';

let gyGlOk = false, gyGlWhy = '';   // gyGlWhy = 没用 WebGL 的原因（诊断框显示）
const gyGl = (() => {
  if (!FX_GL) { gyGlWhy = RECORD ? '导出影片' : '网址 gl=0'; return null; }
  try { return gyGlInit(); } catch (e) { gyGlWhy = '初始化失败：' + e.message; console.warn('星系 WebGL 初始化失败，改回原本画法：', e.message); return null; }
})();
function gyGlInit() {
  const cv = mkCanvas(2, 2), gl = cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) { gyGlWhy = '浏览器不给 webgl2（OBS 要开「浏览器来源硬件加速」）'; console.warn('星系 WebGL：浏览器不支持 webgl2，改回原本画法'); return null; }
  if (cv.addEventListener) cv.addEventListener('webglcontextlost', () => { gyGlOk = false; gyGlWhy = '显卡环境丢失'; console.warn('星系 WebGL：显卡环境丢失，改回原本画法'); });
  const HEAD = `#version 300 es
precision highp float;
uniform vec2 uC, uStage; uniform float uTilt, uCos, uSin, uT, uB, uNow, uK;
vec2 proj(float r, float a) { float x = r * cos(a), y = r * sin(a) * uTilt; return uC + vec2(x * uCos - y * uSin, x * uSin + y * uCos); }
vec4 clip(vec2 p) { return vec4(p.x / uStage.x * 2.0 - 1.0, 1.0 - p.y / uStage.y * 2.0, 0.0, 1.0); }
`;
  const prog = (vs, fs) => {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, HEAD + vs], [gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\n' + fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  // 光痕：每条一段圆弧，画成 8 节的细长条（instanced），边缘按像素距离做反锯齿
  const SEG = 8;
  const streak = prog(`
layout(location=0) in vec2 aV; layout(location=1) in vec4 aP; layout(location=2) in vec3 aQ;
uniform vec3 uCol[3];
out vec3 vCol; out float vA, vD, vHW;
void main() {
  float a1 = aP.y + uT * aP.z * 6.0, a0 = a1 - aP.w * (0.6 + aP.z * 2.0), near = 0.55 + 0.45 * max(0.0, sin(a1));
  float al = min(1.0, (0.3 + 0.55 * aQ.y) * near * uB), lw = max(0.5, aQ.x * (0.7 + 0.5 * near));
  float ang = mix(a0, a1, aV.x);
  vec2 p = proj(aP.x, ang), tg = normalize(proj(aP.x, ang + 0.002) - p), nm = vec2(-tg.y, tg.x);
  vHW = lw * 0.5 * uK; float hw = vHW + 0.75;
  vD = aV.y * hw; vA = al; vCol = uCol[int(aQ.z)];
  gl_Position = clip(p + nm * aV.y * hw / uK);
}`, `
in vec3 vCol; in float vA, vD, vHW; out vec4 o;
void main() { float c = clamp(vHW + 0.5 - abs(vD), 0.0, 1.0) * min(1.0, vHW * 2.0) * vA; o = vec4(vCol * c, c); }`);
  // 细金粉：小方点（canvas 的 fillRect(x, y, s, s)）
  const dust = prog(`
layout(location=0) in vec4 aP; layout(location=1) in vec3 aQ;
out float vA;
void main() {
  float a = aP.y + uT * aP.z * 6.0, px = aP.w * uK;
  vA = clamp(aQ.x * (0.6 + 0.4 * max(0.0, sin(a))) * (0.55 + 0.45 * sin(aQ.y + uNow * aQ.z)) * uB, 0.0, 1.0) * min(1.0, px * px);
  gl_PointSize = max(1.0, px);
  gl_Position = clip(proj(aP.x, a) + aP.w * 0.5);
}`, `
in float vA; out vec4 o;
void main() { o = vec4(vec3(1.0, 0.894, 0.541) * vA, vA); }`);
  // 闪烁的亮金点：发光圆点（和 galaxy.js 的 gySprite 同样的渐层）
  const dots = prog(`
layout(location=0) in vec4 aP; layout(location=1) in float aTw;
out float vA;
void main() {
  float s = pow(max(0.0, sin(aTw + uNow * 1000.0 / 900.0)), 2.0);
  vA = (0.4 + 0.6 * s) * uB;
  gl_PointSize = aP.w * 4.0 * uK;
  gl_Position = clip(proj(aP.x, aP.y + uT * aP.z * 6.0));
}`, `
in float vA; out vec4 o;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  vec4 c = d < 0.18 ? mix(vec4(1.0, 0.988, 0.863, 1.0), vec4(1.0, 0.863, 0.353, 0.85), d / 0.18)
         : d < 0.5 ? mix(vec4(1.0, 0.863, 0.353, 0.85), vec4(1.0, 0.706, 0.078, 0.25), (d - 0.18) / 0.32)
         : mix(vec4(1.0, 0.706, 0.078, 0.25), vec4(1.0, 0.667, 0.0, 0.0), clamp((d - 0.5) / 0.5, 0.0, 1.0));
  float a = c.a * vA; o = vec4(c.rgb * a, a);
}`);
  // 静态背景：一个盖满画面的三角形贴上 gyBg（不用顶点资料）
  const bg = prog(`
out vec2 vUv;
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = vec2(p.x, 1.0 - p.y); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`, `
uniform sampler2D uTex; in vec2 vUv; out vec4 o;
void main() { o = texture(uTex, vUv); }`);
  const U = p => new Proxy({}, { get: (m, k) => m[k] ?? (m[k] = gl.getUniformLocation(p, k)) });
  const vao = (attrs, inst) => {   // attrs：[[位置, 每份几个数]]，一个缓冲交错存放
    const v = gl.createVertexArray(), b = gl.createBuffer(), stride = attrs.reduce((s, a) => s + a[1], 0) * 4;
    gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    let off = 0;
    for (const [loc, n] of attrs) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride, off); if (inst) gl.vertexAttribDivisor(loc, 1); off += n * 4; }
    return { v, b, n: 0 };
  };
  const S = { prog: streak, u: U(streak), ...vao([[1, 4], [2, 3]], true) };
  S.strip = gl.createBuffer();
  { gl.bindVertexArray(S.v); gl.bindBuffer(gl.ARRAY_BUFFER, S.strip);
    const a = []; for (let i = 0; i <= SEG; i++) a.push(i / SEG, -1, i / SEG, 1);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); }
  const D = { prog: dust, u: U(dust), ...vao([[0, 4], [1, 3]]) };
  const O = { prog: dots, u: U(dots), ...vao([[0, 4], [1, 1]]) };
  const B = { prog: bg, v: gl.createVertexArray(), tex: gl.createTexture() };
  gl.bindTexture(gl.TEXTURE_2D, B.tex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.useProgram(S.prog); gl.uniform3fv(gl.getUniformLocation(streak, 'uCol'), GY_COLORS.flatMap(c => c.split(',').map(x => x / 255)));   // 颜色固定，只设一次
  gl.bindVertexArray(null);
  gyGlOk = true;
  return { cv, gl, S, D, O, B, SEG };
}

// gyBuild() 重建粒子后调用：把粒子资料放进显卡（之后每帧只传时间）
function gyGlUpload() {
  if (!gyGl) return;
  const { gl, S, D, O, B } = gyGl;
  gl.bindTexture(gl.TEXTURE_2D, B.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gyBg);   // 静态背景（不透明）
  const put = (o, list, f, n) => {
    const a = new Float32Array(list.length * n); list.forEach((p, i) => f(p, a, i * n));
    gl.bindBuffer(gl.ARRAY_BUFFER, o.b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); o.n = list.length;
  };
  put(S, gyStreaks, (p, a, i) => { a[i] = p.r; a[i + 1] = p.a; a[i + 2] = p.w; a[i + 3] = p.len; a[i + 4] = p.s; a[i + 5] = p.hot; a[i + 6] = p.ci; }, 7);
  put(D, gyDust, (p, a, i) => { a[i] = p.r; a[i + 1] = p.a; a[i + 2] = p.w; a[i + 3] = p.s; a[i + 4] = p.al; a[i + 5] = p.tw; a[i + 6] = p.f; }, 7);
  put(O, gyDots, (p, a, i) => { a[i] = p.r; a[i + 1] = p.a; a[i + 2] = p.w; a[i + 3] = p.s; a[i + 4] = p.tw; }, 5);
}

// 画一帧（背景 + 粒子）到 WebGL 画布，返回这张画布（galaxy.js 整张贴到 #goldfx 上）
function gyGlDraw(now) {
  const { cv, gl, S, D, O, B, SEG } = gyGl, w = gyCanvas.width, h = gyCanvas.height;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  gl.viewport(0, 0, w, h);
  gl.disable(gl.BLEND); gl.useProgram(B.prog); gl.bindVertexArray(B.v); gl.bindTexture(gl.TEXTURE_2D, B.tex); gl.drawArrays(gl.TRIANGLES, 0, 3);   // 背景不透明，盖满整张，不用先清空
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  const G = gyG, nowS = (now / 1000) % 20000;
  const common = u => {
    gl.uniform2f(u.uC, G.CX, G.CY); gl.uniform2f(u.uStage, SW, SH);
    gl.uniform1f(u.uTilt, G.TILT); gl.uniform1f(u.uCos, G.cos); gl.uniform1f(u.uSin, G.sin);
    gl.uniform1f(u.uT, gyT); gl.uniform1f(u.uB, FXC.gyBright); gl.uniform1f(u.uNow, nowS); gl.uniform1f(u.uK, w / SW);
  };
  gl.useProgram(S.prog); common(S.u);
  gl.bindVertexArray(S.v); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (SEG + 1) * 2, S.n);
  gl.useProgram(D.prog); common(D.u); gl.bindVertexArray(D.v); gl.drawArrays(gl.POINTS, 0, D.n);
  gl.useProgram(O.prog); common(O.u); gl.bindVertexArray(O.v); gl.drawArrays(gl.POINTS, 0, O.n);
  gl.bindVertexArray(null);
  return cv;
}
