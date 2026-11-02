# P1 제2 검토 — Pages 공개 데이터 경로가 기본 허용되는 문제

검토일: 2026-11-02 KST. 검토 기준: `main`의 `scripts/prepare-public-pages.py`, `scripts/check-pages-artifact.py`, `.github/workflows/deploy-pages.yml`. **현재 비밀 파일의 실제 유출을 확인했다는 뜻은 아니다.** 이 문서는 구조적 게시 위험과 수락 기준을 기록한다.

## 확인한 코드 경로

1. `prepare-public-pages.py`의 `PUBLIC_DIRS`에 `data`가 포함된다. `data/` 아래 파일은 `safe(src)`가 참이면 `.public-pages/`에 복사된다.
2. `safe()`는 확장자 `.json`, `.csv`, `.txt` 등을 기본 허용하며, 경로 차단은 `PRIVATE_DATA_FILES`의 세 파일, `data/us/history/`, 숨김/차단 이름·디렉터리 등 **제외 목록**에 의존한다.
3. `check-pages-artifact.py`도 일부 알려진 `forbidden` 경로만 검사한다. 따라서 새로운 `data/ops/internal-notes.json` 같은 경로가 추가되면(경로명에 차단된 디렉터리 `internal`이 없다는 전제) 자동 복사·검사 통과가 가능하다. 이 예시는 가상의 경로이며 실제 존재나 유출을 주장하지 않는다.
4. `deploy-pages.yml`은 산출물 검사가 성공하면 업로드·게시한다. 새 경로에 대한 공개 승인 여부는 검사하지 않는다. PR #412의 거래 행 안전성 및 PR #458의 **세 JSON** 구조/바이트 감사는 이 *추가 파일* 문제를 포괄하지 않는다.

## 재현 가능한 최소 반례 (실제 저장소 파일을 생성하지 말 것)

- 테스트용 임시 체크아웃에 `data/ops/review-only.json`을 만들고 `{"test_only":true}`를 넣는다. `ops`와 파일 이름은 현재 제외 목록에 없고 `.json`은 허용 확장자다.
- `python3 scripts/prepare-public-pages.py` 후 `.public-pages/data/ops/review-only.json`이 생기는지 검사한다.
- `python3 scripts/check-pages-artifact.py`가 이 **승인되지 않은 새 경로**를 거부하는지 검사한다. 현재 검사 정의만 보면 거부 규칙이 없다.
- 반드시 임시 테스트에서만 실행하고, 테스트 파일을 실제 GitHub 브랜치에 커밋하거나 운영에 배포하지 않는다.

## 해결 수락 조건 — 데이터/배포 담당

1. 공개 데이터 파일은 **명시적인 공개 경로 매니페스트(allowlist)** 또는 동등한 fail-closed 정책으로만 포함한다. 알려진 비공개 파일의 denylist는 방어 심층화용으로 유지한다.
2. 현재 서비스가 실제로 참조하는 데이터 파일을 먼저 조사해 기존 공개 기능을 깨뜨리지 않도록 매니페스트에 등록한다. `data/**` 전체, 임의의 `*.json` 전체 같은 포괄 패턴은 공개 승인으로 간주하지 않는다.
3. 산출물 생성 직후·`upload-pages-artifact` **이전**에 `.public-pages/data/`의 모든 실제 파일 경로가 매니페스트에 있는지 검증하고, 미등록 파일이 하나라도 있으면 종료 코드 1로 차단한다. 누락된 필수 공개 파일도 차단한다.
4. 회귀 테스트: (a) 승인된 JSON/CSV/GeoJSON 정상 복사, (b) 미등록 새 JSON 차단, (c) 미등록 새 TXT/CSV 차단, (d) 알려진 비공개 파일·심볼릭 링크 차단, (e) 승인된 파일 삭제 시 필수 파일 실패, (f) 공개 경로만 추가하는 정상 PR은 승인 후 통과.
5. PR #403의 HTML/JS 배포 일치성, #412의 PTR 신고 안전성, #458의 세 JSON 감사와 **별도**로 검사한다. 병합 후 운영 배포 단계에서 사전 차단이 실제 실행되었는지 확인한다.

## 중요한 한계 및 조율

- **저장소는 현재 public**이므로 Git으로 추적된 파일의 기밀성은 Pages 필터만으로 지킬 수 없다. 비공개 원천 데이터는 공개 저장소에 커밋하지 않고 접근권한·비밀정보 취급 정책을 별도로 검토해야 한다.
- 이 검토는 기존 실제 파일에 비밀이 들어 있다는 주장이 아니며, 기존 공개 데이터가 정확하거나 재배포 권리가 있다는 증명도 아니다.
- `docs/AI-ROLES.md`에 따라 GPT는 **검토 문서만 추가**한다. `data/`, 수집기, UI, 배포 스크립트는 담당자 승인·조율 없이 변경하지 않는다. 승인 전 병합 금지.
- 실시간 의원 체결 데이터 **미연결**, 생성형 AI 분석 **미연결**.


## 2026-11-02 17:17 KST 검증 보강 — 실제 CI 실패 원인 및 구현 순서

### 최신 PR CI 재확인 (실행 로그 기반)
- [PR #469 security CI #41402977914](https://github.com/91cleaner/money-tracker/actions/runs/41402977914): **실패**. 같은 실행에서 기존 단위 테스트 **144건은 통과**했고 `prepare-public-pages.py`는 **89,494개 파일**을 생성했다. 실패 위치는 `Build and validate public artifact` 단계의 `grep -q 'href="intel-lab.html"' .public-pages/index.html` (exit 1)이다. 이 검사는 현재 진입 페이지와 맞지 않는 과거 링크를 기대한다. **허용 목록 검증이 실행되거나 성공했다는 증거가 아니다.**
- [PR #469 command smoke #41402977867](https://github.com/91cleaner/money-tracker/actions/runs/41402977867): **성공**. UI/JS 스모크 성공은 공개 데이터 경로의 안전성 증명이 아니다.
- 이 CI 실패는 기존 [PR #403](https://github.com/91cleaner/money-tracker/pull/403)이 수정 중인 진입 페이지 검사와 겹친다. **이 PR에서 workflow 코드를 별도로 수정하지 않는다.**

### 데이터/배포 담당의 구현 순서 (PR #412와 충돌 방지)
1. 공개 UI의 실제 `fetch`/XHR/다운로드 의존 경로와 생성 산출물을 수집하여 **정확한 파일 경로별 승인 목록**을 만든다. `data/**`, `data/us/**`, 확장자 전체 허용은 금지한다. `data/us/trades_public.json`처럼 빌드가 **생성**하는 파일도 승인 목록에 별도로 포함한다.
2. `prepare-public-pages.py`가 `data/`를 복사할 때 **복사 전에** 승인 목록으로 검사한다. 승인되지 않은 파일은 무시하는 데 그치지 않고 **명시적 실패**로 종료하여 데이터 추가를 리뷰하도록 한다. 이 로직은 PR #412의 거래 날짜 격리 로직과 **한 브랜치에서 통합 검증**한다.
3. `check-pages-artifact.py`가 빌드된 `.public-pages/data/`의 **모든 파일 경로**를 별도로 다시 열거하고 승인 목록과 집합 비교한다. `unexpected = actual - allowed`, `missing = required - actual`이 하나라도 있으면 비영(非0) 종료한다. 경로 비교는 루트 기준 상대 POSIX 경로로 정규화하고 대소문자 충돌·심볼릭 링크·경로 탈출도 거부한다.
4. **부정 테스트**는 임시 체크아웃에서만 수행한다: `data/ops/review-only.json` 추가 시 빌드가 실패해야 하고, `.public-pages/data/ops/review-only.json`을 빌드 후 수동 삽입해도 산출물 검사가 실패해야 한다. 승인 목록의 필수 파일 삭제, 승인 목록에 없는 CSV/TXT/GeoJSON, symlink도 실패해야 한다. 기존 공개 검색·지도·거래 파일은 성공해야 한다.
5. `.github/workflows/deploy-pages.yml`의 `actions/upload-pages-artifact@v3` **이전**에 빌드 및 두 검사를 필수 실행하고, CI에서 실제 거부 테스트를 수행한다. [#458](https://github.com/91cleaner/money-tracker/pull/458)의 **배포 후 3개 JSON 비교**는 별도 단계로 유지한다.

**판정:** 위 항목은 검증 로그를 바탕으로 구체화한 **구현 지시/수락 기준**이다. 현재 #469는 문서 PR이며 실제 allowlist 코드·거부 테스트·운영 Pages 재배포는 **미구현·미검증**이다. `main`에 이미 존재하는 공개 Git 기록의 비밀성은 별도로 다뤄야 한다.
