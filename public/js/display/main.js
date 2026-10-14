/*
 * 大屏 · 启动：连接服务端的实时推送（断线自动重连，画面保持不变）。
 * 需要：前面所有大屏脚本
 */
'use strict';

let booted = false;
// 给外壳（shell.js）用：画面停在可以无缝换新的状态多久了
let renewSince = 0, renewState = '';
// ⚠ 要用 function 宣告（会挂在 window 上，外壳才叫得到；const / let 不会）
function renewKey() { return renewState; }
function renewMinutes() { return FXC.renewMin; }
function renewOk() {
  return booted && /^(standby|title|black)/.test(renewState) && performance.now() - renewSince > 3000;
}
function renewMark(v) {
  const k = v.blackout ? 'black' : v.mode === 'title' ? 'title|' + v.award?.id : v.mode === 'standby' ? 'standby' : v.mode + '|' + (v.award?.id || '') + '|' + (v.winners?.length || 0);
  if (k !== renewState) { renewState = k; renewSince = performance.now(); }
}
function connect() {
  const es = new EventSource('/api/display/stream?k=' + encodeURIComponent(KEY) + (PREVIEW ? '&preview=1' : '') + (qs.get('name') ? '&name=' + encodeURIComponent(qs.get('name')) : ''));
  es.onopen = () => $('conn').classList.remove('show');
  es.onmessage = e => {
    const v = JSON.parse(e.data);
    if (RECORD) {   // 导出影片：只要第一份数据（活动名称、字体、效果），固定在待机画面，之后不再跟现场变
      fxSet(v.fx); render({ ...v, mode: 'standby', blackout: false }); booted = true; es.close(); return;
    }
    diagSet(v.diag);
    fxSet(v.fx);
    render(v);
    renewMark(v);
    booted = true;
  };
  es.onerror = () => { if (!$('conn').classList.contains('show')) diagDrop(); $('conn').classList.add('show'); }; // EventSource 会自动重连，画面保持不变
}
connect();
