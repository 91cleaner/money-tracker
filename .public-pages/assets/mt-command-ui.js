/* MONEY TRACKER command UI — source-backed exploration; no fabricated live data. */
(function(){
"use strict";
var root=document.getElementById("pg"),form=document.getElementById("usCmd"),query=document.getElementById("usQuery"),file=document.getElementById("usFile");
var data=window.MTIntelData;
if(!root||!form||!query||!file||!data||!window.L){
 var note=document.createElement("p");note.textContent="관제실 초기화 실패: 지도 또는 데이터 파일을 불러오지 못했습니다.";note.style.cssText="position:fixed;z-index:9999;left:10px;top:60px;padding:12px;background:#390e11;color:white";document.body.appendChild(note);return;
}
var state={mission:null,step:0};
var choices=document.createElement("section");choices.id="mtChoices";choices.hidden=true;choices.setAttribute("aria-live","polite");root.appendChild(choices);
var stat=document.createElement("div");stat.id="mtStatus";stat.textContent="공식 기록 기반 탐색 · 거래/시세/AI 미연결";root.appendChild(stat);
var intro=root.querySelector(".pg-say");if(intro)intro.textContent="사건을 검색하고 경로를 선택하세요 · 법안 → 의원 → 기업";
var oldHud=root.querySelector(".pg-top .mono");if(oldHud)oldHud.innerHTML="◉ SOURCE-BACKED INTELLIGENCE<br>거래 데이터 · AI · 실시간 시세: 미연결";
var map=L.map(root.querySelector(".pg-map"),{zoomControl:false,attributionControl:true,minZoom:2,maxZoom:18,worldCopyJump:true,zoomSnap:0.25});
map.attributionControl.setPrefix(false);
/* Same idea as the Korean room (polgame.js WORLD): keep panning inside the drawn world so the user cannot drag into the empty black void above/below the tiles.
   Longitude is wide (±540) so worldCopyJump still lets the user pan across the date line. */
map.setMaxBounds(L.latLngBounds([[-60,-540],[78,540]]));map.options.maxBoundsViscosity=1;
var dark=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",{maxZoom:18,maxNativeZoom:11,noWrap:false,attribution:"Map © Esri"}).addTo(map);
var tileFailures=0,tileFallbackActive=false;
dark.on("tileerror",function(){
 if(tileFallbackActive||++tileFailures<3)return;
 tileFallbackActive=true;
 map.removeLayer(dark);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:18,attribution:"© OpenStreetMap contributors"
 }).addTo(map).bringToBack();
 var warning=document.createElement("div");
 warning.id="mtTileFallback";
 warning.setAttribute("role","status");
 warning.style.cssText="position:absolute;z-index:760;left:10px;top:60px;max-width:320px;background:#102b1c;color:#dcffe8;border:1px solid #80c79a;border-radius:8px;padding:7px 10px;font:12px system-ui;pointer-events:none";
 warning.textContent="기본 지도 서버 연결 오류 · 대체 지도 사용 중";
 root.appendChild(warning);
});
var satPane=map.createPane("sat");satPane.style.zIndex="450";satPane.style.filter="brightness(.8) contrast(1.12) saturate(.85)";
var labelPane=map.createPane("satlab");labelPane.style.zIndex="460";labelPane.style.pointerEvents="none";
var sat=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{pane:"sat",minZoom:6,maxZoom:18,maxNativeZoom:18,opacity:0,noWrap:false}).addTo(map);
var satLabels=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",{pane:"satlab",minZoom:7,maxZoom:18,maxNativeZoom:18,opacity:0,noWrap:false}).addTo(map);
function minZoomForViewport(){return Math.max(2,Math.ceil(Math.log2(Math.max(320,root.querySelector(".pg-map").clientWidth)/256)*4)/4);}
map.setMinZoom(minZoomForViewport());
map.setView([39,-98],Math.max(3.5,map.getMinZoom()));
var zoomControl=L.control.zoom({position:"bottomright"}).addTo(map);
var pins=L.layerGroup().addTo(map),lines=L.layerGroup().addTo(map);
var satTag=document.createElement("div");satTag.id="mtSat";satTag.textContent="MAP · STRATEGIC";root.appendChild(satTag);
function syncSatellite(){
 var z=map.getZoom(),opacity=Math.max(0,Math.min(1,(z-6.5)/1.5));
 sat.setOpacity(opacity);satLabels.setOpacity(opacity*.86);
 root.classList.toggle("sat",opacity>.6);
 satTag.textContent=opacity>.6?"SAT · 실제 위성 영상":"MAP · STRATEGIC";
}
map.on("zoom zoomend",syncSatellite);syncSatellite();
function elem(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function button(text,cb,cls){
 var b=elem("button",cls||"",text);b.type="button";b.addEventListener("click",cb);return b;
}
function setStatus(s){stat.textContent=s;}
function clear(node){while(node.firstChild)node.removeChild(node.firstChild);}
function hideChoices(){choices.hidden=true;clear(choices);}
function hideFile(){file.hidden=true;clear(file);}
function renderWelcome(){
 // Map-first idle state: do not cover the map with a full welcome/choice panel.
 hideChoices();
 setStatus("지도 탐색 대기 · 기업·법안·의원·세계정세를 검색하세요 · AI/시세 미연결");
}

function renderChoices(items,unknown){
 clear(choices);choices.hidden=false;
 var head=elem("div","mt-choice-head");
 head.appendChild(elem("strong","",unknown?"일치하는 연결 데이터가 없습니다":"추적할 경로를 선택하세요"));
 head.appendChild(button("✕",hideChoices,"mt-x"));
 choices.appendChild(head);
 choices.appendChild(elem("p","mt-choice-note",unknown?"입력한 검색어를 임의로 '미국'에 연결하지 않습니다. 아래 검증된 주제에서 선택하세요.":"관련 공식 자료가 준비된 탐색 경로입니다. 실제 거래·실시간 시세는 미연결입니다."));
 items.forEach(function(m){
  var row=button(m.title+"  ›",function(){selectMission(m.id);},"mt-choice");
  var summary=elem("span","mt-choice-desc",m.summary);row.appendChild(summary);choices.appendChild(row);
 });
 setStatus(unknown?"검색 결과 없음 · 임의 데이터 생성 안 함":"탐색 경로 "+items.length+"개 선택 가능");
}
function findQuery(){
 var q=query.value.trim();
 if(!q){renderWelcome();query.focus();return;}
 if(window.MTResearch&&typeof window.MTResearch.show==="function"){hideChoices();window.MTResearch.show(q);setStatus("질문 분석 · 검증된 사실 / 원인 가설 / 사용자 판단");return;}
 var general=/^(미국|세계|기업|의원|시장|뉴스|투자|증시)$/i.test(q);
 var results=general?data.missions:data.search(q);
 renderChoices(results.length?results:data.missions.slice(0,5),!results.length);
}
form.addEventListener("submit",function(event){event.preventDefault();findQuery();});
query.addEventListener("keydown",function(event){if(event.key==="Escape"){hideChoices();query.blur();}});
function stopLocation(step){return [step.lat,step.lng];}
function drawRoute(m){
 pins.clearLayers();lines.clearLayers();
 var points=[];
 m.steps.forEach(function(s,i){
  var pt=stopLocation(s);
  if(i&&!(pt[0]===points[points.length-1][0]&&pt[1]===points[points.length-1][1])){
   L.polyline([points[points.length-1],pt],{color:"#6dffb0",dashArray:"6 9",weight:2,opacity:0.75,interactive:false}).addTo(lines);
  }
  points.push(pt);
  var active=i===state.step;
  var circle=L.circleMarker(pt,{radius:active?11:6,color:active?"#d6ff9d":"#58eaa0",weight:active?3:1.5,fillColor:active?"#a7ff69":"#0b4f32",fillOpacity:0.85}).addTo(pins);
  circle.bindTooltip((i+1)+". "+s.title);
  circle.on("click",function(){selectStep(i);});
 });
}
var travelGeneration=0,travelCleanup=null;
var flight=elem("div","mt-flight");flight.hidden=true;root.append(flight);
var flightText=elem("span","mt-flight-text","");
var flightSkip=button("SKIP ↳",function(){
 if(!flight._goal)return;
 var d=flight._goal;cancelTravel();map.setView(d.p,d.z,{animate:false});
},"mt-flight-skip");
flight.append(flightText,flightSkip);
function cancelTravel(){
 travelGeneration++;
 if(travelCleanup){travelCleanup();travelCleanup=null;}
 map.stop();flight.hidden=true;
}
function travelTo(point,zoom,caption){
 cancelTravel();
 var serial=travelGeneration;
 var target=L.latLng(point),start=map.getCenter();
 var wanted=Math.max(map.getMinZoom(),Math.min(18,zoom||10));
 var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 if(reduce){map.setView(point,wanted,{animate:false});return;}
 var meters=start.distanceTo(target),wide=Math.max(map.getMinZoom(),meters>1500000?3.75:meters>350000?5:Math.min(8,Math.max(5,map.getZoom()-2)));
 var phases=[
  {where:start,z:wide,delay:.70,label:"01 / OVERVIEW · 위치 확보"},
  {where:target,z:wide,delay:1.15,label:"02 / VECTOR · 추적 이동"},
  {where:target,z:wanted,delay:1.35,label:"03 / TARGET LOCK · 현장 접근"}
 ];
 if(meters<20000)phases.splice(1,1);
 flight.hidden=false;flight._goal={p:point,z:wanted};
 function advance(i){
  if(serial!==travelGeneration)return;
  if(i===phases.length){flight.hidden=true;travelCleanup=null;return;}
  var phase=phases[i],done=false,timer;
  flightText.textContent=phase.label+(caption?" · "+caption:"");
  function next(){
   if(done)return;
   done=true;map.off("moveend",next);
   clearTimeout(timer);travelCleanup=null;
   if(serial===travelGeneration)advance(i+1);
  }
  travelCleanup=function(){done=true;map.off("moveend",next);clearTimeout(timer);};
  map.once("moveend",next);
  timer=setTimeout(next,(phase.delay+.9)*1000);
  map.flyTo(phase.where,phase.z,{animate:true,duration:phase.delay});
 }
 advance(0);
}
map.on("dragstart",function(){if(!flight.hidden)cancelTravel();});
/* A deliberate zoom must win over the scripted flight. Before, only dragging stopped the flight, so a zoom made with the
   +/- buttons, mouse wheel, double-click, pinch or keyboard was undone when the flight's next phase flew back in to the target zoom. */
function userTookZoom(){if(!flight.hidden)cancelTravel();}
(function(){
 var box=map.getContainer(),capture={capture:true,passive:true};
 box.addEventListener("wheel",userTookZoom,capture);
 box.addEventListener("dblclick",userTookZoom,true);
 box.addEventListener("touchstart",function(e){if(e.touches&&e.touches.length>1)userTookZoom();},capture);
 box.addEventListener("keydown",function(e){if(e.key==="+"||e.key==="="||e.key==="-"||e.key==="_")userTookZoom();},true);
 var zc=zoomControl.getContainer();
 zc.addEventListener("pointerdown",userTookZoom,true);
 zc.addEventListener("click",userTookZoom,true);
})();
function selectStep(index){
 if(!state.mission||index<0||index>=state.mission.steps.length)return;
 state.step=index;
 var m=state.mission,step=m.steps[index];
 drawRoute(m);renderFile(m,step);
 var wanted=Math.max(map.getMinZoom(),step.zoom||10);
 travelTo(stopLocation(step),wanted,m.short+" "+(index+1)+"/"+m.steps.length);
 setStatus(m.short+" · "+(index+1)+"/"+m.steps.length+" · "+(step.kind==="unconnected"?"데이터 미연결":"공식 출처 제공"));
}
function openSource(step){
 if(step.source&&/^https:\/\/[a-z0-9.-]+\//i.test(step.source.url))window.open(step.source.url,"_blank","noopener,noreferrer");
}
function renderFile(m,s){
 clear(file);file.hidden=false;
 var header=elem("div","mt-file-head");header.appendChild(elem("div","mt-kicker","INTELLIGENCE PATH · "+(state.step+1)+"/"+m.steps.length));
 header.appendChild(button("✕",hideFile,"mt-x"));file.appendChild(header);
 file.appendChild(elem("h3","mt-file-title",s.title));
 file.appendChild(elem("p","mt-place",s.place));
 var kind=s.kind==="unconnected"?"미연결":s.kind==="context"?"탐색 맥락":"공식 기록";file.appendChild(elem("div","mt-databadge",kind));
 file.appendChild(elem("p","mt-detail",s.text));
 var photoHolder=elem("div","mt-file-photo");file.appendChild(photoHolder);
 if(window.MTPhoto)window.MTPhoto.render(photoHolder,s.id,s.place);
 file.appendChild(elem("div","mt-rel","↳ "+s.connection));
 var trail=elem("div","mt-trail");
 m.steps.forEach(function(n,i){var b=button((i+1)+" "+n.title,function(){selectStep(i);},"mt-stage"+(i===state.step?" active":""));b.setAttribute("aria-current",i===state.step?"step":"false");trail.appendChild(b);});
 file.appendChild(trail);
 var source=elem("a","mt-source","원문 확인 · "+s.source.title+" ↗");source.href=s.source.url;source.target="_blank";source.rel="noopener noreferrer";file.appendChild(source);
 file.appendChild(elem("p","mt-caution","실시간 거래 데이터·AI 분석·매수/매도 신호는 제공되지 않습니다."));
 var nav=elem("div","mt-file-nav");
 var prev=button("← 이전",function(){selectStep(state.step-1);});prev.disabled=state.step===0;
 var next=button(state.step===m.steps.length-1?"경로 끝 ✓":"다음 연결 →",function(){selectStep(state.step+1);});next.disabled=state.step===m.steps.length-1;
 nav.appendChild(prev);nav.appendChild(next);file.appendChild(nav);
}
function selectMission(id){
 var m=data.getMission(id);if(!m)return;
 state.mission=m;state.step=0;
 hideChoices();
 root.querySelectorAll(".pg-bar button").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.w===id));});
 selectStep(0);
 if(intro)intro.textContent="작전 중 · "+m.title+" · 지점과 단계를 직접 선택하세요";
}
root.querySelectorAll(".pg-bar button").forEach(function(b){b.addEventListener("click",function(){selectMission(b.dataset.w);});});
var options=root.querySelector(".pg-bar");if(options){
 var add=[{id:"history",label:"세계사",symbol:"◷"},{id:"disclosures",label:"공시",symbol:"◉"}];
 add.forEach(function(o){if(options.querySelector('[data-w="'+o.id+'"]'))return;var b=button(o.symbol+" ",function(){selectMission(o.id);});b.dataset.w=o.id;b.appendChild(elem("span","",o.label));options.appendChild(b);});
}
window.addEventListener("resize",function(){
 var minimum=minZoomForViewport();map.setMinZoom(minimum);map.invalidateSize({pan:false});
 if(map.getZoom()<minimum)map.setZoom(minimum,{animate:false});
});
var params=new URLSearchParams(window.location.search),requested=params.get("mission");
if(requested&&data.getMission(requested))selectMission(requested);
else renderWelcome();
function beginQuestion(){
 cancelTravel();
 hideFile();
 hideChoices();
 pins.clearLayers();lines.clearLayers();
 state.mission=null;state.step=0;
 root.querySelectorAll(".pg-bar button").forEach(function(b){b.setAttribute("aria-pressed","false");});
 if(intro)intro.textContent="질문 조사 중 · 관련 근거에서 현장 좌표를 찾으면 지도를 움직입니다";
 setStatus("질문 분석 진행 중 · 실시간 시세·AI 백엔드는 아직 미연결");
}
function resetCommand(){
 cancelTravel();
 hideFile();
 if(window.MTResearch&&typeof window.MTResearch.close==="function")window.MTResearch.close();
 state.mission=null;state.step=0;query.value="";
 pins.clearLayers();lines.clearLayers();
 root.querySelectorAll(".pg-bar button").forEach(function(b){b.setAttribute("aria-pressed","false");});
 if(intro)intro.textContent="세계지도를 직접 탐색하세요 · 기업·법안·의원·세계정세에 관해 자유롭게 질문하세요";
 var next=new URL(window.location.href);next.searchParams.delete("mission");
 window.history.replaceState(null,"",next.pathname+next.search+next.hash);
 map.flyTo([39,-98],Math.max(3.5,map.getMinZoom()),{duration:.85});
 renderWelcome();
}
var reset=button("초기화",resetCommand,"mt-reset");
reset.id="mtReset";reset.setAttribute("aria-label","검색 초기화 및 전체 관제실로 돌아가기");
form.insertBefore(reset,form.querySelector('button[type="submit"],button:not([type])'));

window.MTCommand={map:map,selectMission:selectMission,selectStep:selectStep,travelTo:travelTo,cancelTravel:cancelTravel,reset:resetCommand,beginQuestion:beginQuestion,search:function(q){query.value=q;findQuery();},getCurrent:function(){return state.mission?{mission:state.mission.id,step:state.step}:null;}};
})();
