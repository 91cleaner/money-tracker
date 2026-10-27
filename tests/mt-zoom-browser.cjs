"use strict";
/* Real Chromium regression test for the US command-room zoom and satellite switching.
   External map tiles are blocked (offline CI), so this checks map logic only:
   zoom level, satellite layer opacity, the SAT/MAP tag and the flight controller. It cannot show real imagery. */
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
const listen=()=>new Promise(resolve=>server.listen(0,"127.0.0.1",()=>resolve(server.address().port)));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function load(browser,port,viewport,touch){
 const ctx=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:!!touch,isMobile:!!touch});
 const page=await ctx.newPage();
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",route=>route.request().url().startsWith("http://127.0.0.1:"+port+"/")?route.continue():route.abort());
 await page.goto("http://127.0.0.1:"+port+"/usa-command.html",{waitUntil:"commit",timeout:45000});
 await page.waitForFunction(()=>!!window.MTCommand&&!!window.MTCommand.map,{timeout:20000});
 const read=()=>page.evaluate(()=>{
  const m=window.MTCommand.map,layer=document.querySelector(".leaflet-sat-pane .leaflet-layer");
  return {zoom:m.getZoom(),min:m.getMinZoom(),lat:m.getCenter().lat,lng:m.getCenter().lng,
   flying:!document.querySelector(".mt-flight").hidden,
   satOpacity:layer?parseFloat(layer.style.opacity||"1"):null,
   satClass:document.getElementById("pg").classList.contains("sat"),tag:document.getElementById("mtSat").textContent};
 });
 return {page,ctx,errors,read};
}

async function main(){
 const port=await listen();
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});

  /* 1. Satellite switch follows zoom: map below 6.5, fading in to 8, real satellite above. */
  {
   const {page,errors,read}=await load(browser,port,{width:1280,height:800});
   await page.evaluate(()=>window.MTCommand.map.setView([39,-98],4,{animate:false}));
   let s=await read();
   assert.equal(s.satOpacity,0,"satellite hidden at low zoom");
   assert.equal(s.satClass,false);assert.match(s.tag,/MAP/);
   await page.evaluate(()=>window.MTCommand.map.setView([39,-98],7.25,{animate:false}));
   s=await read();
   assert.ok(s.satOpacity>0.3&&s.satOpacity<0.7,"satellite half faded in at z7.25, got "+s.satOpacity);
   await page.evaluate(()=>window.MTCommand.map.setView([39,-98],9,{animate:false}));
   s=await read();
   assert.equal(s.satOpacity,1,"satellite fully visible at z9");
   assert.equal(s.satClass,true);assert.match(s.tag,/SAT/);
   await page.evaluate(()=>window.MTCommand.map.setView([39,-98],4,{animate:false}));
   s=await read();
   assert.equal(s.satOpacity,0,"satellite fades back out when zooming out");
   assert.match(s.tag,/MAP/);

   /* 2. The real +/- buttons step the zoom and drive the satellite switch. */
   await page.click(".leaflet-control-zoom-in");await sleep(500);
   const z1=(await read()).zoom;assert.ok(z1>4,"zoom-in button works, zoom="+z1);
   for(let i=0;i<5;i++){await page.click(".leaflet-control-zoom-in");await sleep(450);}
   s=await read();assert.ok(s.zoom>=8&&s.satOpacity===1&&/SAT/.test(s.tag),"satellite on after zooming in with buttons");
   for(let i=0;i<6;i++){await page.click(".leaflet-control-zoom-out");await sleep(450);}
   s=await read();assert.ok(s.zoom<6.5&&s.satOpacity===0&&/MAP/.test(s.tag),"satellite off after zooming out with buttons");

   /* 3. Panning stays inside the drawn world (no empty void) and crosses the date line. */
   await page.evaluate(()=>window.MTCommand.map.setView([39,-98],4,{animate:false}));
   const box=await page.locator(".pg-map").boundingBox();
   for(let i=0;i<6;i++){
    await page.mouse.move(box.x+640,box.y+150);await page.mouse.down();
    await page.mouse.move(box.x+640,box.y+760,{steps:8});await page.mouse.up();await sleep(200);
   }
   s=await read();assert.ok(s.lat<=78,"cannot pan past the north edge, lat="+s.lat);
   await page.evaluate(()=>window.MTCommand.map.setView([35,170],4,{animate:false}));
   await page.mouse.move(box.x+900,box.y+400);await page.mouse.down();
   await page.mouse.move(box.x+300,box.y+400,{steps:10});await page.mouse.up();await sleep(1500); // let the drag inertia and world wrap finish
   s=await read();
   const lng=((s.lng+540)%360)-180; // same place on the map, whichever world copy the centre is in
   assert.ok(lng<-60&&lng>-180,"one drag from 170E crossed the date line into the western hemisphere, lng="+s.lng+" -> "+lng);
   assert.deepEqual(errors,[],"no uncaught page errors");
   await page.context().close();
  }

  /* 4. A deliberate zoom during the mission flight must win; the flight must not fly back in. */
  for(const how of ["button","wheel","dblclick"]){
   const {page,errors,read}=await load(browser,port,{width:1280,height:800});
   await page.evaluate(()=>window.MTCommand.selectMission("chips"));
   await page.waitForFunction(()=>!document.querySelector(".mt-flight").hidden,{timeout:5000});
   await sleep(1200);
   const during=await read();
   assert.ok(during.flying,how+": flight still running");
   const box=await page.locator(".pg-map").boundingBox();
   if(how==="button"){await page.click(".leaflet-control-zoom-out");await sleep(100);await page.click(".leaflet-control-zoom-out");}
   else if(how==="wheel"){await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,400);}
   else{await page.mouse.dblclick(box.x+640,box.y+400);}
   await sleep(700);
   const settled=await read();
   assert.equal(settled.flying,false,how+": flight stopped by user zoom");
   await sleep(6000);
   const later=await read();
   assert.ok(Math.abs(later.zoom-settled.zoom)<0.01,how+": zoom stayed where the user put it ("+settled.zoom+" -> "+later.zoom+")");
   assert.ok(later.zoom<10,how+": not pulled in to the target zoom 13, zoom="+later.zoom);
   assert.deepEqual(errors,[],how+": no uncaught page errors");
   await page.context().close();
  }

  /* 5. Pinch (touch) during the flight on a phone. */
  {
   const {page,errors,read}=await load(browser,port,{width:390,height:844},true);
   const cdp=await page.context().newCDPSession(page);
   const pinch=scale=>cdp.send("Input.synthesizePinchGesture",{x:195,y:400,scaleFactor:scale,relativeSpeed:600,gestureSourceType:"touch"});
   await page.evaluate(()=>window.MTCommand.selectMission("chips"));
   await sleep(1500);
   await pinch(0.35);await sleep(700);
   const settled=await read();
   assert.equal(settled.flying,false,"pinch stops the flight");
   await sleep(6000);
   const later=await read();
   assert.ok(Math.abs(later.zoom-settled.zoom)<0.01&&later.zoom<10,"pinch zoom is kept, zoom="+later.zoom);
   assert.deepEqual(errors,[],"no uncaught page errors on mobile");
   await page.context().close();
  }

  /* 6. Without any user input the flight still completes and ends on the step's zoom. */
  {
   const {page,errors,read}=await load(browser,port,{width:1280,height:800});
   await page.evaluate(()=>window.MTCommand.selectMission("chips"));
   await sleep(6500);
   const s=await read();
   assert.equal(s.flying,false,"flight completed");
   assert.equal(s.zoom,13,"unassisted flight reaches the step zoom");
   assert.ok(s.satOpacity===1&&/SAT/.test(s.tag),"satellite on at the destination");
   assert.deepEqual(errors,[],"no uncaught page errors");
   await page.context().close();
  }
  console.log("PASS: satellite switching, zoom buttons, world bounds, and user zoom during flight (button, wheel, double-click, pinch)");
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;server.close();});
