/*
 * 运行环境：版本号、文件路径、是否打包成 exe。
 * ⚠ 版本号要和 public/js/control/core.js 的 CLIENT_VERSION、CHANGELOG.md 最新的 ## [x.y] 一起改。
 */
'use strict';
const path = require('path');

const VERSION = '1.29';

// 打包成 .exe（Node 单文件程序）时，数据放在 exe 旁边，网页从 exe 内部读取
let sea = null;
try { sea = require('node:sea'); } catch { /* 普通 node 运行 */ }
const IS_EXE = !!(sea && sea.isSea && sea.isSea());
const ROOT = IS_EXE ? path.dirname(process.execPath) : path.resolve(__dirname, '..');
const CLI = IS_EXE ? path.basename(process.execPath) : 'node server.js';
const DATA_DIR = path.join(ROOT, 'data');
const PHOTO_DIR = path.join(DATA_DIR, 'photos');

module.exports = {
  VERSION, sea, IS_EXE, ROOT, CLI,
  CONFIG_PATH: path.join(ROOT, 'config.json'),
  DATA_DIR,
  PLAIN: path.join(DATA_DIR, 'awards.json'),            // 名单（明文）
  ENC: path.join(DATA_DIR, 'awards.enc'),               // 名单（加密）
  STATE_PATH: path.join(DATA_DIR, 'state.json'),        // 现场进度（不含名字）
  EXSTYLE_PATH: path.join(DATA_DIR, 'export-style.json'), // 图片导出的设计（字号、颜色、粗体等），不含名单
  PHOTO_DIR,
  CACHE_DIR: path.join(PHOTO_DIR, '_cache'),            // 控制端压缩后的照片（JPEG），存在就优先发给大屏
  FONT_DIR: path.join(DATA_DIR, 'fonts'),               // 上传的自定义字体（大屏和图片导出用）
  PUBLIC_DIR: path.join(ROOT, 'public'),
  LOG_DIR: path.join(ROOT, 'logs'),
  GALLERY_MAX: 20     // 「先一后全」最后全部出现时，每个屏幕最多几张；更多就分页（每按一次下一页）
};
