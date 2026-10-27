# 세금추적단 인수인계 (HANDOFF)

다른 사람(또는 다른 AI)이 이 사이트를 이어서 고칠 때 먼저 읽는 문서. 2026-10-28 기준(10-25판을 현재 상태로 고침).

- 사이트: https://91cleaner.github.io/money-tracker/ (GitHub Pages, 공개 저장소 `main`)
- 운영자 X: @KORROOFTOPARODY ("청소부"). 후원은 X 구독 링크만 씀(계좌번호·실명 노출 금지).

## 지켜야 할 원칙 (가장 중요)
1. **중립**: 공식 공개 기록만 그대로 보여 준다. "반미·친중" 같은 성향 딱지, "문제 발언" 골라 싣기, 잘잘못 판단 문구 금지. 문구는 "데이터상 이상 징후 / 공개 기록일 뿐 잘잘못 아님".
2. **원문 링크만**: 범죄 경력·재산 숫자처럼 옮겨 적다 틀리면 문제 되는 것은 옮기지 말고 원문(선관위, 공직윤리시스템, 국회공보) 링크만.
3. **개인정보**: 의원·대통령 외 개인 이름 금지. 개인사업자·행사 출연자 이름은 가린다(수집: `collector/mask_names.py`, `privacy.py` / 화면: `assets/mask.js`).
4. **비밀값**: API 키는 GitHub Secrets에만. 코드·채팅·로그에 키 값을 절대 남기지 않는다.
5. **미국 의원 주식 거래는 공개 화면에서 내림**(2026-10-26, 84ccbc8 "기기 제한 호스팅 전까지"). 되살리거나 검색 색인에 넣지 말 것. 단, GitHub Pages라 파일 주소를 알면 누구나 열 수 있음(`docs/US_PRIVATE_ACCESS.md`) — 진짜 비공개는 다른 호스팅 필요.

## 올리는 방법
- `main`에 직접 올리지 말고: 브랜치 → PR → squash merge. (10/25~27에는 PR 없이 직접 올린 커밋이 많았음)
- 바꾼 JS/CSS는 HTML의 `?v=날짜시각` 숫자를 올려야 사람들 폰에 바로 반영됨.
- 수집 결과(`data/`)는 각 워크플로가 직접 `main`에 커밋한다. 로컬에서 `git reset --hard origin/main` 하면 안 올린 수정이 날아가니 조심.
- **배포가 두 가지 동시에 돈다**: GitHub 기본 "pages build and deployment"(봇 데이터 커밋도 배포) + `deploy-pages.yml`("Deploy MONEY TRACKER Pages", 사람 push 때만, `scripts/prepare-public-pages.py` 허용 목록). 나중에 끝난 쪽이 이긴다. 새 확장자·폴더를 쓰면 허용 목록에도 넣을 것(10/28 `.geojson`·`.csv` 누락으로 국회 지도 경계선이 사라지던 문제 수정). 어느 쪽을 남길지는 Settings → Pages → Source에서 운영자가 정할 일(봇 커밋은 기본 배포만 반영됨).

## 화면(파일)
| 파일 | 내용 |
|---|---|
| `index.html` | 첫 화면(국가 선택): 🔍 통합 검색, 내 지역, 🇰🇷 대한민국(national), 🇺🇸 미국(usa-command), 지역 계약·예산(contracts) |
| `search.html` + `assets/se-core.js`(로직), `assets/se.js`(화면) | **통합 검색**: 계약·업체·기관·시·의원·법안·국민연금 종목을 저장된 기록으로 검색, 돈을 낸 시/기관 → 받은 업체 흐름 그림, 주별 금액, 나라장터 원문 링크. 서버·AI 없음 |
| `contracts.html` | 지역 계약 홈. 맨 위 `assets/hometrack.js`(검색창·🇰🇷 국회 추적실·🇺🇸 미국 관제실 입구), `today.js`(오늘의 영수증), 지도 |
| `national.html` + `assets/polgame.js` | 🇰🇷 국회 추적실(게임형 지도). 의원·출장·레이더·순위·대통령·찾기, 팔로우, 1:1 비교, 확대 시 위성 사진. `?mp=이름`으로 의원 바로 열기 |
| `usa-command.html` + `assets/mt-*.js` | 🇺🇸 미국 관제실 미리보기(한국어, AI·실시간 시세 OFF). `us.html`과 `world-intelligence/index.html`은 여기로 넘기기 |
| `nps.html`, `bid.html`, `news.html`, `rank.html`, `spend.html`, `vendor.html`(`?v=업체ID`), `city.html`(`?c=시`) | 국민연금·입찰·뉴스·순위·업체·시 |
| `assets/nav.js` | 아래(폰)·위(PC) 탭: 🇰🇷 국회 · 🇺🇸 USA · 우리 동네 · 국민연금 · 뉴스 · 더보기(🔍 통합 검색 포함) |
| `sw.js`, `manifest.webmanifest`, `assets/pwa.js` | 홈 화면 앱(network-first) |

## 수집기와 자동 실행 (`.github/workflows/`)
| 워크플로 | 언제 | 하는 일 |
|---|---|---|
| `collect.yml` | 매시 17분 | 나라장터 계약 → 검증 게이트 → 단위 테스트 |
| `search-index.yml` | 매시 37분 | `collector/search/build_se.py` → `data/search/se/`(통합 검색 색인) → `tests/test_search_engine.js` 통과 시에만 커밋 |
| `sections.yml` | 매시 47분 | 섹션별 자료 |
| `open_bids.yml`, `nps.yml` | 매일 | 입찰공고, 국민연금 |
| `national.yml` | 매일 06:23 KST | 국회: 의원·출장·표결·발의·징계안·프로필 |
| `us.yml` | 매일 21:41 KST | 미국 의원·하원 PTR·가격·법안(`bills.py`는 16분 예산, 오래된 의원부터) |
| `us-data.yml` | 정기 | FRED 경제지표(`data/us-macro.json`), 하원 신고 목록, PTR 후보(`data/us/house-ptr-candidates.json`) |
| `command-check.yml`, `usa-map-smoke.yml`, `command-smoke.yml` | push | 미국 관제실 지도·검색 점검(배포 후 실사이트 확인 포함) |
| `verify-world-intelligence.yml`, `world-command-smoke.yml`, `sync-command.yml`, `world-intelligence-health.yml` | push/매일 | 옛 세계지도는 퇴역(넘기기)으로 확인, 비공개 Worker 스냅숏은 건드리지 않음, PTR 후보·대조 기록 검사 |
| `probe.yml` | 수동 | `votes_all.py`·`votes.py` 따로 돌릴 때 |

- Actions 로그는 이 환경에서 못 읽을 수 있음 → 실패 이유는 `::warning::`/`::error::` 주석(check-runs annotations)으로 남기게 해 둠.
- Cloudflare "Workers Builds"는 PR 브랜치에서는 늘 실패하고 `main`에서는 성공함(브랜치 미리보기 설정 문제, PR 내용과 무관).

## 비밀값 이름 (값은 GitHub Secrets에만)
`DATA_GO_KR_KEY`(공공데이터포털), `ASSEMBLY_KEY`(열린국회정보), `LOFIN_KEY`, 미국 법안 키는 **`ONGRESS_API_KEY`**로 저장돼 있음(맨 앞 C 빠짐 — 워크플로가 둘 다 읽음). 아직 없음: `DART_API_KEY`(국민연금 대량보유 공시 — 없으면 `nps.html` 해당 칸 숨김, `studio.html`은 건너뜀), 선택: `FRED_API_KEY`(FRED CSV가 막힐 때 공식 API).

## 주요 자료 파일
- 계약: `data/city/<시>.json`(행·산하기관), `data/vendor/<업체ID>.json`, `data/index.json`(금액 기준 `amount_basis`), `data/flows.json`
- 검색 색인: `data/search/se/`(core·vendors·bills·월별 ct-YYYY-MM). 직접 고치지 말고 `build_se.py`로 다시 만들 것
- 국회: `data/national/members.json`, `security.json`, `bills/<의원코드>.json`, `vote_rate.json`, `bio.json`, `countries-110m.geojson`
- 미국: `data/us/members.json`, `trades.json`(공시 원장, `trades` 배열), `house-ptr-candidates.json`(기계 추출 후보, `records`), `ptr-crosschecks.json`, `bills.json`(+`fetched`)

## 남은 일
1. **미국 비공개**: 운영자만 보게 하려면 GitHub Pages 밖(로그인 있는 호스팅)으로 옮겨야 함. 지금은 화면에서만 내림.
2. **상원 주식 거래**: 상원 eFD가 GitHub Actions 접속을 막음(403). 다른 출처 필요.
3. **DART 키 등록** → 국민연금 대량보유 공시 칸이 켜짐.
4. **배포 한 가지로 정리**(위 "배포가 두 가지" 참고).
5. 공유 그림 카드, 일본 국회, 도메인·개인정보처리방침 — 미착수.
6. AI 검색(유료 모델)은 일시 중지 상태(`server/worker.mjs` 503). 통합 검색은 AI 없이 저장 데이터로 동작.
