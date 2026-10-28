/**
 * Index the sector → factor reference map and the official market calendar
 * (data/market/sectors.json, data/market/calendar.json) for the offline search.
 * Reference links only: no forecast, no recommendation, no causal claim.
 */
const TABLE_URL = "https://github.com/91cleaner/money-tracker/blob/main/data/market/sectors.json";
const REGION = {us:"미국",kr:"한국",jp:"일본",tw:"대만",eu:"유럽",cn:"중국",uk:"영국"};
const tidy = (v,n=180) => String(v ?? "").replace(/\s+/g," ").trim().slice(0,n);
const list = (xs,n=6) => xs.filter(Boolean).slice(0,n).join(", ")+(xs.length>n?" 외 "+(xs.length-n)+"개":"");

export function marketReferenceDocuments(sectors,calendar,marketName=()=>null,topicLabel=t=>t){
 const out=[];
 const factors=new Map((sectors?.factors||[]).map(f=>[f.id,f]));
 const usedBy=new Map();
 for(const s of sectors?.sectors||[])for(const f of s.factors||[])(usedBy.get(f)||usedBy.set(f,[]).get(f)).push(s.label);
 for(const s of sectors?.sectors||[]){
  const fl=(s.factors||[]).map(id=>factors.get(id)?.label).filter(Boolean);
  const names=(s.markets||[]).map(m=>marketName(m)||m);
  out.push({id:"sector-"+s.id,type:"sector",title:"업종 참고표 · "+tidy(s.label,60),
   aliases:[s.label,s.label_en,"업종","섹터",...(s.law_topics||[]).map(topicLabel).slice(0,3),...fl.slice(0,6)], // company names stay in the summary only, so company questions still rank the company record first
   summary:"함께 확인할 공개 지표: "+list(fl)+" · 관련 법안 주제: "+list((s.law_topics||[]).map(topicLabel))+" · 대표 종목: "+list(names)+". 참고용 연결이며 예상·추천이 아닙니다.",
   source:"MONEY TRACKER 업종·요인 참고표",url:TABLE_URL,source_date:sectors.updated||null,route:null});
 }
 for(const f of factors.values()){
  out.push({id:"factor-"+f.id,type:"factor",title:"참고 요인 · "+tidy(f.label,80),
   aliases:[f.label,f.kind,"요인",...(usedBy.get(f.id)||[]).slice(0,8)],
   summary:(f.status==="collected"?"자동 수집 중인 자료와 연결됨":"수집 예정(아직 자료 없음)")+" · 함께 보는 업종: "+list(usedBy.get(f.id)||[])+" · 출처: "+tidy(f.source,90)+". 투자 신호가 아닙니다.",
   source:tidy(f.source,100),url:f.source_url,source_date:sectors.updated||null,route:f.kind==="rates"?"rates":null});
 }
 for(const e of calendar?.events||[]){
  const where=REGION[e.region]||e.region;
  out.push({id:"calendar-"+e.region+"-"+e.date,type:"calendar",title:"일정 · "+tidy(e.title,80)+" · "+e.date,
   aliases:[e.body,where,"일정","금리 결정","중앙은행","캘린더",e.date.slice(0,7)],
   summary:where+" "+tidy(e.title,80)+" — 회의 "+(e.start===e.date?e.date:e.start+"~"+e.date)+(e.note?" · "+tidy(e.note,60):"")+(e.tentative?" · 기관 표기상 잠정":"")+". 공식 일정이며 기관 사정으로 바뀔 수 있음 (확인일 "+e.verified_on+").",
   source:tidy(e.body,100),url:e.source_url,source_date:e.verified_on||null,route:e.kind==="central_bank"?"rates":null});
 }
 return out;
}

/** US export-control / Entity List / tariff notices collected by scripts/collect-market-factors.mjs. */
export function tradeControlDocuments(file){
 return (file?.documents||[]).map(d=>{
  const tags=[d.entity_list&&"Entity List",d.tariff&&"관세",d.china&&"중국"].filter(Boolean);
  return {id:"trade-"+d.id,type:"regulation",title:"미국 무역·수출통제 고시 · "+tidy(d.title,140),
   aliases:["수출통제","export controls","무역","미국 상무부",d.agency,...tags,...(d.china?["China","대중국 조치"]:[])],
   summary:tidy(d.agency,80)+" · "+tidy(d.type,30)+" · 게재일 "+d.date+(tags.length?" · 자동 분류: "+tags.join(", ")+"(제목·요약 단어 기준, 원문 확인 필요)":"")+". 공식 고시 원문 링크.",
   source:"Federal Register",url:d.url,source_date:d.date||null,route:null};
 });
}

/** China MOFCOM announcements collected by scripts/collect-market-factors.mjs (titles and links only). */
export function mofcomDocuments(file){
 return (file?.items||[]).filter(x=>/^https:\/\/www\.mofcom\.gov\.cn\//.test(x.url||"")).map(x=>({
  id:"cn-mofcom-"+(x.number||x.url.split("/").pop().replace(/\.html$/,"")),type:"regulation",title:"중국 상무부 공고 · "+tidy(x.title,150),
  aliases:["중국","China","중국 상무부","MOFCOM","商务部",...(x.export_control?["수출통제","出口管制","대중국","희토류"]:[]),...(x.targets||[])],
  summary:"중국 상무부 공고"+(x.number?" "+x.number.replace("-","년 제")+"호":"")+(x.export_control?" · 자동 분류: 수출통제 관련(제목 단어 기준, 원문 확인 필요)":"")+(x.targets?.length?" · 제목에 나온 대상: "+x.targets.join(", "):"")+". 원문은 중국어 공식 페이지.",
  source:"中华人民共和国商务部",url:x.url,source_date:x.date||null,route:null}));
}

/** US FDA new approvals (openFDA). */
export function fdaDocuments(file){
 return (file?.items||[]).filter(x=>/^https:\/\//.test(x.url||"")).map(x=>({
  id:"fda-"+x.application,type:"regulation",title:"미국 FDA 허가 · "+tidy((x.brand||[]).join(" / ")||x.application,90)+" · "+tidy(x.sponsor,60),
  aliases:["FDA","신약","허가","바이오","제약",x.sponsor,...(x.brand||[]),...(x.ingredients||[]),...(x.novel?["신규 분자","novel drug"]:[])],
  summary:"허가일 "+x.date+" · 신청번호 "+x.application+(x.novel?" · 신규 분자(제출 분류 TYPE 1)":"")+(x.ingredients?.length?" · 성분: "+x.ingredients.join(", "):"")+". 기업 실적·주가 영향은 단정하지 않습니다.",
  source:"U.S. FDA · openFDA",url:x.url,source_date:x.date||null,route:null}));
}

/** US county jobs by key industry (BLS QCEW). One entry per industry with the top counties. */
export function jobsDocuments(file){
 return Object.entries(file?.industries||{}).filter(([,v])=>/^https:\/\//.test(v.url||"")).map(([code,v])=>({
  id:"jobs-"+code,type:"dataset",title:"미국 "+tidy(v.label,40)+" 일자리 · 카운티 상위 ("+v.period+")",
  aliases:["일자리","고용","공장",v.label,"NAICS "+code,...(v.counties||[]).slice(0,6).map(c=>c.name).filter(Boolean)],
  summary:"민간 고용 상위: "+(v.counties||[]).slice(0,5).map(c=>(c.name||c.fips)+" "+c.employment.toLocaleString("en-US")+"명"+(c.yoy_change!=null?" (전년 대비 "+(c.yoy_change>=0?"+":"")+c.yoy_change.toLocaleString("en-US")+")":"")).join(" · ")+". BLS QCEW 분기 자료, 약 5~6개월 지연.",
  source:"U.S. BLS · QCEW",url:v.url,source_date:null,route:null}));
}

const KO = {USA:"미국",CHN:"중국",JPN:"일본",KOR:"한국",DEU:"독일",GBR:"영국",FRA:"프랑스",NLD:"네덜란드",IND:"인도",RUS:"러시아",ITA:"이탈리아",CAN:"캐나다",AUS:"호주",SAU:"사우디아라비아",ISR:"이스라엘",UKR:"우크라이나",VNM:"베트남",MEX:"멕시코",BRA:"브라질"};
/** One search entry per country from the World Bank profile indicators. */
export function countryProfileDocuments(file){
 const ind=file?.indicators||{},isos=new Set();
 for(const v of Object.values(ind))for(const k of Object.keys(v.countries||{}))isos.add(k);
 const fmt=(id,iso,f)=>{const l=ind[id]?.countries?.[iso]?.latest;return l?f(l.value)+" ("+l.year+")":null;};
 return [...isos].sort().map(iso=>{
  const parts=[["GDP",fmt("NY.GDP.MKTP.CD",iso,v=>(v/1e12).toFixed(2)+"조 달러")],["성장률",fmt("NY.GDP.MKTP.KD.ZG",iso,v=>v.toFixed(1)+"%")],["인구",fmt("SP.POP.TOTL",iso,v=>(v/1e6).toFixed(1)+"백만")],
   ["수출/GDP",fmt("NE.EXP.GNFS.ZS",iso,v=>v.toFixed(1)+"%")],["물가상승률",fmt("FP.CPI.TOTL.ZG",iso,v=>v.toFixed(1)+"%")],["국방비",fmt("MS.MIL.XPND.CD",iso,v=>Math.round(v/1e8).toLocaleString("en-US")+"억 달러")],["국방비/GDP",fmt("MS.MIL.XPND.GD.ZS",iso,v=>v.toFixed(2)+"%")]].filter(p=>p[1]);
  const name=KO[iso]||iso;
  return {id:"country-profile-"+iso,type:"country",title:"나라 특성 · "+name+" ("+iso+")",
   aliases:[name,iso,"나라 특성","GDP","인구","국방비","수출 비중","물가"],
   summary:parts.map(p=>p[0]+" "+p[1]).join(" · ")+". 세계은행 연간 자료(국방비 원 출처 SIPRI), 1~2년 지연.",
   source:"World Bank Open Data",url:"https://data.worldbank.org/country/"+iso,source_date:null,route:null};
 });
}

/** UK House of Commons divisions and European Parliament roll-call votes. */
export function parliamentVoteDocuments(uk,eu){
 const out=[];
 for(const d of uk?.divisions||[])if(/^https:\/\/votes\.parliament\.uk\//.test(d.url||""))out.push({id:"uk-division-"+d.id,type:"vote",title:"영국 하원 표결 · "+tidy(d.title,150),
  aliases:["영국","UK","하원","House of Commons","표결","의회"],summary:"표결일 "+d.date+" · 찬성 "+(d.ayes??"?")+" / 반대 "+(d.noes??"?")+". 의원별 표는 원문에서 확인.",
  source:"UK Parliament · Commons Votes",url:d.url,source_date:d.date||null,route:null});
 for(const v of eu?.votes||[])if(/^https:\/\/howtheyvote\.eu\//.test(v.url||""))out.push({id:"eu-vote-"+v.id,type:"vote",title:"유럽의회 표결 · "+tidy(v.title,150),
  aliases:["유럽","EU","유럽의회","European Parliament","표결","의회"],summary:"표결일 "+v.date+(v.result?" · 결과 "+v.result:"")+". 의원별 표는 원문에서 확인(유럽의회 공식 기록 기반 HowTheyVote.eu).",
  source:"HowTheyVote.eu · European Parliament",url:v.url,source_date:v.date||null,route:null});
 return out;
}
