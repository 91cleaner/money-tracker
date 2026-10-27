/* Evidence briefing UI: responds to every search with facts, hypotheses, verification steps, user-controlled routes.
 * Not AI inference; no real-time prices. User makes the final decision.
 */
(function(){
"use strict";
var form=document.getElementById("usCmd");
var input=document.getElementById("usQuery");
var root=document.getElementById("pg");
var engine=window.MTQueryEngine;
if(!form||!input||!root||!engine)return;
var brief=document.createElement("aside");brief.id="mtBrief";brief.hidden=true;brief.setAttribute("aria-label","데이터 관제 브리핑");root.append(brief);
var latest=null,userStance=null;
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=String(text);return e;}
function btn(text,fn,cls){var b=el("button",cls,text);b.type="button";b.addEventListener("click",fn);return b;}
function link(src,caption){
 var a=el("a","mt-evidence-link",caption||"근거 원문 ↗");
 a.href=src.url;a.target="_blank";a.rel="noopener noreferrer";return a;
}
function section(label){var s=el("section","mt-brief-section");s.append(el("h4","mt-section-label",label));brief.append(s);return s;}
function closeBrief(){brief.hidden=true;brief.textContent="";}
function closeObscuring(){
 var choices=document.getElementById("mtChoices");if(choices)choices.hidden=true;
 var file=document.getElementById("usFile");if(file)file.hidden=true;
}
function explain(s){
 var p=el("p","mt-human-text",s);return p;
}
function renderFact(s,facts){
 facts.forEach(function(f){
  var card=el("div","mt-fact");
  card.append(el("div","mt-fact-key",f.label),el("strong","mt-fact-value",f.value));
  if(f.asOf)card.append(el("small","mt-fact-date","기준: "+f.asOf));
  card.append(link(f.source,"근거: "+f.source.title+" ↗"));s.append(card);
 });
}
function renderHypothesis(s,hypotheses){
 hypotheses.forEach(function(h,i){
  var d=el("details","mt-hyp");
  if(i===0)d.open=true;
  var title=el("summary","","가설 "+(i+1)+" · "+h.title);
  d.append(title,explain(h.reason),el("div","mt-verify","확인 방법: "+h.verify),link(h.source,"공식 자료 ↗"));s.append(d);
 });
}
function showStances(s,report){
 var options=el("div","mt-stance-row");
 var note=el("p","mt-stance-note","가설 선택은 분석 관점만 표시합니다. 실제 매수·매도 주문이 아닙니다.");
 var current=el("div","mt-stance-output","");
 var values=[
  ["강세 가설","강세 가설을 선택했습니다. 긍정적인 징후뿐 아니라 반대 증거도 확인하세요."],
  ["중립·관찰","중립 관찰을 선택했습니다. 사건 날짜와 다음 공식 발표를 추적하세요."],
  ["약세 가설","약세 가설을 선택했습니다. 위험이 주가에 이미 반영되었을 가능성도 확인하세요."]
 ];
 values.forEach(function(pair){
  var b=btn(pair[0],function(){
   userStance=pair[0];
   Array.from(options.children).forEach(function(child){child.setAttribute("aria-pressed",String(child===b));});
   current.textContent=pair[1];
  },"mt-stance");
  b.setAttribute("aria-pressed",String(userStance===pair[0]));
  options.append(b);
 });
 s.append(options,note,current);
}
function selectRoute(id){
 closeBrief();
 if(window.MTCommand)window.MTCommand.selectMission(id);
}
function showBrief(report){
 latest=report;userStance=null;
 closeObscuring();brief.textContent="";brief.hidden=false;
 var heading=el("div","mt-brief-heading");
 var left=el("div");
 left.append(el("div","mt-kicker","INTEL BRIEF / SOURCE-BASED"),el("h2","mt-brief-title",report.title));
 heading.append(left,btn("✕",closeBrief,"mt-close"));brief.append(heading);
 var quoted=el("div","mt-question");
 quoted.append(el("small","","OPERATOR QUERY"),el("p","",report.query));
 brief.append(quoted);
 brief.append(el("div","mt-brief-tag",report.isFallback?"관련 데이터 탐색 · 직접 일치 자료 없음":"검증된 기록 기반 · "+report.topicGroup));
 brief.append(explain(report.opening));
 var photoSlot=el("div","mt-brief-photo");brief.append(photoSlot);
 if(window.MTPhoto)window.MTPhoto.render(photoSlot,report.id,report.location.name);
 if(report.facts.length){
  var facts=section(report.isFallback?"보유 중인 실제 자료 · 참고용":"01 / 확인된 자료");
  renderFact(facts,report.facts);
 }
 var hyps=section("02 / 가능한 설명 — 확인된 원인 아님");
 renderHypothesis(hyps,report.assumptions);
 var signals=section("03 / 앞으로 확인할 변수");
 report.signals.forEach(function(sig){
  var card=el("div","mt-signal");
  card.append(el("strong","",sig.title),el("p","",sig.watch));
  card.append(el("p","mt-up","강세 시나리오: "+sig.up),el("p","mt-down","약세 시나리오: "+sig.down));signals.append(card);
 });
 var insight=section("04 / 관제실 인사이트");
 insight.append(explain(report.insight));
 var routes=section("05 / 다음 추적 대상 선택");
 routes.append(el("p","mt-guide","아래를 선택하면 지도에서 실제 위치·법안·기업으로 이동합니다."));
 report.missions.forEach(function(id){
  var m=window.MTIntelData&&window.MTIntelData.getMission(id);
  if(!m)return;
  routes.append(btn("⌖ "+m.title+" →",function(){selectRoute(id);},"mt-route"));
 });
 var decide=section("06 / 최종 판단은 지휘관에게");
 showStances(decide,report);
 brief.append(el("p","mt-disclaimer",report.caveat));
 // Investigate target location immediately, but the briefing can be read while camera flies.
 if(window.MTCommand&&typeof window.MTCommand.travelTo==="function"&&report.location){
  window.MTCommand.travelTo([report.location.lat,report.location.lng],report.location.zoom,"QUERY / "+report.topic);
 }
}
form.addEventListener("submit",function(event){
 event.preventDefault();
 event.stopImmediatePropagation();
 var q=input.value.trim();
 if(!q){if(window.MTCommand)window.MTCommand.search("");return;}
 showBrief(engine.analyze(q));
},true);
window.MTBrief={ask:function(q){input.value=q;showBrief(engine.analyze(q));},close:closeBrief,getLatest:function(){return latest?{query:latest.query,topic:latest.id,isFallback:latest.isFallback}:null;}};
})();