/*
 * 大屏 · 揭晓画面的名字卡：按人数排版（纯文字 / 照片卡 / 团体照片在上）、填入得奖者、自动缩字。
 * 提供：buildGrid(view)、fillCard(card, winner, animate)、fitText(el)、div(cls, text)
 * 需要：stage.js（$、SW、SH、KEY）
 */
'use strict';

/* 无照片：选出让名字最大的行列数 */
function planText(n, W, H) {
  let best = null;
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
  }
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
function planPhoto(n, W, H, AR = PHOTO_AR) {
  let best = null;
  for (let cols = 1; cols <= Math.min(n, 16); cols++) {
    const rows = Math.ceil(n / cols);
    const gap = n > 24 ? 12 : n > 12 ? 16 : n > 6 ? 22 : 30;
    const cw = Math.min((W - (cols - 1) * gap) / cols, (H - (rows - 1) * gap) / rows * AR);
    if (!best || cw > best.cw + .5) best = { cols, rows, gap, cw, ch: cw / AR };
  }
  return best && best.cw >= 150 ? best : null;   // 太小就退回纯文字
}
function fitText(el) {
  let size = parseFloat(getComputedStyle(el).fontSize);
  let guard = 40;
  while (el.scrollWidth > el.clientWidth + 1 && size > 12 && guard--) { size *= .92; el.style.fontSize = size + 'px'; }
}
const div = (cls, text) => { const d = document.createElement('div'); d.className = cls; if (text != null) d.textContent = text; return d; };
/* 照片画进刚好卡片大小的 canvas（不用 <img>）：
 * <img> 会把原图整张解码并放进显卡（4000×3000 一张约 48 MB），OBS 内置浏览器 + 内置显卡时会越揭晓越多、把内存吃光。
 * 这里解码后马上缩成卡片的实际像素再丢掉原图，显卡里每张只剩几 MB，换画面时随卡片一起释放。 */
async function drawPhoto(cv, box, url) {
  try {
    const blob = await (await fetch(url)).blob();
    if (!cv.isConnected) return;
    const bm = await createImageBitmap(blob);
    // 舞台缩放到屏幕的倍数 × 1.25（入围得主会放大一点，留余量），但不超过原图
    let s = Math.min(2, Math.max(1, stage.getBoundingClientRect().width / SW || 1)) * 1.25;   // 至少按舞台像素（窗口之后放大也清楚）
    s = Math.min(s, bm.width / Math.max(1, box.offsetWidth), bm.height / Math.max(1, box.offsetHeight));
    const W = Math.max(1, Math.round(box.offsetWidth * s)), H = Math.max(1, Math.round(box.offsetHeight * s));
    cv.width = W; cv.height = H;
    const k = Math.max(W / bm.width, H / bm.height), sw = W / k, sh = H / k;   // object-fit: cover，置中
    const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(bm, (bm.width - sw) / 2, (bm.height - sh) / 2, sw, sh, 0, 0, W, H);
    bm.close();
    cv.classList.add('ok');
  } catch { box.classList.add('nopic'); }
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
    const holder = cap ? card.appendChild(div('phbox')) : card;
    if (w.photo) {
      const cv = document.createElement('canvas');
      cv.className = 'ph';
      holder.appendChild(cv);
      drawPhoto(cv, holder, w.photo + '&k=' + encodeURIComponent(KEY));
    } else holder.classList.add('nopic');
    if (!cap) card.appendChild(div('shade'));
    if (w.cls || w.sid || w.detail) tx.appendChild(div('rule'));
    const box = cap ? tx.appendChild(div('lns')) : tx;  // 名字在下：班级 / 学号 / 备注排成一行（可换行）
    for (const [k, t] of [['cls', w.cls], ['sid', w.sid], ['note', w.detail]]) if (t) { const d = box.appendChild(div('ln ' + k, t)); if (!cap) fits.push(d); }
  } else {                                              // 纯文字卡：班级 · 学号 · 备注 合成一行
    const info = [w.cls, w.sid, w.detail].filter(Boolean).join(' · ');
    if (info) tx.appendChild(div('dt', info));
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
  if (v.award.hasPhotos && buildPhotoGrid(grid, n, !!v.award.hasTeams, shrink)) return;
  const T = planText(n, grid.clientWidth || SW - 220, (grid.clientHeight || SH - 300) * shrink);
  grid.style.setProperty('--name', Math.floor(T.name) + 'px');
  grid.style.setProperty('--detail', Math.max(12, Math.floor(T.name * .38)) + 'px');
  grid.style.setProperty('--gap', T.gap + 'px');
  grid.style.gridTemplateColumns = `repeat(${T.cols}, ${Math.floor(T.cw)}px)`;
  grid.style.gridTemplateRows = `repeat(${T.rows}, ${Math.floor(n <= 3 ? Math.min(T.ch, 380) : T.ch)}px)`;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'card hidden';
    c.innerHTML = '<div class="q">?</div>';
    grid.appendChild(c);
  }
}
function buildPhotoGrid(grid, n, cap, shrink = 1) {
  const scene = $('s-reveal');
  scene.classList.toggle('dense', n > 12);
  const W = grid.clientWidth || SW - 220, H = (grid.clientHeight || SH - 300) * shrink;
  const P = planPhoto(n, W, H, cap ? 1 / (1 / PHOTO_AR + CAP_H) : PHOTO_AR);
  if (!P) { scene.classList.remove('dense'); return false; }   // 人数实在太多：只显示名字
  grid.classList.add('photo');
  if (cap) grid.classList.add('cap');                         // 奖项里有团体：全部改成「照片在上、名字在下」
  const s = grid.style;
  const name = Math.max(16, Math.min(P.cw * (cap ? .07 : .078), 150));   // 字号跟着卡片宽度走
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
