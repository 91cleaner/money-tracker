"""Company HQ country for the card's country-policy box.
Source: SEC EDGAR company_tickers.json + submissions API (addresses.business.stateOrCountry, official, free).
Exchange suffix (.KS/.T/.TW/.DE/.PA/.AS/.CO) used only for tickers not in SEC data."""
import json, os, time, urllib.request, datetime as dt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": os.environ.get("SEC_USER_AGENT") or os.environ.get("SEC_UA") or "MoneyTracker research Leecheolhan91@gmail.com"}
EDGAR = {"M0": "jp", "F5": "tw", "F4": "cn", "K3": "cn", "M5": "kr",
         "P7": "eu", "2M": "eu", "I0": "eu", "L2": "eu", "C9": "eu", "G7": "eu", "V7": "eu", "H9": "eu",
         "L6": "eu", "U3": "eu", "N4": "eu", "C4": "eu", "S1": "eu", "K7": "eu", "H0": "eu", "E9": "eu"}
SUF = {"KS": "kr", "KQ": "kr", "T": "jp", "TW": "tw", "DE": "eu", "PA": "eu", "AS": "eu", "CO": "eu"}
def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30))
def main():
    ents = json.load(open(os.path.join(ROOT, "data", "search-index.json")))["entities"]
    syms = {k: v.get("symbol") or k.split(":", 1)[1] for k, v in ents.items() if v.get("type") == "company"}
    cik = {r["ticker"].upper(): r["cik_str"] for r in get("https://www.sec.gov/files/company_tickers.json").values()}
    out = {}
    for k, s in syms.items():
        s2 = s.upper().replace(".", "-")
        if s2 in cik:
            try:
                sub0 = get(f"https://data.sec.gov/submissions/CIK{cik[s2]:010d}.json"); a = sub0["addresses"]["business"]
                codes = [a.get("stateOrCountry") or ""]
                sub = sub0
                codes += [sub.get("stateOfIncorporation") or "", ((sub.get("addresses") or {}).get("mailing") or {}).get("stateOrCountry") or ""]
                cc = next((EDGAR[c] for c in codes if c in EDGAR), None)
                if cc: out[k] = {"cc": cc, "how": "SEC EDGAR address/incorporation " + "/".join(c for c in codes if c)}
                elif sub.get("category", "").lower().find("foreign") >= 0 or any(c and not c.isalpha() for c in codes): print("unmapped", s, codes)
            except Exception as e: print(s, type(e).__name__)
            time.sleep(0.12)
        elif "." in s and SUF.get(s.rsplit(".", 1)[1]):
            out[k] = {"cc": SUF[s.rsplit(".", 1)[1]], "how": "exchange suffix ." + s.rsplit(".", 1)[1]}
    p = os.path.join(ROOT, "data", "policy", "ticker-country.json")
    json.dump({"updated": dt.date.today().isoformat(), "v": 2, "source": "SEC EDGAR submissions API (business address) + exchange suffix", "map": out}, open(p, "w"), ensure_ascii=False, indent=0)
    print(len(out), "non-US mapped")
if __name__ == "__main__": main()
