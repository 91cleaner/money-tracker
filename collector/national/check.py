"""국회 API가 응답하지 않아 자료가 비면(출장 0건·의원 이력 0명) 실패로 끝내, 워크플로가 이번 회차 자료를 버리고 이전 자료를 지키게 한다."""
import json
import os
import sys

D = os.path.join(os.path.dirname(__file__), "..", "..", "data", "national")
t = json.load(open(os.path.join(D, "trips_raw.json"), encoding="utf-8")).get("trips") or []
h = json.load(open(os.path.join(D, "members_hist22.json"), encoding="utf-8"))
m = json.load(open(os.path.join(D, "members.json"), encoding="utf-8")).get("members") or []
if not t or not h or len(m) < 250:
    print(f"::warning::국회 API 응답이 비어(출장 {len(t)}건, 이력 {len(h)}명, 의원 {len(m)}명) 이번 회차 자료는 버리고 이전 자료를 유지")
    sys.exit(1)
print(f"check: 출장 {len(t)}건, 이력 {len(h)}명, 의원 {len(m)}명")
