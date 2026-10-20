/* 输出页（大屏）：页面、实时推送、字体、已揭晓的照片。都要输出页密钥 k。 */
'use strict';
const { safeEqual, str, audit } = require('../util');
const { sendPage, sendText, SEC_HEADERS } = require('../http');
const { sseOpen } = require('../sse');
const { getSession } = require('../sessions');
const { fontSource, photoSource, logoSource, sendCached } = require('../media');
const show = require('../show');
const rt = require('../runtime');

module.exports = async function display({ req, res, ip, url, p, method }) {
  if (method !== 'GET') return false;
  const CFG = rt.cfg, k = url.searchParams.get('k');
  const isDisplayKey = safeEqual(k, CFG.displayKey), isGuestKey = safeEqual(k, CFG.guestKey);

  if (p === '/display') {
    if (!isDisplayKey) { audit('BAD-DISPLAY-KEY', ip); sendText(res, 403, 'Forbidden'); return true; }
    // 默认先给外壳（display-shell.html，定期在后台换新画面，释放显卡内存）；外壳里的画面 / 预览 / 导出影片 / renew=0 直接给画面
    const q = url.searchParams, direct = ['inner', 'preview', 'record'].some(x => q.get(x) === '1') || q.get('renew') === '0';
    // 服务器渲染（本机的 record=1 页面）：每帧画面要 POST 到本机 ffmpeg 专属端口（lib/render.js），CSP 放行 127.0.0.1 的其它端口
    const rec = q.get('record') === '1' && ip === '127.0.0.1';
    sendPage(res, direct ? 'display.html' : 'display-shell.html', rec ? { 'Content-Security-Policy': SEC_HEADERS['Content-Security-Policy'].replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:*") } : undefined); return true;
  }
  if (p === '/api/display/stream') {
    if (!isDisplayKey) { sendText(res, 403, 'Forbidden'); return true; }
    const preview = url.searchParams.get('preview') === '1' && getSession(req, ip);   // 控制端里的预览不算「输出页」
    sseOpen(req, res, preview ? 'preview' : 'display', ip, null, str(url.searchParams.get('name'), 30));
    return true;
  }
  if (p === '/media/font') {   // 字体不是机密，但仍要求输出页 / 嘉宾密钥或已登录
    if (!getSession(req, ip) && !isDisplayKey && !isGuestKey) { sendText(res, 403, 'Forbidden'); return true; }
    const src = fontSource(url.searchParams.get('f'));
    if (!src) sendText(res, 404, 'Not found'); else sendCached(req, res, src);
    return true;
  }
  if (p === '/media/logo') {   // 学校 Logo：同字体，不是机密
    if (!getSession(req, ip) && !isDisplayKey && !isGuestKey) { sendText(res, 403, 'Forbidden'); return true; }
    const src = logoSource();
    if (!src) sendText(res, 404, 'Not found'); else sendCached(req, res, src);
    return true;
  }
  if (p === '/media/photo') {
    const a = show.findAward(url.searchParams.get('a'));
    const i = Number(url.searchParams.get('i'));
    const w = a && Number.isInteger(i) ? a.winners[i] : null;
    if (!w || !w.photo) { sendText(res, 404, 'Not found'); return true; }
    // ⚠ 防泄露：输出页 / 嘉宾只能拿到「已揭晓」的照片；控制端（已登录）可预览全部
    const state = rt.state, revealedNow = state.mode === 'reveal' && state.awardId === a.id && i < state.revealed;
    if (!getSession(req, ip) && !((isDisplayKey || isGuestKey) && revealedNow)) { sendText(res, 403, 'Forbidden'); return true; }
    const src = photoSource(w.photo);
    if (!src) sendText(res, 404, 'Not found'); else sendCached(req, res, src);
    return true;
  }
  return false;
};
