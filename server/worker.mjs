/**
 * MONEY TRACKER secure AI research backend.
 * Deploy behind Cloudflare Access (all traffic, owner email only).
 * Server-side secrets: OPENAI_API_KEY (required), FINNHUB_API_TOKEN (optional).
 * Never expose a Worker publicly with these integrations.
 */
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
const SAFE_SYMBOLS={nvda:"NVDA",spcx:"SPCX",tsla:"TSLA",msft:"MSFT",aapl:"AAPL",intc:"INTC",amd:"AMD",tsm:"TSM"};
function detect(q){
 const s=q.toLowerCase();
 for(const [key,symbol] of Object.entries(SAFE_SYMBOLS))if(new RegExp("\\b"+key+"\\b").test(s))return symbol;
 if(/엔비디아|nvidia/.test(s))return "NVDA";
 if(/스페이스\s?엑스|spacex|스타십/.test(s))return "SPCX";
 if(/테슬라|tesla/.test(s))return "TSLA";
 return null;
}
function safeQuery(s){return String(s||"").replace(/[\n\r\t]+/g," ").trim().slice(0,500);}
function sourceItem(title,url,publisher,at){return {title:String(title||"").slice(0,180),url,source:publisher,at:at||null};}
async function getHeadlines(q){
 const term=detect(q)||safeQuery(q).split(" ").slice(0,4).join(" ").slice(0,70);
 if(!term)return {items:[],status:"no-term"};
 const u=new URL("https://api.gdeltproject.org/api/v2/doc/doc");
 u.searchParams.set("query",term);u.searchParams.set("mode","artlist");u.searchParams.set("format","json");u.searchParams.set("maxrecords","8");u.searchParams.set("sort","datedesc");u.searchParams.set("timespan","2weeks");
 try{
  const r=await fetch(u,{signal:AbortSignal.timeout(7500),headers:{"accept":"application/json"}});
  if(!r.ok)return {items:[],status:"provider-error"};
  const j=await r.json();
  const items=(Array.isArray(j.articles)?j.articles:[]).filter(x=>/^https:\/\//.test(x.url||"")).slice(0,7).map(x=>sourceItem(x.title,x.url,x.domain,x.seendate||null));
  return {items,status:items.length?"ok":"empty"};
 }catch{return {items:[],status:"unavailable"};}
}
async function getQuote(q,env){
 const symbol=detect(q);
 if(!symbol)return {status:"unidentified",symbol:null};
 if(!env.FINNHUB_API_TOKEN)return {status:"not-configured",symbol};
 try{
  const url=new URL("https://finnhub.io/api/v1/quote");url.searchParams.set("symbol",symbol);url.searchParams.set("token",env.FINNHUB_API_TOKEN);
  const r=await fetch(url,{signal:AbortSignal.timeout(6500)});
  if(!r.ok)return {status:"provider-error",symbol};
  const j=await r.json();
  if(!Number.isFinite(j.c)||!Number.isFinite(j.t)||j.t<=0||j.c<=0)return {status:"no-data",symbol};
  return {status:"provider-data",provider:"Finnhub",symbol,price:j.c,previousClose:j.pc,change:j.d,changePct:j.dp,providerTime:new Date(j.t*1000).toISOString(),realTimeGuarantee:false};
 }catch{return {status:"unavailable",symbol};}
}
function textOf(result){
 if(typeof result.output_text==="string")return result.output_text;
 return (result.output||[]).flatMap(item=>(item.content||[]).filter(c=>c.type==="output_text").map(c=>c.text||"")).join("\n");
}
const schema={
 type:"object",additionalProperties:false,
 required:["title","summary","confirmed","hypotheses","counterEvidence","watchNext","questions","warning"],
 properties:{
  title:{type:"string"},summary:{type:"string"},confirmed:{type:"array",items:{type:"string"}},
  hypotheses:{type:"array",items:{type:"string"}},counterEvidence:{type:"array",items:{type:"string"}},
  watchNext:{type:"array",items:{type:"string"}},questions:{type:"array",items:{type:"string"}},
  warning:{type:"string"}
 }
};
async function analyzeQuestion(question,headlines,quote,env){
 if(!env.OPENAI_API_KEY)return {status:"not-configured",brief:null};
 const now=new Date().toISOString();
 const sources=headlines.items.map((x,i)=>({index:i+1,title:x.title,source:x.source,url:x.url,date:x.at}));
 const body={
  model:env.OPENAI_MODEL||"gpt-4.1-mini",
  store:false,
  input:[
   {role:"system",content:"You are MONEY TRACKER, an evidence-based Korean market and geopolitical research analyst. Answer in natural Korean comprehensible to a high school student. Never pretend articles were fully read: only headlines and publisher metadata are provided; treat them as investigation leads, not verified event facts. Distinguish documented numerical quote observations from hypotheses. Never invent bills, stock prices, politician trades, exact causes, investment returns or dates. Be explicit when no data is available. List competing hypotheses and disconfirming checks. Do not give buy/sell commands. Keep it concise. Return JSON adhering to schema."},
   {role:"user",content:JSON.stringify({question,asOf:now,newsProviderStatus:headlines.status,headlines:sources,quote,notes:"News headlines are leads, not full articles; quote may be delayed or unavailable."})}
  ],
  text:{format:{type:"json_schema",name:"money_tracker_brief",strict:true,schema}},
  max_output_tokens:1600
 };
 try{
  const resp=await fetch("https://api.openai.com/v1/responses",{
   method:"POST",signal:AbortSignal.timeout(24000),headers:{"authorization":"Bearer "+env.OPENAI_API_KEY,"content-type":"application/json"},body:JSON.stringify(body)
  });
  if(!resp.ok)return {status:"provider-error",brief:null};
  const j=await resp.json();const text=textOf(j);const parsed=JSON.parse(text);
  return {status:"ok",brief:parsed};
 }catch{return {status:"unavailable",brief:null};}
}
export async function createResult(question,env){
 const [headlines,quote]=await Promise.all([getHeadlines(question),getQuote(question,env)]);
 const ai=await analyzeQuestion(question,headlines,quote,env);
 return {query:question,generatedAt:new Date().toISOString(),news:headlines,market:quote,ai,scope:"Official company/legislative materials require separate retrieval and verification; headline snippets are not evidence of causation.",operatorDecision:true};
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/health")return json({status:"ok",ai:!!env.OPENAI_API_KEY,quotes:!!env.FINNHUB_API_TOKEN,privateAccess:"must-be-configured-at-Cloudflare-edge"});
  if(url.pathname!=="/api/analyze")return json({error:"not-found"},404);
  if(request.method!=="POST")return json({error:"POST only"},405);
  // IMPORTANT: Do not rely on request Origin or a client-side key for authentication.
  // Cloudflare Access MUST protect every Worker production/preview hostname at the edge.
  if(env.ACCESS_PROTECTED!=="true")return json({error:"access-not-enabled",message:"Configure Cloudflare Access and set ACCESS_PROTECTED=true after verification."},503);
  const length=Number(request.headers.get("content-length")||0);
  if(length>3000)return json({error:"input-too-large"},413);
  let data;try{data=await request.json()}catch{return json({error:"invalid-json"},400)}
  const question=safeQuery(data?.question);
  if(question.length<2)return json({error:"question-required"},400);
  const output=await createResult(question,env);
  return json(output);
 }
};
