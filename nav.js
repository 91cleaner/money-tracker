(()=>{const I={home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',map:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',rank:'<path d="M5 20V12M12 20V5M19 20v-9"/>',sole:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'};
const T=[['./','홈','home'],['./#map','지도','map'],['rank.html','순위','rank'],['spend.html','추적','sole']];
const pg=document.body.dataset.page||'home';
const act=k=>pg==='spend'?k==='sole':pg==='rank'?k==='rank':(pg==='home'||pg==='index')?(k==='map'?location.hash==='#map':k==='home'&&location.hash!=='#map'):false;
const n=document.createElement('nav');n.className='tabbar';n.innerHTML=T.map(([u,l,k])=>`<a href="${u}" data-k="${k}" class="${act(k)?'on':''}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>${l}</a>`).join('');
document.body.appendChild(n);document.body.classList.add('has-tabbar');
const s=document.createElement('style');s.textContent=`.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:1000;display:flex;background:rgba(7,9,12,.94);backdrop-filter:blur(12px);border-top:1px solid #1f2933;padding:6px 8px calc(6px + env(safe-area-inset-bottom))}
.tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;font:600 11px var(--sans);color:#6b7785;text-decoration:none;padding:4px 0;position:relative}
.tabbar a.on{color:#ffb020}.tabbar a.on::before{content:"";position:absolute;top:-7px;left:30%;right:30%;height:2px;background:#ffb020;border-radius:2px}
body.has-tabbar{padding-bottom:calc(68px + env(safe-area-inset-bottom))}
@media(min-width:900px){.tabbar{max-width:420px;margin:0 auto;bottom:12px;border:1px solid #1f2933;border-radius:16px;padding-bottom:6px}}`;document.head.appendChild(s);
addEventListener('hashchange',()=>n.querySelectorAll('a').forEach(a=>a.classList.toggle('on',act(a.dataset.k))));})();
