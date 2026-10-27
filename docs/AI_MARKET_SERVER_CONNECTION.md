# MONEY TRACKER — AI·시장 데이터 서버 연결 상태

기준일 2026-10-27: 서버 코드와 프런트엔드 연결 코드는 구현했으나, **실제 서버 배포·인증·API 키는 미설정**. 실시간 데이터/AI를 연결 완료라고 표시하지 않는다.

## 준비된 코드
- server/worker.mjs : POST /api/analyze, GET /health
- assets/mt-backend.js : 보호된 same-origin 배포에서만 분석 요청; 공개 github.io에서 호출 차단
- assets/mt-research-ui.js : 분석 결과와 시장 시세 제공 여부 표시
- tests/mt-backend.test.cjs : 공개 페이지 호출 차단 및 보호된 오리진 동작 테스트

## 실제 배포에 필요한 순서
1. Cloudflare 계정에서 Zero Trust와 Workers를 설정한다.
2. Cloudflare Workers에 server/worker.mjs를 배포한다. OPENAI_API_KEY를 Worker Secret으로 등록한다. OPENAI_MODEL은 기본 gpt-4.1-mini 또는 사용 가능한 모델로 지정한다.
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