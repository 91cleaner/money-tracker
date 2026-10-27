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
"#mtResearch .mt-local-index{border:1px solid #3a855e;border-radius:10px;padding:10px;margin:11px 0;background:#061a12}",
"#mtResearch .mt-local-index h3{margin:1px 0 5px;font-size:14px}",
"#mtResearch .mt-local-head{font-size:11px;color:#b4e7c5}",
"#mtResearch .mt-local-doc{padding:9px 0;border-top:1px solid #244630}",
"#mtResearch .mt-local-title{font-size:12px;font-weight:800;color:#d5ffe5;line-height:1.55}",
"#mtResearch .mt-local-desc{font-size:11px;line-height:1.55;color:#bcd9c7}",
"#mtResearch .mt-local-meta{font-size:10px;color:#83bca0;margin:5px 0}",
"#mtResearch .mt-local-actions{display:flex;gap:6px;flex-wrap:wrap;margin:5px 0}",
"#mtResearch .mt-local-actions a,#mtResearch .mt-local-actions button{padding:5px 8px;background:#0f3422;color:#c9fcd9;border:1px solid #377655;border-radius:5px;font-size:11px;cursor:pointer;text-decoration:none}",
"#mtResearch .mt-local-more{background:#174d30;border:1px solid #478f5d;border-radius:7px;color:#dfffeb;padding:7px 10px;cursor:pointer}",

"#mtResearch .mt-auto-research{border:1px solid #478365;background:rgba(8,31,20,.8);border-radius:10px;padding:10px;margin:12px 0}",
"#mtResearch .mt-auto-research h3{margin:0 0 5px;font-size:13px}",
"#mtResearch .mt-auto-research h4{margin:9px 0 4px;color:#9fffca;font-size:12px}",
"#mtResearch .mt-auto-group{border-top:1px solid #295c3d;padding:4px 0}",
"#mtResearch .mt-auto-hit{border-top:1px solid #193b2b;padding:8px 0}",
"#mtResearch .mt-spacex-fastbrief{border:1px solid #559665;border-radius:9px;background:rgba(24,59,35,.75);padding:9px 11px;margin:10px 0}",
"#mtResearch .mt-spacex-fastbrief h3{margin:0 0 6px;color:#c7ffe2}",
"#mtResearch .mt-spacex-fastbrief p{font-size:12px;line-height:1.65}",
"#mtResearch .mt-secure-ai{border:1px solid #47785a;border-radius:9px;padding:9px;margin-top:11px;background:#081a15}",
"#mtResearch .mt-secure-ai h4{font-size:12px;color:#b7ffd1;margin:10px 0 3px}",
"#mtResearch .mt-secure-ai p{font-size:12px}",
"#mtResearch .mt-case-file{border:1px solid #377555;border-radius:8px;padding:9px;margin-top:10px}",
"#mtResearch .mt-case-file summary{cursor:pointer;color:#bdffc9;font-weight:800;line-height:1.6}",
"#mtResearch .mt-case-item{border-top:1px solid #284d37;padding:9px 0}",
"#mtResearch .mt-case-item strong{color:#a6ffd0;font-size:11px}",
"#mtResearch .mt-case-item p{font-size:11px;line-height:1.5}",
"#mtResearch .mt-auto-link{color:#d3ffdf;text-decoration:underline;font-size:12px;line-height:1.55;font-weight:600;overflow-wrap:anywhere}",
"#mtResearch .mt-auto-hit small{display:block;margin:3px 0}",
"#mtResearch .mt-auto-research .mt-r-head{align-items:baseline;flex-wrap:wrap}",

"#mtResearch .mt-open-section{border-top:1px solid #305943;margin-top:12px;padding-top:8px}",
"#mtResearch .mt-open-result{padding:9px 0;border-top:1px solid #285540}",
"#mtResearch .mt-open-link{font-weight:800;color:#a5ffcc;text-decoration:underline}",
"#mtResearch .mt-open-result p{font-size:11px}",
"#mtResearch button.mt-r-btn:disabled{opacity:.5;cursor:wait}",
"#mtResearch .mt-r-photo{margin:9px 0;padding:6px;border:1px solid #315b45;border-radius:8px;background:#0a1d14}",
"#mtResearch .mt-r-photo img{display:block;width:100%;height:auto;max-height:175px;object-fit:contain;background:#07100b;border-radius:5px}",
"#mtResearch .mt-r-photo a{font-size:10px;color:#9ce8bb;text-decoration:underline}",
"@media(max-width:950px){#mtResearch{top:105px;left:8px;right:8px;width:auto;max-height:calc(100dvh - 300px);padding:11px}#mtResearch h2{font-size:17px}}",
"@media(max-height:610px){#mtResearch{max-height:calc(100dvh - 175px)}}",
/* Search results default to a short, dismissible map caption. Full evidence remains one tap away. */
"#mtResearch:not(.mt-expanded){top:auto!important;bottom:calc(72px + env(safe-area-inset-bottom,0px))!important;left:10px!important;right:auto!important;width:min(370px,calc(100% - 20px))!important;max-height:164px!important;overflow:hidden!important;padding:10px 12px!important}",
"#mtResearch:not(.mt-expanded)>:not(.mt-r-head):not(h2):not(.mt-r-ticker):not(.mt-quick-summary):not(.mt-quick-actions){display:none!important}",
"#mtResearch:not(.mt-expanded) h2{font-size:14px!important;line-height:1.25!important;margin:4px 0!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
"#mtResearch:not(.mt-expanded) .mt-r-head{margin:0!important}",
"#mtResearch .mt-quick-summary{font:12px/1.45 system-ui,sans-serif;color:#b8efc9;margin:4px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
"#mtResearch .mt-quick-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px}",
"#mtResearch .mt-quick-actions button,#mtResearch .mt-quick-actions a{border:1px solid #418a5e;border-radius:6px;background:#103c27;color:#e1ffed;padding:6px 8px;font:12px system-ui;text-decoration:none;cursor:pointer}",
"#mtResearch.mt-expanded{top:64px!important;bottom:calc(72px + env(safe-area-inset-bottom,0px))!important;left:10px!important;right:auto!important;width:min(465px,calc(100% - 20px))!important;max-height:calc(100dvh - 145px)!important;overflow:auto!important}",
"body.mt-keyboard-open #mtResearch{display:none!important}",
"@media(orientation:landscape){#mtResearch:not(.mt-expanded){bottom:52px!important;width:min(350px,43vw)!important;max-height:125px!important}#mtResearch:not(.mt-expanded) .mt-r-ticker{display:none!important}#mtResearch.mt-expanded{top:48px!important;bottom:52px!important;max-height:calc(100dvh - 100px)!important}}"

].join("\n");
document.head.appendChild(css);
function el(tag,cls,value){var x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=value;return x;}
function add(parent,tag,cls,value){var x=el(tag,cls,value);parent.appendChild(x);return x;}
function button(parent,label,cb,cls){var x=el("button",cls||"mt-r-btn",label);x.type="button";x.addEventListener("click",cb);parent.appendChild(x);return x;}
function link(parent,source){if(!source||!/^https:\/\/[a-z0-9.-]+\//i.test(source.url))return;var a=el("a","",source.title+" ↗");a.href=source.url;a.target="_blank";a.rel="noopener noreferrer";parent.appendChild(a);}
var researchSerial=0;
function close(){researchSerial++;panel.hidden=true;}
function sourceBlock(parent,datum){
 var b=add(parent,"div","mt-r-fact");add(b,"b","",datum.label);add(b,"p","",datum.value);
 if(datum.asOf)add(b,"p","mt-r-muted","기준: "+datum.asOf);
 link(b,datum.source);
}
function renderIndexedSearch(question,onResults){
 var local=window.MTLocalSearch;
 var section=add(panel,"section","mt-local-index");
 add(section,"h3","","LOCAL INTELLIGENCE / 저장 자료 검색");
 var head=add(section,"p","mt-local-head","저장된 공식 자료·인물·법안 기록을 조회하고 있습니다.");
 var hits=add(section,"div","mt-local-hits");
 if(!local){head.textContent="로컬 색인 모듈 미연결";return;}
 var ticket=researchSerial;
 function display(index,results){
  if(ticket!==researchSerial||!section.isConnected)return;
  var total=index.documents.length;
  head.textContent="공개 자료 색인 "+total+"건 · AI 호출 0회 · 마지막 색인 생성 "+(index.built_at||"미확인")+" · 원문 기준일은 항목별 확인";
   if(typeof onResults==="function")onResults(index,results);
  hits.replaceChildren();
  if(!results.length){
   add(hits,"p","mt-r-muted","해당 표현과 일치하는 저장 기록이 없습니다. 출처 목록이나 유사한 법안·기업 이름으로 다시 검색하세요. 없는 자료를 만들어 답하지 않습니다.");
   return;
  }
  function renderItem(item){
   var card=add(hits,"div","mt-local-doc");
   add(card,"div","mt-local-title",item.title);
   add(card,"p","mt-local-desc",item.summary||"원문에서 추가 확인 필요");
   add(card,"div","mt-local-meta",(item.type||"공식 자료")+" · "+(item.source||"출처 확인")+" · "+(item.source_date||"자료 기준일 별도 확인"));
   var actions=add(card,"div","mt-local-actions");
   var url=add(actions,"a","","원문 ↗");url.href=item.url;url.target="_blank";url.rel="noopener noreferrer";
   if(item.location||item.route){
    button(actions,"⌖ 지도에서 추적",function(){
     if(item.route&&window.MTIntelData&&window.MTIntelData.getMission(item.route))api.selectMission(item.route);
     else if(item.location&&typeof api.travelTo==="function")api.travelTo([item.location.lat,item.location.lng],11,item.location.label||item.title);
     close();
    },"mt-r-btn");
   }
  }
  results.slice(0,6).forEach(renderItem);
  if(results.length>6){
   button(hits,"추가 "+Math.min(results.length-6,12)+"개 보기",function(e){
    const more=results.slice(6,18);more.forEach(renderItem);e.target.remove();
   },"mt-local-more");
  }
 }
 local.load().then(function(index){
  const results=local.search(index,question,{limit:18});
  display(index,results);
 }).catch(function(err){if(ticket!==researchSerial||!section.isConnected)return;head.textContent="로컬 검색 오류 · "+String(err.message||err);});
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
/* Auto research uses public GDELT headline lookup + Wikipedia article discovery.
 * Headlines are not proof of causation. No private operator text is sent if it resembles a secret.
 * Both sources are independently fault-tolerant; a failed request does not leave an empty screen.
 */
function runPublicResearch(question,report){
 var ticket=++researchSerial;
 var host=add(panel,"section","mt-auto-research");
 var head=add(host,"div","mt-r-head");
 add(head,"h3","","01 / 관련 공개 자료 직접 조사");
 add(head,"span","mt-r-kicker","GDELT · WIKIMEDIA");
 add(host,"p","mt-r-muted","입력 질문에서 인식한 주제어만 외부 공개 검색에 전송합니다. 검색어와 기사 제목은 원문 근거를 직접 확인하기 위한 단서이며 AI가 당일 주가 원인을 검증했다는 뜻이 아닙니다.");
 var feeds=add(host,"div","mt-auto-feeds");
 var news=add(feeds,"div","mt-auto-group");
 var wiki=add(feeds,"div","mt-auto-group");
 add(news,"p","mt-r-muted","최근 뉴스 검색 대기 중…");
 add(wiki,"p","mt-r-muted","공개 백과 문서 조회 대기 중…");
 var searcher=window.MTNewsDiscovery,encyclopedia=window.MTOpenResearch;
 var info=searcher?searcher.subject(question):{valid:false,reason:"unavailable"};
 if(!info.valid){
  news.replaceChildren();
  wiki.replaceChildren();
  add(news,"p","mt-r-muted",info.reason==="sensitive"?"개인정보·비밀정보가 포함된 질문은 외부 검색에 보내지 않았습니다.":"외부 검색에 사용할 대상·기업·사건을 특정하지 못했습니다. 주제의 고유명사를 입력하면 더 정확히 조사할 수 있습니다.");
  add(wiki,"p","mt-r-muted","명확한 검색 대상이 없어 관련 없는 자료를 억지로 보여주지 않습니다.");
  return;
 }
 add(head,"span","mt-r-kicker","검색 대상: "+info.term);
 function current(){return ticket===researchSerial&&!panel.hidden&&host.isConnected;}
 if(!searcher){news.replaceChildren();add(news,"p","mt-r-muted","뉴스 연결 코드 미로딩");}
 else searcher.retrieve(question).then(function(data){
  if(!current())return;
  news.replaceChildren();
  add(news,"h4","","최근 공개 보도 · "+info.term);
  if(data.status!=="ok"){
   add(news,"p","mt-r-muted",data.status==="empty"?"최근 2주 검색에서 해당 기사 결과가 없습니다. 이것이 실제 사건이 없다는 뜻은 아닙니다.":"뉴스 서버에 접근하지 못했습니다. 네트워크·API 상태를 확인해야 합니다. 이미 확인된 공식 기록은 아래에 따로 표시합니다.");
   return;
  }
  add(news,"p","mt-r-muted",data.items.length+"개 관련 기사 · GDELT 발견 일자 기준 · 기사 내용의 사실 여부는 원문에서 재확인");
  data.items.slice(0,6).forEach(function(item){
   var row=add(news,"div","mt-auto-hit");
   var a=add(row,"a","mt-auto-link",item.title+" ↗");a.href=item.url;a.rel="noopener noreferrer";a.target="_blank";
   add(row,"small","mt-r-muted",item.date+" (발견 시점) · "+(item.source||"언론사 미기재"));
  });
 }).catch(function(){if(!current())return;news.replaceChildren();add(news,"p","mt-r-muted","뉴스 검색 오류 · 공식 출처 아래에서 확인");});
 if(!encyclopedia){wiki.replaceChildren();add(wiki,"p","mt-r-muted","백과 검색 코드 미로딩");}
 else encyclopedia.research(info.term).then(function(data){
  if(!current())return;wiki.replaceChildren();
  add(wiki,"h4","","배경지식 · 공식 기록과 별개");
  if(data.status!=="ok"){
   add(wiki,"p","mt-r-muted","백과 자료를 불러오지 못했거나 관련 문서가 없습니다.");return;
  }
  data.results.slice(0,3).forEach(function(item){
   var row=add(wiki,"div","mt-auto-hit");
   var a=add(row,"a","mt-auto-link",item.title+" ↗");a.href=item.url;a.target="_blank";a.rel="noopener noreferrer";
   if(item.summary)add(row,"p","mt-r-muted",item.summary);
   add(row,"small","mt-r-muted",item.source+" · 백과사전, 현재 뉴스 아님");
  });
 }).catch(function(){if(!current())return;wiki.replaceChildren();add(wiki,"p","mt-r-muted","백과 조회 오류");});
}
function renderSpaceXBrief(report){
 if(report.id!=="spacex")return;
 var box=add(panel,"section","mt-spacex-fastbrief");
 add(box,"h3","","CASE BRIEF · 스페이스X 최근 현황");
 add(box,"p","","① 2026년 6월 상장된 주식 SPCX의 움직임과 ② Starship·NASA·Starlink 사업의 진행 상황은 서로 다른 문제입니다.");
 add(box,"p","","③ 10월 22일 주가 하락과 3분기 실적은 확인할 수 있지만, 락업 해제·차입·개발비 중 무엇이 실제 원인이었는지는 기사·수급·공시를 대조해야 합니다.");
 add(box,"p","mt-r-muted","확인된 사실: 상장 및 3분기 실적(회사 IR·SEC), 과거 일별 주가 기록(제3자). 미확인: 당일 확정 원인·실시간 현재가.");
 var row=add(box,"div","mt-r-choices");
 button(row,"SPCX 주가·SEC →",function(){api.selectMission("spacex");close();},"mt-r-btn");
 button(row,"Starship 발사장 →",function(){api.selectMission("spacex");api.selectStep(1);close();},"mt-r-btn");
 button(row,"FAA 정책 추적 →",function(){api.selectMission("spacex");api.selectStep(5);close();},"mt-r-btn");
}
function renderCaseEvidence(topic){
 if(topic!=="spacex")return;
 var box=add(panel,"details","mt-case-file");
 add(box,"summary","","CASE FILE / SPCX 공식 기록 · 증거 원문 연결");
 var inner=add(box,"div","mt-case-rows");
 add(inner,"p","mt-r-muted","2026-10-27 기준 보관 데이터 파일 불러오는 중…");
 var ticket=researchSerial;
 fetch("data/us/cases/spcx-2026-10-27.json",{cache:"no-store"}).then(function(r){
  if(!r.ok)throw Error("data unavailable");return r.json();
 }).then(function(data){
  if(ticket!==researchSerial||!box.isConnected)return;
  inner.replaceChildren();
  if(data.id!=="case-us-spcx-20261027"||!Array.isArray(data.facts)||!Array.isArray(data.sources)){
   add(inner,"p","mt-r-muted","데이터 형식 확인 실패");return;
  }
  var sources={};data.sources.forEach(function(src){sources[src.id]=src;});
  add(inner,"p","mt-r-muted",data.as_of+" 기준 · "+data.facts.length+"개 사건·가격·공시 기록 / 실제 시세 자동 갱신 아님");
  data.facts.forEach(function(row){
   var rec=add(inner,"div","mt-case-item");
   add(rec,"strong","",row.date+" · "+row.name);
   add(rec,"p","",row.statement_ko);
   var src=sources[row.source_id];
   if(src&&/^https:\/\//.test(src.url)){
    var a=add(rec,"a","mt-auto-link",src.publisher+" / 원문 ↗");a.href=src.url;a.target="_blank";a.rel="noopener noreferrer";
   }
  });
  add(inner,"p","mt-r-muted","관계 자료의 사실 연결과 분석 가설을 혼동하지 않습니다. 기간 이후 사건은 자동 뉴스 검색에서 별도 확인하세요.");
 }).catch(function(){
  if(ticket!==researchSerial||!box.isConnected)return;
  inner.replaceChildren();add(inner,"p","mt-r-muted","보관된 증거 파일을 불러오지 못했습니다. 공식 원문 링크는 위 실적·정책 항목에서 확인할 수 있습니다.");
 });
}
function renderLiveBackend(question){
 var box=add(panel,"section","mt-secure-ai");
 add(box,"h3","","보호된 AI 조사 서버 · 연결 상태");
 var status=add(box,"p","mt-r-muted","서버 연결 상태 확인 중…");
 var results=add(box,"div","mt-secure-answer");
 var ticket=researchSerial;
 if(!window.MTBackend){status.textContent="AI 서버 연결 모듈 없음";return;}
 window.MTBackend.analyze(question).then(function(resp){
  if(ticket!==researchSerial||!box.isConnected)return;
  if(resp.status!=="ok"){
   status.textContent=resp.message||"보호된 AI 검색 서버 미연결 · 아래 공개 뉴스/원문 검색만 사용 가능";
   return;
  }
  var data=resp.result||{},brief=data.ai&&data.ai.brief;
  var isReady=data.ai&&data.ai.status==="ok"&&brief;
  status.textContent="서버 응답 "+(data.generatedAt||"기준시각 미확인")+" · 생성형 분석 "+(isReady?"연결":"미연결");
  if(data.market){
   var m=data.market;
   if(m.status==="provider-data"){
    add(results,"p","mt-r-muted",m.symbol+" · "+m.provider+" 제공: "+m.price+" USD · 기준 "+m.providerTime+" · 실제 실시간 여부/라이선스 별도 확인");
   }else add(results,"p","mt-r-muted","시세: "+(m.status==="not-configured"?"API 미설정":m.status));
  }
  if(!isReady){add(results,"p","mt-r-muted","AI가 실행되지 않았습니다. 확인된 공개 자료만 보세요.");return;}
  add(results,"h3","",brief.title);
  add(results,"p","",brief.summary);
  [["검증 가능한 사실",brief.confirmed],["가능한 해석",brief.hypotheses],["반대 증거·한계",brief.counterEvidence],["다음 확인 사항",brief.watchNext],["지휘관에게 제안하는 다음 질문",brief.questions]].forEach(function(group){
   add(results,"h4","",group[0]);group[1].forEach(function(t){add(results,"p","mt-r-muted","· "+t);});
  });
  add(results,"p","mt-r-warning",brief.warning);
  if(data.news&&Array.isArray(data.news.items)){
   var ev=add(results,"div","mt-auto-group");add(ev,"h4","","참조한 기사 제목 · 본문 사실 검증 필요");
   data.news.items.slice(0,6).forEach(function(item){
    var a=add(ev,"a","mt-auto-link",item.title+" ↗");a.href=item.url;a.rel="noopener noreferrer";a.target="_blank";ev.append(document.createElement("br"));
   });
  }
 }).catch(function(){if(ticket===researchSerial&&box.isConnected)status.textContent="AI 검색 서버 응답 오류";});
}
function render(query){
 researchSerial++;
 if(typeof api.beginQuestion==="function")api.beginQuestion();
 var result=engine.analyze(query);panel.hidden=false;panel.classList.remove("mt-expanded");while(panel.firstChild)panel.removeChild(panel.firstChild);
 if(window.MTQuickPin){try{api.map.removeLayer(window.MTQuickPin)}catch(e){}window.MTQuickPin=null;}
 var head=add(panel,"div","mt-r-head");add(head,"span","mt-r-kicker","MONEY TRACKER / INTELLIGENCE BRIEF");
 button(head,"✕ 닫기",close,"mt-r-x");
 add(panel,"h2","",result.title);
 add(panel,"div","mt-r-ticker",result.ticker+" · "+result.topicGroup);
 add(panel,"p","mt-r-lead",result.opening);
 var quick=add(panel,"p","mt-quick-summary","저장된 공식 자료에서 일치하는 기록을 확인하는 중…");
 var quickActions=add(panel,"div","mt-quick-actions");
 var expand=button(quickActions,"자료 자세히",function(){
  var opened=panel.classList.toggle("mt-expanded");
  expand.textContent=opened?"지도만 보기":"자료 자세히";
  if(opened)panel.scrollTop=0;
 });
 var firstRoute=result.missions.find(function(id){return window.MTIntelData&&window.MTIntelData.getMission(id);});
 if(firstRoute)button(quickActions,"경로 추적 →",function(){api.selectMission(firstRoute);close();});
 var sourceAnchor=add(quickActions,"a","","원문 ↗");sourceAnchor.hidden=true;sourceAnchor.target="_blank";sourceAnchor.rel="noopener noreferrer";
 renderIndexedSearch(query,function(index,results){
  if(!results.length){quick.textContent="일치하는 저장 자료 없음 · 임의 사실 생성 안 함 · 상세 자료에서 다른 검색어를 확인하세요.";return;}
  var top=results[0],when=top.source_date||"날짜 미확인";
  quick.textContent=top.title+" · "+(top.summary||"원문 확인 필요").slice(0,100)+" · "+when;
  if(/^https:\\/\\//.test(top.url)){sourceAnchor.href=top.url;sourceAnchor.hidden=false;}
  // A geolocated, high-confidence match may move the map; no invented coordinates.
  var place=top.location,lat=place&&Number(place.lat),lng=place&&Number(place.lng);
  if(top.relevance>=20&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180){
   if(window.L&&api.map){
    var pin=window.L.circleMarker([lat,lng],{radius:8,color:"#c8ff96",fillColor:"#288b50",fillOpacity:.85,weight:2}).addTo(api.map);
    pin.bindTooltip(top.title);window.MTQuickPin=pin;
   }
   if(typeof api.travelTo==="function")api.travelTo([lat,lng],Math.max(5,Math.min(10,Number(place.zoom)||8)),place.label||top.title);
  }
 });
 // Paid model/API calls intentionally disabled: index/search documents first.
 renderSpaceXBrief(result);
 if(!result.photo&&result.location&&window.MTPhoto){var photoSlot=add(panel,"div","mt-r-livephoto");window.MTPhoto.render(photoSlot,result.id,result.location.name);}
 if(result.photo&&/^https:\/\/thumb\.wikimedia\.org\//.test(result.photo.url)){
  var photo=add(panel,"figure","mt-r-photo");
  var picture=add(photo,"img","");picture.src=result.photo.url;picture.alt="검증된 실제 장소 사진 · "+result.location.name;picture.loading="lazy";
  picture.onerror=function(){photo.remove();if(window.MTPhoto){var recover=add(panel,"div","mt-r-livephoto");window.MTPhoto.render(recover,result.id,result.location.name);}};
  var credit=add(photo,"figcaption","");var creditLink=add(credit,"a","",result.photo.credit+" · 사진 원본 / 라이선스");
  creditLink.href=result.photo.source;creditLink.target="_blank";creditLink.rel="noopener noreferrer";
 }
 if(result.isFallback){
  add(panel,"h3","","관련 기록 및 추가 조사 방향");
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

 renderCaseEvidence(result.id);
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
 // Do not move the map on a query. Operator must select an evidence point.
 return result;
}
window.MTResearch={show:render,close:close};
})();
