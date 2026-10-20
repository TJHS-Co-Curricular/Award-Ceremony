/*
 * 嘉宾实体按钮（ESP32）的连线情况：信号强度、延迟、最后联系时间。
 * 按钮每 0.5 秒 GET /api/guest/button 问一次「现在能不能按」（routes/guest.js），顺便带上自己的信号和上一次的延迟。
 * 这里只记连线数据，不含名单；控制端经 SSE 的 "buttons" 事件每 2 秒收到一次（sse.js 推送；controlView 里也有一份）。
 * 不 require sse.js（sse → views → buttons 会绕圈）。
 */
'use strict';
const { audit } = require('./util');
const rt = require('./runtime');

const ONLINE_MS = 3000;          // 超过 3 秒没问 = 离线（正常每 0.5 秒问一次）
const FORGET_MS = 10 * 60000;    // 离线 10 分钟后从列表拿掉
const RTT_KEEP = 20;             // 平均 / 最大延迟看最近 20 次（约 10 秒）

let dirty = false;

const num = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };

// 返回 true = 刚上线（要马上通知控制端）
// q = URLSearchParams：id（AwardButton-XXXX）、rssi（dBm）、rtt（上一次的毫秒）、miss（开机以来失败几次）、up（开机几秒）、v（程序版本）
function buttonSeen(ip, q) {
  const id = String(q.get('id') || '').slice(0, 32).replace(/[^\w-]/g, '') || ip;
  let b = rt.buttons.get(id);
  if (!b) { b = { id, rtt: [] }; rt.buttons.set(id, b); }
  const was = b.online;
  Object.assign(b, { ip, seen: Date.now(), online: true, rssi: num(q.get('rssi'), -127, 0), miss: num(q.get('miss'), 0, 1e9), up: num(q.get('up'), 0, 1e9), ver: String(q.get('v') || '').slice(0, 16) });
  const rtt = num(q.get('rtt'), 0, 60000);
  if (rtt != null) { b.rtt.push(rtt); if (b.rtt.length > RTT_KEEP) b.rtt.shift(); }
  dirty = true;
  if (!was) audit('BUTTON+', ip, id);
  return !was;
}

function buttonsView() {
  const now = Date.now();
  return [...rt.buttons.values()].map(b => ({
    id: b.id, ip: b.ip, online: b.online, ago: Math.round((now - b.seen) / 1000),
    rssi: b.rssi, rtt: b.rtt.at(-1) ?? null,
    rttAvg: b.rtt.length ? Math.round(b.rtt.reduce((s, x) => s + x, 0) / b.rtt.length) : null,
    rttMax: b.rtt.length ? Math.max(...b.rtt) : null,
    miss: b.miss, up: b.up, ver: b.ver
  }));
}

// sse.js 每 2 秒调用：标出离线的、拿掉很久没出现的。返回 true = 要推给控制端
function buttonsTick() {
  const now = Date.now();
  for (const b of rt.buttons.values()) {
    if (b.online && now - b.seen > ONLINE_MS) { b.online = false; b.rtt = []; dirty = true; audit('BUTTON-', b.ip, b.id); }
    if (!b.online && now - b.seen > FORGET_MS) { rt.buttons.delete(b.id); dirty = true; }
  }
  const r = dirty || [...rt.buttons.values()].some(b => !b.online);   // 离线的也要推：「N 秒前」要往上加
  dirty = false;
  return r;
}

module.exports = { buttonSeen, buttonsView, buttonsTick };
