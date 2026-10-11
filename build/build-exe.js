#!/usr/bin/env node
/*
 * 打包成便携 .exe（Node.js 单文件程序 SEA）—— 离线可用
 *
 * 最简单：双击项目根目录的 build.bat
 * 命令行：node build\build-exe.js                 用本机 node.exe 作为底座
 *         node build/build-exe.js path\to\node.exe  指定底座（版本须与运行本脚本的 node 完全一致）
 *
 * 输出到项目主目录（和 config.json、data\ 放一起，源码版和 exe 共用同一份设置与名单）。
 * 想输出到别的文件夹（例如做 U 盘便携版）：设置环境变量 OUT_DIR=dist
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.resolve(ROOT, (process.env.OUT_DIR || '.').trim());
const IN_ROOT = DIST === ROOT;
const EXE_NAME = process.env.EXE_NAME || 'AwardCeremony.exe';
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

function fail(msg) { console.error('\n✗ ' + msg); process.exit(1); }

(async () => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 21 && !(major === 20 && minor >= 12)) fail(`Node.js 版本太旧（${process.version}），请安装 Node.js 22 LTS 或更新版本。`);

  const base = process.argv[2] || (process.platform === 'win32' ? process.execPath : null);
  if (!base || !fs.existsSync(base)) fail('请指定 Windows 版 node.exe 路径：node build/build-exe.js path/to/node.exe');
  for (const f of ['server.js', 'public/control.html', 'public/display.html', 'public/guest.html'])
    if (!fs.existsSync(path.join(ROOT, f))) fail(`缺少文件：${f}`);

  fs.mkdirSync(DIST, { recursive: true });
  const exe = path.join(DIST, EXE_NAME);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'award-build-'));

  console.log(`[1/4] 底座：${base}（Node ${process.version}）`);

  // 1. 生成 SEA blob，网页作为资源打包进去
  console.log('[2/4] 打包 server.js 和网页…');
  const cfgPath = path.join(tmp, 'sea-config.json');
  const blobPath = path.join(tmp, 'sea-prep.blob');
  fs.writeFileSync(cfgPath, JSON.stringify({
    main: path.join(ROOT, 'server.js'),
    output: blobPath,
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false,
    assets: {
      'control.html': path.join(ROOT, 'public', 'control.html'),
      'display.html': path.join(ROOT, 'public', 'display.html'),
      'guest.html': path.join(ROOT, 'public', 'guest.html')
    }
  }, null, 2));
  execFileSync(process.execPath, ['--experimental-sea-config', cfgPath], { stdio: 'inherit' });

  // 2. 复制底座（先写到临时文件，避免程序正在运行时半途失败），去掉原数字签名
  console.log('[3/4] 复制底座并注入…');
  const work = path.join(tmp, EXE_NAME);
  fs.copyFileSync(base, work);
  stripSignature(work);

  // 3. 注入（使用随附的 postject，无需联网）
  const { inject } = require('./vendor/postject-api.js');
  await inject(work, 'NODE_SEA_BLOB', fs.readFileSync(blobPath), { sentinelFuse: FUSE, overwrite: true });

  // 4. 放到输出目录
  console.log(`[4/4] 写入 ${IN_ROOT ? '项目主目录' : DIST} …`);
  try { fs.copyFileSync(work, exe); }
  catch (e) {
    if (e.code === 'EBUSY' || e.code === 'EPERM') fail(`${EXE_NAME} 正在运行，请先关闭它的黑色窗口再编译。`);
    throw e;
  }
  const bat = cmd => ['@echo off', 'chcp 65001 >nul', 'cd /d "%~dp0"', `"${EXE_NAME}" ${cmd}`, 'pause', ''].join('\r\n');
  fs.writeFileSync(path.join(DIST, '加密名单.bat'), bat('encrypt'));
  fs.writeFileSync(path.join(DIST, '解密名单.bat'), bat('decrypt'));
  if (!IN_ROOT) fs.copyFileSync(path.join(__dirname, '使用说明.txt'), path.join(DIST, '使用说明.txt'));
  // 清理旧的分卷文件
  for (const f of fs.readdirSync(DIST)) if (/\.part\d$/.test(f) || f === '合并成exe.bat') fs.rmSync(path.join(DIST, f), { force: true });
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\n✓ 编译完成：${exe}（${(fs.statSync(exe).size / 1048576).toFixed(1)} MB）`);
})().catch(e => fail(e.stack || e.message));

function stripSignature(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('latin1', 0, 2) !== 'MZ') return;   // 非 Windows 底座（仅用于测试）
  const pe = buf.readUInt32LE(0x3c);
  if (buf.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error('不是有效的 PE 文件');
  const opt = pe + 24;
  const dirs = opt + (buf.readUInt16LE(opt) === 0x20b ? 112 : 96);
  const secEntry = dirs + 4 * 8;                 // IMAGE_DIRECTORY_ENTRY_SECURITY
  const off = buf.readUInt32LE(secEntry), size = buf.readUInt32LE(secEntry + 4);
  if (!off || !size) return;
  buf.writeUInt32LE(0, secEntry); buf.writeUInt32LE(0, secEntry + 4);
  fs.writeFileSync(file, off + size >= buf.length - 8 ? buf.subarray(0, off) : buf);
}
