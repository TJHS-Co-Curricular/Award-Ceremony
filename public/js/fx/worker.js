/*
 * 特效 · 后台线程（Web Worker）：浮尘、闪光、待机背景（星系 / 光河）的计算和画图都搬到这里，
 * 不占网页主线程（主线程只管文字、卡片和动画），两个屏幕的特效也会分到不同的 CPU 核心。
 * 画布用 OffscreenCanvas（由 fx/host.js 把 #bg / #goldfx / #fx 转交过来），一样用显卡画。
 * 特效脚本和主线程模式完全同一份（importScripts），这里只补上它们需要的全局名字。
 * 收：init（尺寸、设定、画布）、size、fx（新设定 + 要重建什么）、burst、standby
 * 发：stats（给诊断框看的粒子数）
 */
'use strict';

var SW = 1920, SH = 1080, PREVIEW = false, RECORD = false, REC_SKIP = false, REC_K = 1, FXC = {};
const FX_CANVAS = {};
const $ = id => FX_CANVAS[id];
const mkCanvas = (w = 1, h = 1) => new OffscreenCanvas(w, h);
if (typeof self.requestAnimationFrame !== 'function') self.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
var fxDrawn = 0;   // 待机背景每秒实际画了几帧（galaxy.js / goldriver.js 会加）

let fxReady = false;
self.onmessage = e => {
  const m = e.data;
  if (m.init) {
    ({ SW, SH, PREVIEW, FXC } = m.init);
    for (const [id, c] of m.init.canvases) FX_CANVAS[id] = c;
    importScripts('dust.js', 'flash.js', 'goldriver.js', 'galaxy.js', 'standby.js', 'react.js');
    fxSizeCanvases(m.init.cw, m.init.ch);
    fxReady = true;
    setInterval(() => {
      const parts = gyOn ? '星系粒子 ' + (gyStreaks.length + gyDust.length + gyDots.length) : gOn ? '光河粒子 ' + gParts.length : '';
      self.postMessage({ stats: parts ? parts + '   背景 ' + fxDrawn + ' fps' : '' }); fxDrawn = 0;
    }, 1000);
    return;
  }
  if (!fxReady) return;
  if (m.size) { [SW, SH] = m.size; fxSizeCanvases(m.size[2], m.size[3]); }
  if (m.fx) fxPush(m.fx, m.flags);
  if (m.burst) burst(m.burst);
  if (m.standby) standbyFx(m.standby[0], m.standby[1]);
};
