/* 미국주식추적단 curated evidence paths. Verified historical records, NOT a live feed. */
(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports){module.exports=api;}
  root.MTIntelData=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
var SOURCES={
  chipsLaw:{title:"Congress.gov · H.R.4346",url:"https://www.congress.gov/bill/117th-congress/house-bill/4346"},
  intel:{title:"NIST · Intel Ohio 수혜 프로젝트",url:"https://www.nist.gov/chips/intel-corporation-ohio-new-albany"},
  tsmc:{title:"미 상무부 · TSMC Arizona 지원 발표",url:"https://www.commerce.gov/news/press-releases/2024/11/biden-harris-administration-announces-chips-incentives-award-tsmc"},
  chipsAwards:{title:"NIST · CHIPS 지원 내역",url:"https://www.nist.gov/chips/chips-program-office-awards"},
  houseTrades:{title:"미 하원 서기처 · 금융거래 원문",url:"https://disclosures-clerk.house.gov/FinancialDisclosure"},
  nvidia:{title:"NVIDIA · FY2027 2분기 공식 실적",url:"https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2027"},
  ustr:{title:"USTR · 미국 무역대표부",url:"https://ustr.gov/"},
  trade:{title:"ITA · 미국 국제무역청",url:"https://www.trade.gov/"},
  fed:{title:"연방준비제도 · 통화정책",url:"https://www.federalreserve.gov/monetarypolicy.htm"},
  nyfed:{title:"뉴욕 연준 · 공식 사이트",url:"https://www.newyorkfed.org/"},
  history:{title:"미 국무부 역사실 · 역사 자료",url:"https://history.state.gov/"},
  congress:{title:"Congress.gov · 법안 검색",url:"https://www.congress.gov/"},
  spacex:{title:"SpaceX · 공식 발사 기록",url:"https://www.spacex.com/launches"},
  spacexNASA:{title:"NASA · Crew-13 발사 발표 (2026-10-01)",url:"https://www.nasa.gov/news-release/nasas-spacex-crew-13-launches-to-international-space-station/"},
  spacexCRS:{title:"NASA · CRS-35 보급 임무 (2026-10-13)",url:"https://www.nasa.gov/mission/nasas-spacex-crs-35/"},
  spacexFAA:{title:"FAA · Cape Canaveral Starship 검토",url:"https://www.faa.gov/space/stakeholder_engagement/spacex_starship_ccsfs"},
  spacexTexas:{title:"미 연방관보 · 2026-10-14 Starbase 검토 공고",url:"https://www.govinfo.gov/content/pkg/FR-2026-10-14/html/2026-20963.htm"},
  spacexIPO:{title:"SpaceX IR · 2026-06-12 상장 SPCX",url:"https://ir.spacex.com/updates/releases-details/2026/Space-Exploration-Technologies-Corp--Announces-Closing-of-Initial-Public-Offering-Including-Full-Exercise-of-Underwriters-Option-to-Purchase-Additional-Shares-2026-RgoR-Y1Vwh/"},
  spacexSEC:{title:"SEC · SpaceX 2026 3분기 Form 10-Q",url:"https://www.sec.gov/Archives/edgar/data/1181412/000162828026066880/spcx-20260930.htm"},
  spacexStockHistory:{title:"Stock Analysis · SPCX 종가 기록",url:"https://stockanalysis.com/stocks/spcx/history/"},
  nvidiaIR:{title:"NVIDIA 공식 실적 발표 · FY2027 Q2 (2026-08-26)",url:"https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2027/"},
  nvidiaHQ:{title:"NVIDIA 공식 본사 주소 · Santa Clara",url:"https://www.nvidia.com/en-us/contact/"},
  tsmcHQ:{title:"TSMC 공식 본사 · Hsinchu Science Park",url:"https://www.tsmc.com/english/aboutTSMC/business_contacts"}
};
function node(id,place,lat,lng,zoom,title,text,connection,source,kind){
 return {id:id,place:place,lat:lat,lng:lng,zoom:zoom,title:title,text:text,connection:connection,source:SOURCES[source],kind:kind||"document"};
}
var MISSIONS=[
 {id:"spacex",title:"SPCX 주가 → 발사장 → NASA → SEC",short:"스페이스X 시장·사업 추적",keywords:["스페이스엑스","스페이스 엑스","space x","spacex","spcx","starship","스타십","starlink","스타링크","팰컨9","falcon9"],summary:"최근 실제 발사 기록·NASA 임무·FAA 규제 검토를 지도로 추적합니다.",symbols:"NASDAQ SPCX (2026-06-12 상장) · 실시간 시세 API 미연결",steps:[
 node("spacex-market","뉴욕 · 나스닥 마켓사이트",40.7573,-73.9855,14,"SPCX · 증시 기록에서 조사 시작","SpaceX는 2026년 6월 12일 SPCX로 나스닥에 상장했습니다. 같은 날짜의 주가·거래량과 공개된 실적·자금조달 사건을 비교해야 하며, 시장건물 좌표는 거래 체결 장소를 의미하지 않습니다.","공식 IPO → 종목 식별","spacexIPO"),
 node("spacex-starbase","텍사스 · 스타베이스",25.997,-97.156,11,"Starbase · Starship 개발·발사","SpaceX 공식 기록상 Starship Flight 14가 2026년 9월 28일 스타베이스에서 발사됐습니다. 시험 결과와 향후 일정은 각각 공식 자료를 확인해야 합니다.","Starship 시험 → 발사장 · 개발 진척","spacex"),
 node("spacex-nasa","플로리다 · 케이프커내버럴",28.562,-80.577,11,"Crew-13 · NASA 유인 수송","NASA는 SpaceX Crew-13이 2026년 10월 1일 Cape Canaveral에서 발사됐다고 발표했습니다. 스타십 개발과 다른 상용 유인 수송 사업입니다.","공식 임무 → 정부 고객·계약","spacexNASA"),
 node("spacex-cargo","플로리다 · Cape Canaveral",28.562,-80.577,12,"CRS-35 · 우주정거장 화물 임무","NASA는 CRS-35 화물 보급 임무의 발사일을 2026년 10월 13일로 기록합니다. 상업 화물 수송과 시험용 Starship을 혼동하지 않습니다.","유인 수송 → 화물 수송 사업","spacexCRS"),
 node("spacex-sec","워싱턴 D.C. · SEC 공시 확인",38.894,-77.028,13,"2026년 3분기 SEC 10-Q · 재무 검증","SEC 10-Q에 2026년 3분기 연결 매출 145억7,500만 달러와 Starlink 중심 Connectivity 매출 52억4,800만 달러가 기재됐습니다. 시장 예상치와 비교하지 않은 숫자만으로 주가 변동 원인을 단정하지 않습니다.","종목 → 실적 수치·사업부 기록","spacexSEC"),
 node("spacex-licensing","워싱턴 D.C. · FAA 정책",38.887,-77.025,12,"FAA · 발사 허가·환경 영향 검토","FAA의 Cape Canaveral SLC-37 관련 자료는 향후 Starship 상업 운항을 위한 기존 면허 변경 필요성을 설명합니다. 검토 진행과 최종 승인 여부는 별도 확인해야 합니다.","발사장 확대 → 연방 항공 규제","spacexFAA","context"),
 node("spacex-return","텍사스 · Starbase",25.997,-97.156,10,"2026-10-14 · 텍사스 운영 공고","2026년 10월 14일 미 연방관보에는 Starbase의 Starship 운영 확대 제안을 평가하기 위한 환경영향평가 절차가 공고됐습니다.","규제 문서 → 현장 향후 운영","spacexTexas","context")
 ]},
 {id:"nvda",title:"NVIDIA → 대만 공급망 → 미국 법안",short:"엔비디아 · 주가 요인",keywords:["엔비디아","nvidia","nvda","젠슨황","젠슨 황","gpu","blackwell","rubin","엔비디아 주가"],summary:"2026년 8월 NVIDIA 공식 실적 → 대만 반도체 공급망 → 미국 의회·연준을 따라가는 조사 경로",symbols:"NVDA · TSM · SOXX (실시간 시세 미연결)",steps:[
 node("nvda-santa","미국 · 산타클라라 (본사 소재지)",37.3727,-121.9694,12,"NVIDIA 본사 · 실적에서 출발","NVIDIA는 캘리포니아 산타클라라에 본사를 둡니다. 2026년 8월 발표된 FY2027 2분기 매출은 962억 달러입니다. 지도 지점은 본사 소재 지역을 가리키며 실시간 주가 정보가 아닙니다.","실적 발표 → 주가 기대와 비교","nvidiaIR"),
 node("nvda-tsmc","대만 · 신주 과학단지 (본사 소재 지역)",24.785,121.008,11,"TSMC · 생산 공급망 추적","TSMC 본사는 대만 신주 과학단지에 있습니다. NVIDIA의 반도체 생산 및 공급망 노출을 분석할 때 관련 생산업체의 공식 자료와 기업 공시를 함께 조사해야 합니다.","AI칩 설계 → 위탁생산 공급망 (개별 계약 검증 필요)","tsmcHQ","context"),
 node("nvda-capitol","미국 · 워싱턴 D.C. 의회",38.8899,-77.0091,13,"미국 의회 · 반도체 산업정책","CHIPS and Science Act는 2022년 제정된 산업정책의 역사적 사실입니다. 이 법률만으로 특정 날짜의 NVIDIA 주가 하락 원인이 확인되지는 않습니다.","공급망 → 산업정책·법안","chipsLaw"),
 node("nvda-fed","미국 · 워싱턴 D.C. 연준",38.8929,-77.0457,13,"연준 · 성장주 밸류에이션 조건","미국 금리와 성장주 가치평가의 관계를 검토하는 출처입니다. 당일 금리·주가 데이터 피드가 없어 실제 가격 영향은 미확인입니다.","금리 기대 → 성장주 가격","fed","context")
 ]},
 {id:"chips",title:"CHIPS법 → 발의 의원 → 기업",short:"반도체 공급망",keywords:["반도체","칩스","chips","h.r.4346","hr4346","4346","tsmc","인텔","intel","대만","타이완","법안","의원 기업","공급망"],summary:"공식 입법 기록과 기업 지원 기록을 따라가는 검증된 역사적 관계 경로",symbols:"INTC · TSM · SOXX (시세 미연결)",steps:[
 node("chips-bill","워싱턴 D.C. · 의회",38.8899,-77.0091,13,"H.R.4346 / CHIPS and Science Act","2022년 8월 9일 Public Law 117-167로 제정된 미국 반도체·과학 관련 법률입니다.","법안 원문 · 법률 제정","chipsLaw"),
 node("chips-sponsor","워싱턴 D.C. · 하원",38.8899,-77.0091,14,"팀 라이언 · 당시 하원의원","Congress.gov에 기재된 H.R.4346 원 발의자: Tim Ryan (D-OH-13). 당시의 발의 기록이며 현재 재직을 의미하지 않습니다.","법안 → 원 발의 의원","chipsLaw"),
 node("chips-intel","오하이오 · 뉴올버니",40.0806,-82.8088,12,"Intel · 미국 반도체 투자","NIST의 CHIPS 지원 사업 기록에 Intel의 오하이오 뉴올버니 프로젝트가 기재돼 있습니다. 법안과 정책상 연결이며 의원 개인거래의 증거는 아닙니다.","법률 → 공식 지원 사업 → 기업","intel"),
 node("chips-tsmc","애리조나 · 피닉스",33.4484,-112.0740,11,"TSMC Arizona · 지원 기록","미국 상무부는 2024년 11월 TSMC Arizona에 최대 66억 달러의 직접 지원금 수여를 발표했습니다.","법률 → 공식 지원 사업 → 기업","tsmc"),
 node("chips-nvda","캘리포니아 · NVIDIA 본사",37.37064,-121.96708,15,"NVIDIA · 설계기업의 산업정책 노출","NVIDIA는 미국 산타클라라에 본사를 둔 AI 반도체 설계 기업입니다. 2026년 8월 실적 발표에서 중국 데이터센터 컴퓨트 매출을 다음 분기 전망에 포함하지 않았다고 밝혔습니다. CHIPS법과의 연결은 산업정책 맥락이며, 이 회사가 해당 법의 직접 보조금을 받았다는 증거가 아닙니다.","산업정책 → 기업 사업환경 · 직접 지원 입증 아님","nvidia","context"),
 node("chips-trades","워싱턴 D.C. · 공시 출처",38.8899,-77.0091,12,"의원 주식거래 데이터 · 미연결","하원 금융공시 원문은 공개돼 있지만, 이 관제실에는 개별 거래를 수집·검증해 법안 및 인물과 매칭한 데이터가 아직 없습니다. 거래를 추정하거나 만들어 표시하지 않습니다.","공개 거래 원문 → 자동 수집 미연결","houseTrades","unconnected")
 ]},
 {id:"trade",title:"미중 관세 → 공급망",short:"관세·무역",keywords:["관세","무역","중국","미중","트럼프 관세","tariff","tariffs","trade","수출통제","수입","관세법"],summary:"미국 무역정책 출처에서 중국과 미국 기업으로 이동하는 탐색 경로",symbols:"XLI · SPY (연결 맥락만 표시)",steps:[
 node("trade-ustr","워싱턴 D.C.",38.8951,-77.0364,13,"미국 무역대표부 USTR","관세·무역조치의 공식 발표와 관련 문서는 USTR에서 확인해야 합니다. 여기에는 실시간 관세 변경 피드가 연결되어 있지 않습니다.","정책 출처","ustr","context"),
 node("trade-cn","베이징 · 중국",39.9042,116.4074,9,"중국 공급망 · 탐색 지역","중국과 미국 간 무역 이슈가 발생하는 지리적 탐색 지점입니다. 현재 사건의 발생·영향을 실시간 판정하지 않습니다.","미중 무역 연결 · 탐색","trade","context"),
 node("trade-us","워싱턴 D.C.",38.8951,-77.0364,12,"미국 산업·기업 영향 검토","공식 무역 자료를 기준으로 품목, 적용 날짜, 기업 노출 정도를 별도로 검증해야 합니다. 개별 종목 매수·매도 신호는 제공하지 않습니다.","관련 미국 산업 검토","ustr","context")
 ]},
 {id:"rates",title:"연준 → 금융시장",short:"금리·연준",keywords:["연준","금리","fomc","fed","연방준비","기준금리","채권","물가","inflation","interest rate","뉴욕 연준"],summary:"공식 연준 통화정책 기록과 시장 영향 검토 지점을 연결",symbols:"TLT · QQQ · XLF (실시간 미연결)",steps:[
 node("rates-fed","워싱턴 D.C. · Fed",38.8929,-77.0457,14,"연방준비제도 · 통화정책","FOMC 의결·정책 발표는 연방준비제도 공식 사이트에서 확인할 수 있습니다. 최신 결정 자동 업데이트는 아직 연결하지 않았습니다.","연준 공식 기록","fed","context"),
 node("rates-ny","뉴욕 · 연방준비은행",40.7082,-74.0086,14,"뉴욕 연방준비은행","금융시장 운영 및 정책 관련 자료를 뉴욕 연방준비은행의 공식 사이트에서 확인할 수 있습니다.","통화정책 → 금융시장","nyfed","context")
 ]},
 {id:"history",title:"세계사 → 미국 전략",short:"세계사·외교",keywords:["세계사","역사","냉전","대만해협","세계","미국사","외교","history","taiwan","한국","한미","일본"],summary:"과거 외교 기록을 미국과 아시아의 지정학적 위치에 연결",symbols:"역사 자료 · 시세 미연결",steps:[
 node("history-dc","워싱턴 D.C.",38.8951,-77.0364,11,"미국 외교문서 출처","미 국무부 역사실은 미국의 외교사와 원문 사료에 접근할 수 있는 출처입니다. 구체 사건 연대표 자동 추출은 미연결입니다.","공식 역사 출처","history","context"),
 node("history-tw","타이베이 · 대만",25.0330,121.5654,10,"대만해협 · 역사 탐색","미국·대만·중국 관계의 역사적 배경을 조사할 지점입니다. 특정 사건이나 시장 반응을 확인 없이 단정하지 않습니다.","역사 배경 · 지정학 연결","history","context"),
 node("history-kr","서울 · 대한민국",37.5665,126.9780,11,"한미 관계 · 역사 탐색","미국의 동아시아 전략과 한미 외교사의 연결을 지도 위에서 탐색합니다. 연대기 정밀 데이터는 미연결입니다.","역사 맥락 · 미국 전략","history","context")
 ]},
 {id:"disclosures",title:"의원 공개 거래 신고",short:"공시 원문",keywords:["주식거래","주식","거래","매수","매도","펠로시","pelosi","nancy","투자","공시","disclosure","stock","ptr","의원 매매"],summary:"미 하원 공식 금융공시 접근 — 아직 개별 거래 데이터베이스는 미연결",symbols:"실거래 데이터 미연결",steps:[
 node("trades-house","워싱턴 D.C. · 의회",38.8899,-77.0091,13,"미 하원 금융공시 원문","하원 서기처가 공개하는 금융공시 및 Periodic Transaction Report 열람 페이지입니다. 이 앱은 개인별 거래내역을 가져오거나 매매금액을 추정하지 않습니다.","원문 공개 · 자동 연결 미완료","houseTrades","unconnected"),
 node("trades-graph","워싱턴 D.C. · 법안",38.8899,-77.0091,14,"공시 ↔ 법안 자동 매칭 · 미연결","의원 식별자, 거래일, 신고일, 금액 구간, 법안 타임라인의 자동 매칭 엔진은 구축되지 않았습니다. 해당 관계가 있는 것처럼 꾸며 표시하지 않습니다.","거래 ↔ 법안 · 미구현","congress","unconnected")
 ]}
];
var BY_ID={};MISSIONS.forEach(function(m){BY_ID[m.id]=m;});
function normalize(value){return String(value==null?"":value).trim().toLocaleLowerCase().replace(/\s+/g," ");}
function search(query){
 var q=normalize(query);
 if(!q){return MISSIONS.slice();}
 var words=q.split(/[\s,?!·/→]+/).filter(function(w){return w.length>=2;});
 var hits=MISSIONS.map(function(m){
  var score=0;
  m.keywords.forEach(function(k){var term=normalize(k);if(q.indexOf(term)!==-1)score+=term.length>=4?5:3;else if(words.some(function(w){return w.length>=3&&term.indexOf(w)!==-1;}))score+=1;});
  if(normalize(m.title).indexOf(q)!==-1)score+=8;
  return {mission:m,score:score};
 }).filter(function(x){return x.score>0;}).sort(function(a,b){return b.score-a.score;});
 return hits.map(function(x){return x.mission;}).slice(0,5);
}
function getMission(id){return BY_ID[id]||null;}
return {sources:SOURCES,missions:MISSIONS,search:search,normalize:normalize,getMission:getMission};
});
