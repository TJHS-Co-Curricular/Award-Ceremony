/* 网络：IP 白名单判断、本机内网地址 */
'use strict';
const os = require('os');
const rt = require('./runtime');

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

// 本机的内网地址 + 控制端 / 输出页 / 嘉宾页网址
function lanUrls() {
  const CFG = rt.cfg, ips = [];
  if (CFG.host && CFG.host !== '0.0.0.0') ips.push(CFG.host);
  else for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  if (!ips.length) ips.push('127.0.0.1');
  return ips.map(ip => ({ ip, control: `http://${ip}:${CFG.port}/control`, display: `http://${ip}:${CFG.port}/display?k=${CFG.displayKey}`, guest: `http://${ip}:${CFG.port}/guest?k=${CFG.guestKey}` }));
}

module.exports = { normIp, inCidr, inAny, lanUrls };
