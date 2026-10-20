/*
 * Pico 嘉宾按钮的电脑端（普通 Pico 没有 WiFi，由这台电脑代它连服务端）。
 * 做的事和 ESP32 版完全一样：
 *   - 连 /api/guest/stream，看 "guestArmed" → 每秒告诉 Pico 灯要怎么亮（L:IDLE / L:ARMED / L:WAIT / L:BAD）
 *   - Pico 送来 "KEY:DOWN" → POST /api/guest/reveal（成功 L:OK，被拒 L:NO）
 * 串口用 Windows 自带的 PowerShell（.NET SerialPort）打开，不需要装任何 npm 包。
 *
 * 用法：node bridge.js            读同一文件夹的 bridge-config.json
 *       node bridge.js --stdin    测试用：不开串口，从键盘输入 KEY:DOWN，灯号印在屏幕上
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');
const { spawn, execFileSync } = require('child_process');

const CONF_FILE = path.join(__dirname, 'bridge-config.json');
const STDIN_MODE = process.argv.includes('--stdin');
const log = (...a) => console.log(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}]`, ...a);

function fail(msg) {
  console.log('[错误] ' + msg);
  console.log('按 Enter 关闭');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(1));
}

// ============================================================
// 设置
// ============================================================

let conf;
try {
  conf = JSON.parse(fs.readFileSync(CONF_FILE, 'utf8').replace(/^﻿/, ''));
} catch (e) {
  fail(fs.existsSync(CONF_FILE)
    ? `bridge-config.json 格式不对（${e.message}）。请用记事本检查引号和逗号。`
    : '找不到 bridge-config.json。请把 bridge-config.example.json 复制一份改名为 bridge-config.json，再填嘉宾链接。');
  return;
}
let target;
try {
  const u = new URL(String(conf['嘉宾链接'] || '').trim());
  target = { host: u.hostname, port: +u.port || 80, key: u.searchParams.get('k') };
  if (u.protocol !== 'http:' || !target.key) throw new Error();
} catch {
  fail('bridge-config.json 的「嘉宾链接」写法不对。请从控制端「嘉宾揭晓 → 复制」整条贴上，例：http://192.168.1.10/guest?k=xxxx');
  return;
}
const keyQ = 'k=' + encodeURIComponent(target.key);

// ============================================================
// 和服务端：推送 + 揭晓
// ============================================================

let status = 'WAIT';   // WAIT（连线中）/ READY / BAD（链接错误）
let armed = false;
let stream = null;

function connectStream() {
  status = status === 'BAD' ? 'BAD' : 'WAIT';
  const req = http.get({ host: target.host, port: target.port, path: '/api/guest/stream?' + keyQ, headers: { Accept: 'text/event-stream' } }, res => {
    if (res.statusCode === 403) {
      log('嘉宾链接错误（403）：到控制端复制最新的嘉宾链接，改 bridge-config.json 后重开');
      status = 'BAD'; res.resume(); return retry(10000);
    }
    if (res.statusCode !== 200) { log(`服务端回应 ${res.statusCode}，稍后重试`); res.resume(); return retry(3000); }
    log(`已连上服务端 ${target.host}:${target.port}，等待主持人授权`);
    lastErr = '';
    status = 'READY';
    let buf = '';
    res.setEncoding('utf8');
    res.on('data', d => {
      lastData = Date.now();
      buf += d;
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5)).join('\n');
        if (!data) continue;
        try { setArmed(!!JSON.parse(data).guestArmed); } catch {}
      }
    });
    res.on('end', () => { log('推送连接中断，重连'); retry(1000); });
    res.on('error', () => {});
  });
  req.on('error', e => {
    const m = `连不上服务端（${e.code || e.message}）：检查服务端有没有开、IP 有没有变`;
    if (m !== lastErr) log(m);   // 一样的错误只印一次
    lastErr = m; retry(2000);
  });
  stream = req;
  lastData = Date.now();
}
let lastData = 0, retryTimer = null, lastErr = '';
function retry(ms) {
  armed = false;
  if (status !== 'BAD') status = 'WAIT';
  if (stream) { stream.destroy(); stream = null; }
  clearTimeout(retryTimer);
  retryTimer = setTimeout(connectStream, ms);
}
// 服务端每 15 秒发心跳，45 秒没东西就重连
setInterval(() => { if (stream && status === 'READY' && Date.now() - lastData > 45000) { log('推送 45 秒没反应，重连'); retry(0); } }, 5000);

function setArmed(a) {
  if (a === armed) return;
  armed = a;
  log(armed ? '主持人已授权：可以按' : '授权已收回');
  sendLed();
}

async function reveal() {
  if (status !== 'READY') { log('按了，但还没连上服务端，这一下不算'); return toPico('L:NO'); }
  try {
    const r = await fetch(`http://${target.host}:${target.port}/api/guest/reveal?${keyQ}`, { method: 'POST', headers: { 'X-AC': '1' }, signal: AbortSignal.timeout(3000) });
    const msg = { 200: '揭晓成功', 409: '主持人还没授权', 429: '按太快了，1 秒内只算一次', 403: '嘉宾链接错误' }[r.status] || '揭晓失败';
    log(`按了：${msg}（${r.status}）`);
    if (r.status === 403) { status = 'BAD'; sendLed(); return; }
    toPico(r.status === 200 ? 'L:OK' : 'L:NO');
  } catch (e) {
    log('揭晓失败：' + (e.name === 'TimeoutError' ? '服务端 3 秒没回应' : e.message));
    toPico('L:NO');
  }
}

// ============================================================
// 和 Pico：串口（经 PowerShell）或测试用的键盘输入
// ============================================================

let toPico = () => {};
const ledCmd = () => status === 'BAD' ? 'L:BAD' : status !== 'READY' ? 'L:WAIT' : armed ? 'L:ARMED' : 'L:IDLE';
let lastLed = '';
function sendLed(force) {
  const c = ledCmd();
  if (force || c !== lastLed) { lastLed = c; toPico(c); }
}
setInterval(() => sendLed(true), 1000);   // 每秒送一次，Pico 3 秒没收到就当作 bridge 没在跑

function onPicoLine(line) {
  line = line.trim();
  if (line === 'KEY:DOWN') reveal();
  else if (line === 'KEY:HELLO') { log('Pico 已启动'); sendLed(true); }
  else if (line.startsWith('Traceback') || line.includes('Error')) log('Pico 回报：' + line);
}

// 找 Pico 的 COM 口：CircuitPython 的 USB 编号 VID_239A（Adafruit）或 VID_2E8A（树莓派）
function findPicoPort() {
  if (conf['串口'] && conf['串口'] !== '自动') return conf['串口'];
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-Command',
      "Get-CimInstance Win32_PnPEntity | Where-Object { $_.PNPDeviceID -match 'VID_(239A|2E8A)' -and $_.Name -match '\\((COM\\d+)\\)' } | ForEach-Object { $matches[1] }"],
    { encoding: 'utf8', windowsHide: true });
    return out.split(/\s+/).filter(Boolean)[0] || '';
  } catch { return ''; }
}

// PowerShell 负责开串口：串口收到的转到 stdout，stdin 收到的写进串口
const PS_RELAY = `
$ErrorActionPreference = 'Stop'
$p = New-Object System.IO.Ports.SerialPort $env:PICO_PORT, 115200
$p.DtrEnable = $true; $p.RtsEnable = $true
$p.Open()
$in = New-Object System.IO.StreamReader([Console]::OpenStandardInput()); $t = $in.ReadLineAsync()
while ($true) {
  if ($t.IsCompleted) { $l = $t.Result; if ($l -eq $null) { break }; $p.Write($l + "\`n"); $t = $in.ReadLineAsync() }
  if ($p.BytesToRead -gt 0) { [Console]::Out.Write($p.ReadExisting()); [Console]::Out.Flush() }
  if (-not $p.IsOpen) { break }
  Start-Sleep -Milliseconds 5
}
`;
const PS_ENC = Buffer.from(PS_RELAY, 'utf16le').toString('base64');

function openSerial() {
  const port = findPicoPort();
  if (!port) {
    log('找不到 Pico：检查 USB 有没有插好；或在 bridge-config.json 的「串口」直接写 COM 口（例："COM5"）');
    toPico = () => {};
    return setTimeout(openSerial, 3000);
  }
  log(`打开 Pico 串口 ${port}`);
  const ps = spawn('powershell', ['-NoProfile', '-EncodedCommand', PS_ENC], { env: { ...process.env, PICO_PORT: port }, windowsHide: true });
  toPico = l => { if (ps.stdin.writable) ps.stdin.write(l + '\n'); };
  readline.createInterface({ input: ps.stdout }).on('line', onPicoLine);
  let err = '';
  ps.stderr.on('data', d => { err += d; });
  ps.on('exit', () => {
    const why = /denied|拒绝/i.test(err) ? '（串口被别的程序占用：关掉 Thonny / Mu / 串口监视器）'
      : /not exist|不存在/i.test(err) ? `（没有 ${port} 这个串口，检查 bridge-config.json 的「串口」）` : '';
    log(`Pico 串口断开${why}，3 秒后重试`);
    toPico = () => {};
    setTimeout(openSerial, 3000);
  });
}

// ============================================================

process.title = 'Pico 嘉宾按钮';
console.log('==============================================');
console.log('  Pico 嘉宾按钮（电脑端）');
console.log('==============================================');
console.log(`  服务端：  http://${target.host}:${target.port}`);
console.log(`  设置文件：${CONF_FILE}`);
console.log('----------------------------------------------');
console.log('  关闭这个黑色窗口 = 按钮失效');
console.log('');

if (STDIN_MODE) {
  log('测试模式：输入 KEY:DOWN 按 Enter = 按一下按钮');
  let shown = '';   // 灯号每秒都送，屏幕上只印有变化的
  toPico = l => {
    const flash = /^L:(OK|NO)$/.test(l);
    if (flash || l !== shown) console.log('  → Pico ' + l);
    if (!flash) shown = l;
  };
  readline.createInterface({ input: process.stdin }).on('line', onPicoLine);
} else {
  openSerial();
}
connectStream();
