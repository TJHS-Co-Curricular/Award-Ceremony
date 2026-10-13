/*
 * 控制端 · 界面开关：名单模糊、分页切换、离开前提醒未保存。
 */
'use strict';

/* 名单模糊 */
function setPrivacy(on) {
  document.body.classList.toggle('privacy', on);
  $('bPrivacy').textContent = on ? '🙈 名单模糊：开' : '👁 名单模糊：关';
  store.set('ac_privacy', on ? '1' : '0');
}
$('bPrivacy').onclick = () => setPrivacy(!document.body.classList.contains('privacy'));
setPrivacy(store.get('ac_privacy') !== '0');

/* 标签页 */
for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => {
  for (const x of document.querySelectorAll('.tabs button')) x.classList.toggle('on', x === b);
  for (const t of ['live', 'edit', 'export']) $(t).classList.toggle('hidden', b.dataset.tab !== t);
  if (b.dataset.tab === 'export') exOpen();
  if (b.dataset.tab === 'edit') { refreshPhotos(); refreshFonts(); }
};
addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
