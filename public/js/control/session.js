/*
 * 控制端 · 登录 / 退出、启动、实时连接（收到新视图就重画）。
 * 提供：showLogin()、boot()、connect()
 */
"use strict";

function showLogin() {
  if (es) {
    es.close();
    es = null;
  }
  if (qrIdx >= 0) closeQr();
  $("app").classList.add("hidden");
  $("login").classList.remove("hidden");
  $("pw").value = "";
  $("pw").focus();
}
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("loginErr").textContent = "";
  try {
    await api("POST", "/api/login", { password: $("pw").value });
    boot();
  } catch (err) {
    $("loginErr").textContent = err.message;
  }
});
$("bLogout").onclick = async () => {
  if (dirty && !confirm("有未保存的修改，确定退出？")) return;
  try {
    await api("POST", "/api/logout");
  } catch {}
  showLogin();
};

async function boot() {
  try {
    V = await api("GET", "/api/control/state");
  } catch {
    return;
  }
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  setupPreview();
  fillObsHosts();
  loadDraft();
  socLoad();
  render();
  connect();
}
function connect() {
  if (es) es.close();
  es = new EventSource("/api/control/stream");
  es.onopen = () => {
    $("connDot").classList.add("ok");
    $("connTxt").textContent = "已连接";
  };
  es.onmessage = (e) => {
    const prevDisplays = V?.displays?.length;
    V = JSON.parse(e.data);
    if (!dirty) loadDraft();
    render();
    if (prevDisplays != null && prevDisplays !== V.displays.length)
      log(`输出页数量：${V.displays.length}`);
  };
  // 公开视图：转给页面里的预览框（LIVE 预览、效果预览、导出影片），它们不用自己开连线（输出页 main.js 的 pvFeed）
  es.addEventListener("public", (e) => {
    pvRaw = e.data;
    pvSend(e.data);
  });
  // 实体按钮的信号 / 延迟（小事件，不带整份视图）
  es.addEventListener("buttons", (e) => {
    if (!V) return;
    V.buttons = JSON.parse(e.data);
    renderButtons();
  });
  es.onerror = async () => {
    pvSend(null);
    $("connDot").classList.remove("ok");
    $("connTxt").textContent = "重连中…";
    try {
      await api("GET", "/api/control/state");
    } catch {}
  };
}
