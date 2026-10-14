/*
 * 共用 · 字体：大屏（display）和控制端（control）用同一份。
 * sysFont(spec)            系统字体名称 → CSS 字体列表
 * fontFamily(spec, slot, key)  「file:xxx.ttf」= 上传到服务端的字体（下载后用 FontFace 载入）；其它 = 系统字体名称。
 *                          key = 输出页密钥（大屏要带；控制端已登录，不用）。返回 CSS 字体名，载入失败返回 ''。
 */
"use strict";

// 去掉 PowerPoint 的「(Headings)」「(Body)」「（正文）」等标签，中文名同时补上英文名
const FONT_ALIAS = {
  华文楷体: "STKaiti",
  楷体: "KaiTi",
  楷体_GB2312: "KaiTi_GB2312",
  宋体: "SimSun",
  新宋体: "NSimSun",
  黑体: "SimHei",
  仿宋: "FangSong",
  微软雅黑: "Microsoft YaHei",
  微软正黑体: "Microsoft JhengHei",
  等线: "DengXian",
  华文宋体: "STSong",
  华文中宋: "STZhongsong",
  华文仿宋: "STFangsong",
  华文细黑: "STXihei",
  华文黑体: "STHeiti",
  华文行楷: "STXingkai",
  华文新魏: "STXinwei",
  华文隶书: "STLiti",
  华文琥珀: "STHupo",
  华文彩云: "STCaiyun",
  隶书: "LiSu",
  幼圆: "YouYuan",
  方正舒体: "FZShuTi",
  方正姚体: "FZYaoti",
  思源宋体: "Source Han Serif SC",
  思源黑体: "Source Han Sans SC",
  标楷体: "DFKai-SB",
  细明体: "MingLiU",
  新细明体: "PMingLiU",
};
function sysFont(spec) {
  const name = String(spec)
    .replace(/^\s*\+\s*/, "")
    .replace(
      /\s*[（(]\s*(headings?|body|标题|正文|title|text)\s*[)）]\s*$/i,
      "",
    )
    .replace(/["\\]/g, "")
    .trim();
  if (!name) return "";
  const en =
    FONT_ALIAS[name] ||
    Object.keys(FONT_ALIAS).find(
      (k) => FONT_ALIAS[k].toLowerCase() === name.toLowerCase(),
    );
  return [name, en]
    .filter(Boolean)
    .map((n) => `"${n}"`)
    .join(", ");
}
const fontLoaded = new Map();
async function fontFamily(spec, slot, key = "") {
  if (!spec) return "";
  if (!spec.startsWith("file:")) return sysFont(spec);
  const file = spec.slice(5),
    fam = "AC_" + slot + "_" + file.replace(/[^\w]/g, "_");
  const url =
    `/media/font?f=${encodeURIComponent(file)}` +
    (key ? `&k=${encodeURIComponent(key)}` : "");
  if (!fontLoaded.has(fam))
    fontLoaded.set(
      fam,
      new FontFace(fam, `url(${url})`)
        .load()
        .then((f) => {
          document.fonts.add(f);
          return true;
        })
        .catch(() => false),
    );
  return (await fontLoaded.get(fam)) ? `"${fam}"` : "";
}
