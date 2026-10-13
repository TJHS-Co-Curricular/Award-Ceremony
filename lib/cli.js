/* 命令行：encrypt / decrypt 名单，输入口令，出错退出 */
'use strict';
const fs = require('fs');
const { IS_EXE, PLAIN, ENC } = require('./env');
const { askHidden, atomicWrite, shred } = require('./util');
const { encryptText, decryptText, readPlain } = require('./data');

// 双击 exe 时，出错窗口会马上关闭；先等用户按 Enter 再退出
function quit(code) {
  if (IS_EXE && process.stdin.isTTY) {
    process.stdout.write('\n按 Enter 键关闭窗口…');
    try { fs.readSync(0, Buffer.alloc(16)); } catch { /* ignore */ }
  }
  process.exit(code);
}
// 最多试 3 次；环境变量 AWARD_PASS 可代替第一次输入（测试 / 自动启动用）
async function askPassphraseLoop(check) {
  for (let i = 0; i < 3; i++) {
    const p = process.env.AWARD_PASS && i === 0 ? process.env.AWARD_PASS : await askHidden('请输入名单解密口令：');
    try { return check(p); } catch { console.log('  ✗ 口令错误'); }
  }
  console.log('多次口令错误，退出。'); quit(1);
}

async function encryptCmd() {
  if (!fs.existsSync(PLAIN)) { console.log('找不到 data/awards.json'); quit(1); }
  const p1 = process.env.AWARD_PASS || await askHidden('设置加密口令（至少 6 位）：');
  if (p1.length < 6) { console.log('口令太短'); quit(1); }
  const p2 = process.env.AWARD_PASS || await askHidden('再输入一次：');
  if (p1 !== p2) { console.log('两次输入不一致'); quit(1); }
  atomicWrite(ENC, encryptText(JSON.stringify(readPlain(), null, 2), p1));
  shred(PLAIN);
  console.log('✓ 已加密为 data/awards.enc，并抹除明文 data/awards.json。请牢记口令！');
}
async function decryptCmd() {
  if (!fs.existsSync(ENC)) { console.log('找不到 data/awards.enc'); quit(1); }
  const blob = fs.readFileSync(ENC, 'utf8');
  const text = await askPassphraseLoop(p => decryptText(blob, p));
  atomicWrite(PLAIN, text);
  fs.unlinkSync(ENC);
  console.log('✓ 已解密为 data/awards.json（明文）。');
}

module.exports = { quit, askPassphraseLoop, encryptCmd, decryptCmd };
