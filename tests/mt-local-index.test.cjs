"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const local=require("../assets/mt-local-search.js");
const root=path.resolve(__dirname,"..");
const json=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const index=json("data/search/index.json");
test("multi-country evidence index is already populated before any API connection",()=>{
 assert.ok(index.documents.length>=600,"expected 600+ source-linked documents");
 assert.ok(index.counts.lawmaker>=500,"existing US lawmakers should be indexed");
 assert.ok(index.documents.some(x=>x.id==="graph-TW"));
 assert.ok(index.documents.some(x=>x.id==="graph-JP"));
 assert.ok(index.documents.some(x=>x.id==="graph-KR"));
 assert.ok(index.documents.some(x=>x.id==="graph-US"));
 const ids=new Set(index.documents.map(d=>d.id));
 assert.equal(ids.size,index.documents.length,"duplicate ids");
});
test("user queries retrieve related evidence without AI calls",()=>{
 const terms=[
  ["엔비디아 왜 떨어져","NVIDIA"],
  ["대만 반도체","대만"],
  ["일본 국회","일본"],
  ["한국 법안","국회"],
  ["미국 의회","미국"],
  ["스페이스엑스","SpaceX"],
  ["펠로시","펠로시"]
 ];
 for(const [q,expected] of terms){
  const found=local.search(index,q,{limit:30});
  assert.ok(found.length>0,q);
  assert.ok(found.some(x=>(x.title+" "+x.summary+" "+x.aliases.join(" ")).includes(expected)),q+" / "+expected);
 }
 assert.equal(local.search(index,"확인되지 않은 우주고래젤리의결").length,0);
});
test("every result has source URL; no fictional market price or automatic AI inference",()=>{
 for(const doc of index.documents){
  assert.match(doc.url,/^https:\/\//);
  assert.ok(doc.title.length>0);
  assert.ok(Array.isArray(doc.aliases));
  assert.ok(doc.id.length>0);
  if(doc.location){
   assert.ok(Math.abs(doc.location.lat)<=90);
   assert.ok(Math.abs(doc.location.lng)<=180);
  }
 }
 const page=fs.readFileSync(path.join(root,"usa-command.html"),"utf8");
 const ui=fs.readFileSync(path.join(root,"assets/mt-research-ui.js"),"utf8");
 assert.match(page,/assets\/mt-local-search\.js/);
 assert.doesNotMatch(page,/src="assets\/mt-backend\.js/);
 assert.match(ui,/renderIndexedSearch\(query\)/);
 assert.doesNotMatch(ui,/^\s*renderLiveBackend\(query\);/m);
 assert.doesNotMatch(ui,/^\s*runPublicResearch\(query,result\);/m);
});
test("source registries cover US/TW/JP/KR with official URLs",()=>{
 for(const country of ["us","tw","jp","kr"]){
  const records=json("data/search/"+country+"-sources.json").items;
  assert.ok(records.length>=5,country);
  for(const row of records){
   assert.match(row.url,/^https:\/\//);
   assert.equal(row.country,country);
  }
 }
});
test("country relationship edges are typed and cite source documents",()=>{
 const graph=json("data/search/relations.json");
 const nodes=new Set(graph.nodes.map(x=>x.id));
 const sources=new Set(graph.sources.map(x=>x.id));
 assert.ok(graph.edges.length>=20);
 for(const edge of graph.edges){
  assert.ok(nodes.has(edge.from),edge.from);
  assert.ok(nodes.has(edge.to),edge.to);
  assert.ok(sources.has(edge.source_id),edge.source_id);
  assert.ok(["VERIFIED_DIRECT","POLICY_CONTEXT","SUPPLY_CHAIN_CONTEXT","TEMPORAL_PROXIMITY","HYPOTHESIS"].includes(edge.relation_type));
  assert.equal(edge.not_proof_of_stock_causality,true);
 }
});
test("official collectors and nightly GitHub workflow have no model API dependencies",()=>{
 const collector=fs.readFileSync(path.join(root,"scripts/collect-public-records.mjs"),"utf8");
 const wf=fs.readFileSync(path.join(root,".github/workflows/overnight-public-data.yml"),"utf8");
 assert.match(collector,/kokkai\.ndl\.go\.jp/);
 assert.match(collector,/federalregister\.gov/);
 assert.match(collector,/SEC_USER_AGENT/);
 assert.doesNotMatch(collector,/XAI_API_KEY|OPENAI_API_KEY/);
 assert.match(wf,/30 15,18 \* \* \*/);
 assert.match(wf,/scripts\/build-local-index\.mjs/);
});
