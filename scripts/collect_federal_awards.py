#!/usr/bin/env python3
"""USAspending.gov 연방 계약(A-D) 수주 집계 → data/us/federal-awards.json
대상: scripts/us_company_list.py 상위 N개(기본 250). 수령자 이름이 회사 검색어로 시작하는 것만 합산.
기간: 최근 2개 회계연도(FY 시작 10/1). 키 불필요.
  python3 scripts/collect_federal_awards.py [N]"""
import json, os, sys, time, datetime, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from us_company_list import companies, ROOT
OUT = os.path.join(ROOT, "data", "us", "federal-awards.json")
API = "https://api.usaspending.gov/api/v2/search/spending_by_category/"
def post(cat, body):
    for i in range(5):
        try:
            r = urllib.request.Request(API + cat + "/", data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "User-Agent": "MoneyTracker research"})
            return json.load(urllib.request.urlopen(r, timeout=150))["results"]
        except Exception:
            time.sleep(3 * (i + 1))
    return None
def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 250
    today = datetime.date.today(); fy = today.year + (1 if today.month >= 10 else 0)
    start, end = f"{fy-3}-10-01", today.isoformat()
    res, miss = {}, []
    for c in companies(n):
        f = {"recipient_search_text": [c["query"]], "award_type_codes": ["A", "B", "C", "D"], "time_period": [{"start_date": start, "end_date": end}]}
        rec = post("recipient", {"filters": f, "limit": 50})
        if rec is None: miss.append(c["ticker"]); continue
        rec = [r for r in rec if (r.get("name") or "").upper().startswith(c["query"])]
        if not rec: continue
        names = sorted({r.get("name") or "" for r in rec})
        f["recipient_search_text"] = names[:10]
        ag = post("awarding_agency", {"filters": f, "limit": 5})
        st = post("state_territory", {"filters": f, "limit": 5})
        if ag is None or st is None:  # 이름 목록이 길면 실패할 때가 있어 검색어로 재시도
            f2 = dict(f, recipient_search_text=[c["query"]])
            ag = ag if ag is not None else post("awarding_agency", {"filters": f2, "limit": 5})
            st = st if st is not None else post("state_territory", {"filters": f2, "limit": 5})
            if ag is None or st is None: miss.append(c["ticker"] + ":partial")
        ag, st = ag or [], st or []
        res[c["ticker"]] = {"query": c["query"], "recipient_names": names[:10], "total_usd": round(sum(r.get("amount") or 0 for r in rec), 2),
            "top_agencies": [{"name": a.get("name"), "code": a.get("code"), "usd": round(a.get("amount") or 0, 2)} for a in ag],
            "top_states": [{"code": s.get("code"), "name": s.get("name"), "usd": round(s.get("amount") or 0, 2)} for s in st],
            "source_url": "https://www.usaspending.gov/search/?hash=&keyword=" + urllib.request.quote(c["query"])}
        time.sleep(0.3)
    json.dump({"updated": today.isoformat(), "source": "USAspending.gov API v2 spending_by_category (contracts A-D)",
               "source_url": "https://api.usaspending.gov/", "period": [start, end],
               "note": "데이터상 수령자 이름이 회사명으로 시작하는 계약만 합산. 자회사·동명 법인 누락/혼입 가능, 원문 확인 필요. state_territory는 USAspending 주별 집계 기준.",
               "checked": n, "matched": len(res), "errors": miss, "companies": res}, open(OUT, "w"), ensure_ascii=False, indent=1)
    print("checked", n, "matched", len(res), "errors", len(miss))
main()
