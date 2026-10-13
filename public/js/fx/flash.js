/*
 * 特效 · 揭晓闪光：像台下有人拍照的柔和微光（canvas #fx）。
 * burst(n)：n 越大闪光越多（揭晓一位 ≈ 6 下，多位 ≈ 9 下，得主 ≈ 11 下），约 2 秒内陆续闪完。
 * 每一下：极快亮起 → 慢慢熄灭；柔和的微光 + 淡淡的十字星芒（FLASH_PEAK 控制亮度，不会让整个画面变白）。
 * 需要：stage.js（SW、SH、PREVIEW）
 */
'use strict';

const FLASH_PEAK = .42;   // 闪光最亮时的不透明度（1 = 最亮）
const fx = $('fx').getContext('2d');
let flashes = [], running = false;
const flashSprite = (() => {   // 预画好的闪光光晕
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.08, 'rgba(255,255,255,.95)'); r.addColorStop(.22, 'rgba(255,246,225,.55)');
  r.addColorStop(.5, 'rgba(255,225,170,.16)'); r.addColorStop(1, 'rgba(255,210,140,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256); return c;
})();
function burst(n = 160) {
  const count = Math.round(n / 30 * (PREVIEW ? .5 : Math.min(1.8, Math.max(1, SW / 1920 * .8))));
  const now = performance.now(), k = SH / 1080;
  for (let i = 0; i < count; i++) {
    const low = Math.random() < .65;   // 多数在下方（台下观众席），少数在两侧上方
    flashes.push({
      x: Math.random() * SW,
      y: low ? SH * (.6 + Math.random() * .38) : SH * (.08 + Math.random() * .5),
      t0: now + (i < 1 ? 0 : Math.random() * 2200),   // 一开始就有一下，之后约 2 秒内陆续闪
      dur: 170 + Math.random() * 150,
      r: (40 + Math.random() * 55) * k * (low ? 1.1 : .8),
      big: false, rot: Math.random() * Math.PI / 4
    });
  }
  if (!running) { running = true; requestAnimationFrame(stepFx); }
}
function stepFx(now) {
  fx.clearRect(0, 0, SW, SH);
  flashes = flashes.filter(f => now < f.t0 + f.dur);
  fx.globalCompositeOperation = 'lighter';
  let white = 0;
  for (const f of flashes) {
    const t = (now - f.t0) / f.dur;
    if (t < 0) continue;
    const e = t < .12 ? t / .12 : Math.pow(1 - (t - .12) / .88, 2.2);   // 亮起很快，熄灭较慢
    const R = f.r * (.85 + .3 * e);
    fx.globalAlpha = e * FLASH_PEAK;
    fx.drawImage(flashSprite, f.x - R * 2.2, f.y - R * 2.2, R * 4.4, R * 4.4);
    // 星芒：横竖两道长的 + 斜向两道短的
    fx.save(); fx.translate(f.x, f.y); fx.rotate(f.rot);
    for (const [ang, len, w] of [[0, 2.4, .05], [Math.PI / 2, 1.7, .045]]) {
      fx.save(); fx.rotate(ang);
      const L = R * len * (.6 + .4 * e), gr = fx.createLinearGradient(-L, 0, L, 0);
      gr.addColorStop(0, 'rgba(255,250,235,0)'); gr.addColorStop(.5, 'rgba(255,250,235,.7)'); gr.addColorStop(1, 'rgba(255,250,235,0)');
      fx.fillStyle = gr; fx.fillRect(-L, -R * w / 2, L * 2, R * w);
      fx.restore();
    }
    fx.restore();
    if (f.big) white = Math.max(white, e);
  }
  if (white > 0) { fx.globalAlpha = white * .04; fx.fillStyle = '#fff'; fx.fillRect(0, 0, SW, SH); }   // 大闪：整个画面微微一亮
  fx.globalAlpha = 1; fx.globalCompositeOperation = 'source-over';
  if (flashes.length) requestAnimationFrame(stepFx); else { running = false; fx.clearRect(0, 0, SW, SH); }
}
