/*
 * 大屏 · 效果设定：控制端「效果控制」分页调的值（服务端 data/fx.json，经公开视图 v.fx 推来）。
 * 本屏幕用：默认值 ← 所有屏幕的设定 ← 本屏幕（网址 name=，OBS 版去掉「·OBS」）单独的设定 ← 控制端预览的暂时设定。
 * 值改了马上生效：交给 fxPush()（fx/react.js；后台线程模式由 fx/host.js 转达），需要重建的特效会在下一帧重建，不用刷新页面。
 * 提供：FXC（目前生效的设定）、fxSet(v.fx)、fxPreviewSet(obj)（控制端预览窗口专用）
 * 需要：stage.js（qs、$）、shared/theme.js（themeApply）；调用时才用到 fx/react.js 或 fx/host.js（fxPush）、render.js
 */
'use strict';

const FX_DEF = {
  thMain: '#d9b25f', thHi: null, thLo: null, thBg: '#07060c',   // 主题颜色（shared/theme.js；null = 跟着主色）
  bgMode: 'fx',   // 大会背景：fx 程序画的 / image 背景图片 / clear 透明（display/bgimg.js）
  dustOn: true, dustAmount: 1,
  flashOn: true, flashPeak: .42, flashAmount: 1,
  cascadeMs: 600, photoUp: .25,
  renewMin: 3, renewReveals: 5,   // 外壳（shell.js）每隔几分钟 / 每揭晓几次，在后台换新一次画面，释放显卡内存
  logoOn: true, logoSize: .16, logoMargin: .025, logoOpacity: 1,   // 照片右上角的学校 Logo（大小、边距 = 照片宽度的比例）
  sLogoOn: true, sLogoSize: .15, sLogoMargin: .025, sLogoOpacity: 1   // 画面左上角的学校 Logo（大小、边距 = 画面高度的比例）
};
const FX_SCREEN = (qs.get('name') || '').replace(/·OBS$/, '');
let FXC = { ...FX_DEF }, fxSrv = null, fxLocal = null;
const fxRebuild = { t: 0, dust: false };

function fxSet(fx) { if (JSON.stringify(fx) === JSON.stringify(fxSrv)) return; fxSrv = fx; fxUpdate(); }
function fxPreviewSet(obj) { fxLocal = obj && typeof obj === 'object' ? obj : null; fxUpdate(); }
function fxUpdate() {
  const old = FXC, next = { ...FX_DEF, ...(fxSrv?.all || {}), ...(fxSrv?.screens?.[FX_SCREEN] || {}), ...(fxLocal || {}) };
  FXC = next;
  const ch = (...ks) => ks.some(k => old[k] !== next[k]);
  // 需要重建的：等滑杆停下来 0.4 秒再重建一次（拖动时不会连续重建几十次）
  if (ch('thMain') && typeof exSpkSet === 'function') exSpkSet();   // 照片卡左边的闪光光点（display/exstyle.js）
  if (ch('dustOn', 'dustAmount')) fxRebuild.dust = true;
  fxPush(next);   // 新的值马上交给特效（亮度、闪光……不用重建的立即生效）
  const go = () => {
    if (fxRebuild.dust) fxPush(FXC, { dust: true });
    fxRebuild.dust = false;
  };
  clearTimeout(fxRebuild.t);
  if (RECORD) go(); else fxRebuild.t = setTimeout(go, 400);   // 导出影片：马上重建（之后时间由导出程序控制）
  themeApply(next);   // 主题颜色：只是 CSS 变量，马上生效
  const rs = document.documentElement.style;   // 照片 Logo：只是 CSS 变量，改了马上生效，不用重画照片
  rs.setProperty('--logo-k', next.logoSize); rs.setProperty('--logo-m', next.logoMargin); rs.setProperty('--logo-o', next.logoOpacity);
  document.documentElement.classList.toggle('nologo', !next.logoOn);
  rs.setProperty('--slogo-k', next.sLogoSize); rs.setProperty('--slogo-m', next.sLogoMargin); rs.setProperty('--slogo-o', next.sLogoOpacity);
  document.documentElement.classList.toggle('noslogo', !next.sLogoOn);
  if (ch('bgMode') && typeof bgApply === 'function') bgApply();   // 大会背景（display/bgimg.js）
  if (ch('photoUp') && cur.mode === 'photo') photoShift();
}
