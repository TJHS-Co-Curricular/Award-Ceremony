/*
 * 大屏 · 大会背景（效果控制「大会背景」，SCHEMA 的 bgMode）：
 *   fx    = 深色渐层 + 边框（默认，CSS 画的，这里什么都不做）
 *   image = 背景图片：控制端上传的 JPEG（本屏幕有自己的一张就用它，否则用「所有屏幕」那张），
 *           画进 canvas #bgimg（不用 <img>：OBS 内置浏览器会把原图留在显存里），铺满（cover），所有画面都在它上面
 *   clear = 透明：网页底色、渐层、边框全部不画，只留文字 / 照片 / 浮尘 / 闪光，在 OBS 里把影片放在下面
 * 提供：bgImgSet(v.bg)、bgApply()、bgClearOn()、bgImgOk()（外壳换新、导出影片要等图片画好）、bgImgReady()（Promise）、bgMode()
 * 需要：stage.js（KEY、RECORD、REC_K、SW / SH、$）、fxconf.js（FXC、FX_SCREEN）
 */
'use strict';

let bgMap = null, bgUrl = '', bgBmp = null, bgLoading = null, bgDrawnKey = '';
const bgMode = () => FXC.bgMode === 'image' || FXC.bgMode === 'clear' ? FXC.bgMode : 'fx';
// 本屏幕要用哪一张：自己的 → 所有屏幕的 → 没有（image 模式没有图片时退回程序画的）
function bgPick() {
  if (!bgMap) return '';
  const own = FX_SCREEN && bgMap.screens?.[FX_SCREEN];
  if (own) return '/media/bg?s=' + encodeURIComponent(FX_SCREEN) + '&v=' + own + '&k=' + encodeURIComponent(KEY);
  return bgMap.all ? '/media/bg?v=' + bgMap.all + '&k=' + encodeURIComponent(KEY) : '';
}
function bgImgSet(map) { bgMap = map || null; bgApply(); }
function bgApply() {
  const mode = bgMode(), url = mode === 'image' ? bgPick() : '';
  const root = document.documentElement.classList;
  root.toggle('bg-image', mode === 'image' && !!url);
  root.toggle('bg-clear', mode === 'clear');
  if (url !== bgUrl) {
    bgUrl = url; bgBmp?.close?.(); bgBmp = null; bgDrawnKey = '';
    if (url) {
      const want = url;
      bgLoading = fetch(url, { cache: 'force-cache' }).then(r => r.ok ? r.blob() : Promise.reject(r.status))
        .then(b => createImageBitmap(b)).then(bmp => { if (bgUrl === want) { bgBmp = bmp; bgDraw(); } else bmp.close?.(); })
        .catch(() => {}).finally(() => { if (bgUrl === want) bgLoading = null; });
    } else bgLoading = null;
  }
  bgDraw();
}
// 画进 canvas：导出影片用影片的像素（和 #bg 一样），平常用屏幕实际像素（最多 2 倍，避免太占显存）
function bgDraw() {
  const c = $('bgimg'); if (!c) return;
  if (!bgBmp) { if (c.width !== 1) { c.width = c.height = 1; bgDrawnKey = ''; } return; }
  const k = RECORD ? REC_K : Math.min(2, Math.min(innerWidth / SW, innerHeight / SH) * (devicePixelRatio || 1));
  const w = Math.round(SW * k / 2) * 2, h = Math.round(SH * k / 2) * 2, key = [bgUrl, w, h].join();
  if (key === bgDrawnKey) return;
  bgDrawnKey = key;
  c.width = w; c.height = h;
  const g = c.getContext('2d'), s = Math.max(w / bgBmp.width, h / bgBmp.height);   // cover：铺满、居中裁切
  const dw = bgBmp.width * s, dh = bgBmp.height * s;
  g.imageSmoothingQuality = 'high';
  g.drawImage(bgBmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
function bgClearOn() { return document.documentElement.classList.contains('bg-clear'); }   // 外壳（shell.js）用：外壳也要透明
function bgImgOk() { return !bgLoading; }
function bgImgReady() { return bgLoading || Promise.resolve(); }
addEventListener('resize', () => setTimeout(bgDraw, 300));
