"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const code=fs.readFileSync(path.join(__dirname,"../server/worker.mjs"),"utf8")
 .replace("export async function createResult","async function createResult")
 .replace("export default {","const defaultWorker = {");
function run(fetcher){
 const context={fetch:fetcher,URL,Date,Number,JSON,Object,Array,RegExp,
   AbortSignal:{timeout:()=>({})},Response,console};
 vm.runInNewContext(code+";globalThis.MTTEST={createResult,pickProvider};",context);
 return context.MTTEST;
}
function mockApi(calls){
 return async (url,opts)=>{
  calls.push({url:String(url),opts});
  if(String(url).includes("gdeltproject"))return {ok:true,json:async()=>({articles:[]})};
  if(String(url).includes("api.x.ai"))return {ok:true,json:async()=>({
   output:[{type:"message",content:[{type:"output_text",text:JSON.stringify({
    title:"상황 조사",summary:"기록을 확인",confirmed:[],hypotheses:[],counterEvidence:[],watchNext:[],questions:[],warning:"검증 필요"
   })}]}],
   citations:["https://www.sec.gov/Archives/edgar","javascript:alert(1)"],
   usage:{cost_in_usd_ticks:150000000,server_side_tool_usage_details:{web_search_calls:1,x_posts_fetched:3,x_users_fetched:0}}
  })};
  if(String(url).includes("openai.com"))return {ok:false,status:400};
  throw new Error("Unexpected call "+url);
 };
}
test("Grok uses xAI protected API with live web tool and structured JSON, but no X posts by default",async()=>{
 const calls=[],api=run(mockApi(calls));
 const output=await api.createResult("SpaceX 왜 하락?",{XAI_API_KEY:"unit-test-key"},{provider:"grok"});
 assert.equal(output.ai.provider,"grok");
 assert.equal(output.ai.status,"ok");
 assert.equal(output.ai.model,"grok-4.7");
 assert.equal(output.ai.citations.length,1);
 assert.equal(output.ai.reportedCostUSD,0.015);
 const ai=calls.find(c=>c.url==="https://api.x.ai/v1/responses");
 assert.ok(ai);
 assert.equal(ai.opts.headers.authorization,"Bearer unit-test-key");
 const p=JSON.parse(ai.opts.body);
 assert.equal(p.store,false);
 assert.equal(p.max_turns,2);
 assert.equal(p.model,"grok-4.7");
 assert.deepEqual(p.tools.map(x=>x.type),["web_search"]);
 assert.equal(p.text.format.type,"json_schema");
});
test("X posts tool is present only after explicit checkbox consent",async()=>{
 const calls=[],api=run(mockApi(calls));
 const output=await api.createResult("테슬라 최근 X 반응",{XAI_API_KEY:"test"},{provider:"grok",includeX:true});
 assert.equal(output.ai.status,"ok");
 const p=JSON.parse(calls.find(c=>c.url.includes("api.x.ai")).opts.body);
 assert.deepEqual(p.tools.map(x=>x.type),["web_search","x_search"]);
 assert.equal(output.ai.tools.xPostsFetched,3);
});
test("request for Grok cannot leak an OpenAI API key as a fallback",async()=>{
 const calls=[],api=run(mockApi(calls));
 const out=await api.createResult("test",{OPENAI_API_KEY:"only-openai"},{provider:"grok",includeX:true});
 assert.equal(out.ai.status,"not-configured");
 assert.equal(out.ai.provider,"grok");
 assert.equal(calls.some(c=>c.url.includes("api.openai.com")||c.url.includes("api.x.ai")),false);
});
test("current private administrator gateway pauses paid AI and requires owner authentication",()=>{
 const source=fs.readFileSync(path.join(__dirname,"../cloudflare/admin-worker.js"),"utf8");
 assert.doesNotMatch(source,/env\.XAI_API_KEY/);
 assert.match(source,/ai:false,grok:false,openai:false,market:false,paused:true/);
 assert.match(source,/error:'ai-paused'/);
 assert.match(source,/session\.login\.toLowerCase\(\)!==env\.ADMIN_GITHUB_LOGIN\.toLowerCase\(\)/);
});
