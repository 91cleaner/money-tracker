#!/usr/bin/env python3
"""USAspending.gov 연방 계약(A-D) 수주 집계 → data/us/federal-awards.json
대상: scripts/us_company_list.py 상위 N개(기본 250).
수령자 매칭: 법인 접미어를 뗀 수령자 이름이 회사 검색어와 정확히 같거나(ALIASES의 확인된 자회사·옛 이름 포함) 일치할 때만.
동명·유사명 법인(예: TESLA INDUSTRIES)은 제외. 이후 기관·주별 집계는 각 수령자의 recipient_id로만 필터.
금액 기준: USAspending spending_by_category amount = 기간 내 의무액(obligations). 합계와 기관·주별 값은 같은 필터·같은 기간.
기간: 최근 3개 회계연도 시작일(FY 시작 10/1)부터 오늘까지. 키 불필요.
  python3 scripts/collect_federal_awards.py [N]"""
import json, os, sys, time, datetime, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from us_company_list import companies, clean, ROOT
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
# 확인된 자회사·옛 법인명 (정확한 수령자 이름)
ALIASES = {
    "PLTR": {"PALANTIR USG INC"},   # Palantir Technologies의 연방 전담 자회사
    "TSLA": {"TESLA MOTORS INC"},   # Tesla, Inc.의 옛 법인명
}
# 자회사 이름으로 계약하는 방산 대기업: 회사명으로 시작하는 수령자를 자회사로 포함 (검색어가 고유한 경우만)
FAMILY = {"BA", "GD", "LMT", "NOC"}
def match(c, name):
    n = (name or "").upper().strip()
    if n.startswith("THE "): n = n[4:]
    if c["ticker"] in FAMILY and n.startswith(c["query"] + " "): return True
    return clean(n) == c["query"] or n in ALIASES.get(c["ticker"], set())
def recipients(f):
    out = []
    for page in (1, 2, 3):
        r = post("recipient", {"filters": f, "limit": 100, "page": page})
        if r is None: return None if page == 1 else out
        out += r
        if len(r) < 100: break
    return out
def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 250
    today = datetime.date.today(); fy = today.year + (1 if today.month >= 10 else 0)
    start, end = f"{fy-3}-10-01", today.isoformat()
    res, miss = {}, []
    for c in companies(n):
        f = {"recipient_search_text": [c["query"]], "award_type_codes": ["A", "B", "C", "D"], "time_period": [{"start_date": start, "end_date": end}]}
        rec = recipients(f)
        if rec is None: miss.append(c["ticker"]); continue
        rec = [r for r in rec if match(c, r.get("name")) and r.get("uei")]
        if not rec: continue
        rec = sorted(rec, key=lambda r: -(r.get("amount") or 0))[:25]
        names = sorted({r.get("name") or "" for r in rec}); ueis = sorted({r["uei"] for r in rec})
        agm, stm, partial = {}, {}, False
        for r in rec:  # recipient_id 필터는 정확히 그 수령자만 (UEI 텍스트 검색은 모회사·자회사까지 섞임)
            g = dict(f, recipient_id=r["recipient_id"]); g.pop("recipient_search_text", None)
            for cat, m in (("awarding_agency", agm), ("state_territory", stm)):
                rows = post(cat, {"filters": g, "limit": 100})
                if rows is None: partial = True; continue
                for x in rows:
                    k = x.get("code") or x.get("name")
                    e = m.setdefault(k, {"name": x.get("name"), "code": x.get("code"), "usd": 0.0}); e["usd"] += x.get("amount") or 0
        if partial: miss.append(c["ticker"] + ":partial")
        ag = sorted(agm.values(), key=lambda x: -x["usd"]); st = sorted(stm.values(), key=lambda x: -x["usd"])
        rec_total = round(sum(r.get("amount") or 0 for r in rec), 2)
        ag_total = round(sum(x["usd"] for x in ag), 2)
        if not partial and abs(ag_total - rec_total) > max(1.0, abs(rec_total) * 0.001): miss.append(c["ticker"] + ":basis_mismatch")
        res[c["ticker"]] = {"query": c["query"], "recipient_names": names[:10], "recipient_ueis": ueis[:10],
            "basis": "obligations", "includes_subsidiaries": c["ticker"] in FAMILY or c["ticker"] in ALIASES, "total_usd": rec_total,
            "top_agencies": [{"name": a["name"], "code": a["code"], "usd": round(a["usd"], 2)} for a in ag[:5]],
            "top_states": [{"code": s["code"], "name": s["name"], "usd": round(s["usd"], 2)} for s in st[:5]],
            "source_url": "https://www.usaspending.gov/search/?hash=&keyword=" + urllib.request.quote(c["query"])}
        time.sleep(0.3)
    json.dump({"updated": today.isoformat(), "source": "USAspending.gov API v2 spending_by_category (contracts A-D)", "basis": "obligations",
               "source_url": "https://api.usaspending.gov/", "period": [start, end],
               "note": "Amounts are obligations (obligated dollars) in the period, for recipients whose name exactly matches the company (plus listed subsidiaries/former names), each queried by its exact USAspending recipient_id. Total, agency and state values share the same filter and period. Other subsidiaries may be missing; check the source. 금액은 기간 내 의무액 기준.",
               "checked": n, "matched": len(res), "errors": miss, "companies": res}, open(OUT, "w"), ensure_ascii=False, indent=1)
    print("checked", n, "matched", len(res), "errors", len(miss))
main()
