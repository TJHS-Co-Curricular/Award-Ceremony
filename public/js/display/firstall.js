/*
 * 大屏 · 「先一后全」揭晓方式：
 *   一位一位单独出现（画面上只有当前这一位，前一位消失）→ 最后一位之后，全部一张接一张出现。
 *   全部出现时每个屏幕最多 20 张（服务端 GALLERY_MAX），超过就分页，每按一次下一页。
 * 服务端在公开视图里给 award.view：{ mode: 'solo', index } 或 { mode: 'all', page, pages, from, to }。
 * 提供：renderFirstAll(view)
 * 需要：cards.js（buildGrid、fillCard）、fx/flash.js（burst）、render.js（cur、show）、main.js（booted）
 */
'use strict';

function renderFirstAll(v) {
  const fv = v.award.view, solo = fv.mode === 'solo';
  const key = `${v.award.id}|${fv.mode}|${solo ? fv.index : fv.page}`;
  if (cur.mode === 'reveal' && cur.key === key) { show('s-reveal'); return; }   // 画面没变（例如只是活动名称改了）
  // 往前（下一位 / 进入全部 / 下一页）才放动画；撤销往回走时静默切换
  const order = solo ? fv.index : 1e6 + fv.page;
  const forward = !(cur.mode === 'reveal' && cur.awardId === v.award.id) || order > cur.order;
  const animate = booted && forward;
  const list = (solo ? [v.winners[fv.index]] : v.winners.slice(fv.from, fv.to)).filter(Boolean);

  $('rTitle').textContent = v.award.title; $('rSub').textContent = v.award.subtitle || '';
  $('rTag').textContent = !solo && fv.pages > 1 ? `第 ${fv.page + 1} / ${fv.pages} 页` : '';
  $('s-reveal').classList.remove('suspense', 'crowned');
  buildGrid({ award: { ...v.award, total: list.length, nominee: false } });
  const cards = $('grid').children, step = list.length > 1 ? v.award.cascade || 600 : 0;
  list.forEach((w, i) => {
    if (!animate) return fillCard(cards[i], w, false);
    const card = cards[i];   // 延迟期间换了画面（网格重建）就不再填，免得旧名字跑到新奖项的卡上
    setTimeout(() => { if (!card?.isConnected) return; fillCard(card, w, true); burst(list.length > 1 ? 100 : 180); }, i * step);
  });
  cur = { mode: 'reveal', awardId: v.award.id, key, order };
  show('s-reveal');
}
