/*
 * 大屏 · 揭晓画面的名字卡：按人数排版（纯文字 / 照片卡 / 团体照片在上）、填入得奖者、自动缩字。
 * 提供：buildGrid(view)、fillCard(card, winner, animate)、fitText(el)、fitNote(box)、div(cls, text)、logoSet(url)
 * 需要：stage.js（$、SW、SH、KEY）、shared/idphoto.js（drawIdPhoto）
 */
'use strict';

/* 无照片：选出让名字最大的行列数 */
// oneRow（逐一揭晓）：排成一行时名字还有 48 px（舞台像素，1080 高的画面）以上，就排成一行（「中间出、左右收」在一行里最好看）
function planText(n, W, H, oneRow = false) {
  let best = null, row = null;
  const cap = n === 1 ? 150 : n <= 3 ? 110 : 96;
  for (let cols = 1; cols <= Math.min(n, 16); cols++) {
    const rows = Math.ceil(n / cols);
    const gap = n > 40 ? 12 : n > 12 ? 16 : n > 8 ? 22 : 30;
    const cw = Math.min((W - (cols - 1) * gap) / cols, n === 1 ? 1100 : n === 2 ? 760 : n === 3 ? 560 : 1e9);
    const ch = Math.min((H - (rows - 1) * gap) / rows, n <= 3 ? 380 : 1e9);
    const pad = Math.max(6, Math.min(20, Math.min(cw, ch) * .07));
    const name = Math.min((cw - 2 * pad) / 4.8, (ch - 2 * pad) / 2.1, cap);
    if (name < 11) continue;
    const score = name - Math.abs(Math.log(cw / ch / 2)) * 2 - (n <= 3 ? rows * 10 : rows * .01);   // 1~3 人优先排成一行   // 字号优先，其次卡片别太扁或太高
    if (!best || score > best.score) best = { cols, rows, gap, cw, ch, name, score };
    if (cols === n) row = { cols, rows, gap, cw, ch, name, score };
  }
  if (oneRow && row && row.name >= 48) return { ...row, ch: Math.min(row.ch, Math.max(row.cw * .62, row.name * 2.6)) };   // 一行时卡片别拉得太高
  return best || { cols: Math.ceil(Math.sqrt(n * 2)), rows: Math.ceil(n / Math.ceil(Math.sqrt(n * 2))), gap: 8, cw: 100, ch: 30, name: 11 };
}
function layout(n, photos) {
  const T = [[1,1,150,46],[2,2,104,36],[3,3,84,30],[4,2,84,30],[6,3,70,28],[8,4,60,26],[12,4,52,24],[15,5,46,22],[20,5,40,20],[30,6,34,18],[48,8,28,16],[1e9,10,22,14]];
  let [, cols, name, detail] = T.find(t => n <= t[0]);
  if (n === 4) cols = 2;
  const rows = Math.ceil(n / cols);
  if (photos) { name = Math.round(name * .85); }
  return { cols, rows, name, detail };
}
/* 有照片时：每人一张 3:2 照片卡（照片铺满，文字叠在左侧），按人数选出让卡片最大的行列数 */
const PHOTO_AR = 3 / 2;   // 照片比例（宽 / 高）；原图比例不同会居中裁切
const CAP_H = .27;        // 「名字在照片下面」版式里，文字区高度 = 卡片宽 × CAP_H
const NOTE_K = .8;
const NOTE_PIC_H = .86;    // 备注是图片时：16:9 图框高 = 卡片高 × NOTE_PIC_H（左右各留卡片高 × .06）        // 有备注的奖项：照片右边的备注框宽 = 照片部分宽 × NOTE_K（整张卡 = 照片 + 备注框）
// pk = 照片部分占卡片宽的比例（有备注框时 < 1）：「排成一行」「太小退回纯文字」都按照片部分的宽来判断
function planPhoto(n, W, H, AR = PHOTO_AR, oneRow = false, pk = 1) {
  let best = null, row = null;
  for (let cols = 1; cols <= Math.min(n, 16); cols++) {
    const rows = Math.ceil(n / cols);
    const gap = n > 24 ? 12 : n > 12 ? 16 : n > 6 ? 22 : 30;
    const cw = Math.min((W - (cols - 1) * gap) / cols, (H - (rows - 1) * gap) / rows * AR);
    if (!best || cw > best.cw + .5) best = { cols, rows, gap, cw, ch: cw / AR };
    if (cols === n) row = { cols, rows, gap, cw, ch: cw / AR };
  }
  if (oneRow && row && row.cw * pk >= 280) best = row;   // 同 planText 的 oneRow：照片宽 280 px 以上就排成一行
  return best && best.cw * pk >= 150 ? best : null;   // 太小就退回纯文字
}
function fitText(el) {
  let size = parseFloat(getComputedStyle(el).fontSize);
  let guard = 40;
  while (el.scrollWidth > el.clientWidth + 1 && size > 12 && guard--) { size *= .92; el.style.fontSize = size + 'px'; }
}
// 备注框：字太多就缩小（只缩字，框不变），最小 12 px
function fitNote(box) {
  const t = box.firstChild;
  if (!t || !box.isConnected || !box.clientHeight) return;   // 还没排版（看不见）就先不量
  t.style.fontSize = '';
  let size = parseFloat(getComputedStyle(t).fontSize), guard = 60;
  while ((t.scrollHeight > box.clientHeight * .9 || t.scrollWidth > t.clientWidth + 1) && size > 12 && guard--) { size *= .93; t.style.fontSize = size + 'px'; }
}
const div = (cls, text) => { const d = document.createElement('div'); d.className = cls; if (text != null) d.textContent = text; return d; };
/* 照片画进刚好卡片大小的 canvas（不用 <img>）：
 * <img> 会把原图整张解码并放进显卡（4000×3000 一张约 48 MB），OBS 内置浏览器 + 内置显卡时会越揭晓越多、把内存吃光。
 * 这里解码后马上缩成卡片的实际像素再丢掉原图，显卡里每张只剩几 MB，换画面时随卡片一起释放。 */
// idLeft：学生证照片（不裁切，见 shared/idphoto.js）左边留给文字的宽度比例；null = 一般照片（铺满裁切）；'fit' = 备注图片（完整缩进框里，不裁切）
async function drawPhoto(cv, box, url, idLeft = null) {
  try {
    const blob = await (await fetch(url)).blob();
    if (!cv.isConnected) return;
    const bm = await createImageBitmap(blob);
    // 舞台缩放到屏幕的倍数 × 1.25（入围得主会放大一点，留余量），但不超过原图
    let s = Math.min(2, Math.max(1, stage.getBoundingClientRect().width / SW || 1)) * 1.25;   // 至少按舞台像素（窗口之后放大也清楚）
    s = Math.min(s, bm.width / Math.max(1, box.offsetWidth), bm.height / Math.max(1, box.offsetHeight));
    const W = Math.max(1, Math.round(box.offsetWidth * s)), H = Math.max(1, Math.round(box.offsetHeight * s));
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    if (idLeft === 'fit') {   // 备注图片：完整显示，置中
      const k = Math.min(W / bm.width, H / bm.height), dw = bm.width * k, dh = bm.height * k;
      g.drawImage(bm, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else if (idLeft != null) drawIdPhoto(g, bm, bm.width, bm.height, W, H, idLeft);   // 学生证：完整显示
    else {
      const k = Math.max(W / bm.width, H / bm.height), sw = W / k, sh = H / k;   // object-fit: cover，置中
      g.drawImage(bm, (bm.width - sw) / 2, (bm.height - sh) / 2, sw, sh, 0, 0, W, H);
    }
    bm.close();
    cv.classList.add('ok');
  } catch { box.classList.add('nopic'); }
}
/* 学校 Logo：叠在每张照片右上角，另外画面左上角也有一个（#slogo）。整个页面只有一个 Logo 网址，浏览器只解码一份，不像学生照片那样要画进 canvas。
 * 大小在 CSS：一个正方形框（边长 = 照片宽 × --logo-k），Logo 按原比例缩进框里、贴右上角（object-fit: contain），不会变形。 */
let LOGO = '';
function logoImg() { const im = document.createElement('img'); im.className = 'logo'; im.alt = ''; im.src = LOGO + '&k=' + encodeURIComponent(KEY); return im; }
function logoSet(url) {
  url = url || '';
  if (url === LOGO) return;
  LOGO = url;
  for (const im of document.querySelectorAll('img.logo')) im.remove();   // 换了 / 移除：已经在画面上的照片一起更新
  if (LOGO) for (const cv of document.querySelectorAll('#grid canvas.ph')) cv.after(logoImg());
  const sl = $('slogo');   // 画面左上角：载入好才淡入（CSS .ok）；没有 Logo 就清掉
  sl.classList.remove('ok');
  sl.onload = () => sl.classList.add('ok');
  if (LOGO) sl.src = LOGO + '&k=' + encodeURIComponent(KEY); else sl.removeAttribute('src');
}
function fillCard(card, w, animate) {
  card.className = 'card' + (animate ? ' pop' : '') + (w.type === 'team' ? ' team' : '');
  card.textContent = '';
  const tx = div('tx');
  const nm = div('nm', w.name); tx.appendChild(nm);
  const fits = [nm];
  const grid = $('grid');
  if (grid.classList.contains('photo')) {
    const cap = grid.classList.contains('cap');         // cap：照片在上、名字在下；否则照片铺满、左侧叠字
    // 有备注的奖项（.notes）：卡片左边 .pic = 原本的照片卡（照片 + 名字），右边 .nbox = 备注框；这位没写备注就只有照片、居中
    const notes = grid.classList.contains('notes');
    const pic = notes ? card.appendChild(div('pic')) : card;
    if (notes && !w.detail && !w.notePic) card.classList.add('nonote');
    const holder = cap ? pic.appendChild(div('phbox')) : pic;
    if (w.photo) {
      const cv = document.createElement('canvas');
      cv.className = 'ph';
      holder.appendChild(cv);
      // 学生证（文件名 -ID）：完整显示（有学生证的奖项一定是 .cap 版式：照片在上、名字在下）
      drawPhoto(cv, holder, w.photo + '&k=' + encodeURIComponent(KEY), w.idCard ? 0 : null);
      if (LOGO) holder.appendChild(logoImg());   // 放在照片后面：CSS 让它等照片画好才出现
    } else holder.classList.add('nopic');
    if (!cap) pic.appendChild(div('shade'));
    const lines = [['cls', w.cls], ['sid', w.sid], ['soc', w.socZh === w.name ? '' : w.socZh], ['socEn', w.socEn], ['note', notes ? '' : w.detail]].filter(([, t]) => t);   // 团体名就是学会名时，不重复写中文；有备注框时备注放框里
    if (cap && lines.length) tx.appendChild(div('rule'));   // 团体：名字下面一条线；个人照片卡和导出图片一样，没有线
    const box = cap ? tx.appendChild(div('lns')) : tx;  // 名字在下：班级 / 学号 / 学会 / 备注排成一行（可换行）
    nm.dataset.k = 'name';
    for (const [k, t] of lines) box.appendChild(div('ln ' + k, t)).dataset.k = k;
    // 照片卡的字号、颜色、阴影、位置交给 exDecorate()（exstyle.js：套图片导出的设计）
    pic.appendChild(tx);
    let nb = null;
    if (notes && w.notePic) {   // 备注是图片：16:9 图框
      const pb = card.appendChild(div('nbox npic'));
      const cv = document.createElement('canvas'); cv.className = 'ph'; pb.appendChild(cv);
      requestAnimationFrame(() => drawPhoto(cv, pb, w.notePic + '&k=' + encodeURIComponent(KEY), 'fit'));
    } else if (notes && w.detail) { nb = card.appendChild(div('nbox')); nb.appendChild(div('nt', w.detail)); }
    requestAnimationFrame(() => { exDecorate(pic); if (nb) fitNote(nb); });
    return;
  } else {                                              // 纯文字卡：班级 · 学号 · 备注 合成一行，学会另起一行（太长时缩小字号，不截断）
    const info = [w.cls, w.sid, w.detail].filter(Boolean).join(' · ');
    if (info) tx.appendChild(div('dt', info));
    const soc = [w.socZh === w.name ? '' : w.socZh, w.socEn].filter(Boolean).join(' ');
    if (soc) fits.push(tx.appendChild(div('dt soc', soc)));
  }
  card.appendChild(tx);
  requestAnimationFrame(() => fits.forEach(fitText));
}
function buildGrid(v) {
  const grid = $('grid');
  const n = v.award.total;
  grid.textContent = '';
  grid.className = '';
  grid.removeAttribute('style');
  grid.classList.toggle('single', n === 1);
  $('s-reveal').classList.remove('dense');
  const shrink = v.award.nominee && n > 1 ? .74 : 1;   // 入围：卡片先小一点，得主揭晓时才有放大的空间
  grid.classList.toggle('grow', !!v.award.grow);
  if (v.award.hasPhotos && buildPhotoGrid(grid, n, !!(v.award.hasTeams || v.award.hasIds), shrink, !!v.award.grow, v.award.notePic ? 'pic' : !!v.award.hasNotes)) return;
  const T = planText(n, grid.clientWidth || SW - 220, (grid.clientHeight || SH - 300) * shrink, !!v.award.grow);
  grid.dataset.cols = T.cols;
  grid.style.setProperty('--name', Math.floor(T.name) + 'px');
  grid.style.setProperty('--detail', Math.max(12, Math.floor(T.name * .38)) + 'px');
  grid.style.setProperty('--gap', T.gap + 'px');
  grid.style.gridTemplateColumns = `repeat(${T.cols}, ${Math.floor(T.cw)}px)`;
  grid.style.gridTemplateRows = `repeat(${T.rows}, ${Math.floor(n <= 3 ? Math.min(T.ch, 380) : T.ch)}px)`;
  if (v.award.grow) {   // 逐一揭晓改用 flex（每行居中），卡片大小照样按总人数排好，出现时不会再变大小
    grid.style.setProperty('--cw', Math.floor(T.cw) + 'px');
    grid.style.setProperty('--ch', Math.floor(n <= 3 ? Math.min(T.ch, 380) : T.ch) + 'px');
    grid.style.maxWidth = (T.cols * Math.floor(T.cw) + (T.cols - 1) * T.gap + 1) + 'px';
  }
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'card hidden';
    c.innerHTML = '<div class="q">?</div>';
    grid.appendChild(c);
  }
}
/* 逐一揭晓（grow）：没揭晓的卡不占位置；已揭晓的 k 位按「中间出、左右收」排：
 * 第一位在中间；之后每一位轮流放到最左、最右，整排保持居中。5 位依次是 1 → 21 → 213 → 4213 → 42135（用户定 2026-11-16）。
 * 新的一位先在这一行的正中间出现，停一下再滑到自己的位置；原本的卡同时平滑让位（FLIP）。
 * 人多要排几行时（grid.dataset.cols = 每行几张）：一行一行填，每一行各自照这个规则，正在填的那一行居中。
 * 用 CSS order 排（卡片在网格里的序号不变，fillCard 照旧按序号找卡）。 */
function growPlace(cards, from, to, animate) {
  const old = [];
  for (let i = 0; i < from; i++) old.push([cards[i].offsetLeft, cards[i].offsetTop]);
  const cols = +$('grid').dataset.cols || to || 1, seq = [];
  for (let r = 0; r < to; r += cols) {
    const row = [];
    for (let i = r; i < Math.min(to, r + cols); i++) (i - r) % 2 ? row.unshift(i) : row.push(i);   // 第 2、4…位放左边，第 3、5…位放右边
    seq.push(...row);
  }
  seq.forEach((c, j) => { cards[c].style.order = j; });
  for (let i = from; i < to; i++) if (cards[i].classList.contains('hidden')) cards[i].className = 'card wait';   // 先占好位置，fillCard 再让它出现
  if (!animate) return;
  for (let i = 0; i < from; i++) {
    const dx = old[i][0] - cards[i].offsetLeft, dy = old[i][1] - cards[i].offsetTop;
    if (dx || dy) cards[i].animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }],
      { duration: 750, easing: 'cubic-bezier(.2,.7,.2,1)' });   // 用 translate 属性（不是 transform）：和出现动画的 transform 互不干扰、不会被它缩小
  }
  // 新的卡：从网格正中间（横向）出来，停 0.35 秒再滑过去
  const g = $('grid').getBoundingClientRect(), s = g.width / ($('grid').offsetWidth || 1) || 1;
  for (let i = from; i < to; i++) {
    const r = cards[i].getBoundingClientRect(), dx = (g.left + g.width / 2 - (r.left + r.width / 2)) / s;
    if (Math.abs(dx) > 1) cards[i].animate([{ translate: `${dx}px 0` }, { translate: `${dx}px 0`, offset: .3 }, { translate: '0 0' }],
      { duration: 1200, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }
}
function buildPhotoGrid(grid, n, cap, shrink = 1, oneRow = false, notes = false) {
  const scene = $('s-reveal');
  scene.classList.toggle('dense', n > 12);
  const W = grid.clientWidth || SW - 220, H = (grid.clientHeight || SH - 300) * shrink;
  const AR = cap ? 1 / (1 / PHOTO_AR + CAP_H) : PHOTO_AR;    // 照片部分的宽高比
  // 照片部分占卡片宽的比例：文字备注框 = 照片宽 × NOTE_K；图片备注框 = 16:9 图（高 = 卡片高 × NOTE_PIC_H）+ 左右留边
  const pk = notes === 'pic' ? 1 / (1 + (NOTE_PIC_H * 16 / 9 + .12) / AR) : notes ? 1 / (1 + NOTE_K) : 1;
  const P = planPhoto(n, W, H, AR / pk, oneRow, pk);
  if (!P) { scene.classList.remove('dense'); return false; }   // 人数实在太多：只显示名字（备注照旧接在班级、学号后面）
  grid.classList.add('photo');   // 不能清掉 grow（buildGrid 刚设的）
  grid.dataset.cols = P.cols;
  if (cap) grid.classList.add('cap');                         // 奖项里有团体：全部改成「照片在上、名字在下」
  if (notes) grid.classList.add('notes');                     // 有人写了备注：照片右边加备注框
  const s = grid.style;
  const pw = P.cw * pk;                                       // 照片部分的宽
  s.setProperty('--pw', Math.floor(pw) + 'px');
  s.setProperty('--note', Math.max(14, Math.floor(Math.min(pw * .075, P.ch * .12))) + 'px');   // 备注框的起始字号（太多字再由 fitNote 缩小）
  const name = Math.max(16, Math.min(pw * (cap ? .07 : .078), 150));   // 字号跟着照片宽度走
  s.setProperty('--name', Math.floor(name) + 'px');
  s.setProperty('--detail', Math.max(12, Math.floor(name * .52)) + 'px');
  s.setProperty('--gap', P.gap + 'px');
  s.setProperty('--cw', Math.floor(P.cw) + 'px');
  s.setProperty('--ch', Math.floor(P.ch) + 'px');
  s.maxWidth = (P.cols * Math.floor(P.cw) + (P.cols - 1) * P.gap + 1) + 'px';   // 每行刚好放 cols 张
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'card hidden';
    c.innerHTML = '<div class="q">?</div>';
    grid.appendChild(c);
  }
  return true;
}
