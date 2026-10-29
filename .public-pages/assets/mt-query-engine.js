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
 spacexLaunches:{title:"SpaceX · 공식 발사·임무 기록",url:"https://www.spacex.com/launches"},
 spacexCrew:{title:"NASA · SpaceX Crew-13 발사 (2026-10-01)",url:"https://www.nasa.gov/news-release/nasas-spacex-crew-13-launches-to-international-space-station/"},
 spacexCargo:{title:"NASA · SpaceX CRS-35 임무 (2026-10-13)",url:"https://www.nasa.gov/mission/nasas-spacex-crs-35/"},
 spacexFAA:{title:"FAA · Starship Cape Canaveral 발사·허가 심사",url:"https://www.faa.gov/space/stakeholder_engagement/spacex_starship_ccsfs"},
 spacexTexasFAA:{title:"미국 연방관보 · Starbase 환경영향평가 공고 (2026-10-14)",url:"https://www.govinfo.gov/content/pkg/FR-2026-10-14/html/2026-20963.htm"},
 spacexIPO:{title:"SpaceX IR · 2026-06-15 IPO 완료 (SPCX)",url:"https://ir.spacex.com/updates/releases-details/2026/Space-Exploration-Technologies-Corp--Announces-Closing-of-Initial-Public-Offering-Including-Full-Exercise-of-Underwriters-Option-to-Purchase-Additional-Shares-2026-RgoR-Y1Vwh/"},
 spacexSEC:{title:"미국 SEC · SpaceX 2026년 3분기 10-Q",url:"https://www.sec.gov/Archives/edgar/data/1181412/000162828026066880/spcx-20260930.htm"},
 spacexStockHistory:{title:"Stock Analysis · SPCX 가격 기록 (지연·과거 자료)",url:"https://stockanalysis.com/stocks/spcx/history/"},
 spacexLockup:{title:"Benzinga · IPO 락업 해제와 SPCX",url:"https://www.tradingview.com/news/benzinga%3A525f00c05094b%3A0-spacex-stock-slides-as-second-lockup-expires/"},
 spacexIR:{title:"SpaceX · 투자자관계·실적",url:"https://ir.spacex.com/investors/"},
 tsa:{title:"미국 증권거래위원회 · 투자정보",url:"https://www.investor.gov/"}
};
function source(ref){return SRC[ref];}
function datum(label,value,ref,date){return {label:label,value:value,source:source(ref),asOf:date||null};}
function hyp(title,reason,verify,ref){return {title:title,reason:reason,verify:verify,source:source(ref)};}
function signal(title,watch,ifPositive,ifNegative){return {title:title,watch:watch,up:ifPositive,down:ifNegative};}
var TOPICS={
 spacex:{
  id:"spacex",label:"스페이스X",ticker:"NASDAQ: SPCX · 2026-06-12 상장",group:"우주산업·발사·정부계약",keywords:["스페이스엑스","스페이스 엑스","space x","spacex","spcx","space exploration technologies","스페이스x","스타십","starship","스타링크","starlink","팰컨9","falcon 9","falcon9","드래곤 우주선","crew-13","crs-35"],route:["spacex","history","trade"],point:{lat:25.997,lng:-97.156,zoom:10,name:"텍사스 스타베이스 · Starship 시험 발사 시설"},
  facts:[
    datum("상장 정보","SpaceX는 2026년 6월 12일 미국 나스닥에 SPCX로 신규 상장했습니다. 비상장 기업이 아닙니다.","spacexIPO","2026-06-12"),
    datum("최근 3분기 SEC 실적","2026년 3분기 연결 매출 145억7,500만 달러, 전년 동기 55억7,600만 달러. 여러 사업부 통합 실적입니다.","spacexSEC","2026-09-30 마감 분기"),
    datum("스타링크 중심 연결사업 매출","2026년 3분기 Connectivity 매출 52억4,800만 달러(전년 동기 30억9,700만 달러). 회사 10-Q 공시 기준입니다.","spacexSEC","2026-09-30 마감 분기"),
    datum("최근 주가 기록 · 실시간 아님","10월 22일 SPCX 종가 144.75달러(-9.14%), 10월 26일 종가 146.90달러(-0.40%). 시세 사이트의 과거 일별 기록입니다.","spacexStockHistory","2026-10-22·2026-10-26"),
    datum("최근 스타십 시험 기록","SpaceX 공식 발사 기록에 Starship Flight 14가 2026년 9월 28일 발사된 것으로 기재되어 있습니다.","spacexLaunches","2026-09-28"),
    datum("유인우주선 임무","NASA에 따르면 2026년 10월 1일 SpaceX의 Crew-13 임무가 국제우주정거장을 향해 발사됐습니다.","spacexCrew","2026-10-01"),
    datum("화물 수송 임무","NASA는 CRS-35 화물 보급 임무의 발사일을 2026년 10월 13일로 기록합니다.","spacexCargo","2026-10-13"),
    datum("발사 규제·인프라","FAA는 Cape Canaveral SLC-37 관련 Starship 상업 발사에 별도 운항면허 변경이 필요하다고 설명합니다.","spacexFAA","2026-10 공개 안내"),
    datum("텍사스 발사 운영의 규제 검토","2026년 10월 14일 연방관보에 Starbase의 향후 Starship 운영을 다루는 환경영향평가 공고가 게재됐습니다.","spacexTexasFAA","2026-10-14")
  ],
  risks:[
    hyp("스타십 개발 진척","시험 발사는 기술을 개선하기 위한 과정입니다. 발사 성공·실패·개발 일정은 공식 기록과 후속 발표로 판단해야 하며, 발사 횟수만으로 회사의 현재 상태를 단정할 수 없습니다.","Starship Flight 14 이후 공식 기술 보고와 다음 시험 일정을 확인하세요.","spacexLaunches"),
    hyp("NASA 계약 및 운송 임무","Crew Dragon 유인 수송과 ISS 화물 보급은 스타십 시험과 별개 사업입니다. 최근 발사를 보면 회사 전체가 무엇 때문에 움직이는지 구분할 수 있습니다.","NASA Crew-13, CRS-35 공식 발표와 계약 일정·임무 상태를 각각 확인하세요.","spacexCrew"),
    hyp("FAA 규제·발사장 확대","신규 발사 시설과 비행 횟수 확대에는 환경 심사와 운항면허 조건이 걸릴 수 있습니다. 심사 중인 사업을 이미 승인·완료된 사업처럼 해석하면 안 됩니다.","FAA 공고에서 신청·심사·승인 단계를 나눠 살펴보세요.","spacexFAA"),
    hyp("IPO 이후 매물·자금조달 부담","SPCX는 2026년 상장됐고, 상장 이후 의무보유 해제 시점과 막대한 AI 인프라 투자 비용 등이 시장에서 거론됐습니다. 실제 특정 거래일의 하락 원인으로 단정할 수는 없습니다.","공개된 락업 해제 일정, 신규 차입·자본지출 공시, 같은 날 주가와 거래량을 비교하세요.","spacexLockup"),
    hyp("사업부별 실적과 시장 기대 차이","SpaceX의 10-Q에는 발사·Starlink 연결사업·AI 인프라 관련 사업이 함께 실립니다. 매출 성장만으로 주가를 설명하기 어렵고 주가에 반영됐던 성장 기대와 비용을 비교해야 합니다.","2026년 3분기 SEC 공시의 각 사업부 매출·이익과 당시 시장 예상치를 분리해 확인하세요.","spacexSEC")
  ],
  signals:[
    signal("스타십 시험","다음 공식 비행 일정, 시험 결과, 재사용·엔진 관련 발표","새 시험의 목표 충족","일정 지연이나 검증 필요 사항 증가"),
    signal("사업별 NASA 임무","유인 및 화물 임무 성과, 공식 계약·임무 일정","임무 수행 및 계약 확대","일정 변경·임무 차질"),
    signal("규제 단계","FAA의 환경 검토, 운항면허 변경 심사 상태","검증 완료 및 허가 진전","추가 보완 요구 또는 일정 변경"),
    signal("SPCX 증시 수급·자금조달","거래량, 락업 해제 관련 공시, 새 차입과 자본지출","공시 우려 완화·비용 통제","매물 증가·자금 비용 부담")
  ],
  insight:"SPCX의 주가 변동과 Starship 시험은 같은 이야기가 아닙니다. 우선 2026년 10월 22일 급락 당시 시장 수급·실적·차입·투자 비용을 확인하고, 사업 측면에서는 스타십/NASA/스타링크/FAA를 따로 추적하세요. 관제실은 사실과 가능한 원인을 분리하고 최종 해석은 사용자가 합니다."
 },
 nvda:{
  id:"nvda",label:"엔비디아",ticker:"NVDA",group:"반도체·AI",keywords:["엔비디아","nvidia","nvda","젠슨황","jensen huang","h100","h200","blackwell","rubin","gpu","그래픽카드"],route:["chips","trade","rates"],point:{lat:37.37064,lng:-121.96708,zoom:15,name:"NVIDIA 본사 · 2788 San Tomas Expressway, Santa Clara"},
  photo:{url:"https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/2788-2888_San_Tomas_Expwy.jpg/960px-2788-2888_San_Tomas_Expwy.jpg",source:"https://commons.wikimedia.org/wiki/File:2788-2888_San_Tomas_Expwy.jpg",credit:"NVIDIA 본사 실사진 · Coolcaesar (2023) · CC BY-SA 4.0"},
  facts:[
   datum("FY2027 2분기 매출","962억 달러 · 전년 동기 대비 106% 증가","nvidiaQ2","2026-07-26 마감 분기"),
   datum("같은 분기 데이터센터 매출","890억 달러 · 전년 동기 대비 117% 증가","nvidiaQ2","2026-07-26 마감 분기"),
   datum("같은 분기 총이익률","GAAP 기준 75.0%","nvidiaQ2","2026-07-26 마감 분기"),
   datum("다음 분기 회사 전망","FY2027 3분기 매출 전망 1,080억 달러(±2%). 중국 데이터센터 컴퓨트 매출은 전망에 포함하지 않음","nvidiaQ2","2026-08-26 발표")
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
 if(/왜그래|왜이래|요즘|근황|무슨일|뭔일|최근 어떻게|어때|what happened|whats going on/i.test(q)&&!/떨어|하락|폭락|급락|오르|상승|급등|폭등/i.test(q))return "situation";
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
  opening="질문을 받았습니다. 준비된 주제와 일치하지 않아 현재 공개 백과 자료에서 질문에 가까운 문서를 찾아보겠습니다. 이 조회는 최신 뉴스·주가 검색이나 생성형 AI 추론이 아닙니다. 확인한 문서와 직접 확인하지 못한 내용을 구분하겠습니다.";
 }else if(intent==="situation"){
  opening=topic.label+"에 최근 어떤 일이 있었는지 묻는 질문으로 해석했습니다. 회사 공식 발표·SEC 재무제표·관련 정책 자료를 날짜순으로 보여주고, 주가 움직임과 사업 활동을 나눠 설명합니다. 기사 제목과 가격 방향만으로 특정 원인을 확정하지 않습니다.";
 }else if(intent==="cause"){
  opening=topic.label+"의 하락 원인을 묻는 질문으로 해석했습니다. 실제 해당 시점에 주가가 하락했는지, 하락폭과 뉴스가 무엇인지는 현재 시세·뉴스 피드가 미연결이라 확인되지 않았습니다. 아래는 공시·정책에 근거한 원인 후보이며 확인된 당일 원인이 아닙니다.";
 }else if(intent==="rise"){
  opening=topic.label+"의 상승 배경을 묻는 질문으로 해석했습니다. 실제 시세 상승 여부는 검증되지 않았으며, 아래의 상승·하락 요인을 비교해 원인을 조사할 수 있습니다.";
 }else if(intent==="decision"){
  opening="매수·매도 판단에 참고할 자료를 요청한 것으로 해석했습니다. 관제실은 확인할 근거와 반대 시나리오를 제공합니다. 최종 판단과 실행은 사용자가 결정합니다.";
 }else if(intent==="timing"){
  opening="최신 상황·일정을 묻는 질문입니다. 이 관제실은 실시간 뉴스와 가격 API가 연결되지 않았습니다. 아래 공식 출처에서 날짜를 확인하고, 자료가 최신인지 먼저 검증해야 합니다.";
 }else opening=topic.label+"에서 "+interrogative+" 탐색합니다. 공식 자료와 관련 산업·법안·역사를 연결하되 현재 시점의 확인되지 않은 사실은 표시하지 않습니다.";
 var title=isFallback?"연결 가능한 데이터부터 추적":topic.label+(intent==="situation"?" · 요즘 무슨 일이 있나":intent==="cause"?" · 하락 원인 분석":intent==="rise"?" · 상승 요인 분석":intent==="decision"?" · 사용자 판단 브리핑":" · 관제실 브리핑");
 return {
  query:String(query),id:isFallback?"open":topic.id,topic:isFallback?"공개 자료 탐색":topic.label,ticker:isFallback?"OPEN SEARCH":topic.ticker,topicGroup:isFallback?"범용 조사 시험 기능":topic.group,
  intent:intent,isFallback:isFallback,title:title,opening:opening,
  facts:isFallback?[]:topic.facts,assumptions:isFallback?[]:topic.risks,signals:isFallback?[]:topic.signals,
  insight:isFallback?"찾은 문서의 주제·연도·출처가 질문과 일치하는지 먼저 확인하세요. 일치하지 않는 자료를 억지로 연결하거나 최신 사건의 원인을 추정하지 않습니다.":topic.insight,missions:isFallback?["history","rates","trade","chips","disclosures"]:topic.route,
  location:isFallback?null:topic.point,photo:isFallback?null:(topic.photo||null),asOf:"자료별 기준일 확인 · 실시간 미연결",
  caveat:"이 분석은 보관된 공식 자료를 기반으로 한 규칙형 조사 브리핑입니다. 생성형 AI·실시간 뉴스·실시간 시세에 연결되어 있지 않습니다. 현재 주가 방향이나 당일 급락 원인을 확인했다고 주장하지 않습니다.",
  scenarios:topic.signals.length?topic.signals[0]:null,
  userChoice:["강세 가설","중립·관찰","약세 가설"]
 };
}
return {analyze:analyze,classify:classify,classifyIntent:classifyIntent,topics:TOPICS,sources:SRC,normalize:norm};
});