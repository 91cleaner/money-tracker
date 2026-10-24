(async()=>{
const D='data/national/',$=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const won=n=>{if(n==null)return '확인 중';n=Math.round(n);const e=Math.floor(n/1e8),m=Math.round((n%1e8)/1e4);if(e)return e.toLocaleString()+'억'+(m?' '+m.toLocaleString()+'만':'')+'원';return m.toLocaleString()+'만원';};
const S=(u,t)=>u?`<span class="src">출처 <a href="${esc(u)}" target="_blank" rel="noopener">${esc(t||'원문')}</a></span>`:'<span class="src">출처 확인 중</span>';
const j=f=>fetch(D+f).then(r=>r.json());
const csv=f=>fetch(D+f).then(r=>r.text()).then(t=>{const L=t.replace(/^\ufeff/,'').trim().split(/\r?\n/).map(l=>{const o=[];let c='',q=0;for(const ch of l){if(ch=='"')q=!q;else if(ch==','&&!q){o.push(c);c=''}else c+=ch}o.push(c);return o});const h=L.shift();return L.map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])))});
const [sup,par,flw,prj,idx,trw,tm,tp,td]=await Promise.all([j('support.json'),j('parties.json'),j('flows.json'),j('projects.json'),j('index.json'),j('trips_raw.json'),csv('trips_by_member.csv'),csv('trips_by_party.csv'),csv('trips_top_dest.csv')]);
$('upd').textContent=idx.updated||sup.updated;
// 1 의원 1명
const a=sup.allowance.find(x=>x.amount)||sup.allowance[0];
const mx=Math.max(...Object.values(a.parts));
let h=`<p class="sub">${a.year}년 국회의원 1명에게 1년 동안 주도록 정해 둔 돈(지급기준)</p><div class="big">${won(a.amount)}</div><p class="sub">실제로 받은 돈이 아니라 '이만큼 준다'고 정한 기준이에요. ${S(a.src,a.src_note)}</p>`;
for(const [k,v] of Object.entries(a.parts).sort((x,y)=>y[1]-x[1]))h+=`<div class="row"><span>${esc(k)}<div class="bar" style="width:${Math.max(4,v/mx*100)}%"></div></span><b>${won(v)}</b></div>`;
h+=`<h3>의원실 하나에 주는 운영비</h3>`;
for(const o of sup.office_support)h+=`<div class="row"><span>${esc(o.item)} <span class="sub">(${esc(o.unit)})</span><br>${S(o.src,'열린국회정보')}</span><b>${won(o.amount)}</b></div>`;
const n=(idx.seats&&299)||299;
h+=`<div class="note">의원 ${n}명 모두에게 같은 기준을 적용하면 1년 ${won(a.amount*n)}이에요(계산값). ${S(a.src,a.src_note)}</div>`;
$('mp').innerHTML=h;
// 2 정당
const pf=flw.flows.filter(f=>!/수당/.test(f.kind));
const pmax=Math.max(...par.parties.map(p=>p.total||0));
h=`<p class="sub">정당이 나라에서 받은 보조금이에요. 자료에 있는 분기·선거만 더했어요.</p>`;
for(const p of par.parties){const fs=pf.filter(f=>f.to.party===p.party);
 h+=`<div class="row"><span><b style="color:#fff">${esc(p.party)}</b> <span class="sub">의석 ${p.seats}</span><div class="bar b" style="width:${Math.max(1,(p.total||0)/pmax*100)}%"></div>`+
 fs.map(f=>`<div class="sub">${f.year} ${esc(f.period||'')} ${esc(f.kind)} ${won(f.amount)} · ${S(f.src,/nec/.test(f.src)?'선관위':'보도')}</div>`).join('')+
 (fs.length?'':'<div class="sub">자료에 받은 기록이 없어요</div>')+`</span><b>${p.total?won(p.total):'—'}</b></div>`;}
if(par.rules)h+=`<div class="note">${esc(par.rules.text)} ${S(par.rules.src,'정치자금법')}</div>`;
$('pt').innerHTML=h;
// 3 국외활동
const ART='https://www.sisajournal.com/news/articleView.html?idxno=362332';const TS='https://open.assembly.go.kr/portal/openapi/nasnutdbapnfphwyr';
const reports=new Set(trw.trips.map(t=>t.trip_id)).size;
h=`<div class="note">국회의원이 외국에 다녀왔다고 국회에 신고한 기록이에요. 돈은 <b>자비·외교부·외국 정부·재단</b> 등 다양한 곳에서 냈어요. 모두 세금으로 간 건 아니에요.</div>
<p class="sub">신고 ${trw.count_raw||reports}건 · 의원 참가 ${trw.trips.length}번 ${S(TS,'열린국회정보 국외활동')}</p>
<h3>여의도에서 간 나라 <span class="sub">(선 굵기 = 신고 건수)</span></h3><p class="sub">나라나 선을 누르면 그 나라에 다녀온 기록이 나와요. 국회 자료에는 비용이 없어서 선에 돈을 적지 않았어요.</p><div id="tmap"></div><div id="cp"></div>
<div class="note">보도로 확인된 비용: 2025년 16개 상임위원회 해외출장 35팀, 순수 경비 <b>11억 3,800만원</b>(정보공개청구 자료). 이 지도의 신고 기록과 범위가 다를 수 있어요. ${S(ART,'시사저널 2026.2.9')}</div><h3>많이 간 나라 10곳 <span class="sub">(신고 건수 · 누르면 기록)</span></h3>`;
const tmax=Math.max(...td.map(r=>+r.reports));
h+=td.map((r,i)=>`<div class="row crow" data-c="${esc(r.destination)}" role="button" tabindex="0"><span>${i+1}. ${esc(r.destination)}<div class="bar" style="width:${r.reports/tmax*100}%"></div></span><b>${r.reports}건</b></div>`).join('');
const inf=trw.trips.filter(t=>t.dest_inferred).length;
h+=`<p class="src">${inf}번은 나라 칸이 비어 있어서 목적 문구로 나라를 추정했어요. ${S(TS,'열린국회정보')}</p>`;
const sd=tp[0]||{};
h+=`<h3>정당별 참가 횟수</h3><table><tr><th>정당</th><th>참가 횟수(동행 포함)</th><th>현재 의석</th><th>의석당</th></tr>`+tp.filter(r=>r.party!=='미매칭').map(r=>`<tr><td>${esc(r.party)}</td><td>${r['참가 횟수(동행 포함)']}</td><td>${r['현재 의석']}</td><td>${r['의석당 참가 횟수(현재 의석 기준 근사치)']||'—'}</td></tr>`).join('')+`</table>
<p class="src">의석당 = 현재 의석 기준 근사치(그때와 지금 의석이 달라요). 의석 출처: ${esc(sd['의석 출처'])} · 기준일 ${esc(sd['의석 기준일'])}. ${S(TS,'참가 기록')}</p>
<h3>의원 이름으로 찾기</h3><input type="search" id="q" placeholder="예: 이재정" autocomplete="off"><div id="qr"></div>`;
$('tr').innerHTML=h;
const C={일본:[35.7,139.7],중국:[39.9,116.4],미국:[38.9,282.96],영국:[51.5,-.1],독일:[52.5,13.4],베트남:[21,105.8],호주:[-35.3,149.1],인도:[28.6,77.2],싱가포르:[1.35,103.8],우즈베키스탄:[41.3,69.2],필리핀:[14.6,121],튀르키예:[39.9,32.9],체코:[50.1,14.4],인도네시아:[-6.2,106.8],말레이시아:[3.1,101.7],홍콩:[22.3,114.2],오스트리아:[48.2,16.4],오스크리아:[48.2,16.4],캄보디아:[11.6,104.9],아랍에미리트:[24.5,54.4],우간다:[0.3,32.6],브라질:[-15.8,312.1],헝가리:[47.5,19],볼리비아:[-16.5,291.9],스위스:[46.9,7.4],태국:[13.8,100.5],대만:[25,121.5],벨기에:[50.8,4.4],폴란드:[52.2,21],캐나다:[45.4,284.3],이탈리아:[41.9,12.5],덴마크:[55.7,12.6],멕시코:[19.4,260.9],이집트:[30,31.2],몽골:[47.9,106.9],칠레:[-33.4,289.4],라오스:[18,102.6],프랑스:[48.9,2.35]};
const ACOST={프랑스:`<div class="note">보도로 확인된 비용: 예산결산특별위원회 의원 9명, 프랑스·포르투갈(2025.12~2026.1) <b>1억 7,688만원</b>. ${S(ART,'시사저널 2026.2.9')}</div>`};
const byT={};for(const t of trw.trips)(byT[t.trip_id]=byT[t.trip_id]||[]).push(t);
const cnt={};for(const [id,ts] of Object.entries(byT))for(const d of new Set(ts[0].dest))(cnt[d]=cnt[d]||new Set()).add(id);
const showC=c=>{const ids=[...(cnt[c]||[])];const box=$('cp');
 box.innerHTML=`<h3>${esc(c)} · 신고 ${ids.length}건</h3>`+(ACOST[c]||'')+ids.map(id=>{const ts=byT[id],t=ts[0];return `<div class="trip"><b>${esc(t.dates)}</b> ${t.dest_inferred?'<span class="tag y">목적 문구로 추정</span>':''}<br>
 <span class="sub">의원:</span> ${ts.map(x=>esc(x.name)+'<span class="sub">('+esc(x.party)+')</span>').join(', ')}<br>
 <span class="p">${esc(t.purpose)}</span><br>${[...new Set(ts.map(x=>x.funder||'적힌 곳 없음'))].map(f=>`<span class="tag">비용 낸 곳: ${esc(f)}</span>`).join('')}<span class="tag">신고 당시 결과보고서 ${ts.some(x=>x.report==='유')?'유':'무'}</span><br><span class="sub">신고서 첫 번째 기재 의원: ${esc((ts.find(x=>x.is_leader)||t).name)}</span> ${S(t.src,'열린국회정보')}</div>`}).join('');
 box.scrollIntoView({behavior:'smooth',block:'nearest'});};
try{const m=L.map('tmap',{zoomControl:false,worldCopyJump:false}).setView([30,130],1);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',{attribution:'© Esri',maxZoom:6}).addTo(m);
const se=[37.5319,126.914];const cmax=Math.max(...Object.values(cnt).map(x=>x.size));
const arc=(a,b)=>{const P=[],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,dx=b[1]-a[1],dy=b[0]-a[0],k=.18;const c=[mx+dx*k,my-dy*k];for(let i=0;i<=24;i++){const t=i/24,u=1-t;P.push([u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]]);}return P;};
const pts=[se];
for(const [c,ids] of Object.entries(cnt).sort((x,y)=>x[1].size-y[1].size)){const p=C[c];if(!p)continue;pts.push(p);const n=ids.size,w=1.5+n/cmax*7;
 L.polyline(arc(se,p),{color:'#ffb020',weight:w,opacity:.25,interactive:false}).addTo(m);
 const fl=L.polyline(arc(se,p),{color:'#ffd27a',weight:Math.max(1.5,w*.6),opacity:.95,className:'nflow'}).addTo(m);
 const mk=L.circleMarker(p,{radius:5+n/cmax*8,color:'#ffb020',weight:2,fillColor:'#ffb020',fillOpacity:.8}).addTo(m).bindTooltip(`${c} ${n}건`);
 [fl,mk].forEach(o=>o.on('click',()=>showC(c)));}
L.circleMarker(se,{radius:7,color:'#fff',weight:2,fillColor:'#4da3ff',fillOpacity:1}).addTo(m).bindTooltip('여의도 국회',{permanent:true,direction:'bottom',className:'ntip'});
m.fitBounds(pts,{padding:[10,10]});}catch(e){console.warn(e);$('tmap').remove();}

const show=q=>{q=q.trim();if(!q){$('qr').innerHTML='';return;}
 const ts=trw.trips.filter(t=>t.name.includes(q));const s=tm.find(r=>r.name===q);
 $('qr').innerHTML=(s?`<p class="sub">${esc(s.name)} · ${esc(s.party)} · 참가 횟수(동행 포함) ${s['참가 횟수(동행 포함)']}번 · 신고서 첫 번째 기재 의원 ${s['신고서 첫 번째 기재 의원']}번</p>`:'')+
 (ts.length?ts.slice(0,40).map(t=>{const w=(byT[t.trip_id]||[]).filter(x=>x!==t).map(x=>x.name);return `<div class="trip"><b>${esc(t.name)}</b> <span class="sub">${esc(t.party)}</span> · ${esc(t.dates)}<br>
 ${t.dest.map(d=>esc(d)).join(', ')} ${t.dest_inferred?'<span class="tag y">목적 문구로 추정</span>':''}${t.is_leader?'<span class="tag">신고서 첫 번째 기재 의원</span>':''}<br>
 <span class="p">${esc(t.purpose)}</span><br><span class="tag">비용 낸 곳: ${esc(t.funder||'적힌 곳 없음')}</span><span class="tag">신고 당시 결과보고서 ${t.report==='유'?'유':'무'}</span>${w.length?`<div class="sub">같이 간 의원: ${w.map(esc).join(', ')}</div>`:''}${S(t.src,'열린국회정보')}</div>`}).join(''):'<p class="sub">찾은 기록이 없어요.</p>');};
document.querySelectorAll('.crow').forEach(e=>e.addEventListener('click',()=>showC(e.dataset.c)));
$('q').addEventListener('input',e=>show(e.target.value));
// 4 대북
const nk=(prj.national_projects||[]).find(p=>p.id==='nk_loan');
if(nk){$('nk').innerHTML=`<p class="sub">${esc(nk.title)}</p><div class="flow">
<div class="node"><b>${esc(nk.from.name)}</b><div class="sub">나라가 따로 모아 둔 기금이에요. 빌려준 돈이라 세금을 그냥 준 것과는 달라요.</div></div><div class="arr">↓ 맡아서 관리</div>
<div class="node"><b>${esc(nk.via.name)}</b></div><div class="arr">↓ 빌려줌(차관)</div>
<div class="node"><b>${esc(nk.to.name)}</b><div class="sub">빌려준 금액 ${won(nk.amount)} · 돌려받은 금액 ${won(nk.repaid)}</div></div></div>
<div class="note">기금이 이 돈을 마련하려고 빌린 돈의 <b>이자는 세금으로</b> 냈어요. 금액과 출처는 확인 중이에요(데이터상 자료 준비 중). ${S(nk.src&&nk.src[0],'원문')}</div>`;}
$('miss').textContent=(idx.missing||[]).join(' / ');
})();
