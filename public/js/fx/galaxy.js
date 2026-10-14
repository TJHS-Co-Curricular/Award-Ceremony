/*
 * 特效 · 待机画面背景「旋涡星系」（canvas #goldfx，原创程序绘制，离线可用；只在待机画面显示时运行）。
 * 倾斜的金色旋涡星系绕着暗色核心公转（内圈快、外圈慢）：两条旋臂由弧形光痕组成，加上细金粉和闪烁的亮金点。
 * 星系中心不在画面中间（超宽屏偏右下，其它比例偏下），标题后面压暗，字更清楚。
 * 提供：galaxyFx(on)
 * 需要：stage.js（SW、SH、PREVIEW、$）
 */
"use strict";

const GY = {
  BRIGHT: 1, // 整体亮度（1 = 最亮）
  SPEED: 0.12, // 公转速度
  STREAKS: 10000, // 弧形光痕数量（1920×1080 基准，会按画面大小增减）
  DUST: 18000, // 细金粉数量
  DOTS: 520, // 闪烁亮金点数量
  STARS: 6500, // 背景远处小星（静态）
  ARMS: 3, // 旋臂数量
};
const gyCanvas = $("goldfx"),
  gyCtx = gyCanvas.getContext("2d");
let gyOn = false,
  gyLast = 0,
  gyT = 0,
  gySlow = 0,
  gyW = 0,
  gyH = 0,
  gyBg = null,
  gyStreaks = [],
  gyDust = [],
  gyDots = [],
  gyG = null;
const gySprite = (() => {
  // 预先画好的发光圆点
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d"),
    gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,252,220,1)");
  gr.addColorStop(0.18, "rgba(255,220,90,.85)");
  gr.addColorStop(0.5, "rgba(255,180,20,.25)");
  gr.addColorStop(1, "rgba(255,170,0,0)");
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  return c;
})();
const gyGauss = () =>
  (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;

// 按舞台尺寸决定星系的位置和大小，重建静态背景和所有粒子
function gyBuild() {
  gyW = SW;
  gyH = SH;
  const wide = SW / SH > 2.2,
    U = Math.min(SH, SW / 1.8),
    B = GY.BRIGHT;
  const G = (gyG = {
    CX: SW * (wide ? 0.66 : 0.6),
    CY: SH * (wide ? 0.64 : 0.7),
    TILT: 0.36,
    ROT: -0.16,
    R0: U * 0.11,
    RMAX: U * 1.15,
  });
  G.cos = Math.cos(G.ROT);
  G.sin = Math.sin(G.ROT);
  const k =
    (PREVIEW ? 0.3 : 1) *
    Math.min(1.8, Math.max(0.6, ((SW * SH) / (1920 * 1080)) * 0.6)); // 粒子数量按画面面积
  // ---- 静态背景：黑底 + 暖金辉光 + 远处的小金星 + 核心暗心 + 标题后面压暗
  gyBg = document.createElement("canvas");
  gyBg.width = SW;
  gyBg.height = SH;
  const b = gyBg.getContext("2d");
  b.fillStyle = "#030201";
  b.fillRect(0, 0, SW, SH);
  const glow = (rx, ry, stops) => {
    b.save();
    b.translate(G.CX, G.CY);
    b.rotate(G.ROT);
    b.scale(rx / ry, 1);
    const gr = b.createRadialGradient(0, 0, 0, 0, 0, ry);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    b.fillStyle = gr;
    b.beginPath();
    b.arc(0, 0, ry, 0, 6.283);
    b.fill();
    b.restore();
  };
  b.globalCompositeOperation = "lighter";
  glow(G.RMAX * 1.1, G.RMAX * G.TILT * 1.3, [
    [0, `rgba(255,215,60,${0.26 * B})`],
    [0.35, `rgba(240,175,20,${0.13 * B})`],
    [1, "rgba(150,90,0,0)"],
  ]);
  glow(G.R0 * 2.6, G.R0 * 2.6 * G.TILT, [
    [0, `rgba(255,245,170,${0.35 * B})`],
    [1, "rgba(255,215,70,0)"],
  ]);
  for (let i = 0, n = GY.STARS * k; i < n; i++) {
    b.fillStyle = `rgba(255,${(200 + Math.random() * 50) | 0},${(90 + Math.random() * 80) | 0},${(0.15 + 0.55 * Math.random()) * B})`;
    const r =
      Math.random() < 0.97 ? 0.8 + Math.random() : 1.8 + Math.random() * 1.5;
    b.fillRect(Math.random() * SW, Math.random() * SH, r, r);
  }
  b.globalCompositeOperation = "source-over";
  glow(G.R0 * 1.05, G.R0 * 1.05 * G.TILT, [
    [0, "rgba(6,3,0,.96)"],
    [0.75, "rgba(10,5,0,.85)"],
    [1, "rgba(10,5,0,0)"],
  ]);
  const sh = b.createRadialGradient(
    SW / 2,
    SH * 0.25,
    0,
    SW / 2,
    SH * 0.25,
    SH * 0.7,
  );
  sh.addColorStop(0, "rgba(0,0,0,.55)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  b.fillStyle = sh;
  b.fillRect(0, 0, SW, SH);
  // ---- 公转的粒子：角速度 ∝ r^-1.25（内圈快、外圈慢），沿对数螺旋分成两条旋臂
  const spin = (r) => 0.55 * Math.pow(G.R0 / r, 1.25);
  const armAngle = (r) =>
    (((Math.random() * GY.ARMS) | 0) * Math.PI * 2) / GY.ARMS +
    Math.log(r / G.R0) * 2.2;
  gyStreaks = Array.from({ length: Math.round(GY.STREAKS * k) }, () => {
    const r = G.R0 * 1.05 + Math.pow(Math.random(), 1.8) * (G.RMAX - G.R0),
      hot = Math.max(0, 1 - (r - G.R0) / (G.R0 * 2.2)); // hot：靠近核心的亮环
    const c =
      Math.random() < 0.18
        ? "255,252,220"
        : Math.random() < 0.65
          ? "255,228,80"
          : "255,196,40";
    return {
      r,
      a: armAngle(r) + gyGauss() * (Math.random() < 0.7 ? 0.35 : 1.4),
      w: spin(r),
      len: 0.05 + Math.random() * 0.14,
      s: 0.6 + Math.random() * 1.6 + hot * 1.2,
      hot,
      c,
    };
  });
  gyDust = Array.from({ length: Math.round(GY.DUST * k) }, () => {
    const r = G.R0 * 1.1 + Math.pow(Math.random(), 1.4) * (G.RMAX * 1.1 - G.R0);
    return {
      r: r * (1 + gyGauss() * 0.06),
      a: armAngle(r) + gyGauss() * (Math.random() < 0.6 ? 0.5 : 2.2),
      w: spin(r),
      s: 0.7 + Math.random() * 1.3,
      al: 0.25 + Math.random() * 0.6,
      tw: Math.random() * 6.28,
      f: 0.5 + Math.random() * 2,
    };
  });
  gyDots = Array.from({ length: Math.round(GY.DOTS * k) }, () => {
    const r = G.R0 * 1.2 + Math.random() * (G.RMAX - G.R0);
    return {
      r,
      a: Math.random() * 6.28,
      w: spin(r),
      s: 2 + Math.random() * 5,
      tw: Math.random() * 6.28,
    };
  });
}
// 星系平面上的 (半径, 角度) → 画面坐标（倾斜成椭圆再转一点角度）
function gyProj(r, a) {
  const G = gyG,
    x = r * Math.cos(a),
    y = r * Math.sin(a) * G.TILT;
  return [G.CX + x * G.cos - y * G.sin, G.CY + x * G.sin + y * G.cos];
}

function gyFrame(now) {
  if (!gyOn) return;
  requestAnimationFrame(gyFrame);
  const dt = Math.min(0.05, (now - (gyLast || now)) / 1000);
  gyLast = now;
  gyT += dt * GY.SPEED;
  if (gyW !== SW || gyH !== SH || !gyBg) gyBuild();
  const g = gyCtx,
    B = GY.BRIGHT,
    t0 = performance.now();
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  g.drawImage(gyBg, 0, 0);
  g.globalCompositeOperation = "lighter";
  g.lineCap = "round";
  for (const p of gyStreaks) {
    // 弧形光痕
    const a1 = p.a + gyT * p.w * 6,
      a0 = a1 - p.len * (0.6 + p.w * 2),
      near = 0.55 + 0.45 * Math.max(0, Math.sin(a1)); // 下半圈靠近观众，亮一点
    const [x1, y1] = gyProj(p.r, a1),
      [xm, ym] = gyProj(p.r, (a0 + a1) / 2),
      [x0, y0] = gyProj(p.r, a0);
    g.strokeStyle = `rgba(${p.c},${Math.min(1, (0.3 + 0.55 * p.hot) * near * B)})`;
    g.lineWidth = p.s * (0.7 + 0.5 * near);
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(xm * 2 - (x0 + x1) / 2, ym * 2 - (y0 + y1) / 2, x1, y1);
    g.stroke();
  }
  g.fillStyle = "#ffe48a";
  for (const d of gyDust) {
    // 细金粉（小方点，很省资源）
    const a = d.a + gyT * d.w * 6,
      [x, y] = gyProj(d.r, a);
    g.globalAlpha =
      d.al *
      (0.6 + 0.4 * Math.max(0, Math.sin(a))) *
      (0.55 + 0.45 * Math.sin(d.tw + (now / 1000) * d.f)) *
      B;
    g.fillRect(x, y, d.s, d.s);
  }
  for (const d of gyDots) {
    // 闪烁的亮金点
    const [x, y] = gyProj(d.r, d.a + gyT * d.w * 6);
    g.globalAlpha =
      (0.4 + 0.6 * Math.pow(Math.max(0, Math.sin(d.tw + now / 900)), 2)) * B;
    g.drawImage(gySprite, x - d.s * 2, y - d.s * 2, d.s * 4, d.s * 4);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  // 太慢的电脑自动减少粒子（连续多帧超过 22ms）
  if (performance.now() - t0 > 22) {
    if (++gySlow > 30 && gyStreaks.length > 1500) {
      for (const L of [gyStreaks, gyDust, gyDots])
        L.length = Math.round(L.length * 0.7);
      gySlow = 0;
    }
  } else gySlow = 0;
}
function galaxyFx(on) {
  if (on === gyOn) return;
  gyOn = on;
  if (on) {
    gyLast = 0;
    requestAnimationFrame(gyFrame);
  }
}
