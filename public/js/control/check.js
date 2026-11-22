/*
 * 控制端 · 赛前检查：一次列出大会前要处理的问题，只看不改（维护者定 2026-11-22，docs/template-plan.md 2.5）。
 * 查的是「已保存」的名单（V.awards）；奖项编辑里没保存的修改不算。
 *   1 名单里写了、照片文件夹里没有的照片      4 照片文件夹里有、名单和电子书都没用到的照片
 *   2 备注写了图片文件名、但找不到的          5 图片导出的奖项名素材找不到的（有素材文件夹时才查）
 *   3 电子书的集锦 / 花絮 / 前言照片找不到的  6 学会编号在对照表里查不到的   7 没有得奖者的奖项
 *   8 入围揭晓没标得主或标了几位      9 指定的字体文件（file:）不在 data/fonts/      10 海报里选了、但名单里已经没有的奖项（1.89）
 * 提供：ckRun()
 * 需要：core.js（api、el、V、dirty）、import.js（SOC、socFind）、export.js（exLoadMats、exMats、exMatFind）、ebook.js（ebClean、ebBtsLine）
 */
'use strict';

let ckBusy = false;
const ckLow = s => String(s || '').trim().toLowerCase();
const ckNotePic = w => /^[^\n/\\]+\.(jpe?g|png|webp)$/i.test((w.detail || '').trim()) ? w.detail.trim() : '';   // 同 lib/views.js 的 NOTE_PIC
const ckWhere = a => [a.section, a.group, a.title].filter(Boolean).join(' · ');

async function ckRun() {
  if (ckBusy || !V) return;
  ckBusy = true; $('ckSum').textContent = '检查中…'; $('bCkRun').disabled = true;
  try {
    const [ph, pf, eb, soc, fo, xs, po] = await Promise.all([
      api('GET', '/api/control/photos'), api('GET', '/api/control/photo-files'),
      api('GET', '/api/control/ebook').catch(() => ({ ebook: {} })), api('GET', '/api/control/societies').catch(() => ({ list: [] })),
      api('GET', '/api/control/fonts').catch(() => ({ fonts: [] })), api('GET', '/api/control/export-style').catch(() => ({})),
      api('GET', '/api/control/poster').catch(() => ({ poster: {} })),
      exLoadMats()
    ]);
    SOC = soc.list || [];
    const out = ckCollect(V.awards || [], ph.photos || [], pf.files || [], ebClean(eb.ebook || {}));
    ckMore(out, V.awards || [], V.event || {}, (fo.fonts || []).map(f => f.name), xs.style || xs, po.poster || {});
    ckShow(out);
  } catch (e) {
    $('ckSum').textContent = '检查失败：' + e.message; $('ckList').replaceChildren();
  } finally { ckBusy = false; $('bCkRun').disabled = false; }
}

function ckCollect(awards, photos, files, EB) {
  const missing = new Set(photos.filter(x => x.missing).map(x => x.name));
  const have = new Set(files.map(ckLow));
  const used = new Set();
  const out = [];
  const add = (title, tip, rows, okText) => out.push({ title, tip, rows, okText });

  // 1、2 照片、备注图片
  const miss = [], missNote = [];
  for (const a of awards) a.winners.forEach(w => {
    if (w.photo) { used.add(ckLow(w.photo)); if (missing.has(w.photo)) miss.push([w.photo, `${ckWhere(a)} — ${w.name || '（没写名字）'}`]); }
    const n = ckNotePic(w);
    if (n) { used.add(ckLow(n)); if (missing.has(n)) missNote.push([n, `${ckWhere(a)} — ${w.name || '（没写名字）'}`]); }
  });
  add('照片找不到', '名单写了文件名，但 data/photos/ 里没有这个文件（大屏会显示没有照片的卡片）。检查文件名、扩展名（.jpg / .png）有没有打错。', miss, '名单里的照片都找到了');
  add('备注图片找不到', '备注只写一个图片文件名时当作备注图片，但 data/photos/ 里没有。', missNote, '备注图片都找到了');

  // 3 电子书
  const ebNames = [...EB.gallery.map(f => [f, '集锦']), ...EB.bts.map(l => [ebBtsLine(l).file, '幕后花絮']), ...(EB.prefacePhoto ? [[EB.prefacePhoto, '前言照片']] : [])].filter(x => x[0]);
  ebNames.forEach(([f]) => used.add(ckLow(f)));
  add('电子书照片找不到', '「电子书」分页填的集锦、花絮、前言照片，data/photos/ 里没有（导出电子书时会跳过）。', ebNames.filter(([f]) => !have.has(ckLow(f))), ebNames.length ? '电子书照片都找到了' : '电子书没填照片');

  // 4 没人用的照片
  add('没用到的照片', '照片文件夹里有，但名单和电子书都没用到。可能是文件名和名单对不上（例：名单写 001.jpg，文件叫 01.jpg）；确实不要的可以自己删掉。',
    files.filter(f => !used.has(ckLow(f))).map(f => [f, '']), '照片文件夹里的照片都用到了');

  // 5 素材图片（图片导出）
  if (exMats.length) {
    const seen = new Set(), rows = [];
    for (const a of awards) {
      const ht = exHeadTail(a, awards), pairs = [ht.head, ht.tail].filter(p => p[0] || p[1]);   // 和图片导出同一条规则（没分类时可能用大类素材）
      for (const [zh, en] of pairs) {
        const t = `${zh || ''}${en ? ' ' + en : ''}`.trim();
        if (t && !seen.has(t)) { seen.add(t); if (!exMatFind(zh, en)) rows.push([t, '']); }
      }
    }
    add('奖项名素材找不到', `data/material/ 里有 ${exMats.length} 张素材，这些分类 / 奖项名找不到对应的素材，图片导出时照旧印文字。素材文件名 = 奖项英文名或中文名。`, rows, '所有奖项名都找到素材');
  } else add('奖项名素材', '没有素材文件夹（data/material/），图片导出时奖项名印文字。不用素材就不用管。', [], '没有素材，不用检查');

  // 6 学会
  const socRows = [];
  if (SOC.length) {
    const map = new Map();
    for (const a of awards) for (const w of a.winners) if (w.soc && !socFind(w.soc)) {
      if (!map.has(w.soc)) map.set(w.soc, []);
      map.get(w.soc).push(w.name || '（没写名字）');
    }
    for (const [s, ns] of map) socRows.push([s, `${ns.length} 位：${ns.slice(0, 6).join('、')}${ns.length > 6 ? '…' : ''}`]);
  }
  const L = socL();   // 名单第 4 栏的名称（默认学会）
  add(L + '查不到', SOC.length ? `名单「${L}」栏写的编号 / 名字，在${L}对照表里找不到（大屏、图片导出不显示）。到「奖项编辑 → ${L}对照表」补上。` : `还没有${L}对照表：${L}栏照原文拆成中文、英文两行，不用检查。`, socRows, SOC.length ? L + '都查得到' : '没有对照表，不用检查');

  // 7 没有得奖者
  add('没有得奖者的奖项', '现场按到这个奖项时，大屏只有标题、没有名字。', awards.filter(a => !a.winners.length).map(a => [ckWhere(a) || '（没写奖项名）', '']), '每个奖项都有得奖者');
  return out;
}

// 8 ~ 10（1.89，维护者 2026-11-22）：入围揭晓的得主、字体文件、海报选的奖项
function ckMore(out, awards, ev, fonts, xs, po) {
  const add = (title, tip, rows, okText) => out.push({ title, tip, rows, okText });
  // 8 入围揭晓：要刚好一位「得主」（没标 = 现场照逐一揭晓；标了几位 = 只算第一位）
  const nom = awards.filter(a => a.revealMode === 'nominee' && a.winners.length).map(a => [a, a.winners.filter(w => w.win).length]).filter(([, k]) => k !== 1);
  add('入围揭晓的得主', '入围揭晓的奖项要在名单里刚好标一位「得主」。没标：现场会照逐一揭晓；标了几位：只算第一位。到「奖项编辑」改。',
    nom.map(([a, k]) => [ckWhere(a), k ? `标了 ${k} 位得主` : '还没标得主']), '入围揭晓的奖项都标好了得主');
  // 9 字体：活动资料、图片导出设计、海报写了 file:文件名，但 data/fonts/ 里没有（换电脑、用空模版时常见；会悄悄变回默认字体）
  const have = new Set(fonts.map(ckLow)), need = new Map();
  const want = (v, where) => { const m = String(v || '').match(/^file:(.+)$/); if (m && !have.has(ckLow(m[1]))) need.set(m[1], [...(need.get(m[1]) || []), where]); };
  want(ev.fontTitle, '活动资料 · 中文字体'); want(ev.fontText, '活动资料 · 英文 / 数字字体');
  for (const [k, e] of Object.entries(xs?.elems || {})) want(e?.font, '图片导出 · ' + ((EX_ELEMS.find(x => x[0] === k) || [])[1] || k));
  want(po?.font, '海报 · 标题字体');
  add('字体文件找不到', '设置里指定的字体文件不在 data/fonts/：大屏、导出会改用默认字体。到「奖项编辑 → 字体」重新上传，或改用系统字体。',
    [...need].map(([f, w]) => [f, [...new Set(w)].join('、')]), '指定的字体文件都在');
  // 10 海报：选了、但名单里已经没有的奖项（例：删掉了奖项）
  const ids = new Set(awards.map(a => a.id)), lost = [];
  for (const p of Array.isArray(po?.posters) ? po.posters : []) {
    const k = (Array.isArray(p?.ids) ? p.ids : []).filter(id => !ids.has(String(id))).length;
    if (k) lost.push([String(p.name || '海报'), `${k} 个奖项已经不在名单里（导出时会少掉）`]);
  }
  add('海报的奖项', '海报选的奖项在名单里找不到了（删掉了，或用「替换全部奖项」导入时名称改了）。到「海报导出」重新勾选。', lost, '海报选的奖项都在');
}

function ckShow(list) {
  const bad = list.filter(x => x.rows.length);
  $('ckSum').textContent = bad.length ? `${bad.length} 项要看一下（共 ${bad.reduce((t, x) => t + x.rows.length, 0)} 条）` : '全部通过';
  $('ckSum').className = bad.length ? 'dirty' : 'muted';
  $('ckNote').textContent = '只把问题列出来，不会改名单或文件。改好以后按「重新检查」。' + (dirty ? '　⚠ 奖项编辑里有没保存的修改：这里查的是已保存的名单。' : '');
  $('ckList').replaceChildren(...list.map(x => el('section', { class: 'ck' + (x.rows.length ? ' bad' : ' ok') },
    el('h3', {}, el('span', { class: 'ckmark' }, x.rows.length ? '⚠' : '✓'), x.title, el('span', { class: 'muted' }, x.rows.length ? `　${x.rows.length} 条` : `　${x.okText}`)),
    x.rows.length || x.title === '奖项名素材' || x.title === socL() + '查不到' ? el('p', { class: 'muted' }, x.tip) : null,
    x.rows.length ? el('ul', {}, x.rows.slice(0, 300).map(([a, b]) => el('li', {}, el('b', {}, a), b ? el('span', { class: 'muted' }, '　' + b) : null)),
      x.rows.length > 300 ? el('li', { class: 'muted' }, `……还有 ${x.rows.length - 300} 条`) : null) : null)));
}
$('bCkRun').onclick = ckRun;
