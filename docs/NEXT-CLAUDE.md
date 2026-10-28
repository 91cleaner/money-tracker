# 클로드 다음 작업 (실장 작성, 2026-10-28 15:55 KST)

시작 전에 HANDOFF.md와 docs/AI-ROLES.md 먼저 읽기.
규칙: 매번 최신 main에서 새 브랜치, 하나 끝나면 PR만(합치지 마). 공식 자료+출처, "데이터상" 중립 표현, 투자 조언 금지, 키 절대 출력 금지. 백악관 수집기(data/us/whitehouse.json)는 다른 쪽이 만드는 중이니 수집 코드는 건드리지 말고 화면만.

1. PR #165(대장 모드) 고치기: scripts/test_world_intelligence.mjs 3번 테스트(지도 컨테이너 정확히 1개)가 통과하게. 최신 main 반영 후 같은 PR에 푸시.
2. 공유 버튼: 관제실·company·member·sector 페이지에 "X에 공유". 현재 회사/경로의 핵심 인사이트 1줄 + 출처 + 페이지 링크를 https://x.com/intent/post?text= 로 열기. 페이지별 og:title/og:description 메타도.
3. 법안 페이지 bill.html?id=: 법안 하나가 지도 위에서 나라별로 어떻게 이어지는지(미국 의회 → 관련 회사 → 해외 공장·다른 나라 정책)와 날짜순 "최근 무슨 일" 타임라인. 기존 data/us·data/policy 데이터만 사용, 검색 결과에서 링크.
4. 알림바 자리: data/us/whitehouse.json 이 있으면 맨 앞에 🏛️ 백악관 조치, 없거나 비어도 안 깨지게. 형식 [{date,title,type,url,industries[]}] 가정.
5. 모바일 점검: 관제실·company·member·sector·bill 을 390px 폭에서 가로 스크롤·겹침 없게.
