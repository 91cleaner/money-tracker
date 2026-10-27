/* MONEY TRACKER: automated public news evidence discovery for an operator's question.
 * GDELT DOC 2.0 publishes cross-origin JSON: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 * Public news headlines and timestamps are leads, not verified causal claims.
 * No model, quote API or proprietary market-data access is implied.
 */
(function(root,factory){
 var api=factory();if(typeof module==="object"&&module.exports)module.exports=api;
 root.MTNewsDiscovery=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
var ALIASES=[
 {re:/(?:스페이스\s?엑스|spacex|space x|스타십|starship|스타링크|starlink|팰컨9|falcon 9)/i,term:"SpaceX",entity:"spacex",description:"우주산업 · Starship / NASA / Starlink"},
 {re:/(?:엔비디아|nvidia|nvda|젠슨\s?황|blackwell)/i,term:"NVIDIA",entity:"nvda",description:"AI 반도체 기업"},
 {re:/(?:마이크로소프트|microsoft|msft)/i,term:"Microsoft",entity:"microsoft",description:"상장 기술기업"},
 {re:/(?:테슬라|tesla|tsla|사이버트럭|옵티머스)/i,term:"Tesla",entity:"tesla",description:"전기차 · AI 기업"},
 {re:/(?:삼성전자|samsung electronics)/i,term:"Samsung Electronics",entity:"samsung",description:"반도체·전자기업"},
 {re:/(?:애플|apple|aapl|아이폰)/i,term:"Apple",entity:"apple",description:"상장 기술기업"},
 {re:/(?:대만|taiwan|대만해협)/i,term:"Taiwan",entity:"taiwan",description:"동아시아 공급망·외교"},
 {re:/(?:중국|china|미중)/i,term:"China",entity:"china",description:"중국 정책·무역"},
 {re:/(?:반도체|칩스법|chips act)/i,term:"semiconductor",entity:"chips",description:"반도체 산업"},
 {re:/(?:미국\s?금리|연준|fomc|fed\b|국채)/i,term:"Federal Reserve",entity:"rates",description:"미국 통화정책"},
 {re:/(?:관세|tariff|무역전쟁)/i,term:"tariffs",entity:"trade",description:"무역 정책"}
];
function normalize(input){return String(input==null?"":input).trim().replace(/\s+/g," ").slice(0,140);}
function hasSensitive(input){return /(?:[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?:\d[\s-]?){9,}|비밀번호|패스워드|주민등록번호|계좌번호|인증번호|API[\s-]*KEY|api[\s-]*키|secret[\s-]*key)/i.test(input);}
function subject(input){
 var q=normalize(input);
 if(!q)return {term:"",entity:null,description:"",valid:false,reason:"empty"};
 if(hasSensitive(q))return {term:"",entity:null,description:"",valid:false,reason:"sensitive"};
 for(var i=0;i<ALIASES.length;i++){var a=ALIASES[i];if(a.re.test(q))return{term:a.term,entity:a.entity,description:a.description,valid:true,reason:"matched"};}
 // For unknown queries keep only non-sentence, non-sensitive search keywords, not full user narrative.
 var tokens=q.replace(/[?!.,:;()"“”‘’]/g," ").split(/\s+/).filter(Boolean).filter(function(token){
  return !/^(?:왜|뭐야|어떻게|최근|지금|요즘|오늘|이거|그거|어제|아니|내가|같아|알려줘|조사해줘|정보|분석|주식|왜그래|궁금해|도대체|what|why|how|please|tell|me|about|today|latest|stock|price)$/i.test(token);
 }).slice(0,4);
 var term=tokens.join(" ").trim().slice(0,65);
 if(!term)return {term:"",entity:null,description:"",valid:false,reason:"too-vague"};
 return {term:term,entity:null,description:"일반 키워드 (기업·사건 식별 미확인)",valid:true,reason:"generic"};
}
function endpoint(term,range){
 var query=String(term||"").trim().replace(/["\\]/g,"").slice(0,65);
 return "https://api.gdeltproject.org/api/v2/doc/doc?query="+encodeURIComponent(query)+"&mode=artlist&format=json&maxrecords=8&sort=datedesc&timespan="+(range==="month"?"1month":"2weeks");
}
function parse(data){
 if(!data||!Array.isArray(data.articles))return [];
 var seen={},found=[];
 for(var i=0;i<data.articles.length&&found.length<8;i++){
  var a=data.articles[i]||{};
  var url=typeof a.url==="string"?a.url.trim():"";
  if(!/^https:\/\//i.test(url)||url.length>2200||seen[url])continue;
  seen[url]=true;
  var title=String(a.title||"").replace(/\s+/g," ").trim().slice(0,240);
  if(!title)continue;
  var date=String(a.seendate||"");
  var matched=date.match(/^(\d{4})(\d{2})(\d{2})/);
  found.push({title:title,url:url,source:String(a.domain||"").slice(0,100),date:matched?matched[1]+"-"+matched[2]+"-"+matched[3]:"발행시각 미확인",language:String(a.language||"").slice(0,30),kind:"news-reference"});
 }
 return found;
}
async function retrieve(question,fetchFn,range){
 var sub=subject(question);
 if(!sub.valid)return {status:sub.reason,subject:sub,items:[],provider:"GDELT DOC 2.0"};
 var fetcher=fetchFn||(typeof fetch==="function"?fetch:null);
 if(!fetcher)return {status:"unavailable",subject:sub,items:[],provider:"GDELT DOC 2.0"};
 try{
  var response=await fetcher(endpoint(sub.term,range),{mode:"cors",credentials:"omit",cache:"no-store"});
  if(!response||!response.ok)throw Error("API request rejected");
  var results=parse(await response.json());
  return {status:results.length?"ok":"empty",subject:sub,items:results,provider:"GDELT DOC 2.0"};
 }catch(e){return {status:"unavailable",subject:sub,items:[],provider:"GDELT DOC 2.0"};}
}
return {aliases:ALIASES,subject:subject,endpoint:endpoint,parse:parse,retrieve:retrieve,hasSensitive:hasSensitive};
});