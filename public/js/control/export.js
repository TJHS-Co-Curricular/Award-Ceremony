/*
 * 控制端 · 图片导出分页：每位得奖者一张成品图（canvas 绘制），打包成 ZIP；全部在浏览器里完成，离线可用。
 * 设计存在服务端 data/export-style.json。默认字体读 css/fonts.css（和大屏同一份）。
 * 提供：exOpen()、exFillSel()、HTML_FONT
 * 需要：shared/zip.js（makeZip）、shared/fonts.js、fonts.js（fontPrefix、fontFiles）
 */
'use strict';

// 默认字体 = css/fonts.css 的 --font-serif / --font-sans（和大屏同一份，不用手动同步）
const fontCss = getComputedStyle(document.documentElement);
const HTML_FONT = { serif: fontCss.getPropertyValue('--font-serif').trim(), sans: fontCss.getPropertyValue('--font-sans').trim() };
// 和大屏同一套规则：中文字体 + 英文 / 数字字体套用到所有文字；没设时，奖项名用宋体（serif），其它用黑体（sans）
let EX_TITLE = HTML_FONT.serif, EX_TEXT = HTML_FONT.sans;

/* 设计（存在服务端 data/export-style.json）。字号单位 pt（PowerPoint 16:9 投影片高 540pt，任何导出尺寸都等比例）。
 * 默认值量自 Picture3。团体图会按固定比例换算（上方 ×1.6、名字 ×0.9 …），不用另外设。 */
const EX_ELEMS = [
  ['top', '上方分类（中文）'], ['topEn', '上方分类（英文）'], ['name', '姓名 / 团体名'], ['cls', '班级'], ['sid', '学号'],
  ['soc', '学会（中文）'], ['socEn', '学会（英文）'], ['award', '下方奖项名'], ['awardEn', '下方奖项（英文）']
];
const el0 = (size, color, bold, spacing = 0) => ({ show: true, size, color, bold, italic: false, spacing, font: '' });
const EX_PRESET = () => ({
  elems: {
    top: el0(17, '#eaea0c', true), topEn: el0(17, '#eaea0c', true),
    name: el0(40, '#fafa98', true), cls: el0(40, '#fafa98', true), sid: el0(40, '#fafa98', true),
    soc: el0(40, '#fafa98', true, .14), socEn: el0(25.6, '#fafa98', true),
    award: el0(36, '#ffffff', false, .1), awardEn: el0(21.6, '#ffffff', false)
  },
  shade: 50,        // 个人图左半边加暗（%）
  shadow: 60,       // 文字阴影强度（%）
  textX: 25,        // 个人图文字中心的横向位置（画面宽度 %）
  nameY: 36.7,      // 个人图姓名的纵向位置（画面高度 %）
  teamBg: '#07060c', teamFrame: '#d9b25f', teamGlow: true,
  logoOn: true, logoSize: 16, logoMargin: 2.5, logoOpacity: 100,   // 照片右上角的学校 Logo（「效果控制」上传）；大小、边距 = 照片宽度 %
  size: '1920x1080', fmt: 'jpg'
});
// 读回来的设计要检查一遍：缺的补默认值、数字限制范围、颜色必须是 #rrggbb
function exClean(v) {
  const d = EX_PRESET(), num = (x, lo, hi, def) => (Number.isFinite(+x) ? Math.min(hi, Math.max(lo, +x)) : def);
  const col = (x, def) => (/^#[0-9a-f]{6}$/i.test(x) ? x : def);
  const o = { ...d, elems: {} };
  for (const [k] of EX_ELEMS) {
    const a = (v?.elems || {})[k] || {}, b = d.elems[k];
    o.elems[k] = { show: a.show !== false, size: num(a.size, 4, 150, b.size), color: col(a.color, b.color), bold: a.bold == null ? b.bold : !!a.bold,
      italic: !!a.italic, spacing: num(a.spacing, -.2, 2, b.spacing), font: String(a.font || '').slice(0, 120) };
  }
  o.shade = num(v?.shade, 0, 100, d.shade); o.shadow = num(v?.shadow, 0, 100, d.shadow);
  o.textX = num(v?.textX, 15, 50, d.textX); o.nameY = num(v?.nameY, 15, 70, d.nameY);
  o.teamBg = col(v?.teamBg, d.teamBg); o.teamFrame = col(v?.teamFrame, d.teamFrame); o.teamGlow = v?.teamGlow !== false;
  o.logoOn = v?.logoOn !== false; o.logoSize = num(v?.logoSize, 4, 50, d.logoSize); o.logoMargin = num(v?.logoMargin, 0, 10, d.logoMargin); o.logoOpacity = num(v?.logoOpacity, 20, 100, d.logoOpacity);
  o.size = ['1920x1080', '3840x2160', 'photo'].includes(v?.size) ? v.size : d.size;
  o.fmt = v?.fmt === 'png' ? 'png' : 'jpg';
  return o;
}
let EXS = EX_PRESET(), exLoaded = false, exSaveT = 0, exPvT = 0;

async function exUseFonts() {   // 先解析每一项要用的字体（跟随大屏，或在本分页单独指定）
  const pre = await fontPrefix();
  EX_TITLE = pre ? `${pre}, ${HTML_FONT.serif}` : HTML_FONT.serif;
  EX_TEXT = pre ? `${pre}, ${HTML_FONT.sans}` : HTML_FONT.sans;
  const fam = {};
  for (const [k] of EX_ELEMS) {
    const own = EXS.elems[k].font ? await fontFamily(EXS.elems[k].font, 'ex_' + k) : '';
    const base = k === 'award' ? EX_TITLE : EX_TEXT;
    fam[k] = own ? `${own}, ${base}` : base;
  }
  fam.topAward = EXS.elems.top.font ? fam.top : EX_TITLE;   // 没有分类时，上方放的是奖项名 → 默认用奖项名的字体
  await Promise.all(Object.values(fam).map(f => document.fonts.load(`700 40px ${f}`, '陈A'))).catch(() => {});
  return fam;
}
const exImgCache = new Map();
function exLoad(name) {
  if (!name) return Promise.resolve(null);
  if (!exImgCache.has(name)) exImgCache.set(name, loadImg('/api/control/photo?name=' + encodeURIComponent(name)).catch(() => null));
  return exImgCache.get(name);
}
// 学校 Logo（V.logo = 版本标记，换了 Logo 就重新读）
let exLogoImg = { ver: null, p: null };
function exLoadLogo() {
  const ver = V?.logo || '';
  if (exLogoImg.ver !== ver) exLogoImg = { ver, p: ver ? loadImg('/media/logo?v=' + encodeURIComponent(ver)).catch(() => null) : Promise.resolve(null) };
  return exLogoImg.p;
}
// 在照片（x, y, 宽 w）右上角画 Logo：正方形框 = w × 大小%，Logo 按原比例缩进框里、贴右上角，不变形
function exLogo(g, logo, x, y, w) {
  const S = EXS; if (!logo || !S.logoOn || !logo.naturalWidth) return;
  const box = w * S.logoSize / 100, m = w * S.logoMargin / 100, k = Math.min(box / logo.naturalWidth, box / logo.naturalHeight);
  const lw = logo.naturalWidth * k, lh = logo.naturalHeight * k;
  g.save(); g.globalAlpha = S.logoOpacity / 100; g.shadowColor = 'transparent';
  g.drawImage(logo, x + w - m - lw, y + m, lw, lh);
  g.restore();
}
function exWrap(g, text, maxW) {   // 英文按单词换行；中文按字换行
  const parts = /\s/.test(text) ? text.split(/(\s+)/) : [...text], lines = [];
  let cur = '';
  for (const p of parts) { const t = cur + p; if (cur && g.measureText(t.trim()).width > maxW) { lines.push(cur.trim()); cur = p.trimStart(); } else cur = t; }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}
function exCover(g, img, x, y, w, h) {   // 照片居中裁切铺满
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k;
  g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
// 按设计画一行字：字号 / 粗体 / 斜体 / 字距 / 颜色；太宽就缩小。返回实际字号（像素）
function exFont(g, st, fam, px) {
  g.font = `${st.italic ? 'italic ' : ''}${st.bold ? 700 : 400} ${px}px ${fam}`;
  if ('letterSpacing' in g) g.letterSpacing = (st.spacing * px) + 'px';
}
function exText(g, text, st, fam, px, x, y, maxW) {
  let s = px;
  for (;;) { exFont(g, st, fam, s); if (g.measureText(text).width <= maxW || s < 8) break; s *= .94; }
  g.fillStyle = st.color;
  g.fillText(text, x + ('letterSpacing' in g ? st.spacing * s / 2 : 0), y);   // 字距会在最后一个字后面多出一段，居中时补回来
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  return s;
}

async function exRender(award, w, fam) {
  const S = EXS, E = S.elems, img = await exLoad(w.photo), logo = img ? await exLoadLogo() : null;   // Logo 和大屏一样：有照片才加
  let W = S.size === 'photo' && img ? img.naturalWidth : +S.size.split('x')[0], H = S.size === 'photo' && img ? img.naturalHeight : +S.size.split('x')[1];
  if (!W || !H) { W = 1920; H = 1080; }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
  const team = w.type === 'team', U = Math.min(H, W / 1.5), k = U / 540;   // pt → 像素
  const shadow = on => { const a = S.shadow / 100; g.shadowColor = on && a ? `rgba(0,0,0,${Math.min(1, a * 1.25)})` : 'transparent'; g.shadowBlur = on ? U * .02 * a : 0; g.shadowOffsetX = g.shadowOffsetY = on ? U * .005 * a : 0; };
  // 备注 = 学会，例如「学长团Prefectorial Board」：中文和英文分两行
  const sm = String(w.detail || '').match(/^(.*[　-鿿＀-￯])\s*([A-Za-z].*)$/);
  const soc = sm ? [sm[1].trim(), sm[2].trim()] : w.detail ? [w.detail] : [];
  // 有分类：上方 = 分类，下方 = 奖项名；没分类：上方 = 奖项名，下方不重复
  const head = award.group ? [award.group, award.groupSub] : [award.title, award.subtitle];
  const headFam = award.group ? fam.top : fam.topAward;
  const tail = award.group ? [award.title, award.subtitle] : ['', ''];
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';

  if (!team) {
    // ---- 个人：照片铺满，左边加暗，文字在左边居中
    if (img) exCover(g, img, 0, 0, W, H);
    else { const bg = g.createLinearGradient(0, 0, W, 0); bg.addColorStop(0, '#55535a'); bg.addColorStop(.5, '#77757b'); bg.addColorStop(.5, '#a57a22'); bg.addColorStop(1, '#c79530'); g.fillStyle = bg; g.fillRect(0, 0, W, H); }
    const cx = W * S.textX / 100, maxW = W * Math.min(S.textX, 100 - S.textX) * 2 / 100 * .94, sw = W * Math.min(1, (S.textX * 2 + 6) / 100), a = S.shade / 100;
    if (a > 0) {
      const sh = g.createLinearGradient(0, 0, sw, 0);
      sh.addColorStop(0, `rgba(0,0,0,${a})`); sh.addColorStop(.86, `rgba(0,0,0,${a * .84})`); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh; g.fillRect(0, 0, sw, H);
    }
    exLogo(g, logo, 0, 0, W);
    shadow(true);
    let y = H * .115;
    if (E.top.show && head[0]) exText(g, head[0], E.top, headFam, E.top.size * k, cx, y, maxW);
    if (E.topEn.show && head[1]) {
      const st = E.topEn, px = st.size * k; exFont(g, st, fam.topEn, px);
      const lines = exWrap(g, head[1].toUpperCase(), W * Math.min(S.textX, 100 - S.textX) * 2 / 100 * .99);
      for (const ln of lines) { y += px * 1.27; exText(g, ln, st, fam.topEn, px, cx, y, W); }
    }
    const mid = [['name', w.name], ['cls', w.cls], ['sid', w.sid], ['soc', soc[0]], ['socEn', soc[1]]].filter(([key, t]) => t && E[key].show);
    const big = E.name.size;
    y = Math.max(H * S.nameY / 100, y + big * k * 1.9);
    mid.forEach(([key, t], i) => {
      const st = E[key];
      if (i) y += st.size * k * (st.size < big * .9 ? 1.32 : 1.2);
      exText(g, t, st, fam[key], st.size * k, cx, y, maxW);
    });
    const bottom = [['award', tail[0]], ['awardEn', tail[1]]].filter(([key, t]) => t && E[key].show);
    bottom.forEach(([key, t], i) => {
      const st = E[key];
      y += st.size * k * (i ? 1.5 : 2.2);
      exText(g, t, st, fam[key], st.size * k, cx, y, maxW);
    });
  } else {
    // ---- 团体：背景色 → 上方分类 → 合照完整居中（带相框）→ 团体名、学会、奖项名在照片下面
    g.fillStyle = S.teamBg; g.fillRect(0, 0, W, H);
    if (S.teamGlow) {
      const glow = g.createRadialGradient(W / 2, H * .42, 0, W / 2, H * .42, Math.max(W, H) * .6);
      glow.addColorStop(0, 'rgba(217,178,95,.16)'); glow.addColorStop(1, 'rgba(217,178,95,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
    }
    const cx = W / 2, maxW = W * .86;
    shadow(true);
    let y = H * .04;
    if (E.top.show && head[0]) { const px = E.top.size * k * 1.6; y += px * .95; exText(g, head[0], E.top, headFam, px, cx, y, maxW); }
    if (E.topEn.show && head[1]) { const px = E.topEn.size * k * 1.3; y += px * 1.3; exText(g, head[1].toUpperCase(), E.topEn, fam.topEn, px, cx, y, maxW); }
    shadow(false);
    const top = y + U * .045;
    const zh = soc[0] === w.name ? '' : soc[0];   // 团体名就是学会名时，不重复写中文
    const block = [['name', w.name, .9], ['soc', zh, .7], ['socEn', soc[1], .78], ['award', tail[0], .8], ['awardEn', tail[1], 1]].filter(([key, t]) => t && E[key].show);
    const capH = block.reduce((t, [key, , m]) => t + E[key].size * k * m * 1.3, 0) + U * .05;
    const ar = img ? img.naturalWidth / img.naturalHeight : 1.5, boxH = H - top - capH - H * .05;
    let ph = Math.max(10, boxH), pw = ph * ar;
    if (pw > W * .84) { pw = W * .84; ph = pw / ar; }
    const px0 = (W - pw) / 2, py = top + (boxH - ph) / 2;
    g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = U * .03; g.shadowOffsetY = U * .01; g.fillStyle = '#000'; g.fillRect(px0, py, pw, ph); g.restore();
    if (img) g.drawImage(img, px0, py, pw, ph);
    else { const gr = g.createRadialGradient(px0 + pw / 2, py + ph * .35, 0, px0 + pw / 2, py + ph * .35, pw * .7); gr.addColorStop(0, '#a9822f'); gr.addColorStop(1, '#3e3016'); g.fillStyle = gr; g.fillRect(px0, py, pw, ph); }
    g.strokeStyle = S.teamFrame; g.lineWidth = Math.max(2, U * .003); g.strokeRect(px0, py, pw, ph);
    exLogo(g, logo, px0, py, pw);
    y = py + ph + U * .03;
    shadow(true);
    block.forEach(([key, t, m], i) => {
      const st = E[key], px = st.size * k * m;
      y += px; exText(g, t, st, fam[key], px, cx, y, maxW); y += px * .3;
      if (i === 0 && block.length > 1) {   // 名字下面一条线（相框颜色）
        shadow(false);
        const lw = U * .16, ln = g.createLinearGradient(cx - lw / 2, 0, cx + lw / 2, 0);
        ln.addColorStop(0, S.teamFrame + '00'); ln.addColorStop(.5, S.teamFrame); ln.addColorStop(1, S.teamFrame + '00');
        g.fillStyle = ln; g.fillRect(cx - lw / 2, y, lw, Math.max(2, U * .003)); y += U * .012;
        shadow(true);
      }
    });
  }
  shadow(false);
  return cv;
}

const safeFile = t => String(t || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 60) || '未命名';

/* ---- 分页界面 ---- */
function exAwards() { return draft ? draft.awards.filter(a => a.winners.length) : []; }
function exFillSel() {
  const sel = $('exAward'), keep = sel.value, list = exAwards();
  sel.replaceChildren(...list.map((a, i) => el('option', { value: String(i) }, `${a.group ? a.group + ' · ' : ''}${a.title}（${a.winners.length}）`)));
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
  exFillWho();
}
function exFillWho() {
  const a = exAwards()[+$('exAward').value || 0], sel = $('exWho'), keep = sel.value;
  sel.replaceChildren(...(a ? a.winners : []).map((w, i) => el('option', { value: String(i) }, `${i + 1}. ${w.type === 'team' ? '👥 ' : ''}${w.name}`)));
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
}
// 每一项文字一行：显示 / 字号 / 颜色 / 粗体 / 斜体 / 字距 / 字体
function exBuildUI() {
  const tb = $('exElems'); tb.textContent = '';
  for (const [key, label] of EX_ELEMS) {
    // 注意：exChanged() 会把 EXS 整理成新对象，所以每次都按 key 取最新的那一份，不能抓住旧对象
    const st = EXS.elems[key], set = (prop, v) => { EXS.elems[key][prop] = v; exChanged(); };
    const chk = (prop, txt, title) => { const x = el('input', { type: 'checkbox', title, style: 'width:auto' }); x.checked = st[prop]; x.onchange = () => set(prop, x.checked); return el('label', { class: 'xchk', title }, x, txt); };
    const n = (prop, step, w) => { const x = el('input', { type: 'number', step, style: `width:${w}px;text-align:center` }); x.value = st[prop]; x.oninput = () => { if (x.value !== '') set(prop, +x.value); }; return x; };
    const c = el('input', { type: 'color', style: 'width:38px;height:28px;padding:1px' }); c.value = st.color; c.oninput = () => set('color', c.value);
    const f = el('input', { list: 'exFontList', placeholder: '跟随大屏', style: 'width:100%;min-width:90px' }); f.value = st.font; f.onchange = () => set('font', f.value.trim());
    tb.append(el('tr', { class: st.show ? '' : 'off' },
      el('td', {}, chk('show', '', '显示这一项'), ' ', label),
      el('td', {}, n('size', '0.5', 68)),
      el('td', {}, c),
      el('td', {}, chk('bold', 'B', '粗体'), chk('italic', 'I', '斜体')),
      el('td', {}, n('spacing', '0.02', 58)),
      el('td', {}, f)));
  }
  for (const id of ['shade', 'shadow', 'textX', 'nameY', 'logoSize', 'logoMargin', 'logoOpacity']) { $('exG_' + id).value = EXS[id]; $('exG_' + id + 'V').textContent = EXS[id] + '%'; }
  $('exG_logoOn').checked = EXS.logoOn;
  $('exLogoInfo').textContent = V?.logo ? '' : '还没上传（在「效果控制」上传）';
  $('exG_teamBg').value = EXS.teamBg; $('exG_teamFrame').value = EXS.teamFrame; $('exG_teamGlow').checked = EXS.teamGlow;
  $('exSize').value = EXS.size; $('exFmt').value = EXS.fmt;
}
function exChanged(rebuild) {
  EXS = exClean(EXS);
  if (rebuild) exBuildUI();
  [...$('exElems').children].forEach((tr, i) => tr.classList.toggle('off', !EXS.elems[EX_ELEMS[i][0]].show));
  clearTimeout(exPvT); exPvT = setTimeout(() => exPreview().catch(e => toast(e.message, true)), 150);
  $('exSaveState').textContent = '● 未保存'; $('exSaveState').className = 'dirty';
  clearTimeout(exSaveT); exSaveT = setTimeout(exSave, 800);
}
async function exSave() {
  try { await api('PUT', '/api/control/export-style', EXS); $('exSaveState').textContent = '设计已保存'; $('exSaveState').className = 'muted'; }
  catch (e) { $('exSaveState').textContent = '保存失败：' + e.message; }
}
for (const id of ['shade', 'shadow', 'textX', 'nameY', 'logoSize', 'logoMargin', 'logoOpacity']) $('exG_' + id).oninput = e => { EXS[id] = +e.target.value; $('exG_' + id + 'V').textContent = e.target.value + '%'; exChanged(); };
$('exG_teamBg').oninput = e => { EXS.teamBg = e.target.value; exChanged(); };
$('exG_teamFrame').oninput = e => { EXS.teamFrame = e.target.value; exChanged(); };
$('exG_teamGlow').onchange = e => { EXS.teamGlow = e.target.checked; exChanged(); };
$('exG_logoOn').onchange = e => { EXS.logoOn = e.target.checked; exChanged(); };
$('exSize').onchange = () => { EXS.size = $('exSize').value; exChanged(); };
$('exFmt').onchange = () => { EXS.fmt = $('exFmt').value; exChanged(); };
$('exAward').onchange = () => { exFillWho(); exPreview().catch(e => toast(e.message, true)); };
$('exWho').onchange = () => exPreview().catch(e => toast(e.message, true));
$('bExPreset').onclick = () => { if (confirm('把所有设定恢复成 Picture3 的预设？')) { const keep = { size: EXS.size, fmt: EXS.fmt }; EXS = { ...EX_PRESET(), ...keep }; exChanged(true); } };
async function exOpen() {   // 切到「图片导出」分页时
  if (!exLoaded) { try { EXS = exClean((await api('GET', '/api/control/export-style')).style); } catch { EXS = EX_PRESET(); } exLoaded = true; }
  try { fontFiles = (await api('GET', '/api/control/fonts')).fonts; } catch {}
  $('exFontList').replaceChildren(...fontFiles.map(f => el('option', { value: 'file:' + f.name }, '📄 ' + f.name)));
  exFillSel(); exBuildUI(); exPreview().catch(e => toast(e.message, true));
}
async function exPreview() {
  const list = exAwards(); if (!list.length) { $('exPvCap').textContent = '还没有得奖者'; return; }
  const a = list[+$('exAward').value || 0] || list[0], w = a.winners[+$('exWho').value || 0] || a.winners[0];
  const fam = await exUseFonts();
  const cv = await exRender(a, w, fam);
  const pv = $('exPv'), PW = 1280; pv.width = PW; pv.height = Math.round(PW * cv.height / cv.width);
  pv.getContext('2d').drawImage(cv, 0, 0, pv.width, pv.height);
  $('exPvCap').textContent = `预览：${a.title} · ${w.name}（输出 ${cv.width}×${cv.height}）`;
}
async function exExport(all) {
  const list = exAwards(), awards = all ? list : [list[+$('exAward').value || 0]].filter(Boolean);
  const total = awards.reduce((t, a) => t + a.winners.length, 0);
  if (!total) return toast('没有可导出的得奖者', true);
  const fmt = EXS.fmt, files = [], btns = [$('bExportOne'), $('bExportAll')];
  btns.forEach(b => (b.disabled = true));
  try {
    const fam = await exUseFonts();
    let k = 0;
    for (const a of awards) {
      const dir = `${String(list.indexOf(a) + 1).padStart(2, '0')}-${safeFile(a.title)}`;
      for (const [wi, w] of a.winners.entries()) {
        $('exProg').textContent = `生成中 ${++k}/${total}…`; $('exBar').style.width = (k / total * 100) + '%';
        const cv = await exRender(a, w, fam);
        const blob = await new Promise(r => cv.toBlob(r, fmt === 'png' ? 'image/png' : 'image/jpeg', .92));
        const tag = a.revealMode === 'nominee' && w.win ? '-得主' : '';
        files.push({ name: `${dir}/${String(wi + 1).padStart(3, '0')}-${safeFile(w.name)}${tag}.${fmt}`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
    }
    const zip = makeZip(files), url = URL.createObjectURL(zip);
    const name = `${safeFile(draft.event.title)}-图片导出${awards.length === 1 ? '-' + safeFile(awards[0].title) : ''}.zip`;
    const link = el('a', { href: url, download: name, style: 'display:none' }); document.body.append(link); link.click();
    setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 60000);
    toast(`已导出 ${files.length} 张图片（${mb(zip.size)}）`); log(`图片导出 ${files.length} 张`);
    $('exProg').textContent = `完成：${files.length} 张，${mb(zip.size)}`;
  } catch (e) { toast('导出失败：' + e.message, true); $('exProg').textContent = ''; }
  finally { btns.forEach(b => (b.disabled = false)); setTimeout(() => { $('exBar').style.width = '0'; }, 1500); }
}
$('bExportOne').onclick = () => exExport(false);
$('bExportAll').onclick = () => exExport(true);
