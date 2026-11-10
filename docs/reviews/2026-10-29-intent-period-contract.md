# 질문 기간 계약 독립 검토 — 2026-10-29

> **검토/릴리스 차단 권고 (코드 미수정).** `main`의 `assets/intent.js`, `data/intent-lexicon.json`, `tests/intent.test.cjs`를 직접 읽고 확인한 결과. 담당자 작업 중인 UI/수집기/데이터 파일을 건드리지 않는다. 추적: [#220](https://github.com/91cleaner/money-tracker/issues/220). 기존 [#215](https://github.com/91cleaner/money-tracker/pull/215)는 다른 로더(`assets/answers.js`)만 수정하므로 중복 아님.

## P1 — '최근 1년'을 '올해(YTD)'로 해석

`data/intent-lexicon.json`의 `periods.year`는 `1년`, `12개월`, `1 year`, `past year`와 `올해`, `연초`, `ytd`를 모두 `key: "ytd"`로 매핑한다.

| 질문 | 현재 코드상 매핑 | 필요한 의미 |
| --- | --- | --- |
| `엔비디아 1년 주가` | `year / ytd` | 기준일 이전 **최근 12개월** |
| `NVDA past year` | `year / ytd` | **rolling 12 months** |
| `엔비디아 올해 주가` | `year / ytd` | **1월 1일~기준일** |
| `NVDA YTD` | `year / ytd` | **calendar year to date** |

두 기간의 시작일이 다르므로 1년 수익률을 YTD 수익률로 표기하면 숫자가 사실과 다를 수 있다. 별도 12개월 종가 자료가 없다면 `1년 자료 없음`으로 응답해야 한다.

## P1 — 없는 기간을 '가장 가까운 기간'이라고 잘못 설명

`assets/intent.js::periodChange(entry, period)`의 로직:

```js
var order = ["d1", "w1", "m1", "ytd"];
if (typeof entry[key] === "number") return { key: key, pct: entry[key], exact: true };
for (var i = 0; i < order.length; i++)
  if (typeof entry[order[i]] === "number")
    return { key: order[i], pct: entry[order[i]], exact: false };
```

예: `periodChange({d1:1.2,w1:2.3},{key:"ytd"})`는 **하루 수익률 1.2%**를 선택한다. `explain()`은 이를 `가까운 기간(하루)`라고 설명하지만 기간상 가장 가까운 값이 아니다. 기존 테스트는 `m1` 누락 시 `w1` 대체를 허용하는 계약을 고정한다.

**권장 계약:** 명시적으로 요청한 기간의 수치가 없으면 `null` 반환, 수익률 문장 비표시. 사용자가 원할 때만 다른 기간을 **별도 선택**하게 한다. 미연결/자료 없음과 0% 변화를 혼동하지 않는다.

## P1 — YTD 사건 비교 창이 365일로 고정

`explain()`은 `ch.key === "ytd"`일 때 이벤트 필터 기간을 `365`일로 설정한다. 그러나 YTD는 기준일의 연초부터이며 365일이 아니다. 예를 들어 2026-10-29 기준 YTD 시작일은 2026-01-01이다. 현재 규칙은 이전 해 10~12월 사건까지 '같은 기간'에 포함할 수 있다.

**권장 계약:** 가격 시계열의 실제 `from`/`to` 날짜를 사건 필터에 전달하고 둘 중 하나라도 불명확하면 '같은 기간' 사건 비교를 표시하지 않는다. 기간 경계는 UTC와 지역 시간대, 윤년을 포함해 테스트한다.

## 구현 담당자용 회귀 테스트 표

| 테스트 입력 | 기대 결과 |
| --- | --- |
| `parse("NVDA 1 year")` vs `parse("NVDA YTD")` | 서로 다른 기간 ID/키 |
| `parse("엔비디아 1년")` vs `parse("엔비디아 올해")` | 서로 다른 기간 ID/키 |
| `periodChange({d1:1.2,w1:2.3},{key:"ytd"})` | `null` (YTD 자료 없음) |
| `periodChange({w1:2.3},{key:"m1"})` | `null` (월간 자료 없음) |
| `periodChange({m1:0},{key:"m1"})` | `pct:0, exact:true` (0%는 결측 아님) |
| YTD 기준일 `2026-01-02`, 전년도 12월 사건 | '같은 기간'에서 제외 |
| 최근 12개월과 YTD를 동일 기준일로 조회 | 시작일과 수익률이 독립적으로 계산됨 |
| 모바일 KO/EN 및 후보 선택 후 기간 변경 | 요청한 기간/기준일/출처가 그대로 유지됨 |

## 검증·배포 게이트

1. 질문 파서/정적 답변 로더 두 경로 모두 기간 대체가 없는지 검사. `#215`의 변경만으로는 본 문제 해결 아님.
2. `node --test tests/intent.test.cjs`에 위 회귀 케이스 추가, 기존 '대체 허용' 기대값 수정. 가격 데이터 원본과 생성 답변의 기준일 일치 확인.
3. 세계지도 관제실의 질문→후보 선택→지도 이동→해설 카드 흐름을 PC/모바일에서 확인. 한 번의 후보 선택에 지도 이동 한 번만 발생하도록 #174도 별도 확인.
4. CI 통과 후 실제 Pages/Worker 배포 산출물을 별도 검증. 현재 저장소는 **public**이며 제한 파일 노출 위험은 [#213](https://github.com/91cleaner/money-tracker/pull/213)·[#214](https://github.com/91cleaner/money-tracker/pull/214)에서 별도 차단 필요.
5. **AI 분석 미연결 / 실시간 체결 데이터 미연결** 상태를 유지하고, 미리 생성한 해설을 AI 또는 실시간 투자 신호라고 표시하지 않는다.

**이번에 완료한 범위:** 저장소 원문과 테스트 계약의 정적 교차검토, 재현 입력/기대값 정의, 이슈 등록. **미완료:** 소스 코드 수정, 자동 테스트 실행, 배포·브라우저 검증. 문서 PR을 병합해도 기능 오류는 해결되지 않는다.
