/*
 * 控制端 · 导出电子书（A4 纪念特刊，像毕业特刊）：
 *   封面 → 前言（可多页）→ 目录（有页码）→ 活动照片集锦 → 大类分隔页 → 分类标题 + 奖项（每页最多 6 位，2 × 3；只有 1 位就放大）→ 编委 / 鸣谢 → 附录（例：表扬办法）
 * 每页用 canvas 画成 A4（1654 × 2339，约 200 dpi）JPG，全部嵌进同一个 .html：双击用浏览器打开就能翻书，
 * 电脑上两页摊开、手机上一页一页翻；「打印 / 存成 PDF」每页刚好一张 A4。用户定（2026-11-21）：一页 6 位、米白底、要集锦和编委 / 鸣谢、要能打印。
 * 「导出 PDF」= 同一套页面直接组成 PDF（ebPdf()，每页一张 A4 JPG），给 Google Drive / Sites、印刷店用。
 * 设置（封面副标题、印不印学号、前言、集锦照片文件名、编委、鸣谢）存在服务端 data/ebook.json（GET / PUT /api/control/ebook）。
 * 全部在浏览器里完成；导出的文件只下载到这台电脑。
 * 提供：ebTabOpen()（ui.js 切到「电子书」分页时调用）、ebOpen()、ebExport(kind)、ebPreview()、ebPdf()
 * 需要：export.js（exUseFonts、exAwards、exLoad、exLoadLogo、exText、exFont、exWrap、exCover、safeFile、exEnsure、EX_TITLE、EX_TEXT）、
 *       shared/idphoto.js（isIdPhoto）、import.js（socOf）、core.js
 */
'use strict';

const EB_PW = 1654, EB_PH = 2339, EB_Q = .85;              // A4（210 × 297 mm）约 200 dpi；JPG 质量
const EB_MX = 150, EB_MT = 160, EB_MB = 190;              // 左右、上、下边距（下面放页码）
const EB_CW = EB_PW - EB_MX * 2, EB_AVAIL = EB_PH - EB_MT - EB_MB;
const EB_C0 = { paper: '#fbf8f1', ink: '#2b241a', gold: '#a8823a', gold2: '#d2b067', muted: '#7d725c', line: '#e0d3b2', box: '#efe8d8' };
const EB_C = { ...EB_C0 };   // 按主题颜色转过的 EB_C0（ebPrepare() 里 ebTheme() 更新；默认金色 = EB_C0）
function ebTheme() { for (const k in EB_C0) EB_C[k] = thC(EB_C0[k]); }
// 版面高度（像素）：分类标题、奖项标题、一排两位、只有一位的大卡
const EB_GROUP_H = 230, EB_AWARD_H = 150, EB_GAP = 45;
const EB_CELL_W = (EB_CW - 40) / 2, EB_CELL_PH = EB_CELL_W / 1.5, EB_CAP = 125;
const EB_ROW_H = EB_CELL_PH + EB_CAP + EB_GAP;
const EB_BIG_W = EB_CW * .72, EB_BIG_PH = EB_BIG_W / 1.5, EB_BIG_H = EB_BIG_PH + EB_CAP + 10 + EB_GAP;
const EB_NOTE_PH = EB_BIG_W * 9 / 16, EB_NOTE_H = EB_BIG_PH + 30 + EB_NOTE_PH + EB_CAP + 10 + EB_GAP;   // 照片 + 备注图片（16:9 框，完整显示）
// 备注只写一个图片文件名 = 备注图片（规则同服务端 lib/views.js 的 NOTE_PIC）
const ebNotePic = w => { const d = (w.detail || '').trim(); return /^[^\n/\\]+\.(jpe?g|png|webp)$/i.test(d) ? d : ''; };
const EB_TOC_LH = 58, EB_TOC_HEAD = 260;                   // 目录每行高度、标题区高度
const EB_GAL_FIRST = 6, EB_GAL_N = 8;                      // 集锦第一页 6 张（上面有标题），之后每页 8 张
// 幕后花絮（用户定 2026-11-21）：拍立得样式（白框 + 下面一行说明，微微歪一点），每页 2 × 3 = 6 张
const EB_BTS_PAD = 18, EB_BTS_W = EB_CELL_W - 30, EB_BTS_PH = (EB_CELL_W - 30 - EB_BTS_PAD * 2) / 1.5, EB_BTS_CAP = 96;
const EB_BTS_H = EB_BTS_PAD + EB_BTS_PH + EB_BTS_CAP, EB_BTS_GAP = 40, EB_BTS_N = 6;

/* ---- 设置（data/ebook.json） ---- */
const EB_DEF = () => ({ coverSub: '颁奖纪念特刊', coverYear: true, showSid: false, topFirst: true, prefaceTitle: '前言', preface: '', prefaceBy: '', prefacePhoto: '',
  galleryTitle: '活动剪影', gallery: [], btsTitle: '幕后花絮', bts: [], editors: '', thanks: '', appendixTitle: '', appendixSub: '', appendix: '' });
function ebClean(v) {
  const d = EB_DEF(), s = (x, n, def) => (typeof x === 'string' ? x.slice(0, n) : def);
  return {
    coverSub: s(v?.coverSub, 40, d.coverSub), coverYear: v?.coverYear !== false, showSid: !!v?.showSid, topFirst: v?.topFirst !== false,
    prefaceTitle: s(v?.prefaceTitle, 30, d.prefaceTitle), preface: s(v?.preface, 8000, ''), prefaceBy: s(v?.prefaceBy, 60, ''), prefacePhoto: s(v?.prefacePhoto, 120, '').trim(),
    galleryTitle: s(v?.galleryTitle, 30, d.galleryTitle),
    gallery: (Array.isArray(v?.gallery) ? v.gallery : []).map(x => String(x || '').trim().slice(0, 120)).filter(Boolean).slice(0, 200),
    btsTitle: s(v?.btsTitle, 30, d.btsTitle),
    bts: (Array.isArray(v?.bts) ? v.bts : []).map(x => String(x || '').trim().slice(0, 200)).filter(Boolean).slice(0, 200),
    editors: s(v?.editors, 4000, ''), thanks: s(v?.thanks, 4000, ''),
    appendixTitle: s(v?.appendixTitle, 60, ''), appendixSub: s(v?.appendixSub, 120, ''), appendix: s(v?.appendix, 12000, '')
  };
}
let EB = EB_DEF(), ebLoaded = false, ebSaveT = 0;
async function ebOpen() {   // 读设置、填表单
  if (!ebLoaded) { try { EB = ebClean((await api('GET', '/api/control/ebook')).ebook); } catch { EB = EB_DEF(); } ebLoaded = true; }
  $('eb_coverSub').value = EB.coverSub; $('eb_coverYear').checked = EB.coverYear; $('eb_showSid').checked = EB.showSid; $('eb_topFirst').checked = EB.topFirst; $('eb_galleryTitle').value = EB.galleryTitle;
  $('eb_appendixTitle').value = EB.appendixTitle; $('eb_appendixSub').value = EB.appendixSub; $('eb_appendix').value = EB.appendix;
  $('eb_prefaceTitle').value = EB.prefaceTitle; $('eb_preface').value = EB.preface; $('eb_prefaceBy').value = EB.prefaceBy; $('eb_prefacePhoto').value = EB.prefacePhoto;
  $('eb_btsTitle').value = EB.btsTitle; $('eb_bts').value = EB.bts.join('\n');
  $('eb_gallery').value = EB.gallery.join('\n'); $('eb_editors').value = EB.editors; $('eb_thanks').value = EB.thanks;
  ebGalleryInfo();
}
function ebChanged() {
  EB = ebClean({ coverSub: $('eb_coverSub').value, coverYear: $('eb_coverYear').checked, showSid: $('eb_showSid').checked, topFirst: $('eb_topFirst').checked, galleryTitle: $('eb_galleryTitle').value,
    appendixTitle: $('eb_appendixTitle').value, appendixSub: $('eb_appendixSub').value, appendix: $('eb_appendix').value,
    prefaceTitle: $('eb_prefaceTitle').value, preface: $('eb_preface').value, prefaceBy: $('eb_prefaceBy').value, prefacePhoto: $('eb_prefacePhoto').value,
    gallery: $('eb_gallery').value.split(/\r?\n/), btsTitle: $('eb_btsTitle').value, bts: $('eb_bts').value.split(/\r?\n/), editors: $('eb_editors').value, thanks: $('eb_thanks').value });
  $('ebSaveState').textContent = '● 未保存'; ebRepaint();
  clearTimeout(ebSaveT); ebSaveT = setTimeout(async () => {
    try { await api('PUT', '/api/control/ebook', EB); $('ebSaveState').textContent = '已保存'; ebGalleryInfo(); }
    catch (e) { $('ebSaveState').textContent = '保存失败：' + e.message; }
  }, 800);
}
for (const id of ['eb_coverSub', 'eb_galleryTitle', 'eb_gallery', 'eb_btsTitle', 'eb_bts', 'eb_editors', 'eb_thanks', 'eb_prefaceTitle', 'eb_preface', 'eb_prefaceBy', 'eb_prefacePhoto', 'eb_appendixTitle', 'eb_appendixSub', 'eb_appendix']) $(id).oninput = ebChanged;
$('eb_showSid').onchange = ebChanged; $('eb_topFirst').onchange = ebChanged; $('eb_coverYear').onchange = ebChanged;
// 花絮一行：「文件名 | 说明」（说明可以不写；全角「｜」也可以）
function ebBtsLine(line) { const i = line.search(/[|｜]/); return i < 0 ? { file: line.trim(), cap: '' } : { file: line.slice(0, i).trim(), cap: line.slice(i + 1).trim() }; }
async function ebGalleryInfo() {   // 集锦、花絮、前言照片找不找得到
  const bts = EB.bts.map(l => ebBtsLine(l).file).filter(Boolean);
  const box = $('ebGalleryInfo'), names = [...EB.gallery, ...bts, ...(EB.prefacePhoto ? [EB.prefacePhoto] : [])];
  if (!names.length) { box.textContent = '没填 = 不放集锦 / 花絮'; return; }
  try {
    const miss = (await api('POST', '/api/control/photo-check', { names })).missing;
    box.textContent = (EB.gallery.length ? `集锦 ${EB.gallery.length} 张` : '没有集锦') + '，' + (bts.length ? `花絮 ${bts.length} 张` : '没有花絮')
      + (miss.length ? `；找不到 ${miss.length} 张（会跳过）：${miss.join('、')}` : '；照片都找到了');
  } catch { box.textContent = ''; }
}

/* ---- 排版计划：先决定每一页放什么（不画），目录才知道页码 ---- */
const ebSt = (color, bold = true, spacing = 0) => ({ color, bold, italic: false, spacing });
// 直的照片（高 > 宽）单独一页；两张直的放同一页：左上一张、右下一张（用户定 2026-11-21）。
// 横的照片照旧两张一排。返回每一页放哪几张：[{ idx: [照片序号…], port: 是否直的 }]，顺序大致照原本的。
function ebIsPortrait(im) { return !!im && im.naturalHeight > im.naturalWidth * 1.05; }
function ebPhotoPages(imgs, firstCap, cap) {
  const pages = [], land = [], port = [];
  let landCap = 0;
  imgs.forEach((im, i) => {
    if (ebIsPortrait(im)) { port.push(i); if (port.length === 2) pages.push({ idx: port.splice(0), port: true }); }
    else {
      if (!land.length) landCap = pages.length ? cap : firstCap;
      land.push(i); if (land.length >= landCap) pages.push({ idx: land.splice(0), port: false });
    }
  });
  if (land.length) pages.push({ idx: land.splice(0), port: false });
  if (port.length) pages.push({ idx: port.splice(0), port: true });
  return pages.sort((a, b) => a.idx[0] - b.idx[0]);   // 按每页第一张照片的顺序排
}
// 直照片的位置：1 张 = 置中放大；2 张 = 左上 + 右下（各不超过半个版心宽，所以不会叠在一起）。
// ew / eh = 照片外面多出的框（拍立得的白边、说明）。返回框 { x, y, w, h } 和照片 { pw, ph }。
function ebPortBoxes(ars, top, H, ew = 0, eh = 0) {
  if (ars.length === 1) {
    let ph = H - eh - 20, pw = ph * ars[0];
    if (pw + ew > EB_CW * .82) { pw = EB_CW * .82 - ew; ph = pw / ars[0]; }
    const w = pw + ew, h = ph + eh;
    return [{ x: EB_MX + (EB_CW - w) / 2, y: top + (H - h) / 2, w, h, pw, ph }];
  }
  const maxW = (EB_CW - 60) / 2, maxH = H * .6;
  return ars.map((ar, i) => {
    let ph = maxH - eh, pw = ph * ar;
    if (pw + ew > maxW) { pw = maxW - ew; ph = pw / ar; }
    const w = pw + ew, h = ph + eh;
    return i ? { x: EB_MX + EB_CW - w, y: top + H - h, w, h, pw, ph } : { x: EB_MX, y: top, w, h, pw, ph };
  });
}
const ebAr = im => im.naturalWidth / im.naturalHeight;
function ebPlan(list, galSpec = [], prePages = [], apxPages = [], btsSpec = []) {
  const body = [], toc = [];
  let cur = null, used = 0, sec = null, grp = null, secNo = 0;
  const newPage = () => { cur = { k: 'flow', items: [] }; body.push(cur); used = 0; };
  const put = (it, h) => { cur.items.push({ ...it, y: used }); used += h; };
  for (const [i, a] of list.entries()) {
    if ((a.section || '') !== sec) {
      sec = a.section || ''; grp = null;
      if (sec) {   // 大类分隔页：列出里面的分类（没分类的奖项列奖项名）；「大类画面不列分类」任一奖项设了就算
        const items = []; let noList = false, noNum = false;
        for (let j = i; j < list.length && (list[j].section || '') === sec; j++) {
          const t = list[j].group || list[j].title; if (items[items.length - 1] !== t) items.push(t);
          noList = noList || !!list[j].sectionNoList; noNum = noNum || !!list[j].sectionNoNum;
        }
        secNo++;
        toc.push({ l: 0, t: sec, p: body.length });
        body.push({ k: 'section', a, items: noList ? [] : items, no: noNum ? '' : String(secNo).padStart(2, '0') });
        cur = null;
      }
    }
    if (a.group && a.group !== grp) {   // 新的分类：从新的一页开始
      if (!cur || cur.items.length) newPage();
      toc.push({ l: 1, t: a.group, p: body.length - 1 });
      put({ t: 'group', a }, EB_GROUP_H);
    }
    grp = a.group || null;
    // 备注写的是图片文件名的得奖者：单独一行，照片（合照）在上、备注图片在下（用户定 2026-11-21）；其余照旧两位一排
    const rows = [];
    if (a.winners.length === 1 && !ebNotePic(a.winners[0])) rows.push({ ws: a.winners, big: true, h: EB_BIG_H });
    else {
      let pair = [];
      const flush = () => { if (pair.length) rows.push({ ws: pair, h: EB_ROW_H }); pair = []; };
      for (const w of a.winners) {
        if (ebNotePic(w)) { flush(); rows.push({ ws: [w], big: true, note: true, h: EB_NOTE_H }); }
        else { pair.push(w); if (pair.length === 2) flush(); }
      }
      flush();
    }
    // 每个奖项从新的一页开始，不和别的奖项同一页（用户定 2026-11-21：杰出就杰出，不要混优秀）；
    // 只有分类标题可以和它的第一个奖项同一页。放不进一页的接着排、在下一页写「（续）」
    const total = rows.reduce((t, r) => t + r.h, EB_AWARD_H);
    const onlyGroup = cur && cur.items.every(x => x.t === 'group');
    if (!onlyGroup || used + (total <= EB_AVAIL ? total : EB_AWARD_H + rows[0].h) > EB_AVAIL) newPage();
    toc.push({ l: a.group ? 2 : 3, t: a.title, p: body.length - 1, n: a.winners.length });
    put({ t: 'award', a }, EB_AWARD_H);
    for (const r of rows) {
      if (used + r.h > EB_AVAIL) { newPage(); put({ t: 'award', a, cont: true }, EB_AWARD_H); }
      put({ t: 'row', a, ...r }, r.h);
    }
  }
  // 前面：封面、前言、目录、集锦；后面：编委 / 鸣谢
  const nPre = prePages.length;
  const galPages = galSpec.length, galleryN = galPages;
  const back = !!(EB.editors.trim() || EB.thanks.trim());
  const btsPages = btsSpec.length, btsN = btsPages;
  const nToc = toc.length + (nPre ? 1 : 0) + (galleryN ? 1 : 0) + (btsN ? 1 : 0) + (back ? 1 : 0) + (apxPages.length ? 1 : 0);
  const perFirst = Math.floor((EB_AVAIL - EB_TOC_HEAD) / EB_TOC_LH), per = Math.floor(EB_AVAIL / EB_TOC_LH);
  const tocPages = nToc <= perFirst ? 1 : 1 + Math.ceil((nToc - perFirst) / per);
  const off = 1 + nPre + tocPages + galPages;
  const entries = [
    ...(nPre ? [{ l: 0, t: EB.prefaceTitle || '前言', p: 1 }] : []),
    ...(galleryN ? [{ l: 0, t: EB.galleryTitle || '活动剪影', p: 1 + nPre + tocPages }] : []),
    ...toc.map(e => ({ ...e, p: e.p + off })),
    ...(btsN ? [{ l: 0, t: EB.btsTitle || '幕后花絮', p: off + body.length }] : []),
    ...(back ? [{ l: 0, t: EB.editors.trim() ? '编辑委员会' : '鸣谢', p: off + body.length + btsPages }] : []),
    ...(apxPages.length ? [{ l: 0, t: (EB.appendixTitle ? '附录：' + EB.appendixTitle : '附录'), p: off + body.length + btsPages + (back ? 1 : 0) }] : [])
  ];
  const pages = [{ k: 'cover' }, ...prePages];
  for (let t = 0, i = 0; t < tocPages; t++) { const n = t ? per : perFirst; pages.push({ k: 'toc', first: !t, rows: entries.slice(i, i + n) }); i += n; }
  galSpec.forEach((sp, g) => pages.push({ k: 'gallery', first: !g, ...sp }));
  pages.push(...body);
  btsSpec.forEach((sp, i) => pages.push({ k: 'bts', first: !i, ...sp }));   // 花絮放在奖项后面、编委前面
  if (back) pages.push({ k: 'back' });
  pages.push(...apxPages);   // 附录放在全书最后
  return { pages, toc: entries };
}
// 状态栏 / 目录用的页面说明
function ebCap(p) {
  if (p.k === 'cover') return '封面';
  if (p.k === 'toc') return '目录';
  if (p.k === 'preface') return EB.prefaceTitle || '前言';
  if (p.k === 'gallery') return EB.galleryTitle || '活动剪影';
  if (p.k === 'bts') return EB.btsTitle || '幕后花絮';
  if (p.k === 'back') return '编辑委员会 · 鸣谢';
  if (p.k === 'appendix') return (EB.appendixTitle ? '附录：' + EB.appendixTitle : '附录');
  if (p.k === 'section') return p.a.section;
  const aw = p.items.filter(x => x.t === 'award').map(x => x.a.title);
  return [...new Set(aw)].join(' · ');
}

/* ---- 画页面 ---- */
function ebPaper() {
  const cv = document.createElement('canvas'); cv.width = EB_PW; cv.height = EB_PH;
  const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.fillStyle = EB_C.paper; g.fillRect(0, 0, EB_PW, EB_PH);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  return { cv, g };
}
function ebFrame(g) {   // 封面、分隔页、封底的金色双线框
  g.strokeStyle = EB_C.gold2; g.lineWidth = 4; g.strokeRect(70, 70, EB_PW - 140, EB_PH - 140);
  g.strokeStyle = EB_C.line; g.lineWidth = 2; g.strokeRect(92, 92, EB_PW - 184, EB_PH - 184);
}
function ebRule(g, cx, y, w) {   // 中间深、两头淡出的金线
  const ln = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  ln.addColorStop(0, thC('rgba(168,130,58,0)')); ln.addColorStop(.5, EB_C.gold); ln.addColorStop(1, thC('rgba(168,130,58,0)'));
  g.fillStyle = ln; g.fillRect(cx - w / 2, y, w, 3);
}
function ebFoot(g, n, ev) {   // 页脚：页码 + 活动名称
  exText(g, `— ${n} —`, ebSt(EB_C.muted, false), EX_TEXT, 30, EB_PW / 2, EB_PH - 95, 400);
  if (ev.title) exText(g, ev.title, ebSt(EB_C.line, false, .05), EX_TEXT, 24, EB_PW / 2, EB_PH - 55, EB_CW);
}
function ebLines(g, text, st, fam, px, cx, y, maxW, gap = 1.25) {   // 多行置中，返回最后一行基线
  exFont(g, st, fam, px);
  let lines = exWrap(g, text, maxW);
  if (lines.length > 1) {   // 要分行时平均分（不让最后一行只剩一个字，例：「…竞赛 / 奖」→「2026年成果 / 汇报竞赛奖」）
    const n = lines.length; let t = g.measureText(text).width / n;
    for (let k = 0; k < 60 && t <= maxW; k++, t += px * .25) { const ls = ebWrapCJK(g, text, t, 0); if (ls.length <= n) { lines = ls; break; } }
  }
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  lines.forEach((ln, i) => { if (i) y += px * gap; exText(g, ln, st, fam, px, cx, y, maxW); });
  return y;
}
function ebGoldText(g, y, h) {
  const gr = g.createLinearGradient(0, y - h, 0, y); gr.addColorStop(0, thC('#c99d48')); gr.addColorStop(1, thC('#8c6a28')); return gr;
}
// 照片画进圆角框：cover = 裁切铺满；contain = 完整显示（团体照、学生证）
function ebPhoto(g, img, x, y, w, h, contain) {
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, 10); g.clip();
  g.fillStyle = EB_C.box; g.fillRect(x, y, w, h);
  if (img) {
    if (contain) { const k = Math.min(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k; g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); }
    else exCover(g, img, x, y, w, h);
  }
  g.restore();
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, 10); g.strokeStyle = EB_C.line; g.lineWidth = 2; g.stroke(); g.restore();
}

/* ---- 前言：一行 = 一段，每段开头空两格；中文按字换行、英文按单词换行，标点不放在行首；太长自动接下一页 ---- */
const EB_PRE_PX = 38, EB_PRE_LH = 74, EB_PRE_HEAD = 230, EB_PRE_PW = EB_CW * .7;
const EB_NOSTART = /^[，。、；：！？）」』》〉】”’,.;:!?)\]]/;
function ebWrapCJK(g, text, maxW, indent) {
  const toks = text.match(/[A-Za-z0-9@#%&_.'’\-\/:+]+|\s+|[^]/gu) || [], lines = [];
  let cur = '', avail = maxW - indent;
  for (const tok of toks) {
    if (!cur && /^\s+$/.test(tok)) continue;
    const t = cur + tok;
    if (cur && g.measureText(t.trimEnd()).width > avail) {
      if (!EB_NOSTART.test(tok)) { lines.push(cur.trimEnd()); cur = /^\s+$/.test(tok) ? '' : tok; avail = maxW; continue; }
      // 行末标点放不下：把它前面那一串标点连同一个字一起带到下一行（不让标点超出版心）
      const cs = [...cur]; let k = cs.length;
      while (k > 0 && EB_NOSTART.test(cs[k - 1])) k--;
      if (k > 1 && !/\s/.test(cs[k - 1])) { lines.push(cs.slice(0, k - 1).join('').trimEnd()); cur = cs.slice(k - 1).join('') + tok; avail = maxW; continue; }
    }
    cur = t;
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  // 最后一行只剩一个字（标点不算，例：「试」「合。」）：从上一行搬一个字（连同它后面的标点）下来，不留孤字
  const n = lines.length, last = n > 1 ? [...lines[n - 1]] : [];
  if (n > 1 && last.filter(c => !EB_NOSTART.test(c)).length === 1 && !EB_NOSTART.test(last[0])) {
    const prev = [...lines[n - 2]]; let k = prev.length;
    while (k > 0 && EB_NOSTART.test(prev[k - 1])) k--;
    if (k > 3 && /[㐀-鿿]/.test(prev[k - 1])) { lines[n - 1] = prev.slice(k - 1).join('') + last.join(''); lines[n - 2] = prev.slice(0, k - 1).join(''); }
  }
  return lines;
}
const EB_PRE_HEAD_RE = /^([一二三四五六七八九十]+、|[（(][一二三四五六七八九十]+[）)])/;
// 两端对齐画一行：多出来的空白平均分给每个字之间（中文书的排法）；差太多（> 半个字）就不拉开
function ebJustify(g, t, st, px, x, y, w) {
  exFont(g, st, EX_TEXT, px); g.fillStyle = st.color;
  const cs = [...t], nat = g.measureText(t).width, extra = cs.length > 1 ? (w - nat) / (cs.length - 1) : 0;
  if (extra <= 0 || extra > px * .5) { g.fillText(t, x, y); if ('letterSpacing' in g) g.letterSpacing = '0px'; return; }
  for (const c of cs) { g.fillText(c, x, y); x += g.measureText(c).width + extra; }
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}
function ebPrefaceLayout(img) {
  const paras = EB.preface.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!paras.length) return [];
  const g = document.createElement('canvas').getContext('2d');
  exFont(g, ebSt(EB_C.ink, false, .02), EX_TEXT, EB_PRE_PX);
  const ind = g.measureText('国国').width, items = [];
  paras.forEach((p, i) => {
    if (i) items.push({ gap: true, h: EB_PRE_LH * .45 });
    // 小标题：「一、」「（一）」开头，或短短一行（≤ 12 字）而且不以标点结尾 → 粗体、不空两格
    if (EB_PRE_HEAD_RE.test(p) || ([...p].length <= 12 && !/[，。；：！？、,.;:!?…]$/.test(p))) {
      exFont(g, ebSt(EB_C.ink, true, .02), EX_TEXT, EB_PRE_PX);
      const ls = ebWrapCJK(g, p, EB_CW, 0);
      exFont(g, ebSt(EB_C.ink, false, .02), EX_TEXT, EB_PRE_PX);
      ls.forEach(t => items.push({ t, x: 0, b: true, h: EB_PRE_LH }));
      return;
    }
    const ls = ebWrapCJK(g, p, EB_CW, ind);
    ls.forEach((t, j) => items.push({ t, x: j ? 0 : ind, h: EB_PRE_LH, j: j < ls.length - 1 }));   // j = 两端对齐（段落最后一行不对齐）
  });
  if (EB.prefaceBy.trim()) items.push({ gap: true, h: EB_PRE_LH * .6 }, { by: EB.prefaceBy.trim(), h: EB_PRE_LH });
  const pages = []; let cur = null, room = 0;
  for (const [i, it] of items.entries()) {
    // 小标题不单独留在页底：要连同下面至少两行正文放得下，否则整个移到下一页
    let need = it.h;
    if (it.b) for (let j = i + 1, got = 0; j < items.length && got < 2; j++) { need += items[j].h; if (items[j].t && !items[j].b) got++; }   // 连续几个小标题（「二、核心理念」+「肯定成就」）一起算
    if (!cur || need > room) {
      if (cur && it.gap) continue;   // 段落间距不带到下一页开头
      const first = !cur;
      cur = { k: 'preface', first, items: [] }; pages.push(cur);
      room = EB_AVAIL - (first ? EB_PRE_HEAD + (img ? EB_PRE_PW / 1.5 + 60 : 0) : 0);
      if (it.gap) continue;
    }
    cur.items.push(it); room -= it.h;
  }
  return pages;
}
function ebDrawPreface(p, n, ev, img) {
  const { cv, g } = ebPaper(); let y = EB_MT;
  if (p.first) {
    y += 100; exText(g, EB.prefaceTitle || '前言', ebSt(EB_C.ink, true, .4), EX_TITLE, 76, EB_PW / 2, y, EB_CW); ebRule(g, EB_PW / 2, y + 48, 360);
    y = EB_MT + EB_PRE_HEAD;
    if (img) { const h = EB_PRE_PW / 1.5; ebPhoto(g, img, (EB_PW - EB_PRE_PW) / 2, y, EB_PRE_PW, h, false); y += h + 60; }
  }
  for (const it of p.items) {
    if (it.t && it.j) { g.textAlign = 'left'; ebJustify(g, it.t, ebSt(EB_C.ink, false, .02), EB_PRE_PX, EB_MX + it.x, y + EB_PRE_PX, EB_CW - it.x); }
    else if (it.t) { g.textAlign = 'left'; exText(g, it.t, ebSt(EB_C.ink, !!it.b, .02), EX_TEXT, EB_PRE_PX, EB_MX + it.x, y + EB_PRE_PX, EB_CW - it.x + 4); }
    else if (it.by) { g.textAlign = 'right'; exText(g, it.by, ebSt(EB_C.muted, false, .04), EX_TEXT, EB_PRE_PX, EB_PW - EB_MX, y + EB_PRE_PX, EB_CW); }
    y += it.h;
  }
  g.textAlign = 'center'; ebFoot(g, n, ev);
  return cv;
}

/* ---- 附录（书的最后一页，例：表扬办法）：按行首的编号自动排版（用户定 2026-11-21）----
 * 「一、」大标题（金色竖条）；「（一）」小标题；「1.」条文（编号挂在左边）；「(1)」细项；「注：」以下放进米色备注框；
 * 一行好几个「1. 甲 2. 乙」排成一排标签。先试一栏（字号 34 → 26），放不下改两栏（30 → 22），还是放不下才分页。 */
const EB_APX_HEAD = 250;
const EB_CN_NUM = '[一二三四五六七八九十]+';
function ebApxParse(text) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean), out = [];
  const full = s => s.replace(/\(/g, '（').replace(/\)/g, '）');
  let note = false;
  while (lines.length) {
    const t = lines.shift(); let m;
    if ((m = t.match(new RegExp(`^(${EB_CN_NUM})\\s*[、．.]\\s*(.*)$`)))) { note = false; out.push({ k: 'h1', t: `${m[1]}、${m[2]}` }); }
    else if ((m = t.match(/^注\s*[:：]\s*(.*)$/))) { note = true; out.push({ k: 'noteHead', note }); if (m[1]) lines.unshift(m[1]); }
    else if ((m = t.match(new RegExp(`^[（(](${EB_CN_NUM})[)）]\\s*(.*)$`)))) out.push({ k: 'h2', mk: `（${m[1]}）`, t: m[2], note });
    else if ((m = t.match(/^([（(]\d+[)）])\s*(.*)$/))) out.push({ k: 'li2', mk: full(m[1]), t: m[2], note });
    else if (/^\d+\s*[.．、]/.test(t)) {
      const parts = t.split(/(?:^|\s+)\d+\s*[.．、]\s*/).filter(Boolean);
      if (parts.length >= 2 && parts.every(x => x.length <= 10 && !/[。；，]/.test(x))) out.push({ k: 'chips', items: parts, note });
      else { m = t.match(/^(\d+)\s*[.．、]\s*(.*)$/); out.push({ k: 'li', mk: m[1] + '.', t: m[2], note }); }
    } else out.push({ k: 'p', t, note });
  }
  return out;
}
// 排成一行一行（每行有高度和画法）；f = 正文字号
function ebApxRows(blocks, f, W) {
  const g = document.createElement('canvas').getContext('2d'), rows = [];
  const body = ebSt(EB_C.ink, false, .02), bold = ebSt(EB_C.ink, true, .02);
  const wrap = (t, st, px, maxW) => { exFont(g, st, EX_TEXT, px); const l = ebWrapCJK(g, t, maxW, 0); if ('letterSpacing' in g) g.letterSpacing = '0px'; return l; };
  const gap = h => rows.push({ h, gap: true });
  let inH2 = false, bid = 0;
  for (const b of blocks) {
    const n0 = rows.length; bid++;
    const nx = b.note ? f * 1.1 : 0, nw = b.note ? W - f * 2.2 : W, note = !!b.note;
    if (b.k === 'h1') {
      gap(f * .8); inH2 = false;
      rows.push({ h: f * 2.2, keep: true, draw: (g, X, y) => {
        g.fillStyle = EB_C.gold; g.fillRect(X, y + f * .45, f * .26, f * 1.3);
        g.textAlign = 'left'; exText(g, b.t, ebSt(EB_C.ink, true, .08), EX_TITLE, f * 1.25, X + f * .7, y + f * 1.55, W - f);
        g.fillStyle = EB_C.line; g.fillRect(X, y + f * 2.0, W, 2);
      } });
      gap(f * .35);
    } else if (b.k === 'noteHead') {
      gap(f * .7);
      rows.push({ h: f * 1.8, note, keep: true, draw: (g, X, y) => { g.textAlign = 'left'; exText(g, '注', ebSt(EB_C.gold, true, .1), EX_TITLE, f * 1.1, X + nx, y + f * 1.35, W); } });
    } else if (b.k === 'h2') {
      // 短的（像标题，例：「（一）最佳执委」）整行粗体；长的条文（有句号或超过 16 个字）编号金色、内文一般字体，换行对齐编号后面
      if (inH2) gap(f * .3);
      inH2 = true;
      const head = b.t.length <= 16 && !/[。；]/.test(b.t), px = head ? f * 1.05 : f, st = head ? bold : body;
      exFont(g, bold, EX_TEXT, px); const hang = g.measureText(b.mk).width + f * .2; if ('letterSpacing' in g) g.letterSpacing = '0px';
      wrap(b.t, st, px, nw - f * .3 - hang).forEach((ln, i) => rows.push({ h: f * (head ? 1.7 : 1.6), note, keep: head, draw: (g, X, y) => {
        g.textAlign = 'left';
        if (!i) exText(g, b.mk, ebSt(head ? EB_C.ink : EB_C.gold, true, .02), EX_TEXT, px, X + nx + f * .3, y + f * 1.25, hang);
        exText(g, ln, st, EX_TEXT, px, X + nx + f * .3 + hang, y + f * 1.25, nw);
      } }));
    } else if (b.k === 'li' || b.k === 'li2') {
      const x0 = nx + (b.k === 'li' ? (inH2 || b.note ? f * 1.6 : f * .3) : f * 3.3), hang = b.k === 'li' ? f * 1.5 : f * 2.1;
      wrap(b.t, body, f, nw - (x0 - nx) - hang).forEach((ln, i) => rows.push({ h: f * 1.6, note, draw: (g, X, y) => {
        g.textAlign = 'left';
        if (!i) exText(g, b.mk, ebSt(EB_C.gold, true), EX_TEXT, f, X + x0, y + f * 1.2, hang);
        exText(g, ln, body, EX_TEXT, f, X + x0 + hang, y + f * 1.2, W);
      } }));
    } else if (b.k === 'chips') {
      const x0 = nx + (inH2 || b.note ? f * 1.6 : f * .3), pad = f * .7, gp = f * .5;
      exFont(g, bold, EX_TEXT, f); const ws = b.items.map(t => g.measureText(t).width + pad * 2); if ('letterSpacing' in g) g.letterSpacing = '0px';
      let line = [], x = 0; const lines = [];
      ws.forEach((w, i) => { if (line.length && x + w > nw - (x0 - nx)) { lines.push(line); line = []; x = 0; } line.push([b.items[i], x, w]); x += w + gp; });
      if (line.length) lines.push(line);
      gap(f * .2);
      lines.forEach(ln => rows.push({ h: f * 2.1, note, draw: (g, X, y) => {
        for (const [t, cx, w] of ln) {
          g.save(); g.beginPath(); g.roundRect(X + x0 + cx, y + f * .2, w, f * 1.6, f * .8);
          g.fillStyle = thC('#f3e9d2'); g.fill(); g.strokeStyle = EB_C.gold2; g.lineWidth = 2; g.stroke(); g.restore();
          g.textAlign = 'center'; exText(g, t, bold, EX_TEXT, f, X + x0 + cx + w / 2, y + f * 1.32, w);
        }
      } }));
      gap(f * .2);
    } else {
      const x0 = nx + (inH2 ? f * 1.6 : 0);
      wrap(b.t, body, f, nw - (x0 - nx)).forEach(ln => rows.push({ h: f * 1.6, note, draw: (g, X, y) => { g.textAlign = 'left'; exText(g, ln, body, EX_TEXT, f, X + x0, y + f * 1.2, W); } }));
    }
    for (let i = n0; i < rows.length; i++) rows[i].bid = bid;
  }
  return rows;
}
// 把一行一行分进一栏一栏：一栏放不下就换下一栏；栏开头不放空白；标题不留在栏底（要和下一行在一起）
function ebApxCols(rows, firstH, h, nCols) {
  // 同一条条文（同一个 bid）的几行不拆开；标题（keep）要和下一条的第一行在一起
  const gh = {}; rows.forEach(r => { if (!r.gap) gh[r.bid] = (gh[r.bid] || 0) + r.h; });
  const cols = []; let cur = null, room = 0;
  const open = () => { cur = []; cols.push(cur); room = cols.length <= nCols ? firstH : h; };
  rows.forEach((r, i) => {
    const prev = rows[i - 1], first = !r.gap && (!prev || prev.gap || prev.bid !== r.bid);
    let need = first ? gh[r.bid] : r.h;
    if (first && r.keep) { const nx = rows.slice(i + 1).find(x => !x.gap && x.bid !== r.bid); if (nx) need += nx.h; }
    if (!cur || need > room) { if (cur && r.gap) return; if (!first && cur && r.h <= room) { cur.push(r); room -= r.h; return; } open(); if (r.gap) return; }
    cur.push(r); room -= r.h;
  });
  return cols;
}
const EB_APX_GUT = 70, EB_APX_COLW = (EB_CW - EB_APX_GUT) / 2;
function ebAppendixLayout() {
  if (!EB.appendix.trim()) return [];
  const blocks = ebApxParse(EB.appendix), first = EB_AVAIL - EB_APX_HEAD;
  const sum = rs => rs.reduce((t, r) => t + r.h, 0);
  // 1) 一栏、字号 34 → 26 放得进一页；2) 两栏、30 → 22 放得进一页；3) 还是放不下：两栏、26，分页
  for (let f = 34; f >= 26; f--) { const rows = ebApxRows(blocks, f, EB_CW); if (sum(rows) <= first) return [{ k: 'appendix', first: true, f, n: 1, cols: [rows] }]; }
  for (let f = 30; f >= 22; f--) {
    const cols = ebApxCols(ebApxRows(blocks, f, EB_APX_COLW), first, EB_AVAIL, 2);
    if (cols.length <= 2) return [{ k: 'appendix', first: true, f, n: 2, cols }];
  }
  const f = 26, cols = ebApxCols(ebApxRows(blocks, f, EB_APX_COLW), first, EB_AVAIL, 2), pages = [];
  for (let i = 0; i < cols.length; i += 2) pages.push({ k: 'appendix', first: !i, f, n: 2, cols: cols.slice(i, i + 2) });
  return pages;
}
function ebDrawAppendix(p, n, ev) {
  const { cv, g } = ebPaper(), f = p.f; let top = EB_MT;
  if (p.first) {
    const y = EB_MT + 95; exText(g, EB.appendixTitle || '附录', ebSt(EB_C.ink, true, .2), EX_TITLE, 68, EB_PW / 2, y, EB_CW);
    if (EB.appendixSub) exText(g, EB.appendixSub, ebSt(EB_C.muted, false, .06), EX_TEXT, 28, EB_PW / 2, y + 62, EB_CW);
    ebRule(g, EB_PW / 2, y + (EB.appendixSub ? 100 : 55), 420);
    top = EB_MT + EB_APX_HEAD - f * .8;   // 第一个大标题前面的空白不要那么多
  }
  const W = p.n === 2 ? EB_APX_COLW : EB_CW;
  p.cols.forEach((rows, ci) => {
    const X = EB_MX + ci * (W + EB_APX_GUT);
    // 备注框：连续的 note 行画一个米色底、左边金色竖线的框
    let yy = top, run = null; const boxes = [];
    for (const r of rows) { if (r.note && !r.gap) { if (!run) { run = [yy, yy]; boxes.push(run); } run[1] = yy + r.h; } else if (!r.gap) run = null; yy += r.h; }
    for (const [a, b] of boxes) {
      g.save(); g.beginPath(); g.roundRect(X, a - f * .3, W, b - a + f * .7, 12); g.fillStyle = thC('#f4ecda'); g.fill(); g.restore();
      g.fillStyle = EB_C.gold2; g.fillRect(X, a - f * .3 + 12, 6, b - a + f * .7 - 24);
    }
    let y = top;
    for (const r of rows) { if (r.draw) r.draw(g, X, y); y += r.h; }
  });
  if (p.n === 2 && p.cols.length > 1) { g.fillStyle = EB_C.line; g.fillRect(EB_MX + EB_APX_COLW + EB_APX_GUT / 2 - 1, top + f * .6, 2, EB_PH - EB_MB - top - f * .6); }   // 两栏中间的细线
  g.textAlign = 'center'; ebFoot(g, n, ev);
  return cv;
}

async function ebDrawCover(ev, logo) {
  const draw = (g, y0) => {
    const cx = EB_PW / 2; let y = y0;
    if (logo && logo.naturalWidth) { const lh = 330, lw = lh * logo.naturalWidth / logo.naturalHeight; g.drawImage(logo, cx - lw / 2, y, lw, lh); y += lh + 110; }
    const tp = 118, title = ev.title || '表扬大会';
    // 年份单独一行（用户定 2026-11-21）：活动名称开头是 4 位数年份（可带「年」）时，第一行年份、第二行其余
    const ym = EB.coverYear && title.match(EB_YEAR_RE);
    if (ym) {
      const yp = tp * 1.25;
      exText(g, ym[1] + (ym[2] || ''), ebSt(ebGoldText(g, y + yp, yp), true, .12), EX_TITLE, yp, cx, y + yp, EB_CW * .9);
      y = ebLines(g, ym[3].trim(), ebSt(ebGoldText(g, y + yp + tp * 1.3, tp)), EX_TITLE, tp, cx, y + yp + tp * 1.3, EB_CW * .9, 1.2);
    } else y = ebLines(g, title, ebSt(ebGoldText(g, y + tp, tp)), EX_TITLE, tp, cx, y + tp, EB_CW * .9, 1.2);
    if (ev.subtitle) y = ebLines(g, ev.subtitle, ebSt(EB_C.muted, false, .06), EX_TEXT, 44, cx, y + 90, EB_CW * .85);
    if (EB.coverSub) { y += 120; exText(g, EB.coverSub, ebSt(EB_C.ink, true, .3), EX_TITLE, 64, cx, y, EB_CW); }
    y += 80; ebRule(g, cx, y, 520);
    const info = [ev.date, ev.time, ev.venue].filter(Boolean).join(' · ');
    if (info) { y += 90; exText(g, info, ebSt(EB_C.muted, false, .04), EX_TEXT, 40, cx, y, EB_CW); }
    return y - y0;
  };
  const d = ebPaper(); const h = draw(d.g, 0);   // 先量高度，整块垂直置中
  const { cv, g } = ebPaper(); ebFrame(g); draw(g, Math.max(260, (EB_PH - h) / 2 - 60));
  return cv;
}
function ebDrawToc(p, n, ev) {
  const { cv, g } = ebPaper(); let y = EB_MT;
  if (p.first) { y += 110; exText(g, '目录', ebSt(EB_C.ink, true, .4), EX_TITLE, 84, EB_PW / 2, y, EB_CW); ebRule(g, EB_PW / 2, y + 50, 360); y = EB_MT + EB_TOC_HEAD; }
  for (const e of p.rows) {
    y += EB_TOC_LH;
    const ind = { 0: 0, 1: 40, 2: 90, 3: 40 }[e.l], px = e.l === 0 ? 40 : e.l === 1 ? 36 : 34;
    const st = ebSt(e.l === 0 ? EB_C.gold : EB_C.ink, e.l < 2, 0), x0 = EB_MX + ind, numW = 90;
    g.textAlign = 'left';
    const s = exText(g, e.t, st, e.l === 0 ? EX_TITLE : EX_TEXT, px, x0, y, EB_CW - ind - numW - 60);
    exFont(g, st, e.l === 0 ? EX_TITLE : EX_TEXT, s); const tw = g.measureText(e.t).width;
    g.textAlign = 'right'; exText(g, String(e.p + 1), ebSt(EB_C.muted, false), EX_TEXT, 32, EB_PW - EB_MX, y, numW);
    g.fillStyle = EB_C.line;   // 点线
    for (let x = x0 + tw + 22; x < EB_PW - EB_MX - numW + 10; x += 16) { g.beginPath(); g.arc(x, y - 8, 2.4, 0, Math.PI * 2); g.fill(); }
  }
  g.textAlign = 'center'; ebFoot(g, n, ev);
  return cv;
}
// 横照片自适应排版（用户定 2026-11-21）：试 1 栏、2 栏，选让每张最大的；整块垂直置中，最后一排不满就置中。
// 照片少（例：最后一页只剩 2 张）时自动放大，不会只占页面上方一小块。hExtra = 照片外面多的高度（拍立得的白边 + 说明）
function ebGrid(n, top, H, gap, hExtra = 0, wExtra = 0) {
  let best = null;
  for (const cols of [1, 2]) {
    if (cols > n) continue;
    const rows = Math.ceil(n / cols), hMax = (H - gap * (rows - 1)) / rows;
    let w = (EB_CW - gap * (cols - 1)) / cols;
    if ((w - wExtra) / 1.5 + hExtra > hMax) w = (hMax - hExtra) * 1.5 + wExtra;
    if (!best || w > best.w + 1) best = { cols, rows, w, h: (w - wExtra) / 1.5 + hExtra };
  }
  const { cols, rows, w, h } = best, y0 = top + (H - (rows * h + (rows - 1) * gap)) / 2;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols), m = Math.min(cols, n - r * cols), c = i - r * cols;
    const x0 = EB_MX + (EB_CW - (m * w + (m - 1) * gap)) / 2;
    return { x: x0 + c * (w + gap), y: y0 + r * (h + gap), w, h, pw: w - wExtra, ph: (w - wExtra) / 1.5 };
  });
}
function ebDrawGallery(p, n, ev, imgs) {
  const { cv, g } = ebPaper(); let y = EB_MT;
  if (p.first) { y += 100; exText(g, EB.galleryTitle || '活动剪影', ebSt(EB_C.ink, true, .3), EX_TITLE, 72, EB_PW / 2, y, EB_CW); ebRule(g, EB_PW / 2, y + 45, 360); y = EB_MT + 220; }
  const list = p.idx.map(i => imgs[i]);
  if (p.port) ebPortBoxes(list.map(ebAr), y, EB_PH - EB_MB - y).forEach((b, i) => ebPhoto(g, list[i], b.x, b.y, b.w, b.h, true));   // 直的：完整显示
  else ebGrid(list.length, y, EB_PH - EB_MB - y - 20, 40).forEach((b, i) => ebPhoto(g, list[i], b.x, b.y, b.w, b.h, false));
  ebFoot(g, n, ev);
  return cv;
}
// 一张拍立得：框中心 (cx, cy)、框宽高 fw × fh、照片高 ph，k = 往左 / 往右歪；contain = 照片完整显示（直的）
function ebPolaroid(g, it, cx, cy, fw, fh, ph, k, contain) {
  g.save(); g.translate(cx, cy); g.rotate(k * 1.2 * Math.PI / 180);
  const x0 = -fw / 2, y0 = -fh / 2, w = fw - EB_BTS_PAD * 2;
  g.shadowColor = thC('rgba(60,45,20,.22)'); g.shadowBlur = 22; g.shadowOffsetY = 8;
  g.fillStyle = thC('#fffdf8'); g.fillRect(x0, y0, fw, fh);
  g.shadowColor = 'transparent';
  ebPhoto(g, it.img, x0 + EB_BTS_PAD, y0 + EB_BTS_PAD, w, ph, contain);
  if (it.cap) {   // 说明：一行放得下用 30px；放不下换 26px 排两行（再多就截掉，加「…」）
    const st = ebSt(EB_C.muted, false, .04), top = y0 + EB_BTS_PAD + ph;
    exFont(g, st, EX_TEXT, 30); let ls = ebWrapCJK(g, it.cap, w, 0), px = 30;
    if (ls.length > 1) { px = 26; exFont(g, st, EX_TEXT, px); ls = ebWrapCJK(g, it.cap, w, 0); if (ls.length > 2) ls = [ls[0], [...ls[1]].slice(0, -1).join('') + '…']; }
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.textAlign = 'center';
    ls.forEach((t, j) => exText(g, t, st, EX_TEXT, px, 0, top + (ls.length > 1 ? 38 + j * 36 : 54), w));
  }
  g.restore();
}
// 幕后花絮：拍立得白框 + 说明，交错微微歪（±1.2°）；第一页上面有标题，横的每页 6 张，直的单独一页 / 两张左上右下
function ebDrawBts(p, n, ev, items) {
  const { cv, g } = ebPaper();
  let y = EB_MT + 10;
  if (p.first) { y += 90; exText(g, EB.btsTitle || '幕后花絮', ebSt(EB_C.ink, true, .3), EX_TITLE, 72, EB_PW / 2, y, EB_CW); ebRule(g, EB_PW / 2, y + 45, 360); y = EB_MT + 190; }
  const list = p.idx.map(i => items[i]);
  if (p.port) {   // 直的：拍立得框照照片比例，完整显示
    ebPortBoxes(list.map(it => ebAr(it.img)), y + 10, EB_PH - EB_MB - y - 30, EB_BTS_PAD * 2, EB_BTS_PAD + EB_BTS_CAP)
      .forEach((b, i) => ebPolaroid(g, list[i], b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, b.ph, i % 2 ? 1 : -1, true));
  } else {
    ebGrid(list.length, y + 10, EB_PH - EB_MB - y - 40, 70, EB_BTS_PAD + EB_BTS_CAP, EB_BTS_PAD * 2).forEach((b, i) => {
      const fw = Math.min(b.w, EB_CW * .9), sc = fw / b.w;   // 一栏时框别太宽
      ebPolaroid(g, list[i], b.x + b.w / 2, b.y + b.h / 2, fw, EB_BTS_PAD + b.ph * sc + EB_BTS_CAP, b.ph * sc, (Math.floor(i / 2) + i) % 2 ? 1 : -1, false);
    });
  }
  g.textAlign = 'center'; ebFoot(g, n, ev);
  return cv;
}
// 名称开头是年份（可带「年」「年度」）：拆成年份 + 其余（封面、大类页用；勾选「年份单独一行」才拆）
const EB_YEAR_RE = /^\s*(\d{4})\s*(年度|年)?\s*(\S[\s\S]*)$/;
function ebDrawSection(p, n, ev) {
  const { cv, g } = ebPaper(); ebFrame(g);
  const cx = EB_PW / 2, a = p.a, big = 120;
  const ym = EB.coverYear && a.section.match(EB_YEAR_RE), main = ym ? ym[3].trim() : a.section;   // 例：「2026年」一行、「成果汇报竞赛奖」一行（用户定 2026-11-21）
  exFont(g, ebSt(EB_C.ink), EX_TITLE, big); const nl = exWrap(g, main, EB_CW * .85).length + (ym ? 1 : 0);
  const h = (p.no ? 160 : 0) + big * (1 + (nl - 1) * 1.2) + (a.sectionSub ? 90 : 0) + 90 + p.items.length * 70;
  let y = Math.max(300, (EB_PH - h) / 2);
  if (p.no) { y += 110; exText(g, p.no, ebSt(EB_C.gold2, true, .1), EX_TEXT, 110, cx, y, EB_CW); y += 50; }
  if (ym) { exText(g, ym[1] + (ym[2] || ''), ebSt(ebGoldText(g, y + big, big)), EX_TITLE, big, cx, y + big, EB_CW * .85); y += big * 1.2; }
  y = ebLines(g, main, ebSt(ebGoldText(g, y + big, big)), EX_TITLE, big, cx, y + big, EB_CW * .85, 1.2);
  if (a.sectionSub) { y += 85; exText(g, a.sectionSub.toUpperCase(), ebSt(EB_C.muted, false, .15), EX_TEXT, 38, cx, y, EB_CW); }
  y += 70; ebRule(g, cx, y, 420); y += 30;
  for (const t of p.items) { y += 70; exText(g, t, ebSt(EB_C.ink, false, .05), EX_TEXT, 40, cx, y, EB_CW * .8); }
  return cv;
}
// 胸花（奖章花结）：两条金色飘带 + 一圈褶边花瓣 + 金色内圈；label 空 = 圆心是金扣、不写字
function ebRosette(g, cx, cy, r, label) {
  g.save();
  g.shadowColor = thC('rgba(60,40,10,.35)'); g.shadowBlur = r * .25; g.shadowOffsetY = r * .08;
  for (const k of [-1, 1]) {   // 飘带：从圆心往左下 / 右下垂，末端剪成燕尾
    const a = k * .32, L = r * 1.95, W = r * .5;
    g.save(); g.translate(cx, cy); g.rotate(a);
    const gr = g.createLinearGradient(-W / 2, 0, W / 2, 0); gr.addColorStop(0, thC('#8c6524')); gr.addColorStop(.5, thC('#c39a45')); gr.addColorStop(1, thC('#8c6524'));
    g.fillStyle = gr; g.beginPath(); g.moveTo(-W / 2, 0); g.lineTo(W / 2, 0); g.lineTo(W / 2, L); g.lineTo(0, L - W * .45); g.lineTo(-W / 2, L); g.closePath(); g.fill();
    g.restore();
  }
  const N = 28, gp = g.createRadialGradient(cx - r * .3, cy - r * .35, r * .1, cx, cy, r);
  gp.addColorStop(0, thC('#f3dc9a')); gp.addColorStop(.6, thC('#d2b067')); gp.addColorStop(1, thC('#a8823a'));
  g.fillStyle = gp; g.beginPath();   // 褶边：一圈小圆弧
  for (let i = 0; i < N; i++) { const t = i / N * Math.PI * 2; g.moveTo(cx + Math.cos(t) * r * .86 + r * .15, cy + Math.sin(t) * r * .86); g.arc(cx + Math.cos(t) * r * .86, cy + Math.sin(t) * r * .86, r * .15, 0, Math.PI * 2); }
  g.arc(cx, cy, r * .88, 0, Math.PI * 2); g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = thC('rgba(120,85,30,.35)'); g.lineWidth = 1.5;   // 褶痕
  for (let i = 0; i < N; i++) { const t = (i + .5) / N * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(t) * r * .62, cy + Math.sin(t) * r * .62); g.lineTo(cx + Math.cos(t) * r * .95, cy + Math.sin(t) * r * .95); g.stroke(); }
  const gi = g.createLinearGradient(cx, cy - r * .6, cx, cy + r * .6); gi.addColorStop(0, thC('#b8903f')); gi.addColorStop(1, thC('#8c6524'));
  g.fillStyle = gi; g.beginPath(); g.arc(cx, cy, r * .6, 0, Math.PI * 2); g.fill();
  if (label) { g.fillStyle = thC('#fffaf0'); g.beginPath(); g.arc(cx, cy, r * .5, 0, Math.PI * 2); g.fill(); }
  else {   // 不写字：圆心是有光泽的金扣
    const gc = g.createRadialGradient(cx - r * .18, cy - r * .2, r * .05, cx, cy, r * .5);
    gc.addColorStop(0, thC('#fbecc0')); gc.addColorStop(.55, thC('#d9b765')); gc.addColorStop(1, thC('#a37b32'));
    g.fillStyle = gc; g.beginPath(); g.arc(cx, cy, r * .5, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = label ? EB_C.gold2 : thC('rgba(255,248,225,.75)'); g.lineWidth = r * .03; g.beginPath(); g.arc(cx, cy, r * .44, 0, Math.PI * 2); g.stroke();
  g.restore();
  if (label) { g.textAlign = 'center'; exText(g, label, ebSt(EB_C.gold, true, .05), EX_TITLE, r * .36, cx, cy + r * .13, r * .8); }
}
async function ebDrawFlow(p, n, ev, fam) {
  const { cv, g } = ebPaper(), cx = EB_PW / 2;
  for (const it of p.items) {
    const y = EB_MT + it.y, a = it.a;
    if (it.t === 'group') {
      exText(g, a.group, ebSt(EB_C.ink, true, .12), EX_TITLE, 70, cx, y + 80, EB_CW);
      if (a.groupSub) exText(g, a.groupSub.toUpperCase(), ebSt(EB_C.gold, false, .15), EX_TEXT, 30, cx, y + 135, EB_CW);
      ebRule(g, cx, y + 175, EB_CW * .8);
    } else if (it.t === 'award') {
      const t = a.title + (it.cont ? '（续）' : '');
      const s = exText(g, t, ebSt(EB_C.ink, true, .06), EX_TITLE, 52, cx, y + 60, EB_CW - 260);
      exFont(g, ebSt(EB_C.ink, true, .06), EX_TITLE, s); const tw = Math.min(EB_CW - 260, g.measureText(t).width); if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.fillStyle = EB_C.gold2; g.fillRect(cx - tw / 2 - 110, y + 42, 80, 3); g.fillRect(cx + tw / 2 + 30, y + 42, 80, 3);   // 标题两边的金线
      if (a.subtitle) exText(g, a.subtitle, ebSt(EB_C.muted, false, .04), EX_TEXT, 28, cx, y + 106, EB_CW);
    } else {
      const big = !!it.big, w = big ? EB_BIG_W : EB_CELL_W, ph = big ? EB_BIG_PH : EB_CELL_PH;
      const xs = it.ws.length === 2 ? [EB_MX, EB_MX + EB_CELL_W + 40] : [cx - w / 2];
      for (const [i, wn] of it.ws.entries()) {
        const x = xs[i], img = await exLoad(wn.photo), team = wn.type === 'team';
        ebPhoto(g, img, x, y, w, ph, team || isIdPhoto(wn.photo));
        const capY = y + ph + (it.note ? 30 + EB_NOTE_PH : 0);   // 名字的位置：有备注图片就排在图片下面
        if (it.note) ebPhoto(g, await exLoad(ebNotePic(wn)), x, y + ph + 30, w, EB_NOTE_PH, true);
        if (a.revealMode === 'nominee' && wn.win) {   // 入围揭晓的得主：金边 + 照片左上角别一朵金色胸花（用户定 2026-11-21）
          g.save(); g.beginPath(); g.roundRect(x - 4, y - 4, w + 8, ph + 8, 13); g.strokeStyle = EB_C.gold; g.lineWidth = 7; g.stroke(); g.restore();
          g.save(); g.fillStyle = EB_C.gold; g.beginPath(); g.roundRect(x + 18, y + 18, 120, 52, 26); g.fill(); g.restore();   // 左上角「得主」
          exText(g, '得主', ebSt('#ffffff', true, .1), EX_TEXT, 30, x + 78, y + 55, 110);
          const r = big ? 64 : 52;   // 右下角胸花（飘带末端停在照片里面）
          ebRosette(g, x + w - r - 18, y + ph - r * 1.85 - 16, r, '');
        }
        const soc = socOf(ebNotePic(wn) ? { ...wn, detail: '' } : wn), k = big ? 1.12 : 1, mx = x + w / 2;
        exText(g, wn.name || soc[0] || '', ebSt(EB_C.ink, true), fam.name || EX_TEXT, 44 * k, mx, capY + 60 * k, w - 20);
        const sub = team ? [soc[0] && soc[0] !== wn.name ? soc[0] : '', soc[1]] : [wn.cls, EB.showSid ? wn.sid : '', soc[0]];
        const line = sub.filter(Boolean).join(' · ');
        if (line) exText(g, line, ebSt(EB_C.muted, false), EX_TEXT, 29 * k, mx, capY + 105 * k, w - 20);
      }
    }
  }
  ebFoot(g, n, ev);
  return cv;
}
function ebDrawBack(n, ev) {
  const { cv, g } = ebPaper(); ebFrame(g);
  const cx = EB_PW / 2, blocks = [['编辑委员会', EB.editors], ['鸣谢', EB.thanks]]
    .map(([t, s]) => [t, s.split(/\r?\n/).map(x => x.trim()).filter(Boolean)]).filter(([, l]) => l.length);
  const h = blocks.reduce((t, [, l]) => t + 190 + l.length * 64 + 120, 0);
  let y = Math.max(260, (EB_PH - h) / 2);
  for (const [title, lines] of blocks) {
    y += 90; exText(g, title, ebSt(EB_C.ink, true, .3), EX_TITLE, 64, cx, y, EB_CW);
    y += 45; ebRule(g, cx, y, 300); y += 55;
    for (const ln of lines) { y += 64; exText(g, ln, ebSt(EB_C.ink, false, .03), EX_TEXT, 38, cx, y, EB_CW * .85); }
    y += 120;
  }
  if (ev.title) exText(g, ev.title, ebSt(EB_C.muted, false, .05), EX_TEXT, 28, cx, EB_PH - 150, EB_CW);
  return cv;
}
async function ebDraw(plan, i, ctx) {
  const p = plan.pages[i], n = i + 1;
  if (p.k === 'cover') return ebDrawCover(ctx.ev, ctx.logo);
  if (p.k === 'toc') return ebDrawToc(p, n, ctx.ev);
  if (p.k === 'preface') return ebDrawPreface(p, n, ctx.ev, ctx.preImg);
  if (p.k === 'gallery') return ebDrawGallery(p, n, ctx.ev, ctx.gallery);
  if (p.k === 'bts') return ebDrawBts(p, n, ctx.ev, ctx.bts);
  if (p.k === 'section') return ebDrawSection(p, n, ctx.ev);
  if (p.k === 'back') return ebDrawBack(n, ctx.ev);
  if (p.k === 'appendix') return ebDrawAppendix(p, n, ctx.ev);
  return ebDrawFlow(p, n, ctx.ev, ctx.fam);
}
// 名次倒过来（用户定 2026-11-21）：现场是从低到高公布（第 3 名 → 第 1 名、铜 → 银 → 金），
// 电子书改成最高的在前。只在「相邻、同一大类 + 同一分类」的一串奖项里倒过来（没分类的奖项按同一大类算一串），
// 大类、分类的先后不变；奖项里得奖者的顺序也不变。
function ebOrder(list) {
  if (!EB.topFirst) return list;
  const out = []; let run = [], key = null;
  for (const a of list) {
    const k = (a.section || '') + '' + (a.group || '');
    if (k !== key) { out.push(...run.reverse()); run = []; key = k; }
    run.push(a);
  }
  out.push(...run.reverse());
  return out;
}
// 准备：字体、Logo、集锦照片（找不到的跳过）、排版计划
async function ebPrepare() {
  await exEnsure();   // 也读了主题颜色（thUse）
  ebTheme();
  const list = ebOrder(exAwards());
  const fam = await exUseFonts();
  const gallery = (await Promise.all(EB.gallery.map(n => exLoad(n)))).filter(Boolean);
  const preImg = EB.prefacePhoto ? await exLoad(EB.prefacePhoto) : null;
  const bts = (await Promise.all(EB.bts.map(ebBtsLine).filter(b => b.file).map(async b => ({ img: await exLoad(b.file), cap: b.cap })))).filter(b => b.img);
  const ctx = { ev: draft?.event || {}, fam, logo: await exLoadLogo(), gallery, preImg, bts };
  const galSpec = ebPhotoPages(gallery, EB_GAL_FIRST, EB_GAL_N), btsSpec = ebPhotoPages(bts.map(b => b.img), EB_BTS_N, EB_BTS_N);
  return { list, ctx, plan: ebPlan(list, galSpec, ebPrefaceLayout(preImg), ebAppendixLayout(), btsSpec) };
}

async function ebPreview() {
  try {
    const { plan, ctx } = await ebPrepare();
    const N = plan.pages.length, i = Math.min(N, Math.max(1, +$('ebPage').value || 1)) - 1;
    $('ebPage').value = i + 1; $('ebPages').textContent = `共 ${N} 页`;
    const cv = await ebDraw(plan, i, ctx), pv = $('ebPv');
    pv.width = 1280; pv.height = Math.round(1280 * EB_PH / EB_PW);
    pv.getContext('2d').drawImage(cv, 0, 0, pv.width, pv.height);
    $('ebPvCap').textContent = `第 ${i + 1} / ${N} 页：${ebCap(plan.pages[i])}`;
    $('ebPrev').disabled = i === 0; $('ebNext').disabled = i === N - 1;
  } catch (e) { toast('电子书预览失败：' + e.message, true); }
}
async function ebTabOpen() {   // 切到「电子书」分页时：读设置、填表单、画目前这一页
  try { await ebOpen(); } catch {}
  ebPreview();
}
let ebPvT = 0;
const ebRepaint = () => { clearTimeout(ebPvT); ebPvT = setTimeout(ebPreview, 600); };   // 改了设置，停手 0.6 秒后重画预览
$('bEbPreview').onclick = ebPreview;
$('ebPage').onchange = ebPreview;
$('ebPrev').onclick = () => { $('ebPage').value = (+$('ebPage').value || 1) - 1; ebPreview(); };
$('ebNext').onclick = () => { $('ebPage').value = (+$('ebPage').value || 1) + 1; ebPreview(); };

const ebJpg = cv => new Promise((ok, bad) => cv.toBlob(b => (b ? ok(b) : bad(new Error('图片生成失败'))), 'image/jpeg', EB_Q));
const ebDataUrl = b => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => bad(new Error('图片读取失败')); r.readAsDataURL(b); });

/* 最简单的 PDF：每页一张 A4，里面一张 JPG（DCTDecode，原样放进去，不重新压缩）。不用第三方库。 */
async function ebPdf(jpgs, title, W = 595.28, H = 841.89) {   // 默认 A4（pt）；海报导出（poster.js）传实际尺寸
  const enc = new TextEncoder(), parts = [], xref = [];
  let off = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); off += b.length; };
  const obj = (n, ...body) => { xref[n] = off; push(`${n} 0 obj\n`); body.forEach(push); push('\nendobj\n'); };
  const N = jpgs.length;
  const utf16 = t => '<FEFF' + [...String(t)].map(c => { const u = c.codePointAt(0);
    if (u < 0x10000) return u.toString(16).padStart(4, '0');
    const v = u - 0x10000; return ((v >> 10) + 0xd800).toString(16) + ((v & 0x3ff) + 0xdc00).toString(16); }).join('').toUpperCase() + '>';
  push('%PDF-1.4\n'); push(new Uint8Array([37, 226, 227, 207, 211, 10]));   // 二进制标记
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${N} /Kids [${jpgs.map((_, i) => `${4 + i * 3} 0 R`).join(' ')}] >>`);
  obj(3, `<< /Title ${utf16(title)} /Producer (Award Ceremony) >>`);
  for (const [i, j] of jpgs.entries()) {
    const pg = 4 + i * 3, ct = pg + 1, im = pg + 2, draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    obj(ct, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
    const bytes = new Uint8Array(await j.blob.arrayBuffer());
    obj(im, `<< /Type /XObject /Subtype /Image /Width ${j.w} /Height ${j.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`, bytes, '\nendstream');
  }
  const start = off, size = 4 + N * 3;
  push(`xref\n0 ${size}\n0000000000 65535 f \n` + Array.from({ length: size - 1 }, (_, i) => String(xref[i + 1]).padStart(10, '0') + ' 00000 n \n').join(''));
  push(`trailer\n<< /Size ${size} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${start}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

// kind = 'html'（翻书网页）或 'pdf'
async function ebExport(kind) {
  const btns = [$('bExportBook'), $('bExportPdf'), $('bEbPreview'), $('ebPrev'), $('ebNext')];
  btns.forEach(b => (b.disabled = true));
  try {
    const { list, ctx, plan } = await ebPrepare();
    const people = list.reduce((t, a) => t + a.winners.length, 0);
    if (!people) return toast('没有得奖者，没东西可以放进电子书', true);
    const N = plan.pages.length, jpgs = [];
    for (let i = 0; i < N; i++) {
      $('ebProg').textContent = `电子书生成中 ${i + 1}/${N} 页…`; $('ebBar').style.width = ((i + 1) / N * 100) + '%';
      const cv = await ebDraw(plan, i, ctx);
      jpgs.push({ blob: await ebJpg(cv), w: cv.width, h: cv.height });
    }
    const title = ctx.ev.title || '表扬大会';
    $('ebProg').textContent = kind === 'pdf' ? '组合 PDF…' : '组合网页…';
    const blob = kind === 'pdf' ? await ebPdf(jpgs, title + ' · 纪念特刊')
      : new Blob([ebHtml({ title, w: EB_PW, h: EB_PH, pages: await Promise.all(jpgs.map(j => ebDataUrl(j.blob))), caps: plan.pages.map(ebCap), toc: plan.toc })], { type: 'text/html;charset=utf-8' });
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const name = `${safeFile(title)}-纪念特刊_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.${kind === 'pdf' ? 'pdf' : 'html'}`;
    const url = URL.createObjectURL(blob), link = el('a', { href: url, download: name, style: 'display:none' });
    document.body.append(link); link.click();
    setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 60000);
    const what = kind === 'pdf' ? 'PDF' : '电子书';
    toast(`${what}已导出：${N} 页（${mb(blob.size)}）`); log(`导出${what} ${N} 页，${people} 位得奖者`);
    $('ebProg').textContent = `${what}完成：${N} 页，${mb(blob.size)}`;
  } catch (e) { toast('电子书导出失败：' + e.message, true); $('ebProg').textContent = ''; }
  finally { btns.forEach(b => (b.disabled = false)); setTimeout(() => { $('ebBar').style.width = '0'; }, 1500); }
}
$('bExportBook').onclick = () => ebExport('html');
$('bExportPdf').onclick = () => ebExport('pdf');

/* ---- 电子书网页本身（一个文件，什么都不用连） ----
 * 电脑（横的屏幕）：两页摊开，翻页时右页绕书脊翻到左边，像真的书；封面单独在右边。手机（竖的屏幕）：一次一页。
 * 只解码前后几页的图片，几百页也不会卡。「打印 / PDF」：每页一张 A4（打印对话框选「另存为 PDF」就是 PDF）。 */
function ebHtml(book) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const data = JSON.stringify(book).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(book.title)} · 纪念特刊</title>
<style>
:root{--bg:${thC('#2a2622')};--bar:${thC('#1d1a17')};--gold:${thC('#d2b067')};--text:${thC('#efe6d2')};--muted:${thC('#a59a83')};--paper:${thC('#fbf8f1')};--dur:.9s}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--bg);color:var(--text);font-family:"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif;overflow:hidden;-webkit-tap-highlight-color:transparent}
#stage{position:fixed;inset:0 0 56px 0;display:flex;align-items:center;justify-content:center}
#book{position:relative;perspective:3200px;transition:transform .6s cubic-bezier(.2,.7,.2,1);cursor:pointer;user-select:none}
.pg,.leaf{position:absolute;top:0;height:100%;transform-origin:0 50%;transition:transform var(--dur) cubic-bezier(.45,.05,.25,1)}
.pg{left:0;width:100%;background:var(--paper);box-shadow:0 14px 50px rgba(0,0,0,.5);backface-visibility:hidden;-webkit-backface-visibility:hidden}
.pg.f{transform:rotateY(-170deg)}
.leaf{left:50%;width:50%;transform-style:preserve-3d}
.leaf.f{transform:rotateY(-180deg)}
.face{position:absolute;inset:0;background:var(--paper);backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden;box-shadow:0 14px 50px rgba(0,0,0,.45)}
.face.back{transform:rotateY(180deg)}
.face::after{content:"";position:absolute;top:0;bottom:0;width:7%;pointer-events:none}
.face.front::after{left:0;background:linear-gradient(90deg,rgba(0,0,0,.16),rgba(0,0,0,0))}
.face.back::after{right:0;background:linear-gradient(270deg,rgba(0,0,0,.16),rgba(0,0,0,0))}
.pg img,.face img{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none}
.far{display:none}
#book.nt,#book.nt .pg,#book.nt .leaf{transition:none}
#bar{position:fixed;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;gap:8px;padding:0 max(12px,env(safe-area-inset-left));background:var(--bar);border-top:1px solid ${thC('rgba(210,176,103,.25)')}}
#bar button{background:${thC('#2c2823')};color:var(--text);border:1px solid ${thC('rgba(210,176,103,.45)')};border-radius:8px;height:38px;min-width:42px;padding:0 12px;font-size:15px;cursor:pointer}
#bar button:disabled{opacity:.35;cursor:default}
#cap{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:14px;text-align:center}
#num{color:var(--gold);font-size:14px;white-space:nowrap}
#toc{position:fixed;inset:0 0 56px 0;background:${thC('rgba(29,26,23,.97)')};overflow:auto;padding:24px max(16px,env(safe-area-inset-left));display:none}
#toc.on{display:block}
#toc h2{margin:0 0 14px;color:var(--gold);font-size:20px;text-align:center}
#toc a{display:flex;gap:10px;padding:9px 12px;border-radius:6px;color:var(--text);text-decoration:none;max-width:760px;margin:0 auto}
#toc a:hover{background:${thC('rgba(210,176,103,.12)')}}
#toc a span{flex:1}
#toc a i{font-style:normal;color:var(--muted);font-size:13px}
#toc .l0{color:var(--gold);font-weight:700;font-size:18px;margin-top:12px}
#toc .l1{font-weight:700;padding-left:28px}
#toc .l2{padding-left:48px;font-size:15px}
#toc .l3{padding-left:28px;font-size:15px}
#print{display:none}
@media (prefers-reduced-motion:reduce){:root{--dur:0s}#book{transition:none}}
#bar button{white-space:nowrap}
@media (max-width:600px){#bar{gap:5px}#bar button{padding:0 9px;min-width:38px}#cap,#bPrint,#bFull{display:none}#num{flex:1;text-align:center}}
@media print{
  @page{size:A4;margin:0}
  html,body{height:auto;overflow:visible;background:#fff}
  #stage,#bar,#toc{display:none!important}
  #print{display:block}
  #print img{display:block;width:210mm;height:297mm;break-after:page;page-break-after:always}
  #print img:last-child{break-after:auto;page-break-after:auto}
}
</style></head><body>
<div id="stage"><div id="book"></div></div>
<div id="toc"><h2>${esc(book.title)}</h2><div id="tocList"></div></div>
<div id="print"></div>
<div id="bar">
  <button id="bToc">目录</button>
  <button id="bPrev" aria-label="上一页">◀</button>
  <span id="num"></span>
  <button id="bNext" aria-label="下一页">▶</button>
  <span id="cap"></span>
  <button id="bPrint" title="每页一张 A4；在打印对话框选「另存为 PDF」就能存成 PDF">打印 / PDF</button>
  <button id="bFull">全屏</button>
</div>
<script>
(function(){"use strict";
var B=${data};
var N=B.pages.length,book=document.getElementById("book"),stage=document.getElementById("stage");
var mode=0,cur=0,s=0,L=Math.ceil(N/2),SMAX=N%2?L-1:L,items=[],moving=null;
function byId(id){return document.getElementById(id);}
function setImg(im,i,on){if(i<0||i>=N){return;}if(on&&!im.getAttribute("src"))im.src=B.pages[i];else if(!on&&im.getAttribute("src"))im.removeAttribute("src");}
function want(){return stage.clientWidth>stage.clientHeight*1.1?2:1;}
function build(){
  var p=mode===2?Math.max(0,2*s-1):cur;mode=want();book.innerHTML="";items=[];book.style.transform="";
  if(mode===1){cur=p;for(var i=0;i<N;i++){var d=document.createElement("div");d.className="pg";d.style.zIndex=N-i;d.appendChild(document.createElement("img"));book.appendChild(d);items.push(d);}}
  else{s=Math.min(SMAX,Math.floor((p+1)/2));for(var k=0;k<L;k++){var lf=document.createElement("div");lf.className="leaf";
    var f=document.createElement("div");f.className="face front";f.appendChild(document.createElement("img"));
    var b=document.createElement("div");b.className="face back";b.appendChild(document.createElement("img"));
    lf.appendChild(f);lf.appendChild(b);book.appendChild(lf);items.push(lf);}}
  book.classList.add("nt");fit();paint();void book.offsetWidth;book.classList.remove("nt");
}
function fit(){var W=stage.clientWidth*.96,H=stage.clientHeight*.94,k=Math.min(W/(B.w*mode),H/B.h);book.style.width=Math.floor(B.w*mode*k)+"px";book.style.height=Math.floor(B.h*k)+"px";}
function paint(){
  var first,last;
  if(mode===1){
    for(var i=0;i<N;i++){var d=items[i],near=i>=cur-2&&i<=cur+2;d.classList.toggle("f",i<cur);d.classList.toggle("far",!near);setImg(d.firstChild,i,near);}
    first=last=cur;byId("bPrev").disabled=cur<=0;byId("bNext").disabled=cur>=N-1;
  }else{
    for(var k=0;k<L;k++){var lf=items[k],near2=k>=s-3&&k<=s+2;lf.classList.toggle("f",k<s);lf.classList.toggle("far",!near2);
      if(lf!==moving)lf.style.zIndex=k<s?k+1:L-k+1;
      setImg(lf.firstChild.firstChild,2*k,near2);setImg(lf.lastChild.firstChild,2*k+1,near2);}
    book.style.transform=s===0?"translateX(-25%)":(s===L&&N%2===0?"translateX(25%)":"");
    first=Math.max(0,2*s-1);last=Math.min(N-1,2*s);if(s===L)last=first;
    byId("bPrev").disabled=s<=0;byId("bNext").disabled=s>=SMAX;
  }
  byId("num").textContent=(first===last?"第 "+(first+1):"第 "+(first+1)+"–"+(last+1))+" / "+N+" 页";
  var c=[B.caps[first],B.caps[last]].filter(function(x,i,a){return x&&a.indexOf(x)===i;});byId("cap").textContent=c.join(" ｜ ");
  try{history.replaceState(null,"","#"+(first+1));}catch(e){}
}
function step(d){
  if(mode===1){var n=Math.max(0,Math.min(N-1,cur+d));if(n!==cur){cur=n;paint();}return;}
  var t=Math.max(0,Math.min(SMAX,s+d));if(t===s)return;
  var lf=items[d>0?s:s-1];moving=lf;lf.style.zIndex=L+10;s=t;paint();
  setTimeout(function(){if(moving===lf){moving=null;paint();}},950);
}
function jump(p){book.classList.add("nt");moving=null;if(mode===1)cur=p;else s=Math.min(SMAX,Math.floor((p+1)/2));paint();void book.offsetWidth;book.classList.remove("nt");}
book.onclick=function(e){var r=book.getBoundingClientRect();step(e.clientX-r.left>r.width/2?1:-1);};
byId("bPrev").onclick=function(){step(-1);};byId("bNext").onclick=function(){step(1);};
byId("bFull").onclick=function(){var d=document.documentElement;if(document.fullscreenElement)document.exitFullscreen();else if(d.requestFullscreen)d.requestFullscreen();};
function fillPrint(){var box=byId("print");if(!box.childNodes.length)B.pages.forEach(function(src){var im=document.createElement("img");im.src=src;box.appendChild(im);});return box;}
window.addEventListener("beforeprint",fillPrint);   // 直接按 Ctrl+P 也印得出来
byId("bPrint").onclick=function(){
  var box=fillPrint(),btn=byId("bPrint");
  btn.disabled=true;btn.textContent="准备中…";
  Promise.all([].map.call(box.childNodes,function(im){return im.decode?im.decode().catch(function(){}):0;})).then(function(){btn.disabled=false;btn.textContent="打印 / PDF";window.print();});
};
var toc=byId("toc");
B.toc.forEach(function(t){var a=document.createElement("a");a.href="#"+(t.p+1);a.className="l"+t.l;var sp=document.createElement("span");sp.textContent=t.t;a.appendChild(sp);
  var n=document.createElement("i");n.textContent=(t.n?t.n+" 位 · ":"")+"第 "+(t.p+1)+" 页";a.appendChild(n);
  a.onclick=function(e){e.preventDefault();toc.classList.remove("on");jump(t.p);};byId("tocList").appendChild(a);});
byId("bToc").onclick=function(){toc.classList.toggle("on");};
document.addEventListener("keydown",function(e){
  if(e.key==="ArrowRight"||e.key==="PageDown"||e.key===" "){e.preventDefault();step(1);}
  else if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();step(-1);}
  else if(e.key==="Home")jump(0);else if(e.key==="End")jump(N-1);
  else if(e.key==="Escape")toc.classList.remove("on");});
var sx=null,sy=0;
book.addEventListener("touchstart",function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
book.addEventListener("touchend",function(e){if(sx===null)return;var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;sx=null;
  if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){e.preventDefault();step(dx<0?1:-1);}});
window.addEventListener("resize",function(){if(want()!==mode)build();else fit();});
var h=parseInt(location.hash.slice(1),10);if(h>0){cur=Math.min(N,h)-1;s=Math.min(SMAX,Math.floor(cur/2+.5));}
build();
})();
</script>
</body></html>`;
}
