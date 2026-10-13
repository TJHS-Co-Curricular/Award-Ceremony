/*
 * 共用 · 二维码编码器（内置，离线可用；字节模式、纠错等级 M、版本 1～10）。
 * QR.svg(text) → <svg>；QR.matrix(text) → 0/1 二维数组。
 */
'use strict';

const QR = (() => {
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  function rsRem(data, n) {   // Reed-Solomon 纠错码
    let g = [1];
    for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); g.forEach((c, j) => { ng[j] ^= c; ng[j + 1] ^= mul(c, EXP[i]); }); g = ng; }
    const r = new Array(n).fill(0);
    for (const d of data) { const f = d ^ r.shift(); r.push(0); if (f) for (let j = 0; j < n; j++) r[j] ^= mul(g[j + 1], f); }
    return r;
  }
  // 纠错等级 M：[每块纠错字节, 第1组块数, 每块数据字节, 第2组块数, 每块数据字节]
  const BLK = [, [10, 1, 16], [16, 1, 28], [26, 1, 44], [18, 2, 32], [24, 2, 43], [16, 4, 27], [18, 4, 31], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]];
  const ALIGN = [, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  const MASK = [(r, c) => (r + c) % 2 === 0, r => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => ((r >> 1) + ((c / 3) | 0)) % 2 === 0, (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0, (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0];
  function penalty(g) {
    const N = g.length; let p = 0, dark = 0;
    for (let i = 0; i < N; i++) for (const L of [g[i], g.map(row => row[i])]) {
      for (let j = 1, run = 1; j <= N; j++) { if (j < N && L[j] === L[j - 1]) run++; else { if (run >= 5) p += run - 2; run = 1; } }
      const s = L.join('');
      for (const pat of ['10111010000', '00001011101']) for (let k = s.indexOf(pat); k >= 0; k = s.indexOf(pat, k + 1)) p += 40;
    }
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) { const v = g[r][c]; if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) p += 3; }
    g.forEach(row => row.forEach(x => (dark += x)));
    return p + Math.floor(Math.abs(dark * 20 - N * N * 10) / (N * N)) * 10;
  }
  function matrix(text) {
    const bytes = [...new TextEncoder().encode(text)];
    let v = 1, cap = 0;
    for (; v <= 10; v++) { const t = BLK[v]; cap = t[1] * t[2] + (t[3] || 0) * (t[4] || 0); if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= cap * 8) break; }
    if (v > 10) throw new Error('内容太长，无法生成二维码');
    const t = BLK[v], bits = [];
    const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, cap * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    for (let p = 0; data.length < cap; p ^= 1) data.push(p ? 0x11 : 0xec);
    const blocks = [], ecs = []; let o = 0;
    for (const [cnt, len] of [[t[1], t[2]], [t[3] || 0, t[4] || 0]])
      for (let i = 0; i < cnt; i++) { const b = data.slice(o, (o += len)); blocks.push(b); ecs.push(rsRem(b, t[0])); }
    const out = [];
    for (let i = 0; i < Math.max(...blocks.map(b => b.length)); i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
    for (let i = 0; i < t[0]; i++) for (const e of ecs) out.push(e[i]);

    const N = 17 + 4 * v;
    const m = Array.from({ length: N }, () => new Array(N).fill(0));
    const fn = Array.from({ length: N }, () => new Array(N).fill(false));
    const setF = (r, c, d) => { m[r][c] = d ? 1 : 0; fn[r][c] = true; };
    for (const [r0, c0] of [[0, 0], [0, N - 7], [N - 7, 0]])   // 定位图形 + 分隔符
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
        setF(rr, cc, r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)));
      }
    for (let i = 8; i < N - 8; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }   // 时序图形
    const A = ALIGN[v], last = A.length - 1;
    A.forEach((r, i) => A.forEach((c, j) => {   // 校正图形（跳过与定位图形重叠的三个角）
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) setF(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }));
    const drawFormat = mask => {
      const d = mask; let rem = d;   // 纠错等级 M 的标识位是 00
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const f = ((d << 10) | rem) ^ 0x5412, bit = i => (f >>> i) & 1;
      for (let i = 0; i <= 5; i++) setF(i, 8, bit(i));
      setF(7, 8, bit(6)); setF(8, 8, bit(7)); setF(8, 7, bit(8));
      for (let i = 9; i < 15; i++) setF(8, 14 - i, bit(i));
      for (let i = 0; i < 8; i++) setF(8, N - 1 - i, bit(i));
      for (let i = 8; i < 15; i++) setF(N - 15 + i, 8, bit(i));
      setF(N - 8, 8, 1);
    };
    drawFormat(0);
    if (v >= 7) {   // 版本信息
      let rem = v;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const b = (v << 12) | rem;
      for (let i = 0; i < 18; i++) { const d = (b >>> i) & 1, a = N - 11 + (i % 3), c = (i / 3) | 0; setF(c, a, d); setF(a, c, d); }
    }
    let k = 0;   // 按之字形放入数据
    for (let right = N - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < N; vert++) for (let j = 0; j < 2; j++) {
        const c = right - j, r = ((right + 1) & 2) === 0 ? N - 1 - vert : vert;
        if (fn[r][c]) continue;
        m[r][c] = k < out.length * 8 ? (out[k >>> 3] >>> (7 - (k & 7))) & 1 : 0; k++;
      }
    }
    let best = null, bestP = Infinity;   // 选罚分最低的掩码
    for (let mk = 0; mk < 8; mk++) {
      drawFormat(mk);
      const g = m.map((row, r) => row.map((x, c) => (fn[r][c] ? x : x ^ (MASK[mk](r, c) ? 1 : 0))));
      const p = penalty(g);
      if (p < bestP) { bestP = p; best = g; }
    }
    return best;
  }
  function svg(text, quiet = 4) {
    const g = matrix(text), N = g.length, S = N + quiet * 2, NS = 'http://www.w3.org/2000/svg';
    let d = '';
    g.forEach((row, r) => row.forEach((x, c) => { if (x) d += `M${c + quiet} ${r + quiet}h1v1h-1z`; }));
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', `0 0 ${S} ${S}`); s.setAttribute('shape-rendering', 'crispEdges');
    const bg = document.createElementNS(NS, 'rect'); bg.setAttribute('width', S); bg.setAttribute('height', S); bg.setAttribute('fill', '#fff');
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', '#000');
    s.append(bg, p);
    return s;
  }
  return { matrix, svg };
})();
