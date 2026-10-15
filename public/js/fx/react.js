/*
 * 特效 · 收到新的效果设定、画面尺寸改变时要做的事。主线程和后台线程（fx/worker.js）共用同一份。
 * 提供：fxPush(next, flags)（新设定；flags：gy / gr / dust / size = 要重建哪些）、fxSizeCanvases(cw, ch)
 * 需要：dust.js（dustBuild）、galaxy.js（gyW）、goldriver.js（gW）、SW / SH / RECORD / FXC / $
 */
'use strict';

let FX_CW = 0, FX_CH = 0;
// 三个全屏特效画布的像素大小：#bg（浮尘）、#fx（闪光）= 整个舞台；#goldfx（待机背景）可按「背景解析度」缩小（导出影片时不缩）
function fxSizeCanvases(cw, ch) {
  FX_CW = cw; FX_CH = ch;
  const s = RECORD ? 1 : (+FXC.bgScale || 1);
  for (const [id, k] of [['bg', 1], ['fx', 1], ['goldfx', s]]) {
    const c = $(id), w = Math.max(2, Math.round(cw * k)), h = Math.max(2, Math.round(ch * k));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    c.getContext('2d').setTransform(w / SW, 0, 0, h / SH, 0, 0);   // 特效一律用舞台坐标画
  }
}
function fxPush(next, flags = {}) {
  FXC = next;
  if (flags.gy) gyW = 0;      // 星系下一帧重建
  if (flags.gr) gW = 0;       // 光河下一帧重建
  if (flags.dust) dustBuild();
  if (flags.size && FX_CW) fxSizeCanvases(FX_CW, FX_CH);
}
// 主线程模式：fit() 第一次调用时这个文件还没载入，这里补一次（导出影片要靠它设好放大倍数）
if (typeof document !== 'undefined') fxSizeCanvases($('bg').width, $('bg').height);
