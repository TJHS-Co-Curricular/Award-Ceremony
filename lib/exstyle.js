/* 图片导出的设计（data/export-style.json）里，大屏名字卡要用的部分：姓名 / 班级 / 学号 / 学会 的字号、颜色、粗体、斜体、字距、字体，
 * 以及阴影、左边加暗 / 金色闪光、文字位置。经 publicView().exStyle 发给大屏（只有排版设定，没有名字），让大屏和导出图片长得一样。
 * 默认值和检查范围照控制端 js/control/export.js 的 EX_PRESET() / exClean()，改那边要一起改这里。 */
'use strict';
const fs = require('fs');
const { EXSTYLE_PATH } = require('./env');

const el0 = (size, color, bold, spacing = 0) => ({ show: true, size, color, bold, italic: false, spacing, font: '' });
const DEF = {
  elems: { name: el0(40, '#fafa98', true), cls: el0(40, '#fafa98', true), sid: el0(40, '#fafa98', true), soc: el0(40, '#fafa98', true, .14), socEn: el0(25.6, '#fafa98', true) },
  shade: 50, shadow: 60, textX: 25, nameY: 36.7, sparkle: true
};
const num = (x, lo, hi, def) => (x !== '' && x != null && Number.isFinite(+x) ? Math.min(hi, Math.max(lo, +x)) : def);
const col = (x, def) => (/^#[0-9a-f]{6}$/i.test(x) ? x : def);

let cache = null, cacheKey = null;
function exPublic() {   // 按文件大小 + 修改时间缓存（大屏每次推送都会带）
  let key = '';
  try { const st = fs.statSync(EXSTYLE_PATH); key = st.size + '-' + st.mtimeMs; } catch { /* 还没存过：用默认 */ }
  if (key === cacheKey) return cache;
  let v = {}; try { v = JSON.parse(fs.readFileSync(EXSTYLE_PATH, 'utf8')); } catch { /* 用默认 */ }
  const elems = {};
  for (const [k, b] of Object.entries(DEF.elems)) {
    const a = (v?.elems || {})[k] || {};
    elems[k] = { show: a.show !== false, size: num(a.size, 4, 150, b.size), color: col(a.color, b.color), bold: a.bold == null ? b.bold : !!a.bold,
      italic: !!a.italic, spacing: num(a.spacing, -.2, 2, b.spacing), font: String(a.font || '').slice(0, 120) };
  }
  cache = { elems, sparkle: v?.sparkle !== false, shade: num(v?.shade, 0, 100, DEF.shade), shadow: num(v?.shadow, 0, 100, DEF.shadow),
    textX: num(v?.textX, 15, 50, DEF.textX), nameY: num(v?.nameY, 15, 70, DEF.nameY) };
  cacheKey = key;
  return cache;
}

module.exports = { exPublic };
