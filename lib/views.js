/*
 * 视图（防泄露核心）。
 * publicView：发给大屏 / 嘉宾，只包含「已经在屏幕上」的信息。未揭晓的名字、照片、得主永远不会离开服务器。
 * controlView：发给已登录的控制端，含全部名单。
 */
'use strict';
// 学生证照片：文件名以 -ID 结尾（和网页 js/shared/idphoto.js 的 isIdPhoto 同一条规则）
const ID_PHOTO = /[-_ ]id\.[a-z0-9]+$/i;
// 备注图片：备注只写一个图片文件名（例：007-备注.jpg，放在照片文件夹）→ 备注框显示这张图（16:9，用户定 2026-11-18）
const NOTE_PIC = /^[^\n/\\]+\.(jpe?g|png|webp)$/i;
const notePic = w => !!w.detail && NOTE_PIC.test(w.detail.trim());
const { VERSION } = require('./env');
const { getFx } = require('./fx');
const rt = require('./runtime');
const show = require('./show');
const { guest, guestActive } = require('./guest');
const { autoView } = require('./autoplay');
const { screens } = require('./config');
const { lanUrls } = require('./net');
const { logoVer, photoSource } = require('./media');
// 照片版本（原图大小 + 修改时间）：换了照片，网址跟着变，大屏才会重画
const photoVer = name => { const s = photoSource(name); return s ? `${s.orig.size.toString(36)}-${Math.floor(s.orig.mtimeMs).toString(36)}` : '0'; };
const { buttonsView } = require('./buttons');
const { socOf } = require('./societies');
const { exPublic } = require('./exstyle');

function publicView() {
  const state = rt.state;
  const v = { mode: state.mode, blackout: state.blackout, seq: state.seq, event: rt.data.event, guestArmed: guestActive(), fx: getFx(), exStyle: exPublic(), ...(rt.diag ? { diag: true } : {}) };   // fx：效果设定（不含名单）
  const lv = logoVer(); if (lv) v.logo = '/media/logo?v=' + lv;   // 学校 Logo（不含名单）
  const a = state.awardId && show.findAward(state.awardId);
  const g = a && show.groupRun(a);
  const sc = a && show.sectionRun(a);
  if (state.mode === 'section' && sc) {
    v.section = { title: sc.title, sub: sc.sub, items: sc.noList ? [] : sc.items, noNum: sc.noNum };   // 只有分类 / 奖项名称，没有名单
  } else if (state.mode === 'section') v.mode = 'standby';
  if (state.mode === 'group' && g) {
    v.group = { title: g.title, sub: g.sub, noNum: g.noNum, section: a.section || '', awards: g.list.map(x => ({ title: x.title, subtitle: x.subtitle })) };   // 只有奖项名称，没有名单
  } else if (state.mode === 'group') v.mode = 'standby';
  if ((state.mode === 'title' || state.mode === 'reveal') && a) {
    v.award = { id: a.id, title: a.title, subtitle: a.subtitle, ...(a.revealMode === 'firstall' ? { cascade: getFx().all.cascadeMs } : {}) };   // cascade 只是动画节奏，不含名单
    if (a.section) Object.assign(v.award, { section: a.section, sectionSub: sc ? sc.sub : '' });
    if (g) Object.assign(v.award, { group: g.title, groupSub: g.sub, groupIndex: g.index, groupTotal: g.list.length, groupNoNum: g.noNum });
    if (state.mode === 'reveal') {
      v.award.total = a.winners.length;
      v.award.hasPhotos = a.winners.some(w => w.photo);
      v.award.hasTeams = a.winners.some(w => w.type === 'team');   // 只决定版式，不含名字
      v.award.hasIds = a.winners.some(w => ID_PHOTO.test(w.photo || ''));   // 有学生证照片：和团体一样「照片在上、名字在下」（用户定 2026-11-17）
      v.award.hasNotes = a.winners.length === 1 && !!a.winners[0].detail;
      if (v.award.hasNotes && notePic(a.winners[0])) v.award.notePic = true;   // 备注是图片：备注框改成 16:9 图框（只决定版式）   // 只有一位得奖者、又写了备注：照片右边加备注框（用户定 2026-11-17：人多的奖项不需要；只决定版式，不含内容）
      if (a.revealMode === 'one') v.award.grow = true;   // 逐一揭晓：大屏不预先放空卡，新的一位从中间出来、前面的往左右让开
      if (show.isNominee(a)) {
        v.award.nominee = true;
        v.award.phase = state.revealed >= a.winners.length ? state.phase || '' : '';
        if (v.award.phase === 'winner') v.award.winnerIndex = show.winIndex(a);   // ⚠ 得主是谁，只在这一步之后才发出去
      }
      if (show.isFirstAll(a)) {   // 先一后全：大屏只显示「当前这一位」，或「全部出现」的这一页
        const n = a.winners.length, page = state.page || 0, size = show.pageSize(a);
        v.award.view = state.phase === 'all'
          ? { mode: 'all', page, pages: show.galleryPages(a), from: page * size, to: Math.min(n, (page + 1) * size), ...(show.chunkOf(a) ? { chunk: true } : {}) }
          : { mode: 'solo', index: state.revealed - 1 };
        v.award.done = show.isComplete(a, state);
      }
      v.winners = a.winners.slice(0, state.revealed).map((w, i) => ({   // ⚠ 只有已揭晓的；学会只带查好的名字（socZh / socEn），不带对照表
        name: w.name, cls: w.cls, sid: w.sid, socZh: socOf(w)[0] || undefined, socEn: socOf(w)[1] || undefined, detail: notePic(w) ? undefined : w.detail, notePic: notePic(w) ? `/media/photo?a=${encodeURIComponent(a.id)}&i=${i}&n=1&v=${photoVer(w.detail.trim())}` : undefined, type: w.type, idCard: ID_PHOTO.test(w.photo || '') || undefined, photo: w.photo ? `/media/photo?a=${encodeURIComponent(a.id)}&i=${i}&v=${photoVer(w.photo)}` : null
      }));
    }
  } else if (state.mode === 'title' || state.mode === 'reveal') {
    v.mode = 'standby';
  }
  if (state.mode === 'photo') {   // 合影画面：只有分类和奖项名称
    if (a) v.photo = { title: a.title, subtitle: a.subtitle, group: a.group || '', groupSub: g ? g.sub : '', section: a.section || '' };
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
