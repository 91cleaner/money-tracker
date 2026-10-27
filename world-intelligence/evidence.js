/* MONEY TRACKER — evidence overlay for public, locally archived datasets.
   Never convert machine-extracted House PTR rows into verified trades. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const form=$('ask'),question=$('question'),frame=$('mapFrame');
if(!form||!question||!frame)return;
const panel=document.createElement('aside');
panel.id='mtEvidence';
panel.setAttribute('aria-label','공식 자료 조사 결과');
panel.setAttribute('aria-live','polite');
panel.hidden=true;
panel.style.cssText='position:fixed;right:12px;bottom:87px;z-index:1100;width:min(430px,calc(100vw - 24px));max-height:min(55vh,500px);overflow:auto;padding:14px;border:1px solid #33808b;border-radius:10px;background:rgba(3,19,31,.97);box-shadow:0 12px 40px #0009;color:#e4f5f8;font:12px/1.5 system-ui,sans-serif';
document.body.append(panel);
const heading=document.createElement('div');heading.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:10px';
const title=document.createElement('strong');title.textContent='◉ VERIFIED SOURCE / RESEARCH';
const close=document.createElement('button');close.type='button';close.textContent='✕';close.setAttribute('aria-label','자료창 닫기');close.style.cssText='background:#123545;color:white;border:1px solid #397280;border-radius:4px;cursor:pointer';close.addEventListener('click',()=>panel.hidden=true);
heading.append(title,close);
const content=document.createElement('div');panel.append(heading,content);
const text=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n};
const p=value=>{const n=text('p',value);n.style.margin='8px 0';content.append(n);return n};
const link=(label,url)=>{
 const a=text('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.style.color='#81e6f4';a.style.display='inline-block';a.style.margin='4px 0';return a;
};
const row=()=>{const r=document.createElement('div');r.style.cssText='padding:9px 0;border-top:1px solid #244c58';content.append(r);return r};
let billsCache=null,tradesCache=null,requestId=0;
async function json(path){
 const response=await fetch(path,{cache:'no-store'});
 if(!response.ok)throw new Error('HTTP '+response.status);
 return response.json();
}
const words=[
 [/반도체|chip|semiconductor|엔비디아|nvidia|tsmc/i,['semiconductor','chips','microelectronic','microchip']],
 [/방산|국방|군사|군수|defense/i,['defense','military','armed forces','national security']],
 [/대만|taiwan|타이완/i,['taiwan']],
 [/관세|무역|tariff/i,['tariff','trade','customs']],
 [/인공지능|ai|artificial intelligence/i,['artificial intelligence']],
 [/금리|은행|fed|bank/i,['bank','interest rate','federal reserve']]
];
function terms(q){const out=words.filter(([re])=>re.test(q)).flatMap(([,arr])=>arr);return [...new Set(out)];}
function focusUS(){const map=window.moneyTrackerMap;if(map){map.invalidateSize();map.flyTo([38.8899,-77.0091],5,{duration:1.2})}}
async function legislation(q,id){
 title.textContent='◉ CONGRESS / LEGISLATION';
 p('공식 Congress.gov API 기반 저장 자료입니다. 법안 발의와 통과·시행은 서로 다릅니다.');
 let data;
 try{data=billsCache||(billsCache=await json('../data/us/bills.json'))}
 catch(e){if(id===requestId)p('법안 데이터 불러오기 실패: '+e.message);return}
 if(id!==requestId)return;
 const ts=terms(q);
 const all=Object.entries(data.recent||{}).flatMap(([member,items])=>(Array.isArray(items)?items:[]).map(b=>({...b,member})));
 const found=all.filter(b=>ts.length?ts.some(t=>String(b.n||'').toLowerCase().includes(t)):true).sort((a,b)=>String(b.d||'').localeCompare(String(a.d||'')));
 p('검색 대상: '+all.length.toLocaleString('ko-KR')+'개 법안 기록 · '+(data.updated||'갱신일 미상')+' · 제목 키워드 검색');
 if(!ts.length)p('질문에 대응하는 영어 검색어가 없어 최신 법안 일부만 표시합니다. 전체 검색 결과가 아닙니다.');
 if(!found.length){p('현재 저장 자료에서 일치하는 법안을 찾지 못했습니다. 관련 법안이 없다는 뜻은 아닙니다.');content.append(link('Congress.gov에서 직접 검색 ↗','https://www.congress.gov/'));return}
 found.slice(0,7).forEach(b=>{
  const r=row();r.append(text('strong',(b.no||'법안 번호 미상')+' · '+(b.n||'제목 미상')));
  r.append(text('div','발의일 '+(b.d||'미상')+' · 발의 의원 식별자 '+b.member));
  r.append(text('div','진행 상태: '+(b.a||'자료 없음')));
  r.append(text('div',b.law?'법률 제정 표시 있음 (원문 확인 필요)':b.pass?'의회 통과 표시 있음 (원문 확인 필요)':'법률 제정 확인되지 않음'));
  if(typeof b.u==='string'&&/^https:\/\/www\.congress\.gov\/bill\//.test(b.u))r.append(link('공식 법안 원문 ↗',b.u));
  const btt=text('button','지도에서 미국 의회 추적');btt.type='button';btt.style.cssText='display:block;margin-top:5px;background:#0e4653;color:#c8f8ff;border:1px solid #378a97;border-radius:5px;padding:5px;cursor:pointer';btt.addEventListener('click',focusUS);r.append(btt);
 });
 p('의원 이름 매핑은 아직 연결되지 않았습니다. 식별자만 표시하며 거래와의 인과관계를 추정하지 않습니다.');
}
async function disclosures(q,id){
 title.textContent='◉ US HOUSE / PTR CANDIDATES';
 p('중요: 아래 항목은 공식 PDF에서 기계 추출한 검토 후보이며, 개별 거래 사실은 아직 사람의 원문 대조로 검증되지 않았습니다.');
 let data;
 try{data=tradesCache||(tradesCache=await json('../data/us/trades.json'))}
 catch(e){if(id===requestId)p('거래 후보 데이터 불러오기 실패: '+e.message);return}
 if(id!==requestId)return;
 const rows=(Array.isArray(data.records)?data.records:[]).filter(r=>r&&r.verification==='machine_parsed_requires_review'&&typeof r.source_pdf==='string'&&/^https:\/\/disclosures-clerk\.house\.gov\/public_disc\/ptr-pdfs\//.test(r.source_pdf));
 const raw=q.toLowerCase().replace(/의원|거래|주식|공시|매수|매도|추적|ptr|house|disclosure|congress/gi,'').trim();
 const matched=raw.length>=2?rows.filter(r=>[r.member,r.ticker,r.asset].some(v=>String(v||'').toLowerCase().includes(raw))):rows;
 p('기계 추출 후보 '+rows.length+'건 · 검증 완료 0건 · 원문 링크가 있는 후보만 표시');
 if(!matched.length){p('질문에 일치하는 검토 후보가 없습니다. 해당 거래가 없었다는 뜻은 아닙니다.');return}
 matched.slice(0,6).forEach(r=>{
  const el=row();el.append(text('strong',r.member+' · '+(r.ticker||r.asset||'종목 미상')));
  el.append(text('div',(r.transaction_date||'거래일 미상')+' · '+(r.type==='P'?'매수 표기':r.type==='S'?'매도 표기':'기타 표기')+' · $'+r.amount_min_usd+'–$'+r.amount_max_usd));
  el.append(text('div','상태: 기계 추출 / 원문 대조 필요'));
  el.append(link('미국 하원 공식 신고 PDF ↗',r.source_pdf));
 });
 p('투자 신호로 사용하지 마세요. 신고 지연, 소유자, 정정 및 OCR·표 추출 오류 가능성이 있습니다.');
}
form.addEventListener('submit',e=>{
 const q=question.value.trim();if(!q)return;
 const isBill=/법안|의회|국회|입법|bill|legislation|congress|반도체|방산/i.test(q);
 const isTrade=/의원.*(주식|거래|공시|매수|매도)|(?:주식|거래|공시|매수|매도).*의원|ptr|disclosure|salazar|foxx/i.test(q);
 if(!isBill&&!isTrade){panel.hidden=true;return}
 e.preventDefault();const id=++requestId;panel.hidden=false;content.replaceChildren();p('공식 저장 자료 검색 중…');content.replaceChildren();
 if(isTrade)disclosures(q,id);else legislation(q,id);
});
})();
