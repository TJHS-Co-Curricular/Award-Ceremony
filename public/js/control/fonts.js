/*
 * 控制端 · 自定义字体：选择 / 上传字体、预览（和大屏同一套规则：英文 / 数字字体在前，中文字体在后）。
 * 提供：refreshFonts()、renderFontUI()、fontPrefix()、fontFiles
 * 需要：shared/fonts.js（fontFamily）、export.js（HTML_FONT）
 */
'use strict';

let fontFiles = [];
async function refreshFonts() {
  try { fontFiles = (await api('GET', '/api/control/fonts')).fonts; } catch { fontFiles = []; }
  renderFontUI();
}
function renderFontUI() {
  if (!draft) return;
  for (const [slot, key] of [['Title', 'fontTitle'], ['Text', 'fontText']]) {
    const v = draft.event[key] || '', sel = $('f' + slot + 'Sel'), inp = $('f' + slot + 'Name');
    const files = fontFiles.map(f => f.name);
    const missing = v.startsWith('file:') && !files.includes(v.slice(5));
    sel.replaceChildren(...[el('option', { value: '' }, '默认'), el('option', { value: 'sys' }, '系统字体（填名称）'),
      ...files.map(f => el('option', { value: 'file:' + f }, '📄 ' + f)),
      missing ? el('option', { value: v }, '⚠ ' + v.slice(5) + '（文件不存在）') : null].filter(Boolean));
    sel.value = !v ? '' : v.startsWith('file:') ? v : 'sys';
    inp.value = v && !v.startsWith('file:') ? v : '';
    inp.classList.toggle('hidden', sel.value !== 'sys');
  }
  previewFonts();
}
// 英文 / 数字字体在前，中文字体在后：英文数字用前者，中文自动落到后者（和大屏 applyFonts 一样）
async function fontPrefix() {
  const [zh, en] = await Promise.all([fontFamily(draft?.event.fontTitle, 'zh'), fontFamily(draft?.event.fontText, 'en')]);
  return [en, zh].filter(Boolean).join(', ');
}
async function previewFonts() {
  const pre = await fontPrefix();   // 预览 = 大屏实际效果
  $('fpvT').style.fontFamily = pre ? `${pre}, ${HTML_FONT.serif}` : HTML_FONT.serif;
  $('fpvX').style.fontFamily = pre ? `${pre}, ${HTML_FONT.sans}` : HTML_FONT.sans;
}
for (const [slot, key] of [['Title', 'fontTitle'], ['Text', 'fontText']]) {
  const sel = $('f' + slot + 'Sel'), inp = $('f' + slot + 'Name');
  sel.onchange = () => {
    draft.event[key] = sel.value === 'sys' ? inp.value.trim() : sel.value;
    inp.classList.toggle('hidden', sel.value !== 'sys'); if (sel.value === 'sys') inp.focus();
    setDirty(true); previewFonts();
  };
  inp.oninput = () => { draft.event[key] = inp.value.trim(); setDirty(true); previewFonts(); };
}
$('bFontUp').onclick = () => $('fontFile').click();
$('fontFile').onchange = async () => {
  const f = $('fontFile').files[0]; $('fontFile').value = '';
  if (!f) return;
  $('bFontUp').disabled = true; $('bFontUp').textContent = `上传中（${mb(f.size)}）…`;
  try {
    const r = await fetch('/api/control/font?name=' + encodeURIComponent(f.name), { method: 'POST', headers: { 'X-AC': '1', 'Content-Type': 'application/octet-stream' }, body: f, credentials: 'same-origin' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'HTTP ' + r.status);
    toast(`已上传 ${f.name}，在上面的下拉框里选它`); log('上传字体 ' + f.name);
    await refreshFonts();
  } catch (e) { toast('上传失败：' + e.message, true); }
  finally { $('bFontUp').disabled = false; $('bFontUp').textContent = '上传字体文件…'; }
};
