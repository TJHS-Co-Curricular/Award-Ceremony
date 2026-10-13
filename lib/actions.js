/* 控制端的操作（下一步、撤销、黑屏、自动播放、嘉宾授权……） */
'use strict';
const { hex, str, audit } = require('./util');
const rt = require('./runtime');
const show = require('./show');
const { saveConfig } = require('./config');
const auto = require('./autoplay');
const { guest, armGuest, disarmGuest } = require('./guest');
const { broadcast, dropClients } = require('./sse');

// 每次现场状态改变后：嘉宾授权是否到期 → 重排自动播放 → 推送给所有画面
function afterChange() {
  const cur = show.currentAward();
  if (guest.armed && (rt.state.awardId !== guest.awardId || !cur || show.isComplete(cur, rt.state))) disarmGuest('本奖项已揭晓完毕');
  auto.scheduleAuto();
  broadcast();
}
rt.hooks.afterChange = afterChange;

// 这些操作不会打断自动播放
const KEEP_AUTO = ['next', 'autoStart', 'autoStop', 'guestArm', 'guestDisarm', 'rotateGuestKey'];

function doAction(body, who) {
  const act = body?.action, state = rt.state, commit = show.commit;
  const a = body?.awardId ? show.findAward(body.awardId) : null;
  const base = { ...state, doneIds: [...state.doneIds] };
  if (!KEEP_AUTO.includes(act)) auto.stopAuto('手动操作');
  switch (act) {
    /* ---- 自动播放 */
    case 'autoStart': {
      const interval = Math.min(120, Math.max(1, Number(body.interval) || 3));
      const hold = Math.min(300, Math.max(1, Number(body.hold) || interval * 2));
      const scope = body.scope === 'show' ? 'show' : 'award';
      const cur = show.currentAward();
      if (scope === 'award' && (!cur || show.isComplete(cur, state))) throw new Error('「仅当前奖项」需要先公布一个还没揭晓完的奖项');
      disarmGuest('改为自动播放');
      auto.startAuto({ interval, hold, scope }, who);
      broadcast();
      return;
    }
    case 'autoStop': auto.stopAuto(who + ' 暂停'); broadcast(); return;

    /* ---- 嘉宾揭晓 */
    case 'guestArm': {
      const cur = show.currentAward();
      if (!cur || show.isComplete(cur, state)) throw new Error('请先公布一个还没揭晓完的奖项，再交给嘉宾');
      auto.stopAuto('交给嘉宾');
      armGuest(cur, who);
      broadcast();
      return;
    }
    case 'guestDisarm': disarmGuest(who + ' 收回'); broadcast(); return;
    case 'rotateGuestKey': {
      rt.cfg.guestKey = hex(8);
      saveConfig();
      disarmGuest('更换嘉宾链接');
      dropClients(c => c.kind === 'guest');   // 旧链接的嘉宾手机立即断开
      audit('GUEST-KEY-ROTATED', who);
      broadcast();
      return;
    }

    /* ---- 现场画面 */
    case 'next': { const p = show.planNext(state); return commit(p.st, who, '下一步：' + p.desc); }
    case 'undo': return show.undo(who);
    case 'standby': return commit({ ...base, mode: 'standby', awardId: null, revealed: 0, blackout: false }, who, '待机画面');
    case 'blackout': return commit({ ...base, blackout: !state.blackout }, who, state.blackout ? '取消黑屏' : '黑屏');
    case 'message': {
      const text = str(body.text, 300);
      if (!text) throw new Error('消息不能为空');
      return commit({ ...base, mode: 'message', message: text, blackout: false }, who, '显示消息：' + text);
    }
    case 'group': {
      const g = show.groupRun(a);
      if (!g) throw new Error('这个奖项没有分类');
      return commit({ ...base, mode: 'group', awardId: a.id, revealed: 0, blackout: false }, who, `分类标题「${g.title}」`);
    }
    case 'title':
      if (!a) throw new Error('找不到奖项');
      return commit({ ...base, mode: 'title', awardId: a.id, revealed: 0, blackout: false }, who, `公布奖项「${a.title}」`);
    case 'revealAll': {
      const t = a || show.findAward(state.awardId);
      if (!t) throw new Error('当前没有奖项');
      const st = { ...base, mode: 'reveal', awardId: t.id, revealed: t.winners.length, phase: show.isNominee(t) ? 'winner' : '', blackout: false };
      show.markDoneIfComplete(st);
      return commit(st, who, `全部揭晓「${t.title}」`);
    }

    /* ---- 进度 */
    case 'markPending':
      if (!a) throw new Error('找不到奖项');
      return commit({ ...base, doneIds: base.doneIds.filter(id => id !== a.id) }, who, `标记为未公布「${a.title}」`);
    case 'resetProgress':
      return commit({ mode: 'standby', awardId: null, revealed: 0, doneIds: [], blackout: false, message: '', seq: state.seq }, who, '重置全部进度');
    default: throw new Error(`未知操作「${act}」——控制端和服务端版本不一致，请关闭并重新启动 server.js 后刷新页面`);
  }
}

module.exports = { doAction, afterChange };
