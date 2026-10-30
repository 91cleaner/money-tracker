## 제품 방향

방문자는 관제실 대장. 정보와 주가 흐름을 추적하고 인사이트를 얻고, 게임처럼 구현해 자꾸 다시 추적하게 만드는 중독성이 목표. 단, 공식 데이터·중립 표현·투자 조언 없음은 그대로.

작업 전 docs/AI-ROLES.md 먼저 읽기

# MONEY TRACKER 인수인계 (HANDOFF)

다른 사람(또는 다른 AI)이 이 사이트를 이어서 고칠 때 먼저 읽는 문서. 2026-10-28 작성, 2026-10-31 진입점·역할·배포 위험 정정.

> **최신 작업 규칙 우선:** [`docs/AI-ROLES.md`](docs/AI-ROLES.md)가 현재 역할 분담의 기준이다. 클로드=세계지도/UI, 실장=수집기·`data/`, GPT=문서·문구·제2 검토. 동일 파일 동시 수정 금지. **브랜치 → PR → 사용자 승인 전 병합 금지.** 아래의 과거 작업 이력은 현재 담당 권한을 뜻하지 않는다.
>
> **공개 상태:** GitHub 저장소와 GitHub Pages는 `public`이다(2026-10-31 GitHub 확인). 미국 관제실/JS/공개 JSON을 운영자 전용으로 보호했다고 주장하면 안 된다. 생성형 AI 분석·실시간 체결 데이터는 **미연결**. House PTR은 지연 공개 신고이며 실거래 체결 확인이 아니다.

- 사이트: https://91cleaner.github.io/money-tracker/ (GitHub Pages, 공개 저장소 `main`)
- 운영자 X: @KORROOFTOPARODY ("청소부"). 후원은 X 구독 링크만 씀(계좌번호·실명 노출 금지).

> **세계 관제실 확장(전 업종·요인·일정·유럽/중국·연결) 작업을 이어받는다면 [`docs/HANDOFF-GLOBAL-BOARD.md`](docs/HANDOFF-GLOBAL-BOARD.md)를 먼저 읽을 것.** (2026-10-28)

## 지켜야 할 원칙 (가장 중요)
1. **중립**: 공식 공개 기록만 그대로 보여 준다. "반미·친중" 같은 성향 딱지, "문제 발언" 골라 싣기, 잘잘못 판단 문구 금지. 문구는 "데이터상 이상 징후 / 공개 기록일 뿐 잘잘못 아님".
2. **원문 링크만**: 범죄 경력·재산 숫자처럼 옮겨 적다 틀리면 문제 되는 것은 옮기지 말고 원문(선관위, 공직윤리시스템, 국회공보) 링크만.
3. **개인정보**: 의원·대통령 외 개인 이름 금지. 개인사업자·행사 출연자 이름은 가린다(수집: `collector/mask_names.py`, `privacy.py` / 화면: `assets/mask.js`).
4. **비밀값**: API 키는 GitHub Secrets에만. 코드·채팅·로그에 키 값을 절대 남기지 않는다.
5. **2026-10-28 사장님 결정: 미국 의원 주식 거래 공개. 원문 링크·신고 기준·중립 문구 필수.** 데이터는 `data/us/trades.json`만 사용(house-ptr-candidates 금지).

## 올리는 방법
- `main`에 직접 올리지 말고: 브랜치 → PR → squash merge. (10/25~27에는 PR 없이 직접 올린 커밋이 많았음)
- 바꾼 JS/CSS는 HTML의 `?v=날짜시각` 숫자를 올려야 사람들 폰에 바로 반영됨.
- 수집 결과(`data/`)는 각 워크플로가 직접 `main`에 커밋한다. 로컬에서 `git reset --hard origin/main` 하면 안 올린 수정이 날아가니 조심.
- **공개 배포 보안 게이트:** GitHub 기본 `pages build and deployment`와 별도 `deploy-pages.yml`의 실행 기록이 공존한다. 기본 Pages 배포 성공만으로 `scripts/prepare-public-pages.py` 허용 목록이 적용되었다고 **판정하지 않는다**. Settings → Pages → Source 및 실제 배포 아티팩트/공개 URL을 확인하고, 허용 목록을 거치지 않는 배포 경로가 있다면 운영자가 차단해야 한다. 공개 금지 파일이 HTTP 200/206으로 제공되지 않는지 배포 후 검사한다. `.geojson`·`.csv` 등 허용 목록 누락은 지도 누락도 일으킬 수 있다. **배포 성공 ≠ 접근 통제 성공**.

## 화면(파일)
| 파일 | 내용 |
|---|---|
| `index.html` | **미국 우선 진입 리다이렉트**: `world-intelligence/?lang=en`으로 이동(명시적 `lang`·쿼리·해시 보존). 국가 선택 화면 아님. |
| `search.html` + `assets/se-core.js`(로직), `assets/se.js`(화면) | **통합 검색**: 계약·업체·기관·시·의원·법안·국민연금 종목을 저장된 기록으로 검색, 돈을 낸 시/기관 → 받은 업체 흐름 그림, 주별 금액, 나라장터 원문 링크. 서버·AI 없음 |
| `contracts.html` | 지역 계약 홈. 맨 위 `assets/hometrack.js`(검색창·🇰🇷 국회 추적실·🇺🇸 미국 관제실 입구), `today.js`(오늘의 영수증), 지도 |
| `national.html` + `assets/polgame.js` | 🇰🇷 국회 추적실(게임형 지도). 의원·출장·레이더·순위·대통령·찾기, 팔로우, 1:1 비교, 확대 시 위성 사진. `?mp=이름`으로 의원 바로 열기 |
| `world-intelligence/index.html` | **현재 미국/세계지도 관제실 본 화면**. 질문→후보 선택→지도 추적, 지연 공개 자료. AI 분석·실시간 체결 미연결. | 
| `us.html` | `world-intelligence/`로 리다이렉트. |
| `usa-command.html` + `assets/mt-*.js` | 기존 미국 관제실 화면/자산. **현재 기본 진입점이 아니므로** 변경 전 실제 참조 경로 확인. |
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
1. **미국 비공개(P0)**: 저장소와 Pages 모두 공개. 운영자만 보게 하려면 인증된 별도 호스팅과 공개 Pages의 미국 경로 차단이 필요함. `docs/US_PRIVATE_ACCESS.md`의 익명·인증·기존 URL 접근 테스트 전에는 비공개 완료로 표시 금지.
2. **상원 주식 거래**: 상원 eFD가 GitHub Actions 접속을 막음(403). 다른 출처 필요.
3. **DART 키 등록** → 국민연금 대량보유 공시 칸이 켜짐.
4. **배포 한 가지로 정리**(위 "배포가 두 가지" 참고).
5. 공유 그림 카드, 일본 국회, 도메인·개인정보처리방침 — 미착수.
6. AI 검색(유료 모델)은 일시 중지 상태(`server/worker.mjs` 503). 통합 검색은 AI 없이 저장 데이터로 동작.

## 남들 의견 층 (#268)
- 검색 답 아래 "남들 의견" 상자(`assets/opinions.js`). 우리 데이터와 점선 상자로 분리, "의견이에요, 사실 확인 아님" 표시.
- 계정 목록 `data/opinions/accounts.json`, 임원 발언 대상 `data/opinions/execs.json`. X 글은 봇이 `data/opinions/YYYY-MM-DD.json`(배열)로 올리면 `collector/opinions/build.py`가 검증(스키마·추적 종목만·중복 id 제거·금지어)해서 `data/opinions/index.json`으로 합침. SEC 8-K EX-99·IR RSS 는 `fetch_exec.py` -> `data/opinions/auto/`.
- 워크플로 초안은 `collector/opinions/opinions.yml` (권한 때문에 `.github/workflows/`로 사람이 옮겨야 함). 테스트: `tests/test_opinions.py`, `tests/opinions.test.cjs`.
