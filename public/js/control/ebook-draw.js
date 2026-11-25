/*
 * 控制端 · 电子书（三）画页面（1.95 从 ebook.js 拆出来，画面不变）：每页一张 1654 × 2339 的 canvas。
 *   共用：ebPaper()（纸张 + 背景图片 + 淡化）、ebFrame、ebRule、ebFoot、ebLines、ebGoldText、ebPhoto、ebJustify
 *   每种页：ebDrawCover、ebDrawPreface、ebDrawToc、ebDrawGallery、ebDrawBts（拍立得）、ebDrawSection（大类 / 部门分隔页）、ebDrawFlow（得奖者）、ebDrawAppendix、ebDrawBack
 *   ebDraw(plan, i, ctx)：按排版计划的第 i 页选上面哪一种来画
 * 需要：ebook.js（EB、EB_*、EB_C）、ebook-plan.js（ebSt、ebWrapCJK、EB_PRE_* / EB_APX_*）、draw-kit.js（exText、exFont、exWrap、exCover、exLoad、EX_TITLE、EX_TEXT）、
 *       shared/idphoto.js（isIdPhoto、drawIdPhoto）、import.js（socOf）
 */
'use strict';
/* ---- 画页面 ---- */
let EB_BGI = { cover: null, page: null };   // 背景图片（ebPrepare() 读好）
function ebPaper(kind = 'page') {
  const cv = document.createElement('canvas'); cv.width = EB_PW; cv.height = EB_PH;
  const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.fillStyle = EB_C.paper; g.fillRect(0, 0, EB_PW, EB_PH);
  const bg = EB_BGI[kind];
  if (bg && bg.naturalWidth) {   // 按比例铺满（多出来的裁掉），再盖一层淡化
    const s = Math.max(EB_PW / bg.naturalWidth, EB_PH / bg.naturalHeight), w = bg.naturalWidth * s, h = bg.naturalHeight * s;
    g.drawImage(bg, (EB_PW - w) / 2, (EB_PH - h) / 2, w, h);
    const fade = kind === 'cover' ? EB.coverFade : EB.bgFade;   // 封面和每页分开（用户定 2026-11-23）
    if (fade) { g.globalAlpha = fade / 100; g.fillStyle = EB_C.paper; g.fillRect(0, 0, EB_PW, EB_PH); g.globalAlpha = 1; }
  }
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  return { cv, g };
}
function ebFrame(g) {   // 封面、分隔页、封底的金色双线框（EB.frame 关掉就不画）
  if (!EB.frame) return;
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
  const gr = g.createLinearGradient(0, y - h, 0, y);   // 深色纸用亮一点的金色渐层
  gr.addColorStop(0, thC(EB_C.dark ? '#f2d98f' : '#c99d48')); gr.addColorStop(1, thC(EB_C.dark ? '#c39a45' : '#8c6a28')); return gr;
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


// 两端对齐画一行：多出来的空白平均分给每个字之间（中文书的排法）；差太多（> 半个字）就不拉开
function ebJustify(g, t, st, px, x, y, w) {
  exFont(g, st, EX_TEXT, px); g.fillStyle = st.color;
  const cs = [...t], nat = g.measureText(t).width, extra = cs.length > 1 ? (w - nat) / (cs.length - 1) : 0;
  if (extra <= 0 || extra > px * .5) { g.fillText(t, x, y); if ('letterSpacing' in g) g.letterSpacing = '0px'; return; }
  for (const c of cs) { g.fillText(c, x, y); x += g.measureText(c).width + extra; }
  if ('letterSpacing' in g) g.letterSpacing = '0px';
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
      g.save(); g.beginPath(); g.roundRect(X, a - f * .3, W, b - a + f * .7, 12); g.fillStyle = EB_C.band; g.fill(); g.restore();
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
  // Logo 大小、位置（用户定 2026-11-23）：基准高度 标题上方 330 / 角落、底部 220，乘 EB.logoSize %；微调 = 页面宽 / 高的 %
  const lg = logo && logo.naturalWidth ? (() => { const h = (EB.logoPos === 'top' ? 330 : 220) * EB.logoSize / 100; return { h, w: h * logo.naturalWidth / logo.naturalHeight, dx: EB.logoX / 100 * EB_PW, dy: EB.logoY / 100 * EB_PH }; })() : null;
  const draw = (g, y0) => {
    const cx = EB_PW / 2; let y = y0;
    if (lg && EB.logoPos === 'top') { g.drawImage(logo, cx - lg.w / 2 + lg.dx, y + lg.dy, lg.w, lg.h); y += lg.h + 110; }   // 标题上方：跟着整块排
    if (EB.coverKicker) { y += 46; exText(g, EB.coverKicker, ebSt(EB_C.gold2, true, .25), EX_TEXT, 46, cx, y, EB_CW * .9); y += 40; }   // 小标题：活动名称上面一行
    const tp = 118, title = ev.title || '表扬大会';
    // 年份单独一行（用户定 2026-11-21）：活动名称开头是 4 位数年份（可带「年」）时，第一行年份、第二行其余
    const ym = EB.coverYear && title.match(EB_YEAR_RE);
    if (ym) {
      const yp = tp * 1.25;
      exText(g, ym[1] + (ym[2] || ''), ebSt(ebGoldText(g, y + yp, yp), true, .12), EX_TITLE, yp, cx, y + yp, EB_CW * .9);
      y = ebLines(g, ym[3].trim(), ebSt(ebGoldText(g, y + yp + tp * 1.3, tp)), EX_TITLE, tp, cx, y + yp + tp * 1.3, EB_CW * .9, 1.2);
    } else y = ebLines(g, title, ebSt(ebGoldText(g, y + tp, tp)), EX_TITLE, tp, cx, y + tp, EB_CW * .9, 1.2);
    if (ev.subtitle && EB.coverEvSub) y = ebLines(g, ev.subtitle, ebSt(EB_C.muted, false, .06), EX_TEXT, 44, cx, y + 90, EB_CW * .85);
    if (EB.coverSub) { y += 120; exText(g, EB.coverSub, ebSt(EB_C.ink, true, .3), EX_TITLE, 64, cx, y, EB_CW); }
    y += 80; ebRule(g, cx, y, 520);
    const info = [ev.date, ev.time, ev.venue].filter(Boolean).join(' · ');
    if (info && EB.coverInfo) { y += 90; exText(g, info, ebSt(EB_C.muted, false, .04), EX_TEXT, 40, cx, y, EB_CW); }
    return y - y0;
  };
  const d = ebPaper(); const h = draw(d.g, 0);   // 先量高度，整块垂直置中
  // 标题位置（用户定 2026-11-23）：中间 = 原本的垂直置中；上方 / 下方离边 260；再加上下微调
  const y0 = (EB.titlePos === 'top' ? 260 : EB.titlePos === 'bottom' ? EB_PH - h - 260 : Math.max(260, (EB_PH - h) / 2 - 60)) + EB.titleY / 100 * EB_PH;
  const { cv, g } = ebPaper('cover'); ebFrame(g); draw(g, y0);
  if (lg && EB.logoPos !== 'top') {   // 角落 / 底部：不占排版位置，离边 130
    const M = 130, x = EB.logoPos === 'tl' ? M : EB.logoPos === 'tr' ? EB_PW - M - lg.w : (EB_PW - lg.w) / 2, y = EB.logoPos === 'bc' ? EB_PH - M - lg.h : M;
    g.drawImage(logo, x + lg.dx, y + lg.dy, lg.w, lg.h);
  }
  return cv;
}
function ebDrawToc(p, n, ev) {
  const { cv, g } = ebPaper(); let y = EB_MT;
  if (p.first) { y += 110; exText(g, '目录', ebSt(EB_C.ink, true, .4), EX_TITLE, 84, EB_PW / 2, y, EB_CW); ebRule(g, EB_PW / 2, y + 50, 360); y = EB_MT + EB_TOC_HEAD; }
  for (const e of p.rows) {
    y += EB_TOC_LH;
    if (e.l === -1) y += 14;   // 部门：前面多空一点
    const ind = { '-1': 0, 0: 0, 1: 40, 2: 90, 3: 40 }[e.l] + (e.d ? 40 : 0), px = e.l === -1 ? 46 : e.l === 0 ? 40 : e.l === 1 ? 36 : 34;
    const st = ebSt(e.l === -1 ? EB_C.gold2 : e.l === 0 ? EB_C.gold : EB_C.ink, e.l < 2, e.l === -1 ? .08 : 0), x0 = EB_MX + ind, numW = 90;
    g.textAlign = 'left';
    const fam = e.l <= 0 ? EX_TITLE : EX_TEXT, s = exText(g, e.t, st, fam, px, x0, y, EB_CW - ind - numW - 60);
    exFont(g, st, fam, s); const tw = g.measureText(e.t).width;
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
  const ym = EB.secYear && a.section.match(EB_YEAR_RE), main = ym ? ym[3].trim() : a.section;   // 例：「2026年」一行、「成果汇报竞赛奖」一行（用户定 2026-11-21）
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
  if (p.k === 'section' || p.k === 'dept') return ebDrawSection(p, n, ctx.ev);   // 部门分隔页和大类分隔页同一种版式（不写「部门」两个字，用户定 2026-11-23）
  if (p.k === 'back') return ebDrawBack(n, ctx.ev);
  if (p.k === 'appendix') return ebDrawAppendix(p, n, ctx.ev);
  return ebDrawFlow(p, n, ctx.ev, ctx.fam);
}
