/**
 * MONEY TRACKER local evidence index builder.
 * Offline deterministic generation from public, checked-in snapshots. Zero AI/API cost.
 * No scraped/copyrighted article text; only source links and short factual descriptors.
 */
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {koreanBillDocuments} from "./kr-bill-index.mjs";
import {marketReferenceDocuments,tradeControlDocuments,mofcomDocuments,fdaDocuments,jobsDocuments,countryProfileDocuments,parliamentVoteDocuments,companyLinkDocuments,krExportDocuments} from "./market-reference-index.mjs";
const require=createRequire(import.meta.url);
const root=path.resolve(import.meta.dirname,"..");
function read(p,fallback=null){try{return JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));}catch(e){if(e.code==="ENOENT")return fallback;throw e;}}
function safeUrl(url){return /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/|$)/i.test(url||"")?url:null;}
function coords(loc,label){
 if(!loc)return null;
 const lat=Number(loc.lat??loc[0]),lng=Number(loc.lng??loc[1]);
 return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng,label:String(loc.label||label||"자료에 연결된 지역 · 실시간 인물 위치가 아님").slice(0,130)}:null;
}
function clean(text,n=260){return String(text==null?"":text).replace(/\s+/g," ").trim().slice(0,n);}
function doc(x){
 if(!x||!x.id||!x.title||!safeUrl(x.url))return null;
 return {id:clean(x.id,120),type:clean(x.type||"source",30),title:clean(x.title,180),
  aliases:[...new Set((x.aliases||[]).map(v=>clean(v,110)).filter(Boolean))].slice(0,16),
  summary:clean(x.summary||"",330),source:clean(x.source,100),url:x.url,
  source_date:x.source_date||null,location:coords(x.location),route:x.route||null};
}
function build(){
 const docs=[],ids=new Set();
 function push(x){const d=doc(x);if(d&&!ids.has(d.id)){docs.push(d);ids.add(d.id);}}
 const seed=read("data/search/seed-docs.json",{items:[]});
 for(const item of seed.items||[])push(item);
 // Cross-border public source directories. All source URLs remain traceable.
 for(const country of ["us","tw","jp","kr"]){
  const countryFile=read("data/search/"+country+"-sources.json",{items:[]});
  for(const item of countryFile.items||[]){
   push({...item,type:item.type||"source",aliases:[...(item.aliases||[]),country,({us:"미국",tw:"대만",jp:"일본",kr:"한국"})[country]]});
  }
 }
 // Curated source-backed relationships, not AI-generated causality.
 const graph=read("data/search/relations.json",{nodes:[],edges:[]});
 for(const node of graph.nodes||[]){
  const source=(graph.sources||[]).find(src=>src.id===node.source_id);
  if(!source?.url)continue;
  push({id:"graph-"+node.id,type:node.type||"entity",title:node.title,
   aliases:node.aliases||[],summary:node.summary||"연결 관계 확인은 근거 자료 원문과 관련 날짜를 함께 검토해야 합니다.",
   source:source.name,url:source.url,source_date:node.date||null,location:node.location||null,
   route:node.route||null});
 }
 // Korean Assembly bill proposals and voted laws from saved official API snapshots.
 // This is searchable evidence, NOT live bill status or a verified company impact.
 const krSecurity=read("data/national/security.json",{bills:[],lead:{}});
 const krMembers=read("data/national/members.json",{members:[]});
 for(const item of koreanBillDocuments(krSecurity,krMembers))push(item);
 const members=read("data/us/members.json",{members:[]});
 for(const m of members.members||[]){
  if(!m.id||!m.name||!safeUrl(m.url))continue;
  const chamber=m.chamber==="sen"?"상원":m.chamber==="rep"?"하원":"미 의회";
  const party=m.party==="D"?"민주당":m.party==="R"?"공화당":"기타";
  const committees=(m.cmits||[]).slice(0,6).map(x=>clean(x,95));
  push({id:"member-"+m.id,type:"lawmaker",title:m.name+" · 미국 "+chamber+" ("+m.state+")",
   aliases:[m.name,m.id,m.state,...committees],summary:party+" · "+m.state+" · "+chamber+
     " · 위원회: "+committees.join(", ")+". 수록된 의원 데이터의 기준시점과 현직 여부는 반드시 공식 페이지에서 확인.",
   source:"미국 의원 공개 인명 데이터 (저장된 사본)",url:m.url,source_date:null,
   location:Array.isArray(m.ll)?{lat:m.ll[0],lng:m.ll[1],label:"지역구/의원실 관련 지도 좌표 · 사람의 실시간 위치 아님"}:null});
 }
 const intl=require(path.join(root,"assets/mt-intel-data.js"));
 for(const m of intl.missions||[]){
  for(const s of m.steps||[]){
   if(!s.source?.url)continue;
   push({id:"path-"+m.id+"-"+s.id,type:"trace",title:s.title,aliases:[m.title,m.short,...(m.keywords||[]).slice(0,12)],
    summary:s.text,source:s.source.title,url:s.source.url,source_date:null,
    location:{lat:s.lat,lng:s.lng,label:s.place},route:m.id});
  }
 }
 const caseFile=read("data/us/cases/spcx-2026-10-27.json");
 if(caseFile){
  const sources=Object.fromEntries((caseFile.sources||[]).map(x=>[x.id,x]));
  const entities=Object.fromEntries((caseFile.entities||[]).map(x=>[x.id,x]));
  for(const f of caseFile.facts||[]){
   const src=sources[f.source_id],ent=entities[f.subject];
   if(!src?.url)continue;
   push({id:"case-"+caseFile.id+"-"+f.id,type:"event",title:"SpaceX / SPCX · "+f.name,
    aliases:["SpaceX","SPCX","스페이스엑스","스타십",f.name],summary:f.statement_ko,source:src.publisher,url:src.url,
    source_date:f.date,location:ent&&{lat:ent.lat,lng:ent.lng,label:"사건·공시와 연결된 기관·사업장 좌표"},route:"spacex"});
  }
 }
 // Official Federal Register notices: metadata only, not news summaries.
 const register=read("data/search/us-federal-register.json",{records:[]});
 const usAlias={"semiconductor":"반도체","Taiwan":"대만","South Korea":"한국","Japan":"일본","export controls":"수출규제","artificial intelligence":"인공지능","advanced computing":"첨단 컴퓨팅","SpaceX":"스페이스엑스"};
 for(const m of register.records||[]){
  if(!m.id||!m.source_url)continue;
  const keywords=m.search_terms||[];
  push({id:"federal-register-"+m.id,type:"regulation",title:"미국 연방관보 · "+m.title,
   aliases:["미국","연방관보","규제",...keywords,...keywords.map(k=>usAlias[k]).filter(Boolean),...(m.agency||[])],
   summary:"미국 연방관보 "+m.type+" 문서. 발행일 "+m.date+". 법적 효력·시행일과 개별 기업 관련 여부는 원문에서 확인할 것.",
   source:"U.S. Federal Register",url:m.source_url,source_date:m.date,location:null,route:null});
 }
 // Taiwan Legislative Yuan: official current-term member and legislative bill metadata.
 const taiwan=read("data/search/taiwan-legislature.json",{records:[]});
 const trad={"半導體":"반도체","人工智慧":"인공지능","經濟安全":"경제안보","供應鏈":"공급망","能源":"에너지","台美":"미국 대만","國防":"국방"};
 for(const record of taiwan.records||[]){
  if(!record.id||!record.source_url)continue;
  const isBill=record.kind==="bill",term=record.matched_terms||[];
  push({id:"taiwan-legislature-"+record.id,type:isBill?"bill":"lawmaker",
   title:"대만 입법원 · "+record.title,aliases:["대만","대만 법안","臺灣","立法院",...term,...term.map(x=>trad[x]).filter(Boolean),record.proposer,record.party,record.committee],
   summary:isBill?"대만 입법원 제"+record.term+"대 의안 "+(record.bill_number||"")+
    " / 제안자 "+(record.proposer||"원문 참조")+" / 의안 상태 "+(record.status||"원문 확인")+". 실제 통과나 시행 여부는 공식 원문 검증 필요.":
    "대만 입법원 제"+record.term+"대 의원 · 정당 "+(record.party||"원문 확인")+
    " · 지역구 "+(record.district||"원문 확인")+" · 위원회 "+(record.committee||"원문 확인")+". 현재 재직 여부는 기준일 확인 필요.",
   source:"Taiwan Legislative Yuan Official Open Data",url:record.source_url,source_date:record.date||null,
   location:{lat:25.0478,lng:121.5209,label:"타이베이 · 대만 입법원 공식 자료 기관"},route:null});
 }
 // Japanese Diet meeting metadata: record identifiers and original URLs only, no unlicensed full transcript copies.
 const jpDiet=read("data/search/japan-diet.json",{records:[]});
 const jpAlias={"半導体":"반도체","台湾":"대만","韓国":"한국","経済安全保障":"경제안보","輸出規制":"수출규제","人工知能":"인공지능"};
 for(const m of jpDiet.records||[]){
  if(!m.id||!m.source_url)continue;
  push({id:"japan-diet-"+m.id,type:"minutes",title:"일본 국회 · "+m.title,
   aliases:["일본","국회 회의록",m.house,m.meeting,...(m.matched_terms||[]),...(m.matched_terms||[]).map(k=>jpAlias[k]).filter(Boolean),...(m.speaker_samples||[])],
   summary:"국립국회도서관 회의록 · 개최일 "+m.date+". 키워드 검색결과이며 이 문서가 어떤 법안에 찬성 또는 반대했다는 의미는 아님.",
   source:"National Diet Library of Japan",url:m.source_url,source_date:m.date,
   location:{lat:35.677,lng:139.745,label:"도쿄 · 국회 기록 출처 (현장 발언 위치가 아님)"},route:null});
 }
 const filing=read("data/search/sec-filings.json",{filings:[]});
 for(const f of filing.filings||[]){
  push({id:"filing-"+f.cik+"-"+f.accession,type:"filing",
   title:f.company+" ("+f.symbol+") · SEC "+f.form+" 공시",aliases:[f.company,f.symbol,f.cik,f.form],
   summary:"SEC가 접수한 "+f.form+" 문서. 제출 날짜 "+f.filed+". 원문을 확인하기 전에는 사건 내용이나 주가 영향을 단정할 수 없습니다.",
   source:"SEC EDGAR",url:f.url,source_date:f.filed});
 }
 const macro=read("data/search/macro.json",{series:[]});
 for(const series of macro.series||[]){
  const obs=series.observations?.at(-1);
  if(!obs)continue;
  push({id:"macro-"+series.id,type:"macro",title:series.title+" · "+obs.value+" "+series.unit,
   aliases:[series.id,series.title,...(series.aliases||[])],
   summary:series.title+"의 최근 저장 관측값: "+obs.value+" "+series.unit+" (관측일 "+obs.date+"). 발표 시차와 개정 가능성 있음. 투자 신호가 아닙니다.",
   source:"Federal Reserve Bank of St. Louis · FRED",url:series.url,source_date:obs.date,route:"rates"});
 }
 // Sector → factor reference map and official market calendar (data/market). Reference only, no forecast.
 const marketName=stem=>read("data/markets/"+stem+".json",{})?.name||null;
 let topicText="";try{topicText=fs.readFileSync(path.join(root,"collector/world/topics.py"),"utf8");}catch(e){}
 const topicLabels=Object.fromEntries([...topicText.matchAll(/\{"id": "([a-z_]+)", "label": "([^"]+)"/g)].map(m=>[m[1],m[2]]));
 for(const item of marketReferenceDocuments(read("data/market/sectors.json",{}),read("data/market/calendar.json",{}),marketName,t=>topicLabels[t]||t))push(item);
 for(const item of krExportDocuments(read("data/market/factors/kr-exports-by-item.json",{})))push(item);
 for(const item of companyLinkDocuments(read("data/market/company-links.json",{})))push(item);
 for(const item of parliamentVoteDocuments(read("data/market/factors/uk-commons-divisions.json",{}),read("data/market/factors/eu-parliament-votes.json",{})))push(item);
 for(const item of countryProfileDocuments(read("data/market/factors/country-profiles.json",{})))push(item);
 for(const item of fdaDocuments(read("data/market/factors/us-fda-approvals.json",{})))push(item);
 for(const item of jobsDocuments(read("data/market/factors/us-jobs-by-county.json",{})))push(item);
 for(const item of mofcomDocuments(read("data/market/factors/cn-mofcom-announcements.json",{})))push(item);
 for(const item of tradeControlDocuments(read("data/market/factors/us-trade-controls.json",{})))push(item);
 docs.sort((a,b)=>a.id.localeCompare(b.id,"en"));
 // Keep the index deterministic and deduplicate by stable identifiers.
 const counts={};
 for(const d of docs)counts[d.type]=(counts[d.type]||0)+1;
 const outPath=path.join(root,"data/search/index.json");
 const previous=read("data/search/index.json");
 const same=previous&&JSON.stringify(previous.documents)===JSON.stringify(docs);
 if(same){console.log("NO CHANGE: "+docs.length+" indexed source entries");return false;}
 const next={version:1,built_at:new Date().toISOString(),counts,documents:docs};
 fs.mkdirSync(path.dirname(outPath),{recursive:true});
 fs.writeFileSync(outPath,JSON.stringify(next,null,2)+"\n");
 console.log("INDEX CREATED: "+docs.length+" items; "+JSON.stringify(counts));
 return true;
}
build();
