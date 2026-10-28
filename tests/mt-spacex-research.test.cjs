"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const engine=require("../assets/mt-query-engine.js");
const intel=require("../assets/mt-intel-data.js");
const latest=require("../assets/mt-news-discovery.js");

test("natural SpaceX questions give specific current-market and policy evidence, not generic fallback",()=>{
 for(const q of ["스페이스엑스는 왜그래 요즘","SpaceX 근황 알려줘","SPACEX 무슨일이야?","SPCX 왜 떨어졌어?","스타십 최근 뉴스"]){
  const result=engine.analyze(q);
  assert.equal(result.id,"spacex",q);
  assert.equal(result.isFallback,false,q);
  assert.ok(result.facts.length>=7,q);
  assert.match(result.facts.map(x=>x.value).join(" "),/SPCX/,q);
 }
 const report=engine.analyze("스페이스엑스는 왜그래 요즘");
 assert.equal(report.intent,"situation");
 assert.match(report.title,/요즘 무슨 일이 있나/);
 assert.equal(report.ticker.includes("SPCX"),true);
 assert.match(report.facts.map(x=>x.value).join(" "),/145억7,500만 달러/);
 assert.ok(report.assumptions.length>=4);
 assert.ok(report.missions.includes("spacex"));
});
test("SPCX is listed, not an unlisted company; official evidence linked",()=>{
 const mission=intel.getMission("spacex");
 assert.ok(mission,"SpaceX mission");
 assert.ok(mission.steps.length>=5);
 assert.match(mission.symbols,/SPCX/);
 assert.doesNotMatch(mission.symbols,/비상장/);
 assert.match(mission.steps[0].source.url,/ir\.spacex\.com/);
 assert.ok(mission.steps.some(s=>/10-Q/.test(s.title)&&/sec\.gov/.test(s.source.url)));
 assert.ok(mission.steps.some(s=>/FAA/.test(s.title)));
 assert.equal(intel.search("스페이스엑스는 왜그래 요즘")[0].id,"spacex");
});
test("latest public news search extracts SpaceX from casual Korean and English",()=>{
 for(const q of ["스페이스엑스는 왜그래 요즘","spacex stock why down?","SPCX share down?","스타십 요즘 어떻게 되고 있어?"]){
  const a=latest.subject(q);
  assert.equal(a.valid,true);
  assert.equal(a.entity,"spacex");
  assert.equal(a.term,"SpaceX");
 }
 const url=latest.endpoint("SpaceX");
 assert.match(url,/query=SpaceX/);
 assert.match(url,/timespan=2weeks/);
 assert.match(url,/maxrecords=8/);
});
test("GDELT public article parser keeps HTTPS and provides date, source, no fake causal claim",async()=>{
 const sample={articles:[
  {url:"https://www.nasa.gov/some-news",title:"NASA SpaceX Crew Mission",seendate:"20261026093000",domain:"nasa.gov",language:"English"},
  {url:"http://insecure.example/article",title:"Untrusted scheme"},
  {url:"https://www.nasa.gov/some-news",title:"Duplicate"}
 ]};
 const fetched=await latest.retrieve("스페이스엑스는 왜그래 요즘",async (url,options)=>{
  assert.match(url,/api\.gdeltproject\.org/);assert.equal(options.credentials,"omit");
  return {ok:true,json:async()=>sample};
 });
 assert.equal(fetched.status,"ok");
 assert.equal(fetched.items.length,1);
 assert.equal(fetched.items[0].date,"2026-10-26");
 assert.equal(fetched.items[0].source,"nasa.gov");
 const fail=await latest.retrieve("SpaceX",async()=>{throw Error("down")});
 assert.equal(fail.status,"unavailable");
 assert.equal(fail.items.length,0);
});
test("private notes must not be submitted to external news search",async()=>{
 for(const q of ["my email me@example.com","내 계좌번호는 1234567890123"]){
  assert.equal(latest.subject(q).valid,false);
  let requested=false;
  const r=await latest.retrieve(q,async()=>{requested=true;throw Error("must not be called")});
  assert.equal(requested,false);
  assert.equal(r.status,"sensitive");
 }
});
test("SpaceX evidence JSON has IDs, authentic source URLs, dated market observations and typed edges",()=>{
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,"../data/us/cases/spcx-2026-10-27.json"),"utf8"));
 assert.equal(data.as_of,"2026-10-27");
 assert.ok(data.facts.length>=9);
 assert.ok(data.entities.find(e=>e.ticker==="SPCX"&&e.sec_cik==="0001181412"));
 assert.ok(data.facts.find(e=>e.date==="2026-10-22"&&e.daily_change_percent===-9.14));
 const src=new Map(data.sources.map(s=>[s.id,s]));
 const ents=new Set(data.entities.map(e=>e.id));
 for(const fact of data.facts){assert.ok(src.has(fact.source_id),fact.id);assert.ok(ents.has(fact.subject),fact.id);}
 for(const edge of data.edges){
  assert.ok(ents.has(edge.subject));assert.ok(ents.has(edge.object));
  assert.ok(src.has(edge.source_id));
  assert.ok(["VERIFIED_DIRECT","POLICY_CONTEXT","SUPPLY_CHAIN_CONTEXT","TEMPORAL_PROXIMITY","HYPOTHESIS"].includes(edge.relation_type));
 }
});
test("UI uses local indexed records and keeps automatic AI/news lookups disabled",()=>{
 const js=fs.readFileSync(path.join(__dirname,"../assets/mt-research-ui.js"),"utf8");
 const html=fs.readFileSync(path.join(__dirname,"../usa-command-legacy.html"),"utf8");
 assert.match(js,/renderIndexedSearch\(query,function\(index,results\)/);
 assert.match(js,/data\/us\/cases\/spcx-2026-10-27\.json/);
 assert.doesNotMatch(js,/^\s*runPublicResearch\(query,result\);/m);
 assert.doesNotMatch(js,/^\s*renderLiveBackend\(query\);/m);
 assert.match(html,/assets\/mt-local-search\.js/);
 assert.doesNotMatch(html,/src="assets\/mt-backend\.js/);
});
