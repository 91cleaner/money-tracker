#!/usr/bin/env python3
"""House PTR history backfill -> data/us/history/ptr-{YEAR}.json (private, not shipped to Pages).
Source: U.S. House Clerk yearly disclosure index ZIP ({YEAR}FD.zip, FilingType P) and the e-filed PTR PDFs.
Scanned/handwritten filings (DocID starting 8/9) are skipped and counted, never guessed.
Rows reuse extract_house_ptr.parse_row (date, code P/S/E, reported amount range). Facts only.
  python3 scripts/backfill_house_ptr.py 2020 2025"""
import io, json, os, sys, time, zipfile, urllib.request, datetime
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extract_house_ptr as X
ROOT = X.ROOT
BASE = "https://disclosures-clerk.house.gov/public_disc/"
UA = {"User-Agent": "money-tracker research (github.com/91cleaner/money-tracker)"}
def get(u):
    for i in range(4):
        try: return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read()
        except Exception:
            time.sleep(2 + 3 * i)
    return None
def mdy(s):
    try: return datetime.datetime.strptime(s, "%m/%d/%Y").date().isoformat()
    except Exception: return None
def year(y):
    z = zipfile.ZipFile(io.BytesIO(get(f"{BASE}financial-pdfs/{y}FD.zip")))
    root = ET.fromstring(z.read(f"{y}FD.xml"))
    P = [{c.tag: (c.text or "").strip() for c in e} for e in root if e.findtext("FilingType") == "P"]
    scanned = [p for p in P if p["DocID"][:1] in "89"]
    elec = [p for p in P if p["DocID"][:1] not in "89"]
    def one(p):
        url = f"{BASE}ptr-pdfs/{y}/{p['DocID']}.pdf"
        who = " ".join(x for x in (p.get("First"), p.get("Last")) if x)
        rec = {"member": who, "filing_date": mdy(p.get("FilingDate")), "document_url": url, "id": p["DocID"]}
        raw = get(url)
        if not raw: return p, None
        try: rows = X.extract(raw, rec)
        except Exception: return p, None
        return p, [{"tk": r["ticker"], "asset": r["asset"], "ty": r["type"], "d": r["transaction_date"], "fd": r["notification_date"],
                    "amt": f"${r['amount_min_usd']:,} - ${r['amount_max_usd']:,}", "c": "h", "who": who, "st": p.get("StateDst"),
                    "doc": url, "filed": rec["filing_date"]} for r in rows]
    out, failed, norows = [], 0, 0
    with ThreadPoolExecutor(4) as ex:
        for p, rows in ex.map(one, elec):
            if rows is None: failed += 1
            elif not rows: norows += 1
            else: out += rows
    out.sort(key=lambda r: (r["d"], r["who"]))
    meta = {"year": y, "ptr_filings": len(P), "electronic": len(elec), "scanned_skipped": len(scanned),
            "electronic_no_parsed_rows": norows, "fetch_or_parse_failed": failed, "rows": len(out), "rows_with_ticker": sum(1 for r in out if r["tk"])}
    json.dump({"updated": datetime.date.today().isoformat(), "source": "U.S. House Clerk financial disclosures (PTR)",
               "source_url": f"{BASE}financial-pdfs/{y}FD.zip",
               "note": "Machine-parsed from e-filed PTR PDFs. Amounts are reported ranges. d=transaction date, filed=report filing date. Scanned/handwritten filings skipped.",
               "meta": meta, "trades": out}, open(os.path.join(ROOT, "data/us/history", f"ptr-{y}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(json.dumps(meta), flush=True)
if __name__ == "__main__":
    a = sys.argv[1:] or ["2020", "2025"]
    for y in range(int(a[0]), int(a[-1]) + 1): year(y)
