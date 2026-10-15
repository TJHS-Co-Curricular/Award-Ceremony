/*
 * 服务器渲染影片：在这台电脑（服务端）上开无头 Chrome，跑输出页的导出程序（display.html?record=1 的 recStart()），
 * 把影片存到 Result/影片/。控制端「效果控制 → 服务器渲染」排任务、看进度、下载；命令行 tools/render-video.js 也用这里。
 * 零依赖：Node 22+ 内建的 fetch / WebSocket 直接走 Chrome DevTools 协议。影片不含名单（只用待机画面）。
 * 效果设定用 data/fx.json（含每个屏幕单独的设定）。
 * 显卡：
 *   画面——无头 Chrome 依次试 Vulkan / EGL 启动参数，挑第一组真的用上显卡的（RENDER_GPU=off 关掉）。
 *   编码——Linux 版 Chrome 用不到 NVIDIA 的 NVENC，所以服务器装了 ffmpeg 时，改成浏览器只画画面、
 *   每帧原始画面 POST 给本机一个专属端口（每支影片一个后台线程收、直接写进 ffmpeg；一次性密钥 + 只听 127.0.0.1），由 ffmpeg 编码：
 *   先用 h264_nvenc（显卡），不行用 libx264（CPU 多核）；都没有才用浏览器内建编码。RENDER_NVENC=0 / RENDER_FFMPEG=0 可关掉。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const { ROOT } = require('./env');

const OUT_DIR = path.join(ROOT, 'Result', '影片');
const CONTENT_NAME = { standby: '待机画面', standbybg: '待机背景', base: '底层背景', flash: '揭晓闪光' };
const QUALITY = { 标准: .08, 高: .15, 极高: .3 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DEFAULT_PARALLEL = Math.min(16, Math.max(1, Math.floor(os.cpus().length / 2)));   // 每个分页大约吃一个 CPU 核心

/* ---------- 找 Chrome、开 Chrome ---------- */
function findChrome() {
  if (process.env.CHROME) return fs.existsSync(process.env.CHROME) ? process.env.CHROME : null;
  const names = process.platform === 'win32' ? [] : ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];
  for (const n of names) for (const d of (process.env.PATH || '').split(path.delimiter)) { const f = path.join(d, n); if (fs.existsSync(f)) return f; }
  const local = process.env.LOCALAPPDATA ? [path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe')] : [];
  for (const f of ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', ...local,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/opt/google/chrome/chrome'])
    if (fs.existsSync(f)) return f;
  return null;
}
function available() {
  if (typeof WebSocket !== 'function' || typeof fetch !== 'function') return { ok: false, reason: `服务端的 Node.js 太旧（${process.version}），服务器渲染需要 Node.js 22 或更新版本` };
  const chrome = findChrome();
  if (!chrome) return { ok: false, reason: '服务器上找不到 Google Chrome / Edge / Chromium（可用环境变量 CHROME 指定路径）' };
  return { ok: true, chrome };
}
// 无头 Chrome 用显卡的几种启动参数（按顺序试，挑第一组真的用上显卡的；都不行就用 CPU 模拟）
// 可用 RENDER_GPU_FLAGS="--参数 --参数" 指定一组（排在最前面试）；node tools/gpu-check.js 会把每一组的结果列出来
const GPU_FLAGS = [
  ...(process.env.RENDER_GPU_FLAGS ? [['自订', process.env.RENDER_GPU_FLAGS.split(/\s+/).filter(Boolean)]] : []),
  ['Vulkan', ['--use-angle=vulkan', '--use-vulkan=native', '--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE', '--disable-vulkan-surface', '--disable-vulkan-fallback-to-gl-for-testing']],
  ['Vulkan（旧参数）', ['--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface']],
  ['EGL（ANGLE）', ['--use-gl=angle', '--use-angle=gl-egl']],
  ['EGL', ['--use-gl=egl']],
  ['默认', []]
];
let gpuPick = null;   // { name, flags, renderer, hw }（第一次开 Chrome 时决定，之后沿用）
// 问 Chrome 实际用哪张显卡：先开一个分页用 WebGL 问（最准，也会把显卡进程叫起来），再看 SystemInfo 的 2D 画布是不是硬件加速
async function chromeGpu(port) {
  let renderer = '', canvas = '', features = {};
  try {
    const page = await openPage(port, 'about:blank');
    renderer = await page.evaluate(`(() => { const gl = document.createElement('canvas').getContext('webgl'); if (!gl) return '';
      const e = gl.getExtension('WEBGL_debug_renderer_info'); return String(gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER)); })()`).catch(() => '');
    await page.close();
  } catch {}
  try {
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const ws = new WebSocket(webSocketDebuggerUrl);
    await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
    const info = await new Promise(r => { ws.onmessage = e => r(JSON.parse(e.data).result); ws.send(JSON.stringify({ id: 1, method: 'SystemInfo.getInfo' })); setTimeout(() => r(null), 5000); });
    ws.close();
    const g = info?.gpu || {}, aux = g.auxAttributes || {};
    renderer = renderer || String(aux.glRenderer || (g.devices || [])[0]?.deviceString || '');
    canvas = g.featureStatus?.['2d_canvas'] || ''; features = g.featureStatus || {};
  } catch {}
  const soft = !renderer || /swiftshader|llvmpipe|software|basic render/i.test(renderer) || (canvas && !/^enabled/.test(canvas));
  return { renderer: renderer || '未知（显卡进程没启动）', hw: !soft, features };
}
async function launchChrome() {
  if (gpuPick || process.env.RENDER_GPU === 'off') return launchChromeWith(gpuPick?.flags || [], gpuPick?.name || '默认');
  for (const [name, flags] of GPU_FLAGS) {
    const c = await launchChromeWith(flags, name).catch(() => null);
    if (!c) continue;
    if (c.gpu.hw || name === '默认') { gpuPick = { name, flags, ...c.gpu }; return c; }
    c.close();
  }
  throw new Error('Chrome 启动失败');
}
async function launchChromeWith(gpuFlags, gpuName) {
  const bin = findChrome();
  if (!bin) throw new Error(available().reason);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'award-render-'));
  const flags = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--proxy-bypass-list=<-loopback>',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--ignore-gpu-blocklist', '--enable-gpu-rasterization', ...(gpuFlags.length ? gpuFlags : ['--enable-features=AcceleratedVideoEncoder,VaapiVideoEncoder']),
    ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []),
    ...(process.env.CHROME_FLAGS || '').split(/\s+/).filter(Boolean), 'about:blank'];
  const proc = spawn(bin, flags, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let err = ''; proc.stderr.on('data', d => { err = (err + d).slice(-8000); });
  const portFile = path.join(dir, 'DevToolsActivePort');
  for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await sleep(100);
  if (!fs.existsSync(portFile)) { proc.kill(); throw new Error('Chrome 启动失败：' + err.slice(-600)); }
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
  const gpu = await chromeGpu(port);
  return { bin, port, gpu: { ...gpu, mode: gpuName }, close: () => { try { proc.kill(); } catch {} setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 2000); } };
}

/* ---------- 显卡编码：ffmpeg + NVENC ---------- */
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
// ffmpeg 编码器：先用显卡 NVENC；不行就用 libx264（CPU 多核，比浏览器内建的编码快很多）
const FF_CODECS = {
  h264_nvenc: { label: 'NVENC 显卡编码', hw: true, args: fps => ['-c:v', 'h264_nvenc', '-preset', 'p5', '-tune', 'hq', '-rc', 'vbr', '-profile:v', 'high', '-bf', '2', '-g', String(fps * 2)] },
  libx264: { label: 'x264 多核 CPU 编码', hw: false, args: fps => ['-c:v', 'libx264', '-preset', 'fast', '-profile:v', 'high', '-threads', '0', '-g', String(fps * 2)] }
};
let ffCache = null;
// 检查一次：有没有 ffmpeg、有哪些编码器、真的能编（NVIDIA 驱动缺 libnvidia-encode 时 NVENC 会在这里失败）
function ffEncoder() {
  if (ffCache) return ffCache;
  if (process.env.RENDER_FFMPEG === '0') return (ffCache = { ok: false, reason: '已用 RENDER_FFMPEG=0 关掉，用浏览器编码' });
  const enc = spawnSync(FFMPEG, ['-hide_banner', '-encoders'], { encoding: 'utf8', timeout: 10000 });
  if (enc.error) return (ffCache = { ok: false, reason: '服务器没有 ffmpeg（sudo apt install ffmpeg），用浏览器编码' });
  const why = [];
  for (const [codec, c] of Object.entries(FF_CODECS)) {
    if (codec === 'h264_nvenc' && process.env.RENDER_NVENC === '0') { why.push('NVENC 已关掉'); continue; }
    if (!new RegExp('\\b' + codec + '\\b').test(enc.stdout)) { why.push(`ffmpeg 没有 ${codec}`); continue; }
    const t = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:r=30', '-frames:v', '5', ...c.args(30), '-f', 'null', '-'], { encoding: 'utf8', timeout: 20000 });
    if (t.status === 0) return (ffCache = { ok: true, codec, label: c.label, hw: c.hw, reason: why.join('；') });
    const lines = (t.stderr || '').trim().split('\n'), msg = lines.find(l => /cannot|error|fail|no .*device|not supported/i.test(l)) || lines.pop() || '';
    why.push(`${codec} 不能用（${msg.replace(/^\[[^\]]*\]\s*/, '').slice(0, 120)}）`);
  }
  return (ffCache = { ok: false, reason: why.join('；') + '，用浏览器编码' });
}
/* 每支（每段）影片一个「收画面」的后台线程：自己开一个本机端口收浏览器 POST 来的原始画面，直接写进它自己的 ffmpeg。
 * 不经过服务端主线程——8 路同时渲染每秒有 1 GB 以上的画面，原本全挤在 Node 主线程（一个核心）转送，会卡住。
 * 只听 127.0.0.1、要一次性密钥；输出页（record=1）的 CSP 放行连到 127.0.0.1 的其它端口。 */
const { Worker } = require('worker_threads');
const SINK_WORKER = `
const { workerData: w, parentPort } = require('worker_threads');
const http = require('http'), fs = require('fs'), { spawn } = require('child_process');
const PIX = { RGBA: 'rgba', RGBX: 'rgb0', BGRA: 'bgra', BGRX: 'bgr0' };
let proc = null, err = '', exit = null, exited = null;
function start(fmt) {
  proc = spawn(w.ffmpeg, w.args.map(a => a === '__PIX__' ? (PIX[fmt] || 'rgba') : a), { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
  proc.stderr.on('data', d => { err = (err + d).slice(-4000); });
  proc.stdin.on('error', () => {});
  exited = new Promise(r => proc.on('close', c => { exit = c; r(c); }));
}
const done = () => setTimeout(() => process.exit(0), 300);
const srv = http.createServer(async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const reply = (code, body) => { res.writeHead(code, { 'Access-Control-Allow-Origin': '*', 'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
  if (req.method === 'OPTIONS') return reply(204, '');
  if (q.get('t') !== w.token) { req.resume(); return reply(403, 'Forbidden'); }
  if (q.get('abort')) { req.resume(); try { proc && proc.kill('SIGKILL'); } catch {} reply(200, 'ok'); return done(); }
  if (q.get('end')) {
    req.resume();
    if (!proc) return reply(500, '没有收到任何画面');
    proc.stdin.end();
    const c = await exited;
    if (c !== 0) return reply(500, 'ffmpeg 结束代码 ' + c + '：' + err.trim().slice(-300));
    reply(200, { size: fs.statSync(w.file).size }); return done();
  }
  if (!proc) start(q.get('fmt'));
  if (exit !== null) { req.resume(); return reply(500, 'ffmpeg 已结束：' + err.trim().slice(-300)); }
  let bytes = 0;
  req.on('data', d => { bytes += d.length; if (!proc.stdin.write(d)) { req.pause(); proc.stdin.once('drain', () => req.resume()); } });
  req.on('end', () => bytes === w.frameBytes ? reply(200, 'ok') : reply(400, '画面大小不对（' + bytes + '）'));
});
srv.listen(0, '127.0.0.1', () => parentPort.postMessage({ port: srv.address().port }));
parentPort.on('message', m => { if (m === 'kill') { try { proc && proc.kill('SIGKILL'); } catch {} process.exit(0); } });
`;
async function sinkCreate(file, W, H, fps, bitrate, codec, noB) {
  const token = crypto.randomBytes(16).toString('hex'), br = Math.round(bitrate), c = FF_CODECS[codec];
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', '__PIX__', '-s', `${W}x${H}`, '-framerate', String(fps), '-i', 'pipe:0',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', ...c.args(fps), ...(noB ? ['-bf', '0'] : []), '-b:v', String(br), '-maxrate', String(Math.round(br * 1.5)), '-bufsize', String(br * 2),
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', '-f', 'mp4', file];
  const worker = new Worker(SINK_WORKER, { eval: true, workerData: { token, file, args, ffmpeg: FFMPEG, frameBytes: W * H * 4 } });
  const port = await new Promise((ok, bad) => { worker.once('message', m => ok(m.port)); worker.once('error', bad); });
  return { url: `http://127.0.0.1:${port}/?t=${token}`, kill: () => { try { worker.postMessage('kill'); } catch {} setTimeout(() => worker.terminate().catch(() => {}), 1000); } };
}

/* ---------- DevTools 协议：每支影片一个分页 ---------- */
async function openPage(port, url) {
  // 网址带 & 时 /json/new 会截断，所以先开空白页再导航
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = () => bad(new Error('连不上 Chrome 分页')); });
  let id = 0; const wait = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } };
  ws.onclose = () => { for (const r of wait.values()) r({ error: { message: 'Chrome 分页已关闭' } }); wait.clear(); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression, awaitPromise = false) => {
    const m = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (m.error) throw new Error(m.error.message);
    if (m.result.exceptionDetails) throw new Error((m.result.exceptionDetails.exception?.description || m.result.exceptionDetails.text || '').split('\n')[0].replace(/^Error: /, ''));
    return m.result.result.value;
  };
  await send('Page.navigate', { url });
  return { evaluate, close: async () => { try { ws.close(); await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`, { method: 'PUT' }); } catch {} } };
}

/* ---------- 任务 ---------- */
// list：[{ screen（名称或 '*'）, content, seconds, fade, fps, quality（标准/高/极高 或数字）, file? }] → 每个屏幕一支
function makeJobs(list, screens) {
  return list.flatMap(j => {
    const scs = !j.screen || j.screen === '*' ? screens : screens.filter(s => s.name === j.screen);
    if (!scs.length) throw new Error(`屏幕「${j.screen}」不在 config.json 的 screens 里（有：${screens.map(s => s.name).join('、')}）`);
    return scs.map(sc => {
      const content = CONTENT_NAME[j.content] ? j.content : 'standby';
      const fps = +j.fps === 60 ? 60 : 30, seconds = Math.min(600, Math.max(3, Math.round(+j.seconds || 60)));
      const quality = QUALITY[j.quality] ? j.quality : +j.quality > 0 ? +j.quality : '高';
      const name = (j.file ? path.basename(String(j.file)) : `${CONTENT_NAME[content]}-${sc.name}-${sc.width}x${sc.height}-${seconds}s-${fps}fps.mp4`).replace(/[\\/:*?"<>|]/g, '_');
      return { screen: sc.name, width: sc.width, height: sc.height, content, seconds, fps, quality,
        fade: content === 'flash' ? 0 : Math.min(10, Math.max(0, +(j.fade ?? 2) || 0)), bpp: QUALITY[quality] || quality, file: name.endsWith('.mp4') ? name : name + '.mp4' };
    });
  });
}
// 跑一支：job.onProgress(p, what)；job.cancel 会被设成可以中途取消的函数
async function runJob(chromePort, job, ctx) {
  const ff = !job.noFfmpeg && ctx.base.startsWith('http://127.0.0.1') ? ffEncoder() : { ok: false };
  try { return await runJobOnce(chromePort, job, ctx, ff.ok ? ff : null); }
  catch (e) {
    if (!ff.ok || /取消/.test(e.message)) throw e;   // ffmpeg 编码失败：改用浏览器编码重来一次
    job.noFfmpeg = true; job.ffError = e.message;
    job.onProgress?.(0, 'ffmpeg 编码失败，改用浏览器编码');
    return await runJobOnce(chromePort, job, ctx, null);
  }
}
async function runJobOnce(chromePort, job, { base, key, outDir = OUT_DIR }, ff, seg) {
  const url = `${base}/display?k=${encodeURIComponent(key)}&record=1&renew=0&res=${job.width}x${job.height}&name=${encodeURIComponent(job.screen)}`;
  const page = await openPage(chromePort, url);
  let sink = null;
  job.cancel = () => page.evaluate('recCancel()').catch(() => {});
  const t0 = Date.now();
  try {
    let ready = false;
    for (let i = 0; i < 150 && !ready; i++) { ready = await page.evaluate("typeof recStart === 'function' && typeof booted !== 'undefined' && booted").catch(() => false); if (!ready) await sleep(200); }
    if (!ready) throw new Error('输出页打不开（检查服务端是否在跑、config.json 的 displayKey）');
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, job.file);
    if (ff) sink = await sinkCreate(file + '.part', job.width, job.height, job.fps, job.width * job.height * job.fps * job.bpp, ff.codec, !!seg);
    const o = JSON.stringify({ content: job.content, seconds: job.seconds, fade: job.fade, fps: job.fps, bpp: job.bpp, ...(seg ? { seg } : {}),
      ...(sink ? { sink: { url: sink.url } } : {}) });
    const done = page.evaluate(`recStart(${o}, null, (p, w) => { window.__prog = [p, w]; })
      .then(r => { window.__rec = r.blob; return { size: r.size, codec: r.codec, hw: r.hw, speed: r.speed, frames: r.frames, blob: !!r.blob, headSecs: r.headSecs, renderSecs: r.renderSecs }; })`, true);
    const timer = setInterval(async () => { const p = await page.evaluate('window.__prog || null').catch(() => null); if (p) job.onProgress?.(p[0], p[1]); }, 1000);
    const r = await done.finally(() => clearInterval(timer));
    job.onProgress?.(1, '存档中');
    if (r.blob) {
    const fd = fs.openSync(file + '.part', 'w'), CH = 4 * 1048576;
    try {
      for (let off = 0; off < r.size; off += CH) {   // 分块取回（每块 4 MB）
        const b64 = await page.evaluate(`new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result.split(',')[1]); f.readAsDataURL(window.__rec.slice(${off}, ${off + CH})); })`, true);
        fs.writeSync(fd, Buffer.from(b64, 'base64'));
      }
    } finally { fs.closeSync(fd); }
    }
    fs.renameSync(file + '.part', file);
    if (ff) Object.assign(r, { codec: 'avc1·' + ff.codec, hw: ff.hw, encoder: ff.label });
    else r.encoder = r.hw ? '浏览器显卡编码' : '浏览器 CPU 编码';
    return { ...r, file, seconds: (Date.now() - t0) / 1000 };
  } finally { job.cancel = null; sink?.kill(); await page.close(); }
}

/* ---------- 服务端里的排队（控制端用） ---------- */
const Q = { jobs: [], chrome: null, starting: null, idleT: 0, seq: 0, parallel: DEFAULT_PARALLEL };
const rt = () => require('./runtime');
const baseUrl = () => {
  const cfg = rt().cfg, h = cfg.host && !['0.0.0.0', '::', ''].includes(cfg.host) ? cfg.host : '127.0.0.1';
  return `http://${h.includes(':') ? `[${h}]` : h}:${cfg.port}`;
};
// 一支影片切成几段（每段至少 3 秒），交给几个分页同时算，最后用 ffmpeg 无缝接起来（只在有 ffmpeg 时；画面每次都一样，见 display/clock.js）
function planSegs(job) {
  const ff = ffEncoder(), N = Math.round(job.seconds * job.fps);
  const n = ff.ok ? Math.min(Q.parallel, Math.max(1, Math.floor(job.seconds / 3))) : 1;
  if (n <= 1) return [{ i: 0, full: true, state: 'queued', prog: 0 }];
  return Array.from({ length: n }, (_, i) => ({ i, from: Math.round(N * i / n), to: Math.round(N * (i + 1) / n), state: 'queued', prog: 0 }));
}
function enqueue(list, parallel) {
  const a = available(); if (!a.ok) throw new Error(a.reason);
  const cfg = rt().cfg, screens = Array.isArray(cfg.screens) && cfg.screens.length ? cfg.screens : [{ name: '输出页', width: 1920, height: 1080 }];
  if (parallel) Q.parallel = Math.min(16, Math.max(1, parallel | 0));
  const jobs = makeJobs(list, screens).map(j => ({ ...j, id: ++Q.seq, state: 'queued', prog: 0, what: '排队中', added: Date.now() }));
  for (const j of jobs) j.segs = planSegs(j);
  Q.jobs.push(...jobs);
  const fin = Q.jobs.filter(j => ['done', 'error', 'canceled'].includes(j.state));
  if (fin.length > 60) { const old = new Set(fin.slice(0, fin.length - 60)); Q.jobs = Q.jobs.filter(j => !old.has(j)); }   // 结束的最多留 60 笔
  pump();
  return jobs.map(j => j.id);
}
function cancel(id) {
  const j = Q.jobs.find(x => x.id === id); if (!j || !['queued', 'running'].includes(j.state)) return false;
  j.canceling = true; j.what = '取消中…';
  for (const g of j.segs) { if (g.state === 'queued') g.state = 'canceled'; else if (g.state === 'running') g.cancel?.(); }
  if (!j.segs.some(g => g.state === 'running')) jobEnd(j, { state: 'canceled', what: '已取消' });
  return true;
}
function jobEnd(j, fields) {
  if (['done', 'error', 'canceled'].includes(j.state)) return;
  Object.assign(j, fields, { ended: Date.now() });
  for (const g of j.segs) { if (g.file) fs.rmSync(g.file, { force: true }); delete g.cancel; }   // 清掉分段暂存
}
function segProgress(j) {
  const p = j.segs.reduce((n, g) => n + (g.state === 'done' ? 1 : g.prog || 0), 0) / j.segs.length;
  j.prog = p;
  if (j.segs.length > 1) j.what = `分 ${j.segs.length} 段同时算（完成 ${j.segs.filter(g => g.state === 'done').length}）`;
}
// 每段都完成：用 ffmpeg 直接接起来（不重新编码）
function concatSegs(j) {
  const file = path.join(OUT_DIR, j.file), list = path.join(OUT_DIR, `.${j.file}.txt`);
  fs.writeFileSync(list, j.segs.map(g => `file '${g.file.replace(/'/g, "'\\''")}'`).join('\n'));
  return new Promise((ok, bad) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', '-f', 'mp4', file + '.part'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let err = ''; p.stderr.on('data', d => { err = (err + d).slice(-2000); });
    p.on('close', code => { fs.rmSync(list, { force: true }); if (code) return bad(new Error('接起分段失败：' + err.trim().slice(-300))); fs.renameSync(file + '.part', file); ok(fs.statSync(file).size); });
  });
}
async function pump() {
  clearTimeout(Q.idleT);
  const live = Q.jobs.filter(j => j.state === 'queued' || j.state === 'running');
  const running = live.reduce((n, j) => n + j.segs.filter(g => g.state === 'running').length, 0);
  const waiting = live.flatMap(j => j.segs.filter(g => g.state === 'queued').map(g => [j, g]));
  if (!waiting.length) {
    if (!running && Q.chrome) Q.idleT = setTimeout(() => { Q.chrome?.close(); Q.chrome = null; }, 20000);   // 闲置 20 秒关掉 Chrome
    return;
  }
  if (running >= Q.parallel) return;
  if (!Q.chrome) {
    if (!Q.starting) Q.starting = launchChrome().then(c => { Q.chrome = c; }).catch(e => { for (const j of Q.jobs) if (j.state === 'queued') jobEnd(j, { state: 'error', what: '失败', error: e.message }); }).finally(() => { Q.starting = null; });
    await Q.starting; return pump();
  }
  for (const [j, g] of waiting.slice(0, Q.parallel - running)) {
    if (j.state === 'queued') Object.assign(j, { state: 'running', what: '准备中', started: Date.now() });
    g.state = 'running';
    const ctx = { base: baseUrl(), key: rt().cfg.displayKey };
    const task = g.full
      ? (j.onProgress = (p, what) => { j.prog = p; j.what = what; }, runJob(Q.chrome.port, j, ctx))
      : (() => {
          g.file = path.join(OUT_DIR, `.${j.file}.seg${g.i}.mp4`);
          const sj = { ...j, file: path.basename(g.file), onProgress: p => { g.prog = p; segProgress(j); } };
          const t = runJobOnce(Q.chrome.port, sj, ctx, ffEncoder(), { from: g.from, to: g.to });
          g.cancel = () => sj.cancel?.();
          return t;
        })();
    task.then(async r => {
      g.state = 'done'; g.r = r;
      if (g.full) return jobEnd(j, { state: 'done', prog: 1, what: '完成', size: r.size, codec: r.codec, hw: r.hw, speed: r.speed, encoder: r.encoder, gpu: Q.chrome?.gpu, headSecs: r.headSecs, renderSecs: r.renderSecs });
      segProgress(j);
      if (!j.segs.every(x => x.state === 'done')) return;
      j.what = '接起分段';
      const size = await concatSegs(j);
      const frames = j.segs.reduce((n, x) => n + (x.r.frames || 0), 0), secs = (Date.now() - j.started) / 1000;
      jobEnd(j, { state: 'done', prog: 1, what: '完成', size, codec: r.codec, hw: r.hw, encoder: r.encoder + ` · 分 ${j.segs.length} 段同时算`, gpu: Q.chrome?.gpu, speed: frames / secs,
        headSecs: Math.max(...j.segs.map(x => x.r.headSecs || 0)), renderSecs: Math.max(...j.segs.map(x => x.r.renderSecs || 0)) });
    }).catch(e => {
      g.state = /取消/.test(e.message) ? 'canceled' : 'error';
      if (j.canceling || g.state === 'canceled') { if (!j.segs.some(x => x.state === 'running')) jobEnd(j, { state: 'canceled', what: '已取消' }); }
      else { for (const x of j.segs) { if (x.state === 'queued') x.state = 'canceled'; else if (x.state === 'running') x.cancel?.(); } jobEnd(j, { state: 'error', what: '失败', error: e.message }); }
    }).finally(() => { delete g.cancel; if (g.full) delete j.onProgress; pump(); });
  }
}
function state() {
  const a = available();
  return {
    available: a.ok, reason: a.reason || '', chrome: a.chrome || '', parallel: Q.parallel, cpus: os.cpus().length,
    gpu: gpuPick ? `${gpuPick.renderer}${gpuPick.hw ? '' : '（CPU 模拟）'}` : '', encoder: a.ok ? ffEncoder() : { ok: false, reason: '' },
    jobs: Q.jobs.map(({ cancel, onProgress, bpp, segs, ...j }) => ({ ...j, segs: segs.length })), files: listFiles()
  };
}
function listFiles() {
  try {
    return fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.mp4') && !f.startsWith('.')).map(f => { const st = fs.statSync(path.join(OUT_DIR, f)); return { name: f, size: st.size, mtime: st.mtimeMs }; })
      .sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
}
// 只允许 Result/影片/ 里的 .mp4（防止路径跳脱）
function fileFor(name) {
  const b = path.basename(String(name || ''));
  if (!b || b !== String(name) || !b.endsWith('.mp4')) return null;
  const f = path.join(OUT_DIR, b);
  return fs.existsSync(f) ? f : null;
}
function deleteFile(name) { const f = fileFor(name); if (!f) return false; fs.rmSync(f, { force: true }); return true; }

module.exports = { GPU_FLAGS, launchChromeWith, ffEncoder, OUT_DIR, CONTENT_NAME, DEFAULT_PARALLEL, findChrome, available, launchChrome, makeJobs, runJob, enqueue, cancel, state, fileFor, deleteFile };
