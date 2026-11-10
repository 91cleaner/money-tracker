# MONEY TRACKER — 독립 코드 리뷰 및 CI 실패 분류 (2026-10-28 12:54 KST)

검토 기준: `main` `cd27a27e89`; PR #128(세계 관제실 복구), #130(모바일 첫 화면), `HANDOFF.md`, `docs/AI-ROLES.md`. **코드/데이터/UI 수정 없이** 읽기 전용으로 검토했다. GPT 담당은 문서·코드 리뷰이며, UI는 클로드, 데이터는 실장 담당이다.

## 확인한 결과

- GitHub Pages 배포 작업 **성공**: [Deploy MONEY TRACKER Pages](https://github.com/91cleaner/money-tracker/actions/runs/40629184520), [pages build and deployment](https://github.com/91cleaner/money-tracker/actions/runs/40629184326).
- 동일 커밋의 [Command room smoke](https://github.com/91cleaner/money-tracker/actions/runs/40629184498) 및 [Map smoke](https://github.com/91cleaner/money-tracker/actions/runs/40629184445)는 **실패**. 따라서 배포 성공만으로 기능 정상이라고 판단하면 안 된다.
- [World Intelligence health](https://github.com/91cleaner/money-tracker/actions/runs/40629049107)도 실패했으나, 로그 원문에 접근하지 못해 정확한 실패 지점은 미확인이다.
- 저장소 API의 `private` 값은 **false**. 비공개라고 보고하지 말 것. AI 분석과 실시간 체결 데이터도 연결 확인 전에는 **미연결**로 표시.

## 재현 가능한 원인 후보 1 — 홈 안내 문구 누락 (확실한 정적 계약 불일치)

`.github/workflows/command-smoke.yml`은 `index.html`에 `비공개 관리자 데이터는 별도 인증 필요`가 있어야 한다고 검사한다. `tests/usa-map-smoke.test.cjs`의 `country selection remains intentional` 테스트도 같은 문구를 요구한다.

하지만 현재 `index.html`의 상태 패널에는 `실시간 의원 거래 데이터: 연결 미확인`, `생성형 AI 분석: 연결 미확인`, `미국 살펴보기: 준비 중 · 공개 자료만`만 있고 **관리자 인증 필요 문구는 없다**. 이 불일치는 두 CI 작업을 실패시킬 수 있다.

**UI 담당자 권장 수정:** 공개 홈 상태 패널에 `비공개 관리자 데이터는 별도 인증 필요`를 실제 사용자에게 보이게 명시하고 테스트를 유지한다. 단순히 테스트에서 검사를 삭제하지 말 것. 이 문구는 비공개 데이터가 공개 사이트에서 접근 가능하다는 뜻이 아니라, 별도 인증·호스팅이 필요하다는 경고다.

검증: `node --test tests/usa-map-smoke.test.cjs` 및 `Command room smoke checks` 재실행. 추가 실패가 있으면 개별 assertion을 확인한다.

## 원인 후보 2 — 복구된 세계지도와 이전 건강검사 계약

PR #128에서 `world-intelligence/index.html`은 미국 관제실로 이동하는 리다이렉트에서 **실제 지도 화면**으로 바뀌었다. `scripts/check_world_intelligence.py`는 리다이렉트 여부에 따라 서로 다른 검증 경로를 사용한다. 복구 후 전체 검증 경로가 다시 실행되므로, 실패 시 지도 화면의 실제 회귀인지 오래된 검증 기대치인지 분리해야 한다.

**담당자 권장:** 실패한 World Intelligence health의 Actions 오류 메시지/annotations를 먼저 확인한 다음, 복구된 지도 기능을 유지하면서 필요한 검증 계약만 갱신한다. 로그 없이 원인을 단정하거나 검사를 무력화하지 말 것.

## 충돌 방지 및 배포 게이트

1. 클로드는 `index.html`, `world-intelligence/` 등 UI 변경을 담당하고, 실장은 `data/`·수집기를 담당한다. GPT는 이 PR에서 **문서만** 수정한다.
2. `main`에 직접 푸시하지 않고 브랜치 → PR → 운영자 승인 후 병합한다.
3. 배포 확인 기준은 **Pages 성공 + 관련 smoke/health 성공**이다. 실제 모바일 지도·위성 타일은 별도 실기기 확인이 필요하다.
4. 미국 의원 주식거래 원장이나 PTR 후보를 공개 화면에 다시 연결하지 않는다. 실제 거래와 AI는 미연결로 표시한다.

## 이번 검토 범위의 한계

GitHub Actions job 상태와 저장소 소스의 문자열 비교는 확인했지만, CI 전체 로그와 실제 iOS/Android 화면은 확인하지 못했다. 새 코드 테스트·배포는 이 문서 PR의 범위에 포함되지 않는다.
