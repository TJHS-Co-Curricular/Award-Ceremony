/*
 * 大屏 · 渲染：按服务端推来的画面数据切换场景（待机 / 消息 / 分类标题 / 奖项标题 / 揭晓）。
 * 提供：render(view)、relayout()、show(sceneId)、renderPhoto(view)
 * 需要：stage.js、cards.js、nominee.js、firstall.js、fonts.js、fx/flash.js、fx/goldriver.js
 */
'use strict';

let cur = { mode: null, awardId: null, shown: 0, total: 0 };

let gStop = 0;
function show(id) {
  // 待机画面的金色光河：显示时运行，离开后等淡出完再停（省电）
  clearTimeout(gStop);
  const kind = lastV?.event?.standbyFx;   // 待机背景：旋涡星系（默认）或金色光河（fx/standby.js）
  if (id === 's-standby') standbyFx(true, kind); else gStop = setTimeout(() => standbyFx(false, kind), 1200);
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
  if (v.mode === 'photo' && v.photo) return renderPhoto(v);
  const gl = v.award?.group ? `${v.award.group}${v.award.groupTotal > 1 && !v.award.groupNoNum ? ' · 奖项 ' + String(v.award.groupIndex).padStart(2, '0') : ''}` : '';
  $('tGroup').textContent = gl; $('rGroup').textContent = gl;
  if (v.mode === 'title') {
    $('tTitle').textContent = v.award.title; $('tSub').textContent = v.award.subtitle || '';
    $('tSoon').textContent = v.guestArmed ? '有 请 嘉 宾 揭 晓' : '即 将 揭 晓';
    if (cur.mode === 'title' && cur.awardId !== v.award.id) $('s-title').classList.remove('active');
    show('s-title'); cur = { mode: 'title', awardId: v.award.id }; return;
  }
  if (v.mode === 'reveal' && v.award.view) return renderFirstAll(v);   // 先一后全（firstall.js）
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
    for (let i = from; i < to; i++) {   // 一次出现多张时错开 0.14 秒
      if (animate) setTimeout(() => fillCard(cards[i], v.winners[i], true), (i - from) * 140);
      else fillCard(cards[i], v.winners[i], false);
    }
    if (to > from && animate) setTimeout(() => burst(to - from > 1 ? 260 : 180), 250);
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

/* 合影画面：「分类 — 奖项名称」，一行放不下就分两行（分类小一点在上） */
const PHOTO_UP = .25, PHOTO_TOP = 110;   // 往上移多少（画面高度的比例）、顶端最少离上缘多少（舞台像素）
function renderPhoto(v) {
  const p = v.photo, kick = v.event?.photoKicker !== false, key = 'photo|' + p.group + '|' + p.title + '|' + kick + '|' + SW;
  if (cur.mode === 'photo' && cur.key === key) { show('s-photo'); return; }
  if (cur.mode === 'photo') $('s-photo').classList.remove('active');   // 换了奖项：重新进场
  const sc = $('s-photo'), h = $('pTitle');
  $('pGroup').textContent = p.group; $('pAward').textContent = p.title;
  $('pGroup').style.display = p.group ? '' : 'none'; $('pSep').classList.toggle('hide', !p.group);
  $('pSub').textContent = [p.groupSub, p.subtitle].filter(Boolean).join('  ·  ');
  sc.classList.remove('wrap'); sc.classList.toggle('nokick', !kick); h.style.fontSize = '';
  show('s-photo'); cur = { mode: 'photo', key };
  requestAnimationFrame(() => {   // 量一下：一行放不下 → 两行；还放不下 → 缩字
    if (h.scrollHeight > parseFloat(getComputedStyle(h).lineHeight) * 1.5) sc.classList.add('wrap');
    for (const s of [$('pGroup'), $('pAward')]) { s.style.fontSize = ''; let k = 1, guard = 30; while (s.scrollWidth > h.clientWidth + 1 && guard--) { k *= .93; s.style.fontSize = k + 'em'; } }
    // 往上移 25% 画面高度，但顶端至少离画面上缘 PHOTO_TOP（不压到边框）
    const box = sc.querySelector('.pbox'), shift = Math.max(0, Math.min(SH * PHOTO_UP, box.offsetTop - PHOTO_TOP));
    box.style.transform = `translateY(${-shift}px)`;
  });
}

