/*
 * 大屏 · 舞台：网址参数、按屏幕比例自适应、全屏 / 隐藏鼠标。
 * 提供：qs、KEY、PREVIEW、$、stage、SW / SH（舞台尺寸）、lastV（最新画面数据）、fit()
 */
'use strict';

const qs = new URLSearchParams(location.search);
const KEY = qs.get('k') || '';
const PREVIEW = qs.get('preview') === '1';
const $ = id => document.getElementById(id);

/* ---------- 舞台：按屏幕比例自适应 ----------
 * 以 1920×1080 为基准单位，短边固定、长边延伸：
 *   4096×1280 → 舞台 3456×1080（超宽）；1216×896 → 舞台 1920×1415（偏方）
 * 网址加 &res=宽x高 可强制比例（例如经过视频处理器、窗口大小不准时）。 */
const stage = $('stage');
let SW = 1920, SH = 1080, lastV = null, resizeT = 0;
const RES = (qs.get('res') || '').match(/^(\d{2,5})x(\d{2,5})$/);
function fit() {
  const tw = RES ? +RES[1] : innerWidth, th = RES ? +RES[2] : innerHeight;
  const s0 = Math.min(tw / 1920, th / 1080);
  const nw = Math.round(tw / s0), nh = Math.round(th / s0);
  const changed = nw !== SW || nh !== SH;
  SW = nw; SH = nh;
  stage.style.width = SW + 'px'; stage.style.height = SH + 'px';
  stage.style.setProperty('--sw', SW + 'px'); stage.style.setProperty('--sh', SH + 'px');
  for (const c of document.querySelectorAll('canvas')) if (c.width !== SW || c.height !== SH) { c.width = SW; c.height = SH; }
  const s = Math.min(innerWidth / SW, innerHeight / SH);
  stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  if (changed && lastV) { clearTimeout(resizeT); resizeT = setTimeout(relayout, 250); }
}
addEventListener('resize', fit); fit();

/* ---------- 全屏 / 隐藏鼠标 ---------- */
function toggleFs() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
addEventListener('dblclick', toggleFs);
addEventListener('keydown', e => { if (e.key === 'f' || e.key === 'F') toggleFs(); });
let idleT;
addEventListener('mousemove', () => { document.body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => document.body.classList.add('idle'), 2000); });
idleT = setTimeout(() => document.body.classList.add('idle'), 2000);
