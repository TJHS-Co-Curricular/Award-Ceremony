/*
 * 大屏 · 入围揭晓：介绍入围者 → 悬念「得主是……」→ 得主卡移到中央放大（其他人变暗）。
 * 提供：applyPhase(view, animate, celebrate, wait)
 * 需要：cards.js（div）、fx/flash.js（burst）、stage.js（$、lastV）
 */
"use strict";

function applyPhase(v, animate, celebrate, wait = 0) {
  const sc = $("s-reveal"),
    grid = $("grid"),
    nom = !!v.award.nominee,
    ph = nom ? v.award.phase || "" : "";
  if (!animate) {
    grid.classList.add("noanim");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => grid.classList.remove("noanim")),
    );
  }
  sc.classList.toggle("suspense", ph === "suspense");
  $("rTag").textContent = nom && ph !== "winner" ? "入 围 名 单" : "";
  const cards = [...grid.children];
  for (const c of cards)
    if (
      c.classList.contains("win") &&
      (ph !== "winner" || cards.indexOf(c) !== v.award.winnerIndex)
    )
      c.classList.remove("win");
  if (ph !== "winner") {
    sc.classList.remove("crowned");
    return;
  }
  // 卡片还在逐张弹出（例如直接「全部揭晓」）时，等它们出完再放大得主，免得被 fillCard 覆盖
  if (wait)
    return setTimeout(() => {
      if (lastV?.award?.id === v.award.id && lastV.award.phase === "winner")
        crown(v, cards, celebrate);
    }, wait);
  crown(v, cards, celebrate);
}
function crown(v, cards, celebrate) {
  const grid = $("grid");
  $("s-reveal").classList.add("crowned");
  const c = cards[v.award.winnerIndex];
  if (!c) return;
  c.classList.remove("pop"); // pop 动画会锁住 transform，先拿掉
  if (!c.querySelector(".badge")) {
    const b = div("badge", "🏆 得 主");
    c.appendChild(b);
  }
  // 把得主卡移到网格中央并放大（offsetLeft 等不受 transform 影响，和舞台缩放无关）
  const gw = grid.clientWidth,
    gh = grid.clientHeight,
    cw = c.offsetWidth,
    chh = c.offsetHeight;
  const ws = Math.max(1.08, Math.min(1.9, (gw * 0.9) / cw, (gh * 0.94) / chh));
  c.style.setProperty(
    "--wx",
    grid.offsetLeft + gw / 2 - (c.offsetLeft + cw / 2) + "px",
  );
  c.style.setProperty(
    "--wy",
    grid.offsetTop + gh / 2 - (c.offsetTop + chh / 2) + "px",
  );
  c.style.setProperty("--ws", ws.toFixed(3));
  c.style.setProperty("--badge", Math.max(14, Math.round(cw * 0.045)) + "px");
  c.classList.add("win");
  if (celebrate) setTimeout(() => burst(320), 650);
}
