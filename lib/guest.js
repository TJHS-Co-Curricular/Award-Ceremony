/* 嘉宾揭晓：主持人授权后，嘉宾手机可以揭晓当前奖项；揭晓完自动收回 */
'use strict';
const { audit } = require('./util');
const rt = require('./runtime');

const guest = { armed: false, awardId: null, lastPress: 0 };

function armGuest(award, who) {
  Object.assign(guest, { armed: true, awardId: award.id });
  audit('GUEST-ARM', who, `「${award.title}」`);
}
function disarmGuest(reason) {
  if (!guest.armed) return;
  guest.armed = false; guest.awardId = null;
  audit('GUEST-DISARM', reason || '');
}
const guestActive = () => guest.armed && rt.state.awardId === guest.awardId && !rt.state.blackout;
// 防连按：1 秒内只算一次
function guestPressOk() {
  if (Date.now() - guest.lastPress < 1000) return false;
  guest.lastPress = Date.now();
  return true;
}

module.exports = { guest, armGuest, disarmGuest, guestActive, guestPressOk };
