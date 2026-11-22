/*
 * 控制端 · 奖项编辑的左边目录：和现场控制的奖项列表一样按「大类 → 分类 → 奖项」排，点一下跳到右边那个奖项。
 * 右边滚动时，目录跟着标出现在看到的奖项。改了奖项名称 / 分类 / 大类 / 名单 / 揭晓方式，0.3 秒后自动更新。
 * 提供：enavRender()（editor.js 的 renderEditor() 最后调用）、enavSoon()（输入时调用）、enavGo(i)
 * 需要：core.js（$、el）、editor.js（draft、#elist 里每张卡片的 id = ec<序号>）、import.js（socMissing，调用时才用）
 */
'use strict';

const ENAV_MODE = { one: '逐一', firstall: '先一后全', all: '一次全部', nominee: '入围' };
let enavT = 0, enavCur = -1;
const enavSoon = () => { clearTimeout(enavT); enavT = setTimeout(enavRender, 300); };
function enavGo(i) { const c = $('ec' + i); if (c) { c.scrollIntoView({ block: 'start' }); enavMark(i); } }
// 这个奖项有没有要注意的地方（和卡片上的警告同一套规则，加上「没有名单」）
function enavWarn(a) {
  if (!a.winners.length) return '没有名单';
  if (a.revealMode === 'nominee' && a.winners.filter(w => w.win).length !== 1) return '得主没标好';
  if (typeof socMissing === 'function' && socMissing(a.winners).length) return socL() + '查不到';
  return '';
}
function enavRender() {
  clearTimeout(enavT);
  const box = $('enav'); if (!box || !draft) return;
  const L = draft.awards;
  $('enavCount').textContent = L.length;
  box.replaceChildren(el('div', { class: 'aitem', onclick: () => { $('emain').scrollTop = 0; } },
    el('div', { class: 't' }, el('span', {}, '活动资料 · 批量导入 · 照片'))));
  const head = (cls, text, sub, i) => el('div', { class: 'ghead' + cls, onclick: () => enavGo(i), title: '跳到这一组的第一个奖项' },
    el('span', { class: 'gt' }, text, sub ? el('small', {}, sub) : null));
  L.forEach((a, i) => {
    const p = L[i - 1];
    if (a.section && (!p || p.section !== a.section)) box.append(head(' shead', a.section, a.sectionSub, i));
    if (a.group && (!p || p.group !== a.group || p.section !== a.section)) box.append(head('', a.group, a.groupSub, i));
    const w = enavWarn(a);
    box.append(el('div', { class: 'aitem' + (a.group ? ' ing' : ''), 'data-i': i, onclick: () => enavGo(i) },
      el('div', { class: 't' }, el('span', {}, el('b', { class: 'no' }, `#${i + 1}`), a.title || '（未命名）',
        el('small', { class: 'mi' }, `${a.winners.length} 位 · ${ENAV_MODE[a.revealMode] || ''}`), w ? el('small', { class: 'mi bad' }, `⚠ ${w}`) : null))));
  });
  enavCur = -1; enavSpy();
}
function enavMark(i) {
  if (i === enavCur) return;
  enavCur = i;
  for (const x of $('enav').querySelectorAll('.aitem.sel')) x.classList.remove('sel');
  const it = $('enav').querySelector(`.aitem[data-i="${i}"]`);
  if (it) { it.classList.add('sel'); it.scrollIntoView({ block: 'nearest' }); }
}
// 右边滚到哪个奖项：顶部已经过了画面上方 1/3 的最后一张卡片
function enavSpy() {
  const m = $('emain'), cards = $('elist').children; if (!cards.length || !m.clientHeight) return;
  const y = m.getBoundingClientRect().top + m.clientHeight / 3;
  let cur = -1;
  for (const c of cards) { if (!c.id) continue; if (c.getBoundingClientRect().top <= y) cur = +c.id.slice(2); else break; }
  enavMark(cur);
}
$('emain').addEventListener('scroll', enavSpy, { passive: true });
