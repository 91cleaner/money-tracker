/**
 * MONEY TRACKER — official public metadata collectors (NO AI, no market quote purchases).
 * Japan NDL proceedings: https://kokkai.ndl.go.jp/api.html (polite requests; metadata only)
 * US Federal Register: https://www.federalregister.gov/developers/documentation/api/v1 (keyless)
 * US SEC submissions: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
 *  SEC requires a descriptive legitimate organization/contact User-Agent; provided by SEC_USER_AGENT.
 *
 * Official metadata may be corrected by publishers. Store retrieval and occurrence dates separately.
 */
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {snapshotChanged} from "./collection-snapshot.mjs";
const root=path.resolve(import.meta.dirname,"..");
const stamp=()=>new Date().toISOString();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function load(rel,empty){try{return JSON.parse(fs.readFileSync(path.join(root,rel),"utf8"));}catch(e){if(e.code==="ENOENT")return empty;throw e;}}
function write(rel,data){
 const target=path.join(root,rel);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 const old=load(rel,null);
 // Preserve changes to collector health even when no new records arrive.
 // Ignore retrieved_at-only differences to avoid unnecessary Git commits.
 if(!snapshotChanged(old,data)){console.log("UNCHANGED",rel);return false;}
 fs.writeFileSync(target,JSON.stringify(data,null,2)+"\n");
 console.log("UPDATED",rel,"rows",data?.records?.length||data?.filings?.length||0);
 return true;
}
const trim=(x,n=260)=>String(x??"").replace(/\s+/g," ").trim().slice(0,n);
const isUrl=s=>/^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(s||"");
async function json(url,options={}){
 const u=new URL(url);
 const domains=["www.federalregister.gov","kokkai.ndl.go.jp","data.sec.gov","data.ly.gov.tw"];
 if(!domains.includes(u.hostname))throw Error("unlisted host "+u.hostname);
 const r=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{
  "Accept":"application/json",
  ...(options.ua?{"User-Agent":options.ua}:{}),
 }});
 if(!r.ok)throw Error("HTTP "+r.status+" "+u.hostname);
 return r.json();
}
async function federalRegister(){
 const terms=["semiconductor","Taiwan","South Korea","Japan","export controls","artificial intelligence","advanced computing","SpaceX"];
 const items=new Map(),old=load("data/search/us-federal-register.json",{records:[]});
 for(const rec of old.records||[])if(rec.id)items.set(rec.id,rec);
 const errors=[];
 for(const term of terms){
  try{
   const q=new URL("https://www.federalregister.gov/api/v1/documents.json");
   q.searchParams.set("conditions[term]",term);
   q.searchParams.set("per_page","12");
   q.searchParams.set("order","newest");
   const data=await json(q.toString());
   for(const item of data.results||[]){
    if(!item.document_number||!isUrl(item.html_url))continue;
    const id=trim(item.document_number,45);
    const oldItem=items.get(id);
    items.set(id,{id,source:"Federal Register",source_url:item.html_url,
     date:trim(item.publication_date,10),title:trim(item.title,230),
     type:trim(item.type,20),agency:(item.agencies||[]).map(a=>trim(a.name,100)).slice(0,6),
     search_terms:[...new Set([...(oldItem?.search_terms||[]),term])],
     retrieved_at:stamp()});
   }
   console.log("FEDERAL REGISTER",term,(data.results||[]).length);
  }catch(e){errors.push(term+": "+e.message);console.warn("SKIP FR",term,e.message);}
  await pause(700);
 }
 const records=[...items.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)).slice(0,750);
 write("data/search/us-federal-register.json",{version:1,source:"Official Federal Register JSON API",retrieved_at:stamp(),status:errors.length?"partial":"ok",errors,records});
 return {count:records.length,errors};
}
async function japanDiet(){
 const terms=["半導体","台湾","韓国","経済安全保障","輸出規制","人工知能"];
 const items=new Map(),old=load("data/search/japan-diet.json",{records:[]});
 for(const record of old.records||[])if(record.id)items.set(record.id,record);
 const errors=[];
 for(const term of terms){
  try{
   const u=new URL("https://kokkai.ndl.go.jp/api/meeting_list");
   u.searchParams.set("any",term);u.searchParams.set("maximumRecords","12");u.searchParams.set("recordPacking","json");
   const j=await json(u.toString());
   for(const m of j.meetingRecord||[]){
    if(!m.issueID||!isUrl(m.meetingURL))continue;
    const id=trim(m.issueID,45),oldItem=items.get(id);
    items.set(id,{
     id,source:"National Diet Library of Japan",
     source_url:m.meetingURL,date:trim(m.date,10),
     title:trim((m.nameOfHouse||"국회")+" · "+(m.nameOfMeeting||"회의")+" · "+(m.issue||"회차"),210),
     house:trim(m.nameOfHouse,70),meeting:trim(m.nameOfMeeting,160),
     session:trim(m.session,30),
     speaker_samples:(m.speechRecord||[]).map(x=>trim(x.speaker,60)).filter(Boolean).slice(0,5),
     matched_terms:[...new Set([...(oldItem?.matched_terms||[]),term])],
     retrieved_at:stamp()
    });
   }
   console.log("JAPAN NDL",term,(j.meetingRecord||[]).length);
  }catch(e){errors.push(term+": "+e.message);console.warn("SKIP NDL",term,e.message);}
  // Official NDL documentation requests a pause of several seconds between bulk API calls.
  await pause(3000);
 }
 const records=[...items.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)).slice(0,700);
 write("data/search/japan-diet.json",{version:1,source:"National Diet Library official meeting_list API",retrieved_at:stamp(),status:errors.length?"partial":"ok",errors,records});
 return {count:records.length,errors};
}
function twRows(value){
 if(Array.isArray(value))return value;
 if(!value||typeof value!=="object")return [];
 for(const k of ["data","records","result","items","list","rows","bill","legislator"]){
  if(Array.isArray(value[k]))return value[k];
  if(value[k]&&Array.isArray(value[k].data))return value[k].data;
 }
 for(const v of Object.values(value))if(Array.isArray(v)&&v.every(x=>typeof x==="object"))return v;
 return [];
}
async function taiwanLegislature(){
 // Official Legislative Yuan Open Data Service, 11th term (2024–2028).
 // Datasets documented at data.ly.gov.tw/getds.action?id=16 and id=20.
 const term=String(process.env.TW_LEGISLATURE_TERM||"11");
 if(!/^(?:[1-9]|1[0-3])$/.test(term))return {status:"invalid-term",count:0};
 const previous=load("data/search/taiwan-legislature.json",{records:[]}),entries=new Map();
 for(const r of previous.records||[])if(r.id)entries.set(r.id,r);
 const errors=[];
 const configs=[
  {kind:"legislator",endpoint:"ID16Action.action",query:null},
  ...["半導體","人工智慧","經濟安全","供應鏈","能源","台美","國防"].map(q=>({kind:"bill",endpoint:"ID20Action.action",query:q}))
 ];
 for(const conf of configs){
  try{
   const u=new URL("https://data.ly.gov.tw/odw/"+conf.endpoint);
   u.searchParams.set("term",term);u.searchParams.set("fileType","json");
   if(conf.query)u.searchParams.set("billName",conf.query);
   const data=await json(u.toString()),records=twRows(data);
   if(!records.length){errors.push(conf.kind+":"+(conf.query||"all")+" yielded no supported JSON rows");continue;}
   for(const v of records.slice(0,250)){
    if(!v||typeof v!=="object")continue;
    const isBill=conf.kind==="bill";
    const name=trim(isBill?(v.billName||v.title||""):(v.name||v.ename||""),200);
    if(!name)continue;
    const billNum=trim(v.billNo||v.billNum||"",90);
    const dedupKey=[term,conf.kind,billNum||name,trim(v.billOrg||v.party||"",90)].join("|");
    const id=createHash("sha256").update(dedupKey).digest("hex").slice(0,22);
    const old=entries.get(id);
    const officialLink=isBill&&typeof v.pdfUrl==="string"&&isUrl(v.pdfUrl)?v.pdfUrl:u.toString();
    const record={id,kind:conf.kind,title:name,date:trim(v.proposeDate||v.date||v.onboardDate||"",20),
     term,source:"Taiwan Legislative Yuan official Open Data",source_url:officialLink,
     original_api_url:u.toString(),
     ...(isBill?{bill_number:billNum,proposer:trim(v.billProposer||v.billOrg||"",180),
      status:trim(v.billStatus||"",120),cosigners:trim(v.billCosignatory||"",220)}:
      {party:trim(v.party||"",100),district:trim(v.areaName||"",100),committee:trim(v.committee||"",150)}),
     matched_terms:[...new Set([...(old?.matched_terms||[]),...(conf.query?[conf.query]:[])])],
     retrieved_at:stamp()};
    entries.set(id,record);
   }
   console.log("TAIWAN LEGISLATURE",conf.kind,conf.query||"member list",records.length);
  }catch(e){errors.push((conf.query||"members")+": "+e.message);console.warn("SKIP TW",conf.query||"members",e.message);}
  await pause(1000);
 }
 const records=[...entries.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)).slice(0,900);
 write("data/search/taiwan-legislature.json",{version:1,source:"Official Taiwan Legislative Yuan Open Data Service",term,
  retrieved_at:stamp(),status:errors.length?"partial":"ok",errors,records});
 return {count:records.length,errors};
}
async function usSec(){
 const ua=(String(process.env.SEC_USER_AGENT||"").trim()||"MoneyTracker research Leecheolhan91@gmail.com");
 if(!ua||!ua.includes("@")){
  console.log("SEC SKIPPED — SEC_USER_AGENT is not configured (set a real public contact, not invented)");
  return {status:"not-configured",count:0};
 }
 const companies=[
  ["NVDA","NVIDIA",1045810],["TSLA","Tesla",1318605],["AAPL","Apple",320193],
  ["MSFT","Microsoft",789019],["AMD","Advanced Micro Devices",2488],
  ["INTC","Intel",50863],["SPCX","SpaceX",1181412]
 ];
 const old=load("data/search/sec-filings.json",{filings:[]});
 const items=new Map((old.filings||[]).map(x=>[x.cik+"-"+x.accession,x]));
 const errors=[];
 for(const [symbol,company,cik] of companies){
  try{
   const url="https://data.sec.gov/submissions/CIK"+String(cik).padStart(10,"0")+".json";
   const data=await json(url,{ua});
   const recent=data.filings?.recent||{};
   for(let i=0;i<Math.min(80,recent.accessionNumber?.length||0);i++){
    const accession=recent.accessionNumber[i],form=recent.form[i],filed=recent.filingDate[i],primary=recent.primaryDocument[i];
    if(!["10-K","10-Q","8-K","6-K","20-F","S-1"].includes(form)||!accession||!filed||!primary)continue;
    const docUrl="https://www.sec.gov/Archives/edgar/data/"+Number(cik)+"/"+accession.replace(/-/g,"")+"/"+encodeURIComponent(primary);
    if(!isUrl(docUrl))continue;
    items.set(cik+"-"+accession,{cik:String(cik),symbol,company,accession,form,filed,url:docUrl,source:"SEC EDGAR",retrieved_at:stamp()});
   }
   console.log("SEC",symbol);
  }catch(e){errors.push(symbol+": "+e.message);console.warn("SKIP SEC",symbol,e.message);}
  await pause(200);
 }
 const filings=[...items.values()].sort((a,b)=>b.filed.localeCompare(a.filed)||a.accession.localeCompare(b.accession)).slice(0,700);
 write("data/search/sec-filings.json",{version:1,source:"SEC public submissions, User-Agent provided by operator",retrieved_at:stamp(),status:errors.length?"partial":"ok",errors,filings});
 return {count:filings.length,errors};
}
const report={created_at:stamp(),pipeline:"official-public-no-ai",collectors:{}};
for(const [name,fn] of [["us_federal_register",federalRegister],["japan_diet",japanDiet],["taiwan_legislature",taiwanLegislature],["us_sec",usSec]]){
 try{report.collectors[name]=await fn();}catch(e){report.collectors[name]={status:"failed",error:e.message};}
}
fs.mkdirSync(path.join(root,"data/search"),{recursive:true});
fs.writeFileSync(path.join(root,"data/search/collection-status.json"),JSON.stringify(report,null,2)+"\n");
console.log("SUMMARY",JSON.stringify(report));
