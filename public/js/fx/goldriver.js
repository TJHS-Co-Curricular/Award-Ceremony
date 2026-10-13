/*
 * 特效 · 待机画面背景「金色光河」（原本的设计；现在默认用 galaxy.js，可在「奖项编辑」切回这个）（canvas #goldfx，原创程序绘制，离线可用；只在待机画面显示时运行）。
 * 一层静态背景（黑金渐层 + 放射光线 + 地平线光晕），每次舞台尺寸改变才重画；
 * 上面每帧用「叠加发光」画粒子：粒子沿弯曲的光带从近处（画面下方）流向远处的地平线，越远越小越暗。
 * 提供：goldFx(on)
 * 需要：stage.js（SW、SH、PREVIEW、$）
 */
'use strict';

const gc = $('goldfx'), gx = gc.getContext('2d');
const sprite = (() => {   // 预先画好的发光圆点，比每帧画渐层快很多
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,248,215,1)'); r.addColorStop(.18, 'rgba(255,222,120,.9)'); r.addColorStop(.45, 'rgba(255,184,40,.35)'); r.addColorStop(1, 'rgba(255,160,20,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return c;
})();
let gBg = null, gW = 0, gH = 0, gParts = [], gSpark = [], gLanes = [], gOn = false, gLast = 0, gSlow = 0;
const HZ = .57;   // 地平线（光晕中心）在画面高度的位置
// 光丝的路径：u = 横向位置（-1 ~ 1），t = 0（画面下方，最近）→ 1（地平线）。近处宽、远处收拢，整体是一道 S 形的弯
function gPos(u, t) {
  const d = 1 - t, ps = Math.pow(d, 1.7), cx = gW / 2, hy = gH * HZ;
  const sweep = Math.sin(d * 2.6 + .5) * gW * .26 * Math.pow(d, 1.1);
  return { x: cx + u * gW * (.05 + 1.1 * ps) + sweep, y: hy + gH * .64 * Math.pow(d, 2) * (1 + u * .22) - Math.sin(t * Math.PI) * gH * .05 * u, ps };
}
function gLaneU() {   // 光丝集中成几道光带（像参考图的金色气流），少量散在外面
  const r = Math.random();
  if (r < .82) { const c = [-.62, -.18, .22, .66][Math.floor(Math.random() * 4)]; return c + (Math.random() + Math.random() + Math.random() - 1.5) * .16; }
  return Math.random() * 2.4 - 1.2;
}
function gBuild() {
  gW = SW; gH = SH;
  gBg = document.createElement('canvas'); gBg.width = gW; gBg.height = gH;
  const g = gBg.getContext('2d'), cx = gW / 2, hy = gH * HZ, R = Math.max(gW, gH), k = gH / 1080;
  const base = g.createLinearGradient(0, 0, 0, gH);
  base.addColorStop(0, '#070503'); base.addColorStop(.45, '#140c03'); base.addColorStop(.62, '#2a1803'); base.addColorStop(1, '#060402');
  g.fillStyle = base; g.fillRect(0, 0, gW, gH);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 140; i++) {   // 从光晕中心向上放射的细光线
    const a = Math.PI + Math.random() * Math.PI, len = R * (.5 + Math.random() * .7), w = Math.random() * 1.6 + .3;
    const gr = g.createLinearGradient(cx, hy, cx + Math.cos(a) * len, hy + Math.sin(a) * len);
    gr.addColorStop(0, `rgba(255,200,80,${.05 + Math.random() * .08})`); gr.addColorStop(1, 'rgba(255,200,80,0)');
    g.strokeStyle = gr; g.lineWidth = w * k;
    g.beginPath(); g.moveTo(cx, hy); g.lineTo(cx + Math.cos(a) * len, hy + Math.sin(a) * len); g.stroke();
  }
  // 金色光丝（静态）：每条按远近分段画，近处粗亮、远处细淡
  gLanes = Array.from({ length: PREVIEW ? 70 : 150 }, gLaneU);
  g.lineCap = 'round';
  for (const u of gLanes) {
    const seg = 28, tint = Math.random();
    let prev = gPos(u, 0);
    for (let i = 1; i <= seg; i++) {
      const q = gPos(u, i / seg * .985);
      const a = (.04 + .16 * q.ps) * (.6 + .4 * tint);
      g.strokeStyle = `rgba(255,${190 + Math.round(40 * tint)},${70 + Math.round(60 * tint)},${a})`;
      g.lineWidth = (.4 + 2.2 * q.ps) * k;
      g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(q.x, q.y); g.stroke();
      prev = q;
    }
  }
  // 地平线光晕：大片暖光 + 中间一条扁平的亮带
  const glow = (rx, ry, stops) => {
    g.save(); g.translate(cx, hy); g.scale(rx / ry, 1);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, ry); stops.forEach(([o, c]) => r.addColorStop(o, c));
    g.fillStyle = r; g.beginPath(); g.arc(0, 0, ry, 0, 6.283); g.fill(); g.restore();
  };
  glow(gW * .75, gH * .42, [[0, 'rgba(255,170,30,.5)'], [.35, 'rgba(200,110,10,.2)'], [1, 'rgba(120,60,0,0)']]);
  glow(gW * .5, gH * .08, [[0, 'rgba(255,245,200,.95)'], [.3, 'rgba(255,215,90,.6)'], [1, 'rgba(255,170,30,0)']]);
  glow(gW * .18, gH * .035, [[0, 'rgba(255,255,240,.9)'], [1, 'rgba(255,230,150,0)']]);
  // 流动的光点：沿光丝前进，带拖尾
  const n = Math.round((PREVIEW ? 500 : 1700) * Math.min(2, (gW * gH) / (1920 * 1080)));
  gParts = Array.from({ length: n }, () => gSeed({}, true));
  gSpark = Array.from({ length: PREVIEW ? 40 : Math.round(160 * gW / 1920) }, () => ({ x: Math.random() * gW, y: Math.random() * gH * .62, r: Math.random() * 1.6 + .4, t: Math.random() * 6.28, v: Math.random() * .04 + .01 }));
}
function gSeed(p, fresh) {
  p.u = gLanes[(Math.random() * gLanes.length) | 0] + (Math.random() - .5) * .01;
  p.t = fresh ? Math.random() : 0;
  p.v = .05 + Math.random() * .08;   // 每秒前进多少
  p.s = .5 + Math.random() * 1.2; p.tw = Math.random() * 6.28;
  return p;
}
function gFrame(now) {
  if (!gOn) return;
  requestAnimationFrame(gFrame);
  const dt = Math.min(.05, (now - (gLast || now)) / 1000); gLast = now;
  if (gW !== SW || gH !== SH || !gBg) gBuild();
  const t0 = performance.now(), k = gH / 1080, time = now / 1000;
  gx.globalCompositeOperation = 'source-over'; gx.globalAlpha = 1; gx.drawImage(gBg, 0, 0);
  gx.globalCompositeOperation = 'lighter';
  for (const p of gParts) {
    const sp = p.v * (.35 + p.t * .9);   // 越远走得越慢（透视）
    p.t += sp * dt;
    if (p.t >= .985) gSeed(p, false);
    const fade = Math.min(1, p.t * 12) * Math.min(1, (.985 - p.t) * 6);
    const tw = .75 + .25 * Math.sin(p.tw + time * 3);
    for (let j = 0; j < 3; j++) {   // 光点 + 两段拖尾
      const q = gPos(p.u, Math.max(0, p.t - j * sp * .09));
      if (q.x < -40 || q.x > gW + 40 || q.y > gH + 40) break;
      const sz = (2 + 13 * q.ps) * p.s * k * (1 - j * .22);
      gx.globalAlpha = Math.min(1, fade * (.3 + .7 * q.ps) * tw * (1 - j * .38));
      gx.drawImage(sprite, q.x - sz / 2, q.y - sz / 2, sz, sz);
    }
  }
  for (const s of gSpark) {   // 上方闪烁的金粉
    s.t += s.v; const a = Math.max(0, Math.sin(s.t)) * .8;
    if (a < .02) continue;
    const sz = s.r * 6 * k; gx.globalAlpha = a; gx.drawImage(sprite, s.x - sz / 2, s.y - sz / 2, sz, sz);
  }
  gx.globalAlpha = 1; gx.globalCompositeOperation = 'source-over';
  // 太慢的电脑自动减少光点（连续多帧超过 22ms）
  if (performance.now() - t0 > 22) { if (++gSlow > 30 && gParts.length > 300) { gParts.length = Math.round(gParts.length * .7); gSlow = 0; } } else gSlow = 0;
}
function goldFx(on) {
  if (on === gOn) return;
  gOn = on;
  if (on) { gLast = 0; requestAnimationFrame(gFrame); }
}
