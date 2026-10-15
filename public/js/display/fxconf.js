/*
 * 大屏 · 效果设定：控制端「效果控制」分页调的值（服务端 data/fx.json，经公开视图 v.fx 推来）。
 * 本屏幕用：默认值 ← 所有屏幕的设定 ← 本屏幕（网址 name=，OBS 版去掉「·OBS」）单独的设定 ← 控制端预览的暂时设定。
 * 值改了马上生效：交给 fxPush()（fx/react.js；后台线程模式由 fx/host.js 转达），需要重建的特效会在下一帧重建，不用刷新页面。
 * 提供：FXC（目前生效的设定）、fxSet(v.fx)、fxPreviewSet(obj)（控制端预览窗口专用）
 * 需要：stage.js（qs、$）；调用时才用到 fx/react.js 或 fx/host.js（fxPush）、standby.js、render.js
 */
'use strict';

const FX_DEF = {
  standby: 'galaxy',
  gyBright: .75, gySpeed: .12, gyDensity: 1, gySize: 1, gyX: null, gyY: null, gyTilt: .36,   // gyX / gyY：null = 自动
  grBright: 1, grDensity: 1,
  dustOn: true, dustAmount: 1,
  flashOn: true, flashPeak: .42, flashAmount: 1,
  cascadeMs: 600, photoUp: .25,
  bgFps: '60', bgScale: '1',   // 待机背景的帧率 / 解析度（省显卡、CPU）
  renewMin: 3, renewReveals: 5   // 外壳（shell.js）每隔几分钟 / 每揭晓几次，在后台换新一次画面，释放显卡内存
};
const FX_SCREEN = (qs.get('name') || '').replace(/·OBS$/, '');
let FXC = { ...FX_DEF }, fxSrv = null, fxLocal = null;
const fxRebuild = { t: 0, gy: false, gr: false, dust: false, size: false };

function fxSet(fx) { if (JSON.stringify(fx) === JSON.stringify(fxSrv)) return; fxSrv = fx; fxUpdate(); }
function fxPreviewSet(obj) { fxLocal = obj && typeof obj === 'object' ? obj : null; fxUpdate(); }
function fxUpdate() {
  const old = FXC, next = { ...FX_DEF, ...(fxSrv?.all || {}), ...(fxSrv?.screens?.[FX_SCREEN] || {}), ...(fxLocal || {}) };
  FXC = next;
  const ch = (...ks) => ks.some(k => old[k] !== next[k]);
  // 需要重建的：等滑杆停下来 0.4 秒再重建一次（拖动时不会连续重建几十次）
  if (ch('gyBright', 'gyDensity', 'gySize', 'gyX', 'gyY', 'gyTilt')) fxRebuild.gy = true;
  if (ch('grDensity')) fxRebuild.gr = true;
  if (ch('dustOn', 'dustAmount')) fxRebuild.dust = true;
  if (ch('bgScale')) fxRebuild.size = true;
  fxPush(next);   // 新的值马上交给特效（亮度、闪光……不用重建的立即生效）
  const go = () => {
    const { gy, gr, dust, size } = fxRebuild;
    if (gy || gr || dust || size) fxPush(FXC, { gy, gr, dust, size });
    fxRebuild.gy = fxRebuild.gr = fxRebuild.dust = fxRebuild.size = false;
  };
  clearTimeout(fxRebuild.t);
  if (RECORD) go(); else fxRebuild.t = setTimeout(go, 400);   // 导出影片：马上重建（之后时间由导出程序控制）
  $('goldfx').style.filter = next.standby === 'goldriver' && next.grBright !== 1 ? `brightness(${next.grBright})` : '';
  if (ch('standby') && $('s-standby').classList.contains('active')) standbyFx(true, next.standby);
  if (ch('photoUp') && cur.mode === 'photo') photoShift();
}
