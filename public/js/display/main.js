/*
 * 大屏 · 启动：连接服务端的实时推送（断线自动重连，画面保持不变）。
 * 需要：前面所有大屏脚本
 */
'use strict';

let booted = false;
// 给外壳（shell.js）用：画面是否已经「停好」（动画、闪光、照片都画完），可以无缝换新
// ⚠ 要用 function 宣告（会挂在 window 上，外壳才叫得到；const / let 不会）
let renewState = '', renewSince = 0, renewSettle = 0, renewReveals = 0;
function renewMark(raw, v) {
  if (raw === renewState) return;
  const first = !renewState;
  renewState = raw; renewSince = performance.now();
  // 停好要多久：第一份数据不放动画，很快；之后要等进场 / 揭晓动画和闪光放完；先一后全全部出现时再加上逐张出现的时间
  const view = v.award?.view, cascade = view?.mode === 'all' ? (view.to - view.from) * (v.award.cascade || 600) : 0;
  renewSettle = first ? 800 : 2200 + cascade;
  if (!first && v.mode === 'reveal') renewReveals++;
}
const renewPhotosDone = () => [...document.querySelectorAll('canvas.ph')].every(c => c.classList.contains('ok') || c.parentElement.classList.contains('nopic'))
  && [...document.querySelectorAll('img.logo')].every(im => im.complete);
function renewOk() { return booted && performance.now() - renewSince > renewSettle && document.fonts.status === 'loaded' && renewPhotosDone(); }
function renewKey() { return renewState; }
function renewCount() { return renewReveals; }
function renewMinutes() { return FXC.renewMin; }
function renewEvery() { return FXC.renewReveals; }

function onData(raw) {
  const v = JSON.parse(raw);
  $('conn').classList.remove('show');
  if (RECORD) {   // 导出影片：只要第一份数据（活动名称、字体、效果），固定在待机画面，之后不再跟现场变
    if (booted) return;
    fxSet(v.fx); render({ ...v, mode: 'standby', blackout: false }); booted = true; return;
  }
  diagSet(v.diag);
  fxSet(v.fx);
  logoSet(v.logo);
  exStyleSet(v.exStyle);
  render(v);
  renewMark(raw, v);
  booted = true;
}
function onDrop() { if (!$('conn').classList.contains('show')) diagDrop(); $('conn').classList.add('show'); }   // 画面保持不变

// 控制端里的预览框：用控制端那条连线转过来的公开视图（core.js 的 pvLatest / pvSend），不自己开连线
// （浏览器对同一个网址最多 6 条连线，满了新的预览框就排队，只看到普通背景）。
// 3 秒内没收到（旧版服务端 / 旧版控制端 / 单独打开的预览网址）就照旧自己连。
// ⚠ 要用 function 宣告（挂在 window 上，控制端才叫得到）
let pvFed = false;
function pvFeed(raw) {
  if (!(PREVIEW || RECORD) || pvFed === null) return;   // null = 已经改成自己连了
  if (raw == null) { if (pvFed) onDrop(); return; }
  pvFed = true; onData(raw);
}
function parentFeed() { try { return parent !== window && typeof parent.pvLatest === 'function' ? parent.pvLatest : null; } catch { return null; } }

function connect() {
  const latest = (PREVIEW || RECORD) && parentFeed();   // RECORD：导出影片的隐藏页面也在控制端里
  if (latest) {
    const raw = latest(); if (raw) pvFeed(raw);
    setTimeout(() => { if (!pvFed) { pvFed = null; connectSse(); } }, 3000);
    return;
  }
  connectSse();
}
function connectSse() {
  const es = new EventSource('/api/display/stream?k=' + encodeURIComponent(KEY) + (PREVIEW ? '&preview=1' : '') + (qs.get('name') ? '&name=' + encodeURIComponent(qs.get('name')) : ''));
  es.onopen = () => $('conn').classList.remove('show');
  es.onmessage = e => { onData(e.data); if (RECORD) es.close(); };
  es.onerror = onDrop;   // EventSource 会自动重连
}
connect();
