/**
 * MONEY TRACKER local evidence index builder.
 * Offline deterministic generation from public, checked-in snapshots. Zero AI/API cost.
 * No scraped/copyrighted article text; only source links and short factual descriptors.
 */
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
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
