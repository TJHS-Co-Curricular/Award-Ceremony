/*
 * 控制端 · 现场控制的画面：顶栏状态、奖项列表、当前名单、嘉宾状态、输出页地址、预览窗口、OBS 下载。
 * 提供：render()、renderButtons()、setupPreview()、fillObsHosts()
 */
"use strict";

// 实体按钮（ESP32）：信号强度、延迟。服务端每 2 秒推一次 "buttons" 事件（session.js），只重画这一块
const rssiLv = (r) =>
  r == null ? ["", "—"] : r >= -60 ? ["ok", "好"] : r >= -70 ? ["mid", "一般"] : r >= -80 ? ["low", "弱"] : ["bad", "很弱，靠近路由器"];
const rttLv = (ms) =>
  ms == null ? "" : ms <= 60 ? "ok" : ms <= 200 ? "mid" : ms <= 500 ? "low" : "bad";
function upTxt(sec) {
  if (sec == null) return "";
  if (sec < 60) return `${sec} 秒`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟`;
  return `${Math.floor(sec / 3600)} 小时 ${Math.floor((sec % 3600) / 60)} 分`;
}
function renderButtons() {
  const box = $("bList");
  box.textContent = "";
  for (const b of V?.buttons || []) {
    const [rc, rt] = rssiLv(b.rssi);
    box.append(
      el(
        "div",
        { class: "btnrow" + (b.online ? "" : " off") },
        el("div", {}, el("b", {}, `🔘 ${b.id}`), el("span", { class: "muted" }, ` ${b.ip}`)),
        b.online
          ? el(
              "div",
              {},
              "信号 ",
              el("span", { class: "lv " + rc }, b.rssi == null ? "—" : `${b.rssi} dBm（${rt}）`),
              " · 延迟 ",
              el("span", { class: "lv " + rttLv(b.rttAvg) }, b.rtt == null ? "—" : `${b.rtt} ms`),
              b.rttAvg == null ? "" : el("span", { class: "muted" }, `（平均 ${b.rttAvg}，最高 ${b.rttMax}）`),
            )
          : el("div", { class: "lv bad" }, `⚠ 离线：${upTxt(b.ago)}前最后联系（灯不会亮，按了也没用）`),
        b.online
          ? el(
              "div",
              { class: "muted" },
              `开机 ${upTxt(b.up)}` + (b.miss ? ` · 开机以来问服务端失败 ${b.miss} 次` : ""),
            )
          : null,
        b.online && b.revFail
          ? el("div", { class: "lv bad" }, `⚠ 开机以来按了没揭晓成功 ${b.revFail} 次（最后一次：${b.revWhy}）`)
          : null,
      ),
    );
  }
}

function render() {
  if (!V) return;
  // 版本检查：服务端是旧版时提示重启，并补上缺省字段避免页面出错
  const old = V.version !== CLIENT_VERSION;
  $("verWarn").classList.toggle("hidden", !old);
  if (old)
    $("verWarn").textContent =
      `⚠ 服务端版本（${V.version || "1.0"}）与控制端（${CLIENT_VERSION}）不一致：请关闭 server.js 窗口，重新运行 start.bat，然后刷新本页。自动播放和嘉宾揭晓在重启前无法使用。`;
  V.auto ||= { on: false, remainingMs: 0 };
  V.guest ||= { armed: false };
  V.guests ||= [];
  V.buttons ||= [];
  for (const u of V.urls || []) u.guest ||= "（需重启服务端）";
  const s = V.state;
  $("hSub").textContent = V.event.title;
  $("nextTxt").textContent = V.next;
  $("bUndo").disabled = !V.canUndo;
  $("bBlack").classList.toggle("on", s.blackout);
  $("bBlack").firstChild.textContent = s.blackout ? "取消黑屏" : "黑屏";
  $("dispCount").textContent = `输出页 ${V.displays.length}`;
  $("dispCount").className = "tag" + (V.displays.length ? " done" : " live");
  $("encTag").textContent = V.encrypted ? "🔒 名单已加密" : "⚠ 名单为明文";
  $("encTag").className = "tag" + (V.encrypted ? " done" : "");
  $("dispList").textContent = V.displays.length
    ? V.displays.join("、")
    : "无（投影电脑尚未打开输出页）";
  $("progress").textContent = `${s.doneIds.length}/${V.awards.length}`;

  // 自动播放
  const au = V.auto;
  $("bAuto").classList.toggle("on", au.on);
  $("bAuto").firstChild.textContent = au.on
    ? "⏸ 暂停自动播放"
    : "▶ 开始自动播放";
  for (const id of ["autoInt", "autoHold", "autoScope"]) $(id).disabled = au.on;
  $("autoState").className = "tag" + (au.on ? " auto" : "");
  if (au.on && au.remainingMs) {
    autoTotal = au.remainingMs;
    autoDeadline = Date.now() + au.remainingMs;
  } else {
    autoDeadline = 0;
    $("autoBar").style.width = "0";
    $("autoState").textContent = au.on ? "播放中" : "已停止";
  }

  // 嘉宾
  const g = V.guest,
    gAward = g.armed && V.awards.find((a) => a.id === g.awardId);
  const onAward =
    (s.mode === "title" || s.mode === "reveal") &&
    V.awards.find((a) => a.id === s.awardId);
  $("bGuest").classList.toggle("on", g.armed);
  $("bGuest").firstChild.textContent = g.armed
    ? "收回嘉宾授权"
    : "🎤 交给嘉宾揭晓当前奖项";
  // 能不能交给嘉宾：当前奖项还没揭晓完（和服务端 show.js 的 isComplete() 同一条规则）。
  // 入围揭晓：入围者都出现后，还有「揭晓得主」那一步；先一后全：名字都出现后，还有「全部出现」的合集
  const n = onAward ? onAward.winners.length : 0,
    nomAward = onAward && onAward.revealMode === "nominee" && onAward.winners.some((w) => w.win),
    faAward = onAward && onAward.revealMode === "firstall",
    faPages = faAward ? Math.ceil(n / (onAward.chunk >= 2 ? onAward.chunk : 20)) : 0;   // 20 = 服务端 GALLERY_MAX
  const awardDone =
    s.mode === "reveal" &&
    (nomAward
      ? s.phase === "winner"
      : faAward
        ? s.phase === "all" && (s.page || 0) >= faPages - 1
        : s.revealed >= n);
  $("bGuest").disabled = !g.armed && !(onAward && !awardDone);
  $("gState").textContent = g.armed
    ? `🎤 已授权：嘉宾可揭晓「${gAward?.title || ""}」（${s.mode === "reveal" ? s.revealed : 0}/${gAward?.winners.length || 0}），揭晓完自动收回`
    : V.guests.length || V.buttons.some((b) => b.online)
      ? "未授权：嘉宾手机显示「等待授权」，实体按钮的灯不亮"
      : "嘉宾手机尚未打开嘉宾页，实体按钮也没有连上";
  $("gList").textContent = V.guests.length
    ? `嘉宾手机：${V.guests.join("、")}`
    : "嘉宾手机：未连接";
  renderButtons();
  const gu = $("gUrls");
  gu.textContent = "";
  V.urls.forEach((u, i) =>
    gu.append(
      el(
        "div",
        { class: "urlbox" },
        el(
          "div",
          { class: "row" },
          el("span", {}, u.guest),
          el("button", { class: "qrbtn", onclick: () => openQr(i) }, "二维码"),
          el(
            "button",
            { class: "qrbtn", onclick: () => copy(u.guest) },
            "复制",
          ),
        ),
      ),
    ),
  );
  if (qrIdx >= 0) showQr(); // 弹窗开着时同步刷新（例如刚更换了嘉宾链接）

  // 奖项列表
  const list = $("alist");
  list.textContent = "";
  V.awards.forEach((a, i) => {
    if (a.section && (i === 0 || V.awards[i - 1].section !== a.section)) {
      // 大类标题行（分类上面一层）
      let e = i;
      while (e + 1 < V.awards.length && V.awards[e + 1].section === a.section) e++;
      const run = V.awards.slice(i, e + 1),
        sLive = s.mode === "section" && run.some((x) => x.id === s.awardId),
        sPho = s.mode === "photo" && s.photoOf === "section" && run.some((x) => x.id === s.awardId);
      const first = run.find((x) => !s.doneIds.includes(x.id)) || a;
      // 合影：现在的奖项在这个大类里就用它（按「下一步」接着走），否则用第一个还没公布的
      const phoId = (run.some((x) => x.id === s.awardId) ? s.awardId : first.id);
      list.append(
        el(
          "div",
          { class: "ghead shead" + (sLive || sPho ? " live" : "") },
          // 中文名占第一行（完整显示）；英文名和进度、按钮挤第二行，英文太长就截断，鼠标移上去看全文（用户定 2026-11-22）
          el("span", { class: "gt" }, a.section),
          run.find((x) => x.sectionSub)
            ? el("span", { class: "gs", title: run.find((x) => x.sectionSub).sectionSub }, run.find((x) => x.sectionSub).sectionSub)
            : null,
          sLive || sPho
            ? el("span", { class: "tag live" }, sPho ? "合影中" : "大类画面中")
            : el(
                "span",
                { class: "tag" },
                `${run.filter((x) => s.doneIds.includes(x.id)).length}/${run.length}`,
              ),
          el(
            "button",
            {
              onclick: () => act("section", { awardId: first.id }),
              title: "在大屏显示这个大类的画面（列出里面的分类）",
            },
            "大类画面",
          ),
          el(
            "button",
            {
              onclick: () => act("photo", { awardId: phoId, of: "section" }),
              title: "大屏显示这个大类的名称，给整个大类的大合照用",
            },
            "合影画面",
          ),
        ),
      );
    }
    if (a.group && (i === 0 || V.awards[i - 1].group !== a.group || V.awards[i - 1].section !== a.section)) {
      // 分类标题行
      let e = i;
      while (e + 1 < V.awards.length && V.awards[e + 1].group === a.group) e++;
      const run = V.awards.slice(i, e + 1),
        gLive = s.mode === "group" && run.some((x) => x.id === s.awardId),
        gPho = s.mode === "photo" && s.photoOf === "group" && run.some((x) => x.id === s.awardId);
      const first = run.find((x) => !s.doneIds.includes(x.id)) || a;
      const phoId = (run.some((x) => x.id === s.awardId) ? s.awardId : first.id);
      list.append(
        el(
          "div",
          { class: "ghead" + (gLive || gPho ? " live" : "") },
          // 中文名占第一行（完整显示）；英文名和进度、按钮挤第二行，英文太长就截断，鼠标移上去看全文（用户定 2026-11-22）
          el("span", { class: "gt" }, a.group),
          run.find((x) => x.groupSub)
            ? el("span", { class: "gs", title: run.find((x) => x.groupSub).groupSub }, run.find((x) => x.groupSub).groupSub)
            : null,
          gLive || gPho
            ? el("span", { class: "tag live" }, gPho ? "合影中" : "分类标题中")
            : el(
                "span",
                { class: "tag" },
                `${run.filter((x) => s.doneIds.includes(x.id)).length}/${run.length}`,
              ),
          el(
            "button",
            {
              onclick: () => act("group", { awardId: first.id }),
              title: "在大屏显示这个分类的标题画面",
            },
            "分类标题",
          ),
          el(
            "button",
            {
              onclick: () => act("photo", { awardId: phoId, of: "group" }),
              title: "大屏显示这个分类的名称，给整个分类的大合照用",
            },
            "合影画面",
          ),
        ),
      );
    }
    const live =
      (s.mode === "title" || s.mode === "reveal" || (s.mode === "photo" && !s.photoOf)) &&
      s.awardId === a.id;
    const done = s.doneIds.includes(a.id);
    const meta = `${a.winners.length} 位 · ${a.revealMode === "nominee" ? "入围揭晓" : a.revealMode === "firstall" ? "先一后全" + (a.chunk ? `（每 ${a.chunk} 位一组）` : "") : MODE_NAME[a.revealMode] || "逐一揭晓"}`;
    const item = el(
      "div",
      {
        class:
          "aitem" +
          (a.group ? " ing" : "") +
          (sel === a.id ? " sel" : "") +
          (live ? " live" : ""),
        onclick: () => {
          sel = a.id;
          render();
        },
      },
      el(
        "div",
        { class: "t" },
        // 一行：奖项名（完整显示，太长换行）+ 人数 · 揭晓方式（小字，用户定 2026-11-22）
        el("span", {}, `${i + 1}. ${a.title}`, el("small", { class: "mi" }, meta)),
        live && V.guest.armed
          ? el("span", { class: "tag guest" }, "🎤 嘉宾")
          : null,
        live && V.auto.on ? el("span", { class: "tag auto" }, "自动") : null,
        live
          ? el(
              "span",
              { class: "tag live" },
              s.mode === "title"
                ? "标题中"
                : s.mode === "photo"
                  ? "合影中"
                  : `揭晓 ${s.revealed}/${a.winners.length}`,
            )
          : done
            ? el("span", { class: "tag done" }, "已公布")
            : el("span", { class: "tag" }, "待公布"),
      ),
    );
    if (sel === a.id) {
      item.append(
        el(
          "div",
          { class: "acts" },
          el(
            "button",
            {
              onclick: (ev) => {
                ev.stopPropagation();
                act("title", { awardId: a.id });
              },
            },
            "公布此奖项",
          ),
          el(
            "button",
            {
              onclick: (ev) => {
                ev.stopPropagation();
                act("revealAll", { awardId: a.id });
              },
            },
            "直接全部揭晓",
          ),
          el(
            "button",
            {
              onclick: (ev) => {
                ev.stopPropagation();
                act("photo", { awardId: a.id });
              },
              title: "大屏显示「分类 - 奖项名称」，给大合照用",
            },
            "合影画面",
          ),
          done
            ? el(
                "button",
                {
                  onclick: (ev) => {
                    ev.stopPropagation();
                    act("markPending", { awardId: a.id });
                  },
                },
                "标为未公布",
              )
            : null,
        ),
      );
    }
    list.append(item);
  });

  // 当前名单（选中优先，否则正在进行的）
  const showId = s.mode === "title" || s.mode === "reveal" ? s.awardId : sel;
  const cur =
    V.awards.find((a) => a.id === (sel || showId)) ||
    V.awards.find((a) => a.id === showId);
  const wl = $("wlist");
  // 名单很长时只在框内滚动（不用拉整页）；重画时保留滚动位置，揭晓进度变了就把最新一位滚进框里
  const wlTop = wl.scrollTop;
  const wlKey = cur ? cur.id + ":" + (s.awardId === cur.id ? s.revealed : -1) : "";
  wl.textContent = "";
  $("curName").textContent = cur
    ? "· " + cur.title + "（" + cur.winners.length + "）"
    : "";
  if (!cur) wl.append(el("li", { class: "muted" }, "点选左侧奖项查看名单"));
  else
    cur.winners.forEach((w, i) => {
      const shown =
        s.mode === "reveal" && s.awardId === cur.id && i < s.revealed;
      wl.append(
        el(
          "li",
          { class: shown ? "on" : "" },
          el("span", { class: "idx" }, i + 1),
          el(
            "span",
            { class: "n" + (shown ? "" : " secret") },
            (w.win && cur.revealMode === "nominee" ? "🏆 " : "") +
              (w.type === "team" ? "👥 " : "") +
              w.name,
            infoLine(w) ? el("div", { class: "d" }, infoLine(w)) : null,
            w.photo ? el("div", { class: "d" }, "📷 " + w.photo) : null,
          ),
          shown ? el("span", { class: "tag done" }, "已显示") : null,
        ),
      );
    });
  wl.scrollTop = wlTop;
  if (wlKey !== wl.dataset.key) {
    if (wl.dataset.key?.split(":")[0] !== cur?.id) wl.scrollTop = 0;
    const last = wl.querySelectorAll("li.on");
    const it = last[last.length - 1];
    if (it) wl.scrollTop = Math.max(0, it.offsetTop - wl.clientHeight / 2 + it.offsetHeight / 2);
    wl.dataset.key = wlKey;
  }
  $("bRevealAll").disabled = !(s.mode === "title" || s.mode === "reveal");
  $("bPhoto").disabled = !(sel || s.awardId);
  $("bDiag").textContent = V.diag
    ? "📊 输出页显示帧数：开"
    : "📊 输出页显示帧数：关";
  $("bDiag").classList.toggle("on", !!V.diag);
  $("bPhoto").classList.toggle("on", s.mode === "photo");

  // 地址
  const ub = $("urls");
  ub.textContent = "";
  const scr = V.screens?.length
    ? V.screens
    : [{ name: "输出页", width: 1920, height: 1080 }];
  for (const sc of scr) {
    const box = el(
      "div",
      { class: "urlbox" },
      el(
        "div",
        { class: "row" },
        el(
          "b",
          { style: "flex:1;color:var(--ink)" },
          `${sc.name} · ${sc.width}×${sc.height}`,
        ),
        el("button", { onclick: () => openScreen(sc) }, "在本机打开窗口"),
      ),
    );
    for (const u of V.urls)
      box.append(
        el(
          "div",
          { class: "row" },
          el("span", {}, screenUrl(u, sc)),
          el("button", { onclick: () => copy(screenUrl(u, sc)) }, "复制"),
        ),
      );
    ub.append(box);
  }
}
/* 预览：选择按哪个屏幕的比例显示 */
function setupPreview() {
  const sel = $("pvSel");
  sel.textContent = "";
  sel.append(el("option", { value: "" }, "16:9"));
  for (const sc of V.screens || [])
    sel.append(
      el(
        "option",
        { value: `${sc.width}x${sc.height}` },
        `${sc.name} ${sc.width}×${sc.height}`,
      ),
    );
  const saved = store.get("ac_pv");
  sel.value = [...sel.options].some((o) => o.value === saved)
    ? saved
    : V.screens?.[0]
      ? `${V.screens[0].width}x${V.screens[0].height}`
      : "";
  sel.onchange = () => {
    store.set("ac_pv", sel.value);
    applyPreview();
  };
  applyPreview();
}
function applyPreview() {
  const r = $("pvSel").value;
  const [w, h] = r ? r.split("x").map(Number) : [16, 9];
  $("pvBox").style.aspectRatio = `${w} / ${h}`;
  $("pv").src =
    "/display?k=" +
    encodeURIComponent(V.displayKey) +
    "&preview=1" +
    (r ? "&res=" + r : "");
}
function screenUrl(u, sc) {
  return `${u.display}&res=${sc.width}x${sc.height}&name=${encodeURIComponent(sc.name)}`;
}
function openScreen(sc) {
  const url = `/display?k=${encodeURIComponent(V.displayKey)}&res=${sc.width}x${sc.height}&name=${encodeURIComponent(sc.name)}`;
  const w = window.open(
    url,
    "award_" + sc.name,
    `popup,width=${Math.min(sc.width, screen.availWidth)},height=${Math.min(sc.height, screen.availHeight)},left=40,top=40`,
  );
  if (!w) toast("浏览器拦截了弹出窗口，请允许本站弹窗", true);
}
function fillObsHosts() {
  const sel = $("obsHost");
  if (sel.options.length) return;
  sel.append(el("option", { value: "127.0.0.1" }, "和服务端同一台电脑"));
  for (const u of V.urls || [])
    sel.append(el("option", { value: u.ip }, `其他电脑（经 ${u.ip}）`));
}
$("bObs").onclick = () => {
  const a = el("a", {
    href: `/api/control/obs?host=${encodeURIComponent($("obsHost").value)}&fps=${$("obsFps").value}`,
    download: "表扬大会-OBS场景.json",
  });
  document.body.append(a);
  a.click();
  a.remove();
};
