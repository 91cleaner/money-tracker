# AI·시장 데이터 연결 — 실제 운영 검증 게이트 (2026-10-31)

> **현재 판정: 생성형 AI 분석 미연결 · 실시간 체결 데이터 미연결 · 관리자 전용 운영 접근 미검증.** 이 문서는 구현·설정 방법이지, Cloudflare에 배포되었거나 API 키·사용료·인증이 작동한다는 증거가 아니다. GitHub 저장소와 GitHub Pages는 현재 **public**이며, 공개 `github.io`의 미국 HTML/JS/JSON은 GitHub OAuth Worker 로그인만으로 보호되지 않는다.
>
> **코드 검증 ≠ 배포 검증 ≠ API 실호출 검증 ≠ 접근 통제 검증.** 각 단계를 별도로 확인하고, 확인 전에는 화면·매각 문서·운영 보고에서 연결 완료/운영자 전용/실시간 시세로 표기하지 않는다.

## 실제 연결 완료 판정 절차

1. [수동 Worker 배포 워크플로](https://github.com/91cleaner/money-tracker/actions/workflows/deploy-private-worker.yml)의 **해당 커밋 실행**이 성공했는지 확인한다. 이 워크플로의 `node --check`·모의 테스트·Wrangler 성공만으로 AI 키 존재나 실서비스 인증 성공은 확인되지 않는다. Pages 빌드 성공과 Worker 배포는 별개다.
2. 배포된 **정확한 Worker 주소**에서 익명 요청·다른 계정의 `/command`, `/api/analyze`, `/api/health` 접근이 거부되는지, 운영자 로그인만 허용되는지 검증한다. `/api/health`가 의도적으로 공개되는 설계라면 비밀값/개인정보를 반환하지 않는지도 확인한다. Cloudflare Access는 추가 보안 수단이지만, 기존 OAuth가 충분한지는 실제 서버 측 검증과 차단 테스트로 판정한다.
3. 운영자 로그인 후 `/api/health`에서 **AI·시세 연결 상태**를 확인하고, 실제 분석 질문 1건에 대해 응답·공식 원문 링크·오류 처리·호출 비용을 확인한다. Secret의 **값은 절대 채팅·로그·프런트 코드에 출력하지 않는다**. 성공이 없으면 미연결 상태를 유지한다.
4. 시세가 연결되더라도 공급자 계약상 **실시간 제공·공개 재배포·상업 이용** 권한과 지연 시간을 별도 확인한다. 하원 PTR은 지연 공개 신고이며 실시간 체결 데이터가 아니다. 공개 GitHub Pages 미국 경로를 운영자 전용이라고 부르려면 별도 접근 차단/제외와 익명 URL 테스트가 선행돼야 한다.

---

## 그록(Grok) API도 선택 가능 — 2026-10-27 추가

- xAI 개발자 Console: https://console.x.ai/ → API Keys → XAI_API_KEY 발급. Grok 앱/X Premium 구독과 API 결제는 별개.
- 기존 Cloudflare Worker `red-meadow-fcc6`의 Settings → Variables and Secrets → Add에서 **Secret** 이름 `XAI_API_KEY`, 값은 xAI에서 만든 API 키로 저장. GitHub 파일이나 채팅에 키를 입력하지 말 것.
- GitHub의 수동 배포 workflow: https://github.com/91cleaner/money-tracker/actions/workflows/deploy-private-worker.yml (Cloudflare 배포 자격증명 필요). 배포 후 관리자 로그인 `/command`에서 **◉ AI 조사 → AI 분석: Grok** 선택.
- Grok은 공식 `https://api.x.ai/v1/responses`를 사용하며 기본 모델은 `grok-4.7` (`XAI_MODEL`로 변경 가능). 기본적으로 웹검색 도구를 사용하며 X 게시물 검색은 **체크박스를 켤 때만** 활성화된다.
- xAI Web Search 및 X Search, Grok 토큰 비용은 각각 API 사용량 기준 별도로 발생한다. `max_turns=2`로 조사 반복 횟수를 제한했지만 엄격한 예산 한도는 xAI Console에서 직접 설정하고 모니터링해야 한다.
- AI 응답에는 검색 출처 URL, X 검색 시 조회 게시물·프로필 수, 제공자가 반환한 호출 비용(있는 경우)이 표시된다. 이는 원문 검증이나 주가 인과관계를 보증하지 않는다.
- 기존 `OPENAI_API_KEY`는 선택사항이며 없어도 `XAI_API_KEY`만으로 Grok 분석을 실행할 수 있다. 시세 `FINNHUB_API_TOKEN`도 별도 선택사항이다.
- **현 상태: GitHub 코드 연결·모의 테스트 완료, Cloudflare 실제 배포·Grok API 실호출·비용 청구 결과 확인은 미완료.** 키가 없다면 화면에 미연결로 표시한다.

공식 설명: https://docs.x.ai/developers/tools/web-search 및 https://docs.x.ai/developers/tools/x-search

---
# 중요 업데이트 — 기존 관리자 서버에 통합됨 (2026-10-27)

- 기존 Cloudflare Worker: cloudflare/admin-worker.js / wrangler.jsonc. GitHub OAuth 관리자로만 로그인되도록 설계돼 있음.
- 신규 AI API: 기존 Worker의 /api/analyze에 통합, 로그인을 검증한 다음 server/worker.mjs의 createResult 호출.
- 인증된 기존 /command 화면에 **AI 조사** 창과 /api/health 상태 확인, 시세/뉴스/AI 브리핑 창을 추가.
- 필요한 실행 조건: 기존 Worker 재배포, xAI 또는 OpenAI API 키를 Cloudflare Secret으로 설정. FINNHUB_API_TOKEN은 시세 기능용 선택 사항.
- 기존 GitHub OAuth는 **서버 측 세션·권한 검증이 실제 배포에서 통과할 때에만** Worker API의 인증 경계가 될 수 있다. Cloudflare Access는 추가 보안 옵션이며, 어느 방식도 공개 GitHub Pages의 HTML/JS/JSON을 자동으로 비공개로 만들지 않는다. 익명·타 계정 차단 테스트 전에는 관리자 전용으로 표기 금지.
- **코드 커밋은 완료. 실제 Cloudflare 배포 및 API 키 설정 확인 전에는 AI 라이브 연결은 미완료**.
- 현재 공개 GitHub Pages 미국 프리뷰는 여전히 외부에 공개되므로 공개 HTML/JS에 비밀키나 내부 데이터 업로드 금지.
- 기존 Worker가 이미 제공하는 관리자 관제실과 공개 Pages 미국 관제실은 서로 다른 화면. /command 에 먼저 AI 연결을 붙였으며 Pages 미국 프리뷰는 의도적으로 백엔드 차단 상태.

### 운영 단계 (키 등록만으로 완료되지 않음)
운영자가 선택한 AI 공급자 키를 Cloudflare Worker Secret에 등록하고, `wrangler.jsonc`의 배포 대상을 확인한 뒤 **수동 Worker 배포 → 로그인/익명 차단 확인 → 실제 분석 호출 → 비용·데이터 권리 확인** 순서로 검증한다. GitHub Pages의 공개 미국 경로는 별도로 보호하거나 배포에서 제외해야 한다. Secret 값은 채팅·GitHub·프런트엔드에 절대 붙여넣지 않는다.

---
# MONEY TRACKER — AI·시장 데이터 서버 연결 상태

2026-10-27 당시 서버·프런트 연결 코드는 작성되었으나 **현재 실제 Worker 배포·인증·API 키 설정 상태는 독립적으로 검증되지 않았다**. 설정이 없다고 단정하지도, 연결 완료라고 표시하지도 않는다. 위 2026-10-31 운영 검증 게이트를 따른다.

## 준비된 코드
- server/worker.mjs : POST /api/analyze, GET /health
- assets/mt-backend.js : 보호된 same-origin 배포에서만 분석 요청; 공개 github.io에서 호출 차단
- assets/mt-research-ui.js : 분석 결과와 시장 시세 제공 여부 표시
- tests/mt-backend.test.cjs : 공개 페이지 호출 차단 및 보호된 오리진 동작 테스트

## 실제 배포에 필요한 순서
1. Cloudflare 계정에서 Zero Trust와 Workers를 설정한다.
2. Cloudflare Workers에 server/worker.mjs를 배포한다. XAI_API_KEY 또는 OPENAI_API_KEY를 Worker Secret으로 등록한다. Grok 모델 기본값은 grok-4.7이며 OpenAI 모델 기본값은 gpt-4.1-mini다.
3. 금융 시세는 FINNHUB_API_TOKEN을 Worker Secret으로 추가할 수 있다. 상품 계약에서 실시간성·재배포 권한 확인 필수. 토큰이 없으면 시세 미연결로 명확히 표시한다.
4. Cloudflare Access에서 **Worker 전체 트래픽(프로덕션, 프리뷰 포함)**을 운영자의 이메일만 허용하도록 보호한다. OTP/2FA와 기기 정책을 검증한다.
5. 다른 기기나 로그아웃 상태에서 /api/analyze, /health, 모든 미국 HTML/JS/JSON 접근이 차단되는지 직접 확인한다. 그 이후 ACCESS_PROTECTED=true로 Worker 게이트를 연다. 환경 변수는 인증의 대체재가 아니다.
6. 미국 관제실 프런트엔드를 보호된 동일 오리진에 배포하고 /api/analyze를 해당 Worker로 라우팅한다. 보호된 페이지에서만 mt-backend.js 스크립트보다 앞에 window.MT_BACKEND_ENABLED=true를 설정한다.
7. github.io에 남아 있는 미국 HTML, JS, JSON을 공개 배포에서 제외한다. 비공개 Github 저장소 자체가 GitHub Pages 사이트 보호를 의미하지 않는다.
8. 운영자의 핸드폰과 PC에서 로그인 후 실제 질문·시장 시세 기준일·원문 링크와 실패 처리를 확인한다.

## 검증 항목
- OPENAI_API_KEY는 브라우저 코드에 포함되지 않을 것
- GET /health : 보안된 로그인 후 AI 및 quote 연결 여부 확인
- POST /api/analyze : 질문을 넣고 JSON news, market, ai, generatedAt 확인
- 기사가 없으면 원인 확정하지 않으며 뉴스 제목만으로 기사 본문을 검증했다고 주장하지 않을 것
- 시장 데이터 공급자 응답에 따라 지연/실시간 표기 및 이용약관 검토

공식 문서:
https://developers.cloudflare.com/workers/configuration/cloudflare-access/
https://developers.cloudflare.com/workers/configuration/secrets/
https://developers.openai.com/api/reference/resources/responses/methods/create

현재 상태: AI_LIVE=false; MARKET_LIVE=false; OWNER_ONLY=false.