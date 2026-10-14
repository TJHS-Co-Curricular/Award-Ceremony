/*
 * 大屏 · 诊断信息：画面角落显示即时帧数等，用来判断「卡卡的」是画面算不过来还是网络断线。
 * 打开方式：控制端「输出页」那一栏的「📊 显示帧数」开关（所有输出页一起，重启服务端后自动关），
 *           或在输出页网址加 &fps=1（只影响这一个窗口）。控制端里的小预览不显示。
 * 显示：FPS（最近 1 秒）、最近 10 秒最低 FPS、最慢一帧、超过 50ms 的卡顿次数（最近 1 分钟）、
 *       连线状态和断线次数、舞台尺寸、当前画面、待机背景粒子数。
 * 提供：diagSet(on)、diagDrop()（main.js 断线时调用）
 * 需要：stage.js（qs、PREVIEW、SW、SH、$）
 */
'use strict';

const DIAG_URL = qs.get('fps') === '1';
let diagOn = false, diagBox = null, diagDrops = 0, diagFrames = [], diagHist = [], diagHitches = [], diagPrev = 0, diagTick = 0, diagStart = 0;

function diagDrop() { diagDrops++; }
function diagSet(on) {
  on = DIAG_URL || (!!on && !PREVIEW);
  if (on === diagOn) return;
  diagOn = on;
  if (!on) { diagBox?.remove(); diagBox = null; return; }
  diagBox = document.createElement('div');
  diagBox.style.cssText = 'position:fixed;left:8px;top:8px;z-index:200;padding:6px 10px;border-radius:6px;background:rgba(0,0,0,.72);color:#e8e8e8;' +
    'font:13px/1.45 ui-monospace,Consolas,monospace;white-space:pre;pointer-events:none;border:1px solid rgba(255,255,255,.15)';
  document.body.appendChild(diagBox);
  diagFrames = []; diagHist = []; diagHitches = []; diagPrev = 0; diagStart = performance.now();
  requestAnimationFrame(diagLoop);
}
function diagLoop(now) {
  if (!diagOn) return;
  requestAnimationFrame(diagLoop);
  if (diagPrev) {
    const dt = now - diagPrev;
    diagFrames.push([now, dt]);
    if (dt > 50) diagHitches.push(now);   // 超过 50ms 的一帧 = 肉眼看得到的「卡一下」
  }
  diagPrev = now;
  diagFrames = diagFrames.filter(f => now - f[0] < 1000);
  diagHitches = diagHitches.filter(t => now - t < 60000);
  if (now - diagTick < 250) return;      // 每 0.25 秒更新一次文字
  diagTick = now;
  const fps = diagFrames.length, worst = Math.max(0, ...diagFrames.map(f => f[1]));
  if (now - diagStart > 1200) diagHist.push([now, fps]);   // 刚打开的第一秒不算
  diagHist = diagHist.filter(h => now - h[0] < 10000);
  const low = diagHist.length ? Math.min(...diagHist.map(h => h[1])) : fps;
  const off = $('conn').classList.contains('show');
  const scene = document.querySelector('.scene.active')?.id?.replace('s-', '') || '-';
  const parts = typeof gyOn !== 'undefined' && gyOn ? `星系粒子 ${gyStreaks.length + gyDust.length + gyDots.length}` : typeof gOn !== 'undefined' && gOn ? `光河粒子 ${gParts.length}` : '';
  const mem = performance.memory ? ` · 内存 ${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)}MB` : '';
  diagBox.style.color = fps >= 50 ? '#9ff0b0' : fps >= 30 ? '#ffd27a' : '#ff8a8a';
  diagBox.textContent =
    `FPS ${String(fps).padStart(3)}   最低 ${low}（10 秒）   最慢一帧 ${worst.toFixed(0)}ms   卡顿 ${diagHitches.length} 次（1 分钟）\n` +
    `连线 ${off ? '✗ 断线重连中' : '✓ 正常'}   断线 ${diagDrops} 次（打开页面以来）   画面 ${scene}\n` +
    `舞台 ${SW}×${SH}   窗口 ${innerWidth}×${innerHeight} ×${devicePixelRatio}${parts ? '   ' + parts : ''}${mem}`;
}
