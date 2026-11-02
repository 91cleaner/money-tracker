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

## 병합·배포 인수인계

- #403/#412/#458은 서로 다른 주요 파일을 변경하므로 개별 PR 성공만으로 통합 결과를 추정하지 않는다. 승인 후 동일한 병합 커밋에서 공개 산출물 생성, PTR 검증, 진입 화면 검사, JSON 감사, 실제 Pages 확인을 연속 수행한다.
- 운영 URL에서 세 JSON을 직접 가져오지 못한 상태이므로 **실제 Pages 바이트 일치성 미검증**. PR #458의 `workflow_run` 사후 감사는 해당 워크플로가 기본 브랜치에 반영되어야 활성화된다.
- 공식 의원 신고는 지연 공개 자료이며 **실시간 체결 데이터 미연결**. 생성형 **AI 분석 미연결**. 공개 저장소가 `public`인 사실과 관리자 접근 보호는 별개다.
- 역할 분담: GPT는 이 **검토 문서만** 수정. UI는 클로드, 데이터·수집기는 실장 담당. 승인 전 병합하지 않는다.
