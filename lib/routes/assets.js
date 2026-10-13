/* 静态资源：/assets/css/…、/assets/js/…、/assets/img/…（只有程序代码和样式，没有名单，不需要密钥） */
'use strict';
const { sendStatic, safeAsset, sendText } = require('../http');

module.exports = async function assets({ res, p, method }) {
  if (method !== 'GET' || !p.startsWith('/assets/')) return false;
  const rel = safeAsset(decodeURIComponent(p.slice('/assets/'.length)));
  if (!rel) sendText(res, 404, 'Not found'); else sendStatic(res, rel);
  return true;
};
