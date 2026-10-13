/*
 * 路由总入口：先做 IP 白名单检查，再依次交给各页面的路由。
 * 每个路由函数处理了就返回 true；都不处理就 404（不暴露任何信息）。
 */
'use strict';
const { audit } = require('../util');
const { normIp, inAny } = require('../net');
const { sendText, sendJson, SEC_HEADERS } = require('../http');
const rt = require('../runtime');

const ROUTES = [require('./assets'), require('./display'), require('./guest'), require('./control')];

async function handle(req, res) {
  const CFG = rt.cfg;
  const ip = normIp(req.socket.remoteAddress);
  if (!inAny(ip, CFG.allowedNetworks)) { audit('BLOCKED', ip, req.method, req.url.split('?')[0]); return sendText(res, 403, 'Forbidden'); }
  const url = new URL(req.url, 'http://local');
  const p = url.pathname;
  const controlIpOk = !CFG.controlAllowedIps?.length || inAny(ip, CFG.controlAllowedIps);
  const isControlPath = p === '/control' || p.startsWith('/api/control') || p === '/api/login' || p === '/api/logout';
  if (isControlPath && !controlIpOk) { audit('BLOCKED-CONTROL', ip, p); return sendText(res, 403, 'Forbidden'); }

  const ctx = { req, res, ip, url, p, method: req.method };
  for (const route of ROUTES) if (await route(ctx)) return;
  if (p === '/favicon.ico') { res.writeHead(204, SEC_HEADERS); return res.end(); }
  return sendText(res, 404, 'Not found');
}

// 包一层：路由里抛出的错误统一回 500
const handler = (req, res) => handle(req, res).catch(e => { console.error(e); if (!res.headersSent) sendJson(res, 500, { error: e.message || '服务器错误' }); });

module.exports = { handler };
