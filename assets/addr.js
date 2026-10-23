(()=>{const box=document.getElementById('addr');if(!box)return;
const inp=box.querySelector('input'),out=document.getElementById('addr-out'),dl=document.getElementById('addr-dl');
const won=n=>{n=Math.round(n||0);const a=Math.abs(n),s=n<0?'-':'';if(a>=1e12){const j=Math.floor(a/1e12),e=Math.round((a%1e12)/1e8);return s+j+'조'+(e?' '+e.toLocaleString('ko-KR')+'억':'')+'원'}if(a>=1e8)return s+(a>=1e10?Math.round(a/1e8).toLocaleString('ko-KR'):(a/1e8).toFixed(1).replace(/\.0$/,''))+'억원';if(a>=1e4)return s+Math.round(a/1e4).toLocaleString('ko-KR')+'만원';return s+a.toLocaleString('ko-KR')+'원'};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const PROV={서울:'서울특별시',부산:'부산광역시',대구:'대구광역시',인천:'인천광역시',광주:'광주광역시',대전:'대전광역시',울산:'울산광역시',세종:'세종특별자치시',경기:'경기도',강원:'강원특별자치도',충북:'충청북도',충청북:'충청북도',충남:'충청남도',충청남:'충청남도',전북:'전북특별자치도',전라북:'전북특별자치도',전남:'전라남도',전라남:'전라남도',경북:'경상북도',경상북:'경상북도',경남:'경상남도',경상남:'경상남도',제주:'제주특별자치도'};
const base=s=>s.replace(/(특별자치시|특별자치도|특별시|광역시|도|시|군)$/,'');
const STOP=/(활동|운동|행동|이동|자동|공동|협동|진동|노동|합동|가동|구동|작동|연동|변동|발동|출동|감동|아동|전동|유동|기동|관리동|정리|관리|처리|수리|정비|본동|별동|신동)$/;
let C=[],cache={};
fetch('data/index.json').then(r=>r.json()).then(d=>{C=d.cities;dl.innerHTML=C.map(c=>`<option value="${esc(c.short.includes(' ')?c.short:c.name)}">`).join('');});
const city=s=>cache[s]||(cache[s]=fetch('data/city/'+s+'.json').then(r=>r.json()));
function parse(q){const tk=q.replace(/[,()]/g,' ').split(/\s+/).filter(Boolean);let prov=null,c=null,gu=null,dong=[];
for(const t of tk){const b=base(t);if(!prov&&PROV[b]&&(t===b||/(도|시|특별시|광역시|특별자치시|특별자치도)$/.test(t)||tk.length>1))prov=PROV[b];}
for(const t of tk){const b=base(t);if(b.length<2&&!/^.(시|군)$/.test(t))continue;
 const m=C.filter(x=>base(x.name)===b||base(x.name)===base(t));
 if(m.length){const pick=m.find(x=>!prov||x.province===prov)||m[0];
  if(b==='광주'&&prov!=='경기도'&&!/광역시/.test(t)&&t!=='광주'){}
  if(!c||(c.province!==prov&&pick.province===prov))c=(b==='광주'&&(prov==='경기도'||t==='광주시'))?C.find(x=>x.slug==='gwangju-gg')||pick:pick;}
 if(/^[가-힣]{1,5}구$/.test(t)&&t.length>=2&&!C.some(x=>base(x.name)===base(t)||base(x.name)===t.slice(0,-1)||x.name.startsWith(t)))gu=t;
 if(/^[가-힣]{2,}\d*(동|읍|면|리|가)$/.test(t)&&!STOP.test(t)||/^[가-힣]{2,}\d*(로|길)(\d+번?길)?$/.test(t)&&t.length>=3)dong.push(t.replace(/(\d+번?길)$/,''));}
if(!c&&prov&&(prov.includes('특별시')||prov.includes('광역시')||prov.includes('특별자치시')))c=C.find(x=>x.name===prov);
return{prov,c,gu,dong};}
function top3(rows){const o={};rows.forEach(r=>o[r.cat||'기타']=(o[r.cat||'기타']||0)+r.amount);return Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,3);}
let seq=0;
async function go(){const q=inp.value.trim();const my=++seq;if(q.length<2){out.innerHTML='';return;}
const p=parse(q);
if(!p.c){if(p.prov){const alt=C.filter(x=>x.province===p.prov).sort((a,b)=>b.total-a.total).slice(0,3);
 out.innerHTML=`<div class="acard"><p>아직 이 지역은 추적하지 않아요. 같은 ${esc(p.prov)}에서 추적 중인 곳:</p>${alt.map(x=>`<a class="chip" style="display:inline-flex;align-items:center;margin:4px 4px 0 0" href="city.html?c=${x.slug}">${esc(x.name)}</a>`).join('')||'<p class="small">이 지역에 추적 중인 시가 없어요.</p>'}</div>`;}
 else out.innerHTML=`<div class="acard small">시·군·구 이름을 같이 넣어 주세요 (예: 대구 수성구, 수원시). 지금은 주요 85개 시를 추적해요.</div>`;return;}
const d=await city(p.c.slug);if(my!==seq)return;let rows=d.rows||[],label=p.c.name,guNote='';
if(p.gu){const g=rows.filter(r=>(r.inst||'').includes(p.gu));if(g.length){rows=g;label+=' '+p.gu;}else guNote=`<p class="small">${esc(p.gu)} 단위 자료가 따로 없어서 ${esc(p.c.name)} 전체로 보여드려요.</p>`;}
const sum=rows.reduce((a,r)=>a+r.amount,0),cats=top3(rows);
let dh='';if(p.dong.length){const hits=(d.rows||[]).filter(r=>p.dong.some(k=>new RegExp('(^|[^가-힣])'+k+'([^가-힣]|$)').test(r.title)));const hs=hits.reduce((a,r)=>a+r.amount,0);
 dh=`<h3 class="h3">우리 동네 이름이 들어간 계약 · ${esc(p.dong.join(', '))}</h3>`+(hits.length?`<p><b>${hits.length}건 · ${won(hs)}</b></p>`+hits.sort((a,b)=>b.amount-a.amount).slice(0,5).map(r=>`<a class="arow" href="${esc(r.url)}" target="_blank" rel="noopener"><b>${won(r.amount)}</b> ${esc(r.title)}<small>${esc(r.date)} · ${esc(r.inst)}</small></a>`).join(''):`<p class="small">최근 90일 계약 이름에 '${esc(p.dong.join(', '))}'이(가) 들어간 계약은 없어요. 동 이름 없이 등록된 계약이 많아서 그럴 수 있어요. 위의 ${esc(label)} 전체 금액을 참고해 주세요.</p>`)+`<p class="src">계약명에 동네 이름이 들어간 건만 모은 것이라 전부는 아닐 수 있어요. 출처: 조달청 나라장터</p>`;}
out.innerHTML=`<div class="acard"><span class="eyebrow">● 추적 결과 · 최근 ${d.days||90}일</span><h3 style="margin:4px 0">${esc(label)}</h3>${guNote}
<div class="abig">${won(sum)}</div><p class="small">계약 ${rows.length.toLocaleString()}건 · 계약 금액이 큰 분야: ${cats.map(([k,v])=>esc(k)+' ₩'+won(v)).join(' · ')}</p>
<a class="chip" style="display:inline-flex;align-items:center;margin-top:6px;background:#ffb020;color:#000;border-color:#ffb020" href="city.html?c=${p.c.slug}${label!==p.c.name?'&gu='+encodeURIComponent(p.gu):''}">${esc(label)} 자세히 보기 ›</a>${label!==p.c.name?` <a class="chip" style="display:inline-flex;align-items:center;margin-top:6px" href="city.html?c=${p.c.slug}">${esc(p.c.name)} 전체 ›</a>`:''} <a class="chip" style="display:inline-flex;align-items:center;margin-top:6px" href="spend.html?c=${p.c.slug}#sole">추적파일 ›</a>${dh}<p class="src">출처: 조달청 나라장터 계약정보. 기관 이름 기준으로 모았어요.</p></div>`;}
let t;inp.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(go,250)});box.addEventListener('submit',e=>{e.preventDefault();inp.blur();go();});})();
