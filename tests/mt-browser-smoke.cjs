"use strict";
/* Local browser smoke: verifies actual clicks and responsive layout, not just source text. */
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
async function run(){
 const port=await listen(),browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const out=path.join(base,"artifacts");fs.mkdirSync(out,{recursive:true});
 try{
  await page.goto("http://127.0.0.1:"+port+"/usa-command.html",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.MTCommand,{timeout:20000});
  assert.ok(await page.locator(".leaflet-container").count(),"map mounted");
  const start=await page.evaluate(()=>{const p=window.MTCommand.map.getCenter();return [p.lat,p.lng]});
  await page.waitForFunction(()=>!!window.MTResearch,{timeout:20000});
  await page.locator("#usQuery").fill("우주고래 허구의 사건");
  await page.locator("#usCmd button").click();
  await page.locator("#mtResearch").waitFor({state:"visible"});
  assert.match(await page.locator("#mtResearch").innerText(),/질문과 직접 맞는 종목|보유 중인 실제 공개 데이터/);
  assert.equal(await page.evaluate(()=>window.MTCommand.getCurrent()),null,"no invented fallback mission");
  await page.locator("#usQuery").fill("엔비디아는 왜 떨어지는 거야?");
  await page.locator("#usCmd button").click();
  assert.match(await page.locator("#mtResearch h2").innerText(),/엔비디아.*하락 원인 분석/);
  assert.match(await page.locator("#mtResearch").innerText(),/962억 달러/);
  assert.match(await page.locator("#mtResearch").innerText(),/수출규제/);
  assert.match(await page.locator("#mtResearch").innerText(),/실시간/);
  assert.ok(await page.locator("#mtResearch .mt-r-fact a").count()>=3,"source links");
  await page.locator("#mtResearch .mt-r-choice").first().click();
  assert.match(await page.locator("#mtResearch .mt-r-verdict").innerText(),/강세 가설 선택/);
  await page.locator("#mtResearch .mt-r-choices button").first().click();
  await page.waitForFunction(()=>window.MTCommand.getCurrent()?.mission==="nvda");
  assert.match(await page.locator("#usFile").innerText(),/NVIDIA/);
  assert.ok(await page.locator("#usFile .mt-photo-card").count()>0,"photo slot and source visible");
  assert.ok(await page.locator("#pg .mt-flight").count()>0,"operator camera HUD");
  await page.locator(".mt-file-nav button").last().click();
  assert.match(await page.locator("#usFile").innerText(),/TSMC/);
  await page.locator(".pg-bar [data-w=chips]").click();
  assert.match(await page.locator("#usFile").innerText(),/H.R.4346/);
  await page.locator(".mt-file-nav button").last().click();
  assert.match(await page.locator("#usFile").innerText(),/팀 라이언/);
  await page.locator(".mt-file-nav button").last().click();
  assert.match(await page.locator("#usFile").innerText(),/Intel/);
  assert.match(await page.locator("#usFile .mt-source").getAttribute("href"),/nist.gov/);
  await page.evaluate(()=>{window.MTCommand.cancelTravel();window.MTCommand.map.setView([40.08,-82.8],8,{animate:false});});
  await page.waitForFunction(()=>document.getElementById("mtSat").textContent.includes("SAT"));
  await page.screenshot({path:path.join(out,"command-desktop.png"),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(400);
  assert.ok(await page.locator("#usCmd").isVisible(),"mobile command");
  assert.ok(await page.locator(".pg-bar [data-w=history]").isVisible(),"mobile history button");
  await page.locator(".pg-bar [data-w=history]").click();
  assert.equal(await page.evaluate(()=>window.MTCommand.getCurrent()?.mission),"history");
  await page.screenshot({path:path.join(out,"command-mobile.png"),fullPage:true});
  assert.deepEqual(errors,[],"no uncaught page errors");
  console.log("PASS browser command smoke; screenshots in artifacts/");
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);process.exitCode=1;server.close();});
