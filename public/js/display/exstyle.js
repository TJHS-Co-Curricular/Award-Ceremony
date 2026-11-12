/*
 * 大屏 · 名字卡套用「图片导出」的设计（控制端「图片导出」分页调的，经公开视图 v.exStyle 推来）：
 *   个人照片卡：字号（pt，按卡片高度换算，和导出图片同一个公式）、颜色、粗体、斜体、字距、字体、阴影、左边加暗、文字横向位置、姓名纵向位置、行距；
 *   团体卡（名字在照片下面）：只套颜色、粗体、斜体、字距、字体、阴影，排版照旧。纯文字卡不变。
 * 卡片里不印分类和奖项名（大屏上方已经有）。备注不在导出图片里，大屏照旧放在最后一行。
 * 提供：exStyleSet(st)、exDecorate(card)
 * 需要：stage.js（KEY、$）、shared/fonts.js（fontFamily）、shared/sparkle.js、cards.js（fitText，调用时才用）
 */
'use strict';

// 左边的金色闪光：3 层光点图（和导出图片同一份）做成 CSS 背景，各层用 CSS 动画轮流闪（只动 opacity，不占主线程）
SPARK_LAYERS.forEach((L, i) => document.documentElement.style.setProperty('--spk' + i, `url("${sparkleTile(L.seed, L.n).toDataURL()}")`));

let EXD = null, exKey = '';
function exStyleSet(st) {
  const key = JSON.stringify(st || null);
  if (key === exKey) return;
  exKey = key;
  EXD = st ? { ...st, fam: {} } : null;
  exRestyle();
  // 单独指定了字体的项目：载入（上传的字体要带输出页密钥），载好再套一次
  const ks = st ? Object.keys(st.elems).filter(k => st.elems[k].font) : [];
  if (ks.length) Promise.all(ks.map(async k => [k, await fontFamily(st.elems[k].font, 'ex_' + k, KEY)])).then(list => {
    if (key !== exKey) return;
    for (const [k, f] of list) if (f) EXD.fam[k] = `${f}, var(--sans)`;
    exRestyle();
  });
}
function exRestyle() { for (const c of document.querySelectorAll('#grid.photo .card')) if (c.querySelector('.tx [data-k]')) exDecorate(c); }

function exDecorate(card) {
  if (!card.isConnected) return;
  if (!EXD) { card.querySelectorAll('.tx [data-k]').forEach(fitText); return; }   // 旧服务端没发设计：照旧排版
  const E = EXD.elems, cap = $('grid').classList.contains('cap');
  const tx = card.querySelector('.tx'), els = [...tx.querySelectorAll('[data-k]')];
  // 和导出一样：U = 照片高（3:2 照片 = 宽 ÷ 1.5），字号 pt × U / 540，阴影按 U 算
  const U = cap ? card.clientWidth / 1.5 : card.clientHeight, a = EXD.shadow / 100;
  const shadow = a ? `${U * .005 * a}px ${U * .005 * a}px ${U * .02 * a}px rgba(0,0,0,${Math.min(1, a * 1.25)})` : 'none';
  const styleOf = k => E[k] || { show: true, size: E.socEn.size * .9, color: '', bold: false, italic: false, spacing: 0 };   // 备注
  for (const el of els) {
    const k = el.dataset.k, e = styleOf(k);
    Object.assign(el.style, {
      display: e.show ? '' : 'none', color: e.color, fontWeight: e.bold ? 700 : 400, fontStyle: e.italic ? 'italic' : 'normal',
      letterSpacing: e.spacing + 'em', fontFamily: EXD.fam[k] || '', textShadow: shadow,
      paddingLeft: cap ? '' : e.spacing + 'em',   // 字距会在最后一个字后面多出一段，居中时补回来（导出也这样补）
      fontSize: cap ? '' : (e.size * U / 540) + 'px'
    });
  }
  if (cap) { fitText(els[0]); return; }
  // 个人照片卡：文字以 textX 为中心、最宽 = 导出的 maxW；左边加暗同导出
  const half = Math.min(EXD.textX, 100 - EXD.textX) * .94;
  tx.classList.add('ex');
  tx.style.left = (EXD.textX - half) + '%'; tx.style.width = (half * 2) + '%';
  // 左边一块：宽 = 文字横向位置 × 2（文字在正中间），加暗 + 金色闪光，右边缘淡出（同导出）
  const sh = card.querySelector('.shade'), s = EXD.shade / 100;
  if (sh) {
    Object.assign(sh.style, { right: 'auto', width: Math.min(100, EXD.textX * 2) + '%',
      background: s > 0 ? `linear-gradient(90deg,rgba(0,0,0,${s}) 0%,rgba(0,0,0,${s * .84}) 86%,rgba(0,0,0,0) 100%)` : 'none' });
    let sp = sh.querySelector('.spks');
    if (!sp) { sp = sh.appendChild(document.createElement('div')); sp.className = 'spks'; for (let i = 0; i < SPARK_LAYERS.length; i++) sp.appendChild(document.createElement('i')).className = 'spk s' + i; }
    sp.style.display = EXD.sparkle !== false ? '' : 'none';   // 没写（旧服务端）= 开，和导出的默认一样
  }
  // 行的位置：第一行的基线在 nameY，之后每行往下 字号 × 1.2（比姓名小一截的行 × 1.32），和导出同一个公式
  const shown = els.filter(el => el.style.display !== 'none'), big = E.name.size, k = U / 540;
  let y = U * EXD.nameY / 100;
  shown.forEach((el, i) => {
    fitText(el);   // 太宽就缩小（只缩字，不改行距，和导出一样）
    const e = styleOf(el.dataset.k);
    if (i) y += e.size * k * (e.size < big * .9 ? 1.32 : 1.2);
    let bl = el.querySelector('i.bl');
    if (!bl) { bl = document.createElement('i'); bl.className = 'bl'; el.appendChild(bl); }
    el.style.top = (y - bl.offsetTop) + 'px';   // bl 贴在这一行的基线上：把基线对到 y
  });
}
