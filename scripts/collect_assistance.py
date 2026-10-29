#!/usr/bin/env python3
"""USAspending.gov assistance awards (grants 02-05, loans 07-08) per company -> data/us/assistance-awards.json
Separate from contracts (federal-awards.json). Exact recipient matching only: the recipient name, after removing
punctuation and legal suffixes (INC, CORP, LLC ...), must equal the company name the same way. Values are obligations.
Key-free.  python3 scripts/collect_assistance.py [N]"""
import json, os, re, sys, time, datetime, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from us_company_list import companies, ROOT
OUT = os.path.join(ROOT, "data", "us", "assistance-awards.json")
API = "https://api.usaspending.gov/api/v2/search/"
GRANT, LOAN = ["02", "03", "04", "05", "F001", "F002"], ["07", "08", "F003", "F004"]
F = {"grant": ["Award ID", "Recipient Name", "Award Amount", "Start Date", "Awarding Agency", "generated_internal_id", "Description"],
     "loan": ["Award ID", "Recipient Name", "Loan Value", "Subsidy Cost", "Issued Date", "Awarding Agency", "generated_internal_id", "Description"]}
DT = {"grant": "Start Date", "loan": "Issued Date"}
SUF = {"INC", "INCORPORATED", "CORP", "CORPORATION", "CO", "COMPANY", "LLC", "LTD", "LIMITED", "PLC", "LP", "NV", "SA", "AG", "THE", "&", "AND", "HOLDINGS"}
def norm(s):
    w = re.sub(r"[.,/()'\"]", " ", (s or "").upper()).split()
    while w and w[-1] in SUF: w.pop()
    while w and w[0] == "THE": w.pop(0)
    return " ".join(w)
def post(path, body):
    for i in range(5):
        try:
            r = urllib.request.Request(API + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "User-Agent": "MoneyTracker research (github.com/91cleaner/money-tracker)"})
            return json.load(urllib.request.urlopen(r, timeout=150))["results"]
        except Exception:
            time.sleep(3 * (i + 1))
    return None
def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 250
    today = datetime.date.today(); fy = today.year + (1 if today.month >= 10 else 0)
    start, end = f"{fy-3}-10-01", today.isoformat()
    tp = [{"start_date": start, "end_date": end}]
    res, miss = {}, []
    for c in companies(n):
        key = norm(c["name"]) or norm(c["query"])
        rec = []
        for codes in (GRANT, LOAN):
            r = post("spending_by_category/recipient/", {"filters": {"recipient_search_text": [c["query"]], "award_type_codes": codes, "time_period": tp}, "limit": 50})
            if r is None: miss.append(c["ticker"]); break
            rec += r
        else: r = 1
        if r is None: continue
        rec = [r for r in rec if norm(r.get("name")) == key]
        if not rec: continue
        names = sorted({r["name"] for r in rec}); ueis = sorted({r.get("uei") for r in rec if r.get("uei")})
        out = {"match_key": key, "recipient_names": names, "uei": ueis, "grants_usd": 0.0, "loans_usd": 0.0, "awards": []}
        for lab, codes in (("grant", GRANT), ("loan", LOAN)):
            rows = post("spending_by_award/", {"filters": {"recipient_search_text": names, "award_type_codes": codes, "time_period": tp},
                "fields": F[lab], "limit": 100, "page": 1, "sort": DT[lab], "order": "desc"})
            if rows is None: miss.append(c["ticker"] + ":" + lab); continue
            for a in rows:
                if norm(a.get("Recipient Name")) != key: continue
                amt = float((a.get("Award Amount") if lab == "grant" else a.get("Subsidy Cost")) or 0)
                out[lab + "s_usd"] += amt
                out["awards"].append({"type": lab, "id": a.get("Award ID"), "date": a.get(DT[lab]), "usd": round(amt, 2),
                    "loan_face_usd": a.get("Loan Value") if lab == "loan" else None, "agency": a.get("Awarding Agency"),
                    "desc": (a.get("Description") or "")[:140], "url": "https://www.usaspending.gov/award/" + urllib.parse.quote(a.get("generated_internal_id") or "")})
            time.sleep(0.3)
        if not out["awards"] or not (out["grants_usd"] or out["loans_usd"]): continue
        out["awards"].sort(key=lambda a: a["date"] or "", reverse=True)
        out["n"] = len(out["awards"]); out["awards"] = out["awards"][:8]
        out["grants_usd"], out["loans_usd"] = round(out["grants_usd"], 2), round(out["loans_usd"], 2)
        out["source_url"] = out["awards"][0]["url"]
        res[c["ticker"]] = out
        time.sleep(0.3)
    json.dump({"updated": today.isoformat(), "source": "USAspending.gov API v2 (assistance: grants 02-05, loans 07-08)",
               "source_url": "https://api.usaspending.gov/", "period": [start, end],
               "note": "Obligations, not payments. Exact recipient-name match after removing legal suffixes; subsidiaries under other names are not included. Loans: obligated amount (subsidy cost) shown; face value kept separately.",
               "checked": n, "matched": len(res), "errors": miss, "companies": res}, open(OUT, "w"), ensure_ascii=False, indent=1)
    print("checked", n, "matched", len(res), "errors", len(miss))
if __name__ == "__main__": main()
