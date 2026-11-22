/*
 * 主题颜色（大屏、嘉宾页共用）：控制端「效果控制 → 主题颜色」选的颜色，换掉 CSS 里的金色系变量。
 * 做法（维护者定 2026-11-22，docs/template-plan.md 第 2 步）：不逐个配色，用「色相平移」——
 *   每个 CSS 变量属于一个色系（主色 / 亮色 / 暗色 / 背景），把它原本的颜色按「这个色系的基准色 → 选的颜色」同样转一下
 *   （色相相加、饱和度按比例、亮度按比例，0 和 100% 不动）。所以每个变量原本的明暗层次都保留。
 *   全部是默认值时什么都不设，CSS 里原本的颜色照用 = 和 1.62 完全一样。
 * 默认颜色在 CSS 里（display.css / guest.css 的 :root），第一次调用时读出来记住；这里只写变量属于哪个色系。
 * 特效（canvas、WebGL）用 thC(颜色字串) / thGl([r, g, b])：按 FXC.thMain 转「主色」色系；主色是默认金色时原样返回 = 画面不变。
 * 后台线程（fx/worker.js）也载入这个文件，所以最上层不能碰 document（只在 themeApply 里用）。
 * 提供：themeApply(fx)（fx = 效果设定，读 thMain / thHi / thLo / thBg）、thC(c)、thGl(v)、thFxKey()
 * 需要：无（themeApply 用 document；thC / thGl 读全局 FXC，没有就当默认）
 */
'use strict';

// 基准色 = lib/fx.js SCHEMA 里主题颜色的默认值（改一边要改另一边）
const TH_BASE = { main: '#d9b25f', hi: '#f7e2a6', lo: '#9a7330', bg: '#07060c' };
// CSS 变量 → 色系。名字以 -rgb 结尾的变量值是「r g b」（给 rgb(var(--x-rgb) / 透明度) 用），其余是 #rrggbb。
// bgHue = 背景色系但只转色相和饱和度、不改亮度（没有照片时的灰色幕布）
const TH_VARS = {
  '--gold': 'main', '--gold-rgb': 'main', '--gold-hi': 'hi', '--gold-hi-rgb': 'hi', '--gold-lo': 'lo',
  '--ink': 'main', '--muted': 'main', '--t-title1': 'main', '--t-title2': 'main', '--glow-rgb': 'main', '--info': 'main', '--note': 'main',
  '--sid': 'main', '--glint-rgb': 'main', '--red-rgb': 'main', '--cur-a1': 'main', '--cur-a2': 'main', '--nopic1': 'main', '--nopic2': 'main',
  '--badge-ink': 'main', '--btn1': 'main', '--btn2': 'main', '--btn3': 'main', '--btn-ink': 'main',
  '--bg': 'bg', '--bg1': 'bg', '--bg2': 'bg', '--shade-rgb': 'bg', '--card-bg': 'bg', '--note-bg': 'bg',
  '--cur-g1': 'bgHue', '--cur-g2': 'bgHue'
};
let thOrig = null, thLast = '';

const thHex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function thParse(v) {   // CSS 变量原值 → [r, g, b]；读不懂返回 null
  v = v.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return thHex(v);
  if (/^#[0-9a-f]{3}$/i.test(v)) return thHex('#' + [...v.slice(1)].map(c => c + c).join(''));
  const m = v.match(/^(\d+)\s+(\d+)\s+(\d+)$/); return m ? [+m[1], +m[2], +m[3]] : null;
}
function thHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function thRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map(v => Math.round(Math.min(1, Math.max(0, v + m)) * 255));
}
// 基准色 from → 选的颜色 to：返回一个把任何颜色同样转一下的函数（from 本身会刚好变成 to）
function thMap(from, to, keepL) {
  const [h0, s0, l0] = thHsl(thHex(from)), [h1, s1, l1] = thHsl(thHex(to));
  return rgb => {
    let [h, s, l] = thHsl(rgb);
    h = ((h + h1 - h0) % 360 + 360) % 360;
    s = Math.min(1, s0 ? s * s1 / s0 : s1);
    if (!keepL) l = l1 >= l0 ? l + (1 - l) * (l0 < 1 ? (l1 - l0) / (1 - l0) : 0) : l * (l0 ? l1 / l0 : 0);
    return thRgb([h, s, l]);
  };
}

/* ---- 特效用（2.2）：只跟「主色」 ---- */
let thCKey = '', thCFn = null;
const thCCache = new Map();
// 现在的主色；默认金色时返回 ''（= 不用转）。特效用它判断要不要重画预先画好的光点（key 变了才重画）
function thFxKey() {
  const m = (typeof FXC !== 'undefined' && FXC && FXC.thMain) || TH_BASE.main;
  return m === TH_BASE.main ? '' : m;
}
function thFxFn() {
  const k = thFxKey(); if (!k) return null;
  if (k !== thCKey) { thCKey = k; thCFn = thMap(TH_BASE.main, k); thCCache.clear(); }
  return thCFn;
}
// 'rgba(255,215,60,.26)' / 'rgb(…)' / '#rrggbb' → 转过的同格式字串（透明度不变）；读不懂的原样返回
function thC(c) {
  const f = thFxFn(); if (!f) return c;
  let o = thCCache.get(c); if (o !== undefined) return o;
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,[^)]*)?\)$/);
  if (m) { const [r, g, b] = f([+m[1], +m[2], +m[3]]); o = m[4] ? `rgba(${r},${g},${b}${m[4]})` : `rgb(${r},${g},${b})`; }
  else if (/^#[0-9a-f]{6}$/i.test(c)) o = '#' + f(thHex(c)).map(v => v.toString(16).padStart(2, '0')).join('');
  else o = c;
  if (thCCache.size > 20000) thCCache.clear();   // 光河的光丝颜色是连续的，避免越存越多
  thCCache.set(c, o); return o;
}
// WebGL：[r, g, b]（0 ~ 1）→ 转过的 [r, g, b]；默认原样返回同一个数组（数值完全不变）
function thGl(v) {
  const f = thFxFn(); if (!f) return v;
  return f(v.map(x => Math.round(x * 255))).map(x => x / 255);
}

function themeApply(fx) {
  const t = { main: fx?.thMain || TH_BASE.main, hi: fx?.thHi || null, lo: fx?.thLo || null, bg: fx?.thBg || TH_BASE.bg };
  const key = JSON.stringify(t); if (key === thLast) return; thLast = key;
  const rs = document.documentElement.style;
  if (!thOrig) {   // 第一次：读 CSS 里的原值（之后 rs 上设的会盖过去，所以只读一次）
    thOrig = {}; const cs = getComputedStyle(document.documentElement);
    for (const k of Object.keys(TH_VARS)) { const c = thParse(cs.getPropertyValue(k)); if (c) thOrig[k] = c; }
  }
  const isDef = t.main === TH_BASE.main && !t.hi && !t.lo && t.bg === TH_BASE.bg;
  const mMain = thMap(TH_BASE.main, t.main);
  const fam = {
    main: mMain,
    hi: t.hi ? thMap(TH_BASE.hi, t.hi) : mMain,
    lo: t.lo ? thMap(TH_BASE.lo, t.lo) : mMain,
    bg: thMap(TH_BASE.bg, t.bg),
    bgHue: thMap(TH_BASE.bg, t.bg, true)
  };
  for (const [k, c] of Object.entries(thOrig)) {
    if (isDef) { rs.removeProperty(k); continue; }   // 默认：用回 CSS 原值（不是算出来的近似值）
    const [r, g, b] = fam[TH_VARS[k]](c);
    rs.setProperty(k, k.endsWith('-rgb') ? `${r} ${g} ${b}` : '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''));
  }
}
