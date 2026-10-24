(async()=>{
const D='data/national/',$=id=>document.getElementById(id);
const G={"일반수당": "매달 받는 기본 월급이에요.", "입법활동비": "법을 만드는 일에 쓰라고 주는 돈이에요.", "특별활동비": "회의나 국정감사 같은 활동이 있을 때 더 주는 돈이에요.", "관리업무수당": "관리하는 일을 맡은 사람에게 월급에 더 얹어 주는 돈이에요.", "정근수당": "오래 일한 사람에게 1년에 두 번 주는 돈이에요.", "정액급식비": "밥값으로 매달 정해진 만큼 주는 돈이에요.", "명절휴가비": "설과 추석에 주는 돈이에요."};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const won=n=>{if(n==null)return '';n=Math.round(n);const e=Math.floor(n/1e8),m=Math.round((n%1e8)/1e4);if(e)return e.toLocaleString()+'억'+(m?' '+m.toLocaleString()+'만':'')+'원';return m.toLocaleString()+'만원';};
const S=(u,t)=>u?`<span class="src">출처 <a href="${esc(u)}" target="_blank" rel="noopener">${esc(t||'원문')}</a></span>`:'';
const j=f=>fetch(D+f).then(r=>r.json());
const csv=f=>fetch(D+f).then(r=>r.text()).then(t=>{const L=t.replace(/^\ufeff/,'').trim().split(/\r?\n/).map(l=>{const o=[];let c='',q=0;for(const ch of l){if(ch=='"')q=!q;else if(ch==','&&!q){o.push(c);c=''}else c+=ch}o.push(c);return o});const h=L.shift();return L.map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])))});
const [mem,sup,par,flw,prj,idx,trw,tm,tp,td]=await Promise.all([j('members.json'),j('support.json'),j('parties.json'),j('flows.json'),j('projects.json'),j('index.json'),j('trips_raw.json'),csv('trips_by_member.csv'),csv('trips_by_party.csv'),csv('trips_top_dest.csv')]);
for(const t of trw.trips)if(/Campain|Aboilsh|Nclear/.test(t.funder||''))t.funder+=' (원문 표기)';
for(const r of tm)if(/Campain|Aboilsh|Nclear/.test(r.funders||''))r.funders=r.funders.replace(/(Japan Campain to Aboilsh Nclear Weapons)/,'$1(원문 표기)');
$('upd').textContent=idx.updated||sup.updated;
// 1 의원 1명
const a=sup.allowance.find(x=>x.amount)||sup.allowance[0];
const mx=Math.max(...Object.values(a.parts));
let h=`<p class="sub">${a.year}년 국회의원 1명에게 1년 동안 주도록 정해 둔 돈(지급기준)</p><div class="big">${won(a.amount)}</div><p class="sub">실제로 받은 돈이 아니라 '이만큼 준다'고 정한 기준이에요. ${S(a.src,a.src_note)}</p>`;
for(const [k,v] of Object.entries(a.parts).sort((x,y)=>y[1]-x[1]))h+=`<div class="row"><span>${esc(k)}${G[k]?`<div class="sub">${G[k]}</div>`:''}<div class="bar" style="width:${Math.max(4,v/mx*100)}%"></div></span><b>${won(v)}</b></div>`;
h+=`<h3>의원실 하나에 주는 운영비</h3>`;
for(const o of sup.office_support.filter(o=>!/확인|불일치|API/.test(o.unit||'')))h+=`<div class="row"><span>${esc(o.item)} <span class="sub">(${esc(o.unit)})</span><br>${S(o.src,'열린국회정보')}</span><b>${won(o.amount)}</b></div>`;
const n=(mem.members||[]).length,md=(idx.seats&&idx.seats.date)||String(mem.updated||'').slice(0,10);
h+=`<div class="note">현재 의원 ${n}명(${S('https://open.assembly.go.kr/portal/openapi/nwvrqwxyaytdsfvhu','열린국회정보 의원 명단('+md.replace(/-/g,'.')+' 기준)')}) 모두에게 같은 기준을 적용하면 1년 ${won(a.amount*n)}이에요(계산값). ${S(a.src,a.src_note)}</div>`;
$('mp').innerHTML=h;
// 2 정당
const NEC='https://m.nec.go.kr/site/nec/ex/bbs/View.do?bcIdx=328653&cbIdx=1090',WB='https://www.wbcb.co.kr/news/articleView.html?idxno=106050';
const pf=flw.flows.filter(f=>!/수당/.test(f.kind));
const q3=pf.filter(f=>f.kind==='경상보조금'&&f.period==='3분기'),q3t=q3.reduce((x,f)=>x+f.amount,0),q3m=Math.max(...q3.map(f=>f.amount));
h=`<p class="sub">정당은 나라 돈(국고보조금)을 받아요.</p><div class="note"><b>경상보조금</b>: 정당이 평소 살림에 쓰라고 3달마다 받는 돈이에요.<br><b>추천보조금</b>: 선거 때 여성·장애인·청년 후보를 낸 정당에 더 주는 돈이에요.</div>
<h3>2026년 3분기 경상보조금</h3><div class="big">${won(q3t)}</div><p class="sub">${q3.length}개 정당 합계 ${q3t.toLocaleString()}원(계산값) ${S(NEC,'중앙선거관리위원회')}</p>`;
for(const f of q3.sort((x,y)=>y.amount-x.amount)){const p=par.parties.find(x=>x.party===f.to.party)||{};h+=`<div class="row"><span>${esc(f.to.party)} <span class="sub">${p.seats!=null?'의석 '+p.seats:''}</span><div class="bar b" style="width:${Math.max(1,f.amount/q3m*100)}%"></div></span><b>${won(f.amount)}</b></div>`;}
const q2=pf.filter(f=>f.kind==='경상보조금'&&f.period==='2분기'),el=pf.filter(f=>/선거/.test(f.kind));
h+=`<h3>그 밖에 확인된 돈</h3>`+q2.map(f=>`<div class="row"><span>${esc(f.to.party)} · 2026년 2분기 경상보조금<br>${S(f.src,'복지TV부울경방송 보도(선관위 자료 인용)')}</span><b>${won(f.amount)}</b></div>`).join('')+
el.map(f=>`<div class="row"><span>${esc(f.to.party)} · ${esc(f.period||'')} 선거보조금·추천보조금<br>${S(f.src,'복지TV부울경방송 보도(선관위 자료 인용)')}</span><b>${won(f.amount)}</b></div>`).join('')+
`<div class="note">6·3 지방선거 때 7개 정당이 받은 선거 관련 보조금은 모두 약 570억 7,600만원이고, 그중 약 87%가 더불어민주당·국민의힘 두 정당에 갔어요. ${S(WB,'복지TV부울경방송 2026.9.13')}</div>`;
if(par.rules)h+=`<div class="note">${esc(par.rules.text)} ${S(par.rules.src,'정치자금법')}</div>`;
$('pt').innerHTML=h;
// 3 국외활동
const ART='https://www.sisajournal.com/news/articleView.html?idxno=362332';const TS='https://open.assembly.go.kr/portal/openapi/nasnutdbapnfphwyr';
const reports=new Set(trw.trips.map(t=>t.trip_id)).size;
h=`<div class="note">국회의원이 외국에 다녀왔다고 국회에 신고한 기록이에요. 돈은 <b>자비·외교부·외국 정부·재단</b> 등 다양한 곳에서 냈어요. 모두 세금으로 간 건 아니에요.</div>
<p class="sub">신고 ${trw.count_raw||reports}건 · 의원 참가 ${trw.trips.length}번 ${S(TS,'열린국회정보 국외활동')}</p>
<h3>여의도에서 간 나라 <span class="sub">(선 굵기 = 신고 건수)</span></h3><p class="sub">나라나 선을 누르면 그 나라에 다녀온 기록이 나와요. 국회 자료에 금액이 없으면 공개 안 됨이라고 적어요.</p><div id="tmap"></div><div id="cp"></div>
<div class="note">보도로 확인된 비용: 2025년 16개 상임위원회(분야별로 나눠 일하는 국회 모임) 해외출장 35팀, 순수 경비 <b>11억 3,800만원</b>(정보공개청구 자료). 이 지도의 신고 기록과 범위가 다를 수 있어요. ${S(ART,'시사저널 2026.2.9')}</div><h3>많이 간 나라 10곳 <span class="sub">(신고 건수 · 누르면 기록)</span></h3>`;
const tmax=Math.max(...td.map(r=>+r.reports));
h+=td.map((r,i)=>`<div class="row crow" data-c="${esc(r.destination)}" role="button" tabindex="0"><span>${i+1}. ${esc(r.destination)}<div class="bar" style="width:${r.reports/tmax*100}%"></div></span><b>${r.reports}건</b></div>`).join('');
const inf=trw.trips.filter(t=>t.dest_inferred).length;
h+=`<p class="src">${inf}번은 나라 칸이 비어 있어서 목적 문구로 나라를 추정했어요. ${S(TS,'열린국회정보')}</p>`;
const sd=tp[0]||{};
h+=`<h3>정당별 참가 횟수</h3><table><tr><th>정당</th><th>참가 횟수(동행 포함)</th><th>현재 의석</th><th>의석당</th></tr>`+tp.filter(r=>r.party!=='미매칭').map(r=>`<tr><td>${esc(r.party)}</td><td>${r['참가 횟수(동행 포함)']}</td><td>${r['현재 의석']}</td><td>${r['의석당 참가 횟수(현재 의석 기준 근사치)']||''}</td></tr>`).join('')+`</table>
<p class="src">의석당 = 현재 의석 기준 근사치예요. 근사치는 '대충 맞는 값'이란 뜻이에요. 다녀온 때와 지금의 의석 수가 달라서 정확한 값이 아니에요. 의석: ${S('https://open.assembly.go.kr/portal/openapi/nwvrqwxyaytdsfvhu','열린국회정보 의원 명단('+String(sd['의석 기준일']||'').replace(/-/g,'.')+' 기준)')} · ${S(TS,'참가 기록')}</p>
<h3>의원 이름으로 찾기</h3><p class="sub">이름 일부를 치세요. 한 명이면 위 지도로 올라가고, 여러 명이면 목록을 누르거나 엔터를 치세요.</p><div class="qwrap"><input type="search" id="q" placeholder="예: 장동혁" autocomplete="off" aria-label="의원 이름" enterkeyhint="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="qsug"><div id="qsug" class="qsug" role="listbox"></div></div><div id="qr"></div>`;
$('tr').innerHTML=h;
const C={일본:[35.7,139.7],중국:[39.9,116.4],미국:[38.9,282.96],영국:[51.5,-.1],독일:[52.5,13.4],베트남:[21,105.8],호주:[-35.3,149.1],인도:[28.6,77.2],싱가포르:[1.35,103.8],우즈베키스탄:[41.3,69.2],필리핀:[14.6,121],튀르키예:[39.9,32.9],체코:[50.1,14.4],인도네시아:[-6.2,106.8],말레이시아:[3.1,101.7],홍콩:[22.3,114.2],오스트리아:[48.2,16.4],오스크리아:[48.2,16.4],캄보디아:[11.6,104.9],아랍에미리트:[24.5,54.4],우간다:[0.3,32.6],브라질:[-15.8,312.1],헝가리:[47.5,19],볼리비아:[-16.5,291.9],스위스:[46.9,7.4],태국:[13.8,100.5],대만:[25,121.5],벨기에:[50.8,4.4],폴란드:[52.2,21],캐나다:[45.4,284.3],이탈리아:[41.9,12.5],덴마크:[55.7,12.6],멕시코:[19.4,260.9],이집트:[30,31.2],몽골:[47.9,106.9],칠레:[-33.4,289.4],라오스:[18,102.6],프랑스:[48.9,2.35]};
const ACOST={프랑스:`<div class="note">보도로 확인된 비용: 예산결산특별위원회 의원 9명, 프랑스·포르투갈(2025.12~2026.1) <b>1억 7,688만원</b>. ${S(ART,'시사저널 2026.2.9')}</div>`};
const byT={};for(const t of trw.trips)(byT[t.trip_id]=byT[t.trip_id]||[]).push(t);
const cnt={};for(const [id,ts] of Object.entries(byT))for(const d of new Set(ts[0].dest))(cnt[d]=cnt[d]||new Set()).add(id);
const NOAMT='공개 안 됨';
const moneyText=t=>{const n=t&&(t.amount??t.amount_krw??t.cost);if(n==null||n===''||!Number.isFinite(Number(n)))return NOAMT;return won(Number(n))||NOAMT;};
const showC=c=>{const ids=[...(cnt[c]||[])];const box=$('cp');
 box.innerHTML=`<h3>${esc(c)} · 신고 ${ids.length}건</h3>`+(ACOST[c]||'')+ids.map(id=>{const ts=byT[id],t=ts[0];return `<div class="trip"><b>${esc(t.dates)}</b> ${t.dest_inferred?'<span class="tag y">목적 문구로 추정</span>':''}<br>
 <span class="sub">의원:</span> ${ts.map(x=>esc(x.name)+'<span class="sub">('+esc(x.party)+')</span>').join(', ')}<br>
 <span class="p">${esc(t.purpose)}</span><br><span class="k">돈</span> <b>${esc(moneyText(t))}</b><br>${[...new Set(ts.map(x=>x.funder||'적힌 곳 없음'))].map(f=>`<span class="tag">비용 낸 곳: ${esc(f)}</span>`).join('')}<span class="tag">신고 당시 결과보고서 ${ts.some(x=>x.report==='유')?'유':'무'}</span><br><span class="sub">신고서 첫 번째 기재 의원: ${esc((ts.find(x=>x.is_leader)||t).name)}</span> ${S(t.src,'열린국회정보')}</div>`}).join('');
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 requestAnimationFrame(()=>box.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}));};
try{const m=L.map('tmap',{zoomControl:false,worldCopyJump:false,zoomSnap:.25,minZoom:0,maxZoom:6});
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',{attribution:'© Esri',maxZoom:6}).addTo(m);
const se=[37.5319,126.914];const cmax=Math.max(1,...Object.values(cnt).map(x=>x.size));
const arc=(a,b)=>{const P=[],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,dx=b[1]-a[1],dy=b[0]-a[0],k=.18;const c=[mx+dx*k,my-dy*k];for(let i=0;i<=24;i++){const t=i/24,u=1-t;P.push([u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]]);}return P;};
const pts=[],labs=[],dots=[];
const tag=(layer,name)=>{const el=layer.getElement&&layer.getElement();if(el)el.setAttribute('data-c',name);};
for(const [c,ids] of Object.entries(cnt).sort((x,y)=>x[1].size-y[1].size)){const p=C[c];if(!p)continue;pts.push(p);const n=ids.size,w=2.4+n/cmax*5,line=arc(se,p);
 L.polyline(line,{color:'#ffb020',weight:w+3,opacity:.34,interactive:false,lineCap:'round',lineJoin:'round'}).addTo(m);
 L.polyline(line,{color:'#ffb020',weight:w,opacity:.94,interactive:false,lineCap:'round',lineJoin:'round'}).addTo(m);
 L.polyline(line,{color:'#ffe7b8',weight:Math.max(1.8,w*.4),opacity:1,className:'nflow',interactive:false,lineCap:'round'}).addTo(m);
 const mk=L.circleMarker(p,{radius:Math.max(7,4+n/cmax*8),color:'#1a1408',weight:1.5,fillColor:'#ffb020',fillOpacity:.96}).addTo(m);
 const hit=L.circleMarker(p,{radius:16,color:'transparent',weight:0,fillColor:'#ffb020',fillOpacity:0}).addTo(m);
 const go=()=>showC(c);
 mk.on('click',go);hit.on('click',go);
 dots.push({c,mk,hit,ll:L.latLng(p[0],p[1])});
 const tip=L.tooltip({permanent:true,direction:'top',className:'clab',offset:[0,-4],interactive:true,opacity:1}).setLatLng(p).setContent(esc(c)).addTo(m);
 tip._n=n;tip._c=c;labs.push(tip);}
const seMk=L.circleMarker(se,{radius:7,color:'#fff',weight:2,fillColor:'#4da3ff',fillOpacity:1,className:'seoul-dot'}).addTo(m);
seMk.bindTooltip('여의도 국회',{permanent:false,direction:'top',className:'ntip',opacity:1});
seMk.on('click',()=>seMk.closeTooltip());
if(L.Browser.mobile)seMk.on('tooltipopen',()=>seMk.closeTooltip());
// 아메리카 경도는 태평양 쪽(+360)이라 처음 화면은 아시아·유럽이 퍼지게 그 구간을 맞춘다.
const pad=L.point(12,24);
const fitOpts={padding:[12,24],maxZoom:4,animate:false};
const base=L.latLngBounds(pts.filter(p=>p[1]>-30&&p[1]<170).concat([se]));
const fit=()=>{
 m.invalidateSize(false);
 if(!base.isValid())return;
 m.fitBounds(base,fitOpts);
 const z=m.getZoom();
 let b=L.latLngBounds(base.getSouthWest(),base.getNorthEast());
 for(const p of pts.filter(p=>p[1]>=170).sort((a,c)=>a[1]-c[1])){
  const b2=L.latLngBounds(b.getSouthWest(),b.getNorthEast()).extend(p);
  if(m.getBoundsZoom(b2,false,pad.multiplyBy(2))<z-.01)break;
  b=b2;
 }
 m.fitBounds(b,fitOpts);
};
const arm=()=>{
 dots.forEach(d=>{tag(d.mk,d.c);tag(d.hit,d.c);});
 labs.forEach(t=>{
  const el=t.getElement();if(!el||el.dataset.bound)return;
  el.dataset.bound='1';el.dataset.c=t._c;
  el.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();showC(t._c);});
 });
};
fit();arm();
const declutter=()=>{
 const box=$('tmap');if(!box)return;
 const bb=box.getBoundingClientRect(),inset=4;
 const clash=(a,b)=>!(a.right+3<b.left||a.left-3>b.right||a.bottom+3<b.top||a.top-3>b.bottom);
 const seen=[];
 const block=el=>{if(!el)return;const r=el.getBoundingClientRect();if(r.width<2||r.height<2)return;seen.push({left:r.left-3,right:r.right+3,top:r.top-3,bottom:r.bottom+3});};
 block(box.querySelector('.leaflet-control-attribution'));
 block(box.querySelector('.seoul-dot'));
 const tries=[[0,-14],[0,12],[16,-8],[-16,-8],[0,-30],[0,26],[30,0],[-30,0],[20,18],[-20,18],[0,-46],[0,40]];
 labs.slice().sort((a,b)=>b._n-a._n).forEach(t=>{
  const el=t.getElement();if(!el)return;
  el.style.marginLeft='0px';el.style.marginTop='0px';el.style.visibility='hidden';
  if(!m.getBounds().contains(t.getLatLng()))return;
  const r0=el.getBoundingClientRect();if(r0.width<2||r0.height<2)return;
  for(const [dx,dy] of tries){
   const r={left:r0.left+dx,right:r0.right+dx,top:r0.top+dy,bottom:r0.bottom+dy};
   if(r.left<bb.left+inset||r.right>bb.right-inset||r.top<bb.top+inset||r.bottom>bb.bottom-inset)continue;
   if(seen.some(q=>clash(r,q)))continue;
   el.style.marginLeft=dx+'px';el.style.marginTop=dy+'px';el.style.visibility='';
   seen.push(r);return;
  }
 });
};
m.on('zoomend moveend',()=>requestAnimationFrame(()=>{declutter();arm();}));
m.on('click',e=>{
 let best=null,bd=22;
 for(const d of dots){const dist=e.containerPoint.distanceTo(m.latLngToContainerPoint(d.ll));if(dist<bd){bd=dist;best=d.c;}}
 if(best)showC(best);
});
let rz;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{fit();arm();},120);});
setTimeout(()=>{declutter();arm();},60);setTimeout(()=>{declutter();arm();},400);
}catch(e){console.warn(e);$('tmap').remove();}

// 출장 줄은 members.json이 아니라 trips_raw를 의원 id로 잇는다. members.trips는 횟수 숫자라 목록이 아니다.
const byMem=new Map();
for(const t of trw.trips){const key=t.member_id||('name:'+t.name);if(!byMem.has(key))byMem.set(key,[]);byMem.get(key).push(t);}
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const people=(mem.members||[]).map(m=>({key:m.id,name:clean(m.name),party:clean(m.party),district:clean(m.district),region:clean(m.region),elect:m.elect,trips:byMem.get(m.id)||[]}));
const seenP=new Set(people.map(p=>p.key));
for(const t of trw.trips){const key=t.member_id||('name:'+t.name);if(seenP.has(key))continue;seenP.add(key);people.push({key,name:clean(t.name),party:clean(t.party),district:'',trips:byMem.get(key)||[]});}
const CITY={프놈펜:[11.56,104.93],뉴욕:[40.71,-74.01],제네바:[46.2,6.14],오키나와:[26.21,127.68],캔버라:[-35.28,149.13],시드니:[-33.87,151.21],란저우:[36.06,103.83],바티칸:[41.9,12.45],베를린:[52.52,13.4]};
const worldLL=ll=>{let lng=ll[1];while(lng>180)lng-=360;while(lng<-180)lng+=360;return [ll[0],lng];};
const norm=s=>String(s||'').replace(/\s+/g,'').toLowerCase();
const uniqTrips=p=>{const seen=new Set(),out=[];for(const t of p.trips.slice().sort((a,b)=>String(a.start||'').localeCompare(String(b.start||''))||(a.trip_id||0)-(b.trip_id||0))){if(seen.has(t.trip_id))continue;seen.add(t.trip_id);out.push(t);}return out;};
const destText=t=>{const raw=String(t.dest_raw||'').replace(/\s+/g,' ').trim();if(raw&&raw!=='목적지')return raw;return (t.dest||[]).join(', ')||'적힌 곳 없음';};
const pointsFor=t=>{const raw=String(t.dest_raw||'');const cities=Object.keys(CITY).filter(n=>raw.includes(n)).sort((a,b)=>raw.indexOf(a)-raw.indexOf(b));if(cities.length)return cities.map(n=>({name:n,ll:CITY[n]}));const out=[],s=new Set();for(const d of t.dest||[]){if(s.has(d))continue;s.add(d);out.push({name:d,ll:C[d]?worldLL(C[d]):null});}return out;};
const legsOf=p=>{const legs=[],seen=new Set();for(const t of uniqTrips(p))for(const pt of pointsFor(t)){if(!pt.ll||seen.has(pt.name))continue;seen.add(pt.name);legs.push({name:pt.name,lat:pt.ll[0],lng:pt.ll[1]});}return legs;};// 같은 곳에 여러 번 가도 선과 이름은 한 번만 그린다
const findP=q=>people.filter(p=>norm(p.name).includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'ko')||String(a.district).localeCompare(String(b.district),'ko'));
// 이름 전체가 한 명에게만 맞으면 그 사람을 고른다. '김윤'은 '김윤덕'에도 들어가지만, 김윤 의원을 놓치지 않기 위해서다.
// 같은 이름이 둘이면(박지원) 고르지 않고 지역구가 적힌 목록을 보여 준다.
const decide=q=>{const hits=findP(q);const exact=hits.filter(p=>norm(p.name)===q);if(exact.length===1)return {one:exact[0],hits,exact};if(hits.length===1)return {one:hits[0],hits,exact};return {one:null,hits,exact};};
let cur=null;
const cardBox=()=>{const root=$('topmap');let box=$('mcards');if(!box){box=document.createElement('div');box.id='mcards';}if(root)root.append(box);return box;};
const resetMap=()=>{window.__mpRouteQueue=null;if(window.__mpRoutes)window.__mpRoutes.reset();const box=$('mcards');if(box)box.innerHTML='';};
const scrollMap=(now)=>{const el=document.querySelector('#topmap .tm-map')||$('topmap');if(!el)return;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;const pad=matchMedia('(min-width:768px)').matches?68:8;if(document.activeElement&&document.activeElement!==document.body)document.activeElement.blur();const top=el.getBoundingClientRect().top+window.scrollY-pad;window.scrollTo({top:Math.max(0,top),behavior:(now||reduce)?'auto':'smooth'});};
const pushMap=p=>{const n=uniqTrips(p).length;const payload={title:n?p.name+' 해외출장 '+n+'건':p.name+' · 해외출장 0건',legs:legsOf(p)};if(window.__mpRoutes)window.__mpRoutes.show(payload);else window.__mpRouteQueue=payload;};
const renderPerson=p=>{const trips=uniqTrips(p);const back='<button type="button" class="allmap" id="mapback">지역 돈 지도</button>';if(!trips.length)return `<div class="mhead">${back}</div><article class="mcard"><b>${esc(p.name)}</b><p>정당: ${esc(p.party||'자료에 없음')}</p><p>지역구: ${esc(p.district||'자료에 없음')}</p><p>해외출장 0건</p></article>`;const meta=[p.party,p.district,'해외출장 '+trips.length+'건'].filter(Boolean).map(esc).join(' · ');const head=`<div class="mhead"><b>${esc(p.name)}</b><span class="sub">${meta}</span>${back}</div>`;return head+trips.map(t=>`<article class="mcard"><div><span class="k">날짜</span> ${esc(t.dates||t.start||'')}</div><div><span class="k">간 곳</span> ${esc(destText(t))}${t.dest_inferred?' <span class="tag y">나라는 적힌 이유로 짐작했어요</span>':''}</div><div><span class="k">왜 갔는지</span> ${esc(t.purpose||'')}</div><div><span class="k">돈</span> <b>${esc(moneyText(t))}</b></div>${t.funder?`<div><span class="k">돈 낸 곳</span> ${esc(t.funder)}</div>`:''}${S(t.src,'열린국회정보')}</article>`).join('');};
const sug=hits=>{const box=$('qsug');box.innerHTML=hits.map(p=>`<button type="button" role="option" data-k="${esc(p.key)}">${esc(p.name)} · ${esc(p.party||'정당 없음')}${p.district?' · '+esc(p.district):''}</button>`).join('');$('q').setAttribute('aria-expanded',hits.length?'true':'false');box.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{const p=people.find(x=>x.key===btn.dataset.k);if(!p)return;$('q').value=p.name;pick(p);}));};
let scrollTok=0;
addEventListener('mproutes',()=>{const n=scrollTok;setTimeout(()=>{if(n===scrollTok)scrollMap(true);},60);});
// 지도에서 지역(시도)을 누르면 그 지역 지역구 의원 목록. 이름을 누르면 그 의원의 해외출장 지도로 간다.
const regionList=(name,value)=>{const list=people.filter(p=>p.elect==='지역구'&&p.region===name).sort((x,y)=>x.district.localeCompare(y.district,'ko'));
 if(!list.length)return;cur=null;sug([]);$('qr').innerHTML='';
 const per=a&&a.amount?a.amount:0;
 const box=cardBox();
 box.innerHTML=`<div class="mhead"><b>${esc(name)} 지역구 의원 ${list.length}명</b><button type="button" class="allmap" id="rgclose">닫기</button></div>`+
  `<p class="sub">1명에게 1년 ${esc(won(per))} × ${list.length}명 = <b>${esc(won(value||per*list.length))}</b> (지급 기준이에요. 실제로 받은 돈과 다를 수 있어요)</p>`+
  `<div class="rglist">`+list.map(p=>{const n=uniqTrips(p).length;return `<button type="button" class="rgrow" data-k="${esc(p.key)}"><b>${esc(p.name)}</b><span class="sub">${esc(p.party||'정당 없음')} · ${esc(p.district||'')}</span><em>${n?'해외출장 '+n+'건 ›':'해외출장 0건'}</em></button>`;}).join('')+`</div>`+
  `<p class="sub">이름을 누르면 그 의원이 다녀온 나라가 위 지도에 나와요. ${S('https://open.assembly.go.kr/portal/openapi/nwvrqwxyaytdsfvhu','열린국회정보 의원 명단')}</p>`;
 box.querySelectorAll('.rgrow').forEach(b=>b.addEventListener('click',()=>{const p=people.find(x=>x.key===b.dataset.k);if(p){$('q').value=p.name;pick(p);}}));
 const c=$('rgclose');if(c)c.addEventListener('click',()=>{box.innerHTML='';});
 // 지도 위에도 바로 띄운다(아래 목록까지 내려가지 않아도 보이게)
 const s=mpSheet();if(s){const top=list.slice(0,8);const el=s.show(`<h4>${esc(name)} 지역구 의원 ${list.length}명</h4><div class="mt-v">${esc(won(value||per*list.length))}</div><div class="mt-s">1년 지급 기준 · 1명 ${esc(won(per))} × ${list.length}명 · 이름을 누르면 해외출장 지도</div><ol>`+top.map(p=>{const n=uniqTrips(p).length;return `<li><button type="button" data-k="${esc(p.key)}">${esc(p.name)} <span class="mt-tk">${esc(p.party||'')} · ${esc(p.district.replace(name+' ',''))}</span></button><b>${n?'출장 '+n+'건':'출장 0건'}</b></li>`;}).join('')+`</ol><button type="button" class="mt-go">${list.length}명 전체 보기 ↓</button>`);
  el.querySelectorAll('li button').forEach(b=>b.addEventListener('click',()=>{const p=people.find(x=>x.key===b.dataset.k);if(p){$('q').value=p.name;pick(p);}}));
  el.querySelector('.mt-go').onclick=()=>box.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}};
const mpSheet=()=>{if(!window.mtSheet)return null;if(!window.__mpSheet){const m=document.querySelector('#topmap .tm-map');if(m)window.__mpSheet=mtSheet(m);}return window.__mpSheet||null;};
addEventListener('tmhome',()=>{if(window.__mpSheet)window.__mpSheet.hide();scrollTok++;cur=null;window.__mpRouteQueue=null;const q=$('q');if(q)q.value='';sug([]);$('qr').innerHTML='';const box=$('mcards');if(box)box.innerHTML='';});
addEventListener('tmregion',e=>{const d=e.detail||{};if(d.kind==='mps')regionList(d.name,d.value);});
function pick(p){if(window.__mpSheet)window.__mpSheet.hide();if(cur===p.key)return;cur=p.key;sug([]);$('qr').innerHTML='';cardBox().innerHTML=renderPerson(p);const b=$('mapback');if(b)b.addEventListener('click',()=>{scrollTok++;$('q').value='';cur=null;sug([]);$('qr').innerHTML='';resetMap();});pushMap(p);scrollMap(false);}
document.querySelectorAll('.crow').forEach(e=>e.addEventListener('click',()=>showC(e.dataset.c)));
$('q').addEventListener('input',()=>{const raw=$('q').value.trim();const q=norm(raw);if(!q){cur=null;sug([]);$('qr').innerHTML='';resetMap();return;}const d=decide(q);if(d.one){sug([]);$('qr').innerHTML='';pick(d.one);return;}sug(d.hits);if(cur){cur=null;resetMap();}$('qr').innerHTML=!d.hits.length?'<p class="mpnone">이 이름은 자료에 없어요.</p>':(d.exact.length>1?'<p class="mpnone">같은 이름이 '+d.exact.length+'명이에요. 지역구를 보고 한 명을 고르세요.</p>':'');});
$('q').addEventListener('keydown',e=>{if(e.isComposing||e.key==='Process'||e.keyCode===229)return;if(e.key!=='Enter')return;e.preventDefault();const q=norm($('q').value);const d=decide(q);if(d.one)pick(d.one);else if(!d.hits.length)$('qr').innerHTML='<p class="mpnone">이 이름은 자료에 없어요.</p>';else if(d.exact.length>1)$('qr').innerHTML='<p class="mpnone">같은 이름이 '+d.exact.length+'명이에요. 지역구를 보고 한 명을 고르세요.</p>';else $('qr').innerHTML='<p class="mpnone">여러 명이에요. 목록에서 한 명을 고르세요.</p>';});
// 4 대북
const MK='https://www.mk.co.kr/news/economy/12180428',AE='https://www.asiae.co.kr/article/2024101109335819503',CS='https://www.chosun.com/politics/assembly/2025/10/13/IMKVCK62LZFV7MFWB6U7VGJTE4/',NS='https://www.newsspirit.kr/news/articleView.html?idxno=25440';
const nd=(t,s)=>`<div class="node"><b>${t}</b>${s?`<div class="sub">${s}</div>`:''}</div>`,ar=t=>`<div class="arr">↓ ${t}</div>`;
$('nk').innerHTML=`<div class="note"><b>남북협력기금</b>: 남북이 함께하는 일에 쓰려고 나라가 따로 모아 둔 돈이에요.<br><b>차관</b>: 나라끼리 돈이나 물건을 빌려주고 나중에 갚기로 한 것이에요.<br><b>수탁</b>: 남의 돈을 맡아서 대신 관리하는 것이에요.</div><p class="sub">아래 두 가지는 서로 다른 돈이라 따로 봐요.</p>
<h3>① 경수로(원자력발전소) 짓기</h3><div class="flow">${nd('남북협력기금','2000~2006년, 이자 없이 빌려줌')}${ar('무이자 대출')}${nd('한반도에너지개발기구(KEDO) · 경수로 사업','대출 <b>1조 3,744억원</b>')}</div>
<div class="note">기금이 이 돈을 마련하면서 진 빚의 이자는 세금으로 냈어요. 2012년부터 2026년 9월까지 약 <b>1조 500억원</b>이에요. ${S(MK,'매일경제 2026.10.20')} · 참고 ${S(AE,'아시아경제')}</div>
<h3>② 식량·자재 차관</h3><div class="flow">${nd('남북협력기금(통일부)','')}${ar('맡아서 관리(수탁)')}${nd('한국수출입은행','')}${ar('빌려줌(차관) · 2000~2007년')}${nd('북한','모두 <b>9억 3,290만 달러</b>: 식량 7억 2천만 + 자재 1억 3,290만 + 경공업 원자재 8천만 달러')}</div>
<div class="row"><span>돌려받은 것<br>${S(CS,'조선일보 2025.10.13')}</span><b>아연괴 240만 달러어치</b></div>
<div class="row"><span>아직 못 받은 돈(2025년 8월 말 기준)<br><span class="sub">연체된 원금 + 이자 + 늦게 갚아서 붙는 배상금, 6억 2,020만 달러</span><br>${S(CS,'조선일보')} · ${S(NS,'뉴스스피릿')}</span><b>8,853억원</b></div>`;
$('miss').textContent='정당·의원의 후원금과 쓴 곳(선관위 정치자금 공개 자료), 의원별 실제로 받은 돈과 의원실이 쓴 돈, 국회 특수활동비·업무추진비 쓴 내역.';
})();
