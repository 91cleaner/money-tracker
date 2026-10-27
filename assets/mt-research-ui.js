/* Evidence-backed query briefing UI. No fake real-time price, no model inference claimed. */
(function(){
"use strict";
var engine=window.MTQueryEngine,api=window.MTCommand;
if(!engine||!api)return;
var host=document.getElementById("pg"),map=api.map;
if(!host)return;
var panel=document.createElement("section");
panel.id="mtResearch";panel.hidden=true;panel.setAttribute("aria-label","질문 분석 브리핑");
host.appendChild(panel);
var css=document.createElement("style");
css.textContent=[
"#mtResearch[hidden]{display:none!important}",
"#mtResearch{position:absolute;z-index:805;top:115px;left:12px;width:min(465px,calc(100% - 24px));max-height:calc(100dvh - 240px);overflow:auto;overscroll-behavior:contain;border:1px solid #33785b;border-radius:13px;background:linear-gradient(145deg,#071d15f7,#020e0bf7);box-shadow:0 14px 45px #000b;padding:13px;color:#e4f9e8;font:13px/1.55 system-ui,sans-serif;scrollbar-width:thin}",
"#mtResearch .mt-r-head{display:flex;align-items:center;justify-content:space-between;gap:10px}",
"#mtResearch .mt-r-kicker{font:10px/1.5 ui-monospace,monospace;letter-spacing:.13em;color:#6ce9a3}",
"#mtResearch .mt-r-x{border:1px solid #447458;border-radius:6px;background:#103321;color:#eafff1;padding:3px 9px;cursor:pointer}",
"#mtResearch h2{font-size:19px;line-height:1.35;margin:8px 0;color:#f2fff4}",
"#mtResearch h3{font-size:13px;margin:14px 0 6px;color:#9dffbd}",
"#mtResearch p{margin:6px 0;line-height:1.65}",
"#mtResearch .mt-r-lead{color:#d1ead8}",
"#mtResearch .mt-r-muted{font-size:11px;color:#a6c2b1}",
"#mtResearch .mt-r-fact{border-left:2px solid #70f3a4;padding:5px 9px;margin:6px 0;background:#10302277}",
"#mtResearch .mt-r-fact b{display:block;color:#a4e4b9;font-size:11px}",
"#mtResearch .mt-r-fact a,#mtResearch .mt-r-risk a{color:#9beec2;font-size:11px}",
"#mtResearch .mt-r-risk{border-top:1px solid #23503b;padding:9px 0}",
"#mtResearch .mt-r-risk b{color:#e9ffed}",
"#mtResearch .mt-r-risk em{font-style:normal;color:#9de1b3}",
"#mtResearch .mt-r-insight{border-left:3px solid #b7ffa1;padding:9px 10px;background:#173a25;color:#eaffec}",
"#mtResearch .mt-r-choices{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}",
"#mtResearch button.mt-r-btn{padding:8px 10px;border:1px solid #458c60;border-radius:7px;background:#113b28;color:#e5fff0;font:12px system-ui;cursor:pointer}",
"#mtResearch button.mt-r-btn:hover,#mtResearch button.mt-r-btn:focus-visible{background:#236644}",
"#mtResearch .mt-r-choice[aria-pressed=true]{background:#33704c!important;border-color:#c5ffae!important}",
"#mtResearch .mt-r-verdict{border:1px solid #397450;padding:9px;border-radius:7px;margin-top:7px;background:#0a2518;color:#d7f9e2}",
"#mtResearch .mt-r-warning{font-size:10px;color:#a7bdb0;border-top:1px solid #315140;padding-top:10px;margin-top:12px}",
"#mtResearch .mt-r-ticker{font:11px ui-monospace,monospace;color:#91f6c2}",
"#mtResearch .mt-open-section{border-top:1px solid #305943;margin-top:12px;padding-top:8px}",
"#mtResearch .mt-open-result{padding:9px 0;border-top:1px solid #285540}",
"#mtResearch .mt-open-link{font-weight:800;color:#a5ffcc;text-decoration:underline}",
"#mtResearch .mt-open-result p{font-size:11px}",
"#mtResearch button.mt-r-btn:disabled{opacity:.5;cursor:wait}",
"#mtResearch .mt-r-photo{margin:9px 0;padding:6px;border:1px solid #315b45;border-radius:8px;background:#0a1d14}",
"#mtResearch .mt-r-photo img{display:block;width:100%;height:auto;max-height:175px;object-fit:contain;background:#07100b;border-radius:5px}",
"#mtResearch .mt-r-photo a{font-size:10px;color:#9ce8bb;text-decoration:underline}",
"@media(max-width:950px){#mtResearch{top:105px;left:8px;right:8px;width:auto;max-height:calc(100dvh - 300px);padding:11px}#mtResearch h2{font-size:17px}}",
"@media(max-height:610px){#mtResearch{max-height:calc(100dvh - 175px)}}"
].join("\n");
document.head.appendChild(css);
function el(tag,cls,value){var x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=value;return x;}
function add(parent,tag,cls,value){var x=el(tag,cls,value);parent.appendChild(x);return x;}
function button(parent,label,cb,cls){var x=el("button",cls||"mt-r-btn",label);x.type="button";x.addEventListener("click",cb);parent.appendChild(x);return x;}
function link(parent,source){if(!source||!/^https:\/\/[a-z0-9.-]+\//i.test(source.url))return;var a=el("a","",source.title+" ↗");a.href=source.url;a.target="_blank";a.rel="noopener noreferrer";parent.appendChild(a);}
function close(){panel.hidden=true;}
function sourceBlock(parent,datum){
 var b=add(parent,"div","mt-r-fact");add(b,"b","",datum.label);add(b,"p","",datum.value);
 if(datum.asOf)add(b,"p","mt-r-muted","기준: "+datum.asOf);
 link(b,datum.source);
}
function openLookup(question){
 if(!window.MTOpenResearch)return;
 var part=add(panel,"section","mt-open-section");
 add(part,"h3","","공개 백과 자료 직접 조회 · 시범 기능");
 add(part,"p","mt-r-muted","질문과 관련된 공개 백과 문서를 직접 찾습니다. 클릭하면 검색어가 외부 Wikimedia 서버로 전송됩니다. 비공개 투자 전략이 포함된 질문에는 사용하지 마세요. 최신 시세·뉴스·인과관계까지 검증하는 기능은 아닙니다.");
 var resultHost=add(part,"div","mt-open-results");
 var btn=button(part,"↗ 공개 백과에서 관련 문서 찾기",async function(){
  btn.disabled=true;
  resultHost.replaceChildren(el("p","mt-r-muted","공개 문서를 조회하는 중…"));
  var found=await window.MTOpenResearch.research(question);
  if(!part.isConnected)return;
  resultHost.replaceChildren();
  if(found.status==="ok"){
   add(resultHost,"p","mt-r-muted",found.results.length+"개 문서 검색됨 · 검색어: "+found.searched+" · 관련성·날짜는 직접 확인 필요");
   found.results.forEach(function(item){
    var block=add(resultHost,"div","mt-open-result");
    var a=add(block,"a","mt-open-link",item.title+" ↗");
    a.href=item.url;a.target="_blank";a.rel="noopener noreferrer";
    if(item.summary)add(block,"p","mt-r-muted",item.summary);
    add(block,"small","mt-r-muted",item.source+" · "+item.lang+" · 백과 문서, 당일 시장 뉴스 아님");
   });
  }else add(resultHost,"p","mt-r-muted",found.status==="empty"?"일치하는 백과 문서를 발견하지 못했습니다. 기업 공시나 공식 발표를 추가로 확인해야 합니다.":"외부 자료 조회에 실패했습니다. 네트워크 또는 Wikimedia 접근을 확인하세요.");
  btn.disabled=false;
 },"mt-r-btn");
}
function render(query){
 var result=engine.analyze(query);panel.hidden=false;while(panel.firstChild)panel.removeChild(panel.firstChild);
 var head=add(panel,"div","mt-r-head");add(head,"span","mt-r-kicker","MONEY TRACKER / INTELLIGENCE BRIEF");
 button(head,"✕ 닫기",close,"mt-r-x");
 add(panel,"h2","",result.title);
 add(panel,"div","mt-r-ticker",result.ticker+" · "+result.topicGroup);
 add(panel,"p","mt-r-lead",result.opening);
 if(!result.photo&&result.location&&window.MTPhoto){var photoSlot=add(panel,"div","mt-r-livephoto");window.MTPhoto.render(photoSlot,result.id,result.location.name);}
 if(result.photo&&/^https:\/\/thumb\.wikimedia\.org\//.test(result.photo.url)){
  var photo=add(panel,"figure","mt-r-photo");
  var picture=add(photo,"img","");picture.src=result.photo.url;picture.alt="검증된 실제 장소 사진 · "+result.location.name;picture.loading="lazy";
  picture.onerror=function(){photo.remove();if(window.MTPhoto){var recover=add(panel,"div","mt-r-livephoto");window.MTPhoto.render(recover,result.id,result.location.name);}};
  var credit=add(photo,"figcaption","");var creditLink=add(credit,"a","",result.photo.credit+" · 사진 원본 / 라이선스");
  creditLink.href=result.photo.source;creditLink.target="_blank";creditLink.rel="noopener noreferrer";
 }
 if(result.isFallback){
  add(panel,"h3","","확인 가능한 탐색 경로");
  add(panel,"p","mt-r-muted","질문과 일치하는 사실은 찾지 못했지만, 다음 관계망으로 조사를 시작할 수 있습니다. 현재 사건의 사실 여부는 확인되지 않았습니다.");
  add(panel,"p","mt-r-muted","특정 기업이나 국가를 임의로 추적 대상으로 정하지 않았습니다.");
 }else{
  add(panel,"h3","","01 · 확인된 자료");
  result.facts.forEach(function(d){sourceBlock(panel,d);});
  add(panel,"h3","","02 · 원인 가설과 검증 방법");
  result.assumptions.forEach(function(h,i){
   var b=add(panel,"div","mt-r-risk");add(b,"b","",(i+1)+". "+h.title);add(b,"p","",h.reason);
   add(b,"p","","검증할 것: "+h.verify);link(b,h.source);
  });
  add(panel,"h3","","03 · 앞으로 관찰할 신호");
  result.signals.forEach(function(s){
   var b=add(panel,"div","mt-r-risk");add(b,"b","",s.title);add(b,"p","",s.watch);
   add(b,"p","mt-r-muted","긍정 신호: "+s.up+" / 위험 신호: "+s.down);
  });
  add(panel,"h3","","04 · 핵심 해석");
  add(panel,"p","mt-r-insight",result.insight);
 }
 openLookup(result.query);
 add(panel,"h3","","05 · 관제실 지도 추적");
 add(panel,"p","mt-r-muted","경로를 선택하면 법안·정책·기업·역사 원문으로 이동합니다. 지도는 단계별로 이동하며 중간에 직접 조작할 수 있습니다.");
 var routes=add(panel,"div","mt-r-choices");
 result.missions.forEach(function(id){
  var mission=window.MTIntelData&&window.MTIntelData.getMission(id);
  if(!mission)return;
  button(routes,mission.short+" ↗",function(){api.selectMission(id);close();});
 });
 if(!result.isFallback){
  add(panel,"h3","","06 · 최종 판단은 내가");
  add(panel,"p","mt-r-muted","아래는 투자 추천이 아니라 어떤 가설을 더 검증할지 선택하는 개인 조사 메모입니다.");
  var picks=add(panel,"div","mt-r-choices"),verdict=add(panel,"div","mt-r-verdict","가설을 선택하면 확인할 자료가 제시됩니다.");
  var msg={
   "강세 가설":"강세 가설 선택: 실적·수요가 시장 기대를 넘어서는지와 규제 위험이 줄어드는지 확인하세요. 반대 근거도 반드시 비교하세요.",
   "중립·관찰":"중립·관찰 선택: 다음 공식 발표, 관련 업종의 동행 여부, 규제 시행일을 추적하세요.",
   "약세 가설":"약세 가설 선택: 기대치 하회, 마진 악화, 수출제한 확대, 금리 상승의 증거를 확인하세요. 추정만으로 확정하지 마세요."
  };
  result.userChoice.forEach(function(choice){
   button(picks,choice,function(){
    picks.querySelectorAll("button").forEach(function(b){b.setAttribute("aria-pressed",String(b.textContent===choice));});
    verdict.textContent=msg[choice];
   },"mt-r-btn mt-r-choice");
  });
 }
 add(panel,"p","mt-r-warning",result.caveat);
 panel.scrollTop=0;
 if(result.location){
  var center=result.location;
  var zoom=Math.min(10,Math.max(5,center.zoom||8));
  if(typeof api.travelTo==="function")api.travelTo([center.lat,center.lng],zoom,result.topic+" / 브리핑 조회");
  else map.flyTo([center.lat,center.lng],zoom,{duration:1.5});
 }
 return result;
}
window.MTResearch={show:render,close:close};
})();
