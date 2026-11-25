/*
 * 控制端 · 画图工具箱（1.94 从 export.js 搬出来，画面不变）：图片导出、电子书、海报、会前检查共用。
 *   字体：HTML_FONT（css/fonts.css 的默认字体）、EX_TITLE / EX_TEXT（跟大屏的中文 + 英文字体）、exBaseFonts()
 *   写字：exFont、exText（太宽自动缩字）、exWrap（换行）
 *   图片：exLoad（照片，有缓存）、exCover（裁切铺满）、exLoadLogo（学校 Logo）
 *   素材：exLoadMats、exMats、exMatKey、exMatFind（奖项名 → 素材图片，容许打错一点点）、exMatImg、exMatFit
 * 名字保留 ex 开头（原本在图片导出里，电子书 / 海报已经用了上百处），只是搬了位置。
 * 跟「卡片设计」有关的（EXS、exRender、exLogo、exSparkle）留在 export.js。
 * 需要：core.js（api、loadImg、V）、fonts.js（fontPrefix）
 */
'use strict';

// 默认字体 = css/fonts.css 的 --font-serif / --font-sans（和大屏同一份，不用手动同步）
const fontCss = getComputedStyle(document.documentElement);
const HTML_FONT = { serif: fontCss.getPropertyValue('--font-serif').trim(), sans: fontCss.getPropertyValue('--font-sans').trim() };
// 和大屏同一套规则：中文字体 + 英文 / 数字字体套用到所有文字；没设时，奖项名用宋体（serif），其它用黑体（sans）
let EX_TITLE = HTML_FONT.serif, EX_TEXT = HTML_FONT.sans;
async function exBaseFonts() {   // 跟大屏一样：中文字体 + 英文 / 数字字体，没设就用默认
  const pre = await fontPrefix();
  EX_TITLE = pre ? `${pre}, ${HTML_FONT.serif}` : HTML_FONT.serif;
  EX_TEXT = pre ? `${pre}, ${HTML_FONT.sans}` : HTML_FONT.sans;
}

const exImgCache = new Map();
function exLoad(name) {
  if (!name) return Promise.resolve(null);
  if (!exImgCache.has(name)) exImgCache.set(name, loadImg('/api/control/photo?name=' + encodeURIComponent(name)).catch(() => null));
  return exImgCache.get(name);
}
/* 素材图片：data/material/（或 mterial/）里的图片，文件名 = 奖项英文名（或中文名）。
 * 比对：只看字母、数字、汉字，不分大小写，结尾的 S 不算（AWARD = AWARDS）；英文写成「Gold」也认得「GOLD AWARD」；
 * 文件名打错一两个字母（长名字）或一个字（中文名）也认得，但要只有一个最接近的才算。 */
let exMats = [];   // [{ name, v, key }]
const exMatKey = t => String(t || '').replace(/\.(png|jpe?g|webp|gif)$/i, '').replace(/^\s*(?:19|20)\d{2}\s*(?:年(?!度))?\s*/, '').toUpperCase()   // 开头的年份不算（「2026 学生服务…」也认得没写年份的素材）
  .replace(/[^0-9A-Z\u3400-\u9fff]/g, '').replace(/S$/, '');
async function exLoadMats() {
  try { exMats = (await api('GET', '/api/control/materials')).list.map(m => ({ ...m, key: exMatKey(m.name) })); } catch { exMats = []; }
}
function exLev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let p = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    const c = [i];
    for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[b.length];
}
// 中文 + 英文 → 素材（找不到返回 null）。以英文为准：英文（完全一样 → 打错一点点）都找不到，才用中文
function exMatFind(zh, en) {
  const keys = [exMatKey(en), en ? exMatKey(en + ' AWARD') : '', exMatKey(zh)].filter(Boolean);
  for (const k of keys) {
    const m = exMats.find(x => x.key === k); if (m) return m;
    const lim = k.length >= 12 ? 2 : (k.length >= 4 && /[\u3400-\u9fff]/.test(k) ? 1 : 0); if (!lim) continue;
    const near = exMats.map(m => [m, exLev(k, m.key)]).filter(([, d]) => d <= lim).sort((a, b) => a[1] - b[1]);
    if (near.length && (near.length === 1 || near[0][1] < near[1][1])) return near[0][0];
  }
  return null;
}
const exMatCache = new Map();
function exMatImg(m) {
  if (!m) return Promise.resolve(null);
  const id = m.name + '|' + m.v;
  if (!exMatCache.has(id)) exMatCache.set(id, loadImg('/api/control/material?name=' + encodeURIComponent(m.name) + '&v=' + encodeURIComponent(m.v)).catch(() => null));
  return exMatCache.get(id);
}
// 素材按原比例缩进 宽 maxW × 高 maxH 的框
function exMatFit(img, maxW, maxH) { const r = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight); return { w: img.naturalWidth * r, h: img.naturalHeight * r }; }
// 学校 Logo（V.logo = 版本标记，换了 Logo 就重新读）
let exLogoImg = { ver: null, p: null };
function exLoadLogo() {
  const ver = V?.logo || '';
  if (exLogoImg.ver !== ver) exLogoImg = { ver, p: ver ? loadImg('/media/logo?v=' + encodeURIComponent(ver)).catch(() => null) : Promise.resolve(null) };
  return exLogoImg.p;
}

function exWrap(g, text, maxW) {   // 英文按单词换行；中文按字换行
  const parts = /\s/.test(text) ? text.split(/(\s+)/) : [...text], lines = [];
  let cur = '';
  for (const p of parts) { const t = cur + p; if (cur && g.measureText(t.trim()).width > maxW) { lines.push(cur.trim()); cur = p.trimStart(); } else cur = t; }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}
function exCover(g, img, x, y, w, h) {   // 照片居中裁切铺满
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k;
  g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
// 按设计画一行字：字号 / 粗体 / 斜体 / 字距 / 颜色；太宽就缩小。返回实际字号（像素）
function exFont(g, st, fam, px) {
  g.font = `${st.italic ? 'italic ' : ''}${st.bold ? 700 : 400} ${px}px ${fam}`;
  if ('letterSpacing' in g) g.letterSpacing = (st.spacing * px) + 'px';
}
function exText(g, text, st, fam, px, x, y, maxW) {
  let s = px;
  for (;;) { exFont(g, st, fam, s); if (g.measureText(text).width <= maxW || s < 8) break; s *= .94; }
  g.fillStyle = st.color;
  g.fillText(text, x + ('letterSpacing' in g ? st.spacing * s / 2 : 0), y);   // 字距会在最后一个字后面多出一段，居中时补回来
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  return s;
}
