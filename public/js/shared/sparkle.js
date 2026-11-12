/*
 * 共用 · 金色闪光小光点：照片卡 / 个人导出图的左边（加暗的那一块）铺上和大屏背景同一种金色浮尘感的光点。
 * 大屏（display/exstyle.js）用 3 层做成 CSS 背景、各自一闪一闪；控制端图片导出（control/export.js）把同样 3 层静态画上去。
 * 固定种子：每次生成的光点位置都一样，所以大屏和导出图片的光点排法相同。
 * 提供：SPARK_LAYERS、sparkleTile(seed, n)
 */
'use strict';

// 3 层：种子、光点数、在导出图上的不透明度（大屏上这 3 层轮流闪）、错开的位置（占一格的比例）
const SPARK_LAYERS = [
  { seed: 11, n: 20, alpha: 1, dx: 0, dy: 0 },
  { seed: 23, n: 22, alpha: .7, dx: .37, dy: .61 },
  { seed: 37, n: 26, alpha: .45, dx: .71, dy: .23 }
];
const SPARK_TILE = 512;   // 一格的像素（一格铺成照片高 × 0.9）
function sparkleTile(seed, n) {
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const S = SPARK_TILE, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), cols = ['255,240,190', '243,213,138', '217,178,95', '255,250,230'];
  for (let i = 0; i < n; i++) {
    const x = rnd() * S, y = rnd() * S, r = 1 + rnd() ** 3 * 4, col = cols[Math.floor(rnd() * cols.length)], star = r > 2.6;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {   // 贴边的光点在对边也画一份：铺开时接缝看不出来
      const px = x + ox, py = y + oy, R = r * 4.5;
      if (px < -R * 2 || px > S + R * 2 || py < -R * 2 || py > S + R * 2) continue;
      const gl = g.createRadialGradient(px, py, 0, px, py, R);
      gl.addColorStop(0, `rgba(${col},.55)`); gl.addColorStop(.35, `rgba(${col},.18)`); gl.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gl; g.fillRect(px - R, py - R, R * 2, R * 2);
      g.fillStyle = `rgba(255,250,235,.95)`; g.beginPath(); g.arc(px, py, r * .55, 0, Math.PI * 2); g.fill();
      if (star) {   // 大一点的光点加十字光芒
        const L = r * 7;
        for (const [ax, ay] of [[1, 0], [0, 1]]) {
          const ln = g.createLinearGradient(px - ax * L, py - ay * L, px + ax * L, py + ay * L);
          ln.addColorStop(0, `rgba(${col},0)`); ln.addColorStop(.5, `rgba(${col},.85)`); ln.addColorStop(1, `rgba(${col},0)`);
          g.strokeStyle = ln; g.lineWidth = Math.max(.8, r * .35);
          g.beginPath(); g.moveTo(px - ax * L, py - ay * L); g.lineTo(px + ax * L, py + ay * L); g.stroke();
        }
      }
    }
  }
  return c;
}
