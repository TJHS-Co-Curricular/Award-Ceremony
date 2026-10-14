#!/usr/bin/env node
/*
 * 表扬大会 · 颁奖公布系统 — 服务端入口
 * 零依赖（只需 Node.js 18+），代码按功能放在 lib/ 里（见 CLAUDE.md「代码结构」）。用法：
 *   node server.js            启动服务
 *   node server.js encrypt    把 data/awards.json 加密成 data/awards.enc（并抹除明文）
 *   node server.js decrypt    把 data/awards.enc 解密回 data/awards.json
 */
'use strict';
const fs = require('fs');
const http = require('http');
const env = require('./lib/env');
const { atomicWrite, audit } = require('./lib/util');
const rt = require('./lib/runtime');
const { loadConfig } = require('./lib/config');
const { SAMPLE, normalizeData, decryptText, readPlain } = require('./lib/data');
const { loadState } = require('./lib/show');
const { loadFx } = require('./lib/fx');
const { lanUrls } = require('./lib/net');
const { quit, askPassphraseLoop, encryptCmd, decryptCmd } = require('./lib/cli');
require('./lib/actions');   // 注册「状态改变后」要做的事（推送、自动播放、嘉宾授权）
const { handler } = require('./lib/routes');

process.on('uncaughtException', e => { console.error('程序错误：', e); quit(1); });

// 读名单：有加密版就先问口令（解密后的名单只放在内存）
async function loadData() {
  if (fs.existsSync(env.ENC)) {
    const blob = fs.readFileSync(env.ENC, 'utf8');
    await askPassphraseLoop(p => { rt.data = normalizeData(JSON.parse(decryptText(blob, p))); rt.passphrase = p; return true; });
    console.log('✓ 名单已解密（仅保存在内存中）');
  } else {
    if (!fs.existsSync(env.PLAIN)) atomicWrite(env.PLAIN, JSON.stringify(SAMPLE, null, 2));
    rt.data = readPlain();
    console.log('⚠ 名单为明文 data/awards.json。正式使用前建议运行：' + env.CLI + ' encrypt（或双击「加密名单.bat」）');
  }
}

function printBanner(created) {
  const CFG = rt.cfg, line = '─'.repeat(64);
  console.log(`\n${line}\n  表扬大会 · 颁奖公布系统 v${env.VERSION} 已启动（监听 ${CFG.host}:${CFG.port}）\n${line}`);
  for (const u of lanUrls()) {
    console.log(`  [${u.ip}]`);
    console.log(`    控制端：${u.control}`);
    for (const sc of CFG.screens || []) console.log(`    输出页·${sc.name}（${sc.width}×${sc.height}）：${u.display}&res=${sc.width}x${sc.height}&name=${encodeURIComponent(sc.name)}`);
    if (!(CFG.screens || []).length) console.log(`    输出页：${u.display}`);
    console.log(`    嘉宾页：${u.guest}`);
  }
  if (created) console.log(`\n  ★ 首次运行，已生成 config.json\n    控制端密码：${CFG.controlPassword}`);
  else console.log('\n  控制端密码见 config.json → controlPassword');
  console.log(`  允许访问的网段：${CFG.allowedNetworks.join(', ')}`);
  if (CFG.controlAllowedIps?.length) console.log(`  仅以下 IP 可进控制端：${CFG.controlAllowedIps.join(', ')}`);
  console.log(`${line}\n`);
}

async function main() {
  for (const d of [env.DATA_DIR, env.PHOTO_DIR, env.CACHE_DIR, env.FONT_DIR, env.LOG_DIR]) fs.mkdirSync(d, { recursive: true });
  if (process.platform === 'win32') process.title = '表扬大会 · 颁奖公布系统';
  const cmd = process.argv[2];   // exe 时 argv[1] 也是 exe 本身，参数同样从 argv[2] 开始
  if (cmd === 'encrypt') return encryptCmd();
  if (cmd === 'decrypt') return decryptCmd();
  if (cmd && cmd !== 'start') { console.log(`用法：${env.CLI} [encrypt|decrypt]`); return; }

  const { cfg, created } = loadConfig();
  rt.cfg = cfg;
  await loadData();
  loadState();
  loadFx(rt.data?.event?.standbyFx);

  const server = http.createServer(handler);
  server.listen(cfg.port, cfg.host, () => {
    printBanner(created);
    audit('SERVER-START', `${cfg.host}:${cfg.port}`);
    if (cfg.openBrowser && process.platform === 'win32') require('child_process').exec(`start "" "http://127.0.0.1:${cfg.port}/control"`, () => {});
  });
  server.on('error', e => {
    console.error('启动失败：', e.code === 'EADDRINUSE' ? `端口 ${cfg.port} 已被占用（系统可能已经在运行，或改 config.json 的 port）` : e.message);
    quit(1);
  });
}
main();
