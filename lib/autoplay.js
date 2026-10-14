/* 自动播放：服务端计时，控制端关掉也照常运行 */
'use strict';
const { GALLERY_MAX } = require('./env');
const { getFx } = require('./fx');
const { audit } = require('./util');
const rt = require('./runtime');
const show = require('./show');

const auto = { on: false, scope: 'award', interval: 3, hold: 6, nextAt: 0 };   // scope：award = 仅当前奖项 / show = 整场
let timer = null;

function stopAuto(reason) {
  clearTimeout(timer); auto.nextAt = 0;
  if (!auto.on) return;
  auto.on = false;
  audit('AUTO-STOP', reason || '');
}
function startAuto({ interval, hold, scope }, who) {
  Object.assign(auto, { on: true, scope, interval, hold });
  audit('AUTO-START', who, `${scope === 'show' ? '整场' : '当前奖项'} 每 ${interval}s，奖项间停留 ${hold}s`);
  scheduleAuto();
}
// 每次状态改变后重新排下一步
function scheduleAuto() {
  clearTimeout(timer); auto.nextAt = 0;
  if (!auto.on) return;
  const state = rt.state, a = show.currentAward();
  const complete = show.isComplete(a, state);
  if (state.blackout) return stopAuto('黑屏');
  if (auto.scope === 'award' && (!a || complete)) return stopAuto('本奖项已播完');
  if (auto.scope === 'show' && !a && !show.nextPending(null, state.doneIds)) return stopAuto('全部奖项已播完');
  // 先一后全「全部出现」时，卡片一张接一张出来（每张约 0.6 秒），等待时间要加上这段动画
  const cascade = a && show.isFirstAll(a) && state.phase === 'all' ? Math.max(0, Math.min(GALLERY_MAX, a.winners.length - state.page * GALLERY_MAX) - 1) * getFx().all.cascadeMs / 1000 : 0;
  const sec = (complete ? auto.hold : auto.interval) + cascade;
  auto.nextAt = Date.now() + sec * 1000;
  timer = setTimeout(() => { const p = show.planNext(rt.state); show.commit(p.st, '[自动播放]', '下一步：' + p.desc); }, sec * 1000);
}
const autoView = () => ({ on: auto.on, scope: auto.scope, interval: auto.interval, hold: auto.hold, remainingMs: auto.nextAt ? Math.max(0, auto.nextAt - Date.now()) : 0 });

module.exports = { stopAuto, startAuto, scheduleAuto, autoView };
