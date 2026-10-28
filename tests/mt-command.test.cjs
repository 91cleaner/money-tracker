"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const intel=require("../assets/mt-intel-data.js");
test("main missions include official semiconductor and disclosure routes",()=>{
 assert.ok(intel.missions.length>=5);
 for(const id of ["chips","trade","rates","history","disclosures"]){assert.ok(intel.getMission(id),id);}
});
test("common Korean and English questions return relevant CHOICE, not US fallback",()=>{
 const cases=[["대만 반도체","chips"],["H.R.4346","chips"],["관세 중국","trade"],["금리","rates"],["세계사","history"],["펠로시 주식거래","disclosures"],["TSMC","chips"]];
 for(const [q,id] of cases){assert.equal(intel.search(q)[0]?.id,id,q);}
});
test("unsupported query returns zero verified routes rather than defaulting to America",()=>{
 assert.deepEqual(intel.search("우주고래 허구의 사건"),[]);
 assert.ok(intel.search("").length>=5);
});
test("CHIPS Act route links original sponsor to sourced recipient companies",()=>{
 const m=intel.getMission("chips");
 assert.ok(m.steps.some(s=>/H.R.4346/.test(s.title)));
 assert.ok(m.steps.some(s=>/팀 라이언/.test(s.title)));
 assert.ok(m.steps.some(s=>/Intel/.test(s.title)&&/nist.gov/.test(s.source.url)));
 assert.ok(m.steps.some(s=>/TSMC/.test(s.title)&&/commerce.gov/.test(s.source.url)));
});
test("every source is HTTPS and every map point is valid",()=>{
 const nodeIds=new Set();
 intel.missions.forEach(m=>m.steps.forEach(s=>{
  assert.match(s.source.url,/^https:\/\/[a-z0-9.-]+\//i);
  assert.ok(s.lat>=-90&&s.lat<=90&&s.lng>=-180&&s.lng<=180,s.id);
  assert.ok(!nodeIds.has(s.id),"duplicate ID "+s.id);nodeIds.add(s.id);
 }));
});
test("NVIDIA link is industry context, not an invented direct CHIPS subsidy",()=>{
 const mission=intel.getMission("chips");
 const n=mission.steps.find(s=>s.id==="chips-nvda");
 assert.ok(n);
 assert.equal(n.kind,"context");
 assert.match(n.text,/직접 보조금을 받았다는 증거가 아닙니다/);
 assert.ok(Math.abs(n.lng-(-121.96708))<0.001);
});
test("unconnected stock disclosures are clearly flagged",()=>{
 const disclosures=intel.getMission("disclosures");
 assert.ok(disclosures.steps.every(s=>s.kind==="unconnected"));
 assert.ok(intel.getMission("chips").steps.some(s=>s.kind==="unconnected"));
});
test("single map entry and UI script references are present",()=>{
 const html=fs.readFileSync(path.join(__dirname,"../usa-command-legacy.html"),"utf8");
 const index=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
 assert.match(html,/mt-intel-data\.js/);
 assert.match(html,/mt-command-ui\.js/);
 assert.doesNotMatch(html,/function pick\(k\)/);
 assert.match(html,/#mtChoices\[hidden\]/);
 assert.match(index,/world-intelligence\//);
});
