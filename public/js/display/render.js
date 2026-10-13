/*
 * 大屏 · 渲染：按服务端推来的画面数据切换场景（待机 / 消息 / 分类标题 / 奖项标题 / 揭晓）。
 * 提供：render(view)、relayout()、show(sceneId)
 * 需要：stage.js、cards.js、nominee.js、fonts.js、fx/flash.js、fx/goldriver.js
 */
'use strict';

let cur = { mode: null, awardId: null, shown: 0, total: 0 };

let gStop = 0;
function show(id) {
  // 待机画面的金色光河：显示时运行，离开后等淡出完再停（省电）
  clearTimeout(gStop);
  if (id === 's-standby') goldFx(true); else gStop = setTimeout(() => goldFx(false), 1200);
  for (const s of document.querySelectorAll('.scene')) {
    const on = s.id === id;
    if (on && !s.classList.contains('active')) { s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter'); }
    s.classList.toggle('active', on);
  }
}
function relayout() {           // 屏幕比例变了：静默重排当前画面（不放动画）
  if (!lastV) return;
  $('evTitle').dataset.w = '';   // 字体或尺寸变了：标题重新缩放
  const b = booted; booted = false; cur = { mode: null }; render(lastV); booted = b;
}
function render(v) {
  lastV = v;
  applyFonts(v.event);
  $('black').classList.toggle('on', !!v.blackout);
  if ($('evTitle').textContent !== (v.event?.title || '') || $('evTitle').dataset.w !== String(SW)) {   // 标题太长就缩小，保持一行
    const h = $('evTitle'); h.textContent = v.event?.title || ''; h.style.fontSize = ''; h.dataset.w = SW;
    requestAnimationFrame(() => fitText(h));
  }
  $('evSub').textContent = v.event?.subtitle || '';

  if (v.mode === 'standby') { show('s-standby'); cur = { mode: 'standby' }; return; }
  if (v.mode === 'message') {
    if (cur.mode !== 'message' || $('msg').textContent !== v.message) {
      $('msg').textContent = v.message || '';
      $('s-message').classList.remove('active');
    }
    show('s-message'); cur = { mode: 'message' }; return;
  }
  if (v.mode === 'group' && v.group) {
    const key = v.group.title + '|' + (v.group.noNum ? 1 : 0) + '|' + v.group.awards.map(x => x.title).join('|');
    if (cur.mode === 'group' && cur.key !== key) $('s-group').classList.remove('active');   // 换了分类：重新进场
    $('gTitle').textContent = v.group.title; $('gSub').textContent = v.group.sub || '';
    const ol = $('gList'); ol.textContent = '';
    v.group.awards.forEach((x, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<b></b><span></span><small></small>';
      li.children[0].textContent = String(i + 1).padStart(2, '0'); li.children[1].textContent = x.title; li.children[2].textContent = x.subtitle || '';
      if (v.group.noNum) li.children[0].remove();   // 这一类设定为不显示编号
      ol.appendChild(li);
    });
    $('s-group').classList.toggle('many', v.group.awards.length > 5);
    $('s-group').classList.toggle('nonum', !!v.group.noNum);
    show('s-group'); cur = { mode: 'group', key }; return;
  }
  const gl = v.award?.group ? `${v.award.group}${v.award.groupTotal > 1 && !v.award.groupNoNum ? ' · 奖项 ' + String(v.award.groupIndex).padStart(2, '0') : ''}` : '';
  $('tGroup').textContent = gl; $('rGroup').textContent = gl;
  if (v.mode === 'title') {
    $('tTitle').textContent = v.award.title; $('tSub').textContent = v.award.subtitle || '';
    $('tSoon').textContent = v.guestArmed ? '有 请 嘉 宾 揭 晓' : '即 将 揭 晓';
    if (cur.mode === 'title' && cur.awardId !== v.award.id) $('s-title').classList.remove('active');
    show('s-title'); cur = { mode: 'title', awardId: v.award.id }; return;
  }
  if (v.mode === 'reveal') {
    const sameAward = cur.mode === 'reveal' && cur.awardId === v.award.id && cur.total === v.award.total;
    const isUndo = sameAward && v.winners.length < cur.shown;   // 撤销：静默回退
    if (!sameAward || isUndo) {
      $('rTitle').textContent = v.award.title; $('rSub').textContent = v.award.subtitle || '';
      buildGrid(v);
      cur = { mode: 'reveal', awardId: v.award.id, shown: 0, total: v.award.total };
    }
    const cards = $('grid').children;
    const from = cur.shown, to = v.winners.length;
    const animate = booted && !isUndo;                            // 首次打开 / 刷新页面时不放动画
    // 先一后全（award.cascade）：剩下的一张接一张出现，每张各带一点闪光；其他方式多张时只错开 0.14 秒
    const step = to - from > 1 ? v.award.cascade || 140 : 0, cascade = !!v.award.cascade && to - from > 1;
    for (let i = from; i < to; i++) {
      const delay = (i - from) * step;
      if (animate) setTimeout(() => { fillCard(cards[i], v.winners[i], true); if (cascade) burst(100); }, delay);
      else fillCard(cards[i], v.winners[i], false);
    }
    if (to > from && animate && !cascade) setTimeout(() => burst(to - from > 1 ? 260 : 180), 250);
    cur.shown = to;
    show('s-reveal');
    const ph = v.award.nominee ? v.award.phase || '' : '';
    if (ph !== cur.phase || !sameAward || isUndo) {
      const anim = animate && !isUndo;
      applyPhase(v, anim, anim && ph === 'winner' && cur.phase !== 'winner', anim && to > from ? (to - from - 1) * 140 + 450 : 0);
    }
    cur.phase = ph;
  }
}
