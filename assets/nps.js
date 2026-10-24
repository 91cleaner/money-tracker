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
/* 각진 스테인리스 도넛. 32개 평면 + 나머지 조각이 100%. */
const steelDonut=(rows)=>{
  const N=32,cx=160,cy=160,Ro=112,Ri=70,step=Math.PI*2/N,t0=-Math.PI/2;
  const hex=c=>'#'+c.map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('');
  const hit=(R,th)=>{
    let u=((th-t0)/step)%N; if(u<0)u+=N; const i=Math.min(N-1,Math.floor(u+1e-9));
    const a0=t0+i*step,a1=a0+step,p0=[Math.cos(a0)*R,Math.sin(a0)*R],p1=[Math.cos(a1)*R,Math.sin(a1)*R];
    const dx=Math.cos(th),dy=Math.sin(th),ex=p1[0]-p0[0],ey=p1[1]-p0[1],den=dx*ey-dy*ex;
    const t=Math.abs(den)<1e-9?R:(p0[0]*ey-p0[1]*ex)/den;
    return [cx+dx*t,cy+dy*t];
  };
  const exact=rows.map(r=>({name:r.name,v:Math.max(0,Number(r.pct)||0),ticker:r.ticker||'',short:r.short||'',logo:r.logo||''}));
  const used=exact.reduce((s,r)=>s+r.v,0);
  const rest=Math.max(0,100-used);
  const parts=exact.concat([{name:'나머지',v:rest,rest:1}]).filter(p=>p.v>0.0001);
  const sum=parts.reduce((s,p)=>s+p.v,0)||1;
  const shown=parts.map(p=>Math.round(p.v*100)/100);
  const drift=Math.round((100-shown.reduce((s,n)=>s+n,0))*100)/100;
  shown[shown.length-1]=Math.round((shown[shown.length-1]+drift)*100)/100;
  const hues=[[255,176,32],[64,196,232],[255,92,64],[80,220,140],[176,132,255],[255,138,48],[110,150,255],[240,208,96],[255,96,168],[48,214,196]];
  const restRgb=[148,156,164];
  let acc=0; const ranges=parts.map((p,i)=>{const a0=t0+(acc/sum)*Math.PI*2; acc+=p.v; return {p,i,a0,a1:t0+(acc/sum)*Math.PI*2,rgb:p.rest?restRgb:hues[i%hues.length]};});
  const defs=[],faces=[];
  const gid=(i,k)=>'st'+i+'f'+k;
  ranges.forEach(sl=>{
    for(let f=0;f<N;f++){
      const f0=t0+f*step,f1=f0+step,b0=Math.max(f0,sl.a0),b1=Math.min(f1,sl.a1);
      if(b1-b0<0.0008)continue;
      const amid=(f0+f1)/2, shine=Math.max(0,Math.cos(amid-(-Math.PI*0.72)));
      const tone=(c,k,add)=>Math.max(0,Math.min(255,c*k+add));
      const base=sl.rgb.map(c=>tone(c,0.62+shine*0.34,0)), hi=sl.rgb.map(c=>tone(c,0.8+shine*0.2,shine*16)), lo=sl.rgb.map(c=>tone(c,0.4,0));
      const tx=Math.cos(amid+Math.PI/2), ty=Math.sin(amid+Math.PI/2);
      const id=gid(sl.i,f);
      defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${(cx-tx*70).toFixed(1)}" y1="${(cy-ty*70).toFixed(1)}" x2="${(cx+tx*70).toFixed(1)}" y2="${(cy+ty*70).toFixed(1)}"><stop offset="0" stop-color="${hex(lo)}"/><stop offset="0.16" stop-color="${hex(hi)}"/><stop offset="0.42" stop-color="${hex(base)}"/><stop offset="0.58" stop-color="${hex(lo)}"/><stop offset="0.8" stop-color="${hex(hi)}"/><stop offset="1" stop-color="${hex(base)}"/></linearGradient>`);
      const q=[hit(Ro,b0),hit(Ro,b1),hit(Ri,b1),hit(Ri,b0)].map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' ');
      const edge=shine>0.55?'#f4f8fc':'#9aa6b2';
      faces.push(`<polygon points="${q}" fill="url(#${id})" stroke="#0a0c0e" stroke-width="0.8" stroke-linejoin="miter"/>`);
      faces.push(`<line x1="${hit(Ro,b0)[0].toFixed(1)}" y1="${hit(Ro,b0)[1].toFixed(1)}" x2="${hit(Ro,b1)[0].toFixed(1)}" y2="${hit(Ro,b1)[1].toFixed(1)}" stroke="${edge}" stroke-width="1.15" stroke-linecap="butt"/>`);
    }
    const cut=hit(Ro,sl.a0), cuti=hit(Ri,sl.a0);
    faces.push(`<line x1="${cuti[0].toFixed(1)}" y1="${cuti[1].toFixed(1)}" x2="${cut[0].toFixed(1)}" y2="${cut[1].toFixed(1)}" stroke="#e7f2ff" stroke-width="1.25"/>`);
  });
  const ngon=R=>Array.from({length:N},(_,i)=>{const a=t0+i*step;return (cx+Math.cos(a)*R).toFixed(1)+','+(cy+Math.sin(a)*R).toFixed(1);}).join(' ');
  const ring=R=>{const pts=ngon(R).split(' ');return 'M'+pts[0]+pts.slice(1).map(p=>'L'+p).join('')+'Z';};
  const back=`<path transform="translate(5,16)" fill="#14181c" fill-rule="evenodd" d="${ring(Ro)}${ring(Ri)}"/>`;
  const topPct=pct2(used);
  const letters=t=>{const s=String(t||'').toUpperCase().replace(/[^A-Z0-9]/g,''); if(!s)return '?'; return /^[0-9]+$/.test(s)?s.slice(0,3):s.slice(0,2);};
  const ink=rgb=>((rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000>160)?'#14110a':'#f4f7fb';
  const lab=p=>p.rest?'나머지':(p.short?`${p.ticker} ${p.short}`.trim():(p.ticker||p.name));
  const label=ranges.map(sl=>`${lab(sl.p)} ${shown[sl.i].toFixed(2)}%`).join(', ');
  const lg=ranges.map((sl,i)=>{
    const p=sl.p, col=hex(sl.rgb);
    const mark=p.rest?'':(p.logo?`<img class="logo" alt="" width="36" height="22" src="${esc(p.logo)}">`:`<span class="mark" style="background:${col};color:${ink(sl.rgb)}">${esc(letters(p.ticker||p.short||p.name))}</span>`);
    return `<li><i style="background:${col}"></i>${mark}<span>${esc(lab(p))}</span><b>${shown[i].toFixed(2)}%</b></li>`;
  }).join('');
  return `<figure class="steel"><div class="steel-fit"><div class="steel-stage"><div class="steel-tilt"><svg viewBox="0 0 320 320" role="img" aria-label="상위 10개 ${topPct}. ${esc(label)}"><defs>${defs.join('')}</defs>${back}${faces.join('')}<polygon points="${ngon(Ri)}" fill="#07080a"/><polygon points="${ngon(Ro)}" fill="none" stroke="#f7fbff" stroke-width="1.2" stroke-linejoin="miter"/></svg><div class="steel-num"><b>${topPct}</b><span>상위 10개</span></div></div></div><ul class="steel-lg">${lg}</ul></div></figure>`;
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
