/*
 * 控制端 · 照片优化：在浏览器里把大照片缩成长边 2560 的 JPEG，上传到 data/photos/_cache/（原图不动）。
 * 提供：refreshPhotos()
 */
"use strict";

const OPT_EDGE = 2560,
  OPT_Q = 0.88,
  OPT_MIN = 1.5 * 1048576; // 小于 1.5 MB 且不超过 2560 像素的照片不用压缩
let photos = [],
  optBusy = false;
async function refreshPhotos() {
  try {
    photos = (await api("GET", "/api/control/photos")).photos;
  } catch {
    return;
  }
  const miss = photos.filter((x) => x.missing),
    todo = photos.filter((x) => !x.missing && !x.optimized && x.size > OPT_MIN);
  const total = photos.reduce((t, x) => t + (x.sendSize || 0), 0);
  $("optInfo").textContent = !photos.length
    ? "名单里没有照片"
    : `${photos.length} 张，大屏共需下载 ${mb(total)}` +
      (todo.length ? `，${todo.length} 张建议压缩` : "，已是最佳") +
      (miss.length
        ? `，⚠ 缺少 ${miss.length} 张：${miss
            .map((x) => x.name)
            .slice(0, 5)
            .join("、")}`
        : "");
  $("optInfo").style.color = miss.length
    ? "#ff9c9c"
    : todo.length
      ? "var(--warn)"
      : "";
  $("bOpt").disabled = optBusy || !todo.length;
}
async function optimizeOne(name) {
  const im = await loadImg(
    "/api/control/photo?name=" + encodeURIComponent(name),
  );
  const k = Math.min(1, OPT_EDGE / Math.max(im.naturalWidth, im.naturalHeight));
  const cv = document.createElement("canvas");
  cv.width = Math.round(im.naturalWidth * k);
  cv.height = Math.round(im.naturalHeight * k);
  const g = cv.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, cv.width, cv.height); // PNG 透明处填黑
  g.imageSmoothingQuality = "high";
  g.drawImage(im, 0, 0, cv.width, cv.height);
  const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", OPT_Q));
  const r = await fetch(
    "/api/control/photo-opt?name=" + encodeURIComponent(name),
    {
      method: "POST",
      headers: { "X-AC": "1", "Content-Type": "image/jpeg" },
      body: blob,
      credentials: "same-origin",
    },
  );
  if (!r.ok)
    throw new Error(
      (await r.json().catch(() => ({}))).error || "HTTP " + r.status,
    );
}
$("bOpt").onclick = async () => {
  const todo = photos.filter(
    (x) => !x.missing && !x.optimized && x.size > OPT_MIN,
  );
  if (!todo.length) return;
  optBusy = true;
  $("bOpt").disabled = true;
  let done = 0,
    fail = 0,
    before = 0;
  for (const x of todo) {
    $("bOpt").textContent = `压缩中 ${done + 1}/${todo.length}…`;
    try {
      await optimizeOne(x.name);
      before += x.size;
    } catch (e) {
      fail++;
      log(`压缩失败：${x.name}（${e.message}）`);
    }
    done++;
    $("optBar").style.width = (done / todo.length) * 100 + "%";
  }
  optBusy = false;
  $("bOpt").textContent = "压缩照片";
  await refreshPhotos();
  toast(
    fail ? `完成，${fail} 张失败（见操作记录）` : `已压缩 ${done} 张照片`,
    !!fail,
  );
  log(`压缩照片 ${done - fail} 张（原 ${mb(before)}）`);
  setTimeout(() => {
    $("optBar").style.width = "0";
  }, 1500);
};
