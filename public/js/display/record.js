/*
 * 大屏 · 导出影片（控制端「效果控制 → 导出影片」打开一个隐藏的输出页 record=1，调用 recStart()）。
 * 用虚拟时钟（clock.js）一格一格地推进特效，每一帧合成到一张画布，再用浏览器内建的 WebCodecs 编码成 H.264（不支持就用 VP9），
 * 最后 mp4.js 包成 .mp4。逐帧离线渲染：电脑慢只会导出得久一点，影片本身不会掉帧。
 * 内容：
 *   standby   待机画面 = 大会背景（背景 + 浮尘 + 副标题 + 活动名称 + 装饰线，名称有流光）
 *   promo     宣传背景（待机画面 + 下方的日期 / 时间 / 地点 / 其它一行）
 *   base      底层背景（舞台渐层 + 浮尘 + 边框，没有文字，其它画面后面那层）
 *   （standbybg 待机背景、greenbg 绿幕是星系 / 光河用的，1.70 拿掉了；旧的任务清单写这两个会当成 base）
 *   flash     揭晓闪光（黑底，叠加时用「滤色 / Screen」混合）
 * 循环：最后 fade 秒和开头交叉淡化，首尾接得上，播放器设「循环播放」就看不出接缝。
 * 文字是按网页实际排版逐字画到画布上的（位置、字体、渐层、阴影跟网页一样）。
 * 学校 Logo（画面左上角 #slogo）：大会背景、宣传背景、底层背景都画上去，大小 / 边距 / 不透明度照「效果控制 → 画面左上角 Logo」（用户定 2026-11-18）；
 *   揭晓闪光是叠加用的素材，不放 Logo。
 * opt.sink（服务器渲染、服务端有 NVENC 时由 lib/render.js 给）：每帧原始画面交给服务端的 ffmpeg 用显卡编码，不在浏览器编码（blob = null）。
 * 提供：recStart(opt, fx, onProgress) → Promise<{ blob, size, codec, hw, width, height, speed }>、recStill(opt, fx) → Promise<{ blob, width, height }>（一张 PNG）、recCancel()
 * 需要：stage.js、clock.js、fxconf.js、mp4.js、fx/*、render.js、main.js（booted）
 */
'use strict';

let recStop = false;
function recCancel() { recStop = true; }
const recYield = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });   // 让出时间又不受后台计时器限速
const recCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ---------- 文字：按网页排版逐字画 ---------- */
function recRects() {
  const sr = stage.getBoundingClientRect(), s = sr.width / SW;
  return r => ({ x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s });
}
// 把元素里的每个字画到 g（舞台坐标，白色或目前的 fillStyle）
function recDrawChars(g, el, conv) {
  const cs = getComputedStyle(el), up = cs.textTransform === 'uppercase';
  g.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), range = document.createRange();
  for (let n; (n = walk.nextNode());) {
    for (let i = 0; i < n.length; i++) {
      const code = n.data.charCodeAt(i), len = code >= 0xd800 && code < 0xdc00 ? 2 : 1, ch = n.data.substr(i, len);
      if (!/\s/.test(ch)) {
        range.setStart(n, i); range.setEnd(n, i + len);
        const r = range.getClientRects()[0];
        if (r) {
          const q = conv(r), t = up ? ch.toUpperCase() : ch, m = g.measureText(t);
          const A = m.fontBoundingBoxAscent, D = m.fontBoundingBoxDescent;
          g.fillText(t, q.x, q.y + (q.h - (A + D)) / 2 + A);
        }
      }
      i += len - 1;
    }
  }
}
// 阴影层：把字形染色、模糊、位移（= CSS drop-shadow，只画一次）
// 颜色照 display.css 的 CSS 变量取（主题颜色由 shared/theme.js 设在这些变量上；默认 = 原本的金色）
const recV = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
const recRgb = (k, a) => `rgba(${recV(k).split(/\s+/).join(',')},${a})`;   // '--gold-rgb' = 'r g b' → 'rgba(r,g,b,a)'
function recShadow(mask, color, dy, blur, W, H) {
  const t = recCanvas(W, H), g = t.getContext('2d');
  g.drawImage(mask, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, W, H);
  const o = recCanvas(W, H), go = o.getContext('2d');
  go.filter = `blur(${blur}px)`; go.drawImage(t, 0, dy);
  return o;
}
function recTextLayers(W, H) {
  const K = W / SW, conv = recRects();
  const stat = recCanvas(W, H), gs = stat.getContext('2d');
  const stageCtx = c => { const g = c.getContext('2d'); g.setTransform(W / SW, 0, 0, H / SH, 0, 0); return g; };
  // 副标题：竖向渐层 + 阴影 drop-shadow(0 4px 18px rgba(0,0,0,.6))
  const en = $('evSub');
  if (en.textContent.trim() && getComputedStyle(en).display !== 'none') {
    const m = recCanvas(W, H), g = stageCtx(m); g.fillStyle = '#fff'; recDrawChars(g, en, conv);
    gs.drawImage(recShadow(m, 'rgba(0,0,0,.6)', 4 * K, 9 * K, W, H), 0, 0);
    const b = conv(en.getBoundingClientRect()), gr = g.createLinearGradient(0, b.y, 0, b.y + b.h);
    gr.addColorStop(0, recV('--t-title1')); gr.addColorStop(.45, recV('--t-title2')); gr.addColorStop(1, recV('--gold-lo'));
    g.globalCompositeOperation = 'source-in'; g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
    gs.drawImage(m, 0, 0);
  }
  // 装饰线（整体不透明度 .85）
  const gl = stageCtx(stat); gl.globalAlpha = .85;
  for (const i of document.querySelectorAll('#s-standby .line i')) {
    const q = conv(i.getBoundingClientRect()), last = i === i.parentNode.lastElementChild;
    const gr = gl.createLinearGradient(q.x, 0, q.x + q.w, 0);
    gr.addColorStop(last ? 1 : 0, recRgb('--gold-hi-rgb', 0)); gr.addColorStop(last ? 0 : 1, recRgb('--gold-hi-rgb', .9));
    gl.fillStyle = gr; gl.fillRect(q.x, q.y, q.w, q.h);
  }
  const dia = document.querySelector('#s-standby .line b');
  if (dia) {
    const q = conv(dia.getBoundingClientRect()), s = dia.offsetWidth;
    gl.save(); gl.translate(q.x + q.w / 2, q.y + q.h / 2); gl.rotate(Math.PI / 4);
    gl.strokeStyle = recV('--gold-hi'); gl.lineWidth = 1.5; gl.strokeRect(-s / 2 + .75, -s / 2 + .75, s - 1.5, s - 1.5); gl.restore();
  }
  // 日期 / 时间 / 地点 + 其它一行（宣传背景）：实色字 + 阴影 0 3px 14px rgba(0,0,0,.7)，中间的小菱形
  for (const el of [$('evInfo'), $('evNote')]) {
    if (!el.textContent.trim() || getComputedStyle(el).display === 'none') continue;
    const cs = getComputedStyle(el), m = recCanvas(W, H), g = stageCtx(m); g.fillStyle = '#fff'; recDrawChars(g, el, conv);
    gs.setTransform(1, 0, 0, 1, 0, 0);   // gs 和上面装饰线的 gl 是同一个 context，已被设成舞台坐标：贴整张图层前先还原
    gs.drawImage(recShadow(m, 'rgba(0,0,0,.7)', 3 * K, 7 * K, W, H), 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = cs.color; g.fillRect(0, 0, SW, SH);
    gs.drawImage(m, 0, 0);
    const gd = stageCtx(stat); gd.globalAlpha = .8; gd.fillStyle = recV('--gold-hi');
    for (const s of el.querySelectorAll('s')) {
      const q = conv(s.getBoundingClientRect()), z = s.offsetWidth;
      gd.save(); gd.translate(q.x + q.w / 2, q.y + q.h / 2); gd.rotate(Math.PI / 4); gd.fillRect(-z / 2, -z / 2, z, z); gd.restore();
    }
  }
  // 活动名称：字形遮罩 + 两层阴影；流光每帧画（recTitle）
  const h1 = $('evTitle'), mask = recCanvas(W, H), gm = stageCtx(mask); gm.fillStyle = '#fff';
  let title = null;
  if (h1.textContent.trim()) {
    recDrawChars(gm, h1, conv);
    const b = conv(h1.getBoundingClientRect()), pad = 4;
    const px = Math.max(0, Math.floor((b.x - pad) * K)), py = Math.max(0, Math.floor((b.y - pad) * K));
    title = {
      box: b, mask, px, py, pw: Math.min(W - px, Math.ceil((b.w + pad * 2) * K)), ph: Math.min(H - py, Math.ceil((b.h + pad * 2) * K)),
      dark: recShadow(mask, 'rgba(0,0,0,.65)', 6 * K, 7 * K, W, H), glow: recShadow(mask, recRgb('--glow-rgb', .35), 0, 13 * K, W, H)
    };
    title.tmp = recCanvas(title.pw, title.ph);
  }
  return { stat, title, K };
}
// 活动名称的金色流光（= CSS .goldtext：100deg 渐层，宽 250%，background-position 95% ↔ -12%，7 秒 ease-in-out 来回）。
// frac = 一个来回（14 秒）里的位置；影片长度调成整数个来回，循环时也接得上。
const SHIMMER_P = 14;
function recTitle(out, L, frac) {
  const T = L.title; if (!T) return;
  out.drawImage(T.dark, 0, 0); out.drawImage(T.glow, 0, 0);
  const g = T.tmp.getContext('2d'), { x, y, w, h } = T.box, K = L.K;
  // 先铺渐层（可能跨两块），再用字形遮罩裁掉（destination-in；不能用 source-in，第二块会把第一块擦掉）
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, T.pw, T.ph);
  g.setTransform(K, 0, 0, K, -T.px, -T.py);
  const tri = frac < .5 ? frac * 2 : 2 - frac * 2, e = .5 - .5 * Math.cos(Math.PI * tri);   // 去程 / 回程，两端慢、中间快
  const tw = w * 2.5, ox = (w - tw) * (.95 - 1.07 * e), a = 100 * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
  const Lg = Math.abs(tw * dx) + Math.abs(h * dy), cLo = recV('--gold-lo'), cMid = recV('--gold'), cHi = recV('--gold-hi');
  for (let k = -1; k <= 1; k++) {
    const x0 = x + ox + k * tw; if (x0 > x + w || x0 + tw < x) continue;
    const cx = x0 + tw / 2, cy = y + h / 2, gr = g.createLinearGradient(cx - dx * Lg / 2, cy - dy * Lg / 2, cx + dx * Lg / 2, cy + dy * Lg / 2);
    gr.addColorStop(0, cLo); gr.addColorStop(.25, cMid); gr.addColorStop(.45, cHi); gr.addColorStop(.6, cMid); gr.addColorStop(1, cLo);
    g.fillStyle = gr; g.fillRect(x0, y - 4, tw, h + 8);
  }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in';
  g.drawImage(T.mask, T.px, T.py, T.pw, T.ph, 0, 0, T.pw, T.ph);
  out.drawImage(T.tmp, T.px, T.py);
}

/* ---------- 学校 Logo（= 大屏左上角的 #slogo，CSS 见 display.css）：正方形框 = 画面高 × sLogoSize，按原比例缩进框里贴左上角 ---------- */
const recHasLogo = c => c !== 'flash';
async function recLogoLayer(W, H, content) {
  const im = $('slogo');
  if (!recHasLogo(content) || !FXC.sLogoOn || !im.getAttribute('src')) return null;
  try { await im.decode(); } catch { return null; }   // 载不到 Logo：影片照样导出，只是没有 Logo
  if (!im.naturalWidth) return null;
  const c = recCanvas(W, H), g = c.getContext('2d'); g.setTransform(W / SW, 0, 0, H / SH, 0, 0);
  const box = SH * FXC.sLogoSize, m = SH * FXC.sLogoMargin, k = Math.min(box / im.naturalWidth, box / im.naturalHeight);
  g.globalAlpha = FXC.sLogoOpacity;
  g.drawImage(im, m, m, im.naturalWidth * k, im.naturalHeight * k);
  return c;
}

/* ---------- 底层背景（= #stage 的 CSS 背景 + 边框） ---------- */
function recBaseLayers(W, H) {
  const bgc = recCanvas(W, H), g = bgc.getContext('2d'); g.setTransform(W / SW, 0, 0, H / SH, 0, 0);
  const lin = g.createLinearGradient(0, 0, 0, SH); lin.addColorStop(0, recV('--bg1')); lin.addColorStop(1, recV('--bg2'));
  g.fillStyle = lin; g.fillRect(0, 0, SW, SH);
  const ell = (cx, cy, rx, ry, color) => {
    g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, rx); r.addColorStop(0, color); r.addColorStop(.7, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = r; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
  };
  ell(SW * .5, SH * 1.1, 900, 500, recRgb('--red-rgb', .28));
  ell(SW * .5, SH * .38, 1200, 700, recRgb('--gold-rgb', .16));
  const fr = recCanvas(W, H), f = fr.getContext('2d'); f.setTransform(W / SW, 0, 0, H / SH, 0, 0);
  f.lineWidth = 1; f.strokeStyle = recRgb('--gold-rgb', .22); f.strokeRect(36.5, 36.5, SW - 73, SH - 73);
  f.strokeStyle = recRgb('--gold-rgb', .10); for (let i = 0; i < 2; i++) f.strokeRect(47.5, 47.5, SW - 95, SH - 95);
  return { bgc, fr };
}

/* ---------- 编码器：先要求显卡编码（NVIDIA NVENC / AMD AMF / Intel QSV），不行再用 CPU 软件编码；
 * 编码格式先试 H.264（各级别），不支持再用 VP9 ---------- */
async function recEncoder(W, H, fps, bitrate, onChunk, allowHw = true) {
  const codecs = ['avc1.640034', 'avc1.640033', 'avc1.4d0034', 'avc1.4d0033', 'avc1.42e034', 'vp09.00.51.08', 'vp09.00.41.08'];
  for (const accel of allowHw ? ['prefer-hardware', 'prefer-software'] : ['prefer-software']) {
    for (const codec of codecs) {
      const cfg = { codec, width: W, height: H, bitrate, framerate: fps, bitrateMode: 'variable', latencyMode: 'quality', hardwareAcceleration: accel,
        ...(codec.startsWith('avc') ? { avc: { format: 'avc' } } : {}) };
      try { if (!(await VideoEncoder.isConfigSupported(cfg)).supported) continue; } catch { continue; }
      let err = null;
      const enc = new VideoEncoder({ output: onChunk, error: e => { err = e; } });
      enc.configure(cfg);
      return { enc, kind: codec.startsWith('avc') ? 'avc' : 'vp9', codec, hw: accel === 'prefer-hardware', failed: () => err };
    }
  }
  throw new Error('这个浏览器不支持影片编码（请用新版 Chrome 或 Edge）');
}

/* ---------- 主程序 ---------- */
async function recStart(opt, fx, onProgress = () => {}) {
  try { return await recRun(opt, fx, onProgress, true); }
  catch (e) {
    if (!e.recHw) throw e;   // 显卡编码中途失败（驱动不支持这个尺寸等）：自动改用软件编码重来一次
    onProgress(0, '显卡编码失败，改用软件编码');
    return await recRun(opt, fx, onProgress, false);
  }
}
/* 服务器渲染 + NVENC（lib/render.js）：不在浏览器编码，每一帧原始画面（RGBA）POST 给本机服务端，由 ffmpeg 交给显卡编码。
 * 两块缓冲轮流用：上一帧在上传时，这一帧已经在读回画面。 */
function recSink(sink, W, H) {
  const bufs = [new Uint8Array(W * H * 4), new Uint8Array(W * H * 4)];
  let pending = null, n = 0, ended = false;
  const post = async (q, body) => {
    const r = await fetch(sink.url + '&' + q, { method: 'POST', body });
    if (!r.ok) throw Object.assign(new Error('显卡编码（NVENC）失败：' + (await r.text()).slice(0, 300)), { recSink: true });
    return r;
  };
  return {
    hw: true, codec: 'h264_nvenc', failed: () => null,
    async push(cv, k, ctx) {
      const buf = bufs[n++ % 2], layout = [{ offset: 0, stride: W * 4 }];
      let fmt = 'RGBA', data = buf;
      const f = new VideoFrame(cv, { timestamp: k });
      try { await f.copyTo(buf, { format: 'RGBA', layout }); }
      catch {
        try { await f.copyTo(buf, { layout }); fmt = f.format; }
        catch { data = new Uint8Array(ctx.getImageData(0, 0, W, H).data.buffer); fmt = 'RGBA'; }
      } finally { f.close(); }
      if (pending) await pending;
      pending = post(`i=${k}&fmt=${fmt}`, data);
    },
    async finish() { if (pending) await pending; ended = true; const r = await post('end=1'); return { blob: null, ...(await r.json()) }; },
    close() { if (!ended) fetch(sink.url + '&abort=1', { method: 'POST' }).catch(() => {}); }
  };
}

// 导出前的准备（影片、图片共用）：等连上、套效果设定、决定显不显示日期地点、先跑半秒
async function recPrepare(opt, fx) {
  recStop = false;
  for (let i = 0; !booted && i < 200; i++) await new Promise(r => setTimeout(r, 50));
  if (!booted) throw new Error('连不上服务端');
  if (opt.content === 'standbybg' || opt.content === 'greenbg') opt.content = 'base';   // 旧名称（星系 / 光河拿掉了）
  fxPreviewSet(fx);
  await bgImgReady(); bgDraw();   // 大会背景图片（display/bgimg.js）：等载好、按影片像素画好
  REC_INFO = opt.content === 'promo'; if (lastV) standbyInfo(lastV.event);   // 宣传背景才有日期 / 时间 / 地点
  $('s-standby').classList.remove('enter');   // 去掉进场动画，文字位置才是最终的
  for (let i = 0; i < 30; i++) recTick(1000 / 60);   // 先跑半秒：标题缩放、浮尘建好
  await document.fonts.ready;
  for (let i = 0; i < 2; i++) recTick(1000 / 60);   // 字体载好后再缩放一次（标题、日期地点的 fitText 在下一帧）
}
const recHasText = c => c === 'standby' || c === 'promo';
/* 背景那一层（影片、图片共用），和现场大屏一样：
 * 大会背景 = 深色渐层（默认）：渐层 + 浮尘 + 边框（大会背景、宣传背景、底层背景都是这样，前两个再叠文字）；
 * = 背景图片：图片 + 浮尘（没有渐层、边框）；= 透明：黑底 + 浮尘（「透明」在影片里没有意义）；
 * 揭晓闪光：黑底 + 闪光，不受大会背景影响。 */
function recBgLayer(o, content, B, W, H) {
  const r = document.documentElement.classList;
  if (content === 'flash') { o.fillStyle = '#000'; o.fillRect(0, 0, W, H); o.drawImage($('fx'), 0, 0); return; }
  if (r.contains('bg-image') || r.contains('bg-clear')) {
    if (r.contains('bg-image')) o.drawImage($('bgimg'), 0, 0, W, H); else { o.fillStyle = '#000'; o.fillRect(0, 0, W, H); }
    o.drawImage($('bg'), 0, 0);
    return;
  }
  o.drawImage(B.bgc, 0, 0); o.drawImage($('bg'), 0, 0); o.drawImage(B.fr, 0, 0);
}
/* 一张静态图片（PNG）：宣传海报 / 投影片背景用。先跑 opt.seconds（默认 4）秒让浮尘散开，取那一帧 */
async function recStill(opt, fx) {
  await recPrepare(opt, fx);
  const content = opt.content, W = $('bg').width, H = $('bg').height;
  const L = recHasText(content) ? recTextLayers(W, H) : null, B = content !== 'flash' ? recBaseLayers(W, H) : null, LG = await recLogoLayer(W, H, content);
  for (let i = 0; i < Math.round((opt.seconds || 4) * 60); i++) { if (recStop) throw new Error('已取消'); recTick(1000 / 60); if (i % 60 === 0) await recYield(); }
  const out = recCanvas(W, H), o = out.getContext('2d');
  recBgLayer(o, content, B, W, H);
  if (L) { o.drawImage(L.stat, 0, 0); recTitle(o, L, .25); }   // 流光停在标题中间偏亮的位置
  if (LG) o.drawImage(LG, 0, 0);
  const blob = await new Promise(r => out.toBlob(r, 'image/png'));
  return { blob, width: W, height: H };
}

async function recRun(opt, fx, onProgress, allowHw) {
  if (typeof VideoEncoder === 'undefined' && !opt.sink) throw new Error(!isSecureContext
    ? '浏览器只在安全连线下才给影片编码：现在是用 http://IP 打开控制端。请照控制端的说明让浏览器信任这个地址，或把「在哪里渲染」改成服务器'
    : '这个浏览器不支持影片编码（WebCodecs），请用新版 Chrome 或 Edge，或把「在哪里渲染」改成服务器');
  await recPrepare(opt, fx);
  const content = opt.content, fps = opt.fps === 60 ? 60 : 30, sub = 60 / fps;
  const W = $('bg').width, H = $('bg').height;
  const L = recHasText(content) ? recTextLayers(W, H) : null, B = content !== 'flash' ? recBaseLayers(W, H) : null, LG = await recLogoLayer(W, H, content);
  const out = recCanvas(W, H), o = out.getContext('2d');

  const N = Math.round(opt.seconds * fps), loop = content !== 'flash' && opt.fade > 0, C = loop ? Math.min(Math.round(opt.fade * fps), Math.floor(N / 2)) : 0;
  const P = loop ? opt.seconds / Math.max(1, Math.round(opt.seconds / SHIMMER_P)) : SHIMMER_P;   // 流光周期：让影片长度刚好是整数个周期，循环时文字也接得上
  // 编码器：服务器渲染有 NVENC 时交给服务端（recSink），否则用浏览器内建的 WebCodecs（recEncoder + mp4Mux）
  let E;
  if (opt.sink) E = recSink(opt.sink, W, H);
  else {
    const samples = []; let desc = null;
    const X = await recEncoder(W, H, fps, Math.round(W * H * fps * (opt.bpp || .15)), (chunk, meta) => {
      if (meta?.decoderConfig?.description) desc = new Uint8Array(meta.decoderConfig.description instanceof ArrayBuffer ? meta.decoderConfig.description : meta.decoderConfig.description.buffer || meta.decoderConfig.description);
      const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data); samples.push({ data, key: chunk.type === 'key' });
    }, allowHw);
    E = {
      hw: X.hw, codec: X.codec, failed: X.failed,
      async push(cv, k) {
        const frame = new VideoFrame(cv, { timestamp: Math.round(k * 1e6 / fps), duration: Math.round(1e6 / fps) });
        X.enc.encode(frame, { keyFrame: k % (fps * 2) === 0 }); frame.close();
        while (X.enc.encodeQueueSize > 4) await new Promise(r => X.enc.addEventListener('dequeue', r, { once: true }));
      },
      async finish() {
        try { await X.enc.flush(); } catch (e) { throw Object.assign(new Error('编码失败：' + e.message), { recHw: X.hw }); }
        if (X.kind === 'avc' && !desc) throw new Error('编码器没有给出 H.264 设定');
        onProgress(1, '封装中');
        const blob = mp4Mux({ kind: X.kind, width: W, height: H, fps, desc, samples });
        return { blob, size: blob.size };
      },
      close() { try { X.enc.close(); } catch {} }
    };
  }
  const recT0 = Date.now();
  // 循环用：开头 C 帧的背景，最后几秒拿来交叉淡化。总量不大（≤ 800 MB）时直接留在显卡里（ImageBitmap，最快），
  // 太大就压成 JPEG 暂存（比 WebP 快很多；只用在淡化那几秒，看不出差别）
  const head = [], headRaw = W * H * 4 * C <= 800 * 1048576;
  let tHead = 0, recJpg = null, recJpgCtx = null;
  const flashAt = []; if (content === 'flash') for (let t = .3; t === .3 || t + 2.6 <= opt.seconds; t += 4) flashAt.push(t);
  let ft = 0;
  // 分段（opt.seg = { from, to }：只输出影片第 from ~ to-1 帧；lib/render.js 把一支影片分给几个分页同时算，最后接起来）。
  // 前面的帧快转（REC_SKIP：特效只推进状态、不画），这一段开始前 2 帧先画一次（不输出），每张画布都是最新的。
  const seg = opt.seg, from = seg ? Math.max(0, seg.from | 0) : 0, to = seg ? Math.min(N, seg.to | 0) : N;
  const needHead = C > 0 && to > N - C;   // 这一段包含最后的循环淡化：要先画开头那几帧
  const total = (needHead ? C : 0) + (to - from);
  let done = 0;
  try {
    for (let i = 0; i < C + to; i++) {
      if (recStop) throw new Error('已取消');
      if (E.failed()) throw Object.assign(new Error('编码失败：' + E.failed().message), { recHw: E.hw });
      const k = i - C, use = i < C ? needHead : k >= from;   // 影片里的第 k 帧；use = 这一帧要输出（或存起来淡化用）
      REC_SKIP = !(use || (k >= from - 2 && k < from));
      if (content === 'flash') { const t = i / fps; while (ft < flashAt.length && flashAt[ft] <= t) { burst(260); ft++; } }
      for (let s = 0; s < sub; s++) recTick(1000 / 60);
      if (REC_SKIP) { if (i % 300 === 0) { onProgress(done / total, '快转到这一段'); await recYield(); } continue; }
      // 背景
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over'; o.filter = 'none';
      recBgLayer(o, content, B, W, H);
      if (i < C) {
        if (!needHead) continue;
        const t = Date.now();
        // 不用 canvas.toBlob：Chrome 把它排在「空闲时间」才压，CPU 全忙时（服务器 8 个分页同时算）一张要等好几秒。
        // 改成复制到 OffscreenCanvas 再 convertToBlob，马上压
        if (!headRaw && !recJpg) { recJpg = new OffscreenCanvas(W, H); recJpgCtx = recJpg.getContext('2d'); }
        if (!headRaw) recJpgCtx.drawImage(out, 0, 0);
        head.push(headRaw ? await createImageBitmap(out) : await recJpg.convertToBlob({ type: 'image/jpeg', quality: .92 }));
        tHead += Date.now() - t;
        onProgress(++done / total, '准备循环接缝'); continue;
      }
      if (!use) continue;   // 这一段开头前的暖身帧
      if (i >= N) {   // 最后 C 帧：慢慢换成开头的画面
        const bm = headRaw ? head[i - N] : await createImageBitmap(head[i - N]); head[i - N] = null;
        o.globalAlpha = (i - N + .5) / C; o.drawImage(bm, 0, 0); o.globalAlpha = 1; bm.close();
      }
      if (L) { o.drawImage(L.stat, 0, 0); recTitle(o, L, ((k / fps) / P) % 1); }
      if (LG) o.drawImage(LG, 0, 0);   // Logo 在最上面（循环淡化之后画，接缝时 Logo 不会闪）
      await E.push(out, k, o);
      onProgress(++done / total, '渲染中');
      if (i % 2 === 0) await recYield();
    }
    REC_SKIP = false;
    var res = await E.finish();
  } finally { REC_SKIP = false; E.close(); }
  const secs = (Date.now() - recT0) / 1000;   // 注意：录影时 performance.now 是虚拟时钟，这里用真实时间
  return { ...res, codec: E.codec, hw: E.hw, width: W, height: H, speed: total / Math.max(.001, secs), frames: total, headSecs: tHead / 1000, renderSecs: secs - tHead / 1000 };
}
