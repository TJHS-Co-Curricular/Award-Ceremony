/* 控制端：页面、登录 / 退出，以及所有 /api/control/* 接口（除登录外都要已登录 + 防 CSRF） */
'use strict';
const fs = require('fs');
const { EXSTYLE_PATH } = require('../env');
const { safeEqual, str, atomicWrite, audit } = require('../util');
const { sendPage, sendText, sendJson, readBody, readRaw, csrfOk, SEC_HEADERS } = require('../http');
const { getSession, createSession, CLEAR_COOKIE, lockedSeconds, loginFailed, loginOk } = require('../sessions');
const { sseOpen, dropClients } = require('../sse');
const { controlView } = require('../views');
const { obsSceneCollection } = require('../obs');
const { doAction, afterChange } = require('../actions');
const { normalizeData, saveData } = require('../data');
const media = require('../media');
const fx = require('../fx');
const { broadcast } = require('../sse');
const show = require('../show');
const rt = require('../runtime');

async function login({ req, res, ip }) {
  if (!csrfOk(req)) return sendJson(res, 403, { error: '请求被拒绝' });
  const wait = lockedSeconds(ip);
  if (wait) return sendJson(res, 429, { error: `尝试次数过多，请 ${wait} 秒后再试` });
  const body = await readBody(req, 4096);
  if (!safeEqual(body.password, rt.cfg.controlPassword)) {
    loginFailed(ip);
    audit('LOGIN-FAIL', ip);
    return sendJson(res, 401, { error: '密码错误' });
  }
  loginOk(ip);
  audit('LOGIN', ip);
  return sendJson(res, 200, { ok: true }, { 'Set-Cookie': createSession(ip) });
}

/* ---- 已登录的接口：key = 「方法 路径」 */
const API = {
  'POST /api/logout': ({ res, ip, s }) => {
    rt.sessions.delete(s.token);
    dropClients(c => c.token === s.token);
    audit('LOGOUT', ip);
    sendJson(res, 200, { ok: true }, { 'Set-Cookie': CLEAR_COOKIE });
  },
  'GET /api/control/state': ({ res }) => sendJson(res, 200, controlView()),
  'GET /api/control/stream': ({ req, res, ip, s }) => sseOpen(req, res, 'control', ip, s.token),

  // 现场操作
  'POST /api/control/action': async ({ req, res, who }) => {
    const body = await readBody(req, 16 * 1024);
    try { doAction(body, who); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    sendJson(res, 200, { ok: true });
  },
  // 保存名单
  'PUT /api/control/data': async ({ req, res, who }) => {
    const body = await readBody(req);
    rt.data = normalizeData(body);
    show.sanitizeState(); saveData(); show.saveState();
    audit('DATA-SAVED', who, `${rt.data.awards.length} 个奖项`);
    afterChange();
    sendJson(res, 200, { ok: true, data: rt.data });
  },

  // OBS 场景集合下载
  'GET /api/control/obs': ({ res, url, who }) => {
    const host = str(url.searchParams.get('host'), 64).replace(/[^\w.:-]/g, '') || '127.0.0.1';
    const fps = [25, 30, 50, 60].includes(Number(url.searchParams.get('fps'))) ? Number(url.searchParams.get('fps')) : 60;
    audit('OBS-EXPORT', who, host);
    res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="award-obs.json"; filename*=UTF-8''${encodeURIComponent('表扬大会-OBS场景.json')}` });
    res.end(JSON.stringify(obsSceneCollection(host, fps), null, 2));
  },

  // 照片：列表 → 控制端读原图 → 浏览器里缩小成 JPEG → 上传到 data/photos/_cache/
  'GET /api/control/photos': ({ res }) => sendJson(res, 200, { photos: media.photoList() }),
  'GET /api/control/photo': ({ req, res, url }) => {
    const src = media.originalPhoto(url.searchParams.get('name'));
    if (!src) return sendText(res, 404, 'Not found');
    media.sendCached(req, res, src);
  },
  'POST /api/control/photo-opt': async ({ req, res, url, who }) => {
    const src = media.originalPhoto(url.searchParams.get('name'));
    if (!src) return sendJson(res, 404, { error: '找不到原图' });
    const name = media.safePhotoName(url.searchParams.get('name'));
    const buf = await readRaw(req, media.OPT_MAX_BYTES);
    if (!media.isJpeg(buf)) return sendJson(res, 400, { error: '不是 JPEG' });
    const st = media.savePhotoCache(name, buf);
    audit('PHOTO-OPT', who, `${name} ${(st.size / 1048576).toFixed(1)}MB → ${(buf.length / 1048576).toFixed(1)}MB`);
    sendJson(res, 200, { ok: true, size: buf.length });
  },

  // 字体
  'GET /api/control/fonts': ({ res }) => sendJson(res, 200, { fonts: media.fontList() }),
  'POST /api/control/font': async ({ req, res, url, who }) => {
    const name = media.safeFontName(url.searchParams.get('name'));
    if (!name) return sendJson(res, 400, { error: '只支持 .ttf / .otf / .woff / .woff2' });
    const buf = await readRaw(req, media.FONT_MAX_BYTES);
    if (!media.isFont(buf)) return sendJson(res, 400, { error: '不是有效的字体文件' });
    media.saveFont(name, buf);
    audit('FONT-UPLOAD', who, `${name} ${(buf.length / 1048576).toFixed(1)}MB`);
    sendJson(res, 200, { ok: true });
  },

  // 效果控制：设定格式（给界面用）+ 目前的值；保存后立刻推送给所有输出页
  'GET /api/control/fx': ({ res }) => sendJson(res, 200, { schema: fx.SCHEMA, fx: fx.getFx() }),
  'PUT /api/control/fx': async ({ req, res, who }) => {
    const body = await readBody(req, 64 * 1024);
    const saved = fx.saveFx(body);
    audit('FX-SAVED', who);
    broadcast();
    sendJson(res, 200, { ok: true, fx: saved });
  },

  // 图片导出的设计：整份 JSON 存取（只有排版设定，没有名字）；控制端负责补默认值和检查数值
  'GET /api/control/export-style': ({ res }) => {
    let style = {}; try { style = JSON.parse(fs.readFileSync(EXSTYLE_PATH, 'utf8')); } catch { /* 还没存过 */ }
    sendJson(res, 200, { style });
  },
  'PUT /api/control/export-style': async ({ req, res }) => {
    const body = await readBody(req, 64 * 1024);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return sendJson(res, 400, { error: '格式错误' });
    atomicWrite(EXSTYLE_PATH, JSON.stringify(body, null, 2));
    sendJson(res, 200, { ok: true });
  }
};

module.exports = async function control(ctx) {
  const { req, res, ip, p, method } = ctx;
  if (method === 'GET' && p === '/control') { sendPage(res, 'control.html'); return true; }
  if (method === 'POST' && p === '/api/login') { await login(ctx); return true; }
  if (!p.startsWith('/api/control') && p !== '/api/logout') return false;

  const s = getSession(req, ip);
  if (!s) { sendJson(res, 401, { error: '未登录' }); return true; }
  if (method !== 'GET' && !csrfOk(req)) { sendJson(res, 403, { error: '请求被拒绝' }); return true; }
  const fn = API[`${method} ${p}`];
  if (!fn) { sendJson(res, 404, { error: 'Not found' }); return true; }
  await fn({ ...ctx, s, who: `[控制端 ${ip}]` });
  return true;
};
