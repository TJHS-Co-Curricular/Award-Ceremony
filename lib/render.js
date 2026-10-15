/*
 * 服务器渲染影片：在这台电脑（服务端）上开无头 Chrome，跑输出页的导出程序（display.html?record=1 的 recStart()），
 * 把影片存到 Result/影片/。控制端「效果控制 → 服务器渲染」排任务、看进度、下载；命令行 tools/render-video.js 也用这里。
 * 零依赖：Node 22+ 内建的 fetch / WebSocket 直接走 Chrome DevTools 协议。影片不含名单（只用待机画面）。
 * 效果设定用 data/fx.json（含每个屏幕单独的设定）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { ROOT } = require('./env');

const OUT_DIR = path.join(ROOT, 'Result', '影片');
const CONTENT_NAME = { standby: '待机画面', standbybg: '待机背景', base: '底层背景', flash: '揭晓闪光' };
const QUALITY = { 标准: .08, 高: .15, 极高: .3 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DEFAULT_PARALLEL = Math.max(1, Math.floor(os.cpus().length / 4));

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
async function launchChrome() {
  const bin = findChrome();
  if (!bin) throw new Error(available().reason);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'award-render-'));
  const flags = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--proxy-bypass-list=<-loopback>',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-features=AcceleratedVideoEncoder,VaapiVideoEncoder',
    ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []),
    ...(process.env.CHROME_FLAGS || '').split(/\s+/).filter(Boolean), 'about:blank'];
  const proc = spawn(bin, flags, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let err = ''; proc.stderr.on('data', d => { err = (err + d).slice(-8000); });
  const portFile = path.join(dir, 'DevToolsActivePort');
  for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await sleep(100);
  if (!fs.existsSync(portFile)) { proc.kill(); throw new Error('Chrome 启动失败：' + err.slice(-600)); }
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
  return { bin, port, close: () => { try { proc.kill(); } catch {} setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 2000); } };
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
async function runJob(chromePort, job, { base, key, outDir = OUT_DIR }) {
  const url = `${base}/display?k=${encodeURIComponent(key)}&record=1&renew=0&res=${job.width}x${job.height}&name=${encodeURIComponent(job.screen)}`;
  const page = await openPage(chromePort, url);
  job.cancel = () => page.evaluate('recCancel()').catch(() => {});
  const t0 = Date.now();
  try {
    let ready = false;
    for (let i = 0; i < 150 && !ready; i++) { ready = await page.evaluate("typeof recStart === 'function' && typeof booted !== 'undefined' && booted").catch(() => false); if (!ready) await sleep(200); }
    if (!ready) throw new Error('输出页打不开（检查服务端是否在跑、config.json 的 displayKey）');
    const o = JSON.stringify({ content: job.content, seconds: job.seconds, fade: job.fade, fps: job.fps, bpp: job.bpp });
    const done = page.evaluate(`recStart(${o}, null, (p, w) => { window.__prog = [p, w]; })
      .then(r => { window.__rec = r.blob; return { size: r.blob.size, codec: r.codec, hw: r.hw, speed: r.speed }; })`, true);
    const timer = setInterval(async () => { const p = await page.evaluate('window.__prog || null').catch(() => null); if (p) job.onProgress?.(p[0], p[1]); }, 1000);
    const r = await done.finally(() => clearInterval(timer));
    job.onProgress?.(1, '存档中');
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, job.file), fd = fs.openSync(file + '.part', 'w'), CH = 4 * 1048576;
    try {
      for (let off = 0; off < r.size; off += CH) {   // 分块取回（每块 4 MB）
        const b64 = await page.evaluate(`new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result.split(',')[1]); f.readAsDataURL(window.__rec.slice(${off}, ${off + CH})); })`, true);
        fs.writeSync(fd, Buffer.from(b64, 'base64'));
      }
    } finally { fs.closeSync(fd); }
    fs.renameSync(file + '.part', file);
    return { ...r, file, seconds: (Date.now() - t0) / 1000 };
  } finally { job.cancel = null; await page.close(); }
}

/* ---------- 服务端里的排队（控制端用） ---------- */
const Q = { jobs: [], chrome: null, starting: null, idleT: 0, seq: 0, parallel: DEFAULT_PARALLEL };
const rt = () => require('./runtime');
const baseUrl = () => {
  const cfg = rt().cfg, h = cfg.host && !['0.0.0.0', '::', ''].includes(cfg.host) ? cfg.host : '127.0.0.1';
  return `http://${h.includes(':') ? `[${h}]` : h}:${cfg.port}`;
};
function enqueue(list, parallel) {
  const a = available(); if (!a.ok) throw new Error(a.reason);
  const cfg = rt().cfg, screens = Array.isArray(cfg.screens) && cfg.screens.length ? cfg.screens : [{ name: '输出页', width: 1920, height: 1080 }];
  const jobs = makeJobs(list, screens).map(j => ({ ...j, id: ++Q.seq, state: 'queued', prog: 0, what: '排队中', added: Date.now() }));
  if (parallel) Q.parallel = Math.min(8, Math.max(1, parallel | 0));
  Q.jobs.push(...jobs);
  const fin = Q.jobs.filter(j => ['done', 'error', 'canceled'].includes(j.state));
  if (fin.length > 60) { const old = new Set(fin.slice(0, fin.length - 60)); Q.jobs = Q.jobs.filter(j => !old.has(j)); }   // 结束的最多留 60 笔
  pump();
  return jobs.length;
}
function cancel(id) {
  const j = Q.jobs.find(x => x.id === id); if (!j) return false;
  if (j.state === 'queued') { j.state = 'canceled'; j.what = '已取消'; }
  else if (j.state === 'running') { j.what = '取消中…'; j.cancel?.(); }
  return true;
}
async function pump() {
  clearTimeout(Q.idleT);
  const running = Q.jobs.filter(j => j.state === 'running').length, waiting = Q.jobs.filter(j => j.state === 'queued');
  if (!waiting.length) {
    if (!running && Q.chrome) Q.idleT = setTimeout(() => { Q.chrome?.close(); Q.chrome = null; }, 20000);   // 闲置 20 秒关掉 Chrome
    return;
  }
  if (running >= Q.parallel) return;
  if (!Q.chrome) {
    if (!Q.starting) Q.starting = launchChrome().then(c => { Q.chrome = c; }).catch(e => { for (const j of Q.jobs) if (j.state === 'queued') Object.assign(j, { state: 'error', what: '失败', error: e.message }); }).finally(() => { Q.starting = null; });
    await Q.starting; return pump();
  }
  for (const j of waiting.slice(0, Q.parallel - running)) {
    Object.assign(j, { state: 'running', what: '准备中', started: Date.now() });
    j.onProgress = (p, what) => { j.prog = p; j.what = what; };
    runJob(Q.chrome.port, j, { base: baseUrl(), key: rt().cfg.displayKey })
      .then(r => Object.assign(j, { state: 'done', prog: 1, what: '完成', size: r.size, codec: r.codec, hw: r.hw, speed: r.speed }))
      .catch(e => Object.assign(j, /取消/.test(e.message) ? { state: 'canceled', what: '已取消' } : { state: 'error', what: '失败', error: e.message }))
      .finally(() => { j.ended = Date.now(); delete j.onProgress; pump(); });
  }
}
function state() {
  const a = available();
  return {
    available: a.ok, reason: a.reason || '', chrome: a.chrome || '', parallel: Q.parallel, cpus: os.cpus().length,
    jobs: Q.jobs.map(({ cancel, onProgress, bpp, ...j }) => j), files: listFiles()
  };
}
function listFiles() {
  try {
    return fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.mp4')).map(f => { const st = fs.statSync(path.join(OUT_DIR, f)); return { name: f, size: st.size, mtime: st.mtimeMs }; })
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

module.exports = { OUT_DIR, CONTENT_NAME, DEFAULT_PARALLEL, findChrome, available, launchChrome, makeJobs, runJob, enqueue, cancel, state, fileFor, deleteFile };
