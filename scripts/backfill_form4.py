#!/usr/bin/env python3
"""SEC Form 4 history backfill -> data/us/history/form4/{TICKER}.json (private, not shipped to Pages).
Source: SEC Insider Transactions Data Sets (quarterly Form 3/4/5 ZIPs, free, official). Open-market P/S rows only
for tracked issuers (by CIK). SEC_USER_AGENT env required; never printed. Requests are sequential (well under 10/s).
  SEC_USER_AGENT="..." python3 scripts/backfill_form4.py 2020 2025"""
import csv, io, json, os, sys, time, zipfile, urllib.request, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from us_company_list import ROOT, companies
UA = os.environ.get("SEC_USER_AGENT", "").strip()
LIST = "https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets"
csv.field_size_limit(10**8)
def get(u):
    for i in range(4):
        try: return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA, "Accept": "*/*"}), timeout=300).read()
        except Exception: time.sleep(3 + 5 * i)
    return None
def tsv(z, n): return csv.DictReader(io.TextIOWrapper(z.open(n), "utf-8", errors="ignore"), delimiter="\t", quoting=csv.QUOTE_NONE)
def iso(s):
    try: return datetime.datetime.strptime(s[:11], "%d-%b-%Y").date().isoformat()
    except Exception: return None
def num(s):
    try: return float(s)
    except Exception: return None
def main():
    if not UA: sys.exit("SEC_USER_AGENT required")
    a = sys.argv[1:] or ["2020", "2025"]; y0, y1 = int(a[0]), int(a[-1])
    ts = json.load(open(os.path.join(ROOT, "data/us/ticker-sectors.json")))["tickers"]
    cik = {}
    for c in companies():
        k = (ts.get(c["ticker"]) or {}).get("cik")
        if k: cik[str(int(k))] = c["ticker"]
    page = get(LIST).decode("utf-8", "ignore")
    import re
    links = sorted(set(re.findall(r'href="(/files/[^"]*?(\d{4})q(\d)_form345\.zip)"', page)))
    by = {}; quarters = []
    for path, y, q in links:
        if not (y0 <= int(y) <= y1): continue
        raw = get("https://www.sec.gov" + path); time.sleep(0.5)
        if not raw: print("skip", y, q, flush=True); continue
        z = zipfile.ZipFile(io.BytesIO(raw)); quarters.append(f"{y}q{q}")
        sub = {r["ACCESSION_NUMBER"]: r for r in tsv(z, "SUBMISSION.tsv") if r["DOCUMENT_TYPE"] in ("4", "4/A") and r["ISSUERCIK"].lstrip("0") in cik}
        own = {}
        for r in tsv(z, "REPORTINGOWNER.tsv"):
            if r["ACCESSION_NUMBER"] in sub and r["ACCESSION_NUMBER"] not in own: own[r["ACCESSION_NUMBER"]] = r
        n = 0
        for r in tsv(z, "NONDERIV_TRANS.tsv"):
            acc = r["ACCESSION_NUMBER"]
            if acc not in sub or r["TRANS_CODE"] not in ("P", "S"): continue
            s = sub[acc]; ic = s["ISSUERCIK"].lstrip("0"); o = own.get(acc, {})
            by.setdefault(cik[ic], []).append({"filed": iso(s["FILING_DATE"]), "date": iso(r["TRANS_DATE"]), "code": r["TRANS_CODE"],
                "shares": num(r["TRANS_SHARES"]), "price": num(r["TRANS_PRICEPERSHARE"]), "after": num(r["SHRS_OWND_FOLWNG_TRANS"]),
                "who": o.get("RPTOWNERNAME"), "role": (o.get("RPTOWNER_TITLE") or o.get("RPTOWNER_RELATIONSHIP") or "").strip() or None,
                "url": f"https://www.sec.gov/Archives/edgar/data/{ic}/{acc.replace('-', '')}/{acc}-index.htm"}); n += 1
        print(y, q, "rows", n, flush=True)
    d = os.path.join(ROOT, "data/us/history/form4"); os.makedirs(d, exist_ok=True)
    for tk, rows in by.items():
        rows.sort(key=lambda r: (r["date"] or "", r["who"] or ""))
        json.dump({"updated": datetime.date.today().isoformat(), "ticker": tk, "source": "SEC Insider Transactions Data Sets (Form 4)", "source_url": LIST,
                   "quarters": quarters, "note": "Open-market purchases (P) and sales (S) only.", "trades": rows},
                  open(os.path.join(d, f"{tk}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print("tickers", len(by), "rows", sum(map(len, by.values())), "quarters", len(quarters))
if __name__ == "__main__": main()
