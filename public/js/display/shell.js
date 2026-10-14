/*
 * 输出页外壳（/display 默认打开的就是它；网址加 &renew=0 就不用外壳）。
 * 为什么：OBS 内置浏览器开了硬件加速时（尤其是 AMD 内置显卡），揭晓越多，显卡内存就越多、不会还回来，最后把整台电脑的内存吃光。
 *   只有把整份网页丢掉，那些显卡内存才会释放。
 * 做法：真正的画面放在 iframe 里（display.html?inner=1）。到时候了（「效果控制 → 输出页」：每隔几分钟 / 每揭晓几次），
 *   就在旧画面后面载入一份新的。新的一样连着服务端、跟着现场走（揭晓也会跟着动）；
 *   等到两份显示同一个画面、而且都「停好」了（动画、闪光、照片都画完），旧的淡出 1.2 秒后整个丢掉。
 *   所以「先一后全」一位一位揭晓时，也会在两位之间悄悄换掉，观众看不出来，不会黑屏、不会闪。
 * 需要：display.html 里的 renewOk / renewKey / renewCount / renewMinutes / renewEvery（js/display/main.js）
 */
'use strict';

(() => {
  const qs = location.search.replace(/^\?/, '');
  const src = '/display?' + (qs ? qs + '&' : '') + 'inner=1';
  let n = 0, next = null, nextBorn = 0, born = Date.now(), wait = 0, cur = make(2);

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
    if (next) {
      const same = call(next, 'renewKey') && call(next, 'renewKey') === call(cur, 'renewKey');
      if (same && call(cur, 'renewOk') && call(next, 'renewOk')) swap();
      else if (Date.now() - nextBorn > 90000) { drop(next); next = null; wait = Date.now() + 10000; }   // 一直对不上：放弃，10 秒后再试
      return;
    }
    if (Date.now() < wait) return;
    const mins = call(cur, 'renewMinutes'), every = call(cur, 'renewEvery');
    const due = (mins > 0 && Date.now() - born > mins * 60000) || (every > 0 && call(cur, 'renewCount') >= every);
    if (due) { next = make(1); nextBorn = Date.now(); }   // 放在旧画面后面载入
  }, 250);

  function swap() {
    const old = cur;
    cur = next; next = null; born = Date.now();
    old.style.transition = 'opacity 1.2s ease';
    old.style.opacity = '0';
    setTimeout(() => { drop(old); cur.style.zIndex = 2; }, 1400);
  }
})();
