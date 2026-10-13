#!/usr/bin/env node
/*
 * 打包成便携 .exe（Node.js 单文件程序 SEA）—— 离线可用
 *
 * 最简单：双击项目根目录的 build.bat
 * 命令行：node build\build-exe.js                 用本机 node.exe 作为底座
 *         node build/build-exe.js path\to\node.exe  指定底座（版本须与运行本脚本的 node 完全一致）
 *
 * 输出到项目主目录（和 config.json、data\ 放一起，源码版和 exe 共用同一份设置与名单）。
 * 文件名带版本号：AwardCeremony-V1.13.exe（版本取自 CHANGELOG.md 最新一个「## [x.y]」）。
 * 服务端代码（server.js + lib/）会先合并成一个文件（SEA 只能执行单个脚本，见 bundle()）；
 * public/ 里的网页、css、js、图标全部作为资源打包进 exe。
 * 想输出到别的文件夹（例如做 U 盘便携版）：设置环境变量 OUT_DIR=dist
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.resolve(ROOT, (process.env.OUT_DIR || '.').trim());
const IN_ROOT = DIST === ROOT;
// 版本号：CHANGELOG.md 里第一个「## [x.y]」（跳过「[未发布]」）；顺便检查 lib/env.js / control/core.js 的版本是否一致
const readText = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const VER_LOG = (readText('CHANGELOG.md').match(/^##\s*\[(\d+(?:\.\d+)+)\]/m) || [])[1] || '';
const VER_SRV = (readText('lib/env.js').match(/const VERSION = '([\d.]+)'/) || [])[1] || '';
const VER_CLI = (readText('public/js/control/core.js').match(/const CLIENT_VERSION = '([\d.]+)'/) || [])[1] || '';
const VER = VER_LOG || VER_SRV || '1.0';
const EXE_NAME = process.env.EXE_NAME || `AwardCeremony-V${VER}.exe`;
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

function fail(msg) { console.error('\n✗ ' + msg); process.exit(1); }

(async () => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 21 && !(major === 20 && minor >= 12)) fail(`Node.js 版本太旧（${process.version}），请安装 Node.js 22 LTS 或更新版本。`);

  const base = process.argv[2] || (process.platform === 'win32' ? process.execPath : null);
  if (!base || !fs.existsSync(base)) fail('请指定 Windows 版 node.exe 路径：node build/build-exe.js path/to/node.exe');
  for (const f of ['server.js', 'lib/env.js', 'public/control.html', 'public/display.html', 'public/guest.html'])
    if (!fs.existsSync(path.join(ROOT, f))) fail(`缺少文件：${f}`);

  fs.mkdirSync(DIST, { recursive: true });
  const exe = path.join(DIST, EXE_NAME);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'award-build-'));

  console.log(`      版本：V${VER}${VER_LOG ? '（取自 CHANGELOG.md）' : '（CHANGELOG.md 没找到版本号，改用 lib/env.js）'} → ${EXE_NAME}`);
  if (VER_SRV && VER_SRV !== VER) console.log(`      ⚠ lib/env.js 的 VERSION 是 ${VER_SRV}，和 CHANGELOG 的 ${VER} 不一致，请检查`);
  if (VER_CLI && VER_CLI !== VER) console.log(`      ⚠ public/js/control/core.js 的 CLIENT_VERSION 是 ${VER_CLI}，和 CHANGELOG 的 ${VER} 不一致，请检查`);
  console.log(`[1/4] 底座：${base}（Node ${process.version}）`);

  // 1. 生成 SEA blob：服务端代码合并成一个文件，public/ 全部作为资源打包进去
  console.log('[2/4] 打包服务端代码和网页…');
  const cfgPath = path.join(tmp, 'sea-config.json');
  const blobPath = path.join(tmp, 'sea-prep.blob');
  const mainPath = path.join(tmp, 'server-bundle.js');
  const mods = bundle(mainPath);
  const assets = Object.fromEntries(walk(path.join(ROOT, 'public')).map(rel => [rel, path.join(ROOT, 'public', ...rel.split('/'))]));
  console.log(`      服务端 ${mods} 个模块，网页资源 ${Object.keys(assets).length} 个文件`);
  fs.writeFileSync(cfgPath, JSON.stringify({
    main: mainPath,
    output: blobPath,
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false,
    assets
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
  setIconAndVersion(work);   // 注入之后再改图标：resedit 会保留 NODE_SEA_BLOB 资源

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
  if (!IN_ROOT) fs.writeFileSync(path.join(DIST, '使用说明.txt'), fs.readFileSync(path.join(__dirname, '使用说明.txt'), 'utf8').replaceAll('AwardCeremony.exe', EXE_NAME));   // 说明里的文件名换成带版本号的
  // 清理旧的分卷文件
  for (const f of fs.readdirSync(DIST)) if (/\.part\d$/.test(f) || f === '合并成exe.bat') fs.rmSync(path.join(DIST, f), { force: true });
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\n✓ 编译完成：${exe}（${(fs.statSync(exe).size / 1048576).toFixed(1)} MB）`);
  console.log(`\n双击 ${EXE_NAME} 即可启动${IN_ROOT ? '（与 start.bat 共用 config.json 和 data 文件夹）' : ''}。`);
  if (process.platform === 'win32') console.log('（已刷新 Windows 图标缓存；如果图标还是旧的，重新整理一下文件夹）');
})().catch(e => fail(e.stack || e.message));

// 列出文件夹里的所有文件（相对路径，用 / 分隔）
function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, base)); else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

/* 把 server.js 和 lib/ 下所有模块合并成一个文件（SEA 的 require 只能载入 Node 内置模块）。
 * 每个文件包成一个函数，由一个很小的 require 依相对路径互相载入；内置模块照常交给 Node。 */
function bundle(outFile) {
  const files = ['server.js', ...walk(path.join(ROOT, 'lib')).filter(f => f.endsWith('.js')).map(f => 'lib/' + f)];
  let out = `'use strict';
// ⚠ 由 build/build-exe.js 自动生成，不要手动修改。原始代码见 server.js 和 lib/。
const __path = require('path');
const __root = typeof __dirname === 'string' ? __dirname : __path.dirname(process.execPath);
const __defs = Object.create(null), __cache = Object.create(null);
function __resolve(dir, x) {
  const p = __path.posix.normalize(__path.posix.join(dir, x));
  for (const c of [p, p + '.js', p + '/index.js']) if (__defs[c]) return c;
  throw new Error('打包里找不到模块：' + x + '（来自 ' + dir + '）');
}
function __load(id) {
  if (__cache[id]) return __cache[id].exports;
  const module = __cache[id] = { exports: {} }, dir = __path.posix.dirname(id);
  const req = x => (x.startsWith('.') ? __load(__resolve(dir, x)) : require(x));
  __defs[id](module, module.exports, req, __path.join(__root, id), __path.join(__root, dir));
  return module.exports;
}
`;
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^#!.*\r?\n/, '');
    out += `__defs[${JSON.stringify(f)}] = function (module, exports, require, __filename, __dirname) {\n${src}\n};\n`;
  }
  out += "__load('server.js');\n";
  fs.writeFileSync(outFile, out);
  return files.length;
}

// 换上 build/icon/icon.ico，并写入文件属性（产品名、版本号）。用随附的 resedit（纯 JS，MIT），不需要 Windows 工具。
function setIconAndVersion(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('latin1', 0, 2) !== 'MZ') return;   // 非 Windows 底座（仅用于测试）
  const icoPath = path.join(__dirname, 'icon', 'icon.ico');
  if (!fs.existsSync(icoPath)) { console.log('      （找不到 build/icon/icon.ico，保留默认图标）'); return; }
  const RE = require('./vendor/resedit.cjs');
  const exe = RE.NtExecutable.from(buf, { ignoreCert: true });
  const res = RE.NtExecutableResource.from(exe);
  const icons = RE.Data.IconFile.from(fs.readFileSync(icoPath)).icons.map(i => i.data);
  const groups = RE.Resource.IconGroupEntry.fromEntries(res.entries);
  const gid = groups.length ? groups[0].id : 1, glang = groups.length ? groups[0].lang : 1033;
  RE.Resource.IconGroupEntry.replaceIconsForResource(res.entries, gid, glang, icons);

  const ver = VER;
  const [a = 1, b = 0, c = 0] = ver.split('.').map(Number);
  const vi = RE.Resource.VersionInfo.fromEntries(res.entries)[0] || RE.Resource.VersionInfo.createEmpty();
  const langs = vi.getAllLanguagesForStringValues();
  const lang = langs[0] || { lang: 1033, codepage: 1200 };
  for (const l of langs.slice(1)) vi.removeAllStringValues(l);
  vi.removeAllStringValues(lang);
  vi.setStringValues(lang, {
    ProductName: '表扬大会 · 颁奖公布系统', FileDescription: '表扬大会 · 颁奖公布系统',
    ProductVersion: ver, FileVersion: ver, InternalName: 'AwardCeremony', OriginalFilename: EXE_NAME,
    CompanyName: '', LegalCopyright: ''
  });
  vi.setFileVersion(a, b, c, 0, lang.lang); vi.setProductVersion(a, b, c, 0, lang.lang);
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  fs.writeFileSync(file, Buffer.from(exe.generate()));
  console.log(`      已设置图标和文件属性（v${ver}）`);
}

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
