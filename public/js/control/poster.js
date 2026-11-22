/*
 * 控制端 · 海报导出：把「图片导出」的成品卡排成一张大海报（维护者定 2026-11-22，例子：2025 表扬大会的三张海报）。
 *   一张海报 = 背景图片 + 几段（每段 = 一个奖项：大标题 + 那个奖项所有得奖者的卡片）。
 *   尺寸用英寸（最高成就 51×43、杰出 / 优秀团体 24×43、学会 / 执委 11×43），卡片大小和列数自动算：所有段都放得下、卡片最大。
 *   入围揭晓的奖项只放得主（poWho）。
 *   卡片 = exRender()（export.js，跟图片导出同一份设计），固定 16:9；导出 JPG，或按实际尺寸的 PDF（ebPdf，ebook.js）。
 * 设置存 data/poster.json（GET / PUT /api/control/poster）；背景图片 data/backgrounds/poster.jpg（/api/control/poster-bg）。
 * 提供：poOpen()
 * 需要：core.js（api、el、toast、log、loadImg、mb、draft）、shared/fonts.js（fontFamily）、shared/theme.js（thC）、
 *       export.js（EXS、exEnsure、exLoadMats、exUseFonts、exRender、exCover、safeFile、EX_TITLE）、ebook.js（ebPdf）
 */
'use strict';

const PO_SIZES = [['51x43', '51 × 43 英寸（最高成就）'], ['24x43', '24 × 43 英寸（杰出 / 优秀团体）'], ['11x43', '11 × 43 英寸（学会 / 执委）']];
const PO_BG_EDGE = 8192;   // 背景图片长边上限（51 英寸 × 150 dpi ≈ 7650 像素）
const PO_DEF = () => ({
  dpi: 150, panelA: 35, headOn: true, titleOn: true, logoHead: true, logoCard: true, idSide: true, color: '#ffc000', titleK: 100, font: '', cur: 0,
  posters: [
    { name: '最高成就', w: 51, h: 43, ids: [], heads: {} },
    { name: '杰出 / 优秀团体', w: 24, h: 43, ids: [], heads: {} },
    { name: '学会 / 执委', w: 11, h: 43, ids: [], heads: {} }
  ]
});
function poClean(v) {
  const d = PO_DEF(), num = (x, a, b, def) => (Number.isFinite(+x) && x !== '' && x != null ? Math.min(b, Math.max(a, +x)) : def);
  const list = Array.isArray(v?.posters) ? v.posters : d.posters;
  const posters = list.slice(0, 20).map(p => ({
    name: String(p?.name || '海报').slice(0, 40),
    w: num(p?.w, 4, 120, 24), h: num(p?.h, 4, 120, 43),
    ids: (Array.isArray(p?.ids) ? p.ids : []).map(String).slice(0, 200),
    style: ['grid', 'panel'].includes(p?.style) ? p.style : 'auto',
    title: String(p?.title || '').slice(0, 200),   // 这张海报的抬头标题（空 = 活动名称）
    noHead: (Array.isArray(p?.noHead) ? p.noHead : []).map(String).slice(0, 200),   // 不要标题的奖项（id）
    heads: Object.fromEntries(Object.entries(p?.heads && typeof p.heads === 'object' ? p.heads : {}).map(([k, t]) => [String(k), String(t || '').slice(0, 200)]).filter(([, t]) => t.trim()))
  }));
  if (!posters.length) posters.push(d.posters[0]);
  return {
    dpi: [100, 150, 200].includes(+v?.dpi) ? +v.dpi : d.dpi, panelA: num(v?.panelA, 0, 80, d.panelA),
    color: /^#[0-9a-f]{6}$/i.test(v?.color || '') ? v.color : d.color,
    headOn: v?.headOn !== false, titleOn: v?.titleOn !== false, logoHead: v?.logoHead !== false, logoCard: v?.logoCard !== false, idSide: v?.idSide !== false,   // Logo 开关（维护者 2026-11-22）
    titleK: num(v?.titleK, 40, 200, d.titleK), font: String(v?.font || '').slice(0, 120),
    cur: Math.min(posters.length - 1, Math.max(0, Math.floor(num(v?.cur, 0, 99, 0)))), posters
  };
}
let PO = PO_DEF(), poLoaded = false, poSaveT = 0, poPvT = 0, poBg = '', poBgImg = null, poBusy = false;
const poCards = new Map();   // 预览用的小卡片（每次打开分页清空）

async function poOpen() {
  if (!poLoaded) {
    try { const j = await api('GET', '/api/control/poster'); PO = poClean(j.poster && Object.keys(j.poster).length ? j.poster : null); poBg = j.bg || ''; }
    catch { PO = PO_DEF(); }
    poLoaded = true;
  }
  poCards.clear(); poBgImg = null;
  await exEnsure(); await exLoadMats();
  $('poFontList').replaceChildren(...fontFiles.map(f => el('option', { value: 'file:' + f.name }, '📄 ' + f.name)));
  poBuild(); poPreviewSoon(0);
}
const poAwards = () => (draft ? draft.awards.filter(a => a.winners.length) : []);
const poCur = () => PO.posters[PO.cur];
// 海报上放谁：入围揭晓的奖项（有标「得主」）只放得主，入围者不放（维护者定 2026-11-22：最佳执委只要得主）；其它奖项放全部
const poWho = a => exWinners(a);   // export.js：入围揭晓只要得主

/* ---- 表单 ---- */
function poBuild() {
  $('po_idSide').checked = PO.idSide;
  $('po_logoHead').checked = PO.logoHead; $('po_logoHead').disabled = !PO.headOn; $('po_logoCard').checked = PO.logoCard;
  $('po_headOn').checked = PO.headOn; $('po_titleOn').checked = PO.titleOn; $('po_titleK').disabled = !PO.titleOn;
  for (const id of ['po_color', 'po_font']) $(id).disabled = !PO.titleOn && !PO.headOn;   // 颜色、字体：活动抬头和奖项标题共用
  $('po_dpi').value = String(PO.dpi); $('po_color').value = PO.color; $('po_titleK').value = PO.titleK; $('po_titleKV').textContent = PO.titleK + '%'; $('po_font').value = PO.font;
  $('poBgInfo').textContent = poBg ? '已上传' : '没有（用深色渐层）'; $('bPoBgDel').disabled = !poBg;
  $('poPick').replaceChildren(...PO.posters.map((p, i) => el('option', { value: String(i) }, `${i + 1}. ${p.name}（${p.w}×${p.h}）`)));
  $('poPick').value = String(PO.cur);
  const P = poCur();
  $('po_name').value = P.name; $('po_title').value = P.title; $('po_title').placeholder = '留空 = 活动名称（' + (poEvTitle().join(' ') || '没写') + '）；一行一行写';
  const key = `${P.w}x${P.h}`;
  $('po_size').value = PO_SIZES.some(s => s[0] === key) ? key : 'custom';
  $('po_w').value = P.w; $('po_h').value = P.h;
  $('po_style').value = P.style || 'auto'; $('po_styleNow').textContent = poStyle(P) === 'panel' ? '现在：分段' : '现在：紧凑网格';
  $('po_panelA').value = PO.panelA; $('po_panelAV').textContent = PO.panelA + '%';
  const awards = poAwards(), sel = poSecs(P);
  $('poAwards').replaceChildren(...(awards.length ? awards.map(a => {
    const on = P.ids.includes(a.id), i = sel.indexOf(a);
    const row = el('div', { class: 'poa' + (on ? ' on' : '') },
      el('label', {}, el('input', { type: 'checkbox', ...(on ? { checked: '' } : {}), onchange: e => poToggle(a.id, e.target.checked) }),
        el('span', {}, [a.section, a.group].filter(Boolean).join(' · ') + (a.group || a.section ? ' · ' : ''), el('b', {}, a.title)), el('span', { class: 'muted' }, poWho(a).length < a.winners.length ? `（得主 ${poWho(a).length} / 入围 ${a.winners.length}）` : `（${a.winners.length}）`)));
    const hon = !P.noHead.includes(a.id);
    if (on && PO.titleOn) row.append(el('label', { class: 'pohd', title: '这个奖项上面要不要大标题（卡片上已经有奖项名）' }, el('input', { type: 'checkbox', ...(hon ? { checked: '' } : {}), onchange: e => poHeadToggle(a.id, e.target.checked) }), '这个奖项要标题'));
    if (on && PO.titleOn && hon) row.append(el('textarea', { rows: '2', placeholder: '标题（留空 = ' + poAutoHead(sel, i).replace('\n', ' / ') + '）', oninput: e => { const t = e.target.value, hs = poCur().heads; if (t.trim()) hs[a.id] = t; else delete hs[a.id]; poChanged(); } }, P.heads[a.id] || ''));
    return row;
  }) : [el('p', { class: 'muted' }, '还没有得奖者')]));
}
function poHeadToggle(id, on) {   // 每个奖项自己的标题开关（维护者 2026-11-22）
  const P = poCur();
  P.noHead = P.noHead.filter(x => x !== id); if (!on) P.noHead.push(id);
  poChanged(); poBuild();
}
function poToggle(id, on) {
  const P = poCur();
  if (on && !P.ids.includes(id)) P.ids.push(id);
  if (!on) { P.ids = P.ids.filter(x => x !== id); delete P.heads[id]; P.noHead = P.noHead.filter(x => x !== id); }
  const order = poAwards().map(a => a.id);   // 段落顺序 = 奖项编辑里的顺序
  P.ids.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  poChanged(); poBuild();
}
function poChanged() {
  PO = poClean(PO);
  $('poSaveState').textContent = '● 未保存';
  clearTimeout(poSaveT); poSaveT = setTimeout(async () => {
    try { await api('PUT', '/api/control/poster', PO); $('poSaveState').textContent = '已保存'; }
    catch (e) { $('poSaveState').textContent = '保存失败：' + e.message; }
  }, 800);
  poPreviewSoon();
}
$('po_dpi').onchange = () => { PO.dpi = +$('po_dpi').value; poChanged(); };
$('po_headOn').onchange = () => { PO.headOn = $('po_headOn').checked; poChanged(); poBuild(); };
$('po_logoHead').onchange = () => { PO.logoHead = $('po_logoHead').checked; poChanged(); };
$('po_idSide').onchange = () => { PO.idSide = $('po_idSide').checked; poChanged(); };
$('po_logoCard').onchange = () => { PO.logoCard = $('po_logoCard').checked; poChanged(); };
$('po_titleOn').onchange = () => { PO.titleOn = $('po_titleOn').checked; poChanged(); poBuild(); };
$('po_color').oninput = () => { PO.color = $('po_color').value; poChanged(); };
$('po_titleK').oninput = () => { PO.titleK = +$('po_titleK').value; $('po_titleKV').textContent = PO.titleK + '%'; poChanged(); };
$('po_font').onchange = () => { PO.font = $('po_font').value.trim(); poChanged(); };
$('po_name').oninput = () => { poCur().name = $('po_name').value || '海报'; poChanged(); $('poPick').options[PO.cur].textContent = `${PO.cur + 1}. ${poCur().name}（${poCur().w}×${poCur().h}）`; };
$('po_title').oninput = () => { poCur().title = $('po_title').value; poChanged(); };
$('po_size').onchange = () => { const v = $('po_size').value; if (v !== 'custom') { const [w, h] = v.split('x').map(Number); Object.assign(poCur(), { w, h }); } poChanged(); poBuild(); };
for (const id of ['po_w', 'po_h']) $(id).onchange = () => { Object.assign(poCur(), { w: +$('po_w').value, h: +$('po_h').value }); poChanged(); poBuild(); };
$('po_style').onchange = () => { poCur().style = $('po_style').value; poChanged(); poBuild(); };
$('po_panelA').oninput = () => { PO.panelA = +$('po_panelA').value; $('po_panelAV').textContent = PO.panelA + '%'; poChanged(); };
$('poPick').onchange = () => { PO.cur = +$('poPick').value; poChanged(); poBuild(); };
$('bPoAdd').onclick = () => { PO.posters.push({ name: '新海报', w: 24, h: 43, ids: [], heads: {} }); PO.cur = PO.posters.length - 1; poChanged(); poBuild(); };
$('bPoDel').onclick = () => {
  if (PO.posters.length < 2) return toast('至少要留一张海报', true);
  if (!confirm(`删掉海报「${poCur().name}」的设置？（不会删任何照片或名单）`)) return;
  PO.posters.splice(PO.cur, 1); PO.cur = 0; poChanged(); poBuild();
};

/* ---- 背景图片 ---- */
$('poBgFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const src = await new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => bad(new Error('读不到文件')); r.readAsDataURL(f); });
    const im = await loadImg(src);
    const k = Math.min(1, PO_BG_EDGE / Math.max(im.naturalWidth, im.naturalHeight));
    const cv = el('canvas'); cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, cv.width, cv.height);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .9));
    const r = await fetch('/api/control/poster-bg', { method: 'POST', headers: { 'X-AC': '1', 'Content-Type': 'image/jpeg' }, body: blob, credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    poBg = j.bg || ''; poBgImg = null; poBuild(); poPreviewSoon(0);
    toast('海报背景已上传'); log(`上传海报背景（${cv.width}×${cv.height}，${mb(blob.size)}）`);
  } catch (err) { toast('上传失败：' + err.message, true); }
};
$('bPoBgDel').onclick = async () => {
  if (!confirm('移除海报背景图片？')) return;
  try { await api('POST', '/api/control/poster-bg/delete', {}); poBg = ''; poBgImg = null; poBuild(); poPreviewSoon(0); toast('已移除海报背景'); }
  catch (e) { toast('移除失败：' + e.message, true); }
};
async function poLoadBg() {
  if (!poBg) return null;
  if (!poBgImg) poBgImg = await loadImg('/api/control/poster-bg?v=' + encodeURIComponent(poBg)).catch(() => null);
  return poBgImg;
}

/* ---- 排版（单位：英寸） ---- */
function poSecs(P) { const m = new Map(poAwards().map(a => [a.id, a])); return P.ids.map(id => m.get(id)).filter(Boolean); }
// 自动标题：这一段的分类和上一段不同 → 「分类 / 奖项」两行；否则只写奖项名
function poAutoHead(secs, i) {
  const a = secs[i], prev = secs[i - 1];
  return a.group && (!prev || prev.group !== a.group) ? `${a.group}\n${a.title}` : a.title;
}
const poHead = (P, secs, i) => (P.heads[secs[i].id] || poAutoHead(secs, i)).split(/\r?\n/).map(t => t.trim()).filter(Boolean);
// 版式：grid = 紧凑网格（像 2025 最高成就那张）；panel = 分段（上面活动抬头、每个奖项一个底框 + 英文名、下面日期地点）。
// auto：宽的海报用 grid，直的（宽 < 高 × 0.8，例：24×43、11×43）用 panel（维护者 2026-11-22：直幅可以自己优化，例子只供参考）
const poStyle = P => (P.style === 'grid' || P.style === 'panel' ? P.style : P.w < P.h * .8 ? 'panel' : 'grid');
// 抬头的大字：这张海报写了自定义标题就用它（一行一行），否则用活动名称（开头是年份就分两行）
const poHeadLines = P => (P?.title?.trim() ? P.title.split(/\r?\n/).map(t => t.trim()).filter(Boolean) : poEvTitle());
const poEvTitle = () => { const t = String(draft?.event?.title || '').trim(), m = t.match(/^(\d{4})\s*年?\s*(.+)$/); return m ? [m[1], m[2]] : t ? [t] : []; };
const poFoot = () => [draft?.event?.date, draft?.event?.time, draft?.event?.venue].map(x => String(x || '').trim()).filter(Boolean).join(' · ');
// 卡片由大到小试：每段 = 标题 + ceil(人数 / 列数) 排卡片，全部放得下的最大卡片就是答案；列数所有段一样
function poLayout(P, secs, fam) {
  const panel = poStyle(P) === 'panel', g = el('canvas').getContext('2d');
  const hon = a => PO.titleOn && !P.noHead.includes(a.id);   // 全部的开关 + 每个奖项自己的开关
  const heads = secs.map((a, i) => (hon(a) ? poHead(P, secs, i) : []));   // 不要标题（图片导出的卡片上已经有奖项名）：每段只有卡片
  const ens = secs.map(a => (panel && hon(a) && !P.heads[a.id] && a.subtitle ? String(a.subtitle) : ''));   // 分段版式：自动标题下面加英文名
  const widest = heads.map(ls => Math.max(1, ...ls.map(t => { g.font = `700 100px ${fam}`; return g.measureText(t).width / 100; })));   // 每 1 单位字号的宽度
  // 抬头、页脚的高度只看海报尺寸，不跟卡片变
  const hh = PO.headOn && (panel || P.title.trim()) ? Math.min(P.w * .45, P.h * .16) : 0,   // 紧凑网格只有写了自定义标题才加抬头
      // 活动抬头可以单独关掉（维护者 2026-11-22：大标题和奖项标题分开）
    foot = panel ? poFoot() : '', hf = foot ? Math.min(P.w * .055, P.h * .03) : 0;
  for (let cw = Math.min(P.w, P.h * 1.6); cw > 0.4; cw *= 0.99) {
    const ch = cw * 9 / 16, gx = cw * .1, gy = cw * .065, m = cw * .09, sg = cw * .14, inner = P.w - 2 * m;
    const pp = panel ? cw * .13 : 0, area = inner - 2 * pp;   // 底框里面的留白
    if (cw > area) continue;
    const cols = Math.max(1, Math.floor((area + gx) / (cw + gx)));
    let total = 2 * m + hh + hf + Math.max(0, secs.length - 1) * sg;
    const fs = Math.min(cw * .42 * PO.titleK / 100, ...widest.map(x => area * .96 / x));   // 同一张海报的标题一样大（照最长的那个）
    const parts = secs.map((a, i) => {
      const en = ens[i], efs = fs * .3;
      const th = heads[i].length ? heads[i].length * fs * 1.18 + (en ? efs * 1.9 : 0) + fs * .3 : 0;
      const rows = Math.ceil(poWho(a).length / cols);
      const h = 2 * pp + th + rows * ch + (rows - 1) * gy;
      total += h;
      return { a, lines: heads[i], en, efs, fs, th, rows, h };
    });
    if (total <= P.h) return { panel, cw, ch, gx, gy, m, sg, pp, cols, parts, hh, hf, foot, extra: P.h - total };
  }
  return null;
}

/* ---- 画 ---- */
async function poTitleFam() {
  const own = PO.font ? await fontFamily(PO.font, 'po') : '';
  const f = own ? `${own}, ${EX_TITLE}` : EX_TITLE;
  await document.fonts.load(`700 40px ${f}`, '最高成就奖').catch(() => {});
  return f;
}
const poLift = (hex, f) => '#' + [1, 3, 5].map(i => Math.round(Math.min(255, parseInt(hex.slice(i, i + 2), 16) * f + (f > 1 ? 20 : 0))).toString(16).padStart(2, '0')).join('');
// 金色渐层大字 + 深色描边、阴影（例子海报的样子）；cx、by、px 都是像素
function poBigText(g, t, cx, by, px, fam, maxW) {
  g.font = `700 ${px}px ${fam}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  if (maxW && g.measureText(t).width > maxW) { px *= maxW / g.measureText(t).width; g.font = `700 ${px}px ${fam}`; }
  const gr = g.createLinearGradient(0, by - px * .85, 0, by + px * .1); gr.addColorStop(0, poLift(PO.color, 1.25)); gr.addColorStop(1, poLift(PO.color, .82));
  g.save();
  g.shadowColor = 'rgba(40,20,0,.55)'; g.shadowBlur = px * .06; g.shadowOffsetX = g.shadowOffsetY = px * .035;
  g.lineJoin = 'round'; g.lineWidth = px * .045; g.strokeStyle = 'rgba(70,35,0,.85)'; g.strokeText(t, cx, by);
  g.shadowColor = 'transparent'; g.fillStyle = gr; g.fillText(t, cx, by);
  g.restore();
}
// 小字（英文名、日期地点）：主色、字距拉开、淡淡的阴影
function poSmallText(g, t, cx, by, px, fam, maxW, spacing = .12) {
  g.save(); g.font = `600 ${px}px ${fam}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  try { g.letterSpacing = `${px * spacing}px`; } catch { /* 旧浏览器没有字距 */ }
  if (maxW && g.measureText(t).width > maxW) { px *= maxW / g.measureText(t).width; g.font = `600 ${px}px ${fam}`; try { g.letterSpacing = `${px * spacing}px`; } catch { /* 同上 */ } }
  g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = px * .25; g.fillStyle = poLift(PO.color, 1.1); g.fillText(t, cx, by); g.restore();
}
// 分隔线：两边淡出的金线，中间一个小菱形
function poRule(g, cx, y, w, lw) {
  g.save();
  const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, poLift(PO.color, 1.05)); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(cx - w / 2, y - lw / 2, w, lw);
  const d = lw * 3.2; g.translate(cx, y); g.rotate(Math.PI / 4); g.fillStyle = poLift(PO.color, 1.15); g.fillRect(-d / 2, -d / 2, d, d);
  g.restore();
}
function poRound(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// 画一张海报：dpi = 每英寸像素；card(a, w, px) → 卡片 canvas；progress(k, n)
async function poDraw(P, dpi, card, progress) {
  const secs = poSecs(P), tfam = await poTitleFam(), L = poLayout(P, secs, tfam);
  const W = Math.round(P.w * dpi), H = Math.round(P.h * dpi), D = v => v * dpi;
  const cv = el('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
  const bg = await poLoadBg();
  if (bg) exCover(g, bg, 0, 0, W, H);
  else { const gr = g.createRadialGradient(W / 2, H * .35, 0, W / 2, H * .35, Math.hypot(W, H) * .6); gr.addColorStop(0, thC('#2a2110')); gr.addColorStop(1, thC('#07060c')); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  if (!L) return { cv, L, secs };
  const total = secs.reduce((t, a) => t + poWho(a).length, 0), cx = W / 2, inner = P.w - 2 * L.m;
  const pad = L.extra / (secs.length + 1);   // 多出来的高度平均分给上下和段与段之间
  let y = L.m, k = 0;

  // 抬头（分段版式、没关掉时）：学校 Logo + 活动名称（开头是年份就分两行）+ 英文名 + 分隔线，在抬头的高度里置中
  if (L.hh) {
    const hh = L.hh, logo = await exLoadLogo(), tl = poHeadLines(P), sub = P.title.trim() ? '' : String(draft?.event?.subtitle || '').trim();   // 自定义标题不加英文名
    let lh = PO.logoHead && logo?.naturalWidth ? hh * .34 : 0, tfs = hh * .17, efs = hh * .055;
    let used = lh + (lh ? hh * .06 : 0) + tl.length * tfs * 1.12 + (sub ? efs * 2 : 0) + hh * .08;
    if (used > hh * .96) { const k = hh * .96 / used; lh *= k; tfs *= k; efs *= k; used *= k; }   // 标题行数多：整块缩小放进抬头
    let hy = y + Math.max(0, (hh - used) / 2);
    if (lh) { const lw = lh * logo.naturalWidth / logo.naturalHeight; g.drawImage(logo, cx - D(lw) / 2, D(hy), D(lw), D(lh)); hy += lh + hh * .06; }
    tl.forEach(t => { poBigText(g, t, cx, D(hy + tfs * .92), D(tfs), tfam, D(inner * .96)); hy += tfs * 1.12; });
    if (sub) { poSmallText(g, sub, cx, D(hy + efs * 1.25), D(efs), tfam, D(inner * .96)); hy += efs * 2; }
    poRule(g, cx, D(hy + hh * .04), D(inner * .7), D(hh * .012));
    y += hh;
  }
  y += pad;

  for (const s of L.parts) {
    // 底框（分段版式）：半透明深色 + 金色细边
    if (L.panel) {
      g.save(); poRound(g, D(L.m), D(y), D(inner), D(s.h), D(L.cw * .08));
      g.fillStyle = `rgba(10,6,0,${PO.panelA / 100})`; g.fill();
      g.lineWidth = D(L.cw * .012); g.strokeStyle = thC('rgba(217,178,95,.8)'); g.stroke(); g.restore();
      y += L.pp;
    }
    s.lines.forEach((t, li) => poBigText(g, t, cx, D(y + s.fs * .15 + s.fs * 1.18 * li + s.fs * .95), D(s.fs), tfam));
    if (s.en) {
      const ey = y + s.lines.length * s.fs * 1.18 + s.fs * .15;
      poSmallText(g, s.en.toUpperCase(), cx, D(ey + s.efs * .95), D(s.efs), tfam, D((inner - 2 * L.pp) * .9));
      poRule(g, cx, D(ey + s.efs * 1.55), D(Math.min(inner * .5, s.fs * 4)), D(s.efs * .07));
    }
    y += s.th;
    // 卡片：每排置中（最后一排人少时也在中间）
    const who = poWho(s.a), n = who.length;
    for (let r = 0; r < s.rows; r++) {
      const inRow = Math.min(L.cols, n - r * L.cols), rowW = inRow * L.cw + (inRow - 1) * L.gx, x0 = (P.w - rowW) / 2;
      for (let c2 = 0; c2 < inRow; c2++) {
        const w = who[r * L.cols + c2];
        const im = await card(s.a, w, L.cw * dpi);
        const x = D(x0 + c2 * (L.cw + L.gx)), yy = D(y + r * (L.ch + L.gy));
        g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = D(L.cw * .015); g.shadowOffsetY = D(L.cw * .006);
        g.drawImage(im, x, yy, D(L.cw), D(L.ch)); g.restore();
        if (L.panel) { g.save(); g.lineWidth = D(L.cw * .006); g.strokeStyle = thC('rgba(217,178,95,.55)'); g.strokeRect(x, yy, D(L.cw), D(L.ch)); g.restore(); }
        progress?.(++k, total);
      }
    }
    y += s.h - s.th - L.pp + L.sg + pad;
  }

  // 页脚（分段版式）：日期 · 时间 · 地点，贴着海报底边
  if (L.panel && L.foot) {
    const fy = P.h - L.m - L.hf;
    poRule(g, cx, D(fy + L.hf * .15), D(inner * .5), D(L.hf * .02));
    poSmallText(g, L.foot, cx, D(fy + L.hf * .72), D(L.hf * .36), tfam, D(inner * .94), .06);
  }
  return { cv, L, secs };
}
// 卡片：跟图片导出同一份设计，但固定 16:9，大小跟海报上的卡片差不多（太小不清楚、太大浪费）
async function poCard(a, w, px, fam) {
  const rw = Math.max(640, Math.min(3840, Math.round(px))), keep = EXS;
  EXS = { ...EXS, size: `${rw}x${Math.round(rw * 9 / 16)}`, logoOn: EXS.logoOn && PO.logoCard, idSide: PO.idSide };   // idSide：学生证照片横排（export.js 的 exIdSide）   // 卡片 Logo：图片导出设计开着、海报也开着才画
  try { return await exRender(exCardAward(a, w, true), w, fam); } finally { EXS = keep; }   // 海报上都是得主：奖项名去掉「候选人」
}

/* ---- 预览、导出 ---- */
function poPreviewSoon(ms = 400) { clearTimeout(poPvT); poPvT = setTimeout(() => poPreview().catch(e => toast('预览失败：' + e.message, true)), ms); }
async function poPreview() {
  if ($('poster').classList.contains('hidden')) return;
  const P = poCur(), box = $('poPvBox'), dpi = Math.max(4, Math.min(40, (box.clientWidth || 900) / P.w, 1100 / P.h));
  const fam = await exUseFonts();
  const { cv, L, secs } = await poDraw(P, dpi, async (a, w) => {
    const key = `${a.id}|${a.winners.indexOf(w)}|${w.photo || ''}|${w.name}`;
    if (!poCards.has(key)) poCards.set(key, await poCard(a, w, 640, fam));
    return poCards.get(key);
  });
  const pv = $('poPv'); pv.width = cv.width; pv.height = cv.height; pv.getContext('2d').drawImage(cv, 0, 0);
  const n = secs.reduce((t, a) => t + poWho(a).length, 0);
  $('poPvCap').textContent = !secs.length ? '左边勾选要放进这张海报的奖项'
    : !L ? `放不下：${n} 张卡片太多，换大一点的尺寸或分成两张海报`
    : `${P.w} × ${P.h} 英寸 · ${secs.length} 个奖项 · ${n} 张卡片 · 每排 ${L.cols} 张 · 卡片 ${L.cw.toFixed(2)} × ${L.ch.toFixed(2)} 英寸 · 导出 ${Math.round(P.w * PO.dpi)} × ${Math.round(P.h * PO.dpi)} 像素`;
}
async function poExport(kind) {
  if (poBusy) return;
  const P = poCur(), secs = poSecs(P);
  if (!secs.length) return toast('这张海报还没选奖项', true);
  poBusy = true; const btns = [$('bPoJpg'), $('bPoPdf')]; btns.forEach(b => (b.disabled = true));
  try {
    const fam = await exUseFonts();
    const { cv, L } = await poDraw(P, PO.dpi, (a, w, px) => poCard(a, w, px, fam), (k, n) => { $('poProg').textContent = `生成中 ${k}/${n}…`; });
    if (!L) throw new Error('放不下，换大一点的尺寸或分成两张海报');
    $('poProg').textContent = '压缩中…';
    const blob = await new Promise((ok, bad) => cv.toBlob(b => (b ? ok(b) : bad(new Error('图片太大，浏览器压缩失败：把分辨率调低'))), 'image/jpeg', .92));
    const base = `${safeFile(draft.event.title)}-海报-${safeFile(P.name)}`;
    const out = kind === 'pdf' ? await ebPdf([{ blob, w: cv.width, h: cv.height }], `${draft.event.title} ${P.name}`, P.w * 72, P.h * 72) : blob;
    const url = URL.createObjectURL(out), link = el('a', { href: url, download: `${base}.${kind === 'pdf' ? 'pdf' : 'jpg'}`, style: 'display:none' });
    document.body.append(link); link.click(); setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 60000);
    $('poProg').textContent = `完成：${cv.width}×${cv.height}，${mb(out.size)}`;
    toast('海报已导出'); log(`海报导出「${P.name}」${kind.toUpperCase()}（${mb(out.size)}）`);
  } catch (e) { toast('导出失败：' + e.message, true); $('poProg').textContent = ''; }
  finally { poBusy = false; btns.forEach(b => (b.disabled = false)); }
}
$('bPoJpg').onclick = () => poExport('jpg');
$('bPoPdf').onclick = () => poExport('pdf');
$('bPoPv').onclick = () => { poCards.clear(); poPreviewSoon(0); };
