#!/usr/bin/env node
/*
 * 批量导出影片（命令行版）。其实是把任务交给正在跑的服务端（和控制端「效果控制 → 在服务器渲染」同一个队列，lib/render.js），
 * 在这里显示进度；所以显卡画面、ffmpeg NVENC / x264 编码都跟网页版一样。
 * 用法：node tools/render-video.js [任务文件.json] [--parallel N] [--out 目录]（Linux / macOS 可用 sh start.sh render …，会自动开服务端）
 *   不给任务文件：config.json 里每个屏幕各导出一支「待机画面」（60 秒、循环淡接 2 秒、30 fps、画质高）。
 *   任务文件格式见 tools/render-jobs.example.json。影片存在 Result/影片/（给 --out 会再复制一份过去）。
 *   按 Ctrl+C 会取消这一批还没完成的影片。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT_NAME = { standby: '待机画面', standbybg: '待机背景', base: '底层背景', flash: '揭晓闪光' };
const die = msg => { console.error('\n✗ ' + msg); process.exit(1); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtTime = s => s >= 60 ? `${Math.floor(s / 60)} 分 ${Math.round(s % 60)} 秒` : `${Math.round(s)} 秒`;

const argv = process.argv.slice(2);
const opt = { jobs: null, parallel: 0, out: null };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--parallel') opt.parallel = Math.max(1, parseInt(argv[++i], 10) || 1);
  else if (argv[i] === '--out') opt.out = path.resolve(argv[++i]);
  else if (argv[i] === '-h' || argv[i] === '--help') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(0); }
  else opt.jobs = argv[i];
}
if (typeof fetch !== 'function') die(`Node.js 版本太旧（${process.version}），请用 Node.js 22 或更新版本。`);

let cfg;
try { cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8')); } catch { die('找不到 config.json：请先启动一次服务端（sh start.sh）让它生成。'); }
const BASE = `http://127.0.0.1:${cfg.port || 80}`;
let list = [{ screen: '*' }];
if (opt.jobs) {
  try { list = JSON.parse(fs.readFileSync(path.resolve(opt.jobs), 'utf8')); } catch (e) { die(`任务文件读不了：${e.message}`); }
  if (!Array.isArray(list)) list = list.jobs;
  if (!Array.isArray(list) || !list.length) die('任务文件里没有任务（要是一个数组，或 { "jobs": [...] }）。');
}

let cookie = '';
async function api(method, url, body) {
  const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', 'X-AC': '1', Origin: BASE, Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}

(async () => {
  try { await fetch(BASE + '/assets/img/icon.svg'); } catch { die(`连不上服务端 ${BASE}（请先启动服务端，或用 sh start.sh render 自动启动）。`); }
  try { await api('POST', '/api/login', { password: cfg.controlPassword }); } catch (e) { die('登录服务端失败：' + e.message); }
  let st = await api('GET', '/api/control/render');
  if (!st.available) die(st.reason);
  let ids;
  try { ({ ids } = await api('POST', '/api/control/render', { jobs: list, ...(opt.parallel ? { parallel: opt.parallel } : {}) })); } catch (e) { die(e.message); }
  st = await api('GET', '/api/control/render');
  const mine = () => st.jobs.filter(j => ids.includes(j.id));
  console.log(`\n批量导出影片：${ids.length} 支，同时 ${st.parallel} 支（服务端 CPU ${st.cpus} 核）→ Result/影片/${opt.out ? ' + ' + opt.out : ''}`);
  console.log(`  编码：${st.encoder?.ok ? st.encoder.label + '（ffmpeg ' + st.encoder.codec + '）' : '浏览器内建'}${st.encoder?.reason ? '   · ' + st.encoder.reason : ''}`);
  mine().forEach(j => console.log(`  [#${j.id}] ${CONTENT_NAME[j.content]} · ${j.screen} ${j.width}×${j.height} · ${j.seconds} 秒 · ${j.fps} fps${j.fade ? ` · 循环淡接 ${j.fade} 秒` : ''}`));

  let stopping = false;
  process.on('SIGINT', async () => {
    if (stopping) process.exit(130); stopping = true;
    console.log('\n取消这一批…');
    for (const j of mine()) if (j.state === 'queued' || j.state === 'running') await api('POST', '/api/control/render/cancel', { id: j.id }).catch(() => {});
  });
  const T0 = Date.now(), shown = {}, said = new Set(); let gpuSaid = false;
  for (;;) {
    await sleep(2000);
    try { st = await api('GET', '/api/control/render'); } catch (e) { console.log('（连不上服务端：' + e.message + '）'); continue; }
    if (!gpuSaid && st.gpu) { console.log(`  画面：${st.gpu}`); gpuSaid = true; }
    for (const j of mine()) {
      const tag = `[#${j.id}]`;
      if (j.state === 'running' && (!shown[j.id] || Date.now() - shown[j.id] > 5000)) {
        shown[j.id] = Date.now();
        const p = j.prog, left = p > .02 && j.started ? `，还要约 ${fmtTime((Date.now() - j.started) / 1000 / p * (1 - p))}` : '';
        console.log(`${tag} ${j.what} ${(p * 100).toFixed(0)}%${left}`);
      }
      if (['done', 'error', 'canceled'].includes(j.state) && !said.has(j.id)) {
        said.add(j.id);
        if (j.state === 'done') {
          console.log(`${tag} ✓ Result/影片/${j.file}  ${(j.size / 1048576).toFixed(1)} MB · ${j.codec?.startsWith('avc') ? 'H.264' : 'VP9'} · ${j.encoder} · 每秒算 ${j.speed?.toFixed(1)} 帧 · 用了 ${fmtTime((j.ended - j.started) / 1000)}`);
          if (j.ffError) console.log(`${tag}   （ffmpeg 编码失败，已改用浏览器编码：${j.ffError}）`);
          if (opt.out) { fs.mkdirSync(opt.out, { recursive: true }); fs.copyFileSync(path.join(ROOT, 'Result', '影片', j.file), path.join(opt.out, j.file)); }
        } else console.log(`${tag} ✗ ${j.state === 'canceled' ? '已取消' : '失败：' + j.error}`);
      }
    }
    if (said.size === ids.length) break;
  }
  const ok = mine().filter(j => j.state === 'done').length;
  console.log(`\n完成 ${ok}/${ids.length} 支，共用了 ${fmtTime((Date.now() - T0) / 1000)}。`);
  process.exit(ok < ids.length ? 1 : 0);
})();
