(()=>{const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
const won=a=>a>=1e8?(a/1e8).toFixed(1)+'억':Math.round(a/1e4).toLocaleString()+'만';
const mkT=(it,src)=>{let t=document.querySelector('.ticker');if(!t){t=document.createElement('div');t.className='ticker';document.body.prepend(t);}t.setAttribute('aria-label','최근 계약 흐름');t.innerHTML='<a class="tk-brand" href="./">우리 시 돈 추적기</a><div>'+it.join(' &nbsp;//&nbsp; ')+' &nbsp;//&nbsp; '+src+'</div>';};
window.__cityTick=(rows,name)=>{const r=rows.slice().sort((a,b)=>b.date<a.date?-1:1).slice(0,10);if(r.length){const ld=r[0].date,nn=rows.filter(x=>x.date===ld).length;const td=new Date(Date.now()+9*3600e3).toISOString().slice(0,10);mkT([`<b>${ld===td?'오늘':ld.slice(5).replace('-','/')} 새로 포착 ${nn}건</b>`,...r.map(x=>`<a href="${x.url||'#contracts'}" target="_blank" rel="noopener">${name} · ${x.title.slice(0,22)} <b>₩${won(x.amount)}</b></a>`)],'출처: 조달청 나라장터');}};
if(document.body.dataset.page!=='city')fetch('data/sec_sole.json').then(r=>r.json()).then(d=>{const it=[];(d.flags||[]).slice(0,8).forEach(f=>{const l=f.inst.split(' ').pop();const loc=/(시|군|구)$/.test(l)&&!f.cname.includes(l)?f.cname+' '+l:f.cname;it.push(`<a data-c="${f.slug}" href="spend.html?c=${f.slug}#sole"><i>데이터상 이상 징후</i> ${loc} · 같은 업체 ${f.n}건 <b>₩${won(f.sum)}</b></a>`);});
(d.big||[]).slice(0,8).forEach(b=>it.push(`<a href="${b.u||'spend.html'}" target="_blank" rel="noopener">큰 계약 · ${b.cname} · ${maskT?maskT(b.t).slice(0,24):b.t.slice(0,24)} <b>₩${won(b.a)}</b></a>`));
{const today=new Date(Date.now()+9*3600e3).toISOString().slice(0,10);fetch('data/index.json').then(r=>r.json()).then(x=>{const n=x.cities.filter(c=>c.last===today).reduce((a,c)=>a+(c.today||0),0);if(n&&document.body.dataset.page!=='city'){const t=document.querySelector('.ticker div');if(t)t.insertAdjacentHTML('afterbegin',`<b>계약일 ${+today.slice(5,7)}/${+today.slice(8)} 기준 ${n.toLocaleString()}건(증가 중)</b> &nbsp;//&nbsp; `);const h=null;if(h){h.textContent=`계약일 ${+today.slice(5,7)}/${+today.slice(8)} 기준 새로 포착 ${n.toLocaleString()}건(늘어날 수 있음)`;h.hidden=false;}}}).catch(()=>{});}
if(!it.length)return;const t=document.createElement('div');t.className='ticker';t.setAttribute('aria-label','최근 계약 흐름 (출처: 나라장터)');
t.innerHTML='<a class="tk-brand" href="./">우리 시 돈 추적기</a><div>'+it.join(' &nbsp;//&nbsp; ')+' &nbsp;//&nbsp; 출처: 조달청 나라장터</div>';document.body.prepend(t);}).catch(()=>{});
// count-up for big numbers
const cu=el=>{if(rm||el.dataset.cu)return;const m=el.textContent.match(/^(\D*)([\d,]+)(.*)$/);if(!m||/\d/.test(m[3])||/[-\d]/.test(m[1]))return;const n=+m[2].replace(/,/g,'');if(!n||n<10)return;el.dataset.cu=1;const t0=performance.now();
const f=t=>{const p=Math.min(1,(t-t0)/900),v=Math.round(n*(1-Math.pow(1-p,3)));el.textContent=m[1]+v.toLocaleString()+m[3];if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)};
const scan=()=>document.querySelectorAll('.alert .a,.stats b').forEach(cu);
new MutationObserver(()=>{clearTimeout(scan.t);scan.t=setTimeout(scan,120)}).observe(document.body,{childList:true,subtree:true});setTimeout(scan,300);
document.addEventListener('click',e=>{const a=e.target.closest('abbr[title]');document.querySelectorAll('.tipbox').forEach(x=>x.remove());if(!a)return;e.preventDefault();const b=document.createElement('div');b.className='tipbox';b.textContent=a.title;document.body.appendChild(b);setTimeout(()=>b.remove(),6000);});
if(rm)return;const S=['₩','💵','🪙','₩','💸'];
addEventListener('pointerdown',e=>{for(let i=0;i<6;i++){const s=document.createElement('span');s.className='mburst';s.textContent=S[i%S.length];
const a=Math.random()*Math.PI*2,r=30+Math.random()*30;s.style.left=e.clientX-8+'px';s.style.top=e.clientY-10+'px';
s.style.setProperty('--dx',Math.cos(a)*r+'px');s.style.setProperty('--dy',Math.sin(a)*r-20+'px');s.style.setProperty('--r',(Math.random()*60-30)+'deg');
document.body.appendChild(s);setTimeout(()=>s.remove(),650);}},{passive:true});})();

(()=>{const t=()=>document.querySelector('.ticker');document.addEventListener('touchstart',e=>{const k=t();if(k)k.classList.toggle('paused',k.contains(e.target));},{passive:true});
document.addEventListener('click',e=>{const a=e.target.closest('.ticker a[data-c]');if(a&&window.__dvGo){e.preventDefault();__dvGo({c:a.dataset.c});document.getElementById('dive').scrollIntoView({block:'start'});}});})();
// 상단 띠: 흐르는 글자 대신 한 줄씩(필요하면 두 줄) 통째로 보여 주고 5초마다 다음 항목 (잘리지 않게)
(()=>{const rot=(t)=>{if(!t||t.dataset.rot)return;const d=t.querySelector(':scope>div');if(!d)return;const its=[...d.children].filter(e=>/^(A|B)$/.test(e.tagName));if(!its.length)return;t.dataset.rot=1;t.classList.add('tk-rot');
let i=0;const slot=document.createElement('div');slot.className='tk-slot';d.replaceWith(slot);slot.style.paddingLeft=((t.querySelector('.tk-brand')||{}).offsetWidth||0)+10+'px';const show=()=>{slot.replaceChildren(its[i%its.length].cloneNode(true));i++;};show();setInterval(()=>{if(!document.hidden&&!t.classList.contains('paused'))show();},5000);};
const obs=new MutationObserver(()=>{const t=document.querySelector('.ticker');const d=t&&t.querySelector(':scope>div');if(t&&d&&d.children.length&&!t.dataset.rot)setTimeout(()=>rot(t),1500);});obs.observe(document.body,{childList:true,subtree:true});})();

// 지도 범례: 지도 바로 아래 한 줄 (지도 위에 겹치지 않게)
(()=>{const H='<i class="lg-ln" style="background:#0a84ff"></i>우리 시 업체<i class="lg-ln" style="background:#ff9f0a"></i>다른 지역 업체<span class="lg-w"><i></i><i></i></span>굵을수록 돈이 많아요<span class="lg-s" style="display:inline-flex;align-items:center;gap:4px;white-space:nowrap"><i class="lg-ring" style="margin-left:0"></i>선택</span>';
const put=()=>document.querySelectorAll('.dv-map,.map').forEach(m=>{if(m.closest('.lg-skip')||!(m.classList.contains('leaflet-container')||m.querySelector('.leaflet-pane,svg')))return;const n=m.nextElementSibling;if(n&&n.classList.contains('maplg'))return;const p=document.createElement('p');p.className='maplg';p.setAttribute('aria-label','지도 범례');p.innerHTML=H;m.after(p);});
put();new MutationObserver(put).observe(document.body,{childList:true,subtree:true});})();
