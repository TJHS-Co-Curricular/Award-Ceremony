/*
 * 控制端 · 效果控制：待机背景、闪光、浮尘、先一后全节奏、合影位置……调了马上看到，不用重新编译。
 * 表单按服务端给的设定格式（lib/fx.js 的 SCHEMA）生成；值存在服务端 data/fx.json。
 * 「设定给」= 所有屏幕，或某一个屏幕（只记录改过的项目，其余跟随所有屏幕）。
 * 「即时套用到大屏」开：改了约 0.3 秒后自动保存并推送；关：只改右边预览（fxPreviewSet），按「套用到大屏」才推送。
 * 下方「导出影片」：开一个隐藏的输出页（record=1，display/record.js）逐帧渲染成 .mp4 下载；
 *   「在服务器渲染」：交给服务端（lib/render.js，/api/control/render）在那台电脑上渲染，这里每 1.5 秒看一次进度、提供下载。
 * 提供：fxOpen()、fxClose()、fxDirty
 * 需要：core.js（$、V、api、el、toast、store）
 */
'use strict';

let fxSchema = null, fxSaved = null, fxData = null, fxDirty = false, fxScope = '', fxSaveT = 0, fxBusy = false;
const fxClone = o => JSON.parse(JSON.stringify(o));
const fxScreens = () => V?.screens?.length ? V.screens : [{ name: '', width: 1920, height: 1080 }];

async function fxOpen() {
  if (!fxDirty) {
    try { const j = await api('GET', '/api/control/fx'); fxSchema = j.schema; fxSaved = j.fx; fxData = fxClone(j.fx); }
    catch (e) { toast('读取效果设定失败：' + e.message, true); return; }
  }
  $('fxLive').checked = store.get('ac_fxlive') !== '0';
  const scope = $('fxScope'), pv = $('fxPvScreen'), keepPv = pv.value || store.get('ac_fxpv');
  scope.replaceChildren(el('option', { value: '' }, '所有屏幕'), ...(V?.screens || []).map(sc => el('option', { value: sc.name }, `只有「${sc.name}」`)));
  scope.value = [...scope.options].some(o => o.value === fxScope) ? fxScope : '';
  fxScope = scope.value;
  pv.replaceChildren(...fxScreens().map((sc, i) => el('option', { value: i }, `${sc.name || '输出页'} ${sc.width}×${sc.height}`)));
  if ([...pv.options].some(o => o.value === keepPv)) pv.value = keepPv;
  fxBuild(); fxPvLoad(); fxStatus(); recInfo(); srvStart();
}
function fxClose() { srvStop(); if ($('fxPv').src !== 'about:blank') $('fxPv').src = 'about:blank'; }   // 不在这页就停掉预览（省电）

/* ---------- 值：所有屏幕 / 单一屏幕 ---------- */
const fxOver = k => !!(fxScope && fxData.screens[fxScope] && k in fxData.screens[fxScope]);
const fxGet = k => fxOver(k) ? fxData.screens[fxScope][k] : fxData.all[k];
const fxFor = name => ({ ...fxData.all, ...(fxData.screens[name] || {}) });   // 某个屏幕实际用的值
function fxSetVal(k, v) {
  if (!fxScope) fxData.all[k] = v; else (fxData.screens[fxScope] ||= {})[k] = v;
  fxChanged();
}
function fxUnset(k) {
  const o = fxData.screens[fxScope]; if (!o) return;
  delete o[k]; if (!Object.keys(o).length) delete fxData.screens[fxScope];
  fxChanged(); fxBuild();
}
function fxFmt(s, v) {
  if (v == null) return '自动';
  if (s.key === 'cascadeMs') return v + ' ms';
  const d = String(s.step).split('.')[1]?.length || 0;
  return s.label?.includes('倍') ? (+v).toFixed(d) + '×' : (+v).toFixed(d);
}

/* ---------- 表单 ---------- */
function fxBuild() {
  const form = $('fxForm'); form.replaceChildren();
  const groups = new Map();
  for (const s of fxSchema) { if (!groups.has(s.group)) groups.set(s.group, []); groups.get(s.group).push(s); }
  for (const [g, items] of groups) {
    const card = el('div', { class: 'ecard' }, el('div', { class: 'head' }, el('b', { style: 'flex:1' }, g)));
    for (const s of items) card.append(fxRow(s));
    form.append(card);
  }
}
function fxRow(s) {
  const v = fxGet(s.key), locked = s.global && fxScope, row = el('div', { class: 'fxr' + (fxOver(s.key) ? ' over' : '') });
  const out = el('span', { class: 'fxv' }, s.type === 'num' || s.type === 'auto' ? fxFmt(s, v) : '');
  let ctl;
  if (s.type === 'enum') {
    ctl = el('select', { onchange: e => { fxSetVal(s.key, e.target.value); fxMark(row); } }, ...s.options.map(([val, txt]) => el('option', { value: val }, txt)));
    ctl.value = v;
  } else if (s.type === 'bool') {
    ctl = el('input', { type: 'checkbox', style: 'width:auto;justify-self:start', onchange: e => { fxSetVal(s.key, e.target.checked); fxMark(row); } });
    ctl.checked = !!v;
  } else {
    const range = el('input', { type: 'range', min: s.min, max: s.max, step: s.step });
    range.value = v ?? (s.min + s.max) / 2;
    range.oninput = () => { fxSetVal(s.key, +range.value); out.textContent = fxFmt(s, +range.value); fxMark(row); };
    ctl = range;
    if (s.type === 'auto') {   // 自动 = 按屏幕比例决定（null）
      const auto = el('input', { type: 'checkbox', style: 'width:auto' });
      auto.checked = v == null; range.disabled = v == null;
      auto.onchange = () => { range.disabled = auto.checked; const nv = auto.checked ? null : +range.value; fxSetVal(s.key, nv); out.textContent = fxFmt(s, nv); fxMark(row); };
      ctl = el('div', { style: 'display:flex;gap:8px;align-items:center' }, range, el('label', { class: 'muted', style: 'display:flex;gap:4px;align-items:center;white-space:nowrap;cursor:pointer' }, auto, '自动'));
    }
  }
  const undo = el('button', { class: 'fxu', title: '回到跟随「所有屏幕」', onclick: () => fxUnset(s.key) }, '↺');
  row.append(el('span', {}, s.label || '背景'), ctl, out, undo);
  if (locked) { row.classList.add('lock'); row.title = '这项只能在「所有屏幕」设定'; for (const i of row.querySelectorAll('input,select')) i.disabled = true; }
  return row;
}
const fxMark = row => row.classList.toggle('over', !!fxScope);

/* ---------- 保存 / 预览 ---------- */
function fxChanged() {
  fxDirty = JSON.stringify(fxData) !== JSON.stringify(fxSaved);
  fxPush(); fxStatus();
  clearTimeout(fxSaveT);
  if (fxDirty && $('fxLive').checked) fxSaveT = setTimeout(fxSave, 300);
}
async function fxSave() {
  if (fxBusy) { fxSaveT = setTimeout(fxSave, 200); return; }
  fxBusy = true;
  const sent = JSON.stringify(fxData);
  try {
    const r = await api('PUT', '/api/control/fx', fxData);
    fxSaved = r.fx;
    if (JSON.stringify(fxData) === sent) fxData = fxClone(r.fx);   // 保存期间没再改：用服务端整理过的值
    fxDirty = JSON.stringify(fxData) !== JSON.stringify(fxSaved);
  } catch (e) { toast('保存效果设定失败：' + e.message, true); }
  fxBusy = false; fxStatus();
}
function fxStatus() {
  const live = $('fxLive').checked;
  $('fxState').textContent = fxBusy ? '保存中…' : fxDirty ? (live ? '保存中…' : '只在预览，还没套用到大屏') : '大屏已是这个设定';
  $('fxState').style.color = fxDirty && !live ? 'var(--warn)' : '';
  $('bFxApply').classList.toggle('hidden', live); $('bFxDiscard').classList.toggle('hidden', live);
  $('bFxApply').disabled = $('bFxDiscard').disabled = !fxDirty;
}
const fxWin = () => { try { return $('fxPv').contentWindow; } catch { return null; } };
function fxPvScreen() { return fxScreens()[+$('fxPvScreen').value] || fxScreens()[0]; }
function fxPvLoad() {
  const sc = fxPvScreen();
  $('fxPv').style.aspectRatio = `${sc.width}/${sc.height}`;
  $('fxPv').src = `/display?k=${encodeURIComponent(V?.displayKey || '')}&preview=1&res=${sc.width}x${sc.height}` + (sc.name ? '&name=' + encodeURIComponent(sc.name) : '');
}
function fxPush() { if (fxData) fxWin()?.fxPreviewSet?.(fxFor(fxPvScreen().name)); }   // 预览窗口用目前（可能还没保存）的值

$('fxPv').addEventListener('load', () => setTimeout(fxPush, 50));
$('fxScope').onchange = e => {
  fxScope = e.target.value;
  const i = fxScreens().findIndex(sc => sc.name === fxScope);   // 选了某个屏幕：预览也切过去
  if (i >= 0 && +$('fxPvScreen').value !== i) { $('fxPvScreen').value = i; store.set('ac_fxpv', String(i)); fxPvLoad(); }
  fxBuild();
};
$('fxPvScreen').onchange = e => { store.set('ac_fxpv', e.target.value); fxPvLoad(); };
$('fxLive').onchange = e => { store.set('ac_fxlive', e.target.checked ? '1' : '0'); if (e.target.checked && fxDirty) fxSave(); fxStatus(); };
$('bFxApply').onclick = () => { clearTimeout(fxSaveT); fxSave(); };
$('bFxDiscard').onclick = () => { fxData = fxClone(fxSaved); fxDirty = false; fxBuild(); fxPush(); fxStatus(); };
$('bFxReset').onclick = () => {
  if (!confirm(fxScope ? `「${fxScope}」的单独设定全部清掉，回到跟随所有屏幕？` : '所有屏幕的效果恢复默认值？（各屏幕单独的设定保留）')) return;
  if (fxScope) delete fxData.screens[fxScope];
  else fxData.all = Object.fromEntries(fxSchema.map(s => [s.key, s.def]));
  fxChanged(); fxBuild();
};
$('bFxStandby').onclick = () => fxWin()?.show?.('s-standby');
$('bFxFlash').onclick = () => fxWin()?.burst?.(260);
$('bFxBack').onclick = () => fxWin()?.relayout?.();

/* ---------- 导出影片：开一个隐藏的输出页（record=1）逐帧渲染，回来下载 .mp4 ---------- */
let recBusy = false, recFrame = null;
function recInfo() {
  const sc = fxPvScreen();
  $('recRes').textContent = `${sc.width}×${sc.height}${sc.name ? '（' + sc.name + '）' : ''}`;
}
$('fxPvScreen').addEventListener('change', recInfo);
$('bRec').onclick = async () => {
  if (recBusy) return;
  const sc = fxPvScreen(), opt = {
    content: $('recContent').value, seconds: Math.min(600, Math.max(3, +$('recSec').value || 60)),
    fade: Math.min(10, Math.max(0, +$('recFade').value || 0)), fps: +$('recFps').value, bpp: +$('recQ').value
  };
  recBusy = true; $('bRec').disabled = true; $('bRecStop').classList.remove('hidden'); $('recState').textContent = '准备中…'; $('recBar').style.width = '0';
  recFrame = el('iframe', { style: 'position:fixed;left:-10000px;top:0;width:640px;height:360px;border:0' });
  recFrame.src = `/display?k=${encodeURIComponent(V?.displayKey || '')}&preview=1&record=1&res=${sc.width}x${sc.height}` + (sc.name ? '&name=' + encodeURIComponent(sc.name) : '');
  document.body.append(recFrame);
  const t0 = Date.now();
  try {
    await new Promise((ok, bad) => { recFrame.onload = ok; setTimeout(() => bad(new Error('输出页打不开')), 20000); });
    const r = await recFrame.contentWindow.recStart(opt, fxFor(sc.name), (p, what) => {
      $('recBar').style.width = (p * 100).toFixed(1) + '%';
      const left = p > .02 ? Math.round((Date.now() - t0) / p * (1 - p) / 1000) : null;
      $('recState').textContent = `${what} ${(p * 100).toFixed(0)}%` + (left != null ? `，大约还要 ${left >= 60 ? Math.floor(left / 60) + ' 分 ' : ''}${left % 60} 秒` : '');
    });
    const name = { standby: '待机画面', standbybg: '待机背景', base: '底层背景', flash: '揭晓闪光' }[opt.content];
    const a = el('a', { href: URL.createObjectURL(r.blob), download: `${name}-${sc.name || '输出页'}-${r.width}x${r.height}-${opt.seconds}s-${opt.fps}fps.mp4` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    $('recState').textContent = `完成：${(r.blob.size / 1048576).toFixed(1)} MB · ${r.codec.startsWith('avc') ? 'H.264' : 'VP9'} · ${r.hw ? '显卡编码' : 'CPU 软件编码'} · 每秒算 ${r.speed.toFixed(1)} 帧 · 用了 ${Math.round((Date.now() - t0) / 1000)} 秒`;
  } catch (e) {
    $('recState').textContent = '没有导出：' + e.message;
  }
  recFrame.remove(); recFrame = null; recBusy = false;
  $('bRec').disabled = false; $('bRecStop').classList.add('hidden');
};
$('bRecStop').onclick = () => { try { recFrame?.contentWindow?.recCancel(); } catch {} };

/* ---------- 服务器渲染：交给服务端（lib/render.js）在那台电脑上渲染，这里只看进度、下载 ---------- */
let srvPoll = 0, srvSig = '';
const SRV_NAME = { standby: '待机画面', standbybg: '待机背景', base: '底层背景', flash: '揭晓闪光' };
const srvMB = b => (b / 1048576).toFixed(1) + ' MB';
function srvStart() { srvFill(); srvRefresh(); clearInterval(srvPoll); srvPoll = setInterval(srvRefresh, 1500); }
function srvStop() { clearInterval(srvPoll); srvPoll = 0; }
function srvFill() {
  const sel = $('srvScreen'), keep = sel.value;
  sel.replaceChildren(el('option', { value: '*' }, '全部屏幕'), ...(V?.screens || []).map(sc => el('option', { value: sc.name }, `${sc.name} ${sc.width}×${sc.height}`)));
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
}
async function srvRefresh() {
  let st; try { st = await api('GET', '/api/control/render'); } catch { return; }
  $('srvAvail').textContent = st.available ? `服务端 CPU ${st.cpus} 核 · 编码：${st.encoder?.ok ? st.encoder.label : '浏览器内建'}${st.gpu ? ' · 画面：' + st.gpu : ''}` : '⚠ ' + st.reason;
  $('srvAvail').title = st.encoder?.reason || '';
  $('srvAvail').style.color = st.available ? '' : 'var(--warn)';
  $('bSrvRender').disabled = !st.available;
  if (!$('srvPar').dataset.set) { $('srvPar').value = st.parallel; $('srvPar').dataset.set = '1'; }
  const sig = JSON.stringify([st.jobs, st.files]); if (sig === srvSig) return; srvSig = sig;   // 没变就不重画
  const jobs = [...st.jobs].reverse();
  $('srvJobs').replaceChildren(...jobs.map(j => {
    const active = j.state === 'queued' || j.state === 'running';
    const info = j.state === 'done' ? `${srvMB(j.size)} · ${j.codec?.startsWith('avc') ? 'H.264' : 'VP9'} · ${j.encoder || (j.hw ? '显卡编码' : 'CPU 编码')} · 每秒 ${j.speed?.toFixed(1)} 帧 · ${Math.round((j.ended - j.started) / 1000)} 秒`
      : j.state === 'error' ? '失败：' + j.error : j.state === 'running' ? `${j.what} ${(j.prog * 100).toFixed(0)}%` : j.what;
    return el('div', { class: 'srvrow' },
      el('span', {}, `#${j.id} ${SRV_NAME[j.content]} · ${j.screen} ${j.width}×${j.height} · ${j.seconds}s · ${j.fps}fps`),
      el('div', { class: 'autobar' }, el('i', { style: `width:${(j.prog * 100).toFixed(1)}%;${j.state === 'error' ? 'background:var(--bad)' : j.state === 'done' ? 'background:var(--go)' : ''}` })),
      el('span', { class: 'muted' }, info),
      active ? el('button', { onclick: () => api('POST', '/api/control/render/cancel', { id: j.id }).then(srvRefresh).catch(e => toast(e.message, true)) }, '取消')
        : j.state === 'done' ? el('a', { href: '/api/control/render/file?name=' + encodeURIComponent(j.file), download: j.file }, '下载') : el('span'));
  }));
  $('srvFiles').replaceChildren(...(st.files.length ? [el('div', { class: 'muted', style: 'font-size:12px;margin:6px 0 2px' }, `服务端已有的影片（${st.files.length}）`)] : []),
    ...st.files.map(f => el('div', { class: 'srvrow file' },
      el('span', {}, f.name), el('span', { class: 'muted' }, `${srvMB(f.size)} · ${new Date(f.mtime).toLocaleString('zh-CN', { hour12: false })}`),
      el('a', { href: '/api/control/render/file?name=' + encodeURIComponent(f.name), download: f.name }, '下载'),
      el('button', { onclick: () => { if (confirm(`删除服务端上的「${f.name}」？`)) api('POST', '/api/control/render/delete', { name: f.name }).then(srvRefresh).catch(e => toast(e.message, true)); } }, '删除'))));
}
$('bSrvRender').onclick = async () => {
  const job = { screen: $('srvScreen').value, content: $('recContent').value, seconds: +$('recSec').value || 60, fade: +$('recFade').value || 0,
    fps: +$('recFps').value, quality: +$('recQ').value };
  if (fxDirty) toast('提醒：效果设定还没套用到大屏，服务器会用已保存的设定');
  try { const r = await api('POST', '/api/control/render', { jobs: [job], parallel: +$('srvPar').value || 1 }); toast(`已交给服务器：${r.added} 支`); srvRefresh(); }
  catch (e) { toast('服务器渲染失败：' + e.message, true); }
};
