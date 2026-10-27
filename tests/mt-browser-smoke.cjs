"use strict";
/* Actual Chromium smoke for cost-free evidence search, operator-only routes, and mobile UX. */
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const base=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".json":"application/json"};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
 const full=path.resolve(base,"."+pathname);
 if(!full.startsWith(base+path.sep)&&full!==base){res.writeHead(403).end();return;}
 fs.readFile(full,(err,bytes)=>{
  if(err){res.writeHead(404).end();return;}
  res.writeHead(200,{"Content-Type":types[path.extname(full)]||"application/octet-stream","Cache-Control":"no-store"});res.end(bytes);
 });
});
function listen(){return new Promise(resolve=>server.listen(0,"127.0.0.1",()=>resolve(server.address().port)));}
async function main(){
 const port=await listen();
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const errors=[],paidCalls=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",req=>{if(/(?:api\.x\.ai|api\.openai\.com|api\.finnhub\.io|\/api\/analyze)/.test(req.url()))paidCalls.push(req.url());});
  const out=path.join(base,"artifacts");fs.mkdirSync(out,{recursive:true});
  await page.goto("http://127.0.0.1:"+port+"/usa-command.html",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.MTCommand&&!!window.MTResearch&&!!window.MTLocalSearch,{timeout:20000});
  assert.ok(await page.locator(".leaflet-container").count(),"map mounted");
  assert.equal(await page.evaluate(()=>window.MTCommand.getCurrent()),null,"neutral startup");
  async function ask(question){
   await page.locator("#usQuery").fill(question);
   await page.locator("#usCmd button:last-child").click();
   await page.locator("#mtResearch").waitFor({state:"visible"});
   await page.waitForFunction(()=>document.querySelector("#mtResearch .mt-local-head")?.textContent.includes("AI 호출 0회"),{timeout:15000});
  }
  await ask("확인되지 않은 우주고래젤리의결");
  assert.equal(await page.locator("#mtResearch .mt-local-doc").count(),0,"unknown questions must not invent docs");
  assert.equal(await page.evaluate(()=>window.MTCommand.getCurrent()),null);
  await ask("엔비디아는 왜 떨어지는 거야?");
  assert.ok(await page.locator("#mtResearch .mt-local-doc").count()>0,"NVIDIA documented records found");
  assert.match(await page.locator("#mtResearch .mt-quick-summary").innerText(),/NVIDIA|엔비디아/);
  assert.equal(await page.evaluate(()=>window.MTCommand.getCurrent()),null,"operator chooses route");
  assert.equal(paidCalls.length,0,"no paid AI or quote API requests");
  await page.locator("#mtResearch .mt-quick-actions button").first().click();
  const first=page.locator("#mtResearch .mt-local-doc").first();
  await first.locator("button").click();
  await page.waitForFunction(()=>window.MTCommand.getCurrent()!=null,{timeout:12000});
  assert.ok(await page.locator("#usFile").isVisible(),"operator selected map evidence");
  await page.screenshot({path:path.join(out,"offline-command-desktop.png"),fullPage:true});
  await page.locator("#mtReset").click();
  assert.equal(await page.evaluate(()=>window.MTCommand.getCurrent()),null,"reset clears mission");
  await ask("스페이스엑스는 왜그래 요즘");
  assert.ok(await page.locator("#mtResearch .mt-local-doc").count()>0,"SpaceX evidence indexed");
  assert.match(await page.locator("#mtResearch .mt-quick-summary").innerText(),/SpaceX|SPCX|스페이스/);
  assert.equal(await page.locator("#mtResearch .mt-auto-research").count(),0,"auto external news requests disabled");
  assert.equal(paidCalls.length,0,"zero paid API network requests");
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(350);
  assert.ok(await page.locator("#usCmd").isVisible(),"mobile command");
  await page.screenshot({path:path.join(out,"offline-command-mobile.png"),fullPage:true});
  assert.deepEqual(errors,[],"no uncaught page errors");
  console.log("PASS: offline search, relevance, manual map, desktop/mobile, zero paid API requests");
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;server.close();});
