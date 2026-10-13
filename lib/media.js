/*
 * 照片和字体文件。
 * 照片：优先发送控制端压缩过的版本；带 ETag，大屏重绘 / 撤销时不必重新下载（每次仍会向服务端确认权限）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { PHOTO_DIR, CACHE_DIR, FONT_DIR } = require('./env');
const { SEC_HEADERS } = require('./http');
const { atomicWrite } = require('./util');
const rt = require('./runtime');

const PHOTO_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
const FONT_TYPES = { '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
// 文件头：TTF / OTF / WOFF / WOFF2 / true / TTC
const FONT_MAGIC = [[0x00, 0x01, 0x00, 0x00], [0x4f, 0x54, 0x54, 0x4f], [0x77, 0x4f, 0x46, 0x46], [0x77, 0x4f, 0x46, 0x32], [0x74, 0x72, 0x75, 0x65], [0x74, 0x74, 0x63, 0x66]];
const OPT_MAX_BYTES = 20 * 1024 * 1024;     // 压缩版照片上传上限
const FONT_MAX_BYTES = 40 * 1024 * 1024;    // 字体上传上限

// 文件名只能是单纯的文件名（不能带路径、不能以 . 开头），扩展名要对
const safeName = types => n => { const b = path.basename(String(n || '')); return b && b === String(n) && !b.startsWith('.') && types[path.extname(b).toLowerCase()] ? b : ''; };
const safePhotoName = safeName(PHOTO_TYPES);
const safeFontName = safeName(FONT_TYPES);
const isFont = buf => FONT_MAGIC.some(m => m.every((x, i) => buf[i] === x));
const isJpeg = buf => buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
const statOrNull = f => { try { return fs.statSync(f); } catch { return null; } };

/* ---- 照片 */
// 压缩版文件名带上原图的大小和修改时间：原图被替换后旧的压缩版自动失效
const cacheName = (name, st) => `${name}__${st.size}_${Math.floor(st.mtimeMs)}.jpg`;
function photoSource(name) {
  name = safePhotoName(name); if (!name) return null;
  const st = statOrNull(path.join(PHOTO_DIR, name)); if (!st) return null;
  const c = path.join(CACHE_DIR, cacheName(name, st)), cst = statOrNull(c);
  if (cst) return { file: c, type: 'image/jpeg', st: cst, orig: st, optimized: true };
  return { file: path.join(PHOTO_DIR, name), type: PHOTO_TYPES[path.extname(name).toLowerCase()], st, orig: st, optimized: false };
}
// 原图（控制端预览、压缩、图片导出用）
function originalPhoto(name) {
  name = safePhotoName(name); if (!name) return null;
  const st = statOrNull(path.join(PHOTO_DIR, name));
  return st && { file: path.join(PHOTO_DIR, name), type: PHOTO_TYPES[path.extname(name).toLowerCase()], st };
}
function savePhotoCache(name, buf) {
  const st = statOrNull(path.join(PHOTO_DIR, name));
  for (const f of fs.readdirSync(CACHE_DIR)) if (f.startsWith(name + '__')) fs.rmSync(path.join(CACHE_DIR, f), { force: true });   // 清掉旧版本
  atomicWrite(path.join(CACHE_DIR, cacheName(name, st)), buf);
  return st;
}
// 名单里用到的照片（控制端「照片优化」用）
function photoList() {
  const names = [...new Set(rt.data.awards.flatMap(a => a.winners.map(w => w.photo).filter(Boolean)))];
  return names.map(name => {
    const s = photoSource(name);
    return s ? { name, size: s.orig.size, optimized: s.optimized, sendSize: s.st.size } : { name, missing: true };
  });
}

/* ---- 字体 */
function fontSource(name) {
  name = safeFontName(name); if (!name) return null;
  const st = statOrNull(path.join(FONT_DIR, name));
  return st && { file: path.join(FONT_DIR, name), type: FONT_TYPES[path.extname(name).toLowerCase()], st };
}
const saveFont = (name, buf) => atomicWrite(path.join(FONT_DIR, name), buf);
const fontList = () => fs.readdirSync(FONT_DIR).filter(safeFontName).map(f => ({ name: f, size: fs.statSync(path.join(FONT_DIR, f)).size }));

// 发送文件（照片 / 字体），带 ETag
function sendCached(req, res, src) {
  const etag = `"${src.st.size.toString(36)}-${Math.floor(src.st.mtimeMs).toString(36)}"`;
  const h = { ...SEC_HEADERS, 'Cache-Control': 'private, no-cache', ETag: etag };
  delete h.Pragma;
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
  res.writeHead(200, { ...h, 'Content-Type': src.type, 'Content-Length': src.st.size });
  fs.createReadStream(src.file).on('error', () => res.destroy()).pipe(res);
}

module.exports = {
  OPT_MAX_BYTES, FONT_MAX_BYTES, safePhotoName, safeFontName, isFont, isJpeg,
  photoSource, originalPhoto, savePhotoCache, photoList, fontSource, fontList, saveFont, sendCached
};
