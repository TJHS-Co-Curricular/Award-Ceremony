#!/usr/bin/env node
/*
 * 批量导出影片（命令行版；控制端「效果控制 → 服务器渲染」是网页版，两者共用 lib/render.js）。
 * 用法：node tools/render-video.js [任务文件.json] [--parallel N] [--out 目录]（Linux / macOS 可用 ./start.sh render …）
 *   不给任务文件：config.json 里每个屏幕各导出一支「待机画面」（60 秒、循环淡接 2 秒、30 fps、画质高）。
 *   任务文件格式见 tools/render-jobs.example.json。
 * 需要：服务端已经在跑（start.sh render 会自动帮你开）、Node.js 22+、Google Chrome / Chromium（环境变量 CHROME 可指定路径）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('../lib/render');

const ROOT = path.join(__dirname, '..');
const die = msg => { console.error('\n✗ ' + msg); process.exit(1); };
const fmtTime = s => s >= 60 ? `${Math.floor(s / 60)} 分 ${Math.round(s % 60)} 秒` : `${Math.round(s)} 秒`;

const argv = process.argv.slice(2);
const opt = { jobs: null, parallel: 0, out: R.OUT_DIR };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--parallel') opt.parallel = Math.max(1, parseInt(argv[++i], 10) || 1);
  else if (argv[i] === '--out') opt.out = path.resolve(argv[++i]);
  else if (argv[i] === '-h' || argv[i] === '--help') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(0); }
  else opt.jobs = argv[i];
}
const a = R.available(); if (!a.ok) die(a.reason);

let cfg;
try { cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8')); } catch { die('找不到 config.json：请先启动一次服务端（./start.sh）让它生成。'); }
const screens = Array.isArray(cfg.screens) && cfg.screens.length ? cfg.screens : [{ name: '输出页', width: 1920, height: 1080 }];
const base = `http://127.0.0.1:${cfg.port || 80}`;

let list = screens.map(sc => ({ screen: sc.name }));
if (opt.jobs) {
  try { list = JSON.parse(fs.readFileSync(path.resolve(opt.jobs), 'utf8')); } catch (e) { die(`任务文件读不了：${e.message}`); }
  if (!Array.isArray(list)) list = list.jobs;
  if (!Array.isArray(list) || !list.length) die('任务文件里没有任务（要是一个数组，或 { "jobs": [...] }）。');
}
let jobs; try { jobs = R.makeJobs(list, screens); } catch (e) { die(e.message); }
const parallel = opt.parallel || Math.min(jobs.length, R.DEFAULT_PARALLEL);

(async () => {
  try { await fetch(base + '/assets/img/icon.svg'); } catch { die(`连不上服务端 ${base}（请先启动服务端，或用 ./start.sh render 自动启动）。`); }
  console.log(`\n批量导出影片：${jobs.length} 支，同时 ${parallel} 支 → ${path.relative(ROOT, opt.out) || opt.out}`);
  jobs.forEach((j, i) => console.log(`  [${i + 1}] ${R.CONTENT_NAME[j.content]} · ${j.screen} ${j.width}×${j.height} · ${j.seconds} 秒 · ${j.fps} fps${j.fade ? ` · 循环淡接 ${j.fade} 秒` : ''}`));
  let chrome; try { chrome = await R.launchChrome(); } catch (e) { die(e.message); }
  console.log(`  Chrome：${chrome.bin}`);
  const stop = () => { chrome.close(); process.exit(130); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  const T0 = Date.now(); let next = 0, ok = 0;
  await Promise.all(Array.from({ length: parallel }, async () => {
    while (next < jobs.length) {
      const i = next++, j = jobs[i], tag = `[${i + 1}/${jobs.length}]`, t0 = Date.now();
      let last = 0;
      j.onProgress = (p, what) => {
        if (Date.now() - last < 5000 && p < 1) return; last = Date.now();
        console.log(`${tag} ${what} ${(p * 100).toFixed(0)}%` + (p > .02 && p < 1 ? `，还要约 ${fmtTime((Date.now() - t0) / 1000 / p * (1 - p))}` : ''));
      };
      try {
        const r = await R.runJob(chrome.port, j, { base, key: cfg.displayKey, outDir: opt.out });
        console.log(`${tag} ✓ ${path.relative(ROOT, r.file)}  ${(r.size / 1048576).toFixed(1)} MB · ${r.codec.startsWith('avc') ? 'H.264' : 'VP9'} · ${r.hw ? '显卡编码' : 'CPU 编码'} · 每秒算 ${r.speed.toFixed(1)} 帧 · 用了 ${fmtTime(r.seconds)}`);
        ok++;
      } catch (e) { console.log(`${tag} ✗ 失败：${e.message}`); }
    }
  }));
  chrome.close();
  console.log(`\n完成 ${ok}/${jobs.length} 支，共用了 ${fmtTime((Date.now() - T0) / 1000)}。`);
  process.exitCode = ok < jobs.length ? 1 : 0;
  setTimeout(() => process.exit(), 2500);   // 等 Chrome 暂存目录清掉
})();
