/* 嘉宾揭晓页：页面、实时推送、按住揭晓。都要嘉宾密钥 k。 */
'use strict';
const { safeEqual, audit } = require('../util');
const { sendPage, sendText, sendJson, csrfOk } = require('../http');
const { sseOpen } = require('../sse');
const { guestActive, guestPressOk } = require('../guest');
const show = require('../show');
const rt = require('../runtime');

module.exports = async function guest({ req, res, ip, url, p, method }) {
  if (p !== '/guest' && !p.startsWith('/api/guest/')) return false;
  if (!safeEqual(url.searchParams.get('k'), rt.cfg.guestKey)) { audit('BAD-GUEST-KEY', ip); sendText(res, 403, 'Forbidden'); return true; }
  if (method === 'GET' && p === '/guest') { sendPage(res, 'guest.html'); return true; }
  if (method === 'GET' && p === '/api/guest/stream') { sseOpen(req, res, 'guest', ip); return true; }
  if (method === 'POST' && p === '/api/guest/reveal') {
    if (!csrfOk(req)) { sendJson(res, 403, { error: '请求被拒绝' }); return true; }
    if (!guestActive()) { sendJson(res, 409, { error: '尚未获得主持人授权' }); return true; }
    if (!guestPressOk()) { sendJson(res, 429, { error: '请稍候' }); return true; }
    const next = show.planNext(rt.state);
    show.commit(next.st, `[嘉宾 ${ip}]`, '嘉宾揭晓：' + next.desc);
    sendJson(res, 200, { ok: true }); return true;
  }
  sendText(res, 404, 'Not found'); return true;
};
