/*
 * 大屏 · 「先一后全」揭晓方式：
 *   一位一位单独出现（画面上只有当前这一位，前一位消失）→ 最后一位之后，全部一张接一张出现。
 *   全部出现时每个屏幕最多 20 张（服务端 GALLERY_MAX），超过就分页，每按一次下一页。
 * 服务端在公开视图里给 award.view：{ mode: 'solo', index } 或 { mode: 'all', page, pages, from, to }。
 * 提供：renderFirstAll(view)
 * 需要：cards.js（buildGrid、fillCard）、fx/flash.js（burst）、render.js（cur、show）、main.js（booted）
 */
'use strict';

// 已经在画面上的内容（名字、班级、照片网址、版式）：控制端改了名单保存后，大屏按这个判断要不要重画
function revealSig(a, list) {
  return JSON.stringify([a.title, a.subtitle, a.hasPhotos, a.hasTeams, a.hasIds, a.hasNotes, a.grow, list]);
}

function renderFirstAll(v) {
  const fv = v.award.view, solo = fv.mode === 'solo';
  const key = `${v.award.id}|${fv.mode}|${solo ? fv.index : fv.page}`;
  const list = (solo ? [v.winners[fv.index]] : v.winners.slice(fv.from, fv.to)).filter(Boolean);
  const sig = revealSig(v.award, list);
  if (cur.mode === 'reveal' && cur.key === key && cur.sig === sig) { show('s-reveal'); return; }   // 画面没变（例如只是活动名称改了）
  const edited = cur.mode === 'reveal' && cur.key === key;   // 同一个画面、内容改了（控制端改了名单）：静默重画
  // 往前（下一位 / 进入全部 / 下一页）才放动画；撤销往回走时静默切换
  const order = solo ? fv.index : 1e6 + fv.page;
  const forward = !(cur.mode === 'reveal' && cur.awardId === v.award.id) || order > cur.order;
  const animate = booted && forward && !edited;

  $('rTitle').textContent = v.award.title; $('rSub').textContent = v.award.subtitle || '';
  $('rTag').textContent = solo || fv.pages <= 1 ? '' : fv.chunk ? `第 ${fv.from + 1} – ${fv.to} 位` : `第 ${fv.page + 1} / ${fv.pages} 页`;   // 分组：这一组的合集
  $('s-reveal').classList.remove('suspense', 'crowned');
  buildGrid({ award: { ...v.award, total: list.length, nominee: false } });
  const cards = $('grid').children, step = list.length > 1 ? v.award.cascade || 600 : 0;
  list.forEach((w, i) => {
    if (!animate) return fillCard(cards[i], w, false);
    const card = cards[i];   // 延迟期间换了画面（网格重建）就不再填，免得旧名字跑到新奖项的卡上
    setTimeout(() => { if (!card?.isConnected) return; fillCard(card, w, true); burst(list.length > 1 ? 100 : 180); }, i * step);
  });
  cur = { mode: 'reveal', awardId: v.award.id, key, order, sig };
  show('s-reveal');
}
