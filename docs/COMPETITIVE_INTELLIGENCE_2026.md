# MONEY TRACKER — 2026 경쟁사·기관투자자 워크플로 연구 및 차별화 설계
작성: 2026-10-27
상태: **제품 설계 제안 / 구현 완료 아님**
목적: 미국 매각을 고려한 세계지도 기반 조사·시장 인텔리전스 플랫폼의 독창적인 제품 구조 확립

## 제품 북극성

> 관제실에서 어떤 질문이든 시작할 수 있다. 시스템은 실제 공개 근거를 수집하고, 법안·의원·정부·기업·주식·산업·역사·지리 관계를 재구성한다. 사용자는 세계지도를 직접 이동하며 조사 경로를 선택한다. AI는 증거를 분석해 상반된 시나리오와 관찰해야 할 지표를 제시하지만, **최종 판단권은 사용자**에게 있다.

MONEY TRACKER는 로빈후드 같은 주문 실행 화면도 아니고, 블룸버그의 데이터 수치를 복제한 화면도 아니다. **재현·감사 가능한 증거 그래프와 실제 지도 위의 인터랙티브 조사 워크플로**가 제품 자체여야 한다.

## 1. 경쟁사 벤치마킹 — 공식 자료에 근거

| 제품 | 공개된 핵심 경험 | MONEY TRACKER가 채택할 원리 | 단순 복사하면 안 되는 점 |
|---|---|---|---|
| Robinhood Legend | 차트, 위젯, 관심종목 및 주문 흐름을 개인별 맞춤형 레이아웃에 연결 | 검색·브리핑·지도·관계 그래프를 한 세션 안에서 연결하고 사용자 배치를 저장 | 거래 실행·계좌 보유를 핵심 가치로 두지 않음 |
| Robinhood Cortex / Agents | 뉴스, 실시간 데이터, 애널리스트 정보 및 계좌 데이터로 포트폴리오 설명과 에이전트 기능 | 질문이 필요한 데이터를 찾고, 사용자 관련성을 설명하는 근거 기반 응답 | 준비된 뉴스 텍스트만 요약하는 차별성 없는 보조 AI |
| Bloomberg Terminal / ASKB | 글로벌 데이터·속보·리서치·애널리틱스와 기관 워크플로 | 장기 관측, 다중 자산/이벤트 타임라인, 원본 근거 | 데이터 양과 터미널 가격만 경쟁하지 않음 |
| FactSet / S&P Capital IQ Pro / Visible Alpha | 기업 재무, 컨센서스 예상치, 실적발표, 추정치 수정 기록, 동종업계 및 포트폴리오 분석 | 실적 자체보다 예상치와 실제치의 차이, 과거 시점별 데이터, 경쟁사 비교 | 실시간 컨센서스를 계약 없이 제공한다고 주장하지 않음 |
| LSEG Workspace | Reuters와 다른 출처의 뉴스, 가격, 리서치 및 시장심리 분석 | 이벤트 발생 시간, 원문, 관련 섹터와 기업을 함께 조회 | 리셀·재배포 제한을 위반한 외부 데이터 재판매 |
| AlphaSense | 광범위한 유료 재무문서와 전문가 인터뷰를 AI로 검색하고 원본 인용 제공 | 모든 결론에서 문서의 특정 문장·수치로 돌아가는 탐색 | 근거가 없는 생성형 답변을 포장하지 않음 |
| MSCI Barra | 스타일/섹터/거시요인별 위험 노출과 시나리오 분석 | 위험요인, 상승·하락 조건, 동조화/비동조화 구분 | 모델 예측을 확정적인 미래 주가로 표시하지 않음 |
| Palantir Foundry | 실제 사람·시설·사건·문서를 객체(Object)와 관계(Link), 지도·시간축으로 연결 | 금융·정치·국제 사건의 시간·지리·근거를 포함한 연결 그래프 | Palantir UI를 복제하거나 사칭하지 않음 |
| J.P. Morgan Markets (공개 제품 설명) | 거시·기업 펀더멘털·정책·포지셔닝·ETF 및 개인/기관 흐름·심리 등을 조합 | '기업 문제 / 업종 문제 / 시장 전체 문제'를 먼저 분해 | 내부 프라임북·기관 포지션 데이터에 당연히 접근 가능하다고 가정하지 않음 |

### 원문 참조
- Robinhood Legend: https://robinhood.com/us/en/support/articles/get-started-with-robinhood-legend/
- Robinhood Cortex: https://robinhood.com/us/en/support/articles/cortex-digests-methodology/
- Robinhood 2026 Agents: https://robinhood.com/newsroom/hood-summit-2026/
- Bloomberg: https://professional.bloomberg.com/products/bloomberg-terminal/
- FactSet: https://www.factset.com/solutions
- S&P Capital IQ: https://www.spglobal.com/market-intelligence/en/solutions/products/sp-capital-iq-pro
- LSEG Workspace: https://www.lseg.com/en/data-analytics/products/workspace
- LSEG redistribution limitations, workspace news: https://developers.lseg.com/en/product/news/workspace_news
- AlphaSense: https://www.alpha-sense.com/solutions/financial-research-platform/
- MSCI Barra: https://www.msci.com/data-and-analytics/factor-investing/equity-factor-models
- Palantir Ontology: https://www.palantir.com/docs/foundry/ontology
- Palantir Map: https://www.palantir.com/docs/foundry/map
- JPM institutional intelligence: https://www.jpmorgan.com/markets/market-data-intelligence

## 2. 실제 기관 투자 분석을 일반인도 이해하게 바꾸는 방법

### 기관의 자료 흐름
1. **상황 확인:** 주가·섹터·ETF·국채금리 등 동시 움직임과 분석 기준시각 설정.
2. **새 정보 탐지:** SEC 공시, 회사 실적/가이던스, 연준 발표, 의회 법안, 신뢰 가능한 속보.
3. **시장 기대와 비교:** 실적/전망 vs 발표 직전의 애널리스트 예상치; 예상치 수정 이력.
4. **노출 관계 점검:** 기업의 고객, 매출 지역, 공급망, 정책 노출, 경쟁사.
5. **리스크·시나리오:** 어떤 시점의 어떤 데이터가 실제로 있었는지(look-ahead 방지); 설명을 반박할 증거 찾기.
6. **포지션/자금흐름:** 라이선스 또는 자체 보유한 데이터 범위에서 ETF 자금흐름, 옵션, 공매도, 위험요인 확인.
7. **사용자 판단:** 관찰·심층 조사·알림 등록. 실제 주문은 서비스 범위 밖.

### 쉬운 문장으로 변환
- 분석 결과: "매출이 늘어도 투자자가 기대했던 성장속도보다 낮았다면 주가가 내려갈 수 있어요."
- 증거: 원문 수치·날짜·기업명·사업부·컨센서스 시점.
- 반대 증거: 다른 경쟁사는 상승했는가? 같은 날 금리가 상승했는가? 긍정적 가이던스가 있는가?
- 결론: 확인된 사실과 가능한 해석을 분리. 거래를 권유하지 않음.

## 3. 핵심 제품 경험 — 'OPERATION TRACE'

1. 사용자 질문: "엔비디아는 왜 떨어져? 법안 영향도 있어?"
2. **정찰 시작:** NVDA의 정확한 분석 날짜를 확인. 당일 가격·SOXX·QQQ 동반 하락 여부를 가격 제공자에서 조회. 불가능하면 '당일 데이터 미연결'이라고 명시.
3. **3초 보고:** "현재 확인된 사실 2개 / 설명 가설 4개 / 반대 증거 1개 / 다음 공개 일정". 실제 개수는 검증한 데이터만 계산.
4. **지도 작전:** 산타클라라 NVIDIA 본사 → 워싱턴 의회와 정책 문서 → 대만 신주 반도체 공급망 → 주요 시장·고객이 있는 실제 도시. 각 중간지점은 사용자가 선택.
5. **카메라 동작:** 현재 위치에서 시야 확보를 위해 줌아웃 → 경로를 따라 이동 → 도시 → 시설 확대. 이동 경로는 실제 사람 이동 이력이 아니라 '분석 내비게이션'이라고 표시. 건너뛰기·즉시 이동·수동지도 조작 지원.
6. **현장 카드:** 실제 사진(기관 출처, 촬영연도, 라이선스), 원문 링크, 지리 좌표, 문서 발행일, 기사/공시 진위 및 일자.
7. **자료 연결:** CHIPS 법안 페이지 → 원 발의 의원 및 당시 위원회 기록 → 정부 보조금 수혜 기업 → 관련 반도체 기업. NVIDIA 자체 보조금 지원 사실로 **잘못 추정하지 않는다**.
8. **두 가지 이야기:** "하락을 설명할 수 있는 가설"과 "그 가설이 틀릴 수도 있는 이유". 가설에 정량 확률을 임의로 붙이지 않는다.
9. **지휘관 선택:** [실적 조사] [의회 법안 추적] [대만 공급망] [금리 영향] [과거 같은 사건] [내 관찰 노트]. 각 선택에서 새 근거를 검색하고 그래프를 확장.
10. **결과 보관:** 조사 기록·확인 자료·반례·새로 변경된 문서·다음 확인 일정 저장.

## 4. 고유 차별화 기능 — 놀이가 아니라 탐사의 재미
- **Evidence Trail:** 자료 출처가 붙은 연결선만 실선. 경제적 연관·분석 가설은 점선. 확인 불가는 회색 표시. 선 굵기는 신뢰도라고 암시하지 말고 의미를 명시.
- **Temporal Replay:** 2000년대/2010년대/오늘 순서로 관련 정책·기업 관계를 재생. 당시 공개되었던 데이터만 사용해 사후정보 오류 방지.
- **Mission Fork:** 하나의 질문에서 관세·법안·기업 실적·금리 등 분기 경로를 사용자가 선택. 강제로 자동 재생하지 않음.
- **Counter-Evidence:** 사용자 의견을 반박할 수 있는 공식 자료를 언제나 함께 표시. 검증할 자료가 없으면 미확인.
- **Daily Dossier:** 오늘 새로 제출된 공식 문서·예정된 경제지표·관심 기업의 수정된 공시만 정리; 오탐의 수 감소가 우선.
- **Case Files:** 사용자가 선택한 결론·조건·다음 검증 날짜를 개인 조사서에 기록. '주가 수익'이나 불필요한 클릭을 게임 보상으로 쓰지 않음.
- **Clue Discovery:** 사용자가 출처를 확인하거나 두 자료의 날짜 차이를 발견했을 때 진행률 표시. 도박형 또는 과도한 빈도 보상 없음.
- **Free Investigation:** 황당한 질문에도 관련 엔티티를 찾고, 못 찾으면 과장 없이 가능한 조사 자료·질문 개선점을 제공. 임의로 NVIDIA나 미국 도시로 이동하면 실패.

## 5. 데이터 모델(매각 가치의 핵심 후보)

객체:
- EVENT: event_id, occurred_at, published_at, retrieved_at, geography, primary_source_url
- POLICY_BILL: congress, chamber, bill_number, sponsor_bioguide_id, action_dates, committee IDs
- POLITICIAN: bioguide_id, name, term_from/to, committee membership date range
- COMPANY: SEC CIK, SEC filing URLs, headquarters/address, sectors, ticker mappings (validity dates)
- TRADE_DISCLOSURE: filing_id, disclosed_member_id, transaction_date, filing_date, amount_interval, owner, correction status, source
- MARKET_OBSERVATION: symbol, venue, value, bar_timestamp, currency, real-time/delayed flag, provider/license
- GEOGRAPHY/PHOTO: coordinates, building_id, source, capture date, license
- HISTORICAL_DOCUMENT: origin, event dates, archive date, context

관계 EDGE:
subject_id, predicate, object_id, valid_from, valid_to, source_id, evidence_span, extracted_at, verification_status, relation_type.
relation_type = VERIFIED_DIRECT | POLICY_CONTEXT | SUPPLY_CHAIN_CONTEXT | TEMPORAL_PROXIMITY | HYPOTHESIS.
NEVER turn temporal proximity into proof of misconduct or guaranteed investment returns.

원본 출처에 대한 참조와 재조회 가능성이 있어야 한다. 원문에서 추출된 텍스트나 사진의 재배포 권한은 별도로 확인한다.

## 6. 데이터 제공자 우선순위

### 초기 공식 데이터
1. SEC EDGAR 기업 공시 및 재무: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
2. Congress.gov API 의원·법안·공동발의·일정·투표: https://api.congress.gov/
3. 미국 하원 금융공시: https://disclosures-clerk.house.gov/FinancialDisclosure
4. FRED 및 ALFRED 경제지표·과거 수정판: https://fred.stlouisfed.org/docs/api/fred/
5. 공식 회사 IR, NIST CHIPS 지원 사업, Federal Reserve, USTR.

### 계약 검토가 필요한 데이터
- 실시간/지연 주가 및 거래량, ETF 자금흐름, 옵션 내역과 컨센서스 예상치.
- Reuters 등 유료 뉴스: 플랫폼 이용 권한이 웹사이트 재판매·AI 재배포 권한을 의미하지 않음.
- 금융시장 컨센서스 및 분석 리서치: 계약 범위와 저장·디스플레이·시세 지연 규정을 확인할 것.

## 7. 출시 단계

**MVP A — 단일 질문에서 실제 조사**: 질문 해석, 검색 서버, 공식 데이터 수집, 출처 포함 답변, 시간기준, 사실/가설 분리, 사용자 선택, 지도 이동. 당일 주식 이유는 데이터 제공자 라이선스 없으면 확인 불가 표시.

**MVP B — 20~50개 샘플 조사와 근거 그래프**: 반도체·AI, 방산, 에너지, 관세, 금리 사건을 선정. 법안→의원→기업 경로와 역사 연대기. 모바일/PC 인터랙션 QA.

**Beta C — 자동 감시/데이터 운영**: 출처별 갱신 실패 감시, 최신 이벤트 알림, 소스 증거 저장, 실적 발표 대비 컨센서스, 개인 Case Files, 비공개 인증·원가 관리·라이선스 검증.

평가: 40개 이상의 서로 다른 자연어 질문의 **직접 답변률, 출처 유효성, 사실/가설 오분류, 시간 일관성, 잘못된 지도 점프 수, 사용자가 얻은 검증된 단서 수**.
지도 시각효과는 근거 연결 및 검색 성능보다 우선하지 않는다.

## 8. 현재 저장소와 구분
현재 GitHub의 6개 규칙형 주제, 일부 공식 법안·실적 예시, Wikimedia 시험 검색, 3단계 지도 이동, 출처 사진은 **실험 구현**이다. 위 제안의 검색 백엔드, 실시간 가격·뉴스, 포괄적인 의원 거래, 학습된 원인 예측, 데이터 라이선스, 미국 사용자용 구독 인프라는 **구현 완료가 아니다**.
미국 관제실은 아직 공개 GitHub Pages URL로 직접 접근 가능하므로, 운영자 전용 인증 완료 전까지 보안 경계를 요구하는 데이터는 게시하지 않는다.

## 제품 메세지 제안
MONEY TRACKER — Follow the evidence. Navigate the world. Make your call.
