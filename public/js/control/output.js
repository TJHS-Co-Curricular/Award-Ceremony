/*
 * 控制端 · 导出共用的「出文件」工具（1.93 从 ebook.js / poster.js / export.js 搬出来，输出不变）：
 *   outBlob(cv, type, q, err)  canvas → 图片 Blob（JPG / PNG）；浏览器压不出来时报 err
 *   outDataUrl(blob)           Blob → data: 网址（翻书网页把每页图片嵌进去用）
 *   outPdf(jpgs, title, W, H)  几张 JPG 组成 PDF，每页一张（W × H 是 pt，默认 A4）
 *   outDownload(blob, name)    让浏览器下载这个文件
 *   safeFile(text)             文字 → 可以当文件名（1.94 从 export.js 搬来）
 * 图片导出（export.js）、电子书（ebook.js）、海报（poster.js）共用；只用浏览器内建功能，不用第三方库。
 * 需要：core.js（el）
 */
'use strict';

// 文件名里不能有的字换成 _（Windows 也能保存）
const safeFile = t => String(t || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 60) || '未命名';

function outBlob(cv, type = 'image/jpeg', q = .92, err = '图片生成失败') {
  return new Promise((ok, bad) => cv.toBlob(b => (b ? ok(b) : bad(new Error(err))), type, q));
}
function outDataUrl(b) {
  return new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => bad(new Error('图片读取失败')); r.readAsDataURL(b); });
}
function outDownload(blob, name) {
  const url = URL.createObjectURL(blob), link = el('a', { href: url, download: name, style: 'display:none' });
  document.body.append(link); link.click();
  setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 60000);
}

/* 最简单的 PDF：每页一张 JPG（DCTDecode，原样放进去，不重新压缩）。jpgs = [{ blob, w, h }]。
 * 默认 A4（pt）；电子书用默认，海报传实际尺寸（英寸 × 72），A4 拼贴每页一张 A4。 */
async function outPdf(jpgs, title, W = 595.28, H = 841.89) {
  const enc = new TextEncoder(), parts = [], xref = [];
  let off = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); off += b.length; };
  const obj = (n, ...body) => { xref[n] = off; push(`${n} 0 obj\n`); body.forEach(push); push('\nendobj\n'); };
  const N = jpgs.length;
  const utf16 = t => '<FEFF' + [...String(t)].map(c => { const u = c.codePointAt(0);
    if (u < 0x10000) return u.toString(16).padStart(4, '0');
    const v = u - 0x10000; return ((v >> 10) + 0xd800).toString(16) + ((v & 0x3ff) + 0xdc00).toString(16); }).join('').toUpperCase() + '>';
  push('%PDF-1.4\n'); push(new Uint8Array([37, 226, 227, 207, 211, 10]));   // 二进制标记
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${N} /Kids [${jpgs.map((_, i) => `${4 + i * 3} 0 R`).join(' ')}] >>`);
  obj(3, `<< /Title ${utf16(title)} /Producer (Award Ceremony) >>`);
  for (const [i, j] of jpgs.entries()) {
    const pg = 4 + i * 3, ct = pg + 1, im = pg + 2, draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    obj(ct, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
    const bytes = new Uint8Array(await j.blob.arrayBuffer());
    obj(im, `<< /Type /XObject /Subtype /Image /Width ${j.w} /Height ${j.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`, bytes, '\nendstream');
  }
  const start = off, size = 4 + N * 3;
  push(`xref\n0 ${size}\n0000000000 65535 f \n` + Array.from({ length: size - 1 }, (_, i) => String(xref[i + 1]).padStart(10, '0') + ' 00000 n \n').join(''));
  push(`trailer\n<< /Size ${size} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${start}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
