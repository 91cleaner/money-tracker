#!/usr/bin/env python3
"""US Treasury FiscalData (no key): total public debt + federal outlays -> data/us-fiscal.json.
Free official data only. Never fabricates; keeps the old file if nothing is fetched."""
import json, pathlib, urllib.request, urllib.parse, datetime
BASE = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service"


def get(path, params):
    url = BASE + path + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "MONEY-TRACKER-research/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8")).get("data", [])


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


out = {"source": "U.S. Treasury FiscalData", "source_url": "https://fiscaldata.treasury.gov/",
       "collected_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
fails = []
try:  # Debt to the Penny: daily total public debt outstanding (~400 rows = a bit over 1 year)
    rows = get("/v2/accounting/od/debt_to_penny", {"sort": "-record_date", "page[size]": "400",
                                                   "fields": "record_date,tot_pub_debt_out_amt"})
    pts = [{"date": r["record_date"], "value": num(r["tot_pub_debt_out_amt"])} for r in rows if num(r.get("tot_pub_debt_out_amt"))]
    pts.sort(key=lambda p: p["date"])
    if pts:
        latest = pts[-1]
        cut = (datetime.date.fromisoformat(latest["date"]) - datetime.timedelta(days=365)).isoformat()
        year_ago = next((p for p in pts if p["date"] >= cut), pts[0])
        out["debt"] = {"latest": latest, "year_ago": year_ago, "points": pts[-120:]}
except Exception as e:
    fails.append("debt: " + type(e).__name__ + " " + str(e)[:80])
try:  # Monthly Treasury Statement table 5: total outlays (fiscal-year-to-date)
    rows = get("/v1/accounting/mts/mts_table_5", {
        "sort": "-record_date", "page[size]": "200", "filter": "classification_desc:eq:Total Outlays",
        "fields": "record_date,classification_desc,current_month_gross_rcpt_outg_amt,current_fytd_gross_rcpt_outg_amt,current_fytd_rcpt_outg_amt"})
    rows = [r for r in rows if r.get("classification_desc") == "Total Outlays"]
    if rows:
        r = rows[0]
        fytd = num(r.get("current_fytd_rcpt_outg_amt")) or num(r.get("current_fytd_gross_rcpt_outg_amt"))
        if fytd:
            out["outlays"] = {"as_of": r["record_date"], "fytd": fytd, "month": num(r.get("current_month_gross_rcpt_outg_amt"))}
except Exception as e:
    fails.append("outlays: " + type(e).__name__ + " " + str(e)[:80])
for f in fails:
    print("::warning::FiscalData fetch failed - " + f)
if "debt" not in out and "outlays" not in out:
    raise SystemExit("No observations fetched; existing data preserved")
p = pathlib.Path("data/us-fiscal.json")
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print("Saved", [k for k in ("debt", "outlays") if k in out])
