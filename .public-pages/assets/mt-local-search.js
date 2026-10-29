/* MONEY TRACKER: no-cost, no-model search over versioned public evidence.
 * All searching occurs inside the browser after loading a published static index.
 * This is NOT a realtime market quote or AI interpretation engine.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==="object"&&module.exports)module.exports=api;
 root.MTLocalSearch=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
 "use strict";
 let cached=null,inflight=null;
 function normalize(q){return String(q??"").normalize("NFKC").toLocaleLowerCase().replace(/[\u200b-\u200d]/g,"").replace(/\s+/g," ").trim();}
 function tokens(q){
  return normalize(q).replace(/[?!,.()·→:;[\]{}]+/g," ").split(/\s+/).map(x=>x.trim()).filter(x=>x.length>=2&&!/^(?:무엇이|무엇|최근|요즘|그런|그런데|왜그래|어떻게|얼마나|무슨일|알려줘|조사해줘|검색|관련|사건|자료|정보|상황|대한|알려|보고|싶어|뭐야|what|the|why|how|about|please|now|latest)$/i.test(x)).slice(0,15);
 }
 function overlaps(input,term){
  if(input===term)return 1;
  if(input.length>=2&&(term.includes(input)||input.includes(term)))return 0.55;
  return 0;
 }
 function score(doc,query){
  const q=normalize(query),toks=tokens(query);
  if(!q)return 0;
  const title=normalize(doc.title),alias=(doc.aliases||[]).map(normalize),summary=normalize(doc.summary),id=normalize(doc.id);
  let points=0;
  if(id===q)points+=90;
  if(title===q)points+=80;
  if(title.includes(q))points+=45;
  if(alias.some(x=>x===q))points+=75;
  if(alias.some(x=>x.includes(q)))points+=38;
  let matches=0;
  const terms=toks.length?toks:[q];
  for(const term of terms){
   const short=term.replace(/(?:는|은|가|을|를|의|에서|으로|인가|때문|요즘)$/,"");
   const variants=short&&short!==term?[term,short]:[term];
   let best=0;
   for(const w of variants){
    if(w.length<2)continue;
    if(title.includes(w))best=Math.max(best,14);
    if(alias.some(x=>x===w))best=Math.max(best,25);
    else if(alias.some(x=>overlaps(x,w)>0))best=Math.max(best,17);
    if(id.includes(w))best=Math.max(best,8);
    if(summary.includes(w))best=Math.max(best,3);
   }
   if(best>0){points+=best;matches++;}
  }
  if(terms.length>1&&matches===terms.length)points+=25;
  if(terms.length>1&&matches===1)points*=.67;
  if(doc.type==="event"&&/사건|발표|요즘|최근|언제/.test(q))points+=4;
  return points;
 }
 function search(data,query,opts={}){
  const docs=Array.isArray(data)?data:Array.isArray(data?.documents)?data.documents:[];
  const lim=Math.max(1,Math.min(100,Number(opts.limit)||18));
  const filter=opts.type||"all";
  return docs.filter(d=>d&&d.title&&d.url&&/^https:\/\//.test(d.url)&&(!filter||filter==="all"||d.type===filter))
   .map(d=>({doc:d,rank:score(d,query)})).filter(v=>v.rank>4)
   .sort((a,b)=>b.rank-a.rank||((b.doc.source_date||"").localeCompare(a.doc.source_date||""))||a.doc.title.localeCompare(b.doc.title))
   .slice(0,lim).map(v=>({...v.doc,relevance:Math.round(v.rank*100)/100}));
 }
 async function load(fetcher){
  if(cached)return cached;
  if(inflight)return inflight;
  const get=fetcher||root.fetch;
  if(typeof get!=="function")throw Error("브라우저 자료 불러오기 기능을 사용할 수 없습니다");
  inflight=get("data/search/index.json?v=20261027-global1",{cache:"no-cache",credentials:"omit"}).then(r=>{
   if(!r.ok)throw Error("데이터베이스 파일을 가져올 수 없음 (HTTP "+r.status+")");
   return r.json();
  }).then(data=>{
   if(data.version!==1||!Array.isArray(data.documents))throw Error("검색 색인 형식 오류");
   cached=data;
   return data;
  }).finally(()=>{inflight=null;});
  return inflight;
 }
 function invalidate(){cached=null;inflight=null;}
 return {load,search,score,tokens,normalize,invalidate};
});