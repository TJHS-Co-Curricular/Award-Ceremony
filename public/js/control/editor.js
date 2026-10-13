/*
 * 控制端 · 奖项编辑：草稿、活动标题、每个奖项的卡片（分类、名称、揭晓方式、获奖者文字框）、保存。
 * 获奖者每行一位：姓名 | 班级 | 学号 | 照片 | 备注 | 类型 | 得主（照片、类型、得主可放任意位置）。
 * 提供：loadDraft()、setDirty(d)、renderEditor()、makeWinner(...)
 */
'use strict';

function loadDraft() { draft = { event: clone(V.event), awards: clone(V.awards) }; setDirty(false); renderEditor(); }
function setDirty(d) { dirty = d; $('dirtyTxt').textContent = d ? '● 有未保存的修改' : '已保存'; $('dirtyTxt').className = d ? 'dirty' : 'muted'; }
const IS_PHOTO = x => /\.(jpe?g|png|webp|gif)$/i.test(x);
const WIN_MARK = /^(得主|winner|★|🏆)$/i, WIN_YES = /^(得主|winner|★|🏆|是|y|yes|1|✓|√|v)$/i;
const TYPE_TEAM = /^(团体|團體|团队|團隊|社团|集体|teams?|group)$/i, TYPE_PERSON = /^(个人|個人|person|individual)$/i;
// 把一行的各栏变成获奖者：照片按扩展名识别、类型按关键字（团体 / 个人）识别，都可放任意位置；其余依次是 班级、学号、备注
function makeWinner(name, rest, photo = '', type = '', win = '') {
  const r = [...rest];
  for (let k = r.length - 1; k >= 0; k--) if (WIN_MARK.test(r[k])) { win = win || r[k]; r.splice(k, 1); break; }
  for (let k = r.length - 1; k >= 0; k--) if (TYPE_TEAM.test(r[k]) || TYPE_PERSON.test(r[k])) { type = type || r[k]; r.splice(k, 1); break; }
  while (r.length && r[r.length - 1] === '') r.pop();
  if (!photo) {
    const k = r.findIndex(IS_PHOTO);
    if (k >= 0) photo = r.splice(k, 1)[0];
    else if (r.length >= 4) r.splice(2, 1);   // 班级、学号之后是照片栏；留空时去掉这一栏，备注才不会错位
  }
  const [cls = '', sid = '', detail = ''] = r;
  const w = { name };
  if (cls) w.cls = cls; if (sid) w.sid = sid; if (detail) w.detail = detail; if (photo) w.photo = photo;
  if (TYPE_TEAM.test(type)) w.type = 'team';
  if (WIN_YES.test(win)) w.win = true;
  return w;
}
const winnersToText = ws => ws.map(w => [w.name, w.cls || '', w.sid || '', w.photo || '', w.detail || '', w.type === 'team' ? '团体' : '', w.win ? '得主' : ''].join(' | ').replace(/( \| )+$/, '')).join('\n');
function textToWinners(t) {
  return t.split(/\r?\n/).map(l => l.split('|').map(x => x.trim())).filter(p => p[0]).map(([name, ...rest]) => makeWinner(name, rest));
}
function renderEditor() {
  if (!draft) return;
  $('evTitle').value = draft.event.title; $('evSub').value = draft.event.subtitle || '';
  $('evGroupIntro').checked = draft.event.groupIntro !== false;
  $('evPhotoKicker').checked = draft.event.photoKicker !== false;
  $('evStandbyFx').value = draft.event.standbyFx === 'goldriver' ? 'goldriver' : 'galaxy';
  exFillSel();
  renderFontUI();
  const groups = [...new Set(draft.awards.map(a => a.group).filter(Boolean))];
  const dl = $('groupList') || document.body.appendChild(el('datalist', { id: 'groupList' }));
  dl.replaceChildren(...groups.map(g => el('option', { value: g })));
  const box = $('elist'); box.textContent = '';
  draft.awards.forEach((a, i) => {
    const n = draft.awards.length;
    const move = d => { const j = i + d; if (j < 0 || j >= n) return; [draft.awards[i], draft.awards[j]] = [draft.awards[j], draft.awards[i]]; setDirty(true); renderEditor(); };
    const ta = el('textarea', { rows: Math.min(14, Math.max(3, a.winners.length + 1)), placeholder: '姓名 | 班级 | 学号 | 照片.jpg | 备注 | 类型（团体 / 个人） | 得主', class: 'secret' });
    ta.value = winnersToText(a.winners);
    const warn = el('span', { class: 'tag', style: 'border-color:var(--warn);color:#ffc98a' });
    const check = () => {   // 入围揭晓：必须刚好标 1 位「得主」
      const k = a.winners.filter(w => w.win).length;
      warn.textContent = k === 0 ? '⚠ 还没标「得主」，会按逐一揭晓处理' : k > 1 ? `⚠ 标了 ${k} 位得主，只算第一位` : '';
      warn.classList.toggle('hidden', a.revealMode !== 'nominee' || k === 1);
    };
    ta.addEventListener('input', () => { a.winners = textToWinners(ta.value); cnt.textContent = `${a.winners.length} 位`; check(); setDirty(true); });
    const cnt = el('span', { class: 'tag' }, `${a.winners.length} 位`);
    const ins = {};
    const inp = (key, ph, max = 160) => {
      const x = el('input', { placeholder: ph, maxlength: max }); x.value = a[key] || ''; ins[key] = x;
      x.addEventListener('input', () => { a[key] = x.value; setDirty(true); });
      const pair = { title: 'subtitle', group: 'groupSub' }[key];
      if (pair) x.addEventListener('change', () => {   // 「团体网站比赛Societies' Website Competition」→ 自动拆成中文 + 英文
        const sp = splitZhEn(x.value);
        if (sp && !a[pair]) { a[key] = x.value = sp[0]; a[pair] = ins[pair].value = sp[1]; setDirty(true); }
        if (key === 'group' && a.group && !a.groupSub) {   // 选了已有分类：带出它的英文
          const o = draft.awards.find(y => y !== a && y.group === a.group && y.groupSub);
          if (o) { a.groupSub = ins.groupSub.value = o.groupSub; setDirty(true); }
        }
      });
      return x;
    };
    const mode = el('select', {}, ...Object.entries(MODE_NAME).map(([v, t]) => el('option', { value: v }, t)));
    mode.value = a.revealMode; mode.onchange = () => { a.revealMode = mode.value; check(); setDirty(true); };
    check();
    box.append(el('div', { class: 'ecard' },
      el('div', { class: 'head' }, el('span', { class: 'no' }, `#${i + 1}`), cnt, warn, el('span', { class: 'sp' }),
        el('button', { onclick: () => move(-1), disabled: i === 0 ? '' : null }, '↑'),
        el('button', { onclick: () => move(1), disabled: i === n - 1 ? '' : null }, '↓'),
        el('button', { onclick: () => { if (confirm(`删除奖项「${a.title}」？`)) { draft.awards.splice(i, 1); setDirty(true); renderEditor(); } }, style: 'color:#ff9c9c' }, '删除')),
      el('div', { class: 'grid2', style: 'margin-bottom:10px' },
        el('label', { class: 'f' }, el('span', {}, '分类（可空；相邻且同名的奖项归为一类）'), (() => { const x = inp('group', '例如：成果汇报竞赛', 60); x.setAttribute('list', 'groupList'); return x; })()),
        el('label', { class: 'f' }, el('span', {}, '分类英文（可空）'), inp('groupSub', '例如：ANNUAL REPORT COMPETITIONS', 120))),
      (() => {   // 这一类的「01 / 02 / 03」编号：整组一起改（相邻同名的奖项）
        const x = el('input', { type: 'checkbox', style: 'width:auto' }); x.checked = !a.groupNoNum;
        x.onchange = () => {
          const L = draft.awards; let s = i, e = i;
          if (a.group) { while (s > 0 && L[s - 1].group === a.group) s--; while (e < L.length - 1 && L[e + 1].group === a.group) e++; }
          for (let k = s; k <= e; k++) { if (x.checked) delete L[k].groupNoNum; else L[k].groupNoNum = true; }
          setDirty(true); renderEditor();
        };
        return el('label', { style: 'display:flex;gap:8px;align-items:center;margin:-2px 0 10px;font-size:13px;color:var(--muted);cursor:pointer', title: '分类标题画面的 01 / 02 / 03，以及奖项画面上方的「奖项 02」' }, x, '这个分类显示奖项编号（01 / 02 / 03）', a.group ? null : el('span', {}, '（要先填分类）'));
      })(),
      el('div', { class: 'row3' },
        el('label', { class: 'f' }, el('span', {}, '奖项名称'), inp('title', '例如：学业优异奖（可直接贴「中文English」）', 120)),
        el('label', { class: 'f' }, el('span', {}, '副标题（可空）'), inp('subtitle', '例如：Academic Excellence')),
        el('label', { class: 'f' }, el('span', {}, '揭晓方式'), mode)),
      el('label', { class: 'f' }, el('span', {}, '获奖者（每行一位）'), ta)));
  });
  if (!draft.awards.length) box.append(el('p', { class: 'muted' }, '还没有奖项，点上方「新增奖项」或用批量导入。'));
}
$('evTitle').addEventListener('input', e => { draft.event.title = e.target.value; setDirty(true); });
$('evSub').addEventListener('input', e => { draft.event.subtitle = e.target.value; setDirty(true); });
$('evGroupIntro').addEventListener('change', e => { draft.event.groupIntro = e.target.checked; setDirty(true); });
$('evPhotoKicker').addEventListener('change', e => { draft.event.photoKicker = e.target.checked; setDirty(true); });
$('evStandbyFx').addEventListener('change', e => { draft.event.standbyFx = e.target.value; setDirty(true); });
$('bAdd').onclick = () => { const last = draft.awards[draft.awards.length - 1] || {}; draft.awards.push({ group: last.group || '', groupSub: last.groupSub || '', title: '新奖项', subtitle: '', revealMode: 'one', winners: [] }); setDirty(true); renderEditor(); $('elist').lastChild?.scrollIntoView({ behavior: 'smooth' }); };
$('bRevert').onclick = () => { if (!dirty || confirm('放弃所有未保存的修改？')) loadDraft(); };
$('bSave').onclick = async () => {
  const live = V.state.mode === 'title' || V.state.mode === 'reveal';
  if (live && !confirm('颁奖正在进行中，保存会立即影响现场画面。继续？')) return;
  try { const r = await api('PUT', '/api/control/data', draft); V.awards = r.data.awards; V.event = r.data.event; loadDraft(); render(); toast('已保存'); log('保存奖项数据'); refreshPhotos(); }
  catch (err) { toast(err.message, true); }
};
