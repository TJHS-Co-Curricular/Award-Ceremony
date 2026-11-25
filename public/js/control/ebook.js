/*
 * 控制端 · 导出电子书（A4 纪念特刊，像毕业特刊）（一）设置、表单、预览、导出。1.95 起分成四个文件（按这个顺序载入）：
 *   ebook.js（这个：尺寸 / 颜色常量、设置 EB、表单、电子书图片上传、排序 ebOrder、ebPrepare、预览、导出）
 *   → ebook-plan.js（每页放什么、前言 / 附录分页）→ ebook-draw.js（画每一种页面）→ ebook-html.js（翻书网页模板 ebHtml）
 *   封面 → 前言（可多页）→ 目录（有页码）→ 活动照片集锦 → 大类分隔页 → 分类标题 + 奖项（每页最多 6 位，2 × 3；只有 1 位就放大）→ 编委 / 鸣谢 → 附录（例：表扬办法）
 * 每页用 canvas 画成 A4（1654 × 2339，约 200 dpi）JPG，全部嵌进同一个 .html：双击用浏览器打开就能翻书，
 * 电脑上两页摊开、手机上一页一页翻；「导出 PDF」每页刚好一张 A4。用户定（2026-11-21）：一页 6 位、米白底、要集锦和编委 / 鸣谢；2026-11-23 拿掉翻书网页的打印、加配色（EB.color / EB.paper）。
 * 「导出 PDF」= 同一套页面直接组成 PDF（output.js 的 outPdf()，每页一张 A4 JPG），给 Google Drive / Sites、印刷店用。
 * 设置（封面副标题、印不印学号、前言、集锦照片文件名、编委、鸣谢）存在服务端 data/ebook.json（GET / PUT /api/control/ebook）。
 * 全部在浏览器里完成；导出的文件只下载到这台电脑。
 * 提供：ebTabOpen()（ui.js 切到「电子书」分页时调用）、ebOpen()、ebExport(kind)、ebPreview()、ebClean()、ebBtsLine()（会前检查用）
 * 用到另外三个文件的：ebPlan、ebCap、ebPrefaceLayout、ebAppendixLayout、ebDraw、ebHtml（都是在按按钮之后才调用）
 * 需要：export.js（exUseFonts、exAwards、exEnsure）、draw-kit.js（exLoad、exLoadLogo、exText、exFont、exWrap、exCover、EX_TITLE、EX_TEXT）、output.js（outBlob、outDataUrl、outPdf、outDownload、safeFile）、
 *       shared/idphoto.js（isIdPhoto）、import.js（socOf）、core.js
 */
'use strict';

const EB_PW = 1654, EB_PH = 2339, EB_Q = .85;              // A4（210 × 297 mm）约 200 dpi；JPG 质量
const EB_MX = 150, EB_MT = 160, EB_MB = 190;              // 左右、上、下边距（下面放页码）
const EB_CW = EB_PW - EB_MX * 2, EB_AVAIL = EB_PH - EB_MT - EB_MB;
const EB_C0 = { paper: '#fbf8f1', ink: '#2b241a', gold: '#a8823a', gold2: '#d2b067', muted: '#7d725c', line: '#e0d3b2', box: '#efe8d8' };
const EB_C = { ...EB_C0 };   // 按主题颜色转过的 EB_C0（ebPrepare() 里 ebTheme() 更新；默认金色 = EB_C0）
// 纸张颜色的亮度（0 黑 ~ 1 白）；低于 EB_DARK 就当深色纸：字改成浅色
const ebLum = h => { const [r, g, b] = thHex(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const EB_DARK = .45;
// 电子书的颜色：主色按 EB.color（空 = 大屏主题颜色）转；纸张：米白（跟主色带一点色调）/ 白色 / 跟大屏背景色 / 自定义
// 深色纸张（用户 2026-11-23：电子书不用打印，可以跟大屏一样深色）：字、线条、浅色框都换成适合深底的颜色
function ebTheme() {
  const screenBg = (thCtl && thCtl.thBg) || TH_BASE.bg;   // 大屏背景色（「效果控制」的主题背景色）；要在下面换主色之前先拿
  if (EB.color) thUse({ thMain: EB.color });   // exEnsure() 先设了大屏的主题；电子书自己选了就换掉（切回图片导出时 exEnsure() 会再设回去）
  for (const k in EB_C0) EB_C[k] = thC(EB_C0[k]);
  EB_C.dark = false; EB_C.chip = thC('#f3e9d2'); EB_C.band = thC('#f4ecda');   // 附录的小标签、注释框底色
  const hex = a => '#' + a.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, k) => hex(thHex(a).map((v, i) => v * (1 - k) + thHex(b)[i] * k));
  if (EB.paper === 'white') Object.assign(EB_C, { paper: '#ffffff', box: '#f3f3f1', line: thC('#e6dcc4') });
  else if (EB.paper === 'screen' || /^#/.test(EB.paper)) {
    const P = EB.paper === 'screen' ? screenBg : EB.paper;
    if (ebLum(P) < EB_DARK) {   // 深色纸：浅色字、亮一点的主色，框和线条从纸张颜色调亮
      const gold = thC('#d9b25f');
      Object.assign(EB_C, { dark: true, paper: P, ink: thC('#f1e9d8'), muted: thC('#b3a88f'), gold, gold2: thC('#e9cf8f'),
        box: mix(P, '#ffffff', .07), line: mix(P, gold, .45), chip: mix(P, gold, .14), band: mix(P, '#ffffff', .06) });
    } else Object.assign(EB_C, { paper: P, box: mix(P, '#000000', .06), line: mix(P, EB_C.gold, .35) });   // 浅色纸：框稍微压暗，线条 = 纸张和主色调一点
  }
}
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
const EB_DEF = () => ({ coverSub: '颁奖纪念特刊', coverYear: true, showSid: false, topFirst: true, color: '', paper: 'cream',
  logoSrc: 'school', logoPos: 'top', logoSize: 100, logoX: 0, logoY: 0, bgFade: 0, coverFade: 0, frame: true,
  coverKicker: '', coverEvSub: true, coverInfo: true, titlePos: 'mid', titleY: 0, prefaceTitle: '前言', preface: '', prefaceBy: '', prefacePhoto: '',
  galleryTitle: '活动剪影', gallery: [], btsTitle: '幕后花絮', bts: [], editors: '', thanks: '', appendixTitle: '', appendixSub: '', appendix: '' });
const ebNum = (x, lo, hi, def) => (Number.isFinite(+x) && x !== '' && x != null ? Math.min(hi, Math.max(lo, Math.round(+x))) : def);
function ebClean(v) {
  const d = EB_DEF(), s = (x, n, def) => (typeof x === 'string' ? x.slice(0, n) : def);
  return {
    // 年份单独一行：封面 coverYear、分隔页 secYear 分开（用户定 2026-11-23）；旧设置没有 secYear 时照 coverYear（和以前一样）
    coverSub: s(v?.coverSub, 40, d.coverSub), coverYear: v?.coverYear !== false, secYear: v?.secYear != null ? v.secYear !== false : v?.coverYear !== false, showSid: !!v?.showSid, topFirst: v?.topFirst !== false,
    color: /^#[0-9a-f]{6}$/i.test(v?.color) ? v.color.toLowerCase() : '',
    paper: ['white', 'screen'].includes(v?.paper) ? v.paper : /^#[0-9a-f]{6}$/i.test(v?.paper) ? v.paper.toLowerCase() : 'cream',   // cream 米白 / white 白色 / screen 跟大屏背景色 / #rrggbb 自定义
    // Logo 与背景（用户定 2026-11-23）：Logo 来源 school 学校 / own 电子书自己的 / none；位置 top 标题上方 / tl / tr / bc；大小 %；微调 = 页面的 %
    logoSrc: ['own', 'none'].includes(v?.logoSrc) ? v.logoSrc : 'school', logoPos: ['tl', 'tr', 'bc'].includes(v?.logoPos) ? v.logoPos : 'top',
    logoSize: ebNum(v?.logoSize, 20, 300, 100), logoX: ebNum(v?.logoX, -40, 40, 0), logoY: ebNum(v?.logoY, -40, 40, 0), bgFade: ebNum(v?.bgFade, 0, 90, 0), frame: v?.frame !== false,
    // 封面（用户定 2026-11-23）：封面背景淡化和每页分开；小标题（活动名称上面一行）；活动副标题、日期时间地点开关；标题位置 mid / top / bottom + 上下微调（页面高度 %）
    coverFade: ebNum(v?.coverFade, 0, 90, 0), coverKicker: s(v?.coverKicker, 60, ''), coverEvSub: v?.coverEvSub !== false, coverInfo: v?.coverInfo !== false,
    titlePos: ['top', 'bottom'].includes(v?.titlePos) ? v.titlePos : 'mid', titleY: ebNum(v?.titleY, -40, 40, 0),
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
  if (!ebLoaded) { try { const r = await api('GET', '/api/control/ebook'); EB = ebClean(r.ebook); ebImgVer = r.img || {}; } catch { EB = EB_DEF(); } ebLoaded = true; }
  ebColorUI(); ebPaperUI(); ebLogoUI();
  $('eb_coverSub').value = EB.coverSub; $('eb_coverYear').checked = EB.coverYear; $('eb_showSid').checked = EB.showSid; $('eb_topFirst').checked = EB.topFirst; $('eb_galleryTitle').value = EB.galleryTitle;
  $('eb_appendixTitle').value = EB.appendixTitle; $('eb_appendixSub').value = EB.appendixSub; $('eb_appendix').value = EB.appendix;
  $('eb_prefaceTitle').value = EB.prefaceTitle; $('eb_preface').value = EB.preface; $('eb_prefaceBy').value = EB.prefaceBy; $('eb_prefacePhoto').value = EB.prefacePhoto;
  $('eb_btsTitle').value = EB.btsTitle; $('eb_bts').value = EB.bts.join('\n');
  $('eb_gallery').value = EB.gallery.join('\n'); $('eb_editors').value = EB.editors; $('eb_thanks').value = EB.thanks;
  ebGalleryInfo();
}
function ebChanged() {
  EB = ebClean({ ...ebLogoVal(), color: ebColorVal(), paper: ebPaperVal(), coverSub: $('eb_coverSub').value, coverYear: $('eb_coverYear').checked, showSid: $('eb_showSid').checked, topFirst: $('eb_topFirst').checked, galleryTitle: $('eb_galleryTitle').value,
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
// 配色（用户定 2026-11-23）：下拉 = 跟大屏主题颜色 / 内置主题（shared/theme.js 的 TH_PRESETS）/ 自定义（选一个主色）
$('eb_color').replaceChildren(el('option', { value: '' }, '跟大屏的主题颜色'),
  ...TH_PRESETS.map(([n, t]) => el('option', { value: t.thMain }, n.replace('（默认）', ''))), el('option', { value: 'own' }, '自定义…'));
function ebColorUI() {
  const pre = TH_PRESETS.some(([, t]) => t.thMain === EB.color);
  $('eb_color').value = !EB.color ? '' : pre ? EB.color : 'own';
  $('eb_colorOwn').value = EB.color || TH_PRESETS[0][1].thMain;
  $('eb_colorOwn').classList.toggle('hidden', $('eb_color').value !== 'own');
}
function ebColorVal() { const v = $('eb_color').value; return v === 'own' ? $('eb_colorOwn').value : v; }
$('eb_color').onchange = () => { $('eb_colorOwn').classList.toggle('hidden', $('eb_color').value !== 'own'); ebChanged(); };
$('eb_colorOwn').oninput = ebChanged;
// 纸张（用户定 2026-11-23）：米白 / 白色 / 跟大屏背景色 / 自定义（取色器）；深色纸字自动变浅色，不深不浅的才提示
function ebPaperUI() {
  const own = /^#/.test(EB.paper);
  $('eb_paper').value = own ? 'own' : EB.paper;
  $('eb_paperOwn').value = own ? EB.paper : '#fbf8f1';
  ebPaperHint();
}
function ebPaperVal() { const v = $('eb_paper').value; return v === 'own' ? $('eb_paperOwn').value : v; }
function ebPaperHint() {
  const own = $('eb_paper').value === 'own';
  $('eb_paperOwn').classList.toggle('hidden', !own);
  const l = ebLum($('eb_paperOwn').value);
  $('ebPaperWarn').classList.toggle('hidden', !(own && l >= EB_DARK && l < .7));
}
$('eb_paper').onchange = () => { ebPaperHint(); ebChanged(); };
$('eb_paperOwn').oninput = () => { ebPaperHint(); ebChanged(); };
// Logo 与背景（用户定 2026-11-23）：电子书自己的 Logo、封面 / 每页背景图片存服务器 data/backgrounds/ebook-*（/api/control/ebook-img?k=）
let ebImgVer = {}, ebImgCache = {};
const EB_SLIDERS = [['eb_logoSize', 'logoSize', '%'], ['eb_logoX', 'logoX', '%'], ['eb_logoY', 'logoY', '%'], ['eb_coverFade', 'coverFade', '%'], ['eb_bgFade', 'bgFade', '%'], ['eb_titleY', 'titleY', '%']];
const EB_CHECKS = [['eb_secYear', 'secYear'], ['eb_frame', 'frame'], ['eb_coverEvSub', 'coverEvSub'], ['eb_coverInfo', 'coverInfo']], EB_SELS = [['eb_logoSrc', 'logoSrc'], ['eb_logoPos', 'logoPos'], ['eb_titlePos', 'titlePos']];
function ebLogoUI() {
  for (const [id, k] of EB_SELS) $(id).value = EB[k];
  for (const [id, k] of EB_CHECKS) $(id).checked = EB[k];
  $('eb_coverKicker').value = EB.coverKicker;
  for (const [id, k] of EB_SLIDERS) $(id).value = EB[k];
  ebLogoHint();
}
function ebLogoVal() {
  const o = { coverKicker: $('eb_coverKicker').value };
  for (const [id, k] of EB_SELS) o[k] = $(id).value;
  for (const [id, k] of EB_CHECKS) o[k] = $(id).checked;
  for (const [id, k] of EB_SLIDERS) o[k] = +$(id).value;
  return o;
}
function ebLogoHint() {
  for (const [id, , u] of EB_SLIDERS) $(id + 'V').textContent = $(id).value + u;
  const none = $('eb_logoSrc').value === 'none';
  $('ebLogoOwn').classList.toggle('hidden', $('eb_logoSrc').value !== 'own');
  for (const id of ['eb_logoPos', 'eb_logoSize', 'eb_logoX', 'eb_logoY']) $(id).closest('.xr').classList.toggle('hidden', none);
  const has = k => (ebImgVer[k] ? '有' : '没有');
  $('ebImgInfo').textContent = `电子书 Logo ${has('logo')}、封面背景 ${has('cover')}、每页背景 ${has('page')}`;
  $('bEbLogoDel').disabled = !ebImgVer.logo; $('bEbCoverBgDel').disabled = !ebImgVer.cover; $('bEbPageBgDel').disabled = !ebImgVer.page;
}
for (const [id] of [...EB_SELS, ...EB_CHECKS]) $(id).onchange = () => { ebLogoHint(); ebChanged(); };
$('eb_coverKicker').oninput = ebChanged;
for (const [id] of EB_SLIDERS) $(id).oninput = () => { ebLogoHint(); ebChanged(); };
function ebImg(k) {   // 读服务器上的电子书图片（没有 = null）
  const v = ebImgVer[k] || '';
  if (!v) return Promise.resolve(null);
  if (!ebImgCache[k] || ebImgCache[k].v !== v) ebImgCache[k] = { v, p: loadImg(`/api/control/ebook-img?k=${k}&v=${encodeURIComponent(v)}`).catch(() => null) };
  return ebImgCache[k].p;
}
// 上传：Logo 缩到最长边 1200 存 PNG（保留透明）；背景缩到最长边 2400 存 JPEG
async function ebImgUpload(k, f) {
  const src = await new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => bad(new Error('读不到文件')); r.readAsDataURL(f); });
  const im = await loadImg(src), png = k === 'logo';
  const s = Math.min(1, (png ? 1200 : 2400) / Math.max(im.naturalWidth, im.naturalHeight));
  const cv = el('canvas'); cv.width = Math.max(1, Math.round(im.naturalWidth * s)); cv.height = Math.max(1, Math.round(im.naturalHeight * s));
  const g = cv.getContext('2d'); if (!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); }
  g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, cv.width, cv.height);
  const blob = await outBlob(cv, png ? 'image/png' : 'image/jpeg', .9);
  const r = await fetch('/api/control/ebook-img?k=' + k, { method: 'POST', headers: { 'X-AC': '1', 'Content-Type': png ? 'image/png' : 'image/jpeg' }, body: blob, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  ebImgVer = j.img || {}; return `${cv.width}×${cv.height}`;
}
const EB_IMG_NAME = { logo: '电子书 Logo', cover: '封面背景', page: '每页背景' };
for (const [k, file, del] of [['logo', 'eb_logoFile', 'bEbLogoDel'], ['cover', 'eb_coverBgFile', 'bEbCoverBgDel'], ['page', 'eb_pageBgFile', 'bEbPageBgDel']]) {
  $(file).onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const sz = await ebImgUpload(k, f); ebLogoHint(); ebPreview(); toast(EB_IMG_NAME[k] + '已上传'); log(`上传${EB_IMG_NAME[k]}（${sz}）`); }
    catch (err) { toast('上传失败：' + err.message, true); }
  };
  $(del).onclick = async () => {
    if (!confirm(`移除${EB_IMG_NAME[k]}？`)) return;
    try { ebImgVer = (await api('POST', '/api/control/ebook-img/delete?k=' + k, {})).img || {}; ebLogoHint(); ebPreview(); toast('已移除' + EB_IMG_NAME[k]); }
    catch (err) { toast('移除失败：' + err.message, true); }
  };
}
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

// 名次倒过来（用户定 2026-11-21）：现场是从低到高公布（第 3 名 → 第 1 名、铜 → 银 → 金），
// 电子书改成最高的在前。只在「相邻、同一大类 + 同一分类」的一串奖项里倒过来（没分类的奖项按同一大类算一串），
// 大类、分类的先后不变；奖项里得奖者的顺序也不变。
function ebOrder(list) {
  // 有所属部门时先按部门排（部门的先后 = 名单里第一次出现的先后；部门里照原本顺序），用户定 2026-11-23
  if (list.some(a => a.dept)) {
    const m = new Map();
    for (const a of list) { const k = a.dept || ''; if (!m.has(k)) m.set(k, []); m.get(k).push(a); }
    list = [...m.values()].flat();
  }
  if (!EB.topFirst) return list;
  const out = []; let run = [], key = null;
  for (const a of list) {
    const k = (a.dept || '') + '' + (a.section || '') + '' + (a.group || '');
    if (k !== key) { out.push(...run.reverse()); run = []; key = k; }
    run.push(a);
  }
  out.push(...run.reverse());
  return out;
}
// 准备：字体、Logo、集锦照片（找不到的跳过）、排版计划
async function ebPrepare() {
  await exEnsure();   // 也读了主题颜色（thUse）
  ebTheme();   // 电子书自己的配色
  const list = ebOrder(exAwards());
  const fam = await exUseFonts();
  const gallery = (await Promise.all(EB.gallery.map(n => exLoad(n)))).filter(Boolean);
  const preImg = EB.prefacePhoto ? await exLoad(EB.prefacePhoto) : null;
  const bts = (await Promise.all(EB.bts.map(ebBtsLine).filter(b => b.file).map(async b => ({ img: await exLoad(b.file), cap: b.cap })))).filter(b => b.img);
  EB_BGI = { cover: await ebImg('cover'), page: await ebImg('page') };
  const logo = EB.logoSrc === 'none' ? null : EB.logoSrc === 'own' ? await ebImg('logo') : await exLoadLogo();   // 电子书的 Logo 和其它地方分开（用户定 2026-11-23）
  const ctx = { ev: draft?.event || {}, fam, logo, gallery, preImg, bts };
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

const ebJpg = cv => outBlob(cv, 'image/jpeg', EB_Q);   // output.js

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
    const blob = kind === 'pdf' ? await outPdf(jpgs, title + ' · 纪念特刊')
      : new Blob([ebHtml({ title, w: EB_PW, h: EB_PH, pages: await Promise.all(jpgs.map(j => outDataUrl(j.blob))), caps: plan.pages.map(ebCap), toc: plan.toc, icon: ebIcon(ctx.logo) })], { type: 'text/html;charset=utf-8' });
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const name = `${safeFile(title)}-纪念特刊_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.${kind === 'pdf' ? 'pdf' : 'html'}`;
    outDownload(blob, name);
    const what = kind === 'pdf' ? 'PDF' : '电子书';
    toast(`${what}已导出：${N} 页（${mb(blob.size)}）`); log(`导出${what} ${N} 页，${people} 位得奖者`);
    $('ebProg').textContent = `${what}完成：${N} 页，${mb(blob.size)}`;
  } catch (e) { toast('电子书导出失败：' + e.message, true); $('ebProg').textContent = ''; }
  finally { btns.forEach(b => (b.disabled = false)); setTimeout(() => { $('ebBar').style.width = '0'; }, 1500); }
}
// 网页图标：电子书用的 Logo 缩成 64×64 PNG（没有 Logo 就不加）
function ebIcon(logo) {
  if (!logo || !logo.naturalWidth) return '';
  const cv = el('canvas'); cv.width = cv.height = 64;
  const k = Math.min(64 / logo.naturalWidth, 64 / logo.naturalHeight), w = logo.naturalWidth * k, h = logo.naturalHeight * k;
  cv.getContext('2d').drawImage(logo, (64 - w) / 2, (64 - h) / 2, w, h);
  try { return cv.toDataURL('image/png'); } catch { return ''; }
}
$('bExportBook').onclick = () => ebExport('html');
$('bExportPdf').onclick = () => ebExport('pdf');
