const W=n=>{n=Math.round(n);if(n>=1e8)return (n/1e8).toFixed(n>=1e10?0:1).replace(/\.0$/,'')+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString()+'만';return n.toLocaleString()};
const E=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SRC='출처: 조달청 나라장터 계약정보(공공데이터포털 15058815)';
document.querySelectorAll('.stabs a').forEach(a=>a.onclick=()=>{document.querySelectorAll('.stabs a').forEach(b=>b.classList.toggle('on',b===a))});
fetch('data/sec_sole.json',{cache:'no-cache'}).then(r=>r.json()).then(d=>{
  const $=id=>document.getElementById(id);
  $('s-upd').textContent=d.updated.slice(5,16).replace('T',' ')+' KST';
  // 카운터
  let t0=performance.now();const tick=t=>{const p=Math.min(1,(t-t0)/1200);$('c-sum').textContent='₩'+W(d.sum*p);if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick);
  $('c-meta').textContent=`${d.n.toLocaleString()}건 · 전체 새 계약의 ${Math.round(d.n/d.n_all*100)}% · ${d.period[0]}~${d.period[1]} · ${SRC}`;
  // 터미널 피드
  const lines=['> 85개 시 계약 스캔 중…',`> 수의계약 ${d.n.toLocaleString()}건 확인`,...d.flags.slice(0,5).map((f,i)=>`> [#${String(i+1).padStart(3,'0')}] ${f.cname} · ${f.n}건 묶음 ₩${W(f.sum)} 발견`),`> 데이터상 이상 징후 ${d.flag_n}건 · 해명 대기`,'> TRACKING… █'];
  let i=0;const feed=$('feed');feed.textContent='';const step=()=>{if(i<lines.length){feed.textContent+=lines[i++]+'\n';setTimeout(step,450)}};step();
  // 오늘의 추적 대상
  if(d.flags.length){const f=d.flags[new Date().getDate()%Math.min(d.flags.length,7)];
    $('spot').innerHTML=`<div class="spot"><p class="eyebrow">🎯 오늘의 추적 대상</p><b>${E(f.inst)}</b> → <b>${E(f.vendor)}</b><br>30일 안에 ${f.n}건 · 합계 ₩${W(f.sum)}<p class="src">${SRC}</p></div>`}
  // 추적 파일
  $('cases').innerHTML=d.flags.map((f,i)=>`<div class="case"><span class="stamp">해명 대기</span><div class="no">🔍 추적 파일 #${String(i+1).padStart(3,'0')}</div>
   <h3>${E(f.cname)} · ${f.n}건 수의계약 묶음</h3>
   <div class="trail"><b>${E(f.inst)}</b><i></i><b>${E(f.vendor)}</b>${f.vregion?`<small>(${E(f.vregion.split(' ').slice(0,2).join(' '))})</small>`:''}</div>
   <div class="amt">₩${W(f.sum)}</div><small>${f.from} ~ ${f.to} · 건마다 2천만원 이하</small>
   <ul>${f.items.map(x=>`<li>${x.d} ${E(x.t)} · ₩${W(x.a)} ${x.u?`<a href="${E(x.u)}" target="_blank">원문</a>`:''}</li>`).join('')}</ul>
   <p class="src">데이터상 이상 징후 · 위법 판단 아님 · ${SRC}</p></div>`).join('')||'<p class="sub">아직 없습니다.</p>';
  // 비율
  $('share').innerHTML=d.share.slice(0,10).map(s=>{const p=Math.round(s.sn/s.n*100);return `<div class="row"><b>${E(s.name)}</b> 새 계약 ${s.n}건 중 수의계약 ${s.sn}건 (${p}%)<div class="bar"><b style="width:${p}%"></b></div></div>`}).join('')+`<p class="src">나라장터 공개 계약 기준(소액·긴급 수의계약은 법에서 허용) · ${SRC}</p>`;
  // 비용 비교 + 추정
  $('comp').innerHTML=(d.comp||[]).map((c,i)=>`<div class="rcp"><div class="no">🧾 영수증 #${String(i+1).padStart(3,'0')} · '${E(c.kw)}' 계약</div>
   <div class="l"><span>${E(c.city)} 중앙값 (${c.cn}건)</span><b>₩${W(c.cmed)}</b></div>
   <div class="l"><span>전국 중앙값 (${c.cities}개 시, ${c.n}건)</span><b>₩${W(c.med)}</b></div>
   <div class="l"><span>중앙값 대비</span><b style="color:#e11d48">+${c.pct}%</b></div>
   <div class="l"><span>만약 중앙값이었다면 절감 가능액 <span class="tag">추정</span></span><span class="save">₩${W(c.save)}</span></div>
   <details class="est"><summary>AI 추산 적정 비용 · 추정치 · 공식 금액 아님 · 산출 근거 보기</summary>
   범위 ₩${W(c.p25)} ~ ₩${W(c.p75)} (전국 비슷한 계약의 하위 25%~상위 25%)<br>기준: 제목에 '${E(c.kw)}'가 들어간 새 수의계약 ${c.n}건의 중앙값 ₩${W(c.med)}<br>${E(c.city)} 중앙값과의 차이: ₩${W(c.cmed-c.med)} / 건<br>한계: 면적·수량·기간을 모르기 때문에 큰 일이면 당연히 비쌉니다. 위법 판단이 아닙니다.</details>
   <p class="src">${SRC}</p></div>`).join('');
});
// 알리오 공식 통계(2024년 말 기준, 천원) — alio.go.kr/statistics/employeeAvg.do
const PAY=[['전체',71695,1797],['공기업',86024,1411],['준정부기관',74131,1550],['기타공공기관',69362,1904]];
document.getElementById('paybox').innerHTML=PAY.map(([k,v,dlt])=>`<div class="rcp"><div class="l"><span>${k} 직원 평균보수</span><b>${(v/10).toLocaleString(undefined,{maximumFractionDigits:0})}만원</b></div><div class="l"><span>전년 대비</span><span>+${Math.round(dlt/10)}만원</span></div></div>`).join('')+`<div class="rcp"><div class="l"><span>신입 평균초임 (전체)</span><b>3,896만원</b></div></div>`;
