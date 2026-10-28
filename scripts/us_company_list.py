"""공통: 수집 대상 미국 기업 목록 (search-index·ticker-sectors 기준, 거래 행 많은 순).
ETF·지수·외국 상장은 제외. 이름은 SEC 등록명에서 법인 접미어를 뗀 검색어로 쓴다."""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUFFIX = re.compile(r"[,.]?\s+(INC|CORP|CORPORATION|CO|COMPANY|LTD|PLC|LLC|HOLDINGS?|GROUP|N\.?V|S\.?A|AG|SE|LP|L\.P|/DE/|/MD/|/NEW/|\\DE\\)\.?$", re.I)
def clean(name):
    n = (name or "").upper().replace("&AMP;", "&")
    for _ in range(4): n = SUFFIX.sub("", n).strip(" ,.")
    return n
def companies(limit=None):
    ts = json.load(open(os.path.join(ROOT, "data", "us", "ticker-sectors.json")))["tickers"]
    out = []
    for tk, t in ts.items():
        if not t.get("name") or (t.get("sic") in (None, "", "6726", "6722", "6221")): continue  # 펀드·ETF 제외
        q = clean(t["name"])
        if len(q) < 3: continue
        out.append({"ticker": tk, "name": t["name"], "query": q, "rows": t.get("trade_rows", 0)})
    out.sort(key=lambda x: (-x["rows"], x["ticker"]))
    return out[:limit] if limit else out
