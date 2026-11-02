# PR #458 제2 검토: Pages 공개 JSON 일치와 실제 릴리스 SHA 증명은 별개

검토일: 2026-11-02 KST. 검토 대상: [PR #458](https://github.com/91cleaner/money-tracker/pull/458), [PR #403](https://github.com/91cleaner/money-tracker/pull/403), [PR #412](https://github.com/91cleaner/money-tracker/pull/412). **실제 운영 결함을 재현했다고 주장하지 않음**. 아래는 코드에서 확인한 검증 공백 및 담당자 수락 조건이다.

## 확인한 코드와 현재 보장 범위

- `.github/workflows/pages-json-parity.yml`의 `deployed-json`은 `workflow_run.head_sha`를 체크아웃해 `prepare-public-pages.py`로 다시 생성한 뒤 공개 URL을 검사한다.
- `scripts/check-pages-public-json.py`는 **세 JSON**(`trades_public.json`, `trades-recent.json`, `collection-status.json`)의 바이트 SHA-256만 비교한다. JSON 구문·일부 구조 검사는 있지만, HTML/JS의 릴리스 SHA나 전체 Pages 게시본의 동일성은 검증하지 않는다.
- `scripts/check-pages-publish-step.py`는 실제 `actions/deploy-pages@v4` 단계 성공을 확인한다. 다만 해당 검사는 게시된 사이트가 그 작업의 SHA로 계속 유지되는지를 증명하지 않는다.
- #403은 별도의 진입 화면 검사, #412는 PTR 공개 안전성 검사를 다룬다. **세 PR은 모두 별도 검증이 필요**하며, #458의 PR CI 성공만으로 세 기능의 운영 배포 성공을 선언할 수 없다.

## P1 검증 공백: JSON 동일 = 게시 릴리스 SHA 동일이 아님

**반례:** A 커밋은 지도 JS만 변경, B 커밋은 지도 JS를 다시 변경하되 위 세 JSON의 내용은 A와 동일하다. B가 게시된 뒤 A의 사후 감사가 실행되면 세 JSON 해시가 모두 같아 **PASS**할 수 있다. 이 결과는 JSON의 동일성만 보장하며 A의 전체 배포를 증명하지 않는다.

**수락 조건 (실장/배포 담당):**
1. 배포 산출물에 **공개 가능한** 릴리스 식별자(커밋 SHA 및 빌드/배포 실행 ID)를 포함하고, 실제 Pages에서 읽은 식별자를 감사 대상 실행과 대조한다. 인증 정보·비밀키는 포함하지 않는다.
2. GitHub Pages의 Source가 GitHub Actions인지 확인하고, 다른 Pages 게시 워크플로가 동일 경로를 덮어쓰지 않는지 확인한다. Source 미확인은 **미검증**으로 표시한다.
3. 연속 배포 A→B 중 A의 사후 감사가 B를 읽는 경우를 **오류 배포**와 **오래된 감사 실행**으로 구분한다. 무조건 PASS 또는 무조건 데이터 손상으로 단정하지 않는다.
4. 릴리스 식별자와 세 JSON 검사가 모두 통과한 뒤에도 HTML/JS 및 비공개 파일 노출 검사는 #403/보안 게이트에서 별도로 통과해야 한다.

## 최소 회귀 검증 시나리오

| 시나리오 | 기대 결과 |
| --- | --- |
| 같은 JSON, 서로 다른 커밋 A/B, 운영은 B | A 릴리스 동일성 **PASS 금지** |
| JSON 1개가 오래된 상태, 릴리스 식별자는 일치 | JSON 불일치 **FAIL** |
| 연속 배포 A→B, A 감사가 B 게시 후 실행 | 오래된 감사 실행으로 분류하고 B 감사 결과 확인 |
| Pages Source 미확인·릴리스 식별자 누락 | 릴리스 동일성 **미검증/FAIL-CLOSED** |

## P1 추가 발견: 공개 JSON 구조 검증이 **게시 후** 실행됨 (배포 전 차단 공백)

**코드 경로 확인 (2026-11-02):** `main`의 `.github/workflows/deploy-pages.yml`은 `prepare-public-pages.py` → `check-pages-artifact.py` → `upload-pages-artifact@v3` → `deploy-pages@v4` 순서다. #403 브랜치에서도 업로드 전 검사는 HTML/JS 진입점에 집중한다. #412의 `check-pages-artifact.py`는 미국 공개 거래/PTR 날짜·원문 링크를 검증하지만, `data/search/collection-status.json`의 `collectors.*.count/errors` 구조를 검증하지 않는다. #458의 `check-pages-public-json.py`는 이 구조를 검증하나, `deployed-json` 작업은 **게시 단계가 성공한 뒤**에 실행된다.

**반례 (실제 운영 장애 발생 주장 아님):** `collection-status.json`의 한 수집기 `count`가 음수 또는 문자열이거나 `errors`가 문자열로 변질되어도, 현재 사전 검사 경로만으로는 업로드·게시를 차단하지 못할 수 있다. 사후 JSON 감사가 FAIL이어도 이미 잘못된 파일이 사용자에게 제공된 뒤다. 이 공백은 앞 절의 **릴리스 SHA 증명 공백과 별개**다.

**담당자 수락 조건 (배포/데이터 담당, GPT는 코드 미수정):**
1. `prepare-public-pages.py`와 `check-pages-artifact.py` 실행 직후, **`upload-pages-artifact` 전에** 세 공개 JSON을 모두 엄격한 UTF-8·JSON 구문·중복 키·숫자 안전성·필수 구조 기준으로 검증한다. #458의 `validate_json`을 재사용하거나 동등한 로컬 전용 검사기를 사용하며, 네트워크 요청 없이 실패 시 종료 코드 1을 반환한다.
2. #412의 PTR 연대기·공식 PDF 링크 차단은 그대로 유지한다. JSON 구조 검사만으로 신고 사실의 진위·실거래·수집 성공을 증명하지 않는다.
3. CI 수락 테스트: (a) `collection-status.json`의 음수 `count`, (b) 문자열 `errors`, (c) 파일 누락·깨진 JSON 각각에서 **업로드 단계에 도달하기 전에 실패**, (d) 정상 JSON은 통과. 사후 운영 바이트 감사도 별도로 유지한다.
4. #403/#412/#458 병합 후 동일 병합 SHA의 배포 워크플로 실행에서 사전 검증 단계와 실제 게시 단계 순서를 확인한다. **검사 코드가 PR에 존재한다는 사실만으로 운영 보호 완료로 표시하지 않는다.**

## 병합·배포 인수인계

- #403/#412/#458은 서로 다른 주요 파일을 변경하므로 개별 PR 성공만으로 통합 결과를 추정하지 않는다. 승인 후 동일한 병합 커밋에서 공개 산출물 생성, PTR 검증, 진입 화면 검사, JSON 감사, 실제 Pages 확인을 연속 수행한다.
- 운영 URL에서 세 JSON을 직접 가져오지 못한 상태이므로 **실제 Pages 바이트 일치성 미검증**. PR #458의 `workflow_run` 사후 감사는 해당 워크플로가 기본 브랜치에 반영되어야 활성화된다.
- 공식 의원 신고는 지연 공개 자료이며 **실시간 체결 데이터 미연결**. 생성형 **AI 분석 미연결**. 공개 저장소가 `public`인 사실과 관리자 접근 보호는 별개다.
- 역할 분담: GPT는 이 **검토 문서만** 수정. UI는 클로드, 데이터·수집기는 실장 담당. 승인 전 병합하지 않는다.
