/*
 * 学生证照片：文件名以「-ID」结尾（例：001-ID.jpg，也接受 _ID、空格 ID，不分大小写）就不裁切，完整显示。
 * 画法：同一张图铺满、模糊、加暗当背景；完整的证件按原比例缩进「文字区右边」那一块，四周留边、加阴影。
 * 有学生证的奖项用团体那样的版式（照片在上、名字在下）：大屏 display/cards.js 的 drawPhoto 用 drawIdPhoto(left = 0) 画进上面那一格；
 * 图片导出 control/export.js 的 exRender 用团体图版式（证件按原比例完整画，不需要 drawIdPhoto），只用 isIdPhoto。
 * 提供：isIdPhoto(name)、drawIdPhoto(g, src, sw, sh, W, H, left)
 * 需要：无
 */
'use strict';

const isIdPhoto = (name) => /[-_ ]id\.[a-z0-9]+$/i.test(String(name || ''));

// g：画布；src：图片（img 或 ImageBitmap），原尺寸 sw × sh；画满 W × H；left = 左边留给文字的宽度比例（0 = 整张都可以放证件）
function drawIdPhoto(g, src, sw, sh, W, H, left = 0) {
  // 背景：放大 10% 铺满再模糊（边缘才不会透出底色），再盖一层黑
  const k = Math.max(W / sw, H / sh) * 1.1, bw = sw * k, bh = sh * k;
  g.save();
  g.filter = `blur(${Math.max(4, Math.round(Math.min(W, H) * 0.03))}px)`;
  g.drawImage(src, (W - bw) / 2, (H - bh) / 2, bw, bh);
  g.restore();
  g.fillStyle = 'rgba(8,6,12,.62)';
  g.fillRect(0, 0, W, H);
  // 证件：完整缩进右边那一块
  const m = Math.min(W, H) * 0.07, x0 = W * Math.min(.8, Math.max(0, left));
  const aw = W - x0 - m * (left > 0 ? 1.4 : 2), ah = H - m * 2;
  const c = Math.min(aw / sw, ah / sh), w = sw * c, h = sh * c;
  const x = x0 + (left > 0 ? m * .4 : m) + (aw - w) / 2, y = m + (ah - h) / 2;
  g.save();
  g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = m * .7; g.shadowOffsetY = m * .18;
  g.drawImage(src, x, y, w, h);
  g.restore();
}
