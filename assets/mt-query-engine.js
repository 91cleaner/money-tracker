/* MONEY TRACKER evidence-first question engine (offline analyst, NOT connected to generative AI).
 * It can ALWAYS provide an evidence-based investigation path, but never invents current prices.
 */
(function(root,factory){
 var api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 root.MTQueryEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
var SRC={
 nvidiaQ2:{title:"NVIDIA 공식 발표 · FY2027 2분기 (2026-08-26)",url:"https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2027/"},
 nvidia10q:{title:"NVIDIA 공식 10-Q · 수출규제와 공급망 위험 (2026-08)",url:"https://investor.nvidia.com/files/doc_financials/2027/NVDA-2027-Q2-10Q-Final-including-exhibits.pdf"},
 nvidiaIR:{title:"NVIDIA 투자자관계 · 분기실적",url:"https://investor.nvidia.com/"},
 congress:{title:"미국 의회 · 법안 데이터",url:"https://www.congress.gov/"},
 chips:{title:"Congress.gov · CHIPS and Science Act",url:"https://www.congress.gov/bill/117th-congress/house-bill/4346"},
 commerce:{title:"미 상무부 · CHIPS 지원 사업",url:"https://www.nist.gov/chips/chips-program-office-awards"},
 fed:{title:"미국 연준 · 통화정책",url:"https://www.federalreserve.gov/monetarypolicy.htm"},
 ustr:{title:"미국 무역대표부 · 관세정책",url:"https://ustr.gov/"},
 sec:{title:"미국 SEC · EDGAR 기업 공시",url:"https://www.sec.gov/edgar/search/"},
 history:{title:"미 국무부 역사실 · 외교사",url:"https://history.state.gov/"},
 trades:{title:"미 하원 서기처 · 금융공시",url:"https://disclosures-clerk.house.gov/FinancialDisclosure"},
 tsa:{title:"미국 증권거래위원회 · 투자정보",url:"https://www.investor.gov/"}
};
function source(ref){return SRC[ref];}
function datum(label,value,ref,date){return {label:label,value:value,source:source(ref),asOf:date||null};}
function hyp(title,reason,verify,ref){return {title:title,reason:reason,verify:verify,source:source(ref)};}
function signal(title,watch,ifPositive,ifNegative){return {title:title,watch:watch,up:ifPositive,down:ifNegative};}
var TOPICS={
 nvda:{
  id:"nvda",label:"엔비디아",ticker:"NVDA",group:"반도체·AI",keywords:["엔비디아","nvidia","nvda","젠슨황","jensen huang","h100","h200","blackwell","rubin","gpu","그래픽카드"],route:["chips","trade","rates"],point:{lat:37.3719,lng:-122.0355,zoom:12,name:"미국 캘리포니아 · 산타클라라"},
  facts:[
   datum("FY2027 2분기 매출","962억 달러 · 전년 동기 대비 106% 증가","nvidiaQ2","2026-07-26 마감 분기"),
   datum("같은 분기 데이터센터 매출","890억 달러 · 전년 동기 대비 117% 증가","nvidiaQ2","2026-07-26 마감 분기"),
   datum("같은 분기 총이익률","GAAP 기준 75.0%","nvidiaQ2","2026-07-26 마감 분기")
  ],
  risks:[
   hyp("실적과 시장 기대의 차이","실적이 좋아도 투자자가 예상한 성장률보다 낮으면 주가가 떨어질 수 있습니다. 지금 실제 하락 원인이라는 뜻은 아닙니다.","발표 전 시장 컨센서스와 매출·총이익률·가이던스의 차이를 비교하세요.","nvidiaIR"),
   hyp("AI 인프라 투자 지속성","대형 고객의 데이터센터 설비투자 속도가 둔화하면 GPU 수요 전망이 영향을 받을 수 있습니다.","주요 클라우드 사업자의 설비투자 가이던스와 NVIDIA 수주·매출 전망을 비교하세요.","nvidia10q"),
   hyp("대중국 수출규제","NVIDIA는 공식 공시에서 AI 반도체의 수출규제와 공급망 차질 위험을 명시했습니다.","해당 시점의 규제 발표와 중국 매출 노출, 제품별 수출 허가를 확인하세요.","nvidia10q"),
   hyp("대만 위탁생산·공급망","생산 능력과 공급 일정이 수요에 뒤처지거나 반대로 공급이 앞서면 마진과 실적에 영향을 줄 수 있습니다.","파운드리 생산 능력, 패키징 공급, 주문 추정과 출하 일정의 변화가 있었는지 확인하세요.","nvidia10q"),
   hyp("금리와 성장주 밸류에이션","국채수익률 상승이나 위험자산 회피가 고평가 성장주의 가격에 부담이 될 수 있습니다.","같은 날 10년물 국채금리, 나스닥, SOXX가 함께 움직였는지 비교하세요.","fed")
  ],
  signals:[
   signal("실적과 가이던스","다음 실적 발표의 데이터센터 매출·총이익률·가이던스","기대치 상회와 수요 지속 확인","기대치 미달이나 마진 둔화"),
   signal("정책과 중국","미국 반도체 수출규정 변경·공식 공시","규제 불확실성 완화","수출제한 확대"),
   signal("시장 전체의 압력","국채금리·나스닥·SOXX 동행 여부","동종업종 대비 강세 회복","금리 상승과 업종 동반 약세")
  ],
  insight:"매출의 절대 규모보다 ‘시장 기대와의 차이’를 먼저 보세요. 엔비디아만 떨어지는지, 반도체 업종 전체가 떨어지는지 구분하면 회사 문제와 시장 문제를 좁힐 수 있습니다."
 },
 chips:{
  id:"chips",label:"반도체 산업",ticker:"SOXX · TSM · INTC",group:"반도체·산업정책",keywords:["반도체","tsmc","인텔","intel","칩스","칩4","chips","soxx","amd","어드밴스드 마이크로 디바이시스","파운드리"],route:["chips","trade","history"],point:{lat:33.4484,lng:-112.074,zoom:9,name:"미국 애리조나 · 반도체 생산 투자"},
  facts:[datum("미국 반도체 지원 근거","CHIPS and Science Act (H.R.4346)가 2022년 제정","chips","2022-08-09")],
  risks:[
   hyp("보조금·산업정책","정부 지원조건과 지급 단계가 투자 속도에 영향을 줄 수 있습니다.","기업별 실제 지급 확정 여부와 공장 건설 진행상황을 비교하세요.","commerce"),
   hyp("위탁생산과 대만","대만 생산 집중은 제조역량과 지정학적 위험을 동시에 가져옵니다.","생산 지역별 노출도와 미국 증설 계획을 확인하세요.","sec"),
   hyp("AI 수요","데이터센터 투자와 주문 변화가 반도체 실적에 영향을 줍니다.","기업별 매출·고객 집중도·재고를 구분하세요.","sec")
  ],
  signals:[signal("기업별 수혜","보조금 승인과 실제 공장 가동 단계","실질 생산능력 확대","일정 지연과 비용 증가")],
  insight:"반도체 ‘전체’와 개별 기업은 다릅니다. 설계사·파운드리·장비사 중 어디에서 매출과 비용이 발생하는지 먼저 분리하세요."
 },
 rates:{
  id:"rates",label:"미국 금리·연준",ticker:"TLT · QQQ · XLF",group:"거시경제",keywords:["금리","연준","fed","fomc","인플레이션","물가","국채","달러","환율","채권","통화정책","cpi","pce"],route:["rates","trade"],point:{lat:38.8929,lng:-77.0457,zoom:12,name:"미국 워싱턴 · 연방준비제도"},
  facts:[datum("확인할 공식 자료","FOMC 정책결정과 연준 발표문","fed")],
  risks:[
   hyp("금리의 예상경로","시장이 예상한 금리 경로와 실제 발표가 다르면 성장주와 채권에 영향이 생길 수 있습니다.","금리결정 수치보다 선물시장 기대 변화와 성명문을 함께 보세요.","fed"),
   hyp("물가·고용","인플레이션과 고용 지표 변화가 금리 전망을 바꿀 수 있습니다.","CPI, PCE, 고용 발표의 기준일·예상치를 비교하세요.","fed")
  ],
  signals:[signal("금리 기대","FOMC 성명과 10년물 국채금리","금리 압력 완화","인플레이션 재가속")],
  insight:"금리 ‘수준’보다 시장이 기대하던 경로와 얼마나 달라졌는지가 가격 변화의 단서입니다."
 },
 trade:{
  id:"trade",label:"미국·중국 무역정책",ticker:"XLI · SOXX · SPY",group:"지정학·정책",keywords:["관세","무역","중국","미중","수출규제","보복","tariff","export control","제재","희토류","수출통제","공급망"],route:["trade","chips","history"],point:{lat:38.8951,lng:-77.0364,zoom:11,name:"미국 워싱턴 · 무역정책"},
  facts:[datum("공식 정책 출처","미국 무역대표부 USTR의 발표·규정","ustr")],
  risks:[
   hyp("규제 범위","관세·수출통제는 제품·국가·시행일에 따라 영향을 받는 기업이 다릅니다.","제품 분류, 시행일, 면제·유예 여부를 원문으로 확인하세요.","ustr"),
   hyp("공급망 재편","대체 생산지 확보는 비용과 수요처에 영향을 줍니다.","기업별 생산·판매 지역 노출도와 실제 비용을 비교하세요.","sec")
  ],
  signals:[signal("정책 방향","USTR의 대상품목·시행일·예외 조항","규제 완화와 비용 감소","제한 강화와 비용 상승")],
  insight:"‘관세가 올랐다’는 한 문장보다 어느 품목, 누가 비용을 부담하는지, 어느 기업이 대체 공급자가 되는지를 확인하세요."
 },
 history:{
  id:"history",label:"세계정세·역사",ticker:"국가 · 정책 · 공급망",group:"세계사·지정학",keywords:["세계사","역사","한국","한미","대만","전쟁","일본","외교","세계정세","지정학","대통령","러시아","우크라이나","중동","전쟁사"],route:["history","trade","chips"],point:{lat:25.033,lng:121.5654,zoom:9,name:"대만 · 타이베이"},
  facts:[datum("역사 원문","미 국무부 역사실의 외교 문서","history")],
  risks:[
   hyp("외교적 배경","현재 정책을 해석하려면 과거 조약·외교 합의와 사건의 시간순서를 구분해야 합니다.","날짜·당사국·공식 원문·현재 정책을 나란히 확인하세요.","history"),
   hyp("미국 금융시장 연결","분쟁 위험은 공급망·에너지·수출통제 경로를 통해 기업에 영향을 줄 가능성이 있습니다.","실제 정책 변화나 기업 공시가 있었는지 검증하세요.","sec")
  ],
  signals:[signal("국가 간 정책","외교 발표, 통제 조치, 기업의 공급망 공개","분쟁 완화","규제 강화 또는 물류 차질")],
  insight:"지도에서 사건의 장소를 추적하고, 역사적 이유 → 현재 정책 → 산업 노출 → 기업 공시 순서로 확인하세요."
 },
 disclosures:{
  id:"disclosures",label:"미국 의원 거래·법안",ticker:"의원 · 법안 · 공개거래",group:"정치·금융",keywords:["의원","펠로시","pelosi","낸시","주식거래","주식매수","주식매도","공시","로비","정치인","내부자","정치주"],route:["disclosures","chips"],point:{lat:38.8899,lng:-77.0091,zoom:13,name:"워싱턴 D.C. · 미국 의회"},
  facts:[datum("원문 출처","미 하원 서기처 공개 금융신고 기록","trades")],
  risks:[
   hyp("신고일과 거래일","의원 금융신고에는 실제 거래일과 신고일이 다르게 나타날 수 있습니다.","거래일·신고일·공개금액 구간을 각각 확인하세요.","trades"),
   hyp("법안과의 관련성","위원회 소속·발의 법안·거래시점이 겹치더라도 부당이득의 증거로 단정할 수 없습니다.","시간순서와 실제 권한, 공개된 거래주체를 교차검증하세요.","congress")
  ],
  signals:[signal("공개 거래 검증","거래일·신고일·금액 구간·기업 일치","출처와 날짜의 정확한 일치","공시 지연·동명이인·금액 구간 오류")],
  insight:"정치인 거래와 법안의 '시간적 연관'은 탐지 단서일 뿐 인과관계의 증거가 아닙니다. 원문 확인이 우선입니다."
 }
};
var ALL=Object.keys(TOPICS).map(function(k){return TOPICS[k]});
function norm(q){return String(q==null?"":q).toLowerCase().normalize("NFKC").replace(/[\u200b-\u200d]/g,"").replace(/\s+/g," ").trim();}
function classifyIntent(q){
 if(/왜|이유|원인|떨어|하락|급락|폭락|빠지|내리|떡락|why|down|drop|crash/i.test(q))return "cause";
 if(/오르|상승|급등|폭등|강세|올라|rise|up|surge/i.test(q))return "rise";
 if(/사야|팔아|매수|매도|투자|전망|앞으로|어떻게|어디로|방향|buy|sell/i.test(q))return "decision";
 if(/언제|일정|발표|today|지금|오늘|어제|이번주|최신|현재|실시간/i.test(q))return "timing";
 if(/뭐|무슨|어떤|누구|알려|설명|what/i.test(q))return "explain";
 return "explore";
}
function classify(query){
 var q=norm(query),matches=ALL.map(function(p){
  var score=0;p.keywords.forEach(function(word){
   var term=norm(word);if(q.includes(term))score+=term.length>=3?8:3;
  });return {topic:p,score:score};
 }).filter(function(s){return s.score>0}).sort(function(a,b){return b.score-a.score;});
 return matches.length?matches[0].topic:null;
}
function analyze(query){
 var q=norm(query),intent=classifyIntent(q),topic=classify(q),isFallback=!topic;
 if(!topic)topic=TOPICS.history;
 var interrogative=intent==="cause"?"왜 움직이는지":intent==="rise"?"상승 여력을":intent==="decision"?"다음 판단을":intent==="timing"?"지금 확인할 일정을":"어떤 연결이 있는지";
 var opening;
 if(isFallback){
  opening="질문을 무시하지 않았습니다. 다만 이 문장과 직접 연결되는 검증된 데이터가 아직 없습니다. 질문 속 사건·기업·날짜를 특정할 수 없어 원인을 지어내지 않겠습니다. 대신 보유한 데이터 관계망에서 탐색 가능한 경로를 제시합니다.";
 }else if(intent==="cause"){
  opening=topic.label+"의 하락 원인을 묻는 질문으로 해석했습니다. 실제 해당 시점에 주가가 하락했는지, 하락폭과 뉴스가 무엇인지는 현재 시세·뉴스 피드가 미연결이라 확인되지 않았습니다. 아래는 공시·정책에 근거한 원인 후보이며 확인된 당일 원인이 아닙니다.";
 }else if(intent==="rise"){
  opening=topic.label+"의 상승 배경을 묻는 질문으로 해석했습니다. 실제 시세 상승 여부는 검증되지 않았으며, 아래의 상승·하락 요인을 비교해 원인을 조사할 수 있습니다.";
 }else if(intent==="decision"){
  opening="매수·매도 판단에 참고할 자료를 요청한 것으로 해석했습니다. 관제실은 확인할 근거와 반대 시나리오를 제공합니다. 최종 판단과 실행은 사용자가 결정합니다.";
 }else if(intent==="timing"){
  opening="최신 상황·일정을 묻는 질문입니다. 이 관제실은 실시간 뉴스와 가격 API가 연결되지 않았습니다. 아래 공식 출처에서 날짜를 확인하고, 자료가 최신인지 먼저 검증해야 합니다.";
 }else opening=topic.label+"에서 "+interrogative+" 탐색합니다. 공식 자료와 관련 산업·법안·역사를 연결하되 현재 시점의 확인되지 않은 사실은 표시하지 않습니다.";
 var title=isFallback?"연결 가능한 데이터부터 추적":topic.label+(intent==="cause"?" · 하락 원인 분석":intent==="rise"?" · 상승 요인 분석":intent==="decision"?" · 사용자 판단 브리핑":" · 관제실 브리핑");
 return {
  query:String(query),id:topic.id,topic:topic.label,ticker:topic.ticker,topicGroup:topic.group,
  intent:intent,isFallback:isFallback,title:title,opening:opening,
  facts:isFallback?[]:topic.facts,assumptions:topic.risks,signals:topic.signals,
  insight:topic.insight,missions:isFallback?["chips","trade","rates","history","disclosures"]:topic.route,
  location:topic.point,asOf:"자료별 기준일 확인 · 실시간 미연결",
  caveat:"이 분석은 보관된 공식 자료를 기반으로 한 규칙형 조사 브리핑입니다. 생성형 AI·실시간 뉴스·실시간 시세에 연결되어 있지 않습니다. 현재 주가 방향이나 당일 급락 원인을 확인했다고 주장하지 않습니다.",
  scenarios:topic.signals.length?topic.signals[0]:null,
  userChoice:["강세 가설","중립·관찰","약세 가설"]
 };
}
return {analyze:analyze,classify:classify,classifyIntent:classifyIntent,topics:TOPICS,sources:SRC,normalize:norm};
});