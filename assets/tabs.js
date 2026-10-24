(()=>{const main=document.querySelector('main');if(!main)return;
/* 홈은 탭을 쓰지 않는다(지도 아래 탭 줄이 하나 더 있어 번잡했다). 홈 아래쪽은 '더 보기' 링크로 대신한다. */if(document.body.dataset.page==='home')return;
const secs=[...main.querySelectorAll(':scope > section.sec:not(.gm):not(.fun-sec)')];const G={find:['receipts']};/* 홈 첫 탭은 주소 찾기+이번 주 영수증을 함께 */if(secs.length<3)return;
const L={trackteaser:'더 보기 목록',sole:'경쟁 없는 계약',cost:'비용 비교',pay:'공공기관 보수',fest:'축제·행사',subsidy:'보조금'};
secs.forEach((s,i)=>{if(!s.id)s.id='t'+(i+1);const h=s.querySelector('h2');s.dataset.lbl=L[s.id]||(h?h.textContent.trim():'')||(s.classList.contains('home-alerts')?'눈에 띄는 패턴':'섹션 '+(i+1));});
let nav=document.getElementById('stabs');
if(!nav){nav=document.createElement('nav');nav.className='stabs';nav.id='stabs';secs[0].before(nav);}
nav.innerHTML=secs.map(s=>`<a href="#${s.id}">${s.dataset.lbl}</a>`).join('');
document.body.classList.add('tabbed');
const show=()=>{const h=location.hash.slice(1);let t=secs.find(s=>s.id===h);
if(!t&&h){const el=document.getElementById(h);t=el&&secs.find(s=>s.contains(el));}
t=t||secs[0];const on=[t.id,...(G[t.id]||[])];secs.forEach(s=>s.classList.toggle('tab-off',!on.includes(s.id)));
nav.querySelectorAll('a').forEach(a=>{const on=a.getAttribute('href')==='#'+t.id;a.classList.toggle('on',on);if(on)nav.scrollLeft=a.offsetLeft-(nav.clientWidth-a.offsetWidth)/2;});
setTimeout(()=>dispatchEvent(new Event('resize')),30);return t;};
nav.insertAdjacentHTML('beforeend','<i class="sfade" aria-hidden="true"></i>');const fe=()=>{nav.classList.remove('fit');const pad=36;nav.classList.toggle('fit',nav.scrollWidth-pad<=nav.clientWidth);nav.classList.toggle('end',nav.scrollLeft+nav.clientWidth>=nav.scrollWidth-4);};addEventListener('resize',fe);nav.addEventListener('scroll',fe,{passive:true});setTimeout(fe,50);let ly=scrollY;addEventListener('scroll',()=>{const y=scrollY;nav.classList.toggle('hid',y>ly+4&&y>300);if(y<ly-4||y<300)nav.classList.remove('hid');ly=y;},{passive:true});
const pinMap=t=>{if(!t||t.id!=='map'&&location.hash!=='#map')return false;const sec=t.id==='map'?t:document.getElementById('map');if(!sec)return false;const bar=document.querySelector('.stickybar');const off=(bar?bar.getBoundingClientRect().height:52)+8;scrollTo(0,Math.max(0,sec.getBoundingClientRect().top+scrollY-off));const lg=sec.querySelector('.maplg'),tb=document.querySelector('.tabbar-bot')||document.querySelector('.tabbar');if(lg&&tb){const over=lg.getBoundingClientRect().bottom-tb.getBoundingClientRect().top+8;if(over>0)scrollBy(0,over);}return true;};
show();if(location.hash){history.scrollRestoration='manual';const y0=()=>{const t=show();if(!pinMap(t))scrollTo(0,0);};y0();addEventListener('load',y0);}addEventListener('hashchange',()=>{const t=show();if(pinMap(t))return;const y=nav.getBoundingClientRect().top+scrollY-60;if(scrollY>y)scrollTo(0,y);});
})();
