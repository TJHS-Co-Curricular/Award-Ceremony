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
  dpi: 150, titleOn: true, color: '#ffc000', titleK: 100, font: '', cur: 0,
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
    heads: Object.fromEntries(Object.entries(p?.heads && typeof p.heads === 'object' ? p.heads : {}).map(([k, t]) => [String(k), String(t || '').slice(0, 200)]).filter(([, t]) => t.trim()))
  }));
  if (!posters.length) posters.push(d.posters[0]);
  return {
    dpi: [100, 150, 200].includes(+v?.dpi) ? +v.dpi : d.dpi,
    color: /^#[0-9a-f]{6}$/i.test(v?.color || '') ? v.color : d.color,
    titleOn: v?.titleOn !== false, titleK: num(v?.titleK, 40, 200, d.titleK), font: String(v?.font || '').slice(0, 120),
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
const poWho = a => (a.revealMode === 'nominee' && a.winners.some(w => w.win) ? a.winners.filter(w => w.win) : a.winners);

/* ---- 表单 ---- */
function poBuild() {
  $('po_titleOn').checked = PO.titleOn; for (const id of ['po_color', 'po_titleK', 'po_font']) $(id).disabled = !PO.titleOn;
  $('po_dpi').value = String(PO.dpi); $('po_color').value = PO.color; $('po_titleK').value = PO.titleK; $('po_titleKV').textContent = PO.titleK + '%'; $('po_font').value = PO.font;
  $('poBgInfo').textContent = poBg ? '已上传' : '没有（用深色渐层）'; $('bPoBgDel').disabled = !poBg;
  $('poPick').replaceChildren(...PO.posters.map((p, i) => el('option', { value: String(i) }, `${i + 1}. ${p.name}（${p.w}×${p.h}）`)));
  $('poPick').value = String(PO.cur);
  const P = poCur();
  $('po_name').value = P.name;
  const key = `${P.w}x${P.h}`;
  $('po_size').value = PO_SIZES.some(s => s[0] === key) ? key : 'custom';
  $('po_w').value = P.w; $('po_h').value = P.h;
  const awards = poAwards(), sel = poSecs(P);
  $('poAwards').replaceChildren(...(awards.length ? awards.map(a => {
    const on = P.ids.includes(a.id), i = sel.indexOf(a);
    const row = el('div', { class: 'poa' + (on ? ' on' : '') },
      el('label', {}, el('input', { type: 'checkbox', ...(on ? { checked: '' } : {}), onchange: e => poToggle(a.id, e.target.checked) }),
        el('span', {}, [a.section, a.group].filter(Boolean).join(' · ') + (a.group || a.section ? ' · ' : ''), el('b', {}, a.title)), el('span', { class: 'muted' }, poWho(a).length < a.winners.length ? `（得主 ${poWho(a).length} / 入围 ${a.winners.length}）` : `（${a.winners.length}）`)));
    if (on && PO.titleOn) row.append(el('textarea', { rows: '2', placeholder: '标题（留空 = ' + poAutoHead(sel, i).replace('\n', ' / ') + '）', oninput: e => { const t = e.target.value, hs = poCur().heads; if (t.trim()) hs[a.id] = t; else delete hs[a.id]; poChanged(); } }, P.heads[a.id] || ''));
    return row;
  }) : [el('p', { class: 'muted' }, '还没有得奖者')]));
}
function poToggle(id, on) {
  const P = poCur();
  if (on && !P.ids.includes(id)) P.ids.push(id);
  if (!on) { P.ids = P.ids.filter(x => x !== id); delete P.heads[id]; }
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
$('po_titleOn').onchange = () => { PO.titleOn = $('po_titleOn').checked; poChanged(); poBuild(); };
$('po_color').oninput = () => { PO.color = $('po_color').value; poChanged(); };
$('po_titleK').oninput = () => { PO.titleK = +$('po_titleK').value; $('po_titleKV').textContent = PO.titleK + '%'; poChanged(); };
$('po_font').onchange = () => { PO.font = $('po_font').value.trim(); poChanged(); };
$('po_name').oninput = () => { poCur().name = $('po_name').value || '海报'; poChanged(); $('poPick').options[PO.cur].textContent = `${PO.cur + 1}. ${poCur().name}（${poCur().w}×${poCur().h}）`; };
$('po_size').onchange = () => { const v = $('po_size').value; if (v !== 'custom') { const [w, h] = v.split('x').map(Number); Object.assign(poCur(), { w, h }); } poChanged(); poBuild(); };
for (const id of ['po_w', 'po_h']) $(id).onchange = () => { Object.assign(poCur(), { w: +$('po_w').value, h: +$('po_h').value }); poChanged(); poBuild(); };
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
// 卡片由大到小试：每段 = 标题 + ceil(人数 / 列数) 排卡片，全部放得下的最大卡片就是答案；列数所有段一样
function poLayout(P, secs, fam) {
  const g = el('canvas').getContext('2d'), heads = secs.map((_, i) => (PO.titleOn ? poHead(P, secs, i) : []));   // 不要标题（图片导出的卡片上已经有奖项名）：每段只有卡片
  const widest = heads.map(ls => Math.max(1, ...ls.map(t => { g.font = `700 100px ${fam}`; return g.measureText(t).width / 100; })));   // 每 1 单位字号的宽度
  for (let cw = Math.min(P.w, P.h * 1.6); cw > 0.4; cw *= 0.99) {
    const ch = cw * 9 / 16, gx = cw * .1, gy = cw * .065, m = cw * .09, sg = cw * .14, inner = P.w - 2 * m;
    if (cw > inner) continue;
    const cols = Math.max(1, Math.floor((inner + gx) / (cw + gx)));
    let total = 2 * m + Math.max(0, secs.length - 1) * sg;
    const fs = Math.min(cw * .42 * PO.titleK / 100, ...widest.map(x => inner * .96 / x));   // 同一张海报的标题一样大（照最长的那个）
    const parts = secs.map((a, i) => {
      const th = heads[i].length ? heads[i].length * fs * 1.18 + fs * .3 : 0;
      const rows = Math.ceil(poWho(a).length / cols);
      const h = th + rows * ch + (rows - 1) * gy;
      total += h;
      return { a, lines: heads[i], fs, th, rows, h };
    });
    if (total <= P.h) return { cw, ch, gx, gy, m, sg, cols, parts, extra: P.h - total };
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
// 画一张海报：dpi = 每英寸像素；card(a, w, px) → 卡片 canvas；progress(k, n)
async function poDraw(P, dpi, card, progress) {
  const secs = poSecs(P), tfam = await poTitleFam(), L = poLayout(P, secs, tfam);
  const W = Math.round(P.w * dpi), H = Math.round(P.h * dpi);
  const cv = el('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
  const bg = await poLoadBg();
  if (bg) exCover(g, bg, 0, 0, W, H);
  else { const gr = g.createRadialGradient(W / 2, H * .35, 0, W / 2, H * .35, Math.hypot(W, H) * .6); gr.addColorStop(0, thC('#2a2110')); gr.addColorStop(1, thC('#07060c')); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  if (!L) return { cv, L, secs };
  const total = secs.reduce((t, a) => t + poWho(a).length, 0);
  const pad = L.extra / (secs.length + 1);   // 多出来的高度平均分给上下和段与段之间
  let y = L.m + pad, k = 0;
  const c = PO.color, lift = (hex, f) => '#' + [1, 3, 5].map(i => Math.round(Math.min(255, parseInt(hex.slice(i, i + 2), 16) * f + (f > 1 ? 20 : 0))).toString(16).padStart(2, '0')).join('');
  for (const s of L.parts) {
    // 标题：金色渐层字 + 深色描边、阴影（例子海报的样子）
    const fs = s.fs * dpi; g.font = `700 ${fs}px ${tfam}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    s.lines.forEach((t, li) => {
      const by = (y + s.fs * .15 + s.fs * 1.18 * li + s.fs * .95) * dpi;
      const gr = g.createLinearGradient(0, by - fs * .85, 0, by + fs * .1); gr.addColorStop(0, lift(c, 1.25)); gr.addColorStop(1, lift(c, .82));
      g.save();
      g.shadowColor = 'rgba(40,20,0,.55)'; g.shadowBlur = fs * .06; g.shadowOffsetX = g.shadowOffsetY = fs * .035;
      g.lineJoin = 'round'; g.lineWidth = fs * .045; g.strokeStyle = 'rgba(70,35,0,.85)'; g.strokeText(t, W / 2, by);
      g.shadowColor = 'transparent'; g.fillStyle = gr; g.fillText(t, W / 2, by);
      g.restore();
    });
    y += s.th;
    // 卡片：每排置中（最后一排人少时也在中间）
    const who = poWho(s.a), n = who.length;
    for (let r = 0; r < s.rows; r++) {
      const inRow = Math.min(L.cols, n - r * L.cols), rowW = inRow * L.cw + (inRow - 1) * L.gx, x0 = (P.w - rowW) / 2;
      for (let c2 = 0; c2 < inRow; c2++) {
        const w = who[r * L.cols + c2];
        const im = await card(s.a, w, L.cw * dpi);
        const x = (x0 + c2 * (L.cw + L.gx)) * dpi, yy = (y + r * (L.ch + L.gy)) * dpi;
        g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = L.cw * dpi * .015; g.shadowOffsetY = L.cw * dpi * .006;
        g.drawImage(im, x, yy, L.cw * dpi, L.ch * dpi); g.restore();
        progress?.(++k, total);
      }
    }
    y += s.h - s.th + L.sg + pad;
  }
  return { cv, L, secs };
}
// 卡片：跟图片导出同一份设计，但固定 16:9，大小跟海报上的卡片差不多（太小不清楚、太大浪费）
async function poCard(a, w, px, fam) {
  const rw = Math.max(640, Math.min(3840, Math.round(px))), keep = EXS;
  EXS = { ...EXS, size: `${rw}x${Math.round(rw * 9 / 16)}` };
  try { return await exRender(a, w, fam); } finally { EXS = keep; }
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
