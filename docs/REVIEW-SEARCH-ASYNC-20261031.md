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
