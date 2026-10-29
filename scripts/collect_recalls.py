#!/usr/bin/env python3
"""Recalls per company -> data/us/recalls.json (key-free, official).
NHTSA vehicle recalls (api.nhtsa.gov) for automaker tickers, openFDA enforcement (drug/device/food) for all tracked companies.
Strict match: manufacturer / recalling firm name, after removing punctuation and legal suffixes, must equal the company name.
  python3 scripts/collect_recalls.py [N] [years]"""
import json, os, sys, time, datetime, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from us_company_list import companies, ROOT
from collect_assistance import norm
OUT = os.path.join(ROOT, "data", "us", "recalls.json")
UA = {"User-Agent": "MoneyTracker research (github.com/91cleaner/money-tracker)"}
MAKES = {"TSLA": ["TESLA"], "F": ["FORD", "LINCOLN"], "GM": ["CHEVROLET", "GMC", "CADILLAC", "BUICK"], "RIVN": ["RIVIAN"], "LCID": ["LUCID"],
         "STLA": ["JEEP", "RAM", "DODGE", "CHRYSLER"], "TM": ["TOYOTA", "LEXUS"], "HMC": ["HONDA", "ACURA"]}
def get(url):
    for i in range(4):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))
        except urllib.error.HTTPError as e:
            if e.code == 404: return {}
            time.sleep(3 * (i + 1))
        except Exception: time.sleep(3 * (i + 1))
    return None
def nhtsa(make, years, key):
    out = {}
    for y in years:
        m = get(f"https://api.nhtsa.gov/products/vehicle/models?modelYear={y}&make={urllib.parse.quote(make)}&issueType=r") or {}
        for model in sorted({r["model"] for r in m.get("results", [])}):
            d = get(f"https://api.nhtsa.gov/recalls/recallsByVehicle?make={urllib.parse.quote(make)}&model={urllib.parse.quote(model)}&modelYear={y}") or {}
            for r in d.get("results", []):
                if norm(r.get("Manufacturer")) != key: continue
                c = r.get("NHTSACampaignNumber"); dd = (r.get("ReportReceivedDate") or "").split("/")
                date = f"{dd[2]}-{dd[1]}-{dd[0]}" if len(dd) == 3 else ""
                out.setdefault(c, {"src": "NHTSA", "id": c, "date": date, "what": (r.get("Component") or "")[:90], "units": None,
                    "url": "https://www.nhtsa.gov/recalls?nhtsaId=" + c})
            time.sleep(0.15)
    return out
def fda(kind, q, key, since):
    url = f"https://api.fda.gov/{kind}/enforcement.json?search=" + urllib.parse.quote(f'recalling_firm:"{q}" AND report_date:[{since} TO 20991231]') + "&limit=100"
    d = get(url)
    if d is None: return None
    out = {}
    for r in d.get("results", []):
        if norm(r.get("recalling_firm")) != key: continue
        n = r.get("recall_number"); rd = r.get("report_date") or ""
        out[n] = {"src": "openFDA " + kind, "id": n, "date": f"{rd[:4]}-{rd[4:6]}-{rd[6:8]}", "what": (r.get("product_description") or "")[:90],
            "class": r.get("classification"), "url": f"https://api.fda.gov/{kind}/enforcement.json?search=recall_number:%22{n}%22"}
    return out
def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 250; yrs = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    today = datetime.date.today(); since = today.replace(year=today.year - yrs)
    res, miss = {}, []
    for c in companies(n):
        key = norm(c["name"]) or norm(c["query"]); items = {}
        for mk in MAKES.get(c["ticker"], []):
            items.update({k: v for k, v in nhtsa(mk, range(since.year, today.year + 2), key).items() if v["date"] >= since.isoformat()})
        for kind in ("drug", "device", "food"):
            r = fda(kind, key.title() if key else c["query"], key, since.strftime("%Y%m%d"))
            if r is None: miss.append(c["ticker"] + ":" + kind)
            else: items.update(r)
            time.sleep(0.3)
        if not items: continue
        L = sorted(items.values(), key=lambda x: x["date"], reverse=True)
        by = {}
        for x in L: by[x["src"]] = by.get(x["src"], 0) + 1
        res[c["ticker"]] = {"match_key": key, "n": len(L), "by_source": by, "latest": L[0]["date"], "items": L[:12], "source_url": L[0]["url"]}
    json.dump({"updated": today.isoformat(), "since": since.isoformat(), "source": "NHTSA Recalls API, openFDA enforcement reports (drug, device, food)",
               "source_url": "https://api.nhtsa.gov/ , https://open.fda.gov/apis/",
               "note": "Strict manufacturer / recalling-firm name match; recalls filed under subsidiaries or other names are not included. Date = NHTSA report received date or FDA report date. Facts only, not investment advice.",
               "checked": n, "matched": len(res), "errors": miss, "companies": res}, open(OUT, "w"), ensure_ascii=False, indent=1)
    print("checked", n, "matched", len(res), "errors", len(miss))
if __name__ == "__main__": main()
