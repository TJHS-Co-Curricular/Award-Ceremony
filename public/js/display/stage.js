/*
 * 大屏 · 舞台：网址参数、按屏幕比例自适应、全屏 / 隐藏鼠标。
 * 提供：qs、KEY、PREVIEW、RECORD、REC_K、$、mkCanvas、stage、SW / SH（舞台尺寸）、lastV（最新画面数据）、fit()
 */
'use strict';

const qs = new URLSearchParams(location.search);
const KEY = qs.get('k') || '';
const RECORD = qs.get('record') === '1';                 // 控制端「导出影片」用的隐藏页面（display/record.js）
const PREVIEW = qs.get('preview') === '1' && !RECORD;   // 预览：粒子少一点（导出影片时不减）
const $ = id => document.getElementById(id);
// 建一张画布（特效脚本用这个，不直接用 document：它们也可能在后台线程 fx/worker.js 里跑）
const mkCanvas = (w = 1, h = 1) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ---------- 舞台：按屏幕比例自适应 ----------
 * 以 1920×1080 为基准单位，短边固定、长边延伸：
 *   4096×1280 → 舞台 3456×1080（超宽）；1216×896 → 舞台 1920×1415（偏方）
 * 网址加 &res=宽x高 可强制比例（例如经过视频处理器、窗口大小不准时）。 */
const stage = $('stage');
let SW = 1920, SH = 1080, lastV = null, resizeT = 0;
// 导出影片时 canvas 用真正的屏幕像素（例如 4096×1280），画图时整体放大 REC_K 倍；平常 = 1
let REC_K = 1;
const RES = (qs.get('res') || '').match(/^(\d{2,5})x(\d{2,5})$/);
function fit() {
  const tw = RES ? +RES[1] : innerWidth, th = RES ? +RES[2] : innerHeight;
  const s0 = Math.min(tw / 1920, th / 1080);
  const nw = Math.round(tw / s0), nh = Math.round(th / s0);
  const changed = nw !== SW || nh !== SH;
  SW = nw; SH = nh;
  stage.style.width = SW + 'px'; stage.style.height = SH + 'px';
  stage.style.setProperty('--sw', SW + 'px'); stage.style.setProperty('--sh', SH + 'px');
  if (RECORD) REC_K = (RES ? +RES[1] : tw) / SW;
  const cw = RECORD ? Math.round(SW * REC_K / 2) * 2 : SW, ch = RECORD ? Math.round(SH * REC_K / 2) * 2 : SH;   // 影片宽高要双数
  // 只调整三个全屏特效画布（卡片里的照片画布 cards.js 自己定尺寸）：交给 fx/react.js（或后台线程）；特效还没载入时先直接设
  if (typeof fxSizeCanvases === 'function') fxSizeCanvases(cw, ch);
  else for (const c of [$('bg'), $('goldfx'), $('fx')]) if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
  const s = Math.min(innerWidth / SW, innerHeight / SH);
  stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  if (changed && lastV) { clearTimeout(resizeT); resizeT = setTimeout(relayout, 250); }
}
addEventListener('resize', fit); fit();

/* ---------- 全屏 / 隐藏鼠标 ---------- */
function toggleFs() {
  let doc = document;
  try { if (window.parent !== window) doc = window.parent.document; } catch {}   // 在外壳（shell.js）里：让整个外壳全屏
  if (doc.fullscreenElement) doc.exitFullscreen();
  else doc.documentElement.requestFullscreen?.().catch(() => {});
}
addEventListener('dblclick', toggleFs);
addEventListener('keydown', e => { if (e.key === 'f' || e.key === 'F') toggleFs(); });
let idleT;
addEventListener('mousemove', () => { document.body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => document.body.classList.add('idle'), 2000); });
idleT = setTimeout(() => document.body.classList.add('idle'), 2000);
