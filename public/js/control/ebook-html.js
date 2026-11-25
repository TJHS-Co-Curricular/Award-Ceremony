/*
 * 控制端 · 电子书（四）翻书网页（1.95 从 ebook.js 拆出来，内容不变）：ebHtml(book) 返回一个完整的离线 .html（样式 + 每页图片 + 翻页程序），
 * 什么都不用连，双击就能看。这里只是一个大字符串模板，跟控制端的其它代码没有关系。
 * 需要：没有（book = { title, w, h, pages, caps, toc, icon } 由 ebook.js 的 ebExport() 准备）
 */
'use strict';
/* ---- 电子书网页本身（一个文件，什么都不用连） ----
 * 电脑（横的屏幕）：两页摊开，翻页时右页绕书脊翻到左边，像真的书；封面单独在右边。手机（竖的屏幕）：一次一页。
 * 结构（用户 2026-11-23：打开更快、可以放大、整理结构）：
 *   head（样式、分享信息、图标）→ <main> 里先放封面 <img>（文件一边读一边就先看到封面）→ 工具栏 / 目录 / 放大层
 *   → 每页一个 <script type="text/plain" class="pd">（只是文字，不当程序跑，打开时不用编译几十 MB 的脚本）→ 最后才是翻页程序。
 * 只解码前后几页的图片，几百页也不会卡。没有打印按钮（用户 2026-11-23：要 PDF 用控制端的「导出 PDF」）。 */
function ebHtml(book) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const N = book.pages.length, desc = `${book.title} · 纪念特刊（共 ${N} 页）`;
  const meta = JSON.stringify({ w: book.w, h: book.h, caps: book.caps, toc: book.toc }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(book.title)} · 纪念特刊</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(book.title)} · 纪念特刊"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="book">
<meta name="theme-color" content="${thC('#1d1a17')}">
${book.icon ? `<link rel="icon" href="${book.icon}">` : ''}
<style>
:root{--bg:${thC('#2a2622')};--bar:${thC('#1d1a17')};--gold:${thC('#d2b067')};--text:${thC('#efe6d2')};--muted:${thC('#a59a83')};--paper:${EB_C.paper};--btn:${thC('#2c2823')};--btn-line:${thC('rgba(210,176,103,.45)')};--dur:.9s;--ease:cubic-bezier(.2,.7,.2,1)}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--bg);color:var(--text);font-family:"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif;overflow:hidden;-webkit-tap-highlight-color:transparent}
#stage{position:fixed;inset:0 0 56px 0;display:flex;align-items:center;justify-content:center}
#pre{max-width:96%;max-height:94%;box-shadow:0 14px 50px rgba(0,0,0,.5);background:var(--paper)}
#load{position:fixed;left:0;right:0;bottom:64px;text-align:center;color:var(--muted);font-size:13px}
#book{position:relative;perspective:3200px;transition:transform .6s var(--ease);cursor:pointer;user-select:none}
.pg,.leaf{position:absolute;top:0;height:100%;transform-origin:0 50%;transition:transform var(--dur) cubic-bezier(.45,.05,.25,1)}
.pg{left:0;width:100%;background:var(--paper);box-shadow:0 14px 50px rgba(0,0,0,.5);backface-visibility:hidden;-webkit-backface-visibility:hidden}
.pg.f{transform:rotateY(-170deg)}
.leaf{left:50%;width:50%;transform-style:preserve-3d}
.leaf.f{transform:rotateY(-180deg)}
.face{position:absolute;inset:0;background:var(--paper);backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden;box-shadow:0 14px 50px rgba(0,0,0,.45)}
.face.back{transform:rotateY(180deg)}
.face::after{content:"";position:absolute;top:0;bottom:0;width:7%;pointer-events:none}
.face.front::after{left:0;background:linear-gradient(90deg,rgba(0,0,0,.16),rgba(0,0,0,0))}
.face.back::after{right:0;background:linear-gradient(270deg,rgba(0,0,0,.16),rgba(0,0,0,0))}
.pg img,.face img{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none}
.far{display:none}
#book.nt,#book.nt .pg,#book.nt .leaf{transition:none}
#bar{position:fixed;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;gap:8px;padding:0 max(12px,env(safe-area-inset-left));background:var(--bar);border-top:1px solid ${thC('rgba(210,176,103,.25)')};z-index:10}
#bar button{background:var(--btn);color:var(--text);border:1px solid var(--btn-line);border-radius:8px;height:38px;min-width:42px;padding:0 12px;font-size:15px;cursor:pointer;white-space:nowrap}
#bar button:disabled{opacity:.35;cursor:default}
#bar button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
#bar #num{background:none;border-color:transparent;color:var(--gold);font-size:14px;padding:0 6px}
#cap{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:14px;text-align:center}
.zo{display:none}
body.zoom .zo{display:inline-block}body.zoom .nz{display:none}
#toc{position:fixed;inset:0 0 56px 0;background:${thC('rgba(29,26,23,.97)')};overflow:auto;padding:24px max(16px,env(safe-area-inset-left));display:none;z-index:6}
#toc.on{display:block}
#toc h2{margin:0 0 14px;color:var(--gold);font-size:20px;text-align:center}
#toc a{display:flex;gap:10px;padding:9px 12px;border-radius:6px;color:var(--text);text-decoration:none;max-width:760px;margin:0 auto}
#toc a:hover,#toc a:focus-visible{background:${thC('rgba(210,176,103,.12)')};outline:none}
#toc a span{flex:1}
#toc a i{font-style:normal;color:var(--muted);font-size:13px}
#toc .l-1{color:var(--gold);font-weight:800;font-size:21px;margin-top:22px;letter-spacing:.06em}
#toc .l0{color:var(--gold);font-weight:700;font-size:18px;margin-top:12px}
#toc a.in{margin-left:22px}
#toc .l1{font-weight:700;padding-left:28px}
#toc .l2{padding-left:48px;font-size:15px}
#toc .l3{padding-left:28px;font-size:15px}
#zoom{position:fixed;inset:0 0 56px 0;background:var(--bg);overflow:auto;z-index:5;display:none;cursor:grab;-webkit-overflow-scrolling:touch}
body.zoom #zoom{display:flex}
#zoom.drag{cursor:grabbing}
#zin{display:flex;gap:6px;margin:auto;padding:12px}
#zin img{display:block;flex:none;background:var(--paper);box-shadow:0 8px 30px rgba(0,0,0,.45);user-select:none;-webkit-user-drag:none}
@media (prefers-reduced-motion:reduce){:root{--dur:0s}#book{transition:none}}
@media (max-width:600px){#bar{gap:5px}#bar button{padding:0 9px;min-width:38px}#cap,#bFull{display:none}#bar #num{flex:1}}
</style></head><body>
<main id="stage" aria-label="电子书"><img id="pre" alt="${esc(book.caps[0] || '封面')}" src="${book.pages[0]}"></main>
<div id="load" role="status">载入中…</div>
<nav id="toc" aria-label="目录"><h2>${esc(book.title)}</h2><div id="tocList"></div></nav>
<div id="zoom" aria-label="放大查看"><div id="zin"></div></div>
<div id="bar" role="toolbar" aria-label="翻页工具">
  <button id="bToc" class="nz" aria-expanded="false" aria-controls="toc">目录</button>
  <button id="bPrev" aria-label="上一页">◀</button>
  <button id="num" title="跳到第几页" aria-live="polite"></button>
  <button id="bNext" aria-label="下一页">▶</button>
  <span id="cap" class="nz"></span>
  <button id="bZout" class="zo" aria-label="缩小">－</button>
  <button id="bZin" class="zo" aria-label="放大">＋</button>
  <button id="bZoom" title="放大查看（键盘 Z）">放大</button>
  <button id="bFull" class="nz">全屏</button>
</div>
<noscript><p style="position:fixed;top:40%;left:0;right:0;text-align:center">这本电子书要开启 JavaScript 才能翻页。请用 Chrome、Edge 或 Safari 打开。</p></noscript>
${book.pages.slice(1).map(p => `<script type="text/plain" class="pd">${p}</script>`).join('\n')}
<script>
(function(){"use strict";
var B=${meta};
var PAGES=[document.getElementById("pre").src];
[].forEach.call(document.querySelectorAll("script.pd"),function(e){PAGES.push(e.textContent);e.parentNode.removeChild(e);});
var N=PAGES.length,stage=document.getElementById("stage"),book=document.createElement("div");book.id="book";
var mode=0,cur=0,s=0,L=Math.ceil(N/2),SMAX=N%2?L-1:L,items=[],moving=null;
function byId(id){return document.getElementById(id);}
function setImg(im,i,on){if(i<0||i>=N){return;}if(on&&!im.getAttribute("src")){im.src=PAGES[i];im.alt=B.caps[i]||("第 "+(i+1)+" 页");}else if(!on&&im.getAttribute("src"))im.removeAttribute("src");}
function want(){return stage.clientWidth>stage.clientHeight*1.1?2:1;}
function build(){
  var p=mode===2?Math.max(0,2*s-1):cur;mode=want();book.innerHTML="";items=[];book.style.transform="";
  if(mode===1){cur=p;for(var i=0;i<N;i++){var d=document.createElement("div");d.className="pg";d.style.zIndex=N-i;d.appendChild(document.createElement("img"));book.appendChild(d);items.push(d);}}
  else{s=Math.min(SMAX,Math.floor((p+1)/2));for(var k=0;k<L;k++){var lf=document.createElement("div");lf.className="leaf";
    var f=document.createElement("div");f.className="face front";f.appendChild(document.createElement("img"));
    var b=document.createElement("div");b.className="face back";b.appendChild(document.createElement("img"));
    lf.appendChild(f);lf.appendChild(b);book.appendChild(lf);items.push(lf);}}
  book.classList.add("nt");fit();paint();void book.offsetWidth;book.classList.remove("nt");
}
function fit(){var W=stage.clientWidth*.96,H=stage.clientHeight*.94,k=Math.min(W/(B.w*mode),H/B.h);book.style.width=Math.floor(B.w*mode*k)+"px";book.style.height=Math.floor(B.h*k)+"px";}
function shown(){if(mode===1)return[cur];var a=Math.max(0,2*s-1),b=Math.min(N-1,2*s);if(s===L)b=a;return a===b?[a]:[a,b];}
function paint(){
  if(mode===1){
    for(var i=0;i<N;i++){var d=items[i],near=i>=cur-2&&i<=cur+2;d.classList.toggle("f",i<cur);d.classList.toggle("far",!near);setImg(d.firstChild,i,near);}
    byId("bPrev").disabled=cur<=0;byId("bNext").disabled=cur>=N-1;
  }else{
    for(var k=0;k<L;k++){var lf=items[k],near2=k>=s-3&&k<=s+2;lf.classList.toggle("f",k<s);lf.classList.toggle("far",!near2);
      if(lf!==moving)lf.style.zIndex=k<s?k+1:L-k+1;
      setImg(lf.firstChild.firstChild,2*k,near2);setImg(lf.lastChild.firstChild,2*k+1,near2);}
    book.style.transform=s===0?"translateX(-25%)":(s===L&&N%2===0?"translateX(25%)":"");
    byId("bPrev").disabled=s<=0;byId("bNext").disabled=s>=SMAX;
  }
  var v=shown(),first=v[0],last=v[v.length-1];
  byId("num").textContent=(first===last?"第 "+(first+1):"第 "+(first+1)+"–"+(last+1))+" / "+N+" 页";
  var c=[B.caps[first],B.caps[last]].filter(function(x,i,a){return x&&a.indexOf(x)===i;});byId("cap").textContent=c.join(" ｜ ");
  try{history.replaceState(null,"","#"+(first+1));}catch(e){}
  if(zk)zshow(true);
}
function step(d){
  if(mode===1){var n=Math.max(0,Math.min(N-1,cur+d));if(n!==cur){cur=n;paint();}return;}
  var t=Math.max(0,Math.min(SMAX,s+d));if(t===s)return;
  var lf=items[d>0?s:s-1];moving=lf;lf.style.zIndex=L+10;s=t;paint();
  setTimeout(function(){if(moving===lf){moving=null;paint();}},950);
}
function jump(p){book.classList.add("nt");moving=null;if(mode===1)cur=p;else s=Math.min(SMAX,Math.floor((p+1)/2));paint();void book.offsetWidth;book.classList.remove("nt");}
/* 放大查看：目前看到的一页（两页摊开时两页并排），按 ＋ － 换倍数；电脑用鼠标拖、手机用手指滑动 */
var ZK=[1.5,2,3,4],zk=0,zoom=byId("zoom"),zin=byId("zin");
function zshow(keep){
  var cx=.5,cy=.5;if(keep&&zin.scrollWidth){cx=(zoom.scrollLeft+zoom.clientWidth/2)/zin.scrollWidth;cy=(zoom.scrollTop+zoom.clientHeight/2)/zin.scrollHeight;}
  var v=shown(),base=Math.min(zoom.clientWidth*.96/(B.w*v.length),zoom.clientHeight*.94/B.h),w=Math.round(B.w*base*zk);
  zin.innerHTML="";v.forEach(function(i){var im=document.createElement("img");im.src=PAGES[i];im.alt=B.caps[i]||("第 "+(i+1)+" 页");im.draggable=false;im.style.width=w+"px";zin.appendChild(im);});
  zoom.scrollLeft=cx*zin.scrollWidth-zoom.clientWidth/2;zoom.scrollTop=cy*zin.scrollHeight-zoom.clientHeight/2;
  byId("bZout").disabled=zk<=ZK[0];byId("bZin").disabled=zk>=ZK[ZK.length-1];
}
function zset(k){var was=zk;zk=k;document.body.classList.toggle("zoom",!!zk);byId("bZoom").textContent=zk?"退出放大":"放大";
  if(zk){toc.classList.remove("on");zshow(!!was);}else zin.innerHTML="";}
function zstep(d){if(!zk)return;var i=ZK.indexOf(zk)+d;if(i>=0&&i<ZK.length)zset(ZK[i]);}
var dg=null;
zoom.addEventListener("pointerdown",function(e){if(e.pointerType!=="mouse")return;dg={x:e.clientX,y:e.clientY,l:zoom.scrollLeft,t:zoom.scrollTop};zoom.classList.add("drag");});
window.addEventListener("pointermove",function(e){if(!dg)return;zoom.scrollLeft=dg.l-(e.clientX-dg.x);zoom.scrollTop=dg.t-(e.clientY-dg.y);});
window.addEventListener("pointerup",function(){dg=null;zoom.classList.remove("drag");});
zoom.addEventListener("wheel",function(e){if(e.ctrlKey){e.preventDefault();zstep(e.deltaY<0?1:-1);}},{passive:false});
byId("bZoom").onclick=function(){zset(zk?0:2);};byId("bZin").onclick=function(){zstep(1);};byId("bZout").onclick=function(){zstep(-1);};
book.onclick=function(e){var r=book.getBoundingClientRect();step(e.clientX-r.left>r.width/2?1:-1);};
book.ondblclick=function(e){e.preventDefault();};
byId("bPrev").onclick=function(){step(-1);};byId("bNext").onclick=function(){step(1);};
byId("num").onclick=function(){var v=prompt("跳到第几页？（1 ~ "+N+"）",shown()[0]+1),p=parseInt(v,10);if(p>=1&&p<=N)jump(p-1);};
byId("bFull").onclick=function(){var d=document.documentElement;if(document.fullscreenElement)document.exitFullscreen();else if(d.requestFullscreen)d.requestFullscreen();};
var toc=byId("toc"),bToc=byId("bToc");
function tocSet(on){toc.classList.toggle("on",on);bToc.setAttribute("aria-expanded",on?"true":"false");}
B.toc.forEach(function(t){var a=document.createElement("a");a.href="#"+(t.p+1);a.className="l"+t.l+(t.d?" in":"");var sp=document.createElement("span");sp.textContent=t.t;a.appendChild(sp);
  var n=document.createElement("i");n.textContent=(t.n?t.n+" 位 · ":"")+"第 "+(t.p+1)+" 页";a.appendChild(n);
  a.onclick=function(e){e.preventDefault();tocSet(false);jump(t.p);};byId("tocList").appendChild(a);});
bToc.onclick=function(){tocSet(!toc.classList.contains("on"));};
document.addEventListener("keydown",function(e){
  if(e.target&&e.target.tagName==="INPUT")return;
  if(e.key==="ArrowRight"||e.key==="PageDown"||e.key===" "){e.preventDefault();step(1);}
  else if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();step(-1);}
  else if(e.key==="Home")jump(0);else if(e.key==="End")jump(N-1);
  else if(e.key==="z"||e.key==="Z")zset(zk?0:2);
  else if(e.key==="+"||e.key==="=")zstep(1);else if(e.key==="-")zstep(-1);
  else if(e.key==="Escape"){if(zk)zset(0);else tocSet(false);}});
var sx=null,sy=0;
book.addEventListener("touchstart",function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
book.addEventListener("touchend",function(e){if(sx===null)return;var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;sx=null;
  if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){e.preventDefault();step(dx<0?1:-1);}});
window.addEventListener("resize",function(){if(want()!==mode)build();else fit();if(zk)zshow(true);});
var h=parseInt(location.hash.slice(1),10);if(h>0){cur=Math.min(N,h)-1;s=Math.min(SMAX,Math.floor(cur/2+.5));}
stage.innerHTML="";stage.appendChild(book);var ld=byId("load");ld.parentNode.removeChild(ld);
build();
})();
</script>
</body></html>`;
}
