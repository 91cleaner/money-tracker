"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const wiki=require("../assets/mt-open-research.js");
const fs=require("node:fs");
const path=require("node:path");

test("arbitrary natural-language questions become usable encyclopedia search terms",()=>{
 assert.match(wiki.focus("엔비디아는 왜 떨어지는 거야?"),/엔비디아/);
 assert.match(wiki.focus("미국 의회 역사 알려줘"),/미국 의회/);
 assert.ok(wiki.buildEndpoint("AI 법안","ko").includes("origin=*"),"MediaWiki CORS requires origin=*");
});
test("external searches show source URLs and strip markup safely",async()=>{
 let hits=0;
 const mock=async(url,options)=>{
  hits++;
  assert.match(url,/\.wikipedia\.org\/w\/api\.php/);
  assert.equal(options.credentials,"omit");
  return {ok:true,json:async()=>({query:{search:[
   {title:"미국 의회",snippet:"미국의 <span class=\"searchmatch\">입법 기관</span> &amp; 의회"}
  ]}})};
 };
 const result=await wiki.research("미국 의회 역사 알려줘",mock);
 assert.equal(result.status,"ok");
 assert.equal(result.results.length,1);
 assert.equal(result.results[0].title,"미국 의회");
 assert.match(result.results[0].summary,/입법 기관 & 의회/);
 assert.doesNotMatch(result.results[0].summary,/<span/);
 assert.match(result.results[0].url,/^https:\/\/ko\.wikipedia\.org\/wiki\//);
 assert.ok(hits>=1);
});
test("no fabricated results when Wikipedia is unavailable",async()=>{
 const result=await wiki.research("어떤 질문이든 가능?",async()=>{throw Error("offline")});
 assert.equal(result.status,"unavailable");
 assert.deepEqual(result.results,[]);
});
test("external search is explicit opt-in and neutral command is the default",()=>{
 const ui=fs.readFileSync(path.join(__dirname,"../assets/mt-research-ui.js"),"utf8");
 const cmd=fs.readFileSync(path.join(__dirname,"../assets/mt-command-ui.js"),"utf8");
 const page=fs.readFileSync(path.join(__dirname,"../usa-command.html"),"utf8");
 assert.match(ui,/클릭하면 검색어가 외부 Wikimedia 서버로 전송/);
 assert.match(ui,/window\.MTOpenResearch\.research\(question\)/);
 assert.match(cmd,/else renderWelcome\(\)/);
 assert.match(cmd,/function resetCommand\(\)/);
 assert.match(page,/mt-open-research\.js/);
 assert.doesNotMatch(page,/placeholder="엔비디아/);
});
