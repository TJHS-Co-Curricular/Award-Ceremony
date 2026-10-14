/*
 * 效果设定（控制端「效果控制」分页）：待机背景、闪光、浮尘、先一后全节奏、合影画面位置……
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
// type：num（滑杆）/ bool（开关）/ enum（下拉）/ auto（滑杆 + 「自动」，null = 自动）；global：只能全部屏幕一起设
const SCHEMA = [
  { group: '待机画面背景', key: 'standby', type: 'enum', def: 'galaxy', options: [['galaxy', '旋涡星系（金色，会公转）'], ['goldriver', '金色光河（原本的设计）']] },
  { group: '旋涡星系', key: 'gyBright', label: '亮度', type: 'num', min: .1, max: 2, step: .05, def: .75 },
  { group: '旋涡星系', key: 'gySpeed', label: '公转速度', type: 'num', min: 0, max: .5, step: .01, def: .12 },
  { group: '旋涡星系', key: 'gyDensity', label: '粒子数量（倍）', type: 'num', min: .2, max: 2, step: .05, def: 1 },
  { group: '旋涡星系', key: 'gySize', label: '星系大小（倍）', type: 'num', min: .4, max: 1.8, step: .05, def: 1 },
  { group: '旋涡星系', key: 'gyX', label: '中心横向位置', type: 'auto', min: .05, max: .95, step: .01, def: null },
  { group: '旋涡星系', key: 'gyY', label: '中心纵向位置', type: 'auto', min: .2, max: 1, step: .01, def: null },
  { group: '旋涡星系', key: 'gyTilt', label: '倾斜（越小越扁）', type: 'num', min: .12, max: .9, step: .01, def: .36 },
  { group: '金色光河', key: 'grBright', label: '亮度', type: 'num', min: .2, max: 2, step: .05, def: 1 },
  { group: '金色光河', key: 'grDensity', label: '光点数量（倍）', type: 'num', min: .2, max: 2, step: .05, def: 1 },
  { group: '背景浮尘（所有画面底层）', key: 'dustOn', label: '显示', type: 'bool', def: true },
  { group: '背景浮尘（所有画面底层）', key: 'dustAmount', label: '数量（倍）', type: 'num', min: .2, max: 4, step: .1, def: 1 },
  { group: '揭晓闪光', key: 'flashOn', label: '显示', type: 'bool', def: true },
  { group: '揭晓闪光', key: 'flashPeak', label: '亮度', type: 'num', min: .05, max: 1, step: .01, def: .42 },
  { group: '揭晓闪光', key: 'flashAmount', label: '数量（倍）', type: 'num', min: .2, max: 4, step: .1, def: 1 },
  { group: '先一后全', key: 'cascadeMs', label: '全部出现时每张间隔（毫秒）', type: 'num', min: 150, max: 2000, step: 50, def: 600, global: true },
  { group: '输出页', key: 'renewMin', label: '自动换新（分钟，0 = 关）', type: 'num', min: 0, max: 30, step: 1, def: 3 },
  { group: '合影画面', key: 'photoUp', label: '文字往上移（画面高度比例）', type: 'num', min: 0, max: .45, step: .01, def: .25 }
];
const BY_KEY = Object.fromEntries(SCHEMA.map(s => [s.key, s]));
const DEFAULTS = Object.fromEntries(SCHEMA.map(s => [s.key, s.def]));

// 检查一个值：范围外就夹在范围内，格式不对就丢掉（返回 undefined）
function cleanValue(s, v) {
  if (s.type === 'bool') return typeof v === 'boolean' ? v : undefined;
  if (s.type === 'enum') return s.options.some(o => o[0] === v) ? v : undefined;
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
// 还没有 fx.json（旧版升级上来）：待机背景沿用以前在「奖项编辑」选的 event.standbyFx
function loadFx(oldStandby) {
  try { FX = normalize(JSON.parse(fs.readFileSync(FX_PATH, 'utf8'))); } catch { FX = normalize({ all: { standby: oldStandby } }); }
}
function saveFx(d) { FX = normalize(d); atomicWrite(FX_PATH, JSON.stringify(FX, null, 2)); return FX; }
const getFx = () => FX;

module.exports = { SCHEMA, loadFx, saveFx, getFx };
