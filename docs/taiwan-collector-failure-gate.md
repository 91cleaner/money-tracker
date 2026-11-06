# 대만 입법 데이터 수집 실패 — 공개 상태·복구 검증 게이트

> 검토 시각: 2026-11-01 KST. **수집기/데이터/화면 코드를 변경하지 않은 제2 검토 문서**이며, 현재 운영 상태를 실시간 확인했다는 뜻이 아니다.

## 확인된 저장소 증거

- `main`의 [`data/search/collection-status.json`](https://github.com/91cleaner/money-tracker/blob/main/data/search/collection-status.json)은 `created_at: 2026-10-31T19:10:41.676Z`, `pipeline: official-public-no-ai`로 기록되어 있다.
- `taiwan_legislature.count = 0`이면서 `errors`에 **8개 실패**가 있다: `members`, `半導體`, `人工智慧`, `經濟安全`, `供應鏈`, `能源`, `台美`, `國防` 각각 `fetch failed`.
- 같은 스냅샷의 `us_federal_register=105`, `japan_diet=46`, `us_sec=74` 및 빈 `errors`는 **그 수집기의 해당 시점 보고값**일 뿐, 원문 대조·최신성·실제 운영 배포를 입증하지 않는다.
- 따라서 대만 `0`은 **공식 자료 검색 결과 0건이 아니라 수집 실패 / 검증 불가**로 취급한다. 실패 원인(HTTP 응답, 접근 차단, API 변경 등)은 이 상태 파일만으로 특정할 수 없다.

## 데이터 담당(실장)에게 요청하는 수정 및 수락 조건

1. 대만 의회 **공식 원문 출처 URL**과 각 요청의 UTC 시각, 검색어, HTTP 상태 또는 예외 종류를 비밀값 없이 수집 로그에 기록한다. 공식 출처를 확인하지 못하면 해당 항목은 `source_unverified`로 표시한다. 비공식 검색 결과를 공식 의안·의원 사실로 승격하지 않는다.
2. `count=0, errors.length>0`을 `fetch_failed`로, 정상 요청이 성공했고 결과가 비었을 때만 `empty_verified`로 구분한다. 오래된 성공 캐시가 있더라도 `last_success_at`, `attempted_at`, `stale`을 분리한다. 실패를 `0건 수집 완료`나 `최신 데이터`로 표현하지 않는다.
3. 부분 실패도 숨기지 않는다. 8개 요청 중 일부만 성공하면 성공·실패 건수와 해당 범위를 각각 보여준다. 국가 지도/질문→선택→추적 UI에서는 실패한 대만 경로를 **'자료 연결 실패 · 마지막 성공 시각 미확인'**으로 표시하고, 관계선을 사실인 양 그리지 않는다.
4. 자동 테스트: (a) 8/8 실패 시 `fetch_failed` 및 데이터 0건 **미확정**, (b) 정상 200 + 빈 결과 시 `empty_verified`, (c) 3/8 실패 시 `partial`, (d) 이전 캐시가 있어도 재수집 실패 시 `stale`, (e) 공식 원문 URL/날짜 누락 시 `unverified`. 어떤 경우에도 실패를 성공 0건으로 바꾸지 않는다.
5. 복구 완료 증거: 공식 URL별 응답·원문 샘플 대조, 수집 결과 건수, `collection-status.json` 새 타임스탬프, 관련 CI URL, 실제 공개 Pages 데이터 및 화면의 상태 문구를 **동일한 배포 SHA**로 기록한다. PR 단독 통과는 운영 배포 증거가 아니다.

## 소유권과 배포 주의

- `docs/AI-ROLES.md`에 따라 `data/`·수집기·데이터 연결은 실장, 세계 관제실 화면은 클로드 담당. 이 문서는 실행 코드 변경을 요청하는 인수인계 자료이며, 소유자 승인 전 병합하지 않는다.
- 저장소는 검토 시 **public**이다. 공개 Pages 또는 공개 GitHub에 독점 데이터·키를 넣지 않는다.
- **생성형 AI 분석: 미연결. 실시간 체결 거래 데이터: 미연결.** 미국 하원 PTR 신고는 실시간 체결 증빙이 아니다.
- 관련 별도 배포 차단: [PR #403](https://github.com/91cleaner/money-tracker/pull/403) (진입점 CI), [PR #412](https://github.com/91cleaner/money-tracker/pull/412) (미국 PTR 공개 사본). 이 문서는 두 PR을 병합하거나 그 CI를 통과시키지 않는다.
