/*
 * 现场流程（状态机）：奖项查询、分类、「下一步」会做什么、提交 / 撤销、进度存档。
 * 所有改变现场状态的操作最后都经过 commit()。
 */
'use strict';
const fs = require('fs');
const { STATE_PATH } = require('./env');
const { atomicWrite, audit } = require('./util');
const rt = require('./runtime');

/* ---- 奖项查询 */
const findAward = id => rt.data.awards.find(a => a.id === id);
const winIndex = a => (a && a.revealMode === 'nominee' ? a.winners.findIndex(w => w.win) : -1);
// 「入围揭晓」且已指定得主；没指定得主时按「逐一揭晓」处理
const isNominee = a => winIndex(a) >= 0;
// 分类：相邻、分类名称相同的奖项算一组（同名但不相邻的算两组）
function groupRun(a) {
  if (!a || !a.group) return null;
  const L = rt.data.awards, i = L.indexOf(a);
  let s = i, e = i;
  while (s > 0 && L[s - 1].group === a.group) s--;
  while (e < L.length - 1 && L[e + 1].group === a.group) e++;
  const list = L.slice(s, e + 1);
  // noNum：这一类不显示「01 / 02 / 03」编号（组里任一奖项勾了就算）
  return { title: a.group, sub: (list.find(x => x.groupSub) || {}).groupSub || '', list, index: i - s + 1, start: L[s], noNum: list.some(x => x.groupNoNum) };
}
// 奖项是否已揭晓完：普通奖项 = 名单全部出现；入围奖项 = 得主已揭晓
const isComplete = (a, st) => !!a && st.mode === 'reveal' && st.awardId === a.id && (isNominee(a) ? st.phase === 'winner' : st.revealed >= a.winners.length);
// 正在公布 / 揭晓的奖项（待机、消息、分类标题时为 null）
const currentAward = () => { const s = rt.state; return (s.mode === 'title' || s.mode === 'reveal') && s.awardId ? findAward(s.awardId) : null; };

/* ---- 进度存档（state.json 只有奖项 id 和数字，没有名字） */
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    rt.state = { ...rt.state, ...s, doneIds: Array.isArray(s.doneIds) ? s.doneIds : [] };
  } catch { /* fresh */ }
  sanitizeState();
}
// 名单改过之后：去掉不存在的奖项、把揭晓数限制在名单人数内
function sanitizeState() {
  const state = rt.state;
  state.doneIds = state.doneIds.filter(id => findAward(id));
  if (state.awardId && !findAward(state.awardId)) Object.assign(state, { mode: 'standby', awardId: null, revealed: 0 });
  const a = state.awardId && findAward(state.awardId);
  if (a) state.revealed = Math.min(state.revealed, a.winners.length);
  if (!['', 'suspense', 'winner'].includes(state.phase) || state.mode !== 'reveal' || !isNominee(a) || state.revealed < a.winners.length) state.phase = '';
}
function saveState() { try { atomicWrite(STATE_PATH, JSON.stringify(rt.state)); } catch { /* ignore */ } }

/* ---- 「下一步」 */
function nextPending(afterId, doneIds) {
  const list = rt.data.awards;
  const start = afterId ? list.findIndex(a => a.id === afterId) : -1;
  for (let i = 1; i <= list.length; i++) {
    const a = list[(start + i + list.length) % list.length];
    if (a && !doneIds.includes(a.id)) return a;
  }
  return null;
}
function markDoneIfComplete(st) {
  const a = findAward(st.awardId);
  if (isComplete(a, st) && !st.doneIds.includes(a.id)) st.doneIds.push(a.id);
}
/** 计算「下一步」会做什么：返回 { st: 新状态, desc: 说明 }，不会真的执行 */
function planNext(s) {
  const st = { ...s, doneIds: [...s.doneIds], blackout: false };
  const a = s.awardId && findAward(s.awardId);
  const nom = isNominee(a), n = a ? a.winners.length : 0;
  if (s.mode === 'title' && a) {
    st.mode = 'reveal'; st.phase = '';
    st.revealed = a.revealMode === 'all' ? n : Math.min(1, n);
    markDoneIfComplete(st);
    return { st, desc: nom ? `介绍「${a.title}」入围者 1 / ${n}` : a.revealMode === 'all' ? `一次揭晓「${a.title}」全部 ${n} 位` : `揭晓「${a.title}」第 1 位` };
  }
  if (s.mode === 'reveal' && a && s.revealed < n) {
    const rest = a.revealMode === 'all' || a.revealMode === 'firstall';   // 先一后全：第二下把剩下的全部连续揭晓
    st.revealed = rest ? n : s.revealed + 1;
    markDoneIfComplete(st);
    return { st, desc: nom ? `介绍「${a.title}」入围者 ${st.revealed} / ${n}` : rest && n - s.revealed > 1 ? `连续揭晓「${a.title}」剩下 ${n - s.revealed} 位` : `揭晓「${a.title}」第 ${st.revealed} / ${n} 位` };
  }
  if (nom && s.mode === 'reveal' && s.phase !== 'winner') {   // 入围者都介绍完：先悬念，再揭晓得主
    if (s.phase !== 'suspense') { st.phase = 'suspense'; return { st, desc: `悬念：「${a.title}」得主是……` }; }
    st.phase = 'winner'; markDoneIfComplete(st);
    return { st, desc: `🏆 揭晓「${a.title}」得主` };
  }
  const resume = s.mode !== 'reveal' && a && !st.doneIds.includes(a.id) ? a : null;
  const nx = resume || nextPending(s.awardId, st.doneIds);
  if (!nx) return { st: { ...st, mode: 'standby', awardId: null, revealed: 0, phase: '' }, desc: '所有奖项已公布 → 返回待机画面' };
  // 进入新的分类：先显示分类标题画面（可在奖项编辑里关掉）
  const g = groupRun(nx), prevG = groupRun(a);
  if (rt.data.event.groupIntro !== false && g && s.mode !== 'group' && !resume && (!prevG || prevG.start !== g.start))
    return { st: { ...st, mode: 'group', awardId: nx.id, revealed: 0, phase: '' }, desc: `分类标题「${g.title}」（${g.list.length} 个奖项）` };
  return { st: { ...st, mode: 'title', awardId: nx.id, revealed: 0, phase: '' }, desc: `公布奖项「${nx.title}」（不揭晓名单）` };
}

/* ---- 提交 / 撤销 */
function commit(next, who, desc) {
  rt.history.push(JSON.parse(JSON.stringify(rt.state)));
  if (rt.history.length > 200) rt.history.shift();
  rt.state = { ...next, seq: rt.state.seq + 1 };
  if (rt.state.mode !== 'reveal') rt.state.phase = '';
  saveState();
  audit('ACTION', who, desc);
  rt.hooks.afterChange();
}
function undo(who) {
  const prev = rt.history.pop();
  if (!prev) throw new Error('没有可撤销的操作');
  rt.state = { ...prev, seq: rt.state.seq + 1 };
  sanitizeState(); saveState(); audit('ACTION', who, '撤销'); rt.hooks.afterChange();
}

module.exports = {
  findAward, winIndex, isNominee, groupRun, isComplete, currentAward,
  loadState, sanitizeState, saveState, nextPending, markDoneIfComplete, planNext, commit, undo
};
