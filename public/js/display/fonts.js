/*
 * 大屏 · 自定义字体：把「奖项编辑」里设的中文字体 + 英文 / 数字字体套用到所有文字。
 * 提供：applyFonts(event)
 * 需要：shared/fonts.js（fontFamily）、stage.js（KEY）、render.js（relayout，字宽变了要重排）
 */
"use strict";

const rootCss = getComputedStyle(document.documentElement);
const DEF = {
  serif: rootCss.getPropertyValue("--serif").trim(),
  sans: rootCss.getPropertyValue("--sans").trim(),
};
let fontKey = "|"; // 默认（没设字体）就不用重排
async function applyFonts(ev) {
  const key = (ev?.fontTitle || "") + "|" + (ev?.fontText || "");
  if (key === fontKey) return;
  fontKey = key;
  // fontTitle = 中文字体，fontText = 英文 / 数字字体（像 PowerPoint 的「中文字体 + 西文字体」）。
  // 英文字体排在前面：英文和数字用它；它没有的中文字，浏览器自动往后找到中文字体。所有文字都套用。
  const [zh, en] = await Promise.all([
    fontFamily(ev?.fontTitle, "zh", KEY),
    fontFamily(ev?.fontText, "en", KEY),
  ]);
  if (key !== fontKey) return;
  const pre = [en, zh].filter(Boolean).join(", "),
    st = document.documentElement.style;
  st.setProperty("--serif", pre ? `${pre}, ${DEF.serif}` : DEF.serif);
  st.setProperty("--sans", pre ? `${pre}, ${DEF.sans}` : DEF.sans);
  relayout(); // 字宽变了：重新排版、重新缩字
}
