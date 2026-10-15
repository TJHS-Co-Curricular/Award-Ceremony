/*
 * 控制端 · 基础：共用状态和小工具（其它控制端脚本都要先载入它）。
 * 提供：$、CLIENT_VERSION、V（最新控制端视图）、sel（选中的奖项）、draft（编辑草稿）、dirty、es（实时连接）、
 *       toast、api、el、MODE_NAME、splitZhEn、infoLine、store、log、mb、loadImg、clone、copy
 * ⚠ CLIENT_VERSION 要和 lib/env.js 的 VERSION 一起改。
 */
'use strict';

const $ = id => document.getElementById(id);
const CLIENT_VERSION = '1.26';
let V = null;          // 最新控制端视图
let sel = null;        // 选中的奖项 id
let draft = null;      // 编辑草稿
let dirty = false;
let es = null;          // 实时连接（EventSource）

/* ---------- 小工具 ---------- */
function toast(t, err) {
  const el = $('toast'); el.textContent = t; el.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.className = '', 2200);
}
async function api(method, url, body) {
  const r = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-AC': '1' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login') { showLogin(); throw new Error('登录已失效'); }
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : String(k));
  return e;
}
const MODE_NAME = { one: '逐一揭晓', firstall: '先一后全（逐一单独显示，最后全部出现）', all: '一次全部揭晓', nominee: '入围揭晓（1 位得主）' };
// 「中文English」→ ['中文', 'English']；英文部分太短（如「最佳 MVP」）就不拆
function splitZhEn(t) {
  const m = String(t || '').match(/^(.*[\u3000-\u9fff\uff00-\uffef])\s*([A-Za-z][\x20-\x7e\u2018-\u201d]*)$/);
  if (!m) return null;
  const en = m[2].trim().replace(/\s+/g, ' ');
  return en.length >= 6 && (/\s/.test(en) || en.length >= 8) ? [m[1].trim(), en] : null;
}
const infoLine = w => [w.cls, w.sid, w.detail].filter(Boolean).join(' · ');
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
function log(t) {
  const d = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const box = $('log'); box.prepend(el('div', {}, `${d}  ${t}`));
  while (box.children.length > 80) box.lastChild.remove();
}

const mb = n => (n / 1048576).toFixed(1) + ' MB';
function loadImg(src) { return new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => bad(new Error('图片读取失败')); im.src = src; }); }
const clone = o => JSON.parse(JSON.stringify(o));
async function copy(t) {
  try { await navigator.clipboard.writeText(t); return toast('已复制'); } catch {}
  // 内网 http 不是安全上下文，clipboard API 不可用时退回旧方法
  const ta = el('textarea', { style: 'position:fixed;opacity:0' }); ta.value = t; document.body.append(ta); ta.select();
  try { document.execCommand('copy'); toast('已复制'); } catch { toast('复制失败，请手动选择', true); }
  ta.remove();
}
