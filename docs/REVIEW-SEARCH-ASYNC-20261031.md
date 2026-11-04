# P1 검색 신뢰성 검토 — 비동기 순서와 실패 캐시 (2026-10-31)

대상: `world-intelligence/index.html` (`main` 114ab254), [이슈 #394](https://github.com/91cleaner/money-tracker/issues/394).
중복 확인: 문화예산 지도 오류 [#389](https://github.com/91cleaner/money-tracker/issues/389) 및 기존 검색 UX 이슈와는 별개인 **비동기 응답 순서·복구 불능 캐시** 문제다.
담당: 클로드(UI), GPT(문서·제2 검토). `data/`, 수집기, 화면 코드 수정 없음.

## 실제 코드 위치와 영향

| 위치 | 관찰 | 사용자 영향 |
| --- | --- | --- |
| 218행 `$('ask').addEventListener('submit', async ...)` | 세 단계 비동기 검색에 요청 번호·취소 확인 없음 | A 검색 중 B를 검색하면 늦게 끝난 A가 B 화면을 덮을 수 있음 |
| 224~249행 `mtFirstCard`, `mtIntentCard` | 내부 `await` 뒤 DOM을 직접 수정함 | submit 핸들러 끝에서만 요청 검증해도 충분하지 않음 |
| 220행 `mtGet(p)` | `catch(()=>null)`을 포함한 Promise를 `mtJson[p]`에 영구 보관 | 네트워크 일시 실패 후 같은 자료 재검색이 새로고침 전까지 실패 |
| 192행 `loadIdx()` | HTTP 성공 검사 없이 `r.json()` 호출 | 오류 응답과 스키마 이상이 일반 검색 미일치로 이어질 수 있음 |

## 재현: 코드와 같은 패턴의 최소 모형 (Node.js 22)

```js
(async () => {
  let calls = 0;
  const fetch = async () => {
    calls++;
    if (calls === 1) throw Error('offline');
    return {ok: true, json: async () => ({ready: true})};
  };
  const mtJson = {};
  function mtGet(p) {
    return mtJson[p] || (mtJson[p] = fetch('../data/' + p)
      .then(r => r.ok ? r.json() : null).catch(() => null));
  }
  const first = await mtGet('us/members.json');
  const second = await mtGet('us/members.json');
  console.log({first, second, calls}); // null, null, 1 (재시도 없음)

  const shown = [];
  let release;
  const slow = new Promise(r => release = r);
  const submit = async (q, wait) => { await wait; shown.push(q); };
  const old = submit('A', slow);
  await submit('B', Promise.resolve());
  release();
  await old;
  console.log(shown); // ['B', 'A'] — 늦은 이전 응답이 마지막
})();
```

2026-10-31 Node 22 실행 결과: `first=null`, `second=null`, `calls=1`; 렌더 완료 순서 `[B,A]`. **실제 브라우저 E2E는 수행하지 않았으며, 이 코드는 현행 흐름의 취약한 동작을 설명하는 최소 모형이다.**

## 수정 설계 및 검증 계약

1. **검색 최신성 보장:** 제출 때 증가하는 `requestId`를 만들고, `mtFirstCard`·`mtIntentCard` 내부의 모든 비동기 경계 뒤에서 *DOM 변경 전에* 현재 요청인지 확인한다. 필요하면 AbortController도 사용하되, 요청번호 검증을 대체하지 않는다.
2. **실패 캐시 제거:** `mtGet`은 404/500/네트워크/JSON 파싱 오류에서 해당 캐시 키를 삭제한다. 정상 진행 중인 중복 요청은 동일 Promise를 공유한다. 유효한 빈 자료와 요청 실패는 서로 다른 상태로 표현한다.
3. **상태 표시:** 로딩 중 / 일치 결과 없음 / 연결 실패 / 데이터 형식 오류를 구별한다. 실패 시 다시 시도 버튼을 제공하고, 'AI 미연결·실시간 체결 미연결' 문구를 유지한다.
4. **자동 테스트:** (a) A 느림→B 빠름: 최종 B, (b) A 빠름→B 느림: 최종 B, (c) 연속 3회 입력: 마지막만, (d) 첫 fetch 실패→재검색 성공: 호출 2회, (e) HTTP 500/깨진 JSON 후 복구, (f) 같은 경로 동시 호출: 요청 1회, (g) 정상 0건과 오류 메시지 구분.
5. **브라우저·배포:** 375×667, 844×390 화면에서 입력·재시도·닫기 접근성을 확인하고 실제 Pages/Worker URL의 콘솔 및 네트워크 로그를 남긴다.

**완료 판정:** 위 테스트를 실행하고 실제 코드 수정·PR CI·배포 검증 증거가 있어야 함. 이 문서 PR만으로 P1 해결이나 배포 완료를 주장하지 않는다.


## 추가 발견: 질문을 바꿔도 이전 종목의 보조 카드가 뒤늦게 붙을 수 있음

현행 `world-intelligence/index.html`의 `mtIntentCard(q)`는 본문을 표시한 **뒤** 다음 작업을 `await`하지 않고 시작한다.

- `A.load(pl.symbol).then(... MTMood.load(...)).then(c => MTMood.render(mc,c,en); mc.hidden=false)`: 이전 질문 A의 분위기 카드가 B 검색 뒤에 공유 `#moodCard`에 다시 그려질 수 있다.
- `MTOpinions.render(box,pl.symbol,...).catch(()=>{})`: `assets/opinions.js`의 `render()`가 `index.json` 로딩 후 **전달받은 공유 `#briefStocks`에 직접 append**한다. 질문 B가 `replaceChildren()`로 비운 후에도 A의 의견 상자가 늦게 추가될 수 있다.
- `assets/opinions.js`의 `load(base)`는 `null`로 끝난 실패 Promise를 캐시해 네트워크 복구 뒤에도 재시도하지 않는다. `assets/answers.js`의 `load(sym)`도 같은 실패 캐시 패턴이지만 별도 기간 정확성 PR #215/#227과 충돌하지 않도록 여기서는 **검토 범위만** 명시한다.

**위험:** B 종목의 설명 아래 A 종목의 분위기/의견이 섞이면 단순 UX 오류가 아니라 **기업·기간의 근거 오귀속**이다. 본문 submit 경합만 고쳐도 이 분리된 Promise는 남는다.

### 추가 회귀 수락 조건

8. A 종목 의견 요청을 지연한 상태에서 B 종목 검색 완료 → A의 의견이 B 패널에 **추가되지 않음**. A/B 반대 순서와 3연속 검색도 확인.
9. A 종목 분위기 데이터 지연 → B 종목 검색/세계지도 초기화/브리핑 닫기 → A의 분위기 카드가 **다시 나타나지 않음**.
10. 보조 카드가 표시될 때마다 `requestId`뿐 아니라 **종목·기간·패널 상태**가 현재 검색과 일치하는지 검사. `MTOpinions.render()`처럼 내부 비동기 DOM 변경을 하는 함수에는 `isCurrent()` 콜백 또는 요청별 독립 컨테이너를 전달하고, 검증 후에만 현재 패널에 붙인다. `AbortController`만으로는 이미 완료된 Promise의 DOM 변경을 막을 수 없다.
11. 의견/분위기 JSON 500·오프라인 뒤 재검색 성공과, 실제 기록 0건의 표시를 분리한다. 실패 캐시를 무효화하되 정상 동시 요청은 공유한다.

**검증 근거:** `world-intelligence/index.html`의 `mtIntentCard`와 `assets/opinions.js`의 `render/load` 실제 코드를 재조회했다. Node 22 최소 비동기 모형에서 빠른 B 표시 후 늦은 A가 최종 화면을 덮는 순서 재현. **실제 브라우저/서비스 테스트와 코드 수정은 미수행**. 클로드(UI)·실장(데이터)에게 전달할 수정 계약이며, 이 문서만으로 해결 처리 금지.

## 실행 가능한 최소 수정 예시 (2026-10-31 05:57 KST 재검토)

최신 `main` `11e6ca0d`에서 `world-intelligence/index.html`의 검색 핸들러와 `mtGet`이 여전히 위 취약 패턴을 사용함을 확인했다. **아래는 UI 담당자가 통합할 코드 예시이며 실제 제품 코드는 이 PR에서 수정하지 않았다.**

### 1. 캐시 실패는 재시도, 성공 중복 요청은 공유

```js
const mtJson = Object.create(null);
function mtGet(p) {
  if (mtJson[p]) return mtJson[p];
  const pending = fetch('../data/' + p).then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
  const shared = pending.catch(err => {
    if (mtJson[p] === shared) delete mtJson[p];
    throw err;
  });
  mtJson[p] = shared;
  return shared;
}
```

**주의:** 기존 `mtGet()`은 실패를 `null`로 변환했지만 이 예시는 오류를 throw한다. 따라서 `mtFirstCard`, `mtIntentCard`, `F.fetchData` 등의 호출부를 함께 수정해 '불러오기 실패'를 명시적으로 표시해야 한다. `catch`에서 무조건 `false`를 반환해 일반 검색으로 넘어가면 장애가 '검색 결과 없음'으로 다시 은폐된다. HTTP 200이더라도 스키마가 잘못되면 별도 검증 후 오류 처리한다.

### 2. 질문 및 화면 닫기마다 검색 세대 무효화

```js
let searchEpoch = 0;
const nextSearch = () => ++searchEpoch;
const current = token => token === searchEpoch;
// submit 시작 시 const token = nextSearch();
// 모든 await 직후 if (!current(token)) return;
// mtFirstCard/mtIntentCard 내부 DOM 변경 직전에도 current(token) 검사.
// closeBrief/world 클릭 시 nextSearch()로 이전 비동기 작업 무효화.
```

**보조 카드 안전 패턴:** `MTOpinions.render()`는 내부 `load()` 완료 후 인자로 받은 컨테이너에 직접 append한다. 공유 `#briefStocks`를 넘기지 말고 `document.createElement('div')`로 만든 **분리된 임시 컨테이너**에 렌더한 뒤, Promise 완료 시 `current(token)`·종목·기간·패널 표시 상태를 모두 확인하고 현재 패널에 옮긴다. `MTMood.load().then(render)`에도 같은 검사를 적용한다. `MTFirst.show()` 등 비동기 내부 렌더도 별도 확인이 필요하다.

### 3. Node.js 22 결정론적 보조 검증

로컬 독립 모형에서 `node`로 검증: 실패한 동시 요청 2개가 fetch **1회**만 호출 → 캐시 제거 → 네트워크 복구 후 재요청으로 fetch **총 2회** → 느린 A/빠른 B 순서에서 최종 화면 B만 남음. **4개 주장 모두 모형 테스트이며 실제 제품 CI·브라우저 E2E 통과를 의미하지 않는다.**

**수정 완료 게이트:** 클로드가 화면 코드·회귀 테스트를 별도 PR로 제출하고, Actions 성공 + 375×667/844×390 실기기/브라우저 + 실제 배포 URL 재시도까지 확인해야 #394를 닫는다. Cloudflare Preview 빌드 성공 여부도 GitHub Pages 성공과 별개로 기록한다.
