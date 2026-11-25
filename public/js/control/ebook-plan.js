/*
 * 控制端 · 电子书（二）排版计划（1.95 从 ebook.js 拆出来，内容不变）：先决定每一页放什么（不画），目录才知道页码。
 *   ebPlan()（封面 → 前言 → 目录 → 集锦 → 分隔页 → 奖项 → 花絮 → 编委 → 附录 → 封底）、ebCap()、ebPhotoPages() / ebPortBoxes()（直的照片怎么放）、
 *   前言分页 ebPrefaceLayout()（ebWrapCJK 按字换行、标点不放行首）、附录分页 ebApxParse() → ebApxRows() → ebApxCols() → ebAppendixLayout()、ebSt()
 * 需要：ebook.js（EB、EB_* 尺寸常量、EB_C）、draw-kit.js（exFont、exWrap、EX_TEXT）
 */
'use strict';
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
  let cur = null, used = 0, sec = null, grp = null, secNo = 0, dep = null, inDept = false;
  const newPage = () => { cur = { k: 'flow', items: [] }; body.push(cur); used = 0; };
  const put = (it, h) => { cur.items.push({ ...it, y: used }); used += h; };
  for (const [i, a] of list.entries()) {
    if ((a.dept || '') !== dep) {   // 新的部门：一页分隔页（列出里面的大类；没有大类就列分类 / 奖项），大类编号重新从 01 算
      dep = a.dept || ''; sec = null; grp = null; secNo = 0; inDept = !!dep;
      if (dep) {
        const items = [];
        for (let j = i; j < list.length && (list[j].dept || '') === dep; j++) {
          const t = list[j].section || list[j].group || list[j].title; if (items[items.length - 1] !== t) items.push(t);
        }
        const sub = (list.find(x => x.dept === dep && x.deptSub) || {}).deptSub || '';
        toc.push({ l: -1, t: dep, p: body.length });
        body.push({ k: 'dept', a: { section: dep, sectionSub: sub }, items, no: '' });
        cur = null;
      }
    }
    if ((a.section || '') !== sec) {
      sec = a.section || ''; grp = null;
      if (sec) {   // 大类分隔页：列出里面的分类（没分类的奖项列奖项名）；「大类画面不列分类」任一奖项设了就算
        const items = []; let noList = false, noNum = false;
        for (let j = i; j < list.length && (list[j].section || '') === sec; j++) {
          const t = list[j].group || list[j].title; if (items[items.length - 1] !== t) items.push(t);
          noList = noList || !!list[j].sectionNoList; noNum = noNum || !!list[j].sectionNoNum;
        }
        secNo++;
        toc.push({ l: 0, t: sec, p: body.length, d: inDept });
        body.push({ k: 'section', a, items: noList ? [] : items, no: noNum ? '' : String(secNo).padStart(2, '0') });
        cur = null;
      }
    }
    if (a.group && a.group !== grp) {   // 新的分类：从新的一页开始
      if (!cur || cur.items.length) newPage();
      toc.push({ l: 1, t: a.group, p: body.length - 1, d: inDept });
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
    toc.push({ l: a.group ? 2 : 3, t: a.title, p: body.length - 1, n: a.winners.length, d: inDept });
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
  if (p.k === 'dept') return '部门：' + p.a.section;
  const aw = p.items.filter(x => x.t === 'award').map(x => x.a.title);
  return [...new Set(aw)].join(' · ');
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
          g.fillStyle = EB_C.chip; g.fill(); g.strokeStyle = EB_C.gold2; g.lineWidth = 2; g.stroke(); g.restore();
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
