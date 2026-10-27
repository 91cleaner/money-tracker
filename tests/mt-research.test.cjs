"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const engine=require("../assets/mt-query-engine.js");
test("question about NVDA decline gives evidence, hypotheses, sources, not a fake price",()=>{
 const r=engine.analyze("엔비디아는 왜 떨어지는 거야?");
 assert.equal(r.id,"nvda");
 assert.equal(r.intent,"cause");
 assert.equal(r.isFallback,false);
 assert.match(r.title,/하락 원인/);
 assert.ok(r.facts.length>=4);
 assert.match(r.facts.map(d=>d.value).join(" "),/중국 데이터센터/);
 assert.ok(Math.abs(r.location.lng-(-121.96708))<0.001);
 assert.match(r.photo.source,/commons.wikimedia.org/);
 assert.match(r.photo.credit,/CC BY-SA 4.0/);
 assert.ok(r.assumptions.length>=4);
 assert.ok(r.missions.includes("chips"));
 assert.match(r.opening,/미연결/);
 assert.ok(r.facts.every(d=>/^https:\/\//.test(d.source.url)));
 assert.ok(r.assumptions.every(h=>/^https:\/\//.test(h.source.url)));
 assert.ok(r.caveat.includes("실시간"));
});
test("natural-language questions map to relevant research domains",()=>{
 const cases=[["엔비디아 왜 하락했어","nvda"],["미국 금리가 왜 오르냐","rates"],["미중 관세 영향","trade"],["미국 의원 주식 매수했나","disclosures"],["대만해협 역사 알려줘","history"],["반도체법이 뭐야","chips"]];
 for(const [q,id] of cases)assert.equal(engine.analyze(q).id,id,q);
});
test("arbitrary nonsensical questions still yield a useful and clearly bounded investigation",()=>{
 const r=engine.analyze("외계인이 과자를 훔쳤는데 주식시장에 영향 있어?");
 assert.equal(r.isFallback,true);
 assert.ok(r.missions.length>=3);
 assert.ok(r.assumptions.length>0);
 assert.ok(r.facts.length>=3,"unknown query still shows verified but unrelated example data");
 assert.match(r.opening,/직접 맞는 종목|확인 가능한 기업 실적/);
 assert.ok(r.facts.every(d=>/^https:\/\//.test(d.source.url)));
});
test("user decides; the engine never asserts current prices or trade execution",()=>{
 for(const q of ["NVDA 사야 돼?","펠로시 왜 샀어?","금리 지금 얼마야","엔비디아 오늘 폭락했어?"]){
  const r=engine.analyze(q);
  assert.equal(r.userChoice.length,3);
  assert.match(r.caveat,/실시간/);
  assert.ok(!Object.hasOwn(r,"currentPrice"));
  assert.ok(!Object.hasOwn(r,"tradeOrder"));
 }
});
