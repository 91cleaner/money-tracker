#!/usr/bin/env python3
"""FEC 기업 PAC(분리 기금, organization_type=C) 집계 → data/us/pac-contributions.json
대상: us_company_list 상위 N개(기본 22; DEMO_KEY 시간당 한도 때문). FEC_API_KEY 환경변수가 있으면 그것을 쓰고 N을 늘릴 수 있다.
저장: 위원회 ID·이름, 해당 선거주기 수입·지출·연방 후보 위원회 기부 합계. 개별 후보 이름은 저장하지 않는다.
이전 결과는 유지(누적 갱신). 키 값은 출력하지 않는다.
  FEC_API_KEY=... python3 scripts/collect_pac_contributions.py [N]"""
import json, os, sys, time, datetime, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from us_company_list import companies, ROOT
OUT = os.path.join(ROOT, "data", "us", "pac-contributions.json")
KEY = os.environ.get("FEC_API_KEY") or "DEMO_KEY"
class Limit(Exception): pass
def get(path, **q):
    q["api_key"] = KEY
    try:
        return json.load(urllib.request.urlopen("https://api.open.fec.gov/v1" + path + "?" + urllib.parse.urlencode(q), timeout=60))
    except urllib.error.HTTPError as e:
        if e.code == 429: raise Limit()
        return None
def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 22
    y = datetime.date.today().year; cycle = y + (y % 2)
    old = json.load(open(OUT)) if os.path.exists(OUT) else {}
    res = old.get("companies", {}); done = 0; limited = False
    for c in companies(n):
        try:
            d = get("/committees/", q=c["query"], organization_type="C", per_page=5, sort="-last_file_date")
            if not d: continue
            cm = [r for r in d["results"] if r["name"].upper().startswith(c["query"]) and cycle in (r.get("cycles") or [])]
            if not cm: res.pop(c["ticker"], None); continue
            r = cm[0]; t = get(f"/committee/{r['committee_id']}/totals/", cycle=cycle)
            t = (t or {}).get("results") or [{}]; t = t[0]
            res[c["ticker"]] = {"query": c["query"], "committee_id": r["committee_id"], "committee_name": r["name"], "cycle": cycle,
                "receipts_usd": t.get("receipts"), "disbursements_usd": t.get("disbursements"),
                "to_federal_candidates_usd": t.get("fed_candidate_committee_contributions"),
                "coverage_end": (t.get("coverage_end_date") or "")[:10] or None,
                "source_url": f"https://www.fec.gov/data/committee/{r['committee_id']}/?cycle={cycle}"}
            done += 1; time.sleep(1 if KEY != "DEMO_KEY" else 2)
        except Limit:
            limited = True; break
    json.dump({"updated": datetime.date.today().isoformat(), "source": "FEC OpenFEC API (committees, committee totals)", "source_url": "https://api.open.fec.gov/developers/",
               "note": "데이터상 회사명으로 시작하는 기업 연계 PAC(organization_type=C) 1개만 집계. 회사 자금이 아니라 임직원 자발 기부로 운영되는 PAC임. 개별 후보 미표시.",
               "cycle": cycle, "key": "api key" if KEY != "DEMO_KEY" else "DEMO_KEY", "rate_limited": limited, "companies": res}, open(OUT, "w"), ensure_ascii=False, indent=1)
    print("updated", done, "total", len(res), "rate_limited", limited)
main()
