/* 学会对照表（data/societies.json）：编号 → 中文名、英文名。控制端「奖项编辑」贴上保存；大屏和图片导出都用它把名单的「学会」栏换成两行 */
'use strict';
const fs = require('fs');
const { SOC_PATH } = require('./env');
const { str, atomicWrite } = require('./util');

// 「中文English」→ ['中文', 'English']（没有英文就整串当中文）；英文可以数字开头（「二十四节令鼓队 24 Festive Drums」），但里面不能有中文
const ZH_EN = /^(.*[　-鿿＀-￯])\s*([A-Za-z0-9][\x20-\x7e‘-”]*)$/;
const zhEn = t => { const m = String(t || '').trim().match(ZH_EN); return m ? [m[1].trim(), m[2].trim()] : [String(t || '').trim(), '']; };
// 整理一行对照表：从 Excel 复制时没分栏（一整串「A01 学长团 Prefectorial Board」，或分栏分错）也能拆成 编号 / 中文 / 英文
function normEntry(x) {
  let code = str(x?.code, 400), zh = str(x?.zh, 120), en = str(x?.en, 160);
  if (/\s/.test(code)) {   // 编号里有空格 = 没分好栏：整行合起来，第一段是编号，其余拆中文、英文
    const m = [code, zh, en].filter(Boolean).join(' ').match(/^(\S+)\s+(.*)$/);
    code = m[1]; [zh, en] = zhEn(m[2]);
  } else if (!en && zh) [zh, en] = zhEn(zh);
  return { code: code.slice(0, 40), zh: zh.slice(0, 120), en: en.slice(0, 160) };
}

let cache = null, cacheKey = '';
function loadSoc() {   // 按文件大小 + 修改时间缓存，大屏每次推送都会查
  let key = '';
  try { const st = fs.statSync(SOC_PATH); key = st.size + '-' + st.mtimeMs; } catch { return []; }
  if (key !== cacheKey) {
    try { cache = (JSON.parse(fs.readFileSync(SOC_PATH, 'utf8')).list || []).map(normEntry).filter(x => x.code); } catch { cache = []; }
    cacheKey = key;
  }
  return cache;
}
function saveSoc(raw) {
  const list = (Array.isArray(raw) ? raw : []).slice(0, 2000).map(normEntry).filter(x => x.code);
  atomicWrite(SOC_PATH, JSON.stringify({ list }, null, 2));
  return list;
}
// 一位得奖者的学会 → [中文, 英文]。和控制端 js/control/import.js 的 socOf() 同一套规则（只是不拿备注顶上：大屏另外显示备注）：
// 有对照表时先按编号、再按中文名找（忽略空格和大小写）；名单写成「A01 学长团」也行（取第一段当编号、后面当中文名）。
// 都找不到 → 不显示；没有对照表时把「中文English」拆两行
const socKey = s => String(s || '').replace(/\s+/g, '').toLowerCase();
function socFind(list, v) {
  const t = String(v || '').trim(), k = socKey(t);
  if (!k) return null;
  const sp = t.match(/^(\S+)\s+(.+)$/), head = sp ? socKey(sp[1]) : '', tail = sp ? socKey(sp[2]) : '';
  return list.find(x => socKey(x.code) === k) || list.find(x => socKey(x.zh) === k)
    || (sp && (list.find(x => socKey(x.code) === head) || list.find(x => socKey(x.zh) === tail))) || null;
}
function socOf(w) {
  if (!socKey(w?.soc)) return [];
  const list = loadSoc();
  if (list.length) {
    const s = socFind(list, w.soc);
    return s ? [s.zh || '', s.en || ''] : [];
  }
  const m = String(w.soc).match(/^(.*[　-鿿＀-￯])\s*([A-Za-z].*)$/);
  return m ? [m[1].trim(), m[2].trim()] : [String(w.soc).trim()];
}

module.exports = { loadSoc, saveSoc, socOf };
