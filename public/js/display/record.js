/*
 * 大屏 · 导出影片（控制端「效果控制 → 导出影片」打开一个隐藏的输出页 record=1，调用 recStart()）。
 * 用虚拟时钟（clock.js）一格一格地推进特效，每一帧合成到一张画布，再用浏览器内建的 WebCodecs 编码成 H.264（不支持就用 VP9），
 * 最后 mp4.js 包成 .mp4。逐帧离线渲染：电脑慢只会导出得久一点，影片本身不会掉帧。
 * 内容：
 *   standby   待机画面（背景 + 副标题 + 活动名称 + 装饰线，名称有流光）
 *   standbybg 待机背景（星系 / 光河，没有文字）
 *   base      底层背景（舞台渐层 + 浮尘 + 边框，其它画面后面那层）
 *   flash     揭晓闪光（黑底，叠加时用「滤色 / Screen」混合）
 * 循环：最后 fade 秒和开头交叉淡化，首尾接得上，播放器设「循环播放」就看不出接缝。
 * 文字是按网页实际排版逐字画到画布上的（位置、字体、渐层、阴影跟网页一样）。
 * opt.sink（服务器渲染、服务端有 NVENC 时由 lib/render.js 给）：每帧原始画面交给服务端的 ffmpeg 用显卡编码，不在浏览器编码（blob = null）。
 * 提供：recStart(opt, fx, onProgress) → Promise<{ blob, size, codec, hw, width, height, speed }>、recCancel()
 * 需要：stage.js、clock.js、fxconf.js、mp4.js、fx/*、render.js、main.js（booted）
 */
'use strict';

let recStop = false;
function recCancel() { recStop = true; }
const recYield = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });   // 让出时间又不受后台计时器限速
const recCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ---------- 文字：按网页排版逐字画 ---------- */
function recRects() {
  const sr = stage.getBoundingClientRect(), s = sr.width / SW;
  return r => ({ x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s });
}
// 把元素里的每个字画到 g（舞台坐标，白色或目前的 fillStyle）
function recDrawChars(g, el, conv) {
  const cs = getComputedStyle(el), up = cs.textTransform === 'uppercase';
  g.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), range = document.createRange();
  for (let n; (n = walk.nextNode());) {
    for (let i = 0; i < n.length; i++) {
      const code = n.data.charCodeAt(i), len = code >= 0xd800 && code < 0xdc00 ? 2 : 1, ch = n.data.substr(i, len);
      if (!/\s/.test(ch)) {
        range.setStart(n, i); range.setEnd(n, i + len);
        const r = range.getClientRects()[0];
        if (r) {
          const q = conv(r), t = up ? ch.toUpperCase() : ch, m = g.measureText(t);
          const A = m.fontBoundingBoxAscent, D = m.fontBoundingBoxDescent;
          g.fillText(t, q.x, q.y + (q.h - (A + D)) / 2 + A);
        }
      }
      i += len - 1;
    }
  }
}
// 阴影层：把字形染色、模糊、位移（= CSS drop-shadow，只画一次）
function recShadow(mask, color, dy, blur, W, H) {
  const t = recCanvas(W, H), g = t.getContext('2d');
  g.drawImage(mask, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, W, H);
  const o = recCanvas(W, H), go = o.getContext('2d');
  go.filter = `blur(${blur}px)`; go.drawImage(t, 0, dy);
  return o;
}
function recTextLayers(W, H) {
  const K = W / SW, conv = recRects();
  const stat = recCanvas(W, H), gs = stat.getContext('2d');
  const stageCtx = c => { const g = c.getContext('2d'); g.setTransform(W / SW, 0, 0, H / SH, 0, 0); return g; };
  // 副标题：竖向渐层 + 阴影 drop-shadow(0 4px 18px rgba(0,0,0,.6))
  const en = $('evSub');
  if (en.textContent.trim() && getComputedStyle(en).display !== 'none') {
    const m = recCanvas(W, H), g = stageCtx(m); g.fillStyle = '#fff'; recDrawChars(g, en, conv);
    gs.drawImage(recShadow(m, 'rgba(0,0,0,.6)', 4 * K, 9 * K, W, H), 0, 0);
    const b = conv(en.getBoundingClientRect()), gr = g.createLinearGradient(0, b.y, 0, b.y + b.h);
    gr.addColorStop(0, '#fff6d8'); gr.addColorStop(.45, '#e9c873'); gr.addColorStop(1, '#9a7330');
    g.globalCompositeOperation = 'source-in'; g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
    gs.drawImage(m, 0, 0);
  }
  // 装饰线（整体不透明度 .85）
  const gl = stageCtx(stat); gl.globalAlpha = .85;
  for (const i of document.querySelectorAll('#s-standby .line i')) {
    const q = conv(i.getBoundingClientRect()), last = i === i.parentNode.lastElementChild;
    const gr = gl.createLinearGradient(q.x, 0, q.x + q.w, 0);
    gr.addColorStop(last ? 1 : 0, 'rgba(247,226,166,0)'); gr.addColorStop(last ? 0 : 1, 'rgba(247,226,166,.9)');
    gl.fillStyle = gr; gl.fillRect(q.x, q.y, q.w, q.h);
  }
  const dia = document.querySelector('#s-standby .line b');
  if (dia) {
    const q = conv(dia.getBoundingClientRect()), s = dia.offsetWidth;
    gl.save(); gl.translate(q.x + q.w / 2, q.y + q.h / 2); gl.rotate(Math.PI / 4);
    gl.strokeStyle = '#f7e2a6'; gl.lineWidth = 1.5; gl.strokeRect(-s / 2 + .75, -s / 2 + .75, s - 1.5, s - 1.5); gl.restore();
  }
  // 活动名称：字形遮罩 + 两层阴影；流光每帧画（recTitle）
  const h1 = $('evTitle'), mask = recCanvas(W, H), gm = stageCtx(mask); gm.fillStyle = '#fff';
  let title = null;
  if (h1.textContent.trim()) {
    recDrawChars(gm, h1, conv);
    const b = conv(h1.getBoundingClientRect()), pad = 4;
    const px = Math.max(0, Math.floor((b.x - pad) * K)), py = Math.max(0, Math.floor((b.y - pad) * K));
    title = {
      box: b, mask, px, py, pw: Math.min(W - px, Math.ceil((b.w + pad * 2) * K)), ph: Math.min(H - py, Math.ceil((b.h + pad * 2) * K)),
      dark: recShadow(mask, 'rgba(0,0,0,.65)', 6 * K, 7 * K, W, H), glow: recShadow(mask, 'rgba(255,190,70,.35)', 0, 13 * K, W, H)
    };
    title.tmp = recCanvas(title.pw, title.ph);
  }
  return { stat, title, K };
}
// 活动名称的金色流光（= CSS .goldtext：100deg 渐层，宽 250%，background-position 95% ↔ -12%，7 秒 ease-in-out 来回）。
// frac = 一个来回（14 秒）里的位置；影片长度调成整数个来回，循环时也接得上。
const SHIMMER_P = 14;
function recTitle(out, L, frac) {
  const T = L.title; if (!T) return;
  out.drawImage(T.dark, 0, 0); out.drawImage(T.glow, 0, 0);
  const g = T.tmp.getContext('2d'), { x, y, w, h } = T.box, K = L.K;
  // 先铺渐层（可能跨两块），再用字形遮罩裁掉（destination-in；不能用 source-in，第二块会把第一块擦掉）
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, T.pw, T.ph);
  g.setTransform(K, 0, 0, K, -T.px, -T.py);
  const tri = frac < .5 ? frac * 2 : 2 - frac * 2, e = .5 - .5 * Math.cos(Math.PI * tri);   // 去程 / 回程，两端慢、中间快
  const tw = w * 2.5, ox = (w - tw) * (.95 - 1.07 * e), a = 100 * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
  const Lg = Math.abs(tw * dx) + Math.abs(h * dy);
  for (let k = -1; k <= 1; k++) {
    const x0 = x + ox + k * tw; if (x0 > x + w || x0 + tw < x) continue;
    const cx = x0 + tw / 2, cy = y + h / 2, gr = g.createLinearGradient(cx - dx * Lg / 2, cy - dy * Lg / 2, cx + dx * Lg / 2, cy + dy * Lg / 2);
    gr.addColorStop(0, '#9a7330'); gr.addColorStop(.25, '#d9b25f'); gr.addColorStop(.45, '#f7e2a6'); gr.addColorStop(.6, '#d9b25f'); gr.addColorStop(1, '#9a7330');
    g.fillStyle = gr; g.fillRect(x0, y - 4, tw, h + 8);
  }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in';
  g.drawImage(T.mask, T.px, T.py, T.pw, T.ph, 0, 0, T.pw, T.ph);
  out.drawImage(T.tmp, T.px, T.py);
}

/* ---------- 底层背景（= #stage 的 CSS 背景 + 边框） ---------- */
function recBaseLayers(W, H) {
  const bgc = recCanvas(W, H), g = bgc.getContext('2d'); g.setTransform(W / SW, 0, 0, H / SH, 0, 0);
  const lin = g.createLinearGradient(0, 0, 0, SH); lin.addColorStop(0, '#0c0a14'); lin.addColorStop(1, '#05040a');
  g.fillStyle = lin; g.fillRect(0, 0, SW, SH);
  const ell = (cx, cy, rx, ry, color) => {
    g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, rx); r.addColorStop(0, color); r.addColorStop(.7, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = r; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
  };
  ell(SW * .5, SH * 1.1, 900, 500, 'rgba(120,40,40,.28)');
  ell(SW * .5, SH * .38, 1200, 700, 'rgba(217,178,95,.16)');
  const fr = recCanvas(W, H), f = fr.getContext('2d'); f.setTransform(W / SW, 0, 0, H / SH, 0, 0);
  f.lineWidth = 1; f.strokeStyle = 'rgba(217,178,95,.22)'; f.strokeRect(36.5, 36.5, SW - 73, SH - 73);
  f.strokeStyle = 'rgba(217,178,95,.10)'; for (let i = 0; i < 2; i++) f.strokeRect(47.5, 47.5, SW - 95, SH - 95);
  return { bgc, fr };
}

/* ---------- 编码器：先要求显卡编码（NVIDIA NVENC / AMD AMF / Intel QSV），不行再用 CPU 软件编码；
 * 编码格式先试 H.264（各级别），不支持再用 VP9 ---------- */
async function recEncoder(W, H, fps, bitrate, onChunk, allowHw = true) {
  const codecs = ['avc1.640034', 'avc1.640033', 'avc1.4d0034', 'avc1.4d0033', 'avc1.42e034', 'vp09.00.51.08', 'vp09.00.41.08'];
  for (const accel of allowHw ? ['prefer-hardware', 'prefer-software'] : ['prefer-software']) {
    for (const codec of codecs) {
      const cfg = { codec, width: W, height: H, bitrate, framerate: fps, bitrateMode: 'variable', latencyMode: 'quality', hardwareAcceleration: accel,
        ...(codec.startsWith('avc') ? { avc: { format: 'avc' } } : {}) };
      try { if (!(await VideoEncoder.isConfigSupported(cfg)).supported) continue; } catch { continue; }
      let err = null;
      const enc = new VideoEncoder({ output: onChunk, error: e => { err = e; } });
      enc.configure(cfg);
      return { enc, kind: codec.startsWith('avc') ? 'avc' : 'vp9', codec, hw: accel === 'prefer-hardware', failed: () => err };
    }
  }
  throw new Error('这个浏览器不支持影片编码（请用新版 Chrome 或 Edge）');
}

/* ---------- 主程序 ---------- */
async function recStart(opt, fx, onProgress = () => {}) {
  try { return await recRun(opt, fx, onProgress, true); }
  catch (e) {
    if (!e.recHw) throw e;   // 显卡编码中途失败（驱动不支持这个尺寸等）：自动改用软件编码重来一次
    onProgress(0, '显卡编码失败，改用软件编码');
    return await recRun(opt, fx, onProgress, false);
  }
}
/* 服务器渲染 + NVENC（lib/render.js）：不在浏览器编码，每一帧原始画面（RGBA）POST 给本机服务端，由 ffmpeg 交给显卡编码。
 * 两块缓冲轮流用：上一帧在上传时，这一帧已经在读回画面。 */
function recSink(sink, W, H) {
  const bufs = [new Uint8Array(W * H * 4), new Uint8Array(W * H * 4)];
  let pending = null, n = 0, ended = false;
  const post = async (q, body) => {
    const r = await fetch(sink.url + '&' + q, { method: 'POST', body });
    if (!r.ok) throw Object.assign(new Error('显卡编码（NVENC）失败：' + (await r.text()).slice(0, 300)), { recSink: true });
    return r;
  };
  return {
    hw: true, codec: 'h264_nvenc', failed: () => null,
    async push(cv, k, ctx) {
      const buf = bufs[n++ % 2], layout = [{ offset: 0, stride: W * 4 }];
      let fmt = 'RGBA', data = buf;
      const f = new VideoFrame(cv, { timestamp: k });
      try { await f.copyTo(buf, { format: 'RGBA', layout }); }
      catch {
        try { await f.copyTo(buf, { layout }); fmt = f.format; }
        catch { data = new Uint8Array(ctx.getImageData(0, 0, W, H).data.buffer); fmt = 'RGBA'; }
      } finally { f.close(); }
      if (pending) await pending;
      pending = post(`i=${k}&fmt=${fmt}`, data);
    },
    async finish() { if (pending) await pending; ended = true; const r = await post('end=1'); return { blob: null, ...(await r.json()) }; },
    close() { if (!ended) fetch(sink.url + '&abort=1', { method: 'POST' }).catch(() => {}); }
  };
}

async function recRun(opt, fx, onProgress, allowHw) {
  if (typeof VideoEncoder === 'undefined' && !opt.sink) throw new Error(!isSecureContext
    ? '浏览器只在安全连线下才给影片编码：现在是用 http://IP 打开控制端。请照控制端的说明让浏览器信任这个地址，或把「在哪里渲染」改成服务器'
    : '这个浏览器不支持影片编码（WebCodecs），请用新版 Chrome 或 Edge，或把「在哪里渲染」改成服务器');
  recStop = false;
  for (let i = 0; !booted && i < 200; i++) await new Promise(r => setTimeout(r, 50));
  if (!booted) throw new Error('连不上服务端');
  fxPreviewSet(fx);
  const content = opt.content, fps = opt.fps === 60 ? 60 : 30, sub = 60 / fps;
  if (content === 'base' || content === 'flash') standbyFx(false, FXC.standby);   // 用不到待机背景：停掉省时间
  $('s-standby').classList.remove('enter');   // 去掉进场动画，文字位置才是最终的
  for (let i = 0; i < 30; i++) recTick(1000 / 60);   // 先跑半秒：标题缩放、星系建好
  await document.fonts.ready;
  const gold = $('goldfx'), W = gold.width, H = gold.height;
  const L = content === 'standby' ? recTextLayers(W, H) : null, B = content === 'base' ? recBaseLayers(W, H) : null;
  const out = recCanvas(W, H), o = out.getContext('2d');

  const N = Math.round(opt.seconds * fps), loop = content !== 'flash' && opt.fade > 0, C = loop ? Math.min(Math.round(opt.fade * fps), Math.floor(N / 2)) : 0;
  const P = loop ? opt.seconds / Math.max(1, Math.round(opt.seconds / SHIMMER_P)) : SHIMMER_P;   // 流光周期：让影片长度刚好是整数个周期，循环时文字也接得上
  // 编码器：服务器渲染有 NVENC 时交给服务端（recSink），否则用浏览器内建的 WebCodecs（recEncoder + mp4Mux）
  let E;
  if (opt.sink) E = recSink(opt.sink, W, H);
  else {
    const samples = []; let desc = null;
    const X = await recEncoder(W, H, fps, Math.round(W * H * fps * (opt.bpp || .15)), (chunk, meta) => {
      if (meta?.decoderConfig?.description) desc = new Uint8Array(meta.decoderConfig.description instanceof ArrayBuffer ? meta.decoderConfig.description : meta.decoderConfig.description.buffer || meta.decoderConfig.description);
      const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data); samples.push({ data, key: chunk.type === 'key' });
    }, allowHw);
    E = {
      hw: X.hw, codec: X.codec, failed: X.failed,
      async push(cv, k) {
        const frame = new VideoFrame(cv, { timestamp: Math.round(k * 1e6 / fps), duration: Math.round(1e6 / fps) });
        X.enc.encode(frame, { keyFrame: k % (fps * 2) === 0 }); frame.close();
        while (X.enc.encodeQueueSize > 4) await new Promise(r => X.enc.addEventListener('dequeue', r, { once: true }));
      },
      async finish() {
        try { await X.enc.flush(); } catch (e) { throw Object.assign(new Error('编码失败：' + e.message), { recHw: X.hw }); }
        if (X.kind === 'avc' && !desc) throw new Error('编码器没有给出 H.264 设定');
        onProgress(1, '封装中');
        const blob = mp4Mux({ kind: X.kind, width: W, height: H, fps, desc, samples });
        return { blob, size: blob.size };
      },
      close() { try { X.enc.close(); } catch {} }
    };
  }
  const recT0 = Date.now();
  // 循环用：开头 C 帧的背景，最后几秒拿来交叉淡化。总量不大（≤ 800 MB）时直接留在显卡里（ImageBitmap，最快），
  // 太大就压成 JPEG 暂存（比 WebP 快很多；只用在淡化那几秒，看不出差别）
  const head = [], headRaw = W * H * 4 * C <= 800 * 1048576;
  let tHead = 0;
  const flashAt = []; if (content === 'flash') for (let t = .3; t === .3 || t + 2.6 <= opt.seconds; t += 4) flashAt.push(t);
  let ft = 0;
  // 分段（opt.seg = { from, to }：只输出影片第 from ~ to-1 帧；lib/render.js 把一支影片分给几个分页同时算，最后接起来）。
  // 前面的帧快转（REC_SKIP：特效只推进状态、不画），这一段开始前 2 帧先画一次（不输出），每张画布都是最新的。
  const seg = opt.seg, from = seg ? Math.max(0, seg.from | 0) : 0, to = seg ? Math.min(N, seg.to | 0) : N;
  const needHead = C > 0 && to > N - C;   // 这一段包含最后的循环淡化：要先画开头那几帧
  const total = (needHead ? C : 0) + (to - from);
  let done = 0;
  try {
    for (let i = 0; i < C + to; i++) {
      if (recStop) throw new Error('已取消');
      if (E.failed()) throw Object.assign(new Error('编码失败：' + E.failed().message), { recHw: E.hw });
      const k = i - C, use = i < C ? needHead : k >= from;   // 影片里的第 k 帧；use = 这一帧要输出（或存起来淡化用）
      REC_SKIP = !(use || (k >= from - 2 && k < from));
      if (content === 'flash') { const t = i / fps; while (ft < flashAt.length && flashAt[ft] <= t) { burst(260); ft++; } }
      for (let s = 0; s < sub; s++) recTick(1000 / 60);
      if (REC_SKIP) { if (i % 300 === 0) { onProgress(done / total, '快转到这一段'); await recYield(); } continue; }
      // 背景
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over'; o.filter = 'none';
      if (content === 'standby' || content === 'standbybg') { o.filter = gold.style.filter || 'none'; o.drawImage(gold, 0, 0); o.filter = 'none'; }
      else if (content === 'base') { o.drawImage(B.bgc, 0, 0); o.drawImage($('bg'), 0, 0); o.drawImage(B.fr, 0, 0); }
      else { o.fillStyle = '#000'; o.fillRect(0, 0, W, H); o.drawImage($('fx'), 0, 0); }
      if (i < C) {
        if (!needHead) continue;
        const t = Date.now();
        head.push(headRaw ? await createImageBitmap(out) : await new Promise(r => out.toBlob(r, 'image/jpeg', .92)));
        tHead += Date.now() - t;
        onProgress(++done / total, '准备循环接缝'); continue;
      }
      if (!use) continue;   // 这一段开头前的暖身帧
      if (i >= N) {   // 最后 C 帧：慢慢换成开头的画面
        const bm = headRaw ? head[i - N] : await createImageBitmap(head[i - N]); head[i - N] = null;
        o.globalAlpha = (i - N + .5) / C; o.drawImage(bm, 0, 0); o.globalAlpha = 1; bm.close();
      }
      if (L) { o.drawImage(L.stat, 0, 0); recTitle(o, L, ((k / fps) / P) % 1); }
      await E.push(out, k, o);
      onProgress(++done / total, '渲染中');
      if (i % 2 === 0) await recYield();
    }
    REC_SKIP = false;
    var res = await E.finish();
  } finally { REC_SKIP = false; E.close(); }
  const secs = (Date.now() - recT0) / 1000;   // 注意：录影时 performance.now 是虚拟时钟，这里用真实时间
  return { ...res, codec: E.codec, hw: E.hw, width: W, height: H, speed: total / Math.max(.001, secs), frames: total, headSecs: tHead / 1000, renderSecs: secs - tHead / 1000 };
}
