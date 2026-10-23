(()=>{const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
const won=a=>a>=1e8?(a/1e8).toFixed(1)+'억':Math.round(a/1e4).toLocaleString()+'만';
fetch('data/sec_sole.json').then(r=>r.json()).then(d=>{const it=[];(d.flags||[]).slice(0,8).forEach(f=>it.push(`<i>[데이터상 이상 징후]</i> ${f.cname} ${f.inst.split(' ').pop()} · ${f.n}건 <b>₩${won(f.sum)}</b>`));
(d.big||[]).slice(0,8).forEach(b=>it.push(`[TRACKING] ${b.cname} · ${b.t.slice(0,24)} <b>₩${won(b.a)}</b>`));
if(!it.length)return;const t=document.createElement('div');t.className='ticker';t.setAttribute('aria-label','최근 계약 흐름 (출처: 나라장터)');
t.innerHTML='<div>'+it.join(' &nbsp;//&nbsp; ')+' &nbsp;//&nbsp; 출처: 조달청 나라장터</div>';document.body.prepend(t);}).catch(()=>{});
// count-up for big numbers
const cu=el=>{if(rm||el.dataset.cu)return;const m=el.textContent.match(/^(\D*)([\d,]+)(.*)$/);if(!m)return;const n=+m[2].replace(/,/g,'');if(!n||n<10)return;el.dataset.cu=1;const t0=performance.now();
const f=t=>{const p=Math.min(1,(t-t0)/900),v=Math.round(n*(1-Math.pow(1-p,3)));el.textContent=m[1]+v.toLocaleString()+m[3];if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)};
const scan=()=>document.querySelectorAll('.counter b,.alert .a,.stats b').forEach(cu);
new MutationObserver(()=>{clearTimeout(scan.t);scan.t=setTimeout(scan,120)}).observe(document.body,{childList:true,subtree:true});setTimeout(scan,300);
if(rm)return;const S=['₩','💵','🪙','₩','💸'];
addEventListener('pointerdown',e=>{for(let i=0;i<6;i++){const s=document.createElement('span');s.className='mburst';s.textContent=S[i%S.length];
const a=Math.random()*Math.PI*2,r=30+Math.random()*30;s.style.left=e.clientX-8+'px';s.style.top=e.clientY-10+'px';
s.style.setProperty('--dx',Math.cos(a)*r+'px');s.style.setProperty('--dy',Math.sin(a)*r-20+'px');s.style.setProperty('--r',(Math.random()*60-30)+'deg');
document.body.appendChild(s);setTimeout(()=>s.remove(),650);}},{passive:true});})();
