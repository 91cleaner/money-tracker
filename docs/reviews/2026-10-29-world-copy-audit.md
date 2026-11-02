# World command copy audit — 2026-10-29

> **검토 전용 / 미적용.** 이 문서는 화면 소유자(클로드)가 적용할 정확한 문구 교체안이다. 지도·UI·수집기·`data/`는 수정하지 않았다. 검토 대상: `main`의 `world-intelligence/index.html` (검토 시 blob `e10339c9`), `world-intelligence/us-signals.html` (blob `08524c3c`). 현재 검색 선택 오류는 [#174](https://github.com/91cleaner/money-tracker/issues/174)에서 별도로 추적한다.

## P0 — 연결/분석/실시간 상태 오인 방지

| 위치 | 현재 화면 문구 (원문) | 제안 문구 | 이유 |
|---|---|---|---|
| `world-intelligence/index.html:215` | `TARGET ACQUIRED · ANALYSIS` | `ROUTE OPEN · SOURCE SUMMARY` | AI 분석기가 미연결인데 분석이 실행된 것처럼 보인다. 지도 이동은 공개 기록 탐색이지 실시간 표적 획득이 아니다. |
| `world-intelligence/index.html:235` | `GEOINT // LIVE VIEWPORT` | `MAP VIEW // NOT LIVE INTELLIGENCE` | 지도 타일 표시와 실시간 정보 수집을 구별한다. |
| `world-intelligence/index.html:225` | `MAP LINK ACTIVE` | `MAP DISPLAY READY` | 지도 표시 가능과 데이터 연결 성공을 혼동하지 않도록 한다. |
| `world-intelligence/index.html:207` | `AI OFFLINE · LIVE TRADES OFFLINE` | `AI NOT CONNECTED · LIVE TRADE FEED NOT CONNECTED` | 단순 일시적 장애(offline)와 기능 미연결(not connected)을 구별한다. |
| `world-intelligence/index.html:225` | `DEMO ROUTES / NO LIVE DATA` | `GUIDED ROUTES · NO LIVE TRADE FEED` | 시연 경로가 존재할 수 있지만 과거 신고·정책 기록까지 전부 가짜 데이터라는 인상을 피한다. |
| `world-intelligence/us-signals.html:1` | `MONEY TRACKER · US SIGNAL LAB` | `MONEY TRACKER · US PUBLIC RECORDS LAB` | 투자 신호로 오해될 수 있는 Signal을 공식 공개 기록 탐색으로 명확히 한다. |

## P1 — 영문 UI 가독성 및 브랜드 일관성

| 위치 | 현재 문구 | 제안 문구 | 이유 |
|---|---|---|---|
| `world-intelligence/index.html:119` | `GLOBAL INTELLIGENCE / OPERATIONS` | `PUBLIC-SOURCE INTELLIGENCE / OPERATIONS` | 공개 출처 기반 서비스임을 드러내면서 관제실 톤은 유지한다. |
| `world-intelligence/index.html:207` | `OSINT / OPERATIONS` | `OSINT / MAP EXPLORER` | 조작 가능한 탐색 UI임을 명확히 한다. |
| `world-intelligence/index.html:207,215` | `STANDBY · WORLD VIEW` | `READY · WORLD MAP` | 일반 이용자에게 이해하기 쉬운 상태 문구. |
| `world-intelligence/index.html:225` | `OPERATIONAL OVERVIEW` | `SOURCE OVERVIEW` | 운용 중인 정보 작전보다 기록 개요라는 뜻을 명확히 한다. |
| `world-intelligence/index.html:3-7` | `og:site_name=세금추적단` | `og:site_name=MONEY TRACKER` | 구 브랜드가 공유 카드에 남아 있다. |

## P0 — 한국어 신고 데이터 정확성 (별도 수정 권고)

| 위치 | 현재 문구 | 제안 문구 | 이유 |
|---|---|---|---|
| `world-intelligence/index.html:361` | `거래일→신고일 최대 45일 차이 가능` | `공개 신고 기록 · 거래일과 신고일은 다를 수 있음 · 기한 초과 신고 가능` | 45일은 모든 실제 신고 간격의 상한이 아니다. 신고 기한 규칙과 실제 신고 지연을 혼동하지 않도록 한다. |
| `world-intelligence/index.html:193-196` | `아직 데이터 없음` (검색 불일치 시) | `일치하는 검색 결과 없음 · 전체 자료의 부재를 뜻하지 않음` | 검색 색인 미일치가 원자료 부재를 뜻하지 않는다. 색인 로딩 실패는 별도 오류로 표시해야 한다. |
| `world-intelligence/index.html:382` | `눈에 띄는 점 (기준 충족 시만 표시)` | `자료상 확인 항목 (표시 기준 충족)` | 자동 강조를 매매 추천·위험 판정으로 오인하지 않도록 한다. |

## UI 담당자 적용·검증 체크리스트

1. `main` 최신 파일과 대조해 해당 문구가 아직 있는지 확인한 뒤 적용한다. UI 수정은 클로드 담당이며 이 문서 자체는 변경을 수행하지 않는다.
2. **AI 미연결**, **실시간 체결 피드 미연결**, **과거 공개 신고 기록 존재 여부**, **지도 타일 표시 상태**를 네 개의 독립 상태로 표시한다. 어떤 한 상태의 성공도 다른 상태의 연결을 의미하지 않는다.
3. `#174` 회귀: 검색어가 종목과 매칭돼도 Enter 시 지도 이동 0회 → 후보 선택 클릭 시 이동 1회. 실패/빈 결과/미연결을 구별한다.
4. PC와 모바일에서 영어/한국어 토글 후 HUD, 후보 패널, 브리핑, 공유 미리보기까지 동일 문구가 적용되는지 확인한다.
5. 자동화 테스트는 원문 문구를 문자열로 기대할 수 있으므로 테스트 기대값을 함께 갱신한다. PR CI와 Pages 배포 검증은 별도이며, 배포 전 성공을 주장하지 않는다.
6. 실제 서비스의 **공개 저장소·legacy Pages 노출 위험**은 이 문서로 해결되지 않는다. [#213](https://github.com/91cleaner/money-tracker/pull/213), [#214](https://github.com/91cleaner/money-tracker/pull/214) 후속 조치가 우선이다.

**자료 성격:** 문구·정확성 독립 검토. 법률 의견이나 투자 조언이 아니며, 공식 원문/실거래 확인을 새로 수행한 결과가 아니다.
