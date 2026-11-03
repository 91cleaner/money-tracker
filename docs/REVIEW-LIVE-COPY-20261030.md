# P1 검토: 관제실의 '실시간' 오인 문구 및 날짜 기준 (2026-10-30 KST)

## 범위·결론
- 대상: `main`의 [world-intelligence/index.html](../world-intelligence/index.html) (GitHub에서 2026-10-30 16:54 KST 이후 원문 재조회).
- **현재 자료는 공개 공시·수집 기록을 지도에서 재생하는 기능**이지, 실시간 거래 체결이나 실시간 위성·관제 정보가 아니다. 생성형 AI 분석 및 실시간 체결 데이터는 **미연결**이다.
- 화면 소유자는 **클로드**, 수집 데이터 소유자는 **실장**이다. 이 문서는 GPT의 제2 검토와 정확한 대체 문구 제안만 포함한다. 화면·데이터·수집기 코드를 수정하지 않았으며, 운영 배포 완료를 뜻하지 않는다.
- 기존 루트 `index.html` 문구 개선 PR #298과 **별개**로, 아래 문제는 `world-intelligence/index.html`에 남아 있다. PR #350은 `assets/i18n.js`만 변경했으므로 이 파일을 수정하지 않았다.

## 우선 수정 대상 (원문 → 권장 대체 문구)

| 우선 | 위치(현재 main) | 기존 문구 | 권장 대체 문구 | 이유 |
| --- | --- | --- | --- | --- |
| P1 | 5행, `og:description` | `Congressional stock trades, late filings, bills and contracts traced as live routes on one map. Official public records only. Not investment advice.` | `Reported congressional stock transactions, filing dates, bills and contract records explored on one map. Public records; not live executions or investment advice.` | `live routes`는 실시간 거래 추적처럼 보이고 `late filings`는 개별 지연 신고 검증 없이 위반을 암시할 수 있음 |
| P1 | 7행, `twitter:description` | `Congressional stock trades, late filings, bills and contracts traced as live routes on one map. Official public records only. Not investment advice.` | `Reported congressional stock transactions, filing dates, bills and contract records explored on one map. Public records; not live executions or investment advice.` | SNS 미리보기에서도 동일 오해 발생 |
| P1 | 286행, 한국어 `mtRadarLabel` | `지도 실시간 화면` | `공개 기록 지도 화면` | 지도 시각 효과는 실시간 정보 제공을 의미하지 않음 |
| P1 | 286행, 영어 `mtRadarLabel` | `GEOINT // LIVE VIEWPORT` | `MAP // PUBLIC RECORDS VIEW` | `LIVE` 오인 제거; 군사·실시간 정보 수집 주장 회피 |
| P2 | 360행, 개발 주석 | `// 실시간 경보 줄 (수집 데이터의 실제 항목만)` | `// 최근 수집 기록 줄 (저장된 공개 데이터만)` | 주석과 구현 명칭 일치. 실제 화면 라벨 `● 수집 기록`(368행)은 이미 중립적이므로 유지 |
| P2 | 355~358행, 오늘의 임무 | `const d=new Date()`와 `d.toISOString().slice(0,10)`를 함께 사용 | `한국 날짜` 또는 `UTC 날짜` 중 하나를 명시하고 날짜 산출·임무 선택에 동일 기준 사용 | 현지 날짜로 임무를 선택하고 UTC 날짜를 표시하므로 자정 부근에 선택·표시 기준이 어긋남 |

## 이미 안전한 문구 (중복 수정하지 말 것)
- 145행: `규칙 기반 경로 선택 · AI 분석 미연결 · 실시간 거래 데이터 미연결` — 유지.
- 258행: `AI OFFLINE · LIVE TRADES OFFLINE` — 유지.
- 276행: `DEMO ROUTES / NO LIVE DATA` — 유지.
- 358행: `데이터 기반 자동 선택 · 투자 신호 아님` — 유지.
- 248·506행: 상관관계/원인·투자 조언 부인 — 유지.

## 화면 담당자 수락 기준
1. 한국어/영어, OG/Twitter 미리보기에서 `live routes`, `LIVE VIEWPORT`, `지도 실시간 화면`이 더 이상 노출되지 않을 것. `live`의 일반적 기술 용례까지 기계적으로 금지하지 말고 **실시간 데이터로 오인될 표현**을 검토.
2. 하원 PTR은 **지연 공개된 신고 내역**으로 표시. 신고일(`fd`)과 거래일(`d`)을 혼동하지 않으며, 원문 PDF(`doc`)가 없는 행은 원문 확인 완료로 표시하지 않을 것.
3. 자정 경계(예: KST 00:30 / 전날 UTC 15:30)에서 '오늘의 임무'의 선택 기준 날짜와 표시 날짜가 일치하는지 테스트.
4. 375px·390px 모바일 화면에서 지도/선택/닫기 조작과 라벨 가림 여부를 브라우저로 확인.
5. CI 통과와 **실제 GitHub Pages/Worker 배포**를 분리해서 기록. 관리자 전용 접근 통제 및 저장소 공개 여부도 별도로 확인.

## 이번 검증과 제한
- GitHub에서 현재 `main`의 해당 파일 1~18, 275~291, 355~372행을 재조회하여 **문자열과 위치를 직접 대조**했다.
- #298의 변경 파일은 루트 `index.html`, #350은 `assets/i18n.js`임을 확인해 중복 수정 회피.
- **문서 작성만 완료**. 기능 코드 수정, CI 실행, 모바일 실기기 테스트, 병합, Pages/Worker 배포는 이 PR에서 **미실시**.
- 본문은 법률 판단이나 투자 조언이 아니며, 공개 공시의 사실성·최신성·권리 관계는 원문 및 서비스 약관으로 별도 검증해야 한다.
