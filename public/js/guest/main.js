/*
 * 嘉宾揭晓页（手机）：显示当前奖项和已揭晓名单；主持人授权后，按住按钮 0.8 秒揭晓下一位。
 */
'use strict';

const K = new URLSearchParams(location.search).get('k') || '';
const $ = id => document.getElementById(id);
const HOLD = 800, C = 289.03;
let V = null, busy = false;

function render(v) {
  V = v;
  $('ev').textContent = v.event?.title || '';
  const onAward = (v.mode === 'title' || v.mode === 'reveal') && v.award;
  const grp = v.mode === 'group' && v.group, pho = v.mode === 'photo' && v.photo;
  $('k').textContent = onAward ? (v.award.group ? `${v.award.group} · 当前奖项` : '当前奖项') : grp ? '奖项类别' : pho ? '合影留念' : v.mode === 'message' ? '大屏消息' : '待机中';
  $('title').textContent = onAward ? v.award.title : grp ? v.group.title : pho ? (pho.group ? pho.group + ' - ' : '') + pho.title : v.mode === 'message' ? (v.message || '') : (v.event?.subtitle || '');
  $('sub').textContent = onAward ? (v.award.subtitle || '') : grp ? (v.group.sub || '') : '';

  const total = v.award?.total, shown = v.winners?.length || 0;
  const can = !!v.canPress && !busy;
  $('btn').disabled = !can;
  $('wrap').classList.toggle('ready', can);
  $('btn').querySelector('small').textContent = can ? '按住 1 秒' : '';
  const nom = !!v.award?.nominee, ph = v.award?.phase || '';
  const fa = v.award?.view;   // 先一后全
  const done = onAward && v.mode === 'reveal' && (fa ? !!v.award.done : nom ? ph === 'winner' : shown === total);
  $('hint').textContent = v.blackout ? '大屏已暂停' : can
    ? (v.mode === 'title' ? '主持人已授权，请按住按钮揭晓'
      : nom ? (shown < total ? `已介绍入围者 ${shown}/${total}，按住介绍下一位` : ph === 'suspense' ? '按住按钮，揭晓得主 🏆' : '按住按钮，进入「得主是……」')
      : fa && shown === total ? (fa.mode === 'all' ? '按住按钮，显示下一页' : '按住按钮，全部得奖者一起出现')
      : `已揭晓 ${shown}/${total}，按住揭晓下一位`)
    : (done ? (nom ? '得主已揭晓 🎉' : '本奖项已全部揭晓 🎉') : '等待主持人授权');

  const ol = $('list');
  if (v.mode === 'reveal' && shown) {
    $('listSec').hidden = false;
    while (ol.children.length > shown) ol.lastChild.remove();
    if (ol.dataset.award !== v.award.id) { ol.textContent = ''; ol.dataset.award = v.award.id; }
    for (let i = ol.children.length; i < shown; i++) {
      const w = v.winners[i], li = document.createElement('li');
      li.innerHTML = '<span class="i"></span><span class="n"></span><span class="d"></span>';
      li.children[0].textContent = i + 1; li.children[1].textContent = w.name;
      li.dataset.i = i; li.children[2].textContent = [w.cls, w.sid, w.detail].filter(Boolean).join(' · ');
      ol.appendChild(li);
    }
    for (const li of ol.children) li.children[1].textContent = (v.award.winnerIndex === +li.dataset.i ? '🏆 ' : '') + v.winners[+li.dataset.i].name;
  } else { $('listSec').hidden = true; ol.textContent = ''; ol.dataset.award = ''; }
}

/* 按住揭晓 */
let t0 = 0, raf = 0;
function setProg(f) { $('prog').style.strokeDashoffset = C * (1 - f); }
function start(e) {
  if ($('btn').disabled) return;
  e.preventDefault();
  t0 = performance.now(); $('btn').classList.add('pressing');
  navigator.vibrate?.(10);
  const step = now => {
    const f = Math.min(1, (now - t0) / HOLD); setProg(f);
    if (f >= 1) { finish(); return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
function cancel() { cancelAnimationFrame(raf); t0 = 0; $('btn').classList.remove('pressing'); setProg(0); }
async function finish() {
  cancel(); busy = true; render(V); navigator.vibrate?.([30, 40, 60]);
  try {
    const r = await fetch('/api/guest/reveal?k=' + encodeURIComponent(K), { method: 'POST', headers: { 'X-AC': '1' } });
    if (!r.ok) { const j = await r.json().catch(() => ({})); $('hint').textContent = j.error || '揭晓失败'; }
  } catch { $('hint').textContent = '网络错误，请重试'; }
  setTimeout(() => { busy = false; render(V); }, 1000);
}
const b = $('btn');
b.addEventListener('pointerdown', start);
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { if (t0) cancel(); });
addEventListener('contextmenu', e => e.preventDefault());

/* 屏幕常亮（支持的浏览器） */
let lock = null;
async function wake() { try { lock = await navigator.wakeLock?.request('screen'); } catch {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });
wake();

const es = new EventSource('/api/guest/stream?k=' + encodeURIComponent(K));
es.onopen = () => $('conn').classList.remove('show');
es.onmessage = e => render(JSON.parse(e.data));
es.onerror = () => $('conn').classList.add('show');
