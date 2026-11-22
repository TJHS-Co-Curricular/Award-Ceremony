/*
 * 特效 · 收到新的效果设定、画面尺寸改变时要做的事。主线程和后台线程（fx/worker.js）共用同一份。
 * 提供：fxPush(next, flags)（新设定；flags.dust = 重建浮尘）、fxSizeCanvases(cw, ch)
 * 需要：dust.js（dustBuild）、SW / SH / FXC / $
 */
'use strict';

// 两个全屏特效画布的像素大小：#bg（浮尘）、#fx（闪光）= 整个舞台
function fxSizeCanvases(cw, ch) {
  for (const id of ['bg', 'fx']) {
    const c = $(id), w = Math.max(2, Math.round(cw)), h = Math.max(2, Math.round(ch));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    c.getContext('2d').setTransform(w / SW, 0, 0, h / SH, 0, 0);   // 特效一律用舞台坐标画
  }
}
function fxPush(next, flags = {}) {
  FXC = next;
  if (flags.dust) dustBuild();
}
// 主线程模式：fit() 第一次调用时这个文件还没载入，这里补一次（导出影片要靠它设好放大倍数）
if (typeof document !== 'undefined') fxSizeCanvases($('bg').width, $('bg').height);
