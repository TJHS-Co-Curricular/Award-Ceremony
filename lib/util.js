/* 通用小工具：随机数、比较、写文件、审计日志、命令行输入 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');
const { LOG_DIR } = require('./env');

const hex = n => crypto.randomBytes(n).toString('hex');
// 去掉控制字符、裁切长度（所有从外部来的字符串都先过这一关）
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

function genPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return [...crypto.randomBytes(10)].map(b => chars[b % chars.length]).join('');
}
// 定长比较（防计时攻击）
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hb = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}
// 先写临时文件再改名：写到一半断电也不会留下损坏的文件
function atomicWrite(file, content) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}
// 先用随机数据覆盖再删除（加密名单后抹除明文）
function shred(file) {
  try {
    const size = fs.statSync(file).size;
    fs.writeFileSync(file, crypto.randomBytes(Math.max(size, 1)));
    fs.unlinkSync(file);
  } catch { /* ignore */ }
}
function audit(...parts) {
  const line = `[${new Date().toLocaleString('zh-CN', { hour12: false })}] ${parts.join(' ')}`;
  console.log(line);
  try { fs.appendFileSync(path.join(LOG_DIR, 'audit.log'), line + os.EOL); } catch { /* ignore */ }
}
// 命令行输入口令（不回显）
function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (!rl.muted) rl.output.write(s); };
    rl.question(question, ans => { rl.close(); process.stdout.write('\n'); resolve(ans.trim()); });
    rl.muted = true;
  });
}

module.exports = { hex, str, genPassword, safeEqual, atomicWrite, shred, audit, askHidden };
