/* 设置：config.json（第一次运行自动生成密码和密钥） */
'use strict';
const fs = require('fs');
const { CONFIG_PATH } = require('./env');
const { hex, str, genPassword, atomicWrite } = require('./util');
const rt = require('./runtime');

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
const saveConfig = () => atomicWrite(CONFIG_PATH, JSON.stringify(rt.cfg, null, 2));

// 屏幕设置（检查过的）；没设时用 fallback
function screens(fallback = []) {
  const list = Array.isArray(rt.cfg.screens) && rt.cfg.screens.length ? rt.cfg.screens : fallback;
  return list.map(x => ({ name: str(x?.name, 30) || '屏幕', width: Number(x?.width) || 1920, height: Number(x?.height) || 1080 }));
}

module.exports = { loadConfig, saveConfig, screens };
