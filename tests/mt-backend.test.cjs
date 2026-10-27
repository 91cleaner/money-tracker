"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const bridgePath=path.join(__dirname,"../assets/mt-backend.js");
const bridgeCode=fs.readFileSync(bridgePath,"utf8");
function runBridge(origin,enabled,fetcher){
 const ctx={module:{exports:{}},location:{origin},MT_BACKEND_ENABLED:enabled,fetch:fetcher};
 vm.runInNewContext(bridgeCode,ctx);
 return ctx.module.exports;
}
test("public Github Pages never calls private AI backend, even if flag is forced",async()=>{
 let calls=0;
 const bridge=runBridge("https://91cleaner.github.io",true,async()=>{calls++;throw Error("must not fetch")});
 const response=await bridge.analyze("SpaceX");
 assert.equal(response.status,"not-connected");
 assert.equal(calls,0);
});
test("protected same-origin only allows POST after explicit enabled flag",async()=>{
 let captured=null;
 const mock=async(url,args)=>{
  captured={url,args};
  return {ok:true,json:async()=>({ai:{status:"ok",brief:{title:"test"}}})};
 };
 const disabled=runBridge("https://private.example.com",false,mock);
 assert.equal((await disabled.analyze("SpaceX")).status,"not-connected");
 const bridge=runBridge("https://private.example.com",true,mock);
 const result=await bridge.analyze("엔비디아 지금 왜 떨어져?",mock);
 assert.equal(result.status,"ok");
 assert.equal(captured.url,"/api/analyze");
 assert.equal(captured.args.credentials,"same-origin");
 assert.equal(captured.args.method,"POST");
 assert.match(captured.args.body,/엔비디아/);
});
test("bridge handles explicit unconfigured server response",async()=>{
 const b=runBridge("https://private.example.com",true,async()=>({ok:false,status:503,json:async()=>({error:"access-not-enabled",message:"Missing Access"})}));
 const r=await b.analyze("SpaceX");
 assert.equal(r.status,"server-error");
 assert.equal(r.code,"access-not-enabled");
});
test("production pages omit paid AI bridge, while dormant source remains for later",()=>{
 const ui=fs.readFileSync(path.join(__dirname,"../assets/mt-research-ui.js"),"utf8");
 const html=fs.readFileSync(path.join(__dirname,"../usa-command.html"),"utf8");
 assert.match(ui,/renderIndexedSearch\(query,function\(index,results\)/);
 assert.doesNotMatch(ui,/^\s*renderLiveBackend\(query\);/m);
 assert.doesNotMatch(html,/src="assets\/mt-backend\.js/);
 assert.match(html,/src="assets\/mt-local-search\.js/);
});
