/*
 * 效果设定（控制端「效果控制」分页）：主题颜色、大会背景、闪光、浮尘、先一后全节奏、合影画面位置……
 * 存在 data/fx.json，改了立刻推送给所有输出页（不用重新编译、不用刷新）。不含名单。
 * 结构：{ all: {...所有屏幕}, screens: { '主屏': {...只写要单独改的项目} } }，屏幕名称 = config.json 的 screens[].name。
 * SCHEMA 同时给控制端用来生成界面（标签、范围、分组）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./env');
const { str, atomicWrite } = require('./util');

const FX_PATH = path.join(DATA_DIR, 'fx.json');
// type：num（滑杆）/ bool（开关）/ enum（下拉）/ auto（滑杆 + 「自动」，null = 自动）/ color（#rrggbb；auto: true 时可以是 null = 自动）；global：只能全部屏幕一起设
// 主题颜色（维护者定 2026-11-22）：默认值 = public/js/shared/theme.js 的 TH_BASE（改一边要改另一边）
const SCHEMA = [
  { group: '主题颜色', key: 'thMain', label: '主色（金色）', type: 'color', def: '#d9b25f', global: true },
  { group: '主题颜色', key: 'thHi', label: '亮色（标题、高光）', type: 'color', auto: true, def: null, global: true },
  { group: '主题颜色', key: 'thLo', label: '暗色（渐层底部）', type: 'color', auto: true, def: null, global: true },
  { group: '主题颜色', key: 'thBg', label: '背景（深色）', type: 'color', def: '#07060c', global: true },
  { group: '大会背景', key: 'bgMode', type: 'enum', def: 'fx', options: [['fx', '深色渐层 + 边框（默认）'], ['image', '背景图片（下面上传，所有画面都用）'], ['clear', '透明（在 OBS 里垫一段影片）']] },
  { group: '背景浮尘（所有画面底层）', key: 'dustOn', label: '显示', type: 'bool', def: true },
  { group: '背景浮尘（所有画面底层）', key: 'dustAmount', label: '数量（倍）', type: 'num', min: .2, max: 4, step: .1, def: 1 },
  { group: '揭晓闪光', key: 'flashOn', label: '显示', type: 'bool', def: true },
  { group: '揭晓闪光', key: 'flashPeak', label: '亮度', type: 'num', min: .05, max: 1, step: .01, def: .42 },
  { group: '揭晓闪光', key: 'flashAmount', label: '数量（倍）', type: 'num', min: .2, max: 4, step: .1, def: 1 },
  { group: '先一后全', key: 'cascadeMs', label: '全部出现时每张间隔（毫秒）', type: 'num', min: 150, max: 2000, step: 50, def: 600, global: true },
  { group: '输出页', key: 'renewMin', label: '每隔几分钟换新（0 = 不按时间）', type: 'num', min: 0, max: 30, step: 1, def: 3 },
  { group: '输出页', key: 'renewReveals', label: '每揭晓几次换新（0 = 不按次数）', type: 'num', min: 0, max: 50, step: 1, def: 5 },
  { group: '照片右上角 Logo', key: 'logoOn', label: '显示', type: 'bool', def: true },
  { group: '照片右上角 Logo', key: 'logoSize', label: '大小（照片宽度的比例）', type: 'num', min: .04, max: .5, step: .01, def: .16 },
  { group: '照片右上角 Logo', key: 'logoMargin', label: '离边缘（照片宽度的比例）', type: 'num', min: 0, max: .1, step: .005, def: .025 },
  { group: '照片右上角 Logo', key: 'logoOpacity', label: '不透明度', type: 'num', min: .2, max: 1, step: .05, def: 1 },
  { group: '画面左上角 Logo', key: 'sLogoOn', label: '显示', type: 'bool', def: true },
  { group: '画面左上角 Logo', key: 'sLogoSize', label: '大小（画面高度的比例）', type: 'num', min: .04, max: .5, step: .01, def: .15 },
  { group: '画面左上角 Logo', key: 'sLogoMargin', label: '离边缘（画面高度的比例）', type: 'num', min: 0, max: .1, step: .005, def: .025 },
  { group: '画面左上角 Logo', key: 'sLogoOpacity', label: '不透明度', type: 'num', min: .2, max: 1, step: .05, def: 1 },
  { group: '合影画面', key: 'photoUp', label: '文字往上移（画面高度比例）', type: 'num', min: 0, max: .45, step: .01, def: .25 }
];
const BY_KEY = Object.fromEntries(SCHEMA.map(s => [s.key, s]));
const DEFAULTS = Object.fromEntries(SCHEMA.map(s => [s.key, s.def]));

// 检查一个值：范围外就夹在范围内，格式不对就丢掉（返回 undefined）
function cleanValue(s, v) {
  if (s.type === 'bool') return typeof v === 'boolean' ? v : undefined;
  if (s.type === 'enum') return s.options.some(o => o[0] === v) ? v : undefined;
  if (s.type === 'color') return v === null && s.auto ? null : typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : undefined;
  if (s.type === 'auto' && v === null) return null;
  const n = Number(v);
  if (v === '' || v == null || !Number.isFinite(n)) return undefined;
  return Math.min(s.max, Math.max(s.min, Math.round(Math.round(n / s.step) * s.step * 1e6) / 1e6));   // 对齐步长、去掉浮点尾数
}
function cleanPart(o, allowGlobal) {
  const out = {};
  for (const [k, v] of Object.entries(o && typeof o === 'object' ? o : {})) {
    const s = BY_KEY[k]; if (!s || (s.global && !allowGlobal)) continue;
    const c = cleanValue(s, v); if (c !== undefined) out[k] = c;
  }
  return out;
}
function normalize(d) {
  const screens = {};
  for (const [name, part] of Object.entries(d?.screens && typeof d.screens === 'object' ? d.screens : {}).slice(0, 20)) {
    const p = cleanPart(part, false); if (Object.keys(p).length) screens[str(name, 30)] = p;
  }
  return { all: { ...DEFAULTS, ...cleanPart(d?.all, true) }, screens };
}

let FX = normalize({});
// 旧版 fx.json 里星系 / 光河的设定（1.70 拿掉了）读进来时由 normalize() 丢掉
function loadFx() {
  try { FX = normalize(JSON.parse(fs.readFileSync(FX_PATH, 'utf8'))); } catch { FX = normalize({}); }
}
function saveFx(d) { FX = normalize(d); atomicWrite(FX_PATH, JSON.stringify(FX, null, 2)); return FX; }
const getFx = () => FX;

module.exports = { SCHEMA, loadFx, saveFx, getFx };
