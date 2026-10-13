/*
 * 特效 · 背景浮尘：整个舞台底层缓慢飘动的金色微粒（canvas #bg，约 30 fps）。
 * 需要：stage.js（SW、SH、PREVIEW）
 */
'use strict';

const bg = $('bg').getContext('2d');
const dust = Array.from({ length: PREVIEW ? 30 : Math.round(90 * SW / 1920) }, () => ({
  x: Math.random() * SW, y: Math.random() * SH, r: Math.random() * 2.2 + .4,
  vy: -(Math.random() * .25 + .05), vx: (Math.random() - .5) * .15, a: Math.random() * .5 + .1, t: Math.random() * 6.28
}));
let bgOdd = false;
(function drawBg() {
  requestAnimationFrame(drawBg);
  if ((bgOdd = !bgOdd)) return;   // 隔帧画一次（≈30 fps）
  bg.clearRect(0, 0, SW, SH);
  for (const d of dust) {
    d.x += d.vx * 2; d.y += d.vy * 2; d.t += .04;   // 隔帧画，步长加倍保持原速度
    if (d.y < -10 || d.x > SW + 10) { d.y = SH + 10; d.x = Math.random() * SW; }
    bg.globalAlpha = d.a * (.6 + .4 * Math.sin(d.t));
    bg.fillStyle = '#f2d48a';
    bg.beginPath(); bg.arc(d.x, d.y, d.r, 0, 6.283); bg.fill();
  }
})();
