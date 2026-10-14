/*
 * 控制端 · 嘉宾揭晓：二维码弹窗、授权 / 收回、更换嘉宾链接。
 * 提供：qrIdx、openQr(i)、showQr()、closeQr()、toggleGuest()
 */
"use strict";

let qrIdx = -1; // 嘉宾二维码弹窗显示的是第几个链接，-1 = 未打开
function showQr() {
  const u = V?.urls?.[qrIdx]?.guest;
  if (!u) return closeQr();
  if ($("qrUrl").textContent === u) return;
  $("qrUrl").textContent = u;
  $("qrBox").replaceChildren(QR.svg(u));
}
function openQr(i) {
  qrIdx = i;
  $("qrUrl").textContent = "";
  showQr();
  $("qrModal").classList.remove("hidden");
  $("qrClose").focus();
}
function closeQr() {
  qrIdx = -1;
  $("qrModal").classList.add("hidden");
}
$("qrModal").onclick = (e) => {
  if (e.target === $("qrModal")) closeQr();
};
$("qrClose").onclick = closeQr;
$("qrCopy").onclick = () => copy($("qrUrl").textContent);
function toggleGuest() {
  act(V?.guest?.armed ? "guestDisarm" : "guestArm");
}
$("bGuest").onclick = toggleGuest;
$("bRotate").onclick = () => {
  if (confirm("更换后旧的嘉宾链接立即失效，嘉宾需要用新链接重新打开。继续？"))
    act("rotateGuestKey");
};
