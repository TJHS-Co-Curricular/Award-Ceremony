/*
 * 输出页外壳（/display 默认打开的就是它；网址加 &renew=0 就不用外壳）。
 * 为什么：OBS 内置浏览器开了硬件加速时（尤其是 AMD 内置显卡），揭晓越多，显卡内存就越多、不会还回来，最后把整台电脑的内存吃光。
 * 做法：真正的画面放在 iframe 里。画面用了一段时间（「效果控制 → 输出页自动换新」，默认 3 分钟）之后，
 *   等到画面停在待机 / 奖项标题 / 黑屏、而且几秒内没变，就在后面悄悄载入一份新的；新的准备好、显示一样的东西时，
 *   旧的淡出 1.2 秒后整个丢掉（连同它占用的显卡内存）。观众看不出来，不会黑屏、不会闪。
 *   换新期间现场一有动作（例如开始揭晓），就放弃这次，下次再换。
 * 需要：display.html 里的 renewOk() / renewKey() / renewMinutes()（js/display/main.js）
 */
'use strict';

(() => {
  const qs = location.search.replace(/^\?/, '');
  const src = '/display?' + (qs ? qs + '&' : '') + 'inner=1';
  let n = 0, next = null, nextBorn = 0, born = Date.now(), cur = make(2);

  function make(z) {
    const f = document.createElement('iframe');
    f.src = src + '&gen=' + (n++);
    f.allow = 'fullscreen';
    f.style.zIndex = z;
    document.body.appendChild(f);
    return f;
  }
  function drop(f) { try { f.src = 'about:blank'; } catch {} setTimeout(() => f.remove(), 200); }
  const win = f => { try { return f.contentWindow; } catch { return null; } };
  const call = (f, fn) => { try { return win(f)?.[fn]?.(); } catch { return undefined; } };

  setInterval(() => {
    const mins = call(cur, 'renewMinutes');
    if (next) {
      if (!call(cur, 'renewOk')) { drop(next); next = null; return; }   // 现场有动作了：这次放弃
      const ready = call(next, 'renewOk') && call(next, 'renewKey') === call(cur, 'renewKey') && Date.now() - nextBorn > 3000;
      if (ready) swap();
      else if (Date.now() - nextBorn > 30000) { drop(next); next = null; }   // 新的一直没准备好：放弃
      return;
    }
    if (mins > 0 && Date.now() - born > mins * 60000 && call(cur, 'renewOk')) {
      next = make(1); nextBorn = Date.now();   // 放在旧画面后面载入
    }
  }, 1000);

  function swap() {
    const old = cur;
    cur = next; next = null; born = Date.now();
    old.style.transition = 'opacity 1.2s ease';
    old.style.opacity = '0';
    setTimeout(() => { drop(old); cur.style.zIndex = 2; }, 1400);
  }
})();
