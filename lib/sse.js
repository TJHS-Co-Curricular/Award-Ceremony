/* 实时推送（Server-Sent Events）：控制端、大屏、嘉宾手机都靠它同步 */
'use strict';
const { audit } = require('./util');
const rt = require('./runtime');
const { publicView, controlView } = require('./views');
const { guestActive } = require('./guest');
const { SEC_HEADERS } = require('./http');

function sseOpen(req, res, kind, ip, token, label) {
  res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 2000\n\n');
  const c = { res, kind, ip, token, label };
  rt.clients.add(c);
  const watched = kind === 'display' || kind === 'guest';   // 这两种连接 / 断开要通知控制端
  if (watched) audit(kind === 'guest' ? 'GUEST+' : 'DISPLAY+', ip);
  req.on('close', () => {
    rt.clients.delete(c);
    if (watched) { audit(kind === 'guest' ? 'GUEST-' : 'DISPLAY-', ip); broadcastControl(); }
  });
  send(c);
  if (watched) broadcastControl();
}
// memo：同一次广播里，同一类客户端只生成一次 JSON（控制端视图含全部名单，可能很大）
function send(c, memo = {}) {
  const s = c.kind === 'control' && rt.sessions.get(c.token);
  if (c.kind === 'control' && (!s || s.exp < Date.now())) { rt.clients.delete(c); c.res.end(); return; }   // 登录过期
  const key = c.kind === 'control' ? 'control' : c.kind === 'guest' ? 'guest' : 'public';
  if (!memo[key]) {
    const payload = key === 'control' ? controlView() : publicView();
    if (key === 'guest') payload.canPress = guestActive();
    memo[key] = `data: ${JSON.stringify(payload)}\n\n`;
  }
  c.res.write(memo[key]);
}
function broadcast() { const memo = {}; for (const c of [...rt.clients]) send(c, memo); }
function broadcastControl() { const memo = {}; for (const c of [...rt.clients]) if (c.kind === 'control') send(c, memo); }
// 断开某一类 / 某个会话的连接（更换嘉宾链接、退出登录时）
function dropClients(match) { for (const c of [...rt.clients]) if (match(c)) { rt.clients.delete(c); c.res.end(); } }

// 每 15 秒发一次心跳，防止中间设备断开空闲连接
setInterval(() => { for (const c of rt.clients) c.res.write(': ping\n\n'); }, 15000).unref();

module.exports = { sseOpen, broadcast, broadcastControl, dropClients };
