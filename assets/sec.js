const W=n=>{n=Math.round(n);if(n>=1e8)return (n/1e8).toFixed(n>=1e10?0:1).replace(/\.0$/,'')+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString()+'만';return n.toLocaleString()};
const E=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const CQ=new URLSearchParams(location.search).get('c');
const IDX=fetch('data/index.json').then(r=>r.json()).then(d=>d.cities).catch(()=>[]);
let CN=null,CNAME='';
const CITYP=IDX.then(cs=>{const sel=document.getElementById('cityf');if(sel){sel.innerHTML='<option value="">전국 (모든 시)</option>'+cs.map(c=>`<option value="${c.slug}">${c.short}</option>`).join('');sel.value=CQ||'';sel.onchange=()=>{const u=new URL(location.href);sel.value?u.searchParams.set('c',sel.value):u.searchParams.delete('c');location.href=u.toString();};}
 const c=cs.find(x=>x.slug===CQ);if(c){CN=c.short;CNAME=c.name;const b=document.getElementById('cityf-note');if(b)b.innerHTML=`<b>${c.name}</b> 기준으로 보는 중 · 맨 위 큰 숫자는 전국 합계예요 · <a href="city.html?c=${c.slug}">${c.name} 페이지 ›</a>`;}});
const FL=a=>!CN||!a?a:a.filter(x=>(x.cname||x.name||x.city)===CN);
const LOAD=u=>Promise.all([fetch(u,{cache:'no-cache'}).then(r=>r.json()),CITYP]).then(([d])=>{if(CN)for(const k of ['flags','share','comp','top','perday','ratio','halls','rows','zero'])if(Array.isArray(d[k]))d[k]=FL(d[k]);return d;});
const EMPTY=ids=>setTimeout(()=>{if(!CN)return;ids.forEach(id=>{const el=document.getElementById(id);if(el&&!el.querySelector('.case,.row,.rcp,.spot'))el.innerHTML=`<p class="pend">아직 ${CNAME.replace(/(특별시|광역시|특별자치시)$/,'')} 데이터가 없어요.</p>`;});},50);
const SRC='출처: 조달청 나라장터 계약정보(공공데이터포털 15058815)';
LOAD('data/sec_sole.json').then(d=>{
  const $=id=>document.getElementById(id);
  $('s-upd').textContent=d.updated.slice(5,16).replace('T',' ')+' KST';
  // 카운터
  let t0=performance.now();const tick=t=>{const p=Math.min(1,(t-t0)/1200);$('c-sum').textContent='₩'+W(d.sum*p);if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick);
  $('c-meta').textContent=`최근 30일(${d.period[0]}~${d.period[1]}) · 85개 시 · ${d.n.toLocaleString()}건 · 같은 기간 새 계약 ${d.n_all.toLocaleString()}건 중 ${Math.round(d.n/d.n_all*100)}% (건수 기준) · ${SRC}`;
  // 터미널 피드
  const lines=['> 85개 시 계약 스캔 중…',`> 수의계약 ${d.n.toLocaleString()}건 확인`,...d.flags.slice(0,5).map((f,i)=>`> [#${String(i+1).padStart(3,'0')}] ${f.cname} · ${f.n}건 묶음 ₩${W(f.sum)} 발견`),`> 데이터상 이상 징후 ${d.flag_n}건 · 기관 설명 확인 전`,'> TRACKING… █'];
  let i=0;const feed=$('feed');feed.textContent='';const step=()=>{if(i<lines.length){feed.textContent+=lines[i++]+'\n';setTimeout(step,450)}};step();
  // 오늘의 추적 대상
  if(d.flags.length){const f=d.flags[new Date().getDate()%Math.min(d.flags.length,7)];
    $('spot').innerHTML=`<div class="spot"><p class="eyebrow">🎯 오늘의 데이터 이상 징후</p><b>${E(f.inst)}</b> → <b>${E(f.vendor)}</b><br>30일 안에 ${f.n}건 · 합계 ₩${W(f.sum)}<p class="src">${SRC}</p></div>`}
  // 추적 파일
  $('cases').innerHTML=d.flags.map((f,i)=>`<div class="case"><span class="stamp">데이터상 이상 징후</span><div class="no">🔍 추적 파일 #${String(i+1).padStart(3,'0')}</div>
   <h3>${E(f.cname)} · ${f.n}건 수의계약 묶음</h3>
   <div class="trail"><b>${E(f.inst)}</b><i></i><b>${E(f.vendor)}</b>${f.vregion?`<small>(${E(f.vregion.split(' ').slice(0,2).join(' '))})</small>`:''}</div>
   <div class="amt">₩${W(f.sum)}</div><small>${f.from} ~ ${f.to} · 건마다 2천만원 이하</small>
   <ul>${f.items.map(x=>`<li>${x.d} ${E(x.t)} · ₩${W(x.a)} ${x.u?`<a class="orig" href="${E(x.u)}" target="_blank" rel="noopener">원문</a>`:''}</li>`).join('')}</ul>
   <p class="steps">수집 ✓ → 분석 ✓ → 기관 설명 확인 전</p><p class="src">데이터상 이상 징후 · 위법 판단 아님 · ${SRC}</p></div>`).join('')||'<p class="sub">아직 없습니다.</p>';
  // 비율
  $('share').innerHTML=d.share.slice(0,10).map(s=>{const p=Math.round(s.sn/s.n*100);return `<div class="row"><b>${E(s.name)}</b> 새 계약 ${s.n}건 중 수의계약 ${s.sn}건 (${p}%)<div class="bar"><b style="width:${p}%"></b></div></div>`}).join('')+`<p class="src">나라장터 공개 계약 기준(소액·긴급 수의계약은 법에서 허용) · ${SRC}</p>`;
  // 비용 비교 + 추정
  $('comp').innerHTML=(d.comp||[]).map((c,i)=>`<div class="rcp"><div class="no">🧾 영수증 #${String(i+1).padStart(3,'0')} · '${E(c.kw)}' 계약</div>
   <div class="l"><span>${E(c.city)} 중앙값 (${c.cn}건)</span><b>₩${W(c.cmed)}</b></div>
   <div class="l"><span>전국 중앙값 (${c.cities}개 시, ${c.n}건)</span><b>₩${W(c.med)}</b></div>
   <div class="l"><span>중앙값 대비 <abbr title="중앙값 = 비슷한 계약을 금액순으로 줄 세웠을 때 딱 가운데 값. +100%면 가운데 값의 2배라는 뜻이에요.">ⓘ</abbr></span><b style="color:#e11d48">+${c.pct}%</b></div>
   <div class="l"><span>만약 중앙값이었다면 절감 가능액 <span class="tag">추정</span></span><span class="save">₩${W(c.save)}</span></div>
   <details class="est"><summary>AI 추산 적정 비용 <small>(공개 통계로 계산한 참고 범위)</small> · 추정치 · 공식 금액 아님 · 산출 근거 보기</summary>
   범위 ₩${W(c.p25)} ~ ₩${W(c.p75)} (전국 비슷한 계약의 하위 25%~상위 25%)<br>기준: 제목에 '${E(c.kw)}'가 들어간 새 수의계약 ${c.n}건의 중앙값 ₩${W(c.med)}<br>${E(c.city)} 중앙값과의 차이: ₩${W(c.cmed-c.med)} / 건<br>한계: 면적·수량·기간을 모르기 때문에 큰 일이면 당연히 비쌉니다. 위법 판단이 아닙니다.</details>
   <p class="src">${SRC}</p></div>`).join('');
  EMPTY(['cases','share','comp']);
});
// 알리오 공식 통계(2024년 말 기준, 천원) — alio.go.kr/statistics/employeeAvg.do
const PAY=[['전체',71695,1797],['공기업',86024,1411],['준정부기관',74131,1550],['기타공공기관',69362,1904]];
document.getElementById('paybox').innerHTML=PAY.map(([k,v,dlt])=>`<div class="rcp"><div class="l"><span>${k} 직원 평균보수</span><b>${(v/10).toLocaleString(undefined,{maximumFractionDigits:0})}만원</b></div><div class="l"><span>전년 대비</span><span>+${Math.round(dlt/10)}만원</span></div></div>`).join('')+`<div class="rcp"><div class="l"><span>신입 평균초임 (전체)</span><b>3,896만원</b></div></div>`;
const ymd=s=>s?`${s.slice(0,4)}.${s.slice(4,6)}.${s.slice(6,8)}`:'';
const LSRC=y=>`출처: 행정안전부 지방재정365 OpenAPI${y?` · ${y}회계연도 결산`:''}`;
LOAD('data/sec_fest.json').then(f=>{
  const $=id=>document.getElementById(id);
  $('f-sum').textContent='₩'+W(f.sum);
  $('f-meta').textContent=`${f.year}년 원가 공개 행사 ${f.n}건(추적 중인 시) · 전국 ${f.n_all}건 중앙값 ₩${W(f.med)} · ${LSRC(f.year)} 행사축제원가회계정보`;
  const top=f.top[0]||{cname:'',nm:'',cost:0};const L=['> 지방재정365 행사 원가 스캔…',`> ${f.year}년 행사 ${f.n_all}건 확인`,`> 최대: ${top.cname} '${top.nm}' ₩${W(top.cost)}`,`> 고비용 상위 중 사업수익 0원 ${f.zero.length}건 (무료 행사일 수 있음)`,'> 데이터상 이상 징후 분류 완료 · 기관 설명 확인 전','> TRACKING… █'];
  let i=0;const fd=$('f-feed');fd.textContent='';const st=()=>{if(i<L.length){fd.textContent+=L[i++]+'\n';setTimeout(st,450)}};st();
  const sp=f.top[new Date().getDate()%Math.max(1,Math.min(5,f.top.length))];
  if(sp)$('f-spot').innerHTML=`<div class="spot"><p class="eyebrow">🎯 오늘의 데이터 이상 징후</p><b>${E(sp.cname)} · ${E(sp.nm)}</b><br>총비용 ₩${W(sp.cost)} · 사업수익 ₩${W(sp.rev)} · ${sp.days||'?'}일<p class="src">${LSRC(f.year)}</p></div>`;
  const card=(r,i,tag)=>`<div class="case"><span class="stamp">${r.rev>0?'수익 있음':'데이터상 이상 징후'}</span><div class="no">🔍 ${tag} #${String(i+1).padStart(3,'0')}</div>
   <h3>${E(r.cname)} · ${E(r.nm)}</h3><div class="amt">₩${W(r.cost)}</div>
   <small>${ymd(r.from)} ~ ${ymd(r.to)} · ${r.days||'?'}일${r.perday?` · 하루 ₩${W(r.perday)}`:''} · 주최 ${E(r.gov)}</small>
   <div class="rcp"><div class="l"><span>사업수익(입장료 등)</span><b>₩${W(r.rev)}</b></div><div class="l"><span>순원가(세금 부담)</span><b>₩${W(r.net)}</b></div>
   <div class="l"><span>전국 행사 중앙값 대비 <abbr title="중앙값 = 전국 행사를 비용순으로 줄 세웠을 때 가운데 값. +100%면 그 2배예요.">ⓘ</abbr></span><b style="color:#e11d48">${r.pct>=0?'+':''}${r.pct}%</b></div></div>
   <details class="est"><summary>AI 추산 적정 비용 <small>(공개 통계로 계산한 참고 범위)</small> · 추정치 · 공식 금액 아님 · 산출 근거 보기</summary>범위 ₩${W(f.p25)} ~ ₩${W(f.p75)} (${f.year}년 전국 원가 공개 행사 ${f.n_all}건의 하위 25%~상위 25%)<br>${r.days?`하루당 기준: 전국 중앙값 ₩${W(f.med_perday)} × ${r.days}일 = ₩${W(f.med_perday*r.days)}<br>`:''}한계: 국제 행사·체육대회처럼 규모가 큰 행사는 당연히 비쌉니다. 방문객 수가 없어 효율은 판단하지 않습니다.</details>
   <p class="src">참고 비교 · 위법 판단 아님 · ${LSRC(f.year)} 행사축제원가회계정보</p></div>`;
  $('f-top').innerHTML=f.top.slice(0,8).map((r,i)=>card(r,i,'행사 파일')).join('');
  $('f-day').innerHTML=f.perday.slice(0,6).map(r=>`<div class="row"><b>${E(r.cname)}</b> ${E(r.nm)} · ${r.days}일 · 하루 ₩${W(r.perday)} <small>(전국 중앙값 하루 ₩${W(f.med_perday)})</small></div>`).join('')+`<p class="src">${LSRC(f.year)}</p>`;
  const mx=Math.max(1,...f.ratio.map(r=>r.rt));
  $('f-ratio').innerHTML=f.ratio.slice(0,10).map(r=>`<div class="row"><b>${E(r.cname)}</b> 예산 ₩${W(r.budget)} 중 행사·축제 ₩${W(r.fest)} (${r.rt}%)<div class="bar"><b style="width:${r.rt/mx*100}%"></b></div></div>`).join('')+`<p class="src">${LSRC()} 행사·축제경비편성내역 · ${f.ratio[0]?.y||''}년 일반회계 당초예산</p>`;
  $('f-hall').innerHTML=f.halls.slice(0,6).map((h,i)=>`<div class="rcp"><div class="no">🧾 청사 영수증 #${String(i+1).padStart(3,'0')} · ${E(h.ty)}</div><b>${E(h.cname)} · ${E(h.nm)}</b> <small>(${h.y})</small>
   <div class="l"><span>총사업비</span><b>₩${W(h.amt)}</b></div><div class="l"><span>㎡당 사업비</span><b>₩${W(h.puar)}</b></div>
   <div class="l"><span>같은 종류 전국 중앙값 (${h.tyn}건)</span><b>₩${W(h.tymed)}</b></div><div class="l"><span>중앙값 대비 <abbr title="중앙값 = 비슷한 계약을 금액순으로 줄 세웠을 때 딱 가운데 값. +100%면 가운데 값의 2배라는 뜻이에요.">ⓘ</abbr></span><b style="color:#e11d48">+${h.pct}%</b></div>
   ${h.area?`<div class="l"><span>만약 중앙값이었다면 절감 가능액 <span class="tag">추정</span></span><span class="save">₩${W(Math.max(0,h.amt-h.area*h.tymed))}</span></div>
   <details class="est"><summary>AI 추산 적정 비용 <small>(공개 통계로 계산한 참고 범위)</small> · 추정치 · 공식 금액 아님 · 산출 근거 보기</summary>면적 약 ${h.area.toLocaleString()}㎡ (공시 총사업비 ÷ ㎡당 사업비로 역산) × 같은 종류 ㎡당 하위25%~상위25% 단가(₩${W(h.p25)}~₩${W(h.p75)})<br>= 추정 범위 ₩${W(h.est_lo)} ~ ₩${W(h.est_hi)} · 실제 ₩${W(h.amt)}<br>한계: 땅값·철거·복합시설·증축 여부를 반영하지 못합니다.</details>`:''}
   <p class="src">${LSRC()} 청사신축원가회계정보</p></div>`).join('');
  EMPTY(['f-top','f-day','f-ratio','f-hall']);
}).catch(()=>{});
LOAD('data/sec_subsidy.json').then(s=>{
  const $=id=>document.getElementById(id);
  $('s-sum').textContent='₩'+W(s.plan);
  $('s-meta').textContent=`${s.year}년 당초예산 · ${s.n}곳 · 한도 밖 편성 합계 ₩${W(s.outsum)} · ${LSRC()} 지방보조금(2021년 이후)`;
  $('s-rows').innerHTML=s.rows.slice(0,25).map((o,i)=>{const mx=Math.max(...o.hist.map(h=>h[1]||0))||1;return `<div class="case"><span class="stamp">${o.over?'추적 중':'한도 안'}</span><div class="no">🔍 보조금 파일 #${String(i+1).padStart(3,'0')}</div>
   <h3>${E(o.cname)} <small>(${E(o.gov)})</small></h3>
   <div class="rcp"><div class="l"><span>총액한도</span><b>₩${W(o.limit)}</b></div><div class="l"><span>편성액</span><b>₩${W(o.plan)}</b></div><div class="l"><span>한도 밖 편성</span><b style="color:#e11d48">₩${W(o.out||0)}</b></div></div>
   <div class="mini">${o.hist.map(h=>`<i title="${h[0]}" style="height:${(h[1]||0)/mx*100}%"></i>`).join('')}</div><small>${o.hist.map(h=>h[0]).join(' · ')} 편성액 추이</small>
   <p class="src">한도 밖 편성은 법령·국고보조 매칭 등 허용된 예외일 수 있습니다 · ${LSRC()} 지방보조금 · ${s.year}년 당초예산</p></div>`}).join('');
  EMPTY(['s-rows']);
}).catch(()=>{});
// 탭 해시 동기화
