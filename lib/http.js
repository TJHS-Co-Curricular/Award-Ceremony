/* HTTP 基础：安全标头、回应 JSON / 文字 / 文件 / 网页、读请求内容、防 CSRF */
'use strict';
const fs = require('fs');
const path = require('path');
const { IS_EXE, sea, PUBLIC_DIR } = require('./env');

const SEC_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"
};

function sendJson(res, code, obj, extra = {}) {
  res.writeHead(code, { ...SEC_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(obj));
}
function sendText(res, code, text) {
  res.writeHead(code, { ...SEC_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}
function sendFile(res, file, type) {
  fs.readFile(file, (err, buf) => {
    if (err) return sendText(res, 404, 'Not found');
    res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': type });
    res.end(buf);
  });
}

/* ---- 网页和静态资源（public/ 里的 html、css、js、图标）
 * 优先用 exe 旁边的 public/ 文件（方便自行修改），否则用打包在 exe 里的版本。 */
const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2'
};
// 只允许 css/ js/ img/ 下面、由字母数字和 - _ . 组成的路径（防目录穿越）
const safeAsset = rel => (/^(css|js|img)\/([\w-]+\/)*[\w-]+(\.[\w-]+)+$/.test(rel) && !rel.includes('..') && STATIC_TYPES[path.extname(rel)] ? rel : '');
function sendStatic(res, rel) {
  const type = STATIC_TYPES[path.extname(rel)];
  const local = path.join(PUBLIC_DIR, ...rel.split('/'));
  if (fs.existsSync(local) || !IS_EXE) return sendFile(res, local, type);
  try {
    const buf = Buffer.from(sea.getAsset(rel));
    res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': type });
    res.end(buf);
  } catch { sendText(res, 404, 'Not found'); }
}
const sendPage = (res, name) => sendStatic(res, name);

/* ---- 读请求内容（都有大小上限） */
function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', ch => { size += ch.length; if (size > limit) { reject(new Error('文件过大')); req.destroy(); } else chunks.push(ch); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function readBody(req, limit = 3 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', ch => { size += ch.length; if (size > limit) { reject(new Error('请求过大')); req.destroy(); } else chunks.push(ch); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Error('JSON 格式错误')); } });
    req.on('error', reject);
  });
}
// 防 CSRF：必须带自定义头，且 Origin（如有）必须与 Host 一致
function csrfOk(req) {
  if (req.headers['x-ac'] !== '1') return false;
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}

module.exports = { SEC_HEADERS, sendJson, sendText, sendFile, sendPage, sendStatic, safeAsset, readRaw, readBody, csrfOk };
