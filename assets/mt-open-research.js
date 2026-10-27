/* Open-source encyclopedia lookup for unmatched user questions.
 * No AI, no market quotes, no account credentials. Runs on user-submitted questions with minimized entity keywords.
 * Search subjects are transmitted to Wikimedia; results are reference leads, not verified market causes.
 */
(function(root,factory){
 var api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 root.MTOpenResearch=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
function trimQuery(input){
 return String(input==null?"":input).trim().replace(/\s+/g," ").slice(0,150);
}
function focus(query){
 var raw=trimQuery(query);
 var without=raw.replace(/[?!.,~]+/g," ")
  .replace(/\b(?:why|how|what|today|now|please|explain|research|latest|price|drop|falling|rising|stock|about)\b/gi," ")
  .replace(/(?:오늘|어제|지금|현재|당장|최근|이번주|대체|좀|알려줘|설명해줘|조사해줘|왜|어떻게|무슨|뭐야|떨어지(?:는|나|냐|지|는거야)|오르(?:는|나|냐)|주식시장|주가는|주가가|하는거야|그런거야|하는데|인가요|일까|일까나)/g," ")
  .replace(/\s+/g," ").trim();
 return without.length>=2?without.slice(0,120):raw;
}
function cleanSnippet(input){
 return String(input==null?"":input).replace(/<[^>]*>/g," ").replace(/&(?:amp|quot|lt|gt|nbsp|#39);/g,function(s){
  return {"&amp;":"&","&quot;":'"',"&lt;":"<","&gt;":">","&nbsp;":" ","&#39;":"'"}[s]||" ";
 }).replace(/\s+/g," ").trim().slice(0,330);
}
function buildEndpoint(term,lang){
 return "https://"+lang+".wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=5&srprop=snippet&origin=*&srsearch="+encodeURIComponent(term);
}
function parseResults(json,lang){
 var rows=json&&json.query&&Array.isArray(json.query.search)?json.query.search:[];
 return rows.filter(function(row){return typeof row.title==="string"&&row.title.length>0}).slice(0,5).map(function(row){
  return {title:row.title,summary:cleanSnippet(row.snippet||""),url:"https://"+lang+".wikipedia.org/wiki/"+encodeURIComponent(row.title.replace(/ /g,"_")),lang:lang,source:"Wikipedia / Wikimedia"};
 });
}
async function research(query,fetchFn){
 var full=trimQuery(query);
 if(!full)return {query:full,results:[],status:"empty",external:true};
 var fetcher=fetchFn||(typeof fetch==="function"?fetch:null);
 if(!fetcher)return {query:full,results:[],status:"unavailable",external:true};
 var lang=/[가-힣]/.test(full)?"ko":"en";
 var focused=focus(full);
 var attempts=[focused];
 if(full!==focused)attempts.push(full);
 var received=false;
 for(var i=0;i<attempts.length;i++){
  try{
   var response=await fetcher(buildEndpoint(attempts[i],lang),{mode:"cors",credentials:"omit",cache:"no-store"});
   if(!response||!response.ok)continue;
   received=true;
   var json=await response.json();
   var items=parseResults(json,lang);
   if(items.length)return {query:full,searched:attempts[i],results:items,status:"ok",external:true};
  }catch(e){/* errors handled with visible status below */}
 }
 return {query:full,searched:focused,results:[],status:received?"empty":"unavailable",external:true};
}
return {trimQuery:trimQuery,focus:focus,parseResults:parseResults,buildEndpoint:buildEndpoint,research:research};
});