/*
 * 输出页外壳（/display 默认打开的就是它；网址加 &renew=0 就不用外壳）。
 * 为什么：OBS 内置浏览器开了硬件加速时（尤其是 AMD 内置显卡），揭晓越多，显卡内存就越多、不会还回来，最后把整台电脑的内存吃光。
 *   只有把整份网页丢掉，那些显卡内存才会释放。
 * 做法：真正的画面放在 iframe 里（display.html?inner=1）。到时候了（「效果控制 → 输出页」：每隔几分钟 / 每揭晓几次），
 *   就在旧画面后面载入一份新的。新的一样连着服务端、跟着现场走（揭晓也会跟着动）；
 *   等到两份显示同一个画面、而且都「停好」了（动画、闪光、照片都画完），新的移到最上面淡入 1.2 秒，旧的再整个丢掉（见 swap()）。
 *   所以「先一后全」一位一位揭晓时，也会在两位之间悄悄换掉，观众看不出来，不会黑屏、不会闪。
 * 大会背景 = 透明时（bgClearOn()，js/display/bgimg.js）外壳也透明；后面载入中的新画面先设成完全透明，免得透过上面那份看到两层字。
 * 需要：display.html 里的 renewOk / renewKey / renewCount / renewMinutes / renewEvery（js/display/main.js）、bgClearOn（bgimg.js）
 */
'use strict';

(() => {
  const qs = location.search.replace(/^\?/, '');
  const src = '/display?' + (qs ? qs + '&' : '') + 'inner=1';
  let n = 0, next = null, nextBorn = 0, born = Date.now(), wait = 0, base = 0, cur = make(2);   // base：换上来那一刻新画面已经数到的揭晓次数

  function make(z) {
    const f = document.createElement('iframe');
    f.src = src + '&gen=' + (n++);
    f.allow = 'fullscreen';
    f.style.zIndex = z;
    document.body.appendChild(f);
    return f;
  }
  function drop(f) { try { f.src = 'about:blank'; } catch {} setTimeout(() => f.remove(), 200); }
  const call = (f, fn) => { try { return f.contentWindow?.[fn]?.(); } catch { return undefined; } };

  setInterval(() => {
    const clear = call(cur, 'bgClearOn') === true;
    document.documentElement.classList.toggle('clear', clear);
    if (next && clear && next.style.zIndex === '1') next.style.opacity = '0';
    if (next) {
      const same = call(next, 'renewKey') && call(next, 'renewKey') === call(cur, 'renewKey');
      if (same && call(cur, 'renewOk') && call(next, 'renewOk')) swap();
      else if (Date.now() - nextBorn > 90000) { drop(next); next = null; wait = Date.now() + 10000; }   // 一直对不上：放弃，10 秒后再试
      return;
    }
    if (Date.now() < wait) return;
    const mins = call(cur, 'renewMinutes'), every = call(cur, 'renewEvery');
    const due = (mins > 0 && Date.now() - born > mins * 60000) || (every > 0 && call(cur, 'renewCount') - base >= every);
    if (due) { next = make(1); nextBorn = Date.now(); }   // 放在旧画面后面载入
  }, 250);

  // 新的放到最上面「淡入」，不是把旧的淡出、露出后面的新画面：
  // 藏在后面的 iframe，OBS / Chrome 可能不再画它，画面停在载入时那一刻（例：合影画面）；直接露出来会闪一下旧画面（2026-11-18 现场反映）。
  // 所以先把新的放在最上面、几乎透明，让它真的画几帧，再淡入；淡入完才丢掉旧的。
  function swap() {
    const old = cur, nw = next;
    cur = nw; next = null; born = Date.now(); wait = born + 2000;   // 淡入完之前不载入下一份
    base = call(nw, 'renewCount') || 0;   // 它在后面等的时候也在数揭晓次数：从现在重新算，免得一换上来又马上要换
    nw.style.transition = 'none'; nw.style.opacity = '0.01'; nw.style.zIndex = 3;
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
      nw.style.transition = 'opacity 1.2s ease'; nw.style.opacity = '1';
      setTimeout(() => { drop(old); nw.style.zIndex = 2; nw.style.transition = ''; }, 1400);
    }, 200)));
  }
})();
