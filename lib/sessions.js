/* 控制端登录：会话 cookie、密码错误次数限制 */
'use strict';
const { hex } = require('./util');
const rt = require('./runtime');

const fails = new Map();    // ip → { n, until }
const MAX_FAILS = 5, LOCK_MS = 5 * 60 * 1000;

function parseCookies(h) {
  const o = {};
  for (const part of (h || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) o[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return o;
}
// 会话要同时符合 cookie 和 IP（换了 IP 要重新登录）
function getSession(req, ip) {
  const t = parseCookies(req.headers.cookie).ac_sess;
  const s = t && rt.sessions.get(t);
  if (!s) return null;
  if (s.exp < Date.now() || s.ip !== ip) { rt.sessions.delete(t); return null; }
  return { token: t, ...s };
}
function createSession(ip) {
  const token = hex(24), hours = Number(rt.cfg.sessionHours) || 12;
  rt.sessions.set(token, { ip, exp: Date.now() + hours * 3600e3 });
  return `ac_sess=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${hours * 3600}`;
}
const CLEAR_COOKIE = 'ac_sess=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';

/* ---- 密码错误次数：连错 5 次锁 5 分钟 */
function lockedSeconds(ip) {
  const f = fails.get(ip);
  return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0;
}
// 返回还可以试几次（0 = 刚被锁）
function loginFailed(ip) {
  const f = fails.get(ip) || { n: 0, until: 0 };
  f.n += 1;
  const left = MAX_FAILS - f.n;
  if (f.n >= MAX_FAILS) { f.until = Date.now() + LOCK_MS; f.n = 0; }
  fails.set(ip, f);
  return Math.max(0, left);
}
const loginOk = ip => fails.delete(ip);

module.exports = { getSession, createSession, CLEAR_COOKIE, lockedSeconds, loginFailed, loginOk };
