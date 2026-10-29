// 지역 바꾸기: 85개 시를 시·도별로 묶은 검색 목록(바텀시트). 최근 본 지역만 이 기기에 저장.
(()=>{let C=null;const P=fetch('data/index.json').then(r=>r.json()).then(d=>{C=d.cities;window.CITY_FULL=Object.fromEntries(C.map(c=>[c.slug,c.name]));return C;}).catch(()=>[]);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rec=()=>{try{return JSON.parse(localStorage.getItem('mt-recent')||'[]')}catch(e){return[]}};
const push=s=>{try{localStorage.setItem('mt-recent',JSON.stringify([s,...rec().filter(x=>x!==s)].slice(0,5)))}catch(e){}};
window.regionRemember=push;
window.regionPicker=async(cur,onPick)=>{await P;if(!C)return;document.querySelectorAll('.rsheet').forEach(x=>x.remove());
 const me=C.find(c=>c.slug===cur);const sh=document.createElement('div');sh.className='rsheet';
 sh.innerHTML=`<div class="rs-bg"></div><div class="rs-box" role="dialog" aria-label="다른 지역 고르기"><div class="rs-top"><b>다른 지역</b><button type="button" class="rs-x" aria-label="닫기">닫기</button></div><input type="search" class="rs-q" placeholder="시 이름 검색 (예: 대구)" aria-label="시 이름 검색"><div class="rs-list"></div></div>`;
 document.body.appendChild(sh);const L=sh.querySelector('.rs-list'),q=sh.querySelector('.rs-q');
 const close=()=>sh.remove();sh.querySelector('.rs-bg').onclick=close;sh.querySelector('.rs-x').onclick=close;
 const btn=c=>`<button type="button" data-s="${c.slug}" class="${c.slug===cur?'on':''}">${esc(c.name)}<small>${esc(c.province.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/,''))}</small></button>`;
 const draw=()=>{const t=q.value.trim().replace(/\s/g,'');let h='';
  if(t){h=C.filter(c=>(c.province+c.name+c.short).replace(/\s/g,'').includes(t)).map(btn).join('')||'<p class="small">찾는 시가 없어요. 주요 85개 시만 추적해요.</p>';}
  else{const r=rec().map(s=>C.find(c=>c.slug===s)).filter(c=>c&&c.slug!==cur);if(r.length)h+=`<h4>최근 본 지역</h4><div class="rs-g">${r.map(btn).join('')}</div>`;
   if(me)h+=`<h4>같은 ${esc(me.province)}</h4><div class="rs-g">${C.filter(c=>c.province===me.province).map(btn).join('')}</div>`;
   const g={};C.forEach(c=>(g[c.province]||=[]).push(c));for(const [p,a] of Object.entries(g))if(!me||p!==me.province)h+=`<h4>${esc(p)}</h4><div class="rs-g">${a.map(btn).join('')}</div>`;}
  L.innerHTML=h;};
 q.oninput=draw;draw();L.onclick=e=>{const b=e.target.closest('button[data-s]');if(!b)return;push(b.dataset.s);close();onPick(b.dataset.s);};};
// city.html 상단 지역 바
window.regionBar=async(cur,go)=>{await P;const me=C&&C.find(c=>c.slug===cur);if(!me)return;push(cur);
 const same=C.filter(c=>c.province===me.province),i=same.indexOf(me);const pv=same[(i-1+same.length)%same.length],nx=same[(i+1)%same.length];
 let bar=document.getElementById('rbar');if(!bar){bar=document.createElement('div');bar.id='rbar';bar.className='rbar';const sb=document.querySelector('.stickybar');sb.after(bar);}
 bar.innerHTML=(same.length>1?`<button type="button" class="rb-a" aria-label="이전 지역 ${esc(pv.name)}">‹</button>`:'')+`<button type="button" class="rb-n">${esc(me.name)} <span>▾</span></button>`+(same.length>1?`<button type="button" class="rb-a" aria-label="다음 지역 ${esc(nx.name)}">›</button>`:'');
 const a=bar.querySelectorAll('.rb-a');if(a[0])a[0].onclick=()=>go(pv.slug);if(a[1])a[1].onclick=()=>go(nx.slug);
 bar.querySelector('.rb-n').onclick=()=>regionPicker(cur,go);
 if(same.length>1)[bar,document.querySelector('.hero')].forEach(el=>{if(!el)return;let x0=null,y0=0;el.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY},{passive:true});
  el.addEventListener('touchend',e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;x0=null;if(Math.abs(dx)>70&&Math.abs(dy)<50){document.body.classList.add(dx<0?'swl':'swr');setTimeout(()=>go(dx<0?nx.slug:pv.slug),120);}},{passive:true});});};
})();
