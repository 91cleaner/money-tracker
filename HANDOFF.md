# 세금추적단 인수인계 (HANDOFF)

다른 사람(또는 다른 AI)이 이 사이트를 이어서 고칠 때 먼저 읽는 문서. 2026-10-25 기준.

- 사이트: https://91cleaner.github.io/money-tracker/ (GitHub Pages, `main` 브랜치 그대로 배포)
- 운영자 X: @KORROOFTOPARODY ("청소부"). 후원은 X 구독 링크만 씀(계좌번호·실명 노출 금지).

## 지켜야 할 원칙 (가장 중요)
1. **중립**: 공식 공개 기록만 그대로 보여 준다. "반미·친중" 같은 성향 딱지, "문제 발언" 골라 싣기, 잘잘못 판단 문구 금지. 문구는 "데이터상 이상 징후 / 공개 기록일 뿐 잘잘못 아님".
2. **원문 링크만**: 범죄 경력·재산 숫자처럼 옮겨 적다 틀리면 문제 되는 것은 옮기지 말고 원문(선관위, 공직윤리시스템, 국회공보) 링크만.
3. **개인정보**: 의원·대통령 외 개인 이름 금지. 개인사업자 이름은 가린다(`collector/mask_names.py`, `privacy.py`).
4. **비밀값**: API 키는 GitHub Secrets에만. 코드·채팅·로그에 키 값을 절대 남기지 않는다.
5. 미국 페이지(`us.html`)는 **전부 영어**. 한국 페이지는 한국어.

## 올리는 방법
- `main`에 직접 올리지 말고: 브랜치 → PR → squash merge → Pages 자동 배포(1~2분).
- 바꾼 JS/CSS는 HTML의 `?v=날짜시각` 숫자를 올려야 사람들 폰에 바로 반영됨.
- 수집 결과(`data/`)는 각 워크플로가 직접 `main`에 커밋한다. 로컬 작업 중에 `git reset --hard origin/main` 하면 안 올린 수정이 날아가니 조심.

## 화면(파일)
| 파일 | 내용 |
|---|---|
| `index.html` | 홈. 맨 위 `assets/hometrack.js`(🇰🇷 국회 추적실·🇺🇸 Congress 입구), `today.js`(오늘의 영수증), 지도(`#dive`) |
| `national.html` + `assets/polgame.js` | 🇰🇷 국회 추적실(게임형 지도). 도구: 의원·출장·레이더·순위(정당 포함)·대통령·찾기, 아무나 추적, 팔로우, 1:1 비교, 확대 시 위성 사진 |
| `us.html` + `assets/usgame.js`, `usgame.css` | 🇺🇸 Congress Tracker(영어). 도구: Members·Trades·Party·Radar·Rank·Find, Track anyone, Compare |
| `assets/usdash.js` | 미국 지도 아래 대시보드(많이 산/판 종목, 월별, 45일 넘긴 신고, 전체 의원 표, D vs R) |
| `nps.html` + `assets/nps.js`, `nps-me.js` | 국민연금 주식(13F·국내 지분·계산기·DART 대량보유) |
| `bid.html` + `assets/bidpage.js` | 우리 동네 입찰(열린 공고·낙찰률) |
| `assets/nav.js` | 위·아래 탭: 🇰🇷 국회 · 🇺🇸 Congress · 우리 동네 · 국민연금 · 뉴스 · 더보기 |
| `assets/visits.js` | 방문자 수(GoatCounter) + 감사 문구 + X 구독 링크 |
| `sw.js`, `manifest.webmanifest`, `assets/pwa.js` | 홈 화면 앱(network-first) |

## 수집기와 자동 실행 (`.github/workflows/`)
| 워크플로 | 언제 | 하는 일 |
|---|---|---|
| `collect.yml` | 매시간 | 나라장터 계약(`collector/collect.py`) → 검증(`validate.py`) → 단위 테스트 → 각 섹션 |
| `sections.yml` | 정기 | 섹션별 자료(`collector/sections/`) |
| `open_bids.yml` | 매일 2번 | 지금 열린 입찰공고 |
| `nps.yml` | 매일·평일 | 국민연금(13F, 국내 지분, DART 대량보유, 공유 그림) |
| `national.yml` | 매일 06:23 KST | 국회: 의원·출장(`national/collect.py`) → 빈 응답 막기(`check.py`) → 지도 위치(`geo.py`) → 공식 기록(`votes.py`: 외교·안보 표결, 대표 발의 전체, 징계안) → 표결 참여(`votes_all.py`, 새 안건만 이어서) → 프로필(`bio.py`) |
| `us.yml` | 매일 21:41 KST | 미국: 의원(`us/members.py`) → 주식 거래(`us/trades.py`, 하원 PTR PDF 읽기) → 발의 법안(`us/bills.py`, Congress.gov) |
| `probe.yml` | 수동 | `votes_all.py`·`votes.py`를 따로 돌릴 때 |

- Actions 로그는 이 환경에서 못 읽을 수 있음 → 실패 이유는 `::warning::` 주석(check-runs annotations)으로 남기게 해 둠.

## 비밀값 이름 (값은 GitHub Secrets에만)
`DATA_GO_KR_KEY`(공공데이터포털), `ASSEMBLY_KEY`(열린국회정보), `LOFIN_KEY`, `DART_API_KEY`(아직 미등록일 수 있음), 미국 법안 키는 **`ONGRESS_API_KEY`**로 저장돼 있음(맨 앞 C 빠짐 — 워크플로가 `CONGRESS_API_KEY`·`ONGRESS_API_KEY` 둘 다 읽게 해 둠).

## 주요 자료 파일
- 국회: `data/national/members.json`(의원·출장), `security.json`(외교·안보 표결·대표 발의 요약·징계안), `bills/<의원코드>.json`(대표 발의 전체), `vote_rate.json`(본회의 표결 참여, 의원코드 → [찬성,반대,기권,불참]), `bio.json`(약력·학력·출생연도), `geo.json`, `president.json`
- 미국: `data/us/members.json`, `trades.json`(d=거래일, filed=신고일, 45일 넘김 계산), `bills.json` + `bills/<bioguide>.json`

## 남은 일
1. **상원 주식 거래**: 상원 eFD(efdsearch.senate.gov)가 GitHub Actions 접속을 "Access Denied"로 막음. 다른 출처 필요. 페이지에는 "Senate filings coming soon"이라고 써 둠.
2. **한국 본회의 표결 참여**: 1,701건 중 일부만 모음. `national.yml`이 매일 25분씩 이어서 채움(빨리 하려면 `probe.yml` 수동 실행).
3. **공유 그림 카드**: 의원 파일·1:1 비교를 X에 올리면 그림으로 뜨게.
4. **의회 vs S&P 500 수익률**(주가 자료 필요).
5. **일본 국회**(일본어 화면, 국회 회의록 발언 검색 API 활용) — 미국 마무리 뒤.
6. 도메인 구매 뒤 광고·개인정보처리방침 페이지.
