# 인수인계: 세계 관제실 확장 (Claude 세션 → 다음 작업자/GPT)

작성: 2026-10-28 10시 KST. 먼저 저장소 루트의 `HANDOFF.md`(원칙·올리는 방법·비밀값)를 읽고 이 문서를 읽는다.

## 1. 운영자가 확정한 목표 (2026-10-28 대화)
> **"전 세계에서 돈과 권력이 움직이는 상황을 한 지도에서 추적하는 관제실. 근거 자료와 원문만 보여 주고, 판단은 이용자가 한다."**

- **예상·추천은 하지 않는다.** 주가 전망, "오른다/사라", "그래서 올랐다" 같은 원인 단정은 금지. 사실(법안·공시·통계·일정)과 **연결**만 보여 주고, 과거 통계는 "기록된 과거"로만 표시.
- **진행 순서:** ① 데이터를 자동으로 쌓는다 → ② 서로 연결한다(공장·회사·종목·법안·의원·사건) → ③ 지도와 검색으로 보여 준다 → ④ 마지막에 AI 답변.
- **대상 지역:** 미국·한국·일본·대만이 중심이고 유럽·영국도 넣는다. 중국은 국가 페이지가 아니라 **요인 레이어**로 넣는다(수출통제 공고, 해관 통계, 미국의 대중국 조치).
- **업종:** 반도체만이 아니라 전 업종(은행·에너지·자동차·바이오·방산·유통·부동산 등). 업종마다 영향받는 요인을 연결한다(예: 은행↔금리, 항공↔유가·환율, 방산↔국방예산·분쟁).
- **AI 없이도 검색되게:** 이름 사전(회사명·종목코드·인물·법안, 여러 언어) + 매일 만드는 검색 색인 + 나라/업종/날짜/자료종류 필터 + 타임라인.

## 2. 지켜야 할 것
- 모든 숫자·기록에 **출처 URL과 날짜**를 붙인다. 없으면 "미확인".
- **언론 기사 본문은 저장하지 않는다.** 제목·날짜·짧은 요약·원문 링크만.
- 유료(구독)로 종목 전망을 주면 한국에서 **유사투자자문업 신고 대상**이 될 수 있다. 구독 수익화 전에 법률 확인 필요(운영자에게 이미 알림).
- 주가 데이터는 재배포 라이선스가 있다. 실시간 시세는 유료. 공식적으로 허용된 출처나 지연 종가부터.
- API 키는 GitHub Secrets / Cloudflare 비밀값에만. 프런트 JS 금지.
- **"테스트하지 않은 기능을 완료했다고 보고하지 마"**는 운영자의 명시 요구다.
- 운영자 설정: 사이트 수정은 묻지 말고 바로 반영(브랜치 → PR → squash merge)한 뒤 "완성"이라고 알린다.

## 3. 이미 다른 Claude 세션이 만든 것 — 덮어쓰지 말 것
2026-10-28 오전에 별도 세션이 아래를 만들고 계속 고치고 있었다(PR #93~#96 이후 직접 커밋). **이 파일들은 그 작업의 소유다. 고치기 전에 `git log`로 최근 변경을 확인하고, 새 기능은 새 파일로 만든다.**
- `collector/world/` (`laws.py`, `markets.py`, `topics.py`, `build_flow.py`), `.github/workflows/world-data.yml`(매일 07:23 KST)
- `data/laws/{us,kr,jp,tw,eu}.json` (EU는 EUR-Lex 채택 법령 1.4만 건+), `data/markets/*.json` (71개: 한·일·대만·미 주요 종목, 지수, 환율, 유가, 금, BTC 등. 필드 `symbol,name,region,currency,tags,source,updated,note,d,c`)
- `assets/mt-world-flow.js`: 검색하면 5개 지역 법안·주가 흐름, 통과 전후 20거래일 비교, 금리·환율·유가 요인, 지도 따라가기
- 이미 있던 수집: 한국 국회(`national.yml`), 미국 의회·의원 거래(`us.yml`, `us-data.yml`), FRED 거시 5개(`scripts/collect_us_macro.py` → `data/us-macro.json`), 연방관보·SEC·일본 회의록(`overnight-public-data.yml`), 대만 상장사(`ingest-twse.yml`)

## 4. 아직 아무도 시작하지 않은 일 (추천 순서)
이 세션이 맡기로 했다가 사용량 한도로 **시작 전에 멈춘** 것들이다. 겹치지 않게 새 파일로 만들 것을 권한다.
1. ✅ **(2026-10-28 완료, 데이터만)** **전 업종·요인 연결표** — `data/market/sectors.json`: 16개 업종, 25개 요인(12개는 이미 수집 중인 자료를 가리키고 13개는 `planned`), 업종별 법안 주제(`collector/world/topics.py` id)와 대표 종목(`data/markets` 파일명). 검사: `tests/market-reference.test.cjs`. **아직 화면·검색 색인에는 연결 안 됨.** 아래 원래 설명: 예: `data/market/sectors.json`. 업종 → 요인 목록 → 관련 `data/markets` 심볼·FRED 시리즈. 설명은 중립 문장, 출처 링크.
2. ✅ **(2026-10-28 완료, 데이터만)** **시장 일정 캘린더** — `data/market/calendar.json`: 공식 페이지에서 확인한 FOMC(2027년은 연준 표기상 잠정)·ECB·일본은행 회의일 29건(~2027-12), 반복 발표 규칙 5개. **한국은행 일정은 공식 페이지를 자동으로 못 읽어 `pending`에 남김 — 공식 페이지에서 확인 후 추가할 것.** 일정이 60일 안에 떨어지면 테스트가 실패해 갱신을 알림. 아직 화면에 표시 안 됨. 아래 원래 설명: 예: `data/market/calendar.json`. FOMC, ECB, 일본은행, 한국은행 회의일은 **각 중앙은행 공식 페이지에서 확인**한 날짜만. 반복 일정(미국 고용지표 매달 첫 금요일 전후, 한국 1~10일 수출 매달 11일 전후, TSMC 월매출 매달 10일 전후)은 "예정·변동 가능"으로 표시. 재방문 유도 효과가 가장 큼.
3. 🟡 **(2026-10-28 일부 완료)** `scripts/collect-market-factors.mjs` + `market-factors.yml`(매일 08:10 KST, 키 없음): 대만 상장사 월매출(TWSE t187ap05_L, 1,088개사·주요 10개사 36개월 이력), ECB 금리(DFR·MRR), FRED 주택착공·구리 → `data/market/factors/`. 실제 Actions 수집 성공, TSMC 2026-09 값이 공식 발표와 일치 확인. 브랜치에서는 수집만 시험, 커밋은 main에서만. **각국 기준금리(한·일·중·영·미·유로존)도 BIS WS_CBPOL(키 없음)로 수집 중** → `data/market/factors/policy-rates.json`(월간, 대만은 BIS에 없음). 중국 상무부 공고·미국 수출통제 고시도 같은 스크립트. 남은 것: 관세청 수출입(한국 수출), Eurostat, 대만 기준금리, 일별 한국 금리가 필요하면 한국은행 ECOS(무료 키 `ECOS_API_KEY`). **거시 요인 확장** — 한국은행 ECOS, ECB 데이터 API, 일본은행, 관세청 수출입, 대만 公開資訊觀測站 월매출, Eurostat. 기존 `collect_us_macro.py`처럼 실패하면 이전 자료 유지.
4. 🟡 **(2026-10-28 일부 완료)** 표결 요약 수집·검색 연결: 영국 하원 Commons Votes API(최근 200건 이상, 매일 누적 → `data/market/factors/uk-commons-divisions.json`), 유럽의회 기명 표결 HowTheyVote.eu(`eu-parliament-votes.json`). **의원별 표는 아직 저장 안 함** — 영국은 `/data/division/{id}.json`, 유럽의회는 HowTheyVote 표결 상세에서 의원별 표를 받아 의원 추적(한국·미국처럼)으로 확장하는 게 다음 일. **유럽의회·영국 의회 의원 표결** — 의원 추적이 가능한 지역. 유럽의회 공개 데이터, 영국 의회 API.
5. 🟡 **(2026-10-28 일부 완료)** 미국 쪽 대중국 조치: Federal Register API로 BIS(수출통제·Entity List)·USTR(관세) 최신 고시 400건 매일 수집(`data/market/factors/us-trade-controls.json`, 중국 관련 자동 분류) + 검색 색인 연결. **중국 상무부(mofcom.gov.cn)는 GitHub Actions에서 HTTP 200으로 접속됨을 확인**(`status.json`의 `chinaMofcomProbe`) → **상무부 공고 수집 추가 완료**(`data/market/factors/cn-mofcom-announcements.json`, 제목·번호·링크만, 매일 누적, 검색 연결). 단 목록 페이지(`/zwgk/zcfb/index.html`)는 내용이 자바스크립트로 그려져 서버에서 읽으면 0건이고 `index_1.html` 같은 이전 페이지는 404(2026-10-28 Actions에서 확인). 지금은 홈페이지에 노출된 최신 공고만 매일 누적된다. 과거 공고까지 원하면 브라우저 개발자도구로 목록 페이지가 부르는 JSON 주소를 찾아 그걸 읽을 것. 해관 통계는 아직. **중국 요인 레이어** — 상무부 수출통제 공고, 해관 통계. 중국 정부 사이트는 API가 거의 없고 해외 서버 접속이 막힐 수 있으니 먼저 Actions에서 접속 시험. 미국 상무부 Entity List·수출규제는 이미 수집 중인 연방관보로 잡을 수 있다.
6. 🟡 **(2026-10-28 일부 완료)** 미국 핵심 업종(반도체 3344·자동차 3361·항공우주 3364·제약 3254·전기장비 3359) 카운티·주별 민간 고용을 BLS QCEW로 매일 확인·수집(`data/market/factors/us-jobs-by-county.json`, 최신 분기 자동 탐색, 검색 연결). 카운티마다 `lat`/`lng` 추가 완료(미국 인구조사국 Gazetteer 대표점, 공장 위치 아님; 상위 카운티 200곳 중 180곳 — 나머지는 '주 전체 미분류' 같은 코드라 좌표 없음). **화면 담당(그록봇 등)은 `data/market/factors/us-jobs-by-county.json`의 `industries.<NAICS>.counties[]`를 바로 지도 점으로 그리면 된다.** EPA 시설·기업명 매칭은 미착수. 미국 FDA 신약 허가(openFDA)도 수집·검색 연결됨. **공장·일자리 지도 레이어** — 미국 EPA 시설 등록부(회사명·좌표), 노동통계국 카운티별 업종 고용, 기업 연차보고서 사업장 항목. 가장 어려운 건 "공장 = 회사 = 종목" 이름 맞추기 → 주요 기업 수십 곳부터 정확히.
7. 🟡 **(2026-10-28 일부 완료)** `scripts/build-company-links.mjs` → `data/market/company-links.json`(매일 수집 직후 재생성): 추적 기업·ETF 54개마다 업종, 함께 볼 지표의 최신값, 종목코드로 정확히 연결된 기록(대만 월매출), 이름 일치 기록(FDA 신청자·미국 무역 고시 제목, 현재 0건). 검색 항목 `company-links-<id>`(회사명은 제목에만 — 기업 기록 순위 보호). 다음: 공장 위치(회사 공시)·법안 발의 의원·의원 거래와 잇기. **연결 작업** — 공장·회사·종목·법안·발의 의원·의원 거래·사건을 잇는다. 실제 식별자가 있는 관계만 사실로 표시.
8. 🟡 **(2026-10-28 일부 완료)** 업종 16·요인 25·공식 일정 29건을 오프라인 검색 색인에 추가(`scripts/market-reference-index.mjs`, `build-local-index.mjs`에서 호출). 관제실에서 "방산 업종", "FOMC 일정", "한국은행 기준금리" 검색 시 결과가 뜨는 것을 실제 Chromium으로 확인. 남은 일: 지난 일정보다 다가오는 일정을 먼저 보여 주기, 결과 종류(업종/요인/일정) 전용 표시. **통합 검색(AI 없음)** — 위 자료를 기존 검색 색인(`scripts/build-local-index.mjs`, `assets/mt-local-search.js`)에 추가. 자료가 수백만 건이 되면 Cloudflare 서버 쪽 검색으로 이전.
9. **AI 답변(맨 마지막)** — 운영자 API 키 필요. 운영자 전용부터, 하루 한도·월 예산 상한 필수, 쌓인 자료만 근거로 출처 링크와 함께.

### 비용 참고 (2026-10 기준 제3자 정리, 붙이기 전에 공식 가격 재확인)
- Claude Haiku 5.5: 입력 $0.10 / 출력 $0.50 (100만 토큰당, 프롬프트 10만 토큰 이하).
- Brave Search API: 1,000회당 $5, 매달 $5 무료 크레딧.
- 질문 1개 ≈ 웹검색 1회 + 요약 1회 ≈ 약 9원. 하루 1,000건이면 월 약 25만 원. 질문당 검색을 여러 번 하거나 공개 무제한이면 급증 → 한도 필수.

### 2026-10-28 오후 추가 진행 (자동 수집, 모두 `scripts/collect-market-factors.mjs` 한 파일·`market-factors.yml` 매일 08:10 KST)
- 나라 특성: 세계은행 API 19개국 × 7개 지표(GDP·성장률·인구·수출/GDP·물가·국방비 금액·국방비/GDP, 국방비 원 출처 SIPRI) → `data/market/factors/country-profiles.json`, 나라별 검색 항목 `country-profile-<ISO3>`.
- 한국·일본 월간 수출: FRED의 OECD MEI 시리즈(`XTEXVA01KRM667S`, `XTEXVA01JPM667S`)를 `fred-extra.json`에 수집 중. FRED 원문에서 단위 확인 완료(미국 달러, 월간, 계절조정; 한국 2026-08 약 1,004억 달러) → `kr_exports` collected로 전환. 더 정확한 1~10일 수출은 관세청(data.go.kr 키 `DATA_GO_KR_KEY`로 해당 API 활용신청 필요).
- 한국 품목별 수출(반도체 8542·승용차 8703·배터리 8507·선박 8901·석유제품 2710·통신기기 8517): `krCustomsExports` 수집기 추가(관세청 `apis.data.go.kr/1220000/Itemtrade/getItemtradeList`, 워크플로에 `DATA_GO_KR_KEY` 전달). **운영자가 2026-10-28 활용신청 → 승인 후 수집 성공**(API는 조회기간 1년 이내만 허용 → 12개월씩 두 번 조회). `data/market/factors/kr-exports-by-item.json`. 2026-09 HS 8542 수출 431억 달러 — 산업부 '반도체'(603억 달러)와 분류 범위가 달라 숫자가 다름(파일 note에 명시).
- 한국 품목별 수출 6개를 업종 요인으로 연결(`kr_exp_semis` 등, 반도체·자동차·배터리·조선·에너지·IT 업종), 검색 항목 `kr-export-<HS>`(전년 같은 달 대비 포함), 상황판에 '한국 품목별 수출' 섹션 추가.
- 요인 현황: 34개 중 33개 수집 중(남은 planned: `us_facilities`). 남은 planned: `us_facilities`(EPA 시설). 대만 기준금리는 BIS에 없음. 한국은행 회의 일정은 여전히 `calendar.json`의 pending(공식 연간표 미확인).

- **관제실 상황판**(`assets/mt-market-board.js`, `usa-command.html` 맨 끝 스크립트 한 줄): 오른쪽 위 "▦ 상황판" 버튼 → 접히는 패널(기본 닫힘)에 다가오는 공식 일정, 각국 기준금리, 대만 월매출(TSMC 등 전년 대비), 최근 미·중 수출통제 고시, 업종 선택 시 함께 볼 지표. 데스크톱·모바일 실제 Chromium 확인(패널 열린 상태에서도 지도 줌 버튼 사용 가능). 다른 모듈을 건드리지 않는 독립 파일.
- 주의: 업종표 검색 항목의 별칭에 종목명을 넣으면 "엔비디아는 왜…" 같은 질문에서 업종표가 기업 기록보다 먼저 나와 `tests/mt-browser-smoke.cjs`가 실패한다. 종목명은 요약에만 둘 것(테스트로 막아 둠).

- **위성 작전 모드**(`assets/mt-satellite-ops.js`, `usa-command.html` 끝 스크립트 한 줄): 관제실 오른쪽 위 "🛰 위성 작전" 또는 주소 `usa-command.html?ops=chips`(녹화 모드로 바로: `?ops=chips&rec=1`). 반도체 사슬 8개 지점(세계 → 미국 의회 → TSMC 애리조나 → 마리코파 카운티 일자리 → TSMC 신주 → 이천 → 의원 거래 → 완료)을 실제 위성 확대로 자동비행, 지점마다 수집 데이터로 만든 설명(타자 효과, 선택 시 한국어 음성), 조종석 HUD(좌표·고도·T+시간), 조준선. 조종: ◀ ▶ 버튼·스페이스/화살표, P 일시정지, WASD 이동, Q/E 줌, H 계기판, R 녹화 모드(사이트 UI 숨김, 지도 출처 표기는 유지), Esc 종료. 사용자가 휠·드래그·핀치하면 자동비행이 멈추고 MANUAL. 좌표 근거: 의회(기존 미션), TSMC 애리조나(위키백과, 약 1km), TSMC 12A(위키백과), 마리코파(인구조사국), 이천(도시 좌표 — 공장 위치 아님, 화면에 표시). 실제 위성 사진은 작업 환경에서 Esri가 막혀 가짜 타일로만 확인 → 실제 폰에서 TSMC 애리조나 z15·신주 z16 화면 확인 필요. 홍보 영상 녹화 시 Esri 지도 출처 표기가 보이게 둘 것.

## 5. 이 세션이 끝낸 일
- **PR #85 (main 병합됨):** 미국 관제실 지도에서 미션 비행 중 사용자가 줌(버튼·휠·더블클릭·핀치·키보드)하면 비행이 끝날 때 z13으로 되돌아가던 오류 수정(`assets/mt-command-ui.js`의 `userTookZoom`). 한국 엔진(`polgame.js` WORLD)처럼 위도 -60~78로 이동 범위 제한(경도 ±540, 날짜변경선 통과 유지).
- 테스트: `tests/mt-zoom-browser.cjs`(실제 Chromium, 외부 타일 차단 상태에서 위성 전환·줌 버튼·경계·비행 중 줌 검사), `command-check.yml` 브라우저 단계에 포함. `tests/usa-map-smoke.test.cjs`에 계약 테스트 추가.
- **확인 못 한 것:** 실제 Esri 위성 사진(작업 환경에서 Esri 접속 403). 미국 지도는 위성 최대 줌이 18이라 시골 고배율에서 "Map data not yet available" 타일이 보일 수 있음(한국은 11로 제한) — 실기기 확인 필요. iOS 실기기 미확인.

## 5-1. 역할 분담 제안 (2026-10-28 운영자와 합의 중)
- **그록봇: 화면·지도 담당** — `usa-command.html`, `national.html`, `assets/mt-market-board.js`, CSS, 지도 레이어 표시(카운티 일자리 점, 나라별 금리·GDP 라벨 등), 모바일 배치, GitHub Actions 실패 감시.
- **Claude / GPT: 수집기·데이터 담당** — `scripts/collect-market-factors.mjs`, `scripts/market-reference-index.mjs`, `data/market/`.
- **다른 Claude 세션 영역** — `collector/world/`, `data/laws/`, `data/markets/`, `assets/mt-world-flow.js`.
- 같은 파일을 같은 날 두 AI가 고치지 않는다.

## 6. 작업 환경 요령
- 이 저장소는 파일이 6만 개 이상이라 `git clone --depth 1` 권장. 얕은 클론은 `main`만 받아오므로 새 브랜치를 추적하려면 `git config --add remote.origin.fetch '+refs/heads/<브랜치>:refs/remotes/origin/<브랜치>'`.
- Claude Code 원격 환경에서는 `gh pr create`(GraphQL)가 막혀 있어 `gh api repos/91cleaner/money-tracker/pulls --method POST`로 PR을 만들었다.
- 브라우저 테스트는 외부 요청을 막고 지도 타일은 가짜 PNG로 대체하는 방식이 안정적이다(`tests/mt-zoom-browser.cjs`, `tests/mt-browser-smoke.cjs` 참고). CI 브라우저 작업은 `ubuntu-24.04` 고정(playwright 1.56).
- main은 수집 봇과 다른 세션이 수시로 커밋한다. 작업 전후로 `git pull`, PR 전에 충돌 확인.
- `data/search/index.json`은 봇이 자주 다시 만든다. PR이 충돌하면 브랜치를 main 위로 rebase하고 `git show origin/main:data/search/index.json > data/search/index.json && node scripts/build-local-index.mjs`로 다시 만든 뒤 계속하면 된다.
- GitHub Actions 로그와 아티팩트 다운로드는 이 작업 환경에서 막혀 있다. 그래서 수집기는 결과를 `::notice::RESULTS`/`::notice::SAMPLE` 주석으로 남기고, check-run annotations API로 읽는다(`market-factors.yml`은 브랜치 push 때 수집만 시험).

- **"같은 기간 있었던 일" 카드 + 검색 의도별 첫 화면 (#201)**: `assets/mt-event-context.js`(로직·화면), 문구 표는 `assets/i18n.js`의 `ctx`(KO/EN). 회사 페이지 차트 핀을 누르면 그 날짜 전후 7일의 다른 정책·발표와 과거 같은 종류 발표 때 그 종목 평균 수익률(표본 수 포함)이 붙는다. 관제실(`world-intelligence/index.html`)은 검색어가 이름만이면 전체 경로 투어, 왜·주가·떨어/올라 포함이면 "최근 주가 설명"(경로 투어는 "전체 경로 보기" 버튼 뒤), 관세·수출통제·제재·232조 같은 주제어면 그 유형만 걸러 시작. 규칙: `MTEventContext.intent()`. 테스트: `tests/event-context.test.cjs`. 실적 발표일은 `scripts/collect-earnings-8k.mjs`(SEC 8-K Item 2.02 → `data/us/earnings.json`)가 만들면 자동으로 붙고, 파일이 없으면 생략. **워크플로 연결은 아직 안 함**(봇 권한으로 .github/workflows 수정 불가) — 운영자가 매일 실행 단계를 추가할 것. 가격 자료가 2025-12-15부터라 과거 표본이 적다(표본 수를 항상 표시).
