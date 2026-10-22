(()=>{const T=[['./','🏠','홈','home'],['./#map','🗺️','지도','map'],['rank.html','🏆','순위','rank'],['spend.html#sole','🔍','추적파일','sole'],['spend.html#fest','🎪','축제·보조금','fest']];
const pg=document.body.dataset.page||'home';
let act=k=>{const h=location.hash;return pg==='spend'?(k==='fest'?/fest|subsidy|exp|pay/.test(h):k==='sole'&&!/fest|subsidy|exp|pay/.test(h)):pg==='rank'?k==='rank':(pg==='home'||pg==='index')?(k==='map'?h==='#map':k==='home'&&h!=='#map'):false};
const n=document.createElement('nav');n.className='tabbar';n.innerHTML=T.map(([u,i,l,k])=>`<a href="${u}" data-k="${k}" class="${act(k)?'on':''}"><span>${i}</span>${l}</a>`).join('');
document.body.appendChild(n);document.body.classList.add('has-tabbar');
n.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;n.querySelectorAll('a').forEach(x=>x.classList.toggle('on',x===a))});
const s=document.createElement('style');s.textContent=`.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:1000;display:flex;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);border-top:1px solid #8883;padding:4px 4px calc(4px + env(safe-area-inset-bottom))}
.tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;font-size:11px;color:#666;text-decoration:none;padding:4px 0;border-radius:10px}
.tabbar a span{font-size:20px;filter:grayscale(1);opacity:.7}.tabbar a.on{color:#111;font-weight:700}.tabbar a.on span{filter:none;opacity:1}
body.has-tabbar{padding-bottom:calc(64px + env(safe-area-inset-bottom))}
@media(prefers-color-scheme:dark){.tabbar{background:rgba(0,0,0,.9)}.tabbar a{color:#999}.tabbar a.on{color:#fff}}
@media(min-width:900px){.tabbar{max-width:520px;margin:0 auto;bottom:12px;border:1px solid #8883;border-radius:18px}}`;document.head.appendChild(s);
window.addEventListener('hashchange',()=>n.querySelectorAll('a').forEach(a=>a.classList.toggle('on',act(a.dataset.k))));})();
