# House PTR 날짜 모순: 공식 원문 대조 기록 (2026-11-08)

> **상태: 원문에 기재된 날짜 모순 확인 / 실제 거래일 미확정 / 공개 집계 반영 보류 권고.**
> 이 문서는 데이터 수정이나 법률 위반 판단이 아니라 공개 House Clerk PTR 원문의 정합성 검토다. `docs/AI-ROLES.md`에 따라 GPT는 `data/`, 수집기, 화면, 배포 설정을 수정하지 않는다.

## 배경 및 범위

- 관련 이슈: [#527](https://github.com/91cleaner/money-tracker/issues/527). [#526](https://github.com/91cleaner/money-tracker/pull/526)의 읽기 전용 진단은 **재생성된 Pages 거래 4,385행 중 날짜 이상 11행**을 보고했다. 11행과 아래 **8개 신고서 ID는 서로 다른 단위**다.
- 이 문서는 이슈에 기록된 8개 Filing ID의 **공식 PDF를 직접 열어**, 각 PDF에서 확인되는 **대표적인 날짜 모순 1건 이상**을 대조했다. 원장 11개 행 각각과 원문 행을 일대일로 연결한 완전한 검증은 **아직 아님**.
- 아래 날짜는 공식 PDF의 미국식 `MM/DD/YYYY` 표기를 그대로 옮겼다. `Notification Date`와 `Digitally Signed`는 서로 다른 항목이다. 서명일을 모든 경우의 법적 접수일과 동일하다고 단정하지 않는다.

| 공식 Filing ID / PDF | 원문에서 확인한 대표 자산 | Transaction Date | Notification Date | Digitally Signed | 원문에서 관찰한 정합성 문제 |
| --- | --- | --- | --- | --- | --- |
| [20030977](https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20030977.pdf) (p.22) | US Treasury Note 3/31/2025 | 10/25/2025 | 08/11/2025 | 01/13/2026 | 통지일이 거래일보다 빠름 |
| [20033330](https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2025/20033330.pdf) (p.1) | VLG FL CDD #14 SPL ASSMNT REV | 10/24/2025 | 10/24/2025 | 10/22/2025 | 서명일이 거래일보다 빠름 |
| [20033889](https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20033889.pdf) (p.1) | Sony Group ADR (SONY) | 12/26/2026 | 01/21/2026 | 02/09/2026 | 거래일이 2026-11-08 현재 미래이고 통지·서명보다 늦음 |
| [20034099](https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20034099.pdf) (p.1) | Pinterest (PINS), spouse RSUs | 06/11/2026 | 06/11/2026 | 06/01/2026 | 서명일이 거래일보다 빠름 |
| [20034300](https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20034300.pdf) (p.1) | Hermeus Corp | 05/04/2026 | 05/01/2026 | 05/05/2026 | 통지일이 거래일보다 빠름 |
| [20034520](https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20034520.pdf) (p.1) | StarCloud | 05/04/2026 | 05/01/2026 | 05/21/2026 | 통지일이 거래일보다 빠름 |
| [20035067](https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035067.pdf) (p.1) | CarterBaldwin | 07/31/2026 | 07/13/2026 | 07/27/2026 | 통지일과 서명일이 모두 거래일보다 빠름 |
| [20035563](https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035563.pdf) (p.4–5) | Walt Disney Company (DIS) | 10/28/2026 | 10/28/2026 | 10/27/2026 | 서명일이 거래일보다 빠름 |

## 판정과 데이터 담당자 인수인계

1. **관찰 사실:** 위 대표 날짜들은 수집기의 재가공 값만이 아니라 공식 House Clerk PDF 자체에 표시된다. 따라서 전부를 **파서 오류라고 단정하거나 2025년 등으로 임의 보정해서는 안 된다**.
2. **미확정:** 실제 거래일, 사후 정정 신고 존재 여부, 각 원장 행과 원문 자산 행의 정확한 매칭, 신고서 자체의 기재 오류 원인. 날짜 모순만으로 특정인의 위법행위나 거래 의도를 주장하지 않는다.
3. **실장/데이터 담당 요청:** 각 행을 `filing_id + asset + transaction_type + owner + reported_date`로 공식 원문에 대조하고, 정정 원문이 없는 모순 행은 `source_date_inconsistent` 같은 **검증 대기** 상태로 분류해 검증된 거래 집계·수익률·지도 경로에서 격리한다. 원문 링크와 신고값은 감사 추적용으로 보존한다.
4. **배포 기준:** #526 날짜 preflight를 우회하지 않는다. 원본 데이터/수집기 정리, 공개 산출물 재생성, **같은 SHA의** 테스트 및 Pages 검사 성공, 지도·모바일 확인, 최종 담당자 승인 후에만 배포한다.

## 공개 제품의 연결 상태

- House PTR는 **사후 자기신고 자료**이며 실시간 체결 피드가 아니다. **실시간 체결 데이터: 미연결**.
- **생성형 AI: 미연결**. 질문/검색 화면의 기존 규칙·정적 데이터 응답을 AI 실시간 추론으로 표시하지 않는다.
- GitHub 저장소는 검토 시점 **public**이다. 비공개 저장소라는 표현을 사용하지 않는다.

_검증 방식: 2026-11-08 공식 House Clerk PDF의 추출 텍스트를 확인했고, 20030977 p.22 / 20034300 p.1 / 20035067 p.1은 페이지 이미지도 대조했다. PDF에서 확인한 대표 사례를 기록한 것이며, 전수 원장 정정 또는 운영 배포 성공을 의미하지 않는다._
