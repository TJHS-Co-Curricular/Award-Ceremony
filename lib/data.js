/* 名单：格式检查、加密 / 解密、存档 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PLAIN, ENC } = require('./env');
const { hex, str, atomicWrite } = require('./util');
const rt = require('./runtime');

const REVEAL_MODES = ['one', 'firstall', 'all', 'nominee'];   // 逐一 / 先一后全 / 一次全部 / 入围揭晓

// 第一次运行时生成的示例名单
const SAMPLE = {
  event: { title: '2026 年度表扬大会', subtitle: 'AWARD CEREMONY' },
  awards: [
    { id: 'a1', group: '学术表现', groupSub: 'ACADEMIC', title: '学业优异奖', subtitle: 'Academic Excellence', revealMode: 'one',
      winners: [{ name: '示例同学一', cls: '高一甲班', sid: '10001' }, { name: '示例同学二', cls: '高二乙班', sid: '10002' }, { name: '示例同学三', cls: '高三丙班', sid: '10003' }] },
    { id: 'a2', title: '最佳服务奖', subtitle: 'Outstanding Service', revealMode: 'one',
      winners: [{ name: '示例同学四', detail: '学生会' }, { name: '示例学会', detail: '团体奖', type: 'team' }] },
    { id: 'a4', title: '年度风云人物', subtitle: 'Person of the Year', revealMode: 'nominee',
      winners: [{ name: '入围者甲', cls: '高一甲班' }, { name: '入围者乙', cls: '高二乙班', win: true }, { name: '入围者丙', cls: '高三丙班' }] },
    { id: 'a3', title: '全勤奖', subtitle: 'Perfect Attendance', revealMode: 'all',
      winners: Array.from({ length: 8 }, (_, i) => ({ name: `示例同学${'甲乙丙丁戊己庚辛'[i]}`, cls: `初${(i % 3) + 1}班`, sid: String(20001 + i) })) }
  ]
};

/* ---- 加密（AES-256-GCM，口令经 scrypt 派生） */
function encryptText(text, pass) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(pass, salt, 32);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return JSON.stringify({ v: 1, alg: 'aes-256-gcm/scrypt', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') });
}
function decryptText(blob, pass) {
  const j = JSON.parse(blob);
  const key = crypto.scryptSync(pass, Buffer.from(j.salt, 'base64'), 32);
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(j.iv, 'base64'));
  d.setAuthTag(Buffer.from(j.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(j.data, 'base64')), d.final()]).toString('utf8');
}

/* ---- 格式检查：不管从哪里来的名单（文件、控制端保存），都先整理成标准格式 */
function normalizeData(d) {
  const out = { event: { title: str(d?.event?.title, 120) || '表扬大会', subtitle: str(d?.event?.subtitle, 160), groupIntro: d?.event?.groupIntro !== false, photoKicker: d?.event?.photoKicker !== false,
    standbyFx: d?.event?.standbyFx === 'goldriver' ? 'goldriver' : 'galaxy',   // 待机背景：旋涡星系 / 金色光河（原本）
    fontTitle: str(d?.event?.fontTitle, 120), fontText: str(d?.event?.fontText, 120) }, awards: [] };   // 字体：系统字体名，或「file:文件名」
  const seen = new Set();
  for (const a of (Array.isArray(d?.awards) ? d.awards : []).slice(0, 500)) {
    let id = str(a?.id, 40).replace(/[^\w-]/g, '');
    if (!id || seen.has(id)) id = 'a' + hex(4);
    seen.add(id);
    const winners = (Array.isArray(a?.winners) ? a.winners : []).slice(0, 500)
      .map(w => ({ name: str(w?.name, 80), cls: str(w?.cls, 40), sid: str(w?.sid, 40), detail: str(w?.detail, 120), photo: path.basename(str(w?.photo, 120)), type: w?.type === 'team' ? 'team' : '', win: w?.win === true }))
      .filter(w => w.name)
      .map(w => Object.fromEntries(Object.entries(w).filter(([k, x]) => k === 'name' || x)));   // 去掉空字段
    out.awards.push({ id, group: str(a?.group, 60), groupSub: str(a?.groupSub, 120), ...(a?.groupNoNum === true ? { groupNoNum: true } : {}),
      title: str(a?.title, 120) || '未命名奖项', subtitle: str(a?.subtitle, 160), revealMode: REVEAL_MODES.includes(a?.revealMode) ? a.revealMode : 'one', winners });
    let seenWin = false;   // 每个奖项只能有 1 位得主：多标了只保留第一个（换成别的揭晓方式时保留标记，不会发给大屏）
    for (const w of winners) if (w.win) { if (seenWin) delete w.win; seenWin = true; }
  }
  return out;
}

// 存档：有口令就存加密版，否则存明文
function saveData() {
  const text = JSON.stringify(rt.data, null, 2);
  if (rt.passphrase) atomicWrite(ENC, encryptText(text, rt.passphrase));
  else atomicWrite(PLAIN, text);
}
const readPlain = () => normalizeData(JSON.parse(fs.readFileSync(PLAIN, 'utf8')));

module.exports = { SAMPLE, encryptText, decryptText, normalizeData, saveData, readPlain };
