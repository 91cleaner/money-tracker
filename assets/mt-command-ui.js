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
var dark=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",{maxZoom:18,maxNativeZoom:11,noWrap:false,attribution:"Map © Esri"}).addTo(map);
var satPane=map.createPane("sat");satPane.style.zIndex="450";satPane.style.filter="brightness(.8) contrast(1.12) saturate(.85)";
var labelPane=map.createPane("satlab");labelPane.style.zIndex="460";labelPane.style.pointerEvents="none";
var sat=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{pane:"sat",minZoom:6,maxZoom:18,maxNativeZoom:18,opacity:0,noWrap:false}).addTo(map);
var satLabels=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",{pane:"satlab",minZoom:7,maxZoom:18,maxNativeZoom:18,opacity:0,noWrap:false}).addTo(map);
function minZoomForViewport(){return Math.max(2,Math.ceil(Math.log2(Math.max(320,root.querySelector(".pg-map").clientWidth)/256)*4)/4);}
map.setMinZoom(minZoomForViewport());
map.setView([39,-98],Math.max(3.5,map.getMinZoom()));
L.control.zoom({position:"bottomright"}).addTo(map);
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
 if(!q){renderChoices(data.missions,false);query.focus();return;}
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
var travelTimers=[],travelGeneration=0;
function cancelTravel(){
 travelGeneration++;
 travelTimers.forEach(function(t){clearTimeout(t);});travelTimers=[];
 if(map&&map.stop)map.stop();
}
function travelTo(point,zoom){
 cancelTravel();
 var token=travelGeneration,origin=map.getCenter(),startZoom=map.getZoom();
 var wanted=Math.max(map.getMinZoom(),Math.min(18,zoom||10));
 var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 if(reduce){map.setView(point,wanted,{animate:false});return;}
 var distance=Math.abs(origin.lat-point[0])+Math.abs(origin.lng-point[1]);
 if(distance<.7&&Math.abs(startZoom-wanted)<1.5){
  map.flyTo(point,wanted,{animate:true,duration:1.0});return;
 }
 var mid=[origin.lat+(point[0]-origin.lat)*.45,origin.lng+(point[1]-origin.lng)*.45];
 var overview=Math.max(map.getMinZoom(),Math.min(4.25,startZoom,wanted));
 map.flyTo(mid,overview,{animate:true,duration:1.0});
 travelTimers.push(setTimeout(function(){
  if(token!==travelGeneration)return;
  map.flyTo(point,Math.max(map.getMinZoom(),Math.min(6.5,wanted)),{animate:true,duration:1.1});
 },1150));
 travelTimers.push(setTimeout(function(){
  if(token!==travelGeneration)return;
  map.flyTo(point,wanted,{animate:true,duration:1.2});
 },2450));
}
map.on("mousedown touchstart",cancelTravel);
function selectStep(index){
 if(!state.mission||index<0||index>=state.mission.steps.length)return;
 state.step=index;
 var m=state.mission,step=m.steps[index];
 drawRoute(m);renderFile(m,step);
 var wanted=Math.max(map.getMinZoom(),step.zoom||10);
 travelTo(stopLocation(step),wanted);
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
else renderChoices(data.missions,false);
window.MTCommand={map:map,selectMission:selectMission,selectStep:selectStep,travelTo:travelTo,cancelTravel:cancelTravel,search:function(q){query.value=q;findQuery();},getCurrent:function(){return state.mission?{mission:state.mission.id,step:state.step}:null;}};
})();
