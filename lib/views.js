/*
 * 视图（防泄露核心）。
 * publicView：发给大屏 / 嘉宾，只包含「已经在屏幕上」的信息。未揭晓的名字、照片、得主永远不会离开服务器。
 * controlView：发给已登录的控制端，含全部名单。
 */
'use strict';
const { VERSION, GALLERY_MAX } = require('./env');
const { getFx } = require('./fx');
const rt = require('./runtime');
const show = require('./show');
const { guest, guestActive } = require('./guest');
const { autoView } = require('./autoplay');
const { screens } = require('./config');
const { lanUrls } = require('./net');
const { logoVer } = require('./media');
const { buttonsView } = require('./buttons');

function publicView() {
  const state = rt.state;
  const v = { mode: state.mode, blackout: state.blackout, seq: state.seq, event: rt.data.event, guestArmed: guestActive(), fx: getFx(), ...(rt.diag ? { diag: true } : {}) };   // fx：效果设定（不含名单）
  const lv = logoVer(); if (lv) v.logo = '/media/logo?v=' + lv;   // 学校 Logo（不含名单）
  const a = state.awardId && show.findAward(state.awardId);
  const g = a && show.groupRun(a);
  if (state.mode === 'group' && g) {
    v.group = { title: g.title, sub: g.sub, noNum: g.noNum, awards: g.list.map(x => ({ title: x.title, subtitle: x.subtitle })) };   // 只有奖项名称，没有名单
  } else if (state.mode === 'group') v.mode = 'standby';
  if ((state.mode === 'title' || state.mode === 'reveal') && a) {
    v.award = { id: a.id, title: a.title, subtitle: a.subtitle, ...(a.revealMode === 'firstall' ? { cascade: getFx().all.cascadeMs } : {}) };   // cascade 只是动画节奏，不含名单
    if (g) Object.assign(v.award, { group: g.title, groupSub: g.sub, groupIndex: g.index, groupTotal: g.list.length, groupNoNum: g.noNum });
    if (state.mode === 'reveal') {
      v.award.total = a.winners.length;
      v.award.hasPhotos = a.winners.some(w => w.photo);
      v.award.hasTeams = a.winners.some(w => w.type === 'team');   // 只决定版式，不含名字
      if (show.isNominee(a)) {
        v.award.nominee = true;
        v.award.phase = state.revealed >= a.winners.length ? state.phase || '' : '';
        if (v.award.phase === 'winner') v.award.winnerIndex = show.winIndex(a);   // ⚠ 得主是谁，只在这一步之后才发出去
      }
      if (show.isFirstAll(a)) {   // 先一后全：大屏只显示「当前这一位」，或「全部出现」的这一页
        const n = a.winners.length, page = state.page || 0;
        v.award.view = state.phase === 'all'
          ? { mode: 'all', page, pages: show.galleryPages(a), from: page * GALLERY_MAX, to: Math.min(n, (page + 1) * GALLERY_MAX) }
          : { mode: 'solo', index: state.revealed - 1 };
        v.award.done = show.isComplete(a, state);
      }
      v.winners = a.winners.slice(0, state.revealed).map((w, i) => ({
        name: w.name, cls: w.cls, sid: w.sid, detail: w.detail, type: w.type, photo: w.photo ? `/media/photo?a=${encodeURIComponent(a.id)}&i=${i}` : null
      }));
    }
  } else if (state.mode === 'title' || state.mode === 'reveal') {
    v.mode = 'standby';
  }
  if (state.mode === 'photo') {   // 合影画面：只有分类和奖项名称
    if (a) v.photo = { title: a.title, subtitle: a.subtitle, group: a.group || '', groupSub: g ? g.sub : '' };
    else v.mode = 'standby';
  }
  if (state.mode === 'message') v.message = state.message;
  return v;
}

function controlView() {
  const clients = [...rt.clients];
  return {
    version: VERSION,
    event: rt.data.event, awards: rt.data.awards, state: rt.state,
    next: show.planNext(rt.state).desc,
    canUndo: rt.history.length > 0,
    displays: clients.filter(c => c.kind === 'display').map(c => (c.label ? `${c.label}（${c.ip}）` : c.ip)),
    screens: screens(),
    guests: clients.filter(c => c.kind === 'guest').map(c => c.ip),
    buttons: buttonsView(),   // 实体按钮：信号、延迟（不含名单）
    guest: { armed: guest.armed, awardId: guest.awardId },
    auto: autoView(),
    encrypted: !!rt.passphrase,
    diag: rt.diag,
    displayKey: rt.cfg.displayKey,
    logo: logoVer(),   // 学校 Logo 的版本标记（没有 = ''），图片导出用
    urls: lanUrls()
  };
}

module.exports = { publicView, controlView };
