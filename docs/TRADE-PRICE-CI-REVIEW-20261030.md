# P1 검토 — 미국 하원 신고 거래의 주가변동률 불일치가 수집 배포를 차단함

**검토 시각:** 2026-10-30 08:55 KST. **범위:** GitHub Actions 실행 로그 및 `main` 소스·가격 JSON 재조회. 이 문서는 **원인 분석/수락 조건**이며 코드·데이터 수정 또는 배포 완료 보고가 아니다.

## 실제 실패와 영향

- [sections 실행 #40972367816](https://github.com/91cleaner/money-tracker/actions/runs/40972367816) (2026-10-29 23:19 UTC 시작)에서 수집기 `collector/sections/sole.py` 및 개인정보 마스킹은 성공했으나, **데이터 검증 게이트**의 `python -m unittest discover -s tests`가 **144개 중 2개 실패**해 후속 커밋·배포가 중단됨. `sections.yml`의 검증 게이트는 모든 테스트를 실행하므로 미국 주가/거래 자료의 불일치가 무관한 섹션 수집에도 영향을 준다.
- 실패 1: `tests/test_trade_r.py::test_bac_laurel_lee_matches_price_file`. 거래 JSON의 `r=-18.7`과 `data/us/prices/BAC.json` 기반 계산 `-18.4`가 다름. 현재 가격 파일의 2026-08-24 종가 **62.33**, 마지막 2026-10-28 종가 **50.85** → `round((50.85/62.33-1)*100,1) = -18.4`. 테스트에 과거 `-18.7`이 별도로 하드코딩되어 있어 데이터 정합성을 회복해도 이 단언은 함께 갱신해야 함.
- 실패 2: `test_every_covered_trade_matches_its_price_file`: `DIS` 거래일 2026-10-28의 거래 JSON `r=0.9`, 가격 파일 계산 `0.0`. `data/us/prices/DIS.json`의 2026-10-28 종가와 마지막 종가는 둘 다 **109.04**.
- 이 불일치는 **공시 신고 자체가 허위**라는 뜻이 아님. `r`은 신고일/거래일을 근거로 한 **주가 변화 추정 지표**이며 의원의 실제 체결 수익률이나 손익이 아니다. 현재 가격 파일의 `source`는 Massive(구 Polygon) adjusted daily, `as_of=2026-10-28`; 출처/기준일을 거래 신고 원문과 혼동하지 말 것.

## 담당자에게 제안하는 안전한 수정

1. **실장/데이터 담당:** `collector/us/prices.py`에 이미 있는 `python collector/us/prices.py --reapply`를 **가격 파일이 갱신된 후** 실행하여 `data/us/trades.json`의 `p0/r/rspy`를 해당 가격 스냅샷과 동기화. 실제로 바뀐 행 수를 로그에 기록하고 차이 및 출처/기준일 검토 후 원자적으로 커밋. 재계산하지 못한 행은 최신 수익률로 표시하지 말고 기준일/검증 상태를 분리.
2. **실장/테스트 담당:** `test_bac_laurel_lee_matches_price_file`의 두 번째 하드코딩 `-18.7`은 고정 과거 가격에만 적용되는 단위 테스트로 이동하거나, 현행 가격 파일 기반 통합 테스트에서는 **동적 계산 일치**만 검증. `test_r_from_file_uses_trade_day_close_to_last_close`의 독립된 고정 fixture 검사는 그대로 유지. `test_every_covered_trade_matches_its_price_file`의 전체 행 정합성 검사는 **삭제/완화 금지**.
3. **실장/워크플로 담당:** 가격 스냅샷 갱신 → 거래 `r` 재계산 → 테스트/검증 → 같은 커밋에 두 파일군 게시하는 순서를 보장. 서로 다른 작업이 `data/us/prices/`와 `data/us/trades.json`를 따로 갱신하면 같은 회귀가 반복됨. 가격 기준일이 다를 경우 화면은 stale/검증 필요로 표시.
4. **재검증:** `python -m unittest tests.test_trade_r` (또는 `python -m unittest discover -s tests -p 'test_trade_r.py'`) → `python -m unittest discover -s tests` → 관련 Actions 수집 재실행의 **실제 성공** → 변경된 거래 행과 공개 페이지의 기준일/공식 신고서 링크 확인. 수집 성공과 Pages/Cloudflare 배포 성공을 별도 기록.

## 병합/배포 전 판정

- [ ] BAC, DIS 포함 모든 커버된 거래 `r`이 동일한 가격 스냅샷 계산과 일치.
- [ ] 고정 fixture 테스트와 실데이터 정합성 테스트가 모두 통과.
- [ ] 데이터 검증 게이트가 실제 Actions에서 통과하고 수집 파일 커밋까지 완료.
- [ ] 수익률/손익 오인 문구가 없고, 원문 House Clerk PDF 링크와 신고일·거래일·가격 기준일을 구분.
- [ ] 생성형 AI 분석 및 **실시간 체결 데이터는 미연결**로 표시. 하원 PTR은 지연 공개 신고자료.

**역할 분담:** `docs/AI-ROLES.md`에 따라 GPT는 검토 문서만 작성. `data/`, 수집기, UI, 테스트 및 워크플로는 담당자 승인 없이 수정하지 않음. 기존 #289 Worker 크기 문제 및 #305 주간 PTR 카드 정확성 문제와 별개임.
