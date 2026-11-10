# PR #273 회귀 검토 — 기간 정확성 및 보안 CI 실패 (2026-10-29 KST)

범위: `claude/issue-271-20261029-1040` (PR #273, head `fcae3f7181c8c2b964dca98df9d7622b3f3424ed`). 화면/데이터/수집기 코드는 변경하지 않았다. `docs/AI-ROLES.md`에 따라 클로드(UI)와 실장(수집기)에게 재현 조건을 전달하는 제2 검토다.

## P1 — '같은 기간' 표시와 실제 3개월 수익률 계산 구간 불일치

- `assets/firstscreen.js`의 `windowOf()`는 `asof - PERIOD_DAYS['3m']`으로 표시 구간을 만든다. PR에서 3m를 90일로 변경했다.
- 현재 `data/answers/NVDA.json`의 `asof=2026-10-28`, `periods['3m'].from=2026-07-29`, `to=2026-10-28`, `ret=13.35`다.
- 하지만 2026-10-28에서 90일을 빼면 **2026-07-30**이다. 3개월 수익률이 계산된 시작일(7/29)과 화면의 '같은 기간' 시작일(7/30)이 다르다. `tests/firstscreen-followup.test.cjs`는 표시 창의 정규식만 확인하므로 실제 `pd.from/to`와의 일치를 검증하지 않는다.
- **수락 조건:** 주가 카드에 `pd.from`/`pd.to`를 그대로 표시하거나, 사건/거래와 진짜 같은 구간으로 주가를 재계산한다. 날짜가 다르면 '같은 기간' 문구를 쓰지 않는다. NVDA 3m `doc.window`와 `pack.periods['3m']`의 경계 일치 회귀 테스트를 추가한다.

## P1 — 기준일이 없으면 '최근 N일'에 전체 과거 기록 포함

- `asofOf()`가 `null`이면 `windowOf()`는 `{from:null,to:null,label:'최근 30일 기준'}`을 반환한다.
- `inWin(date,w)`는 `!w.to`일 때 **날짜가 있는 모든 기록을 true**로 처리한다. 따라서 파일에 기준일이 없거나 필드가 바뀐 경우 과거 전체 거래/사건을 '최근 30일'로 잘못 표시할 수 있다.
- **수락 조건:** 기준일이 없거나 ISO 날짜가 잘못됐을 때 날짜 범위 집계를 중단하고 '기간 기준일 확인 불가'를 표시한다. 2025년 기록만 있는 테스트 데이터와 `asof=null`을 넣어 2026년 최근 30일로 집계되지 않는 회귀 테스트를 추가한다.

## P1 — PR #273 보안·리서치 CI 실패 (병합 차단)

- [Actions run #40861066627](https://github.com/91cleaner/money-tracker/actions/runs/40861066627)에서 `MONEY TRACKER security and research lab checks` 실패. 133개 Python 테스트 중 1개 import 오류.
- 실패: `tests/test_opinions.py`가 `import build as B` 및 `import fetch_exec as F`을 사용하고, `collector/opinions/fetch_exec.py` 역시 `import build as B`을 사용한다. `extract_exec_quote(..., limit=B.MAX_TEXT)` 정의 시 `AttributeError: module 'build' has no attribute 'MAX_TEXT'` 발생.
- `collector/opinions/build.py` 원본에는 `MAX_TEXT=280`이 **존재**한다. 그러므로 상수 누락으로 단정하지 말고 전체 테스트 탐색 중 다른 `build` 모듈이 `sys.modules['build']`에 먼저 등록되는 충돌을 우선 점검한다.
- **수락 조건:** 의견 수집기 모듈을 고유한 패키지 경로로 import하도록 정리하고, `python -m unittest discover -s tests` 전체 실행에서 `test_opinions` import 성공을 확인한다. 단독 실행과 전체 탐색을 모두 테스트한다. CI의 보안·리서치 작업이 성공하기 전에는 배포 준비 완료로 표시하지 않는다.

## 검증 범위 및 역할

GitHub API로 PR diff, `assets/firstscreen.js`, `tests/firstscreen-followup.test.cjs`, `data/answers/NVDA.json`, `collector/opinions/build.py`, `fetch_exec.py`, `test_opinions.py` 및 CI job 로그를 직접 확인했다. 날짜 차이는 UTC 달력 산술로 확인했다. 코드 실행/브라우저/운영 배포는 하지 않았으며 이 문서는 **오류 수정이 아니다**.

클로드: 첫 두 항목의 UI·기간 계산·테스트. 실장: opinions 모듈 import와 CI 복구. PR #273은 이 세 가지 검증을 통과한 뒤 병합 검토.

**제품 상태:** 저장소 `public`; 기존 Pages 레거시 노출 위험 별도 미해결. AI 분석 미연결 · 실시간 체결 데이터 미연결. 하원 PTR은 사후 공개 신고이며 실시간 체결 검증 자료가 아니다.
