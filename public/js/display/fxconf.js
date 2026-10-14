/*
 * 大屏 · 效果设定：控制端「效果控制」分页调的值（服务端 data/fx.json，经公开视图 v.fx 推来）。
 * 本屏幕用：默认值 ← 所有屏幕的设定 ← 本屏幕（网址 name=，OBS 版去掉「·OBS」）单独的设定 ← 控制端预览的暂时设定。
 * 值改了马上生效：需要重建的特效（星系、光河、浮尘）会在下一帧重建，不用刷新页面。
 * 提供：FXC（目前生效的设定）、fxSet(v.fx)、fxPreviewSet(obj)（控制端预览窗口专用）
 * 需要：stage.js（qs、$）；调用时才用到 galaxy.js / goldriver.js / dust.js / standby.js / render.js
 */
"use strict";

const FX_DEF = {
  standby: "galaxy",
  gyBright: 0.75,
  gySpeed: 0.12,
  gyDensity: 1,
  gySize: 1,
  gyX: null,
  gyY: null,
  gyTilt: 0.36, // gyX / gyY：null = 自动
  grBright: 1,
  grDensity: 1,
  dustOn: true,
  dustAmount: 1,
  flashOn: true,
  flashPeak: 0.42,
  flashAmount: 1,
  cascadeMs: 600,
  photoUp: 0.25,
};
const FX_SCREEN = (qs.get("name") || "").replace(/·OBS$/, "");
let FXC = { ...FX_DEF },
  fxSrv = null,
  fxLocal = null;

function fxSet(fx) {
  if (JSON.stringify(fx) === JSON.stringify(fxSrv)) return;
  fxSrv = fx;
  fxUpdate();
}
function fxPreviewSet(obj) {
  fxLocal = obj && typeof obj === "object" ? obj : null;
  fxUpdate();
}
function fxUpdate() {
  const old = FXC,
    next = {
      ...FX_DEF,
      ...(fxSrv?.all || {}),
      ...(fxSrv?.screens?.[FX_SCREEN] || {}),
      ...(fxLocal || {}),
    };
  FXC = next;
  const ch = (...ks) => ks.some((k) => old[k] !== next[k]);
  if (ch("gyBright", "gyDensity", "gySize", "gyX", "gyY", "gyTilt")) gyW = 0; // 星系下一帧重建
  if (ch("grDensity")) gW = 0; // 光河下一帧重建
  if (ch("dustOn", "dustAmount")) dustBuild();
  $("goldfx").style.filter =
    next.standby === "goldriver" && next.grBright !== 1
      ? `brightness(${next.grBright})`
      : "";
  if (ch("standby") && $("s-standby").classList.contains("active"))
    standbyFx(true, next.standby);
  if (ch("photoUp") && cur.mode === "photo") photoShift();
}
