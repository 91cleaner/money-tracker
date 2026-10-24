(async()=>{
const D='data/nps/',$=id=>document.getElementById(id),j=f=>fetch(D+f).then(r=>r.json());
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S=(u,t)=>`<span class="src">출처 <a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></span>`;
const krw=n=>{const neg=n<0;n=Math.abs(Math.round(n));const jo=Math.floor(n/1e12),eok=Math.round((n%1e12)/1e8);let s=jo?jo.toLocaleString()+'조'+(eok?' '+eok.toLocaleString()+'억':'')+'원':eok?eok.toLocaleString()+'억원':Math.round(n/1e4).toLocaleString()+'만원';return (neg?'-':'')+s;};
const usd=n=>'$'+(n/1e9).toFixed(2)+'B';
const [ft,q1,q2,ch]=await Promise.all([j('fund_totals.json'),j('holdings_us_2026Q1.json'),j('holdings_us_2026Q2.json'),j('changes_us.json')]);
$('upd').textContent=String(ch.updated||'').slice(0,10);
// 1 기금
const hy=ft.half_year_release;
let h=`<div class="big">1,865조 5,760억원</div><p class="sub">2026년 6월 말 기준 기금 적립금(쌓아 둔 돈) ${S(hy.url,'국민연금 상반기 보도자료(2026.8.28)')}</p>`;
if(hy.by_asset){const mx=Math.max(...Object.values(hy.by_asset).map(v=>v.value_billion_krw));
 h+=`<h3>어디에 나눠 두었나 (2026년 6월 말)</h3>`+Object.entries(hy.by_asset).map(([k,v])=>`<div class="row"><span>${esc(k)} <span class="sub">${v.weight_pct}%</span><div class="bar" style="width:${Math.max(2,v.value_billion_krw/mx*100)}%"></div></span><b>${krw(v.value_billion_krw*1e8)}</b></div>`).join('')+`<p class="src">같은 보도자료 기준이에요. ${S(hy.url,'국민연금')}</p>`;}
$('fund').innerHTML=h;
// 2 미국 주식
const FX={Q1:q1.fx,Q2:q2.fx};
const card=(q,fx,lab)=>`<div class="card"><div class="sub">${lab} (${q.period.replace(/-/g,'.')} 기준)</div><div class="big" style="font-size:24px">약 ${krw(q.total_value_usd*fx.usd_krw)}</div><div class="sub">${q.count}종목 · ${usd(q.total_value_usd)} · 환율 ${fx.usd_krw.toLocaleString()}원/$ (${fx.date.replace(/-/g,'.')}, ${S(fx.source,'연합뉴스')})</div>${S(q.filing_url,'SEC 13F 공시')}</div>`;
h=`<p class="sub">미국에서는 큰 투자자가 3달마다 가진 미국 주식을 공개해야 해요(13F 공시). 국민연금(SEC 등록번호 CIK 0001608046)도 내요. 원화는 분기 말 환율로 바꾼 <b>어림값</b>이에요.</p>
<div class="two">${card(q2,FX.Q2,'2026년 2분기')}${card(q1,FX.Q1,'2026년 1분기')}</div>
<h3>가장 많이 가진 미국 주식 10개 (2026년 2분기)</h3>`;
const t=q2.top20.slice(0,10),tm=t[0].value_usd;
h+=t.map((x,i)=>`<div class="row"><span>${i+1}. ${esc(x.issuer)}<div class="bar" style="width:${x.value_usd/tm*100}%"></div></span><b>${krw(x.value_usd*FX.Q2.usd_krw)}</b></div>`).join('')+`<p class="src">회사 이름은 공시 원문 영어 그대로예요. ${S(q2.infotable_url,'SEC 13F 보유 목록')}</p>`;
$('us').innerHTML=h;
// 3 변화
const BAD=/DUPONT|FEDEX|QNITY/i;
const adj=x=>x.adjustment?`<span class="tag y">${esc(x.adjustment.type)} 반영</span>`:'';
const st=x=>x.status==='신규'?'<span class="tag">새로 산 주식</span>':x.status==='전량매도'||x.status==='청산'?'<span class="tag">모두 판 주식</span>':'';
const list=(a,cls)=>{const ok=a.filter(x=>x.real!==false&&!x.suspect_note&&!BAD.test(x.issuer)).slice(0,10),m=Math.max(...ok.map(x=>Math.abs(x.est_trade_usd)));
 return ok.map((x,i)=>`<div class="row"><span>${i+1}. ${esc(x.issuer)} ${st(x)}${adj(x)}<div class="bar ${cls}" style="width:${Math.abs(x.est_trade_usd)/m*100}%"></div></span><b>${krw(Math.abs(x.est_trade_usd)*FX.Q2.usd_krw)}</b></div>`).join('');};
const flagged=[...ch.top_buys,...ch.top_sells].filter(x=>x.suspect_note||x.real===false||BAD.test(x.issuer)).map(x=>x.issuer);
h=`<p class="sub">2026년 1분기 → 2분기 사이 주식 수가 얼마나 변했는지 보고 계산했어요.</p>
<div class="note"><b>추정 거래액(주식수 변화×분기말 가격)</b>이에요. 실제로 사고판 값이 아니라, 늘거나 줄어든 주식 수에 2분기 말 가격을 곱한 어림값이에요. 원화는 ${FX.Q2.usd_krw.toLocaleString()}원/$로 바꿨어요.</div>
<div class="two"><div><h3>많이 늘린 주식 10개</h3>${list(ch.top_buys,'g')}</div><div><h3>많이 줄인 주식 10개</h3>${list(ch.top_sells,'r')}</div></div>
<h3>주식 쪼개기·회사 나누기 보정</h3><p class="sub">주식을 쪼개면(분할) 가진 주식 수가 늘어나 보여요. 아래는 공식 공시를 보고 맞춰 계산했어요.</p>`+
ch.adjustments.map(a=>`<div class="row"><span>${esc(a.issuer)} · ${esc(a.type)} <span class="sub">${esc(a.date)}</span><br>${S(a.basis,'공시')}</span></div>`).join('')+
`<div class="note">확인 필요: ${[...new Set(['DuPont','FedEx Freight',...flagged.filter(n=>!/DUPONT|FEDEX/i.test(n))])].map(esc).join(', ')}은(는) 회사 나누기 같은 변화가 있어서 목록에서 뺐어요. 그 밖의 회사 변화는 맞추지 못했을 수 있어요.</div>
<p class="src">${S(ch.sources[0],'SEC 13F 2026년 1분기')} · ${S(ch.sources[1],'SEC 13F 2026년 2분기')}</p>`;
$('chg').innerHTML=h;
})();
