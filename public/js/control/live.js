/*
 * 控制端 · 现场控制的操作：下一步 / 撤销 / 待机 / 黑屏 / 消息、自动播放、快捷键（翻页笔）。
 * 提供：act(action, extra)、toggleAuto()
 */
'use strict';

let lastNext = 0;
async function act(action, extra = {}) {
  if (action === 'next') { const t = Date.now(); if (t - lastNext < 500) return; lastNext = t; }
  try { await api('POST', '/api/control/action', { action, ...extra }); log(labelOf(action, extra)); }
  catch (err) { toast(err.message, true); }
}
function labelOf(a, x) {
  const t = x.awardId && V.awards.find(w => w.id === x.awardId)?.title;
  return ({ next: '下一步', undo: '撤销', standby: '待机', blackout: '黑屏切换', message: '消息：' + (x.text || ''), title: '公布奖项 ' + (t || ''), group: '分类标题 ' + (x.awardId && V.awards.find(w => w.id === x.awardId)?.group || ''), photo: '合影画面 ' + (t || ''), diag: x.on ? '输出页显示帧数' : '输出页隐藏帧数', revealAll: '全部揭晓 ' + (t || ''), markPending: '标为未公布 ' + (t || ''), resetProgress: '重置进度', autoStart: `自动播放（每 ${x.interval}s）`, autoStop: '暂停自动播放', guestArm: '交给嘉宾', guestDisarm: '收回嘉宾授权', rotateGuestKey: '更换嘉宾链接' })[a] || a;
}
$('bNext').onclick = () => act('next');
$('bUndo').onclick = () => act('undo');
$('bStandby').onclick = () => act('standby');
$('bBlack').onclick = () => act('blackout');
$('bRevealAll').onclick = () => V.state.awardId && act('revealAll', { awardId: V.state.awardId });
$('bDiag').onclick = () => act('diag', { on: !V.diag });
$('bPhoto').onclick = () => { const id = sel || V.state.awardId; if (id) act('photo', { awardId: id }); };
$('bMsg').onclick = () => { const t = $('msgIn').value.trim(); if (t) act('message', { text: t }); };
$('msgIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('bMsg').click(); });
$('bReset').onclick = () => { if (confirm('确定把所有奖项重置为「未公布」并返回待机？')) act('resetProgress'); };
/* 自动播放 */
const autoPrefs = (() => { try { return JSON.parse(store.get('ac_auto') || '{}'); } catch { return {}; } })();
if (autoPrefs.interval) $('autoInt').value = autoPrefs.interval;
if (autoPrefs.hold) $('autoHold').value = autoPrefs.hold;
if (autoPrefs.scope) $('autoScope').value = autoPrefs.scope;
function toggleAuto() {
  if (V?.auto?.on) return act('autoStop');
  const o = { interval: Number($('autoInt').value) || 3, hold: Number($('autoHold').value) || 6, scope: $('autoScope').value };
  store.set('ac_auto', JSON.stringify(o));
  act('autoStart', o);
}
$('bAuto').onclick = toggleAuto;
let autoDeadline = 0, autoTotal = 0;
(function tick() {
  const left = autoDeadline - Date.now();
  if (V?.auto?.on && autoDeadline) {
    $('autoBar').style.width = Math.min(100, Math.max(0, 100 - left / autoTotal * 100)) + '%';
    $('autoState').textContent = `播放中 · ${Math.max(0, left / 1000).toFixed(1)} 秒后下一步`;
  }
  requestAnimationFrame(tick);
})();

/* 快捷消息 */
const QUICK = ['请获奖同学上台领奖', '请颁奖嘉宾上台', '掌声恭喜！', '合影留念', '感谢各位莅临'];
for (const q of QUICK) $('quickMsgs').append(el('button', { onclick: () => act('message', { text: q }) }, q));

/* 快捷键（只在「现场控制」分页有效；二维码弹窗打开时只用来关弹窗） */
addEventListener('keydown', e => {
  if (qrIdx >= 0) { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); closeQr(); } return; }
  if ($('app').classList.contains('hidden') || $('live').classList.contains('hidden')) return;   // 只有「现场控制」分页响应快捷键
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  const k = e.key;
  if (k === ' ' || k === 'PageDown' || k === 'ArrowRight') { e.preventDefault(); act('next'); }
  else if (k === 'PageUp' || k === 'ArrowLeft') { e.preventDefault(); act('undo'); }
  else if (k === 'b' || k === 'B' || k === '.') { e.preventDefault(); act('blackout'); }
  else if (k === 'h' || k === 'H') { e.preventDefault(); act('standby'); }
  else if (k === 'a' || k === 'A') { e.preventDefault(); toggleAuto(); }
  else if (k === 'g' || k === 'G') { e.preventDefault(); toggleGuest(); }
  else if (k === 'p' || k === 'P') { e.preventDefault(); $('bPhoto').click(); }
});
