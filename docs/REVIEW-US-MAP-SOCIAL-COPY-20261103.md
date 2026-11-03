# P1 copy review — U.S. map social preview and research-lab evidence claims

Checked against `main` on 2026-11-03 KST. This is a **review and handoff**, not a deployed UI correction. Source files are Claude-owned per `docs/AI-ROLES.md`; no screen, collector, `data/`, or workflow file is changed here.

## Verified source-level discrepancies

1. `world-intelligence/index.html` (main blob `9894f00a096ed5063c49f939e5e129f3bc12eb49`): both `og:description` and `twitter:description` say **"traced as live routes"**. The routes are interactive representations of accumulated disclosures and context, **not live executed-trade observations**. The same tags say **"Official public records only"** while this screen also contains curated historical/context routes. The claim should distinguish original filings from derived or curated routes.
2. The social title **"Who in Congress traded what, and when"** does not disclose that dates and trades are **reported in delayed filings** and have not been independently verified as executions. `late filings` in the description can imply verified statutory lateness; no universal lateness adjudication is demonstrated by these tags.
3. `world-intelligence/us-signals.html` starts with **"투자 판단에 필요한 세 가지 자료를 직접 대조하는 관제실입니다."** This implies an investment-decision aid rather than a neutral public-record research tool. Its **"● 공식 원문 조회"** label sits next to external-source links; it should not imply that the site's underlying trade records have all been individually source-verified.

These are confirmed **copy discrepancies**, not evidence of an erroneous trade, a compromised site, or an actual production social-card cache state. The separate root-page copy fix in PR #298 does **not** update these two files.

## Proposed exact replacement copy for Claude

| Location | Current | Proposed |
| --- | --- | --- |
| U.S. map `meta[name=description]` | `A U.S. control room that follows Congress bills, lawmaker stock-trade filings, company sites and foreign policy as routes on a map. Public records only, not investment advice.` | `Explore reported U.S. congressional trades, legislation, company locations and policy context on an interactive map. Filings may be delayed; no live trade feed or AI analysis. Not investment advice.` |
| U.S. map `og:title` / `twitter:title` | `US Stock Trackers \| Who in Congress traded what, and when` | `US Stock Trackers \| Explore congressional trade disclosures on a map` |
| U.S. map `og:description` / `twitter:description` | `Congressional stock trades, late filings, bills and contracts traced as live routes on one map. Official public records only. Not investment advice.` | `Explore reported congressional trades, legislation and company context as interactive map routes. Delayed filings; live executed-trade feed and AI analysis not connected. Not investment advice.` |
| Research lab opening paragraph (first sentence) | `투자 판단에 필요한 세 가지 자료를 직접 대조하는 관제실입니다.` | `미국 의회 거래 신고·법안·경제지표의 공개 기록을 서로 대조하는 조사 화면입니다.` |
| Research lab external-source badges | `● 공식 원문 조회` / `● 공식 데이터 조회` | `● 공식 사이트 열기` / `● 공식 데이터 사이트 열기` |

Keep the existing **real-world disclosure caveats**: transaction date versus filing date, Senate coverage gaps, no automatic trading or recommendations. Do not replace an unknown data state with a positive claim.

## Acceptance / regression gate (Claude/UI owner)

1. Parse the final **built Pages HTML** for `meta[name=description]`, `meta[property=og:title]`, `meta[property=og:description]`, `meta[name=twitter:title]`, `meta[name=twitter:description]`. Assert the proposed wording and that the two social descriptions match; do not rely only on grep of a source file.
2. Assert no `live routes`, `live trades`, or unqualified `Official public records only` in these metadata values; preserve `Not investment advice` and the **disconnected** live execution/AI status.
3. Check the Korean lab's first sentence and external-link badges; ensure that external links remain HTTPS and open the same official sources. No changes to search, map, mobile layout, source URLs, or data pipelines.
4. Check direct navigation to `/world-intelligence/` and `/world-intelligence/us-signals.html` on mobile and desktop; verify the page is not hidden by a share-preview-specific redirect.
5. Only after owner-approved merge and successful deployment, fetch published HTML with cache bypass and compare the relevant meta tags against the release artifact. Third-party social crawlers may retain cached previews; a Pages CI success alone does not prove that previews refreshed.

## Coordination and release state

- Existing related work: root-page social copy PR #298; map/data CI PRs #403, #412, #458. Do not merge or overwrite their files as part of this review.
- Repository visibility confirmed **public** on 2026-11-03. Public House PTR filings are delayed reports, **not** a connected real-time executed-trade feed. Generative AI analysis is **not connected**.
- No live-site, browser, CI, or crawler verification is claimed by this documentation-only review. Owner approval is required before merge.


## P1 추가 검토 (2026-11-04 00:53 KST): 지도 경로의 원문 URL 검증 및 출처 등급

**새로 확인한 코드 경로:** `main/world-intelligence/index.html`의 `show()` (약 176행)는 검색 색인의 경로 `mission.meta[step].source_url`을 `$('source').href=t.source_url`로 **프로토콜·호스트 검증 없이** 링크에 대입한다. 같은 화면의 링크 고정 문구는 `관련 공식 자료 확인 ↗`이다. `main/scripts/build_search_index.py`는 다수의 수집 JSON에서 `source_url`을 그대로 전달하며, 409–410행의 최종 필터는 **비어 있지 않은 URL인지**만 검사한다. 따라서 원문이 공식 사이트인지, HTTPS인지, 안전한 링크 스킴인지 최종 렌더 경로에서 보장하지 않는다. 별도 답변 렌더링 경로(`mtIntentCard()`, 약 244행)는 `/^https:/` 검사를 이미 수행하므로 경로별 정책도 일치하지 않는다.

**영향과 검증 한계:** 부적절한 `source_url`이 수집·색인 데이터에 들어오면 비공식/오류 출처도 **공식 원문**으로 표시될 수 있고, `javascript:`·`data:` 등 비웹 URL이 링크에 전달될 수 있다. 이것은 **정적 코드 검토로 확인한 입력 검증 공백**이다. 실제 악성 URL이 현재 공개 색인에 존재하거나 브라우저에서 스크립트 실행·보안 사고가 발생했다는 주장은 아니다. 공식 원문 검증은 단순히 HTTPS 여부만으로 증명되지 않는다.

**클로드/UI + 실장/데이터 담당 수락 기준 (GPT는 소유 코드 미수정):**

1. 공통 URL 검증 함수를 도입해 렌더 전 `new URL(value)`로 파싱하고, 절대 `https:` URL만 허용한다. `javascript:`, `data:`, `blob:`, `file:`, `http:`, `//host`, 공백·제어문자·파싱 오류는 **링크 비활성화**로 처리한다. 필요하면 공식 원문 유형별로 승인된 호스트·경로 계약을 적용한다. 사용자 입력이나 원격 JSON을 신뢰하지 않는다.
2. 출처 등급을 **공식 원문 / 공식 기관의 일반 안내 / 민간·2차 자료 / 출처 미검증**으로 구분한다. 링크가 HTTPS여도 민간·2차 자료에는 `관련 공식 자료 확인`이라는 고정 문구를 붙이지 않는다. 원문 출처가 없으면 링크를 숨기고 **출처 확인 불가**로 표시한다.
3. 검색 색인 생성 단계와 최종 브라우저 렌더 단계 **둘 다** 검사한다. 빌드에서 부적합 URL을 제외해도 브라우저 검증을 생략하지 않는다. 신고 PDF의 도메인·경로 검증(#412)은 별도 유지하며 이 작업으로 대체하지 않는다.
4. 회귀 테스트: (a) 승인된 공식 HTTPS 원문, (b) 정상 HTTPS 민간 자료의 **비공식 표시**, (c) `javascript:alert(1)`, (d) `data:text/html,...`, (e) `http://`, (f) `//other-host`, (g) 빈 값/공백/제어문자, (h) 원문 링크 없는 경로. 부적합 값은 클릭 가능한 `href`를 갖지 않아야 하며, 정상 경로·모바일 질문→선택→지도 이동은 유지해야 한다.
5. 최종 통합 SHA의 Pages 산출물과 배포 URL에서 출처 등급·링크 속성·모바일 브라우저 동작을 확인한다. 문서 PR의 통과나 CI 마커 확인만으로 안전한 링크 렌더링을 완료했다고 선언하지 않는다.

**조율:** 기존 #474의 문구·출처 검토를 확장한 것이며 새 PR은 만들지 않는다. #472(SkySea 텔레메트리 DOM), #412(PTR 원문 URL), #403(배포 진입 검사)와 수정 대상이 다르다. 저장소는 public이며, 실시간 의원 체결 데이터·생성형 AI는 미연결이다. 승인 전 병합 금지.
