# AI 역할 분담 (클로드·GPT 필독)

## 제품 방향

방문자는 관제실 대장. 정보와 주가 흐름을 추적하고 인사이트를 얻고, 게임처럼 구현해 자꾸 다시 추적하게 만드는 중독성이 목표. 단, 공식 데이터·중립 표현·투자 조언 없음은 그대로.

작업 전에 이 문서를 먼저 읽으세요.

## 최종 결정·조율
- 주 팀은 **실장(그록봇) + 클로드**입니다. GPT는 필요할 때만 씁니다.
- **실장(그록봇)**이 최종 결정과 조율을 맡습니다.

## 역할
- **클로드**: 큰 화면 기능을 맡습니다. 세계 관제실 위의 지도 선, 브리핑 창, 여정 모드 같은 UI입니다.
- **GPT** (선택, 필요할 때만: 매각 자료·제2 검토용): 글과 검토를 맡습니다. 영어 문구, 매각용 소개 자료, 법적 표현 점검, 코드 리뷰입니다.
- **실장**: 데이터 연결을 맡습니다. 종목을 중심으로 의원 거래, 법안, 위원회, 주가, 수출을 잇습니다. 매일 자동 수집, 팩트체크, 작업 순서 정리도 실장 몫입니다.

## 현재 방향
- 미국 쪽을 로빈후드처럼, 게임처럼, 전세계를 보는 관제실 느낌으로 키워서 매각하는 게 목표입니다.
- 한국 쪽은 그대로 둡니다.
- 도메인과 호스팅은 나중에 합니다.
- 지금은 내부(데이터 연결)를 다지는 단계입니다.
- 기준 화면은 복구 중인 `world-intelligence/`(10-26 버전)입니다.

## 규칙
- 같은 파일을 동시에 수정하지 않습니다.
- `data/`는 실장 담당입니다.
- 화면 파일은 클로드 담당입니다.
- 모든 작업은 브랜치 → PR로 합니다. 합치기 전에 사장님 확인을 받습니다.
- 2026-10-28 사장님 결정: 미국 의원 주식 거래 공개. 원문 링크·신고 기준·중립 문구 필수.
- 키는 출력하지 않습니다.
- 출처는 공식 원문 링크만 씁니다.

## 선택(필요할 때만): 매각 자료·제2 검토용

### GPT 할 일 목록

**규칙: 하나 끝나면 묻지 말고 바로 다음 항목 진행, 끝난 항목은 [x] 체크하고 한 줄 결과 적기, 목록이 다 끝나면 실장에게 보고.**
GPT는 문서와 문구만 고칩니다. `data/`와 수집기는 건드리지 않습니다. 모든 작업은 브랜치 → PR로 합니다.

- [x] 1. usa-command / world-intelligence 화면 영어 문구 다듬기 **제안 작성** — [PR #217](https://github.com/91cleaner/money-tracker/pull/217) (검토 대기; 실제 화면 반영과 별개).
- [x] 2. 투자 조언처럼 보일 수 있는 표현 **점검 목록 작성** — [PR #217](https://github.com/91cleaner/money-tracker/pull/217), 후속 [PR #352](https://github.com/91cleaner/money-tracker/pull/352) (제안 단계).
- [x] 3. 최근 클로드 PR **코드 리뷰 메모 작성** — [모바일 PR #363](https://github.com/91cleaner/money-tracker/pull/363), [데이터 기준일 PR #358](https://github.com/91cleaner/money-tracker/pull/358) (코드 수정·실기기 검증은 담당자 몫).
- [x] 4. 매각용 한 장 소개서 **초안 작성** — [PR #266](https://github.com/91cleaner/money-tracker/pull/266)의 `docs/PITCH.md` (2026-10-30 기준 main에는 아직 없음).
- [x] 5. README 영어판 **존재 확인 및 사실관계 수정안 작성** — [PR #299](https://github.com/91cleaner/money-tracker/pull/299) (main의 영문 README는 진입점 설명이 오래됨).

**상태 기준 (2026-10-30 22:58 KST):** 위 [x]는 GPT 담당 **초안/리뷰 작업 완료**만 뜻합니다. 연결된 PR이 열려 있으면 **미병합·미배포**이고, 제품 기능·데이터 오류가 해결됐다는 뜻이 아닙니다. 같은 문서·기능의 새 PR을 반복 만들지 말고 해당 기존 PR을 먼저 확인하세요.

### 현재 담당자 후속 작업 (GPT는 직접 수정하지 않음)

- **실장 / FEC PAC 정확성 P1:** [#382](https://github.com/91cleaner/money-tracker/issues/382). 10/30 수집 로그 `updated 2 total 11 rate_limited True`인데, 커밋에서는 기업별 값이 그대로이고 `updated` 날짜만 전진했습니다. 429·부분 수집·실제 데이터 기준일을 구분해야 합니다.
- **실장 / 미국 하원 PTR:** [PR #327](https://github.com/91cleaner/money-tracker/pull/327)의 수집 실패 차단 및 PDF 재시도 검증. 공식 공시는 지연 신고이며 실시간 체결 확인이 아닙니다.
- **클로드 / 정당별 지도:** [PR #338](https://github.com/91cleaner/money-tracker/pull/338)은 개인정보·자료 권리 확인 전 **병합 금지**. 검토 [#344](https://github.com/91cleaner/money-tracker/pull/344).
- **클로드 / 모바일:** [PR #363](https://github.com/91cleaner/money-tracker/pull/363)의 375/390px 가로모드 후보 패널 QA 및 닫기 동작 확인.
- **실장 / 운영:** 저장소는 현재 `public`이며 Pages 성공은 비공개 인증 Worker 배포 검증이 아닙니다. 생성형 AI 분석 **미연결**, 실시간 체결 피드 **미연결**.


### 2026-11-09 07:55 KST — 중복 PR 차단 및 실제 통합 순서 (추가 확인)

**중요: 아래 PR은 모두 조회 시점에 OPEN/미병합입니다.** 문서/코드 PR 생성, CI 일부 성공, Pages 배포 성공은 실제 기능 수정·서비스 반영을 뜻하지 않습니다. 작업 전 최신 main과 PR의 base/head를 다시 확인하고, **동일 파일·동일 결함의 신규 PR 대신 기존 PR에 후속 커밋/리뷰**를 남깁니다.

- **매각 문서 중복:** `docs/PITCH.md`를 생성하는 PR [#216](https://github.com/91cleaner/money-tracker/pull/216), [#266](https://github.com/91cleaner/money-tracker/pull/266), [#393](https://github.com/91cleaner/money-tracker/pull/393), [#470](https://github.com/91cleaner/money-tracker/pull/470)이 동시에 열려 있습니다. 하나만 선택해 최신 사실관계를 합친 뒤 나머지는 담당자 승인으로 정리; **새 PITCH PR 금지**.
- **영문 README 중복:** 이미 영어 README가 main에 존재하며 수정 PR [#222](https://github.com/91cleaner/money-tracker/pull/222), [#299](https://github.com/91cleaner/money-tracker/pull/299)이 열려 있습니다. 신규 영문판 PR을 만들지 말고 내용 충돌을 검토.
- **질문 → 선택 → 지도 검색 스택:** [#524](https://github.com/91cleaner/money-tracker/pull/524) (base main) → [#525](https://github.com/91cleaner/money-tracker/pull/525) (base #524 head) → [#530](https://github.com/91cleaner/money-tracker/pull/530) (base #525 head) → [#532](https://github.com/91cleaner/money-tracker/pull/532) (base #530 head). **하위 PR이 main에 바로 병합 가능한 독립 수정이라고 오인하지 말 것**. 동일 SHA의 테스트와 출처 호스트 검증이 통과한 후 승인 순서대로 통합.
- **미국 탭 스택:** [#513](https://github.com/91cleaner/money-tracker/pull/513) (base main) → [#517](https://github.com/91cleaner/money-tracker/pull/517) (base #513 head) → [#521](https://github.com/91cleaner/money-tracker/pull/521) (base #517 head). 자료 로딩 실패를 0건으로 표시하는 기존 main 문제는 이 미병합 스택에 수정안이 있으므로 **새 UI PR 대신 통합·회귀 검증**을 우선.
- **공개 데이터/배포 P1:** 하원 PTR 이상 날짜 [#527](https://github.com/91cleaner/money-tracker/issues/527) / 수정안 [#412](https://github.com/91cleaner/money-tracker/pull/412), Pages 보안·동일 커밋 검증 [#403](https://github.com/91cleaner/money-tracker/pull/403)·[#458](https://github.com/91cleaner/money-tracker/pull/458)·[#536](https://github.com/91cleaner/money-tracker/pull/536), 수집기 거짓 성공 [#538](https://github.com/91cleaner/money-tracker/issues/538)·[#541](https://github.com/91cleaner/money-tracker/issues/541), 계약 집계 검증 실패 [#540](https://github.com/91cleaner/money-tracker/issues/540). **공식 원문 검증 없이 날짜·금액을 임의 수정하거나 CI 게이트를 끄지 말 것.**

**공개/연결 상태 (2026-11-09 GitHub 재조회):** 저장소 `public`이며 비공개 전환·관리자 전용 접근통제는 미완료. 지연 공개 House PTR은 실시간 주식 체결이 아니며, **실시간 체결 피드 미연결 / 생성형 AI 분석 미연결**. Pages 성공만으로 보호·동일 SHA 테스트·실기기 검증을 주장하지 않습니다. 사용자 승인 전 PR 병합 금지.
