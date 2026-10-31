#!/usr/bin/env python3
"""data/us/trades.json 의 티커 → SEC EDGAR SIC 업종·회사명·본사 주/나라 + 업종→관련 상임위.

출처: SEC company_tickers.json, data.sec.gov/submissions (공식). 10 req/s 이하로 호출.
위원회 집계(committee_trade_counts)는 내부 분석용 데이터이며 개별 의원 거래를 화면에 공개하지 않는다(HANDOFF 규칙).

  SEC_USER_AGENT="MoneyTracker research Leecheolhan91@gmail.com" python3 scripts/build_ticker_sectors.py
"""
from __future__ import annotations
import json, os, re, time, urllib.request
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRADES = os.path.join(ROOT, "data", "us", "trades.json")
MEMBERS = os.path.join(ROOT, "data", "us", "members.json")
OUT = os.path.join(ROOT, "data", "us", "ticker-sectors.json")
CACHE = "/tmp/mt-sec-submissions-cache.json"
UA = (os.environ.get("SEC_USER_AGENT") or os.environ.get("SEC_UA") or "MoneyTracker research Leecheolhan91@gmail.com")

# SIC 범위 → 섹터 (SEC Division 기준을 앱용으로 단순화)
SIC_RANGES = [
    (100, 999, "agriculture"), (1000, 1299, "mining"), (1300, 1399, "energy"), (1400, 1499, "mining"),
    (1500, 1799, "construction"), (2000, 2199, "consumer_staples"), (2200, 2799, "industrials"),
    (2800, 2829, "materials"), (2830, 2836, "healthcare"), (2837, 2899, "materials"), (2900, 2999, "energy"),
    (3000, 3569, "industrials"), (3570, 3579, "technology"), (3580, 3659, "industrials"),
    (3660, 3699, "technology"), (3700, 3719, "industrials"), (3720, 3729, "aerospace_defense"),
    (3730, 3759, "industrials"), (3760, 3769, "aerospace_defense"), (3770, 3799, "industrials"),
    (3800, 3829, "industrials"), (3840, 3851, "healthcare"), (3852, 3999, "industrials"),
    (4000, 4799, "transportation"), (4800, 4899, "communications"), (4900, 4999, "utilities"),
    (5000, 5199, "industrials"), (5200, 5999, "consumer_discretionary"), (6000, 6799, "financials"),
    (6798, 6798, "real_estate"), (7000, 7369, "consumer_discretionary"), (7370, 7379, "technology"),
    (7380, 7999, "consumer_discretionary"), (8000, 8099, "healthcare"), (8100, 8999, "services"),
    (9000, 9999, "other"),
]
SECTOR_COMMITTEES = {
    "technology": ["Commerce, Science, and Transportation", "Energy and Commerce", "Science, Space, and Technology", "House Select the Strategic Competition Between the United States and the Chinese Communist Party"],
    "communications": ["Commerce, Science, and Transportation", "Energy and Commerce"],
    "healthcare": ["Health, Education, Labor, and Pensions", "Finance", "Energy and Commerce", "Ways and Means"],
    "financials": ["Banking, Housing, and Urban Affairs", "Financial Services"],
    "real_estate": ["Banking, Housing, and Urban Affairs", "Financial Services"],
    "energy": ["Energy and Natural Resources", "Energy and Commerce", "Natural Resources"],
    "utilities": ["Energy and Natural Resources", "Energy and Commerce"],
    "mining": ["Energy and Natural Resources", "Natural Resources"],
    "aerospace_defense": ["Armed Services", "Appropriations"],
    "industrials": ["Commerce, Science, and Transportation", "Transportation and Infrastructure", "Energy and Commerce"],
    "transportation": ["Commerce, Science, and Transportation", "Transportation and Infrastructure"],
    "construction": ["Environment and Public Works", "Transportation and Infrastructure"],
    "agriculture": ["Agriculture, Nutrition, and Forestry", "Agriculture"],
    "consumer_staples": ["Agriculture, Nutrition, and Forestry", "Agriculture", "Energy and Commerce"],
    "consumer_discretionary": ["Commerce, Science, and Transportation", "Energy and Commerce"],
    "materials": ["Environment and Public Works", "Energy and Commerce"],
    "services": ["Small Business and Entrepreneurship", "Small Business"],
    "other": [],
}

def sic_sector(sic):
    try: n = int(sic)
    except (TypeError, ValueError): return None
    if n == 6798: return "real_estate"
    for a, b, s in SIC_RANGES:
        if a <= n <= b: return s
    return "other"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)
        except Exception:
            time.sleep(1.5 * (i + 1))
    return None

SYM = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "us", "symbol-changes.json")))["confirmed"]
def main():
    trades = json.load(open(TRADES))["trades"]
    counts = Counter(t["tk"] for t in trades if t.get("tk"))
    members = {m["id"]: m for m in json.load(open(MEMBERS))["members"]}
    tick = get("https://www.sec.gov/files/company_tickers.json") or {}
    cik_by = {}
    for v in tick.values():
        cik_by.setdefault(v["ticker"].upper(), v["cik_str"])
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    out, missing = {}, []
    for tk in sorted(counts):
        cik = cik_by.get(tk.upper()) or cik_by.get(tk.upper().replace(".", "-"))
        if tk in SYM: cik = SYM[tk]["old_cik"]  # 의원 거래 당시 이 티커를 쓰던 회사(SEC 8-K 표지로 확인, data/us/symbol-changes.json)
        if not cik:
            missing.append(tk); continue
        key = str(cik)
        if key not in cache:
            time.sleep(0.12)  # < 10 req/s
            d = get(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json")
            if not d: missing.append(tk); continue
            b = (d.get("addresses") or {}).get("business") or {}
            cache[key] = {"name": d.get("name"), "sic": d.get("sic"), "sicDescription": d.get("sicDescription"),
                          "state": b.get("stateOrCountry"), "stateDesc": b.get("stateOrCountryDescription"),
                          "city": b.get("city")}
        c = cache[key]
        sec = sic_sector(c["sic"])
        out[tk] = {"cik": int(cik), "name": c["name"], "sic": c["sic"] or None, "sic_desc": c["sicDescription"] or None,
                   "sector": sec, "hq_city": c["city"], "hq_state_or_country": c["state"],
                   "hq_desc": c["stateDesc"], "trade_rows": counts[tk],
                   "source_url": f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json"}
    json.dump(cache, open(CACHE, "w"))
    # 업종×위원회 집계 (내부용)
    agg = defaultdict(Counter)
    for t in trades:
        r = out.get(t.get("tk") or "")
        m = members.get(t.get("id"))
        if not r or not r["sector"] or not m: continue
        mine = {re.sub(r" \(.*", "", k) for k in m.get("cmits", [])}
        for cm in SECTOR_COMMITTEES.get(r["sector"], []):
            if cm in mine: agg[r["sector"]][cm] += 1
    res = {
        "updated": time.strftime("%Y-%m-%d"),
        "source": "SEC EDGAR company_tickers.json + data.sec.gov submissions (SIC, business address)",
        "note": "SIC→sector는 앱용 단순화 매핑. 본사는 SEC 제출 서류 사업장 주소 기준.",
        "sector_committees_note": "자체 분류, 공식 관할 아님.", "sector_committees": SECTOR_COMMITTEES,
        "committee_trade_counts": {"_flag": "위원회·업종 단위 집계(자체 분류). 개별 거래는 PTR 신고 기준으로 공개(2026-10-28 결정).",
                                   "by_sector": {k: dict(v) for k, v in agg.items()}},
        "total_tickers": len(counts), "mapped": len(out), "unmapped": sorted(set(missing)),
        "tickers": out,
    }
    with open(OUT, "w") as f: json.dump(res, f, ensure_ascii=False, indent=1)
    print(f"tickers={len(counts)} mapped={len(out)} unmapped={len(set(missing))}")

if __name__ == "__main__":
    main()
