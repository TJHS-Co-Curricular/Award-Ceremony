/*
 * 大屏 · 虚拟时钟（只在导出影片时启用，网址 record=1）。
 * 把 requestAnimationFrame 和 performance.now 换成由 recTick() 一格一格推进的时间：
 * 所有特效照常运行，但时间完全由导出程序控制，电脑再慢也不会掉帧、不会卡。
 * 必须在所有特效脚本之前载入（它们一载入就开始排动画）。
 * 分段同时渲染（lib/render.js 把一支影片切成几段，交给几个分页同时算）要每一段的画面接得上，所以导出时：
 *   Math.random 换成固定种子（每个分页的粒子分布、闪光位置都一样）；
 *   REC_SKIP = true 时特效只推进状态、不画图（快速跳到这一段的开头）。
 * 提供：recTick(ms)、recNow()、REC_SKIP
 * 需要：stage.js（RECORD）
 */
'use strict';

let recT = 0, REC_SKIP = false;
const recQ = [];
const recNow = () => recT;
// 时间往前走 ms 毫秒，跑一轮所有排队的动画
function recTick(ms) {
  recT += ms;
  for (const cb of recQ.splice(0)) cb(recT);
}
if (RECORD) {
  let seed = 0x2545f491;   // mulberry32：固定种子的随机数
  Math.random = () => { seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  performance.now = recNow;
  window.requestAnimationFrame = cb => { recQ.push(cb); return recQ.length; };
  window.cancelAnimationFrame = () => {};
}
