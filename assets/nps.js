(async()=>{
const D='data/nps/',$=id=>document.getElementById(id),j=f=>fetch(D+f).then(r=>r.json());
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const idx=u=>{const m=String(u||'').match(/^(https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/\d+\/(\d{18}))\/?(?:[^/?#]+\.xml)?$/i);if(!m)return u;const id=m[2];return m[1]+'/'+id.slice(0,10)+'-'+id.slice(10,12)+'-'+id.slice(12)+'-index.html';};
const S=(u,t)=>`<span class="src">출처 <a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></span>`;
const krw=n=>{const neg=n<0;n=Math.abs(Math.round(n));const jo=Math.floor(n/1e12),eok=Math.round((n%1e12)/1e8);let s=jo?jo.toLocaleString()+'조'+(eok?' '+eok.toLocaleString()+'억':'')+'원':eok?eok.toLocaleString()+'억원':Math.round(n/1e4).toLocaleString()+'만원';return (neg?'-':'')+s;};
const usdKo=n=>{const [a,b]=Math.abs(n/1e8).toFixed(1).split('.');return Number(a).toLocaleString('ko-KR')+(b==='0'?'':'.'+b)+'억 달러';};
const ASSET={'국내주식':'우리나라 회사 주식','해외주식':'다른 나라 회사 주식','국내채권':'우리나라에서 돈을 빌려 주고 이자를 받는 투자','해외채권':'다른 나라에서 돈을 빌려 주고 이자를 받는 투자','대체투자':'건물이나 도로처럼 주식·채권이 아닌 투자','단기자금':'곧 쓸 수 있게 짧게 맡긴 돈'};
const fundLine=(issuer,cls='')=>{const n=String(issuer||'').toUpperCase(),c=String(cls||'').toUpperCase();let s='';if(n.includes('INVESCO'))s='인베스코가 여러 주식을 묶어 파는 상품';else if(n.includes('ISHARES'))s='아이셰어즈가 여러 주식을 묶어 파는 상품';else if(/\b(ETF|TRUST|FUND)\b|EXCH TRADED|FD TR/.test(n))s='여러 주식을 묶어 파는 상품';if(/S&P/.test(c))s=s?s+' · 미국 큰 회사 500개를 따라감':'미국 큰 회사 500개를 따라가는 상품';else if(/MSCI/.test(c))s=s?s+' · 여러 나라 주식을 따라감':'여러 나라 주식을 따라가는 상품';return s;};
const plainType=t=>String(t||'').replace(/\s*\+\s*CUSIP\s*변경/gi,'').replace(/CUSIP\s*변경/gi,'').replace(/주식분할/g,'주식 쪼개기(분할)').replace(/역분할/g,'주식 합치기(역분할)').replace(/분사/g,'회사 나누기(분사)');
const eokWon=eok=>{const neg=eok<0;eok=Math.abs(Number(eok));const jo=Math.floor((eok+1e-9)/10000),rest=Math.round((eok-jo*10000)*10)/10;const rs=rest.toLocaleString('ko-KR',{minimumFractionDigits:Number.isInteger(rest)?0:1,maximumFractionDigits:1});const s=jo?jo.toLocaleString('ko-KR')+'조'+(rest?' '+rs+'억원':'원'):rs+'억원';return (neg?'-':'')+s;};
const pct2=n=>{const x=Number(n);return Number.isFinite(x)?(Math.round(x*100)/100).toFixed(2)+'%':'';};
const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(0.2,Math.abs(b)*0.03);
/* weight_note가 평가액 비중(합 100%)이고 weight_pct가 평가액/국내합과 같으면 그 칸이 국내주식 안 몫.
   7.76%처럼 지분·기금 비중이 들어 있으면 평가액/국내합으로 다시 계산한다. */
const krShare=(row,total,note)=>{
  const from=total>0?Number(row.value_100m_krw)/total*100:NaN;
  const w=Number(row.weight_pct);
  const noteOk=/비중/.test(note||'')&&/평가액/.test(note||'')&&/100\s*%/.test(note||'');
  if(noteOk&&near(w,from))return {pct:w,computed:false};
  return {pct:from,computed:true};
};
const shHtml=(pct,computed)=>computed?`<span class="sh"><span class="of">국내주식 중</span>${pct2(pct)}</span>`:`<span class="sh">${pct2(pct)}</span>`;
/* 상위 10개 막대 그래프. 막대 색은 그 회사(티커)의 대표 색으로 그라데이션. 나머지는 회색 한 줄. */
const BRAND={NVDA:['#4c7a00','#76b900','#b6f04a'],AAPL:['#3a3d40','#a2aaad','#e6e8ea'],MSFT:['#f25022','#7fba00','#00a4ef','#ffb900'],AMZN:['#c46f00','#ff9900','#ffc46b'],
  GOOGL:['#4285f4','#ea4335','#fbbc05','#34a853'],GOOG:['#4285f4','#ea4335','#fbbc05','#34a853'],AVGO:['#8a0620','#cc092f','#ff4d6d'],MU:['#003b73','#0071c5','#5ab4ff'],
  IVV:['#111111','#555b61','#a7b0b8'],META:['#0050c8','#0081fb','#5fc4ff'],TSLA:['#a1121f','#e31937','#ff6b7a'],AMD:['#a3141b','#ed1c24','#ff7076'],NFLX:['#8c0610','#e50914','#ff5a63'],
  ORCL:['#a10000','#f80000','#ff6b6b'],JPM:['#4a3418','#7a5a2b','#c8a46a'],V:['#10144a','#1a1f71','#f7b600'],MA:['#eb001b','#ff5f00','#f79e1b'],LLY:['#9c1f16','#d52b1e','#ff7a6e'],
  BRK:['#2e1a52','#4b2a82','#9a7fd1'],'BRK.B':['#2e1a52','#4b2a82','#9a7fd1'],WMT:['#004c99','#0071ce','#ffc220'],COST:['#a5122a','#e31837','#005daa'],UNH:['#001a4d','#002677','#5f8bd9'],
  XOM:['#a3121f','#ed1b2d','#ff7380'],PLTR:['#101113','#4a4f55','#c4c9ce'],
  '005930':['#0d1b6e','#1428a0','#4f6bff'],'000660':['#ea002c','#f47725','#ffb37a'],'373220':['#6e0023','#a50034','#e0507d'],'207940':['#1428a0','#0077c8','#00b3e3'],
  '005380':['#001a3a','#002c5f','#4e7fbf'],'329180':['#004a8f','#0072ce','#00b4a0'],'402340':['#ea002c','#f47725','#ffb37a'],'105560':['#60584c','#ffbc00','#ffd966'],
  '012450':['#b24a00','#f37321','#ffb07a'],'034020':['#003d7a','#005eb8','#5fa8ff']};
const brandOf=(t,i)=>{const k=String(t||'').toUpperCase();if(BRAND[k])return BRAND[k];const h=[38,195,8,145,265,25,225,48,330,170][i%10];return [`hsl(${h} 70% 32%)`,`hsl(${h} 80% 52%)`,`hsl(${h} 90% 72%)`];};
const grad=c=>c.length>3?`linear-gradient(90deg,${c.join(',')})`:`linear-gradient(90deg,${c[0]} 0%,${c[1]} 55%,${c[2]} 100%)`;
const steelDonut=(rows)=>{
  const list=rows.map(r=>({name:r.name,v:Math.max(0,Number(r.pct)||0),ticker:r.ticker||'',short:r.short||'',logo:r.logo||''}));
  // 막대 길이는 상위 10개 중 가장 큰 것 기준(나머지 50%를 기준으로 하면 막대가 다 짧아져 비교가 안 된다)
  const used=list.reduce((s,r)=>s+r.v,0),rest=Math.max(0,100-used),max=Math.max(...list.map(r=>r.v),0.0001);
  const tidy=n=>String(n||'').replace(/\b(CORPORATION|CORP|INCORPORATED|INC|CO|COM|LTD|PLC|HLDGS?|HOLDINGS?|GROUP|TR|FD|NEW|CL [A-Z]|DEL)\b\.?/gi,'').replace(/\s{2,}/g,' ').trim().toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());
  const FIX={Nvidia:'NVIDIA',Ishares:'iShares',Amd:'AMD',Jpmorgan:'JPMorgan'};const nm=p=>p.short||(/[가-힣]/.test(p.name)?p.name:(t=>t.replace(/^\S+/,w=>FIX[w]||w))(tidy(p.name))||p.name);
  const li=list.map((p,i)=>{const c=brandOf(p.ticker,i);
    const mark=p.logo?`<img class="bb-logo" alt="" width="28" height="18" src="${esc(p.logo)}">`:`<span class="bb-mark" style="background:${grad(c)}">${esc(/^[0-9]+$/.test(p.ticker)?nm(p).replace(/[^A-Za-z가-힣]/g,'').slice(0,2):String(p.ticker||nm(p)).replace(/[^A-Za-z0-9가-힣]/g,'').slice(0,4))}</span>`;
    return `<li><div class="bb-h">${mark}<span class="bb-n">${esc(nm(p))}</span>${p.ticker?`<span class="bb-t">${esc(p.ticker)}</span>`:''}<b>${pct2(p.v)}</b></div><div class="bb-track"><i style="width:${Math.max(1.5,p.v/max*100).toFixed(2)}%;background:${grad(c)}"></i></div></li>`;}).join('');
  const restLi=rest>0.0001?`<li class="bb-rest"><div class="bb-h"><span class="bb-n">나머지 종목 전부</span><b>${pct2(rest)}</b></div></li>`:'';
  return `<figure class="bbars" role="img" aria-label="상위 10개가 ${pct2(used)}. ${esc(list.map(p=>(p.ticker||nm(p))+' '+pct2(p.v)).join(', '))}"><figcaption><b>${pct2(used)}</b> 상위 10개 합계</figcaption><ol>${li}${restLi}</ol></figure>`;
};
const ymd=s=>{const [y,m,d]=String(s||'').split('-');return `${+y}년 ${+m}월 ${+d}일`;};
const KR_CODE={"삼성전자":"005930","SK하이닉스":"000660","LG에너지솔루션":"373220","삼성바이오로직스":"207940","현대차":"005380","HD현대중공업":"329180","SK스퀘어":"402340","KB금융":"105560","한화에어로스페이스":"012450","두산에너빌리티":"034020"};
const LOGO={NVDA:'NVDA.svg',AAPL:'AAPL.svg',MSFT:'MSFT.svg',AMZN:'AMZN.svg',GOOGL:'GOOGL.svg',GOOG:'GOOGL.svg',AVGO:'AVGO.svg',MU:'MU.svg',IVV:'IVV.svg',META:'META.svg','005930':'005930.svg','000660':'000660.svg','373220':'373220.svg','207940':'207940.svg','005380':'005380.svg','329180':'329180.svg','105560':'105560.svg','012450':'012450.svg'};
const [ft,q1,q2,ch,kr,ticks]=await Promise.all([j('fund_totals.json'),j('holdings_us_2026Q1.json'),j('holdings_us_2026Q2.json'),j('changes_us.json'),j('kr_holdings.json'),j('us_tickers.json').catch(()=>({cusip:{}}))]);
$('upd').textContent=String(ch.updated||'').slice(0,10);
const hy=ft.half_year_release;
let h=`<div class="big">1,865조 5,760억원</div><p class="sub">2026년 6월 말까지 쌓아 둔 돈(적립금)이에요. ${S(hy.url,'국민연금 상반기 보도자료(2026.8.28)')}</p>`;
if(hy.by_asset){const mx=Math.max(...Object.values(hy.by_asset).map(v=>v.value_billion_krw));
 h+=`<h3>어디에 나눠 두었나 (2026년 6월 말)</h3>`+Object.entries(hy.by_asset).map(([k,v])=>`<div class="row"><span>${esc(k)}${ASSET[k]?`<span class="hint">${esc(ASSET[k])}</span>`:''} <span class="sub">${v.weight_pct}%</span><div class="bar" style="width:${Math.max(2,v.value_billion_krw/mx*100)}%"></div></span><b>${krw(v.value_billion_krw*1e8)}</b></div>`).join('')+`<p class="src">같은 보도자료 기준이에요. ${S(hy.url,'국민연금')}</p>`;}
$('fund').innerHTML=h;
const FX={Q1:q1.fx,Q2:q2.fx};
const card=(q,fx,lab)=>`<div class="card"><div class="sub">${lab} (${q.period.replace(/-/g,'.')} 기준)</div><div class="big" style="font-size:24px">약 ${krw(q.total_value_usd*fx.usd_krw)}</div><div class="sub">${q.count}개 주식(종목) · 우리 돈으로 위 금액 · 달러로는 ${usdKo(q.total_value_usd)}<br>1달러에 ${fx.usd_krw.toLocaleString()}원 (${fx.date.replace(/-/g,'.')} 환율, ${S(fx.source,'연합뉴스')})</div>${S(idx(q.filing_url),'미국 정부에 낸 보유 주식 목록')}</div>`;
h=`<p class="sub">미국에서는 돈을 많이 굴리는 곳이 석 달에 한 번, 가진 미국 주식 목록을 미국 정부에 내요. 국민연금도 그 목록을 냈어요. 원화는 그 분기 마지막 날 환율로 바꾼 대략의 금액(어림값)이에요.</p>
<div class="two">${card(q2,FX.Q2,'2026년 2분기')}${card(q1,FX.Q1,'2026년 1분기')}</div>
<h3>가장 많이 가진 미국 주식 10개 (2026년 2분기)</h3><p class="sub">오른쪽 %는 미국 주식 ${usdKo(q2.total_value_usd)} 중이에요.</p>`;
const t=q2.top20.slice(0,10),tm=t[0].value_usd;
const usTick=(ticks&&ticks.cusip)||{};
const usShares=t.map(x=>{const ticker=usTick[x.cusip]||''; return {name:x.issuer,pct:q2.total_value_usd>0?x.value_usd/q2.total_value_usd*100:0,ticker,logo:LOGO[ticker]?('assets/logos/'+LOGO[ticker]):''};});
h+=t.map((x,i)=>{const g=fundLine(x.issuer,x.class);return `<div class="row"><span>${i+1}. ${esc(x.issuer)}${g?`<span class="hint">${esc(g)}</span>`:''}<div class="bar" style="width:${x.value_usd/tm*100}%"></div></span><b class="amt">${krw(x.value_usd*FX.Q2.usd_krw)} · ${shHtml(usShares[i].pct,false)}</b></div>`;}).join('')+steelDonut(usShares)+`<p class="src">회사 이름은 공개 자료의 영어 그대로예요. ${S(idx(q2.infotable_url),'미국 정부에 낸 보유 주식 목록')}</p>`;
$('us').innerHTML=h;
const BAD=/DUPONT|FEDEX|QNITY/i;
const koSkip=n=>{const u=String(n||'').toUpperCase();if(u.includes('DUPONT'))return '듀폰';if(u.includes('FEDEX'))return '페덱스 화물';if(u.includes('QNITY'))return '큐니티';return n;};
const adj=x=>x.adjustment?`<span class="tag y">${esc(plainType(x.adjustment.type))} 반영</span>`:'';
const st=x=>x.status==='신규'?'<span class="tag">새로 산 주식</span>':x.status==='전량매도'||x.status==='청산'?'<span class="tag">모두 판 주식</span>':'';
const list=(a,cls)=>{const ok=a.filter(x=>x.real!==false&&!x.suspect_note&&!BAD.test(x.issuer)).slice(0,10),m=Math.max(...ok.map(x=>Math.abs(x.est_trade_usd)));
 return ok.map((x,i)=>`<div class="row"><span>${i+1}. ${esc(x.issuer)} ${st(x)}${adj(x)}<div class="bar ${cls}" style="width:${Math.abs(x.est_trade_usd)/m*100}%"></div></span><b>${krw(Math.abs(x.est_trade_usd)*FX.Q2.usd_krw)}</b></div>`).join('');};
const flagged=[...ch.top_buys,...ch.top_sells].filter(x=>x.suspect_note||x.real===false||BAD.test(x.issuer)).map(x=>koSkip(x.issuer));
const skipped=[...new Set(['듀폰','페덱스 화물',...flagged])];
h=`<p class="sub">2026년 1분기에서 2분기로 주식 수가 얼마나 변했는지 보고 계산했어요.</p>
<div class="note">늘거나 줄어든 주식 수에 2분기 끝 가격을 곱한 대략의 금액이에요. 이 금액을 추정 거래액이라고 하고, 실제로 사고판 돈과 다를 수 있어요. 원화는 1달러에 ${FX.Q2.usd_krw.toLocaleString()}원으로 바꿨어요.</div>
<div class="two"><div><h3>많이 늘린 주식 10개</h3>${list(ch.top_buys,'g')}</div><div><h3>많이 줄인 주식 10개</h3>${list(ch.top_sells,'r')}</div></div>
<h3>주식을 쪼개거나 회사를 나눈 경우</h3><p class="sub">주식을 쪼개면(분할) 가진 수가 많아 보이고, 합치면(역분할) 적어 보여요. 회사에서 새 회사를 떼어 내기도(분사) 해요. 공개된 자료를 보고 그 변화를 반영해 주식 수를 다시 셌어요(보정).</p>`+
ch.adjustments.map(a=>`<div class="row"><span>${esc(a.issuer)} · ${esc(plainType(a.type))} <span class="sub">${esc(a.date)}</span><br>${S(a.basis,'공개 자료')}</span></div>`).join('')+
`<p class="sub">회사가 나뉘어 주식 수가 달라진 곳은 늘리거나 줄인 목록에서 뺐어요. 뺀 곳: ${skipped.map(esc).join(', ')}.</p>
<p class="src">${S(idx(ch.sources[0]),'2026년 1분기 보유 주식 목록')} · ${S(idx(ch.sources[1]),'2026년 2분기 보유 주식 목록')}</p>`;
$('chg').innerHTML=h;
const top=kr.top10.slice(0,10),km=top[0].value_100m_krw;
const shares=top.map(x=>krShare(x,kr.total_value_100m_krw,kr.weight_note));
const krow=(x,i)=>`<div class="row"><span>${i+1}. ${esc(x.company)} <span class="sub">지분 ${esc(x.stake_pct)}%</span><div class="bar" style="width:${x.value_100m_krw/km*100}%"></div></span><b class="amt">${eokWon(x.value_100m_krw)} · ${shHtml(shares[i].pct,shares[i].computed)}</b></div>`;
const mid=Math.ceil(top.length/2);
const krLine=shares.some(s=>s.computed)
  ?`오른쪽 %는 가진 금액을 국내 주식 ${eokWon(kr.total_value_100m_krw)}으로 나눈 값이에요.`
  :`오른쪽 %는 국내 주식 ${eokWon(kr.total_value_100m_krw)} 중이에요.`;
$('kr').innerHTML=`<div class="big">${eokWon(kr.total_value_100m_krw)}</div><p class="sub">${Number(kr.count).toLocaleString('ko-KR')}개 주식 · ${ymd(kr.as_of)} 기준</p><p class="sub">평가액은 그날 가격으로 계산한 금액이에요. 지분은 그 회사 주식 가운데 국민연금이 가진 비율이에요.</p><h3>평가액이 큰 주식 10개</h3><p class="sub">${krLine}</p><div class="two"><div>${top.slice(0,mid).map(krow).join('')}</div><div>${top.slice(mid).map((x,i)=>krow(x,i+mid)).join('')}</div></div>${steelDonut(top.map((x,i)=>{const code=KR_CODE[x.company]||''; return {name:x.company,pct:shares[i].pct,ticker:code,short:x.company,logo:LOGO[code]?('assets/logos/'+LOGO[code]):''};}))}<p class="src">${S(kr.board_url,'국민연금이 공개한 2025년 말 국내 주식 목록')}</p>`;
})();
