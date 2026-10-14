/*
 * 大屏 · 虚拟时钟（只在导出影片时启用，网址 record=1）。
 * 把 requestAnimationFrame 和 performance.now 换成由 recTick() 一格一格推进的时间：
 * 所有特效照常运行，但时间完全由导出程序控制，电脑再慢也不会掉帧、不会卡。
 * 必须在所有特效脚本之前载入（它们一载入就开始排动画）。
 * 提供：recTick(ms)、recNow()
 * 需要：stage.js（RECORD）
 */
'use strict';

let recT = 0;
const recQ = [];
const recNow = () => recT;
// 时间往前走 ms 毫秒，跑一轮所有排队的动画
function recTick(ms) {
  recT += ms;
  for (const cb of recQ.splice(0)) cb(recT);
}
if (RECORD) {
  performance.now = recNow;
  window.requestAnimationFrame = cb => { recQ.push(cb); return recQ.length; };
  window.cancelAnimationFrame = () => {};
}
