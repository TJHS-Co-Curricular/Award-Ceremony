/*
 * 特效 · 载入方式（浮尘、揭晓闪光）：
 *   后台线程（默认）：把两个特效画布转成 OffscreenCanvas 交给 fx/worker.js，特效在另一个 CPU 核心上跑；
 *     这里只留同名的转达函数（burst、fxPush、fxSizeCanvases），其它脚本照常调用。
 *   主线程：导出影片（record=1，要靠虚拟时钟一格一格推进）、浏览器不支持 OffscreenCanvas、或网址加 &worker=0 时，
 *     照旧在网页里载入特效脚本（document.write，按顺序同步载入）。
 * （1.70 起拿掉了程序画的待机背景：旋涡星系、金色光河，维护者定 2026-11-22）
 * 提供：FX_WORKER、FX_STATS（后台线程的回报，诊断框用）
 * 需要：stage.js（RECORD、PREVIEW、qs、$、SW、SH）、fxconf.js（FXC）
 */
'use strict';

const FX_WORKER = !RECORD && qs.get('worker') !== '0' && typeof OffscreenCanvas === 'function' &&
  'transferControlToOffscreen' in HTMLCanvasElement.prototype && typeof Worker === 'function';
let FX_STATS = '';

if (!FX_WORKER) {
  for (const f of ['dust', 'flash', 'react']) document.write(`<script src="/assets/js/fx/${f}.js"><\/script>`);
} else {
  const ids = ['bg', 'fx'], cw = $('bg').width, ch = $('bg').height;
  const canvases = ids.map(id => [id, $(id).transferControlToOffscreen()]);
  const fxWorker = new Worker('/assets/js/fx/worker.js');
  fxWorker.postMessage({ init: { SW, SH, PREVIEW, FXC, cw, ch, canvases } }, canvases.map(c => c[1]));
  let alive = false;
  fxWorker.onmessage = e => { if ('stats' in e.data) { FX_STATS = e.data.stats; alive = true; } };
  fxWorker.onerror = e => console.error('特效后台线程出错：', e.message);
  // 保险：6 秒内后台线程没回报（浏览器不支持 / 出错）→ 改用主线程模式重新载入（画布已经交出去，只能重新载入）
  setTimeout(() => { if (!alive) location.replace(location.href + (location.search ? '&' : '?') + 'worker=0'); }, 6000);
  // 转达：名字和主线程模式一样（挂在 window 上，控制端预览也能叫）
  window.burst = n => fxWorker.postMessage({ burst: n });
  window.fxPush = (next, flags = {}) => fxWorker.postMessage({ fx: next, flags });
  window.fxSizeCanvases = (w, h) => fxWorker.postMessage({ size: [SW, SH, w, h] });
}
