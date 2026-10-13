#!/usr/bin/env node
/*
 * 表扬大会 · 颁奖公布系统 — 服务端
 * 零依赖（只需 Node.js 18+）。用法：
 *   node server.js            启动服务
 *   node server.js encrypt    把 data/awards.json 加密成 data/awards.enc（并抹除明文）
 *   node server.js decrypt    把 data/awards.enc 解密回 data/awards.json
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const readline = require('readline');

const VERSION = '1.11';
// 打包成 .exe（Node 单文件程序）时，数据放在 exe 旁边，网页从 exe 内部读取
let sea = null;
try { sea = require('node:sea'); } catch { /* 普通 node 运行 */ }
const IS_EXE = !!(sea && sea.isSea && sea.isSea());
const ROOT = IS_EXE ? path.dirname(process.execPath) : __dirname;
const CLI = IS_EXE ? path.basename(process.execPath) : 'node server.js';
const CONFIG_PATH = path.join(ROOT, 'config.json');
const DATA_DIR = path.join(ROOT, 'data');
const PLAIN = path.join(DATA_DIR, 'awards.json');
const ENC = path.join(DATA_DIR, 'awards.enc');
const STATE_PATH = path.join(DATA_DIR, 'state.json');
const EXSTYLE_PATH = path.join(DATA_DIR, 'export-style.json');   // 图片导出的设计（字号、颜色、粗体等），不含名单
const PHOTO_DIR = path.join(DATA_DIR, 'photos');
const CACHE_DIR = path.join(PHOTO_DIR, '_cache');
const FONT_DIR = path.join(DATA_DIR, 'fonts');   // 上传的自定义字体（大屏和图片导出用）   // 控制端压缩后的照片（JPEG），存在就优先发给大屏
const PUBLIC_DIR = path.join(ROOT, 'public');
const LOG_DIR = path.join(ROOT, 'logs');

/* ------------------------------------------------------------------ utils */
const hex = n => crypto.randomBytes(n).toString('hex');
function genPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return [...crypto.randomBytes(10)].map(b => chars[b % chars.length]).join('');
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hb = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function atomicWrite(file, content) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}
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
function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (!rl.muted) rl.output.write(s); };
    rl.question(question, ans => { rl.close(); process.stdout.write('\n'); resolve(ans.trim()); });
    rl.muted = true;
  });
}

/* ------------------------------------------------------------------ IP 过滤 */
function normIp(ip) {
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}
function ipToInt(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}
function inCidr(ip, cidr) {
  const [base, bitsS] = String(cidr).split('/');
  const bits = bitsS === undefined ? 32 : Number(bitsS);
  const a = ipToInt(ip), b = ipToInt(base);
  if (a === null || b === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((a & mask) >>> 0) === ((b & mask) >>> 0);
}
const inAny = (ip, list) => (list || []).some(c => inCidr(ip, c));

/* ------------------------------------------------------------------ 配置 */
const DEFAULT_CONFIG = {
  host: '0.0.0.0',
  port: 8080,
  controlPassword: '',
  displayKey: '',
  guestKey: '',
  allowedNetworks: ['127.0.0.1/32', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
  controlAllowedIps: [],
  sessionHours: 12,
  openBrowser: true,
  // 输出屏幕：每个屏幕一个输出页地址（同样内容，按各自分辨率排版）
  screens: [
    { name: '主屏', width: 4096, height: 1280 },
    { name: '副屏', width: 1216, height: 896 }
  ]
};
function loadConfig() {
  let cfg = {}, changed = false, created = false;
  if (fs.existsSync(CONFIG_PATH)) cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  else changed = created = true;
  if (!('screens' in cfg)) changed = true;   // 旧版 config.json：补上屏幕设置并写回
  cfg = { ...DEFAULT_CONFIG, ...cfg };
  if (!cfg.controlPassword) { cfg.controlPassword = genPassword(); changed = true; }
  if (!cfg.displayKey) { cfg.displayKey = hex(8); changed = true; }
  if (!cfg.guestKey) { cfg.guestKey = hex(8); changed = true; }
  if (changed) atomicWrite(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  return { cfg, created };
}

/* ------------------------------------------------------------------ 数据（可加密） */
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

const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
function normalizeData(d) {
  const out = { event: { title: str(d?.event?.title, 120) || '表扬大会', subtitle: str(d?.event?.subtitle, 160), groupIntro: d?.event?.groupIntro !== false,
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
    out.awards.push({ id, group: str(a?.group, 60), groupSub: str(a?.groupSub, 120), ...(a?.groupNoNum === true ? { groupNoNum: true } : {}), title: str(a?.title, 120) || '未命名奖项', subtitle: str(a?.subtitle, 160), revealMode: ['all', 'nominee'].includes(a?.revealMode) ? a.revealMode : 'one', winners });
    let seenWin = false;   // 每个奖项只能有 1 位得主：多标了只保留第一个（换成别的揭晓方式时保留标记，不会发给大屏）
    for (const w of winners) if (w.win) { if (seenWin) delete w.win; seenWin = true; }
  }
  return out;
}

let passphrase = null; // 仅存在内存
let DATA = null;
function saveData() {
  const text = JSON.stringify(DATA, null, 2);
  if (passphrase) atomicWrite(ENC, encryptText(text, passphrase));
  else atomicWrite(PLAIN, text);
}

/* ------------------------------------------------------------------ 现场状态 */
// phase：只用于「入围揭晓」奖项。'' = 介绍入围者中 / 'suspense' = 悬念「得主是……」 / 'winner' = 已揭晓得主
let state = { mode: 'standby', awardId: null, revealed: 0, phase: '', doneIds: [], blackout: false, message: '', seq: 0 };
const history = [];
const findAward = id => DATA.awards.find(a => a.id === id);
const winIndex = a => (a && a.revealMode === 'nominee' ? a.winners.findIndex(w => w.win) : -1);
const isNominee = a => winIndex(a) >= 0;
// 分类：相邻、分类名称相同的奖项算一组（同名但不相邻的算两组）
function groupRun(a) {
  if (!a || !a.group) return null;
  const L = DATA.awards, i = L.indexOf(a);
  let s = i, e = i;
  while (s > 0 && L[s - 1].group === a.group) s--;
  while (e < L.length - 1 && L[e + 1].group === a.group) e++;
  const list = L.slice(s, e + 1);
  // noNum：这一类不显示「01 / 02 / 03」编号（组里任一奖项勾了就算）
  return { title: a.group, sub: (list.find(x => x.groupSub) || {}).groupSub || '', list, index: i - s + 1, start: L[s], noNum: list.some(x => x.groupNoNum) };
}   // 「入围揭晓」且已指定得主；没指定得主时按「逐一揭晓」处理
// 奖项是否已揭晓完：普通奖项 = 名单全部出现；入围奖项 = 得主已揭晓
const isComplete = (a, st) => !!a && st.mode === 'reveal' && st.awardId === a.id && (isNominee(a) ? st.phase === 'winner' : st.revealed >= a.winners.length);

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    state = { ...state, ...s, doneIds: Array.isArray(s.doneIds) ? s.doneIds : [] };
  } catch { /* fresh */ }
  sanitizeState();
}
function sanitizeState() {
  state.doneIds = state.doneIds.filter(id => findAward(id));
  if (state.awardId && !findAward(state.awardId)) Object.assign(state, { mode: 'standby', awardId: null, revealed: 0 });
  const a = state.awardId && findAward(state.awardId);
  if (a) state.revealed = Math.min(state.revealed, a.winners.length);
  if (!['', 'suspense', 'winner'].includes(state.phase) || state.mode !== 'reveal' || !isNominee(a) || state.revealed < a.winners.length) state.phase = '';
}
function saveState() { try { atomicWrite(STATE_PATH, JSON.stringify(state)); } catch { /* ignore */ } }

function nextPending(afterId, doneIds) {
  const list = DATA.awards;
  const start = afterId ? list.findIndex(a => a.id === afterId) : -1;
  for (let i = 1; i <= list.length; i++) {
    const a = list[(start + i + list.length) % list.length];
    if (a && !doneIds.includes(a.id)) return a;
  }
  return null;
}
function markDoneIfComplete(st) {
  const a = findAward(st.awardId);
  if (isComplete(a, st) && !st.doneIds.includes(a.id)) st.doneIds.push(a.id);
}
/** 计算「下一步」会做什么 */
function planNext(s) {
  const st = { ...s, doneIds: [...s.doneIds], blackout: false };
  const a = s.awardId && findAward(s.awardId);
  const nom = isNominee(a), n = a ? a.winners.length : 0;
  if (s.mode === 'title' && a) {
    st.mode = 'reveal'; st.phase = '';
    st.revealed = a.revealMode === 'all' ? n : Math.min(1, n);
    markDoneIfComplete(st);
    return { st, desc: nom ? `介绍「${a.title}」入围者 1 / ${n}` : a.revealMode === 'all' ? `一次揭晓「${a.title}」全部 ${n} 位` : `揭晓「${a.title}」第 1 位` };
  }
  if (s.mode === 'reveal' && a && s.revealed < n) {
    st.revealed = a.revealMode === 'all' ? n : s.revealed + 1;
    markDoneIfComplete(st);
    return { st, desc: nom ? `介绍「${a.title}」入围者 ${st.revealed} / ${n}` : `揭晓「${a.title}」第 ${st.revealed} / ${n} 位` };
  }
  if (nom && s.mode === 'reveal' && s.phase !== 'winner') {   // 入围者都介绍完：先悬念，再揭晓得主
    if (s.phase !== 'suspense') { st.phase = 'suspense'; return { st, desc: `悬念：「${a.title}」得主是……` }; }
    st.phase = 'winner'; markDoneIfComplete(st);
    return { st, desc: `🏆 揭晓「${a.title}」得主` };
  }
  const resume = s.mode !== 'reveal' && a && !st.doneIds.includes(a.id) ? a : null;
  const nx = resume || nextPending(s.awardId, st.doneIds);
  if (!nx) return { st: { ...st, mode: 'standby', awardId: null, revealed: 0, phase: '' }, desc: '所有奖项已公布 → 返回待机画面' };
  // 进入新的分类：先显示分类标题画面（可在奖项编辑里关掉）
  const g = groupRun(nx), prevG = groupRun(a);
  if (DATA.event.groupIntro !== false && g && s.mode !== 'group' && !resume && (!prevG || prevG.start !== g.start))
    return { st: { ...st, mode: 'group', awardId: nx.id, revealed: 0, phase: '' }, desc: `分类标题「${g.title}」（${g.list.length} 个奖项）` };
  return { st: { ...st, mode: 'title', awardId: nx.id, revealed: 0, phase: '' }, desc: `公布奖项「${nx.title}」（不揭晓名单）` };
}

function commit(next, who, desc) {
  history.push(JSON.parse(JSON.stringify(state)));
  if (history.length > 200) history.shift();
  state = { ...next, seq: state.seq + 1 };
  if (state.mode !== 'reveal') state.phase = '';
  saveState();
  audit('ACTION', who, desc);
  afterChange();
}

/* ------------------------------------------------------------------ 自动播放（服务端计时，控制端关掉也照常运行） */
const auto = { on: false, scope: 'award', interval: 3, hold: 6, nextAt: 0 };
let autoTimer = null;
function stopAuto(reason) {
  clearTimeout(autoTimer); auto.nextAt = 0;
  if (!auto.on) return;
  auto.on = false;
  audit('AUTO-STOP', reason || '');
}
const currentAward = () => ((state.mode === 'title' || state.mode === 'reveal') && state.awardId ? findAward(state.awardId) : null);
const awardComplete = a => isComplete(a, state);
function scheduleAuto() {
  clearTimeout(autoTimer); auto.nextAt = 0;
  if (!auto.on) return;
  const a = currentAward();
  const complete = awardComplete(a);
  if (state.blackout) return stopAuto('黑屏');
  if (auto.scope === 'award' && (!a || complete)) return stopAuto('本奖项已播完');
  if (auto.scope === 'show' && !a && !nextPending(null, state.doneIds)) return stopAuto('全部奖项已播完');
  const sec = complete ? auto.hold : auto.interval;
  auto.nextAt = Date.now() + sec * 1000;
  autoTimer = setTimeout(() => { const p = planNext(state); commit(p.st, '[自动播放]', '下一步：' + p.desc); }, sec * 1000);
}

/* ------------------------------------------------------------------ 嘉宾揭晓 */
const guest = { armed: false, awardId: null, lastPress: 0 };
function disarmGuest(reason) {
  if (!guest.armed) return;
  guest.armed = false; guest.awardId = null;
  audit('GUEST-DISARM', reason || '');
}
const guestActive = () => guest.armed && state.awardId === guest.awardId && !state.blackout;

function afterChange() {
  if (guest.armed && (state.awardId !== guest.awardId || awardComplete(currentAward()) || !currentAward())) disarmGuest('本奖项已揭晓完毕');
  scheduleAuto();
  broadcast();
}

function doAction(body, who) {
  const act = body?.action;
  const a = body?.awardId ? findAward(body.awardId) : null;
  const base = { ...state, doneIds: [...state.doneIds] };
  if (!['next', 'autoStart', 'autoStop', 'guestArm', 'guestDisarm', 'rotateGuestKey'].includes(act)) stopAuto('手动操作');
  switch (act) {
    case 'autoStart': {
      const interval = Math.min(120, Math.max(1, Number(body.interval) || 3));
      const hold = Math.min(300, Math.max(1, Number(body.hold) || interval * 2));
      const scope = body.scope === 'show' ? 'show' : 'award';
      const cur = currentAward();
      if (scope === 'award' && (!cur || awardComplete(cur))) throw new Error('「仅当前奖项」需要先公布一个还没揭晓完的奖项');
      disarmGuest('改为自动播放');
      Object.assign(auto, { on: true, scope, interval, hold });
      audit('AUTO-START', who, `${scope === 'show' ? '整场' : '当前奖项'} 每 ${interval}s，奖项间停留 ${hold}s`);
      scheduleAuto(); broadcast();
      return;
    }
    case 'autoStop': stopAuto(who + ' 暂停'); broadcast(); return;
    case 'guestArm': {
      const cur = currentAward();
      if (!cur || awardComplete(cur)) throw new Error('请先公布一个还没揭晓完的奖项，再交给嘉宾');
      stopAuto('交给嘉宾');
      Object.assign(guest, { armed: true, awardId: cur.id });
      audit('GUEST-ARM', who, `「${cur.title}」`);
      broadcast();
      return;
    }
    case 'guestDisarm': disarmGuest(who + ' 收回'); broadcast(); return;
    case 'rotateGuestKey': {
      CFG.guestKey = hex(8);
      atomicWrite(CONFIG_PATH, JSON.stringify(CFG, null, 2));
      disarmGuest('更换嘉宾链接');
      for (const c of [...clients]) if (c.kind === 'guest') { clients.delete(c); c.res.end(); }
      audit('GUEST-KEY-ROTATED', who);
      broadcast();
      return;
    }
    case 'next': { const p = planNext(state); return commit(p.st, who, '下一步：' + p.desc); }
    case 'standby': return commit({ ...base, mode: 'standby', awardId: null, revealed: 0, blackout: false }, who, '待机画面');
    case 'blackout': return commit({ ...base, blackout: !state.blackout }, who, state.blackout ? '取消黑屏' : '黑屏');
    case 'message': {
      const text = str(body.text, 300);
      if (!text) throw new Error('消息不能为空');
      return commit({ ...base, mode: 'message', message: text, blackout: false }, who, '显示消息：' + text);
    }
    case 'group': {
      const g = groupRun(a);
      if (!g) throw new Error('这个奖项没有分类');
      return commit({ ...base, mode: 'group', awardId: a.id, revealed: 0, blackout: false }, who, `分类标题「${g.title}」`);
    }
    case 'title':
      if (!a) throw new Error('找不到奖项');
      return commit({ ...base, mode: 'title', awardId: a.id, revealed: 0, blackout: false }, who, `公布奖项「${a.title}」`);
    case 'revealAll': {
      const t = a || findAward(state.awardId);
      if (!t) throw new Error('当前没有奖项');
      const st = { ...base, mode: 'reveal', awardId: t.id, revealed: t.winners.length, phase: isNominee(t) ? 'winner' : '', blackout: false };
      markDoneIfComplete(st);
      return commit(st, who, `全部揭晓「${t.title}」`);
    }
    case 'markPending':
      if (!a) throw new Error('找不到奖项');
      return commit({ ...base, doneIds: base.doneIds.filter(id => id !== a.id) }, who, `标记为未公布「${a.title}」`);
    case 'undo': {
      const prev = history.pop();
      if (!prev) throw new Error('没有可撤销的操作');
      state = { ...prev, seq: state.seq + 1 };
      sanitizeState(); saveState(); audit('ACTION', who, '撤销'); afterChange();
      return;
    }
    case 'resetProgress':
      return commit({ mode: 'standby', awardId: null, revealed: 0, doneIds: [], blackout: false, message: '', seq: state.seq }, who, '重置全部进度');
    default: throw new Error(`未知操作「${act}」——控制端和服务端版本不一致，请关闭并重新启动 server.js 后刷新页面`);
  }
}

/* ------------------------------------------------------------------ 视图（防泄露核心） */
// 公开视图：只包含「已经在屏幕上」的信息。未揭晓的名字永远不会离开服务器。
function publicView() {
  const v = { mode: state.mode, blackout: state.blackout, seq: state.seq, event: DATA.event, guestArmed: guestActive() };
  const a = state.awardId && findAward(state.awardId);
  const g = a && groupRun(a);
  if (state.mode === 'group' && g) {
    v.group = { title: g.title, sub: g.sub, noNum: g.noNum, awards: g.list.map(x => ({ title: x.title, subtitle: x.subtitle })) };   // 只有奖项名称，没有名单
  } else if (state.mode === 'group') v.mode = 'standby';
  if ((state.mode === 'title' || state.mode === 'reveal') && a) {
    v.award = { id: a.id, title: a.title, subtitle: a.subtitle };
    if (g) Object.assign(v.award, { group: g.title, groupSub: g.sub, groupIndex: g.index, groupTotal: g.list.length, groupNoNum: g.noNum });
    if (state.mode === 'reveal') {
      v.award.total = a.winners.length;
      v.award.hasPhotos = a.winners.some(w => w.photo);
      v.award.hasTeams = a.winners.some(w => w.type === 'team');   // 只决定版式，不含名字
      if (isNominee(a)) {
        v.award.nominee = true;
        v.award.phase = state.revealed >= a.winners.length ? state.phase || '' : '';
        if (v.award.phase === 'winner') v.award.winnerIndex = winIndex(a);   // ⚠ 得主是谁，只在这一步之后才发出去
      }
      v.winners = a.winners.slice(0, state.revealed).map((w, i) => ({
        name: w.name, cls: w.cls, sid: w.sid, detail: w.detail, type: w.type, photo: w.photo ? `/media/photo?a=${encodeURIComponent(a.id)}&i=${i}` : null
      }));
    }
  } else if (state.mode === 'title' || state.mode === 'reveal') {
    v.mode = 'standby';
  }
  if (state.mode === 'message') v.message = state.message;
  return v;
}
function controlView() {
  return {
    version: VERSION,
    event: DATA.event, awards: DATA.awards, state,
    next: planNext(state).desc,
    canUndo: history.length > 0,
    displays: [...clients].filter(c => c.kind === 'display').map(c => (c.label ? `${c.label}（${c.ip}）` : c.ip)),
    screens: (Array.isArray(CFG.screens) ? CFG.screens : []).map(x => ({ name: str(x?.name, 30) || '屏幕', width: Number(x?.width) || 1920, height: Number(x?.height) || 1080 })),
    guests: [...clients].filter(c => c.kind === 'guest').map(c => c.ip),
    guest: { armed: guest.armed, awardId: guest.awardId },
    auto: { on: auto.on, scope: auto.scope, interval: auto.interval, hold: auto.hold, remainingMs: auto.nextAt ? Math.max(0, auto.nextAt - Date.now()) : 0 },
    encrypted: !!passphrase,
    displayKey: CFG.displayKey,
    urls: lanUrls()
  };
}

/* ------------------------------------------------------------------ 会话 / 登录限制 */
const sessions = new Map(); // token -> {ip, exp}
const fails = new Map();    // ip -> {n, until}
function parseCookies(h) {
  const o = {};
  for (const part of (h || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) o[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return o;
}
function getSession(req, ip) {
  const t = parseCookies(req.headers.cookie).ac_sess;
  const s = t && sessions.get(t);
  if (!s) return null;
  if (s.exp < Date.now() || s.ip !== ip) { sessions.delete(t); return null; }
  return { token: t, ...s };
}

/* ------------------------------------------------------------------ SSE */
const clients = new Set();
function sseOpen(req, res, kind, ip, token, label) {
  res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 2000\n\n');
  const c = { res, kind, ip, token, label };
  clients.add(c);
  if (kind === 'display' || kind === 'guest') audit(kind === 'guest' ? 'GUEST+' : 'DISPLAY+', ip);
  req.on('close', () => {
    clients.delete(c);
    if (kind === 'display' || kind === 'guest') { audit(kind === 'guest' ? 'GUEST-' : 'DISPLAY-', ip); broadcastControl(); }
  });
  send(c);
  if (kind === 'display' || kind === 'guest') broadcastControl();
}
// memo：同一次广播里，同一类客户端只生成一次 JSON（控制端视图含全部名单，可能很大）
function send(c, memo = {}) {
  if (c.kind === 'control' && (!sessions.has(c.token) || sessions.get(c.token).exp < Date.now())) {
    clients.delete(c); c.res.end(); return;
  }
  const key = c.kind === 'control' ? 'control' : c.kind === 'guest' ? 'guest' : 'public';
  if (!memo[key]) {
    const payload = key === 'control' ? controlView() : publicView();
    if (key === 'guest') payload.canPress = guestActive();
    memo[key] = `data: ${JSON.stringify(payload)}\n\n`;
  }
  c.res.write(memo[key]);
}
function broadcast() { const memo = {}; for (const c of [...clients]) send(c, memo); }
function broadcastControl() { const memo = {}; for (const c of [...clients]) if (c.kind === 'control') send(c, memo); }
setInterval(() => { for (const c of clients) c.res.write(': ping\n\n'); }, 15000);

/* ------------------------------------------------------------------ HTTP */
const SEC_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"
};
function sendJson(res, code, obj, extra = {}) {
  res.writeHead(code, { ...SEC_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(obj));
}
function sendText(res, code, text) {
  res.writeHead(code, { ...SEC_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}
// 网页：优先用 exe 旁边的 public/ 文件（方便自行修改），否则用打包在 exe 里的版本
function sendPage(res, name) {
  const local = path.join(PUBLIC_DIR, name);
  if (fs.existsSync(local) || !IS_EXE) return sendFile(res, local, 'text/html; charset=utf-8');
  try {
    const html = sea.getAsset(name, 'utf8');
    res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch { sendText(res, 404, 'Not found'); }
}
function sendFile(res, file, type) {
  fs.readFile(file, (err, buf) => {
    if (err) return sendText(res, 404, 'Not found');
    res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': type });
    res.end(buf);
  });
}
/* ---- 照片：优先发送压缩版；带 ETag，大屏重绘 / 撤销时不必重新下载（每次仍会向服务端确认权限） */
const OPT_MAX_BYTES = 20 * 1024 * 1024;
const safePhotoName = n => { const b = path.basename(String(n || '')); return b && b === String(n) && !b.startsWith('.') && PHOTO_TYPES[path.extname(b).toLowerCase()] ? b : ''; };
// 压缩版文件名带上原图的大小和修改时间：原图被替换后旧的压缩版自动失效
const cacheName = (name, st) => `${name}__${st.size}_${Math.floor(st.mtimeMs)}.jpg`;
function photoSource(name) {
  name = safePhotoName(name); if (!name) return null;
  let st; try { st = fs.statSync(path.join(PHOTO_DIR, name)); } catch { return null; }
  const c = path.join(CACHE_DIR, cacheName(name, st));
  try { return { file: c, type: 'image/jpeg', st: fs.statSync(c), orig: st, optimized: true }; } catch { /* 没有压缩版 */ }
  return { file: path.join(PHOTO_DIR, name), type: PHOTO_TYPES[path.extname(name).toLowerCase()], st, orig: st, optimized: false };
}
function sendPhoto(req, res, src) {
  const etag = `"${src.st.size.toString(36)}-${Math.floor(src.st.mtimeMs).toString(36)}"`;
  const h = { ...SEC_HEADERS, 'Cache-Control': 'private, no-cache', ETag: etag };
  delete h.Pragma;
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
  res.writeHead(200, { ...h, 'Content-Type': src.type, 'Content-Length': src.st.size });
  fs.createReadStream(src.file).on('error', () => res.destroy()).pipe(res);
}
function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', ch => { size += ch.length; if (size > limit) { reject(new Error('文件过大')); req.destroy(); } else chunks.push(ch); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function photoList() {   // 名单里用到的照片（控制端「照片优化」用）
  const names = [...new Set(DATA.awards.flatMap(a => a.winners.map(w => w.photo).filter(Boolean)))];
  return names.map(name => {
    const s = photoSource(name);
    return s ? { name, size: s.orig.size, optimized: s.optimized, sendSize: s.st.size } : { name, missing: true };
  });
}
function readBody(req, limit = 3 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', ch => { size += ch.length; if (size > limit) { reject(new Error('请求过大')); req.destroy(); } else chunks.push(ch); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Error('JSON 格式错误')); } });
    req.on('error', reject);
  });
}
// 防 CSRF：必须带自定义头，且 Origin（如有）必须与 Host 一致
function csrfOk(req) {
  if (req.headers['x-ac'] !== '1') return false;
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}
const FONT_TYPES = { '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const safeFontName = n => { const b = path.basename(String(n || '')); return b && b === String(n) && !b.startsWith('.') && FONT_TYPES[path.extname(b).toLowerCase()] ? b : ''; };
const FONT_MAGIC = [[0x00, 0x01, 0x00, 0x00], [0x4f, 0x54, 0x54, 0x4f], [0x77, 0x4f, 0x46, 0x46], [0x77, 0x4f, 0x46, 0x32], [0x74, 0x72, 0x75, 0x65], [0x74, 0x74, 0x63, 0x66]];   // TTF / OTF / WOFF / WOFF2 / true / TTC
const PHOTO_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

/* ------------------------------------------------------------------ OBS 场景集合（浏览器来源 + DistroAV 单独 NDI 输出） */
function obsSceneCollection(host, fps) {
  const screens = (Array.isArray(CFG.screens) && CFG.screens.length ? CFG.screens : [{ name: '输出', width: 1920, height: 1080 }])
    .map(x => ({ name: str(x?.name, 30) || '屏幕', width: Number(x?.width) || 1920, height: Number(x?.height) || 1080 }));
  const base = (id, name, settings, extra = {}) => ({
    prev_ver: 503447555, name, uuid: crypto.randomUUID(), id, versioned_id: id, settings,
    mixers: 0, sync: 0, flags: 0, volume: 1.0, balance: 0.5, enabled: true, muted: false,
    'push-to-mute': false, 'push-to-mute-delay': 0, 'push-to-talk': false, 'push-to-talk-delay': 0,
    hotkeys: {}, deinterlace_mode: 0, deinterlace_field_order: 0, monitoring_type: 0, private_settings: {}, ...extra
  });
  const sources = [], order = [];
  screens.forEach((sc, idx) => {
    const ndiName = 'AWARD-' + (idx === 0 ? 'MAIN' : idx === 1 ? 'SIDE' : 'SCREEN' + (idx + 1));
    const url = `http://${host}:${CFG.port}/display?k=${CFG.displayKey}&res=${sc.width}x${sc.height}&name=${encodeURIComponent(sc.name + '·OBS')}`;
    const browser = base('browser_source', `${sc.name} 网页 ${sc.width}×${sc.height}`, {
      url, width: sc.width, height: sc.height, fps_custom: true, fps,
      shutdown: false, restart_when_active: false, reroute_audio: false, is_local_file: false, css: ''
    }, {
      filters: [{
        prev_ver: 503447555, name: `NDI 输出 ${ndiName}`, uuid: crypto.randomUUID(), id: 'ndi_filter', versioned_id: 'ndi_filter',
        settings: { ndi_filter_ndiname: ndiName, ndi_filter_ndigroups: '' }, mixers: 0, sync: 0, flags: 0, volume: 1.0, balance: 0.5,
        enabled: true, muted: false, hotkeys: {}, deinterlace_mode: 0, deinterlace_field_order: 0, monitoring_type: 0, private_settings: {}
      }]
    });
    const sceneName = `${sc.name} ${sc.width}×${sc.height}`;
    const scene = base('scene', sceneName, {
      id_counter: 1, custom_size: false,
      items: [{
        name: browser.name, source_uuid: browser.uuid, visible: true, locked: true, rot: 0.0,
        pos: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, align: 5, bounds_type: 0, bounds_align: 0, bounds_crop: false, bounds: { x: 0, y: 0 },
        crop_left: 0, crop_top: 0, crop_right: 0, crop_bottom: 0, id: 1, group_item_backup: false,
        scale_filter: 'disable', blend_method: 'default', blend_type: 'normal',
        show_transition: { duration: 0 }, hide_transition: { duration: 0 }, private_settings: {}
      }]
    }, { filters: [] });
    sources.push(scene, browser);
    order.push({ name: sceneName });
  });
  return {
    name: '表扬大会', current_scene: order[0].name, current_program_scene: order[0].name, scene_order: order,
    sources, groups: [], quick_transitions: [], transitions: [], saved_projectors: [],
    current_transition: 'Fade', transition_duration: 300, preview_locked: false,
    scaling_enabled: false, scaling_level: 0, scaling_off_x: 0.0, scaling_off_y: 0.0, modules: {},
    canvases: []
  };
}

function lanUrls() {
  const ips = [];
  if (CFG.host && CFG.host !== '0.0.0.0') ips.push(CFG.host);
  else for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  if (!ips.length) ips.push('127.0.0.1');
  return ips.map(ip => ({ ip, control: `http://${ip}:${CFG.port}/control`, display: `http://${ip}:${CFG.port}/display?k=${CFG.displayKey}`, guest: `http://${ip}:${CFG.port}/guest?k=${CFG.guestKey}` }));
}

async function handle(req, res) {
  const ip = normIp(req.socket.remoteAddress);
  if (!inAny(ip, CFG.allowedNetworks)) { audit('BLOCKED', ip, req.method, req.url.split('?')[0]); return sendText(res, 403, 'Forbidden'); }
  const url = new URL(req.url, 'http://local');
  const p = url.pathname;
  const controlIpOk = !CFG.controlAllowedIps?.length || inAny(ip, CFG.controlAllowedIps);
  const isControlPath = p === '/control' || p.startsWith('/api/control') || p === '/api/login';
  if (isControlPath && !controlIpOk) { audit('BLOCKED-CONTROL', ip, p); return sendText(res, 403, 'Forbidden'); }

  // ---- 纯输出页
  if (req.method === 'GET' && p === '/display') {
    if (!safeEqual(url.searchParams.get('k'), CFG.displayKey)) { audit('BAD-DISPLAY-KEY', ip); return sendText(res, 403, 'Forbidden'); }
    return sendPage(res, 'display.html');
  }
  if (req.method === 'GET' && p === '/api/display/stream') {
    if (!safeEqual(url.searchParams.get('k'), CFG.displayKey)) return sendText(res, 403, 'Forbidden');
    const preview = url.searchParams.get('preview') === '1' && getSession(req, ip);
    return sseOpen(req, res, preview ? 'preview' : 'display', ip, null, str(url.searchParams.get('name'), 30));
  }
  if (req.method === 'GET' && p === '/media/font') {   // 字体不是机密，但仍要求输出页 / 嘉宾密钥或已登录
    const k = url.searchParams.get('k');
    if (!getSession(req, ip) && !safeEqual(k, CFG.displayKey) && !safeEqual(k, CFG.guestKey)) return sendText(res, 403, 'Forbidden');
    const name = safeFontName(url.searchParams.get('f'));
    let st; try { st = name && fs.statSync(path.join(FONT_DIR, name)); } catch { /* 不存在 */ }
    if (!st) return sendText(res, 404, 'Not found');
    return sendPhoto(req, res, { file: path.join(FONT_DIR, name), type: FONT_TYPES[path.extname(name).toLowerCase()], st });
  }
  if (req.method === 'GET' && p === '/media/photo') {
    const a = findAward(url.searchParams.get('a'));
    const i = Number(url.searchParams.get('i'));
    const w = a && Number.isInteger(i) ? a.winners[i] : null;
    if (!w || !w.photo) return sendText(res, 404, 'Not found');
    const authed = !!getSession(req, ip);
    // 显示端只能拿到「已揭晓」的照片；控制端（已登录）可预览全部
    const revealedNow = state.mode === 'reveal' && state.awardId === a.id && i < state.revealed;
    const keyOk = safeEqual(url.searchParams.get('k'), CFG.displayKey) || safeEqual(url.searchParams.get('k'), CFG.guestKey);
    if (!authed && !(keyOk && revealedNow)) return sendText(res, 403, 'Forbidden');
    const src = photoSource(w.photo);
    if (!src) return sendText(res, 404, 'Not found');
    return sendPhoto(req, res, src);
  }

  // ---- 嘉宾揭晓页
  if (p === '/guest' || p.startsWith('/api/guest/')) {
    if (!safeEqual(url.searchParams.get('k'), CFG.guestKey)) { audit('BAD-GUEST-KEY', ip); return sendText(res, 403, 'Forbidden'); }
    if (req.method === 'GET' && p === '/guest') return sendPage(res, 'guest.html');
    if (req.method === 'GET' && p === '/api/guest/stream') return sseOpen(req, res, 'guest', ip);
    if (req.method === 'POST' && p === '/api/guest/reveal') {
      if (!csrfOk(req)) return sendJson(res, 403, { error: '请求被拒绝' });
      if (!guestActive()) return sendJson(res, 409, { error: '尚未获得主持人授权' });
      if (Date.now() - guest.lastPress < 1000) return sendJson(res, 429, { error: '请稍候' });
      guest.lastPress = Date.now();
      const p2 = planNext(state);
      commit(p2.st, `[嘉宾 ${ip}]`, '嘉宾揭晓：' + p2.desc);
      return sendJson(res, 200, { ok: true });
    }
    return sendText(res, 404, 'Not found');
  }

  // ---- 控制端
  if (req.method === 'GET' && p === '/control') return sendPage(res, 'control.html');

  if (req.method === 'POST' && p === '/api/login') {
    if (!csrfOk(req)) return sendJson(res, 403, { error: '请求被拒绝' });
    const f = fails.get(ip) || { n: 0, until: 0 };
    if (f.until > Date.now()) return sendJson(res, 429, { error: `尝试次数过多，请 ${Math.ceil((f.until - Date.now()) / 1000)} 秒后再试` });
    const body = await readBody(req, 4096);
    if (!safeEqual(body.password, CFG.controlPassword)) {
      f.n += 1;
      if (f.n >= 5) { f.until = Date.now() + 5 * 60 * 1000; f.n = 0; }
      fails.set(ip, f);
      audit('LOGIN-FAIL', ip);
      return sendJson(res, 401, { error: '密码错误' });
    }
    fails.delete(ip);
    const token = hex(24);
    const hours = Number(CFG.sessionHours) || 12;
    sessions.set(token, { ip, exp: Date.now() + hours * 3600e3 });
    audit('LOGIN', ip);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': `ac_sess=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${hours * 3600}` });
  }

  if (p.startsWith('/api/control') || p === '/api/logout') {
    const s = getSession(req, ip);
    if (!s) return sendJson(res, 401, { error: '未登录' });
    const who = `[控制端 ${ip}]`;
    if (req.method !== 'GET' && !csrfOk(req)) return sendJson(res, 403, { error: '请求被拒绝' });

    if (req.method === 'POST' && p === '/api/logout') {
      sessions.delete(s.token);
      for (const c of [...clients]) if (c.token === s.token) { clients.delete(c); c.res.end(); }
      audit('LOGOUT', ip);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'ac_sess=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    }
    if (req.method === 'GET' && p === '/api/control/state') return sendJson(res, 200, controlView());
    if (req.method === 'GET' && p === '/api/control/obs') {
      const host = str(url.searchParams.get('host'), 64).replace(/[^\w.:-]/g, '') || '127.0.0.1';
      const fps = [25, 30, 50, 60].includes(Number(url.searchParams.get('fps'))) ? Number(url.searchParams.get('fps')) : 60;
      audit('OBS-EXPORT', who, host);
      const body = JSON.stringify(obsSceneCollection(host, fps), null, 2);
      res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="award-obs.json"; filename*=UTF-8''${encodeURIComponent('表扬大会-OBS场景.json')}` });
      return res.end(body);
    }
    if (req.method === 'GET' && p === '/api/control/stream') return sseOpen(req, res, 'control', ip, s.token);
    // 照片优化：列表 → 控制端读原图 → 浏览器里缩小成 JPEG → 上传到 data/photos/_cache/
    if (req.method === 'GET' && p === '/api/control/photos') return sendJson(res, 200, { photos: photoList() });
    // 图片导出的设计：整份 JSON 存取（只有排版设定，没有名字）；控制端负责补默认值和检查数值
    if (req.method === 'GET' && p === '/api/control/export-style') {
      let style = {}; try { style = JSON.parse(fs.readFileSync(EXSTYLE_PATH, 'utf8')); } catch { /* 还没存过 */ }
      return sendJson(res, 200, { style });
    }
    if (req.method === 'PUT' && p === '/api/control/export-style') {
      const body = await readBody(req, 64 * 1024);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return sendJson(res, 400, { error: '格式错误' });
      atomicWrite(EXSTYLE_PATH, JSON.stringify(body, null, 2));
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'GET' && p === '/api/control/fonts')
      return sendJson(res, 200, { fonts: fs.readdirSync(FONT_DIR).filter(safeFontName).map(f => ({ name: f, size: fs.statSync(path.join(FONT_DIR, f)).size })) });
    if (req.method === 'POST' && p === '/api/control/font') {
      const name = safeFontName(url.searchParams.get('name'));
      if (!name) return sendJson(res, 400, { error: '只支持 .ttf / .otf / .woff / .woff2' });
      const buf = await readRaw(req, 40 * 1024 * 1024);
      if (!FONT_MAGIC.some(m => m.every((x, i) => buf[i] === x))) return sendJson(res, 400, { error: '不是有效的字体文件' });
      atomicWrite(path.join(FONT_DIR, name), buf);
      audit('FONT-UPLOAD', who, `${name} ${(buf.length / 1048576).toFixed(1)}MB`);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'GET' && p === '/api/control/photo') {
      const name = safePhotoName(url.searchParams.get('name'));
      if (!name || !fs.existsSync(path.join(PHOTO_DIR, name))) return sendText(res, 404, 'Not found');
      const st = fs.statSync(path.join(PHOTO_DIR, name));
      return sendPhoto(req, res, { file: path.join(PHOTO_DIR, name), type: PHOTO_TYPES[path.extname(name).toLowerCase()], st });
    }
    if (req.method === 'POST' && p === '/api/control/photo-opt') {
      const name = safePhotoName(url.searchParams.get('name'));
      let st; try { st = name && fs.statSync(path.join(PHOTO_DIR, name)); } catch { /* 不存在 */ }
      if (!st) return sendJson(res, 404, { error: '找不到原图' });
      const buf = await readRaw(req, OPT_MAX_BYTES);
      if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return sendJson(res, 400, { error: '不是 JPEG' });
      for (const f of fs.readdirSync(CACHE_DIR)) if (f.startsWith(name + '__')) fs.rmSync(path.join(CACHE_DIR, f), { force: true });   // 清掉旧版本
      atomicWrite(path.join(CACHE_DIR, cacheName(name, st)), buf);
      audit('PHOTO-OPT', who, `${name} ${(st.size / 1048576).toFixed(1)}MB → ${(buf.length / 1048576).toFixed(1)}MB`);
      return sendJson(res, 200, { ok: true, size: buf.length });
    }
    if (req.method === 'POST' && p === '/api/control/action') {
      const body = await readBody(req, 16 * 1024);
      try { doAction(body, who); } catch (e) { return sendJson(res, 400, { error: e.message }); }
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'PUT' && p === '/api/control/data') {
      const body = await readBody(req);
      DATA = normalizeData(body);
      sanitizeState(); saveData(); saveState();
      audit('DATA-SAVED', who, `${DATA.awards.length} 个奖项`);
      afterChange();
      return sendJson(res, 200, { ok: true, data: DATA });
    }
    return sendJson(res, 404, { error: 'Not found' });
  }

  if (p === '/favicon.ico') { res.writeHead(204, SEC_HEADERS); return res.end(); }
  // 其它一律 404，不暴露任何信息
  return sendText(res, 404, 'Not found');
}

/* ------------------------------------------------------------------ 启动 */
// 双击 exe 时，出错窗口会马上关闭；先等用户按 Enter 再退出
function quit(code) {
  if (IS_EXE && process.stdin.isTTY) {
    process.stdout.write('\n按 Enter 键关闭窗口…');
    try { fs.readSync(0, Buffer.alloc(16)); } catch { /* ignore */ }
  }
  process.exit(code);
}
process.on('uncaughtException', e => { console.error('程序错误：', e); quit(1); });
let CFG;
async function askPassphraseLoop(check) {
  for (let i = 0; i < 3; i++) {
    const p = process.env.AWARD_PASS && i === 0 ? process.env.AWARD_PASS : await askHidden('请输入名单解密口令：');
    try { return check(p); } catch { console.log('  ✗ 口令错误'); }
  }
  console.log('多次口令错误，退出。'); quit(1);
}

async function main() {
  for (const d of [DATA_DIR, PHOTO_DIR, CACHE_DIR, FONT_DIR, LOG_DIR]) fs.mkdirSync(d, { recursive: true });
  if (process.platform === 'win32') process.title = '表扬大会 · 颁奖公布系统';
  const cmd = process.argv[2]; // exe 时 argv[1] 也是 exe 本身，参数同样从 argv[2] 开始

  if (cmd === 'encrypt') {
    if (!fs.existsSync(PLAIN)) { console.log('找不到 data/awards.json'); quit(1); }
    const p1 = process.env.AWARD_PASS || await askHidden('设置加密口令（至少 6 位）：');
    if (p1.length < 6) { console.log('口令太短'); quit(1); }
    const p2 = process.env.AWARD_PASS || await askHidden('再输入一次：');
    if (p1 !== p2) { console.log('两次输入不一致'); quit(1); }
    const text = JSON.stringify(normalizeData(JSON.parse(fs.readFileSync(PLAIN, 'utf8'))), null, 2);
    atomicWrite(ENC, encryptText(text, p1));
    shred(PLAIN);
    console.log('✓ 已加密为 data/awards.enc，并抹除明文 data/awards.json。请牢记口令！');
    return;
  }
  if (cmd === 'decrypt') {
    if (!fs.existsSync(ENC)) { console.log('找不到 data/awards.enc'); quit(1); }
    const blob = fs.readFileSync(ENC, 'utf8');
    const text = await askPassphraseLoop(p => decryptText(blob, p));
    atomicWrite(PLAIN, text);
    fs.unlinkSync(ENC);
    console.log('✓ 已解密为 data/awards.json（明文）。');
    return;
  }
  if (cmd && cmd !== 'start') { console.log(`用法：${CLI} [encrypt|decrypt]`); return; }

  const { cfg, created } = loadConfig();
  CFG = cfg;

  if (fs.existsSync(ENC)) {
    const blob = fs.readFileSync(ENC, 'utf8');
    await askPassphraseLoop(p => { DATA = normalizeData(JSON.parse(decryptText(blob, p))); passphrase = p; return true; });
    console.log('✓ 名单已解密（仅保存在内存中）');
  } else {
    if (!fs.existsSync(PLAIN)) atomicWrite(PLAIN, JSON.stringify(SAMPLE, null, 2));
    DATA = normalizeData(JSON.parse(fs.readFileSync(PLAIN, 'utf8')));
    console.log('⚠ 名单为明文 data/awards.json。正式使用前建议运行：' + CLI + ' encrypt（或双击「加密名单.bat」）');
  }
  loadState();

  const server = http.createServer((req, res) => {
    handle(req, res).catch(e => { console.error(e); if (!res.headersSent) sendJson(res, 500, { error: e.message || '服务器错误' }); });
  });
  server.listen(CFG.port, CFG.host, () => {
    const line = '─'.repeat(64);
    console.log(`\n${line}\n  表扬大会 · 颁奖公布系统 v${VERSION} 已启动（监听 ${CFG.host}:${CFG.port}）\n${line}`);
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
    audit('SERVER-START', `${CFG.host}:${CFG.port}`);
    if (CFG.openBrowser && process.platform === 'win32') {
      require('child_process').exec(`start "" "http://127.0.0.1:${CFG.port}/control"`, () => {});
    }
  });
  server.on('error', e => {
    console.error('启动失败：', e.code === 'EADDRINUSE' ? `端口 ${CFG.port} 已被占用（系统可能已经在运行，或改 config.json 的 port）` : e.message);
    quit(1);
  });
}
main();
