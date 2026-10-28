#!/usr/bin/env python3
"""한국 추적 종목 일별 종가 → data/kr/prices/<종목코드>.json.

출처: 공공데이터포털 금융위원회_주식시세정보(getStockPriceInfo). 키는 env DATA_GO_KR_KEY(출력 금지).
사용: collect_kr_prices.py [days]   (기본 40일; 처음 채울 때는 400 권장)
"""
import datetime as dt, json, os, sys, time, urllib.parse, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "kr", "prices")
API = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo"
SRC_URL = "https://www.data.go.kr/data/15094808/openapi.do"
KEY = os.environ.get("DATA_GO_KR_KEY", "")


def codes():
    """추적 한국 종목: company-links.json 의 .KS 종목 (코드 6자리)."""
    L = json.load(open(os.path.join(ROOT, "data", "market", "company-links.json")))["companies"]
    return {c["symbol"].split(".")[0]: c["name"] for c in L if c["symbol"].endswith(".KS")}


def parse(j):
    """API 응답 → [(YYYY-MM-DD, 종가)] 오래된 순. 응답 모양이 다르면 빈 목록."""
    try:
        items = j["response"]["body"]["items"]["item"]
    except (KeyError, TypeError):
        return []
    if isinstance(items, dict):
        items = [items]
    out = {}
    for it in items or []:
        d, c = str(it.get("basDt") or ""), it.get("clpr")
        try:
            v = int(float(str(c).replace(",", "")))
        except (TypeError, ValueError):
            continue
        if len(d) == 8 and v > 0:
            out[f"{d[:4]}-{d[4:6]}-{d[6:]}"] = v
    return sorted(out.items())


def fetch(code, begin, end):
    q = urllib.parse.urlencode({"serviceKey": KEY, "resultType": "json", "numOfRows": 1000, "pageNo": 1,
                                "likeSrtnCd": code, "beginBasDt": begin, "endBasDt": end})
    for i in range(3):
        try:
            req = urllib.request.Request(API + "?" + q, headers={"User-Agent": "MoneyTracker"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # 키가 URL에 들어 있으므로 예외 본문은 찍지 않고 종류만 남김
            print(code, "retry", type(e).__name__)
            time.sleep(5 * (i + 1))
    return None


def merge(old, rows):
    m = dict(zip(old.get("d", []), old.get("c", [])))
    m.update(dict(rows))
    ds = sorted(m)
    return ds, [m[d] for d in ds]


def main():
    if not KEY:
        print("DATA_GO_KR_KEY 없음 — 건너뜀")
        return 0
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    end = dt.date.today()
    begin = end - dt.timedelta(days=days)
    os.makedirs(OUT, exist_ok=True)
    ok = 0
    for code, name in codes().items():
        j = fetch(code, begin.strftime("%Y%m%d"), end.strftime("%Y%m%d"))
        rows = parse(j) if j else []
        if not rows:
            print(code, "no rows")
            continue
        p = os.path.join(OUT, code + ".json")
        old = json.load(open(p, encoding="utf8")) if os.path.exists(p) else {}
        ds, cs = merge(old, rows)
        doc = {"symbol": code + ".KS", "name": name, "currency": "KRW", "source": "공공데이터포털 금융위원회_주식시세정보",
               "source_url": SRC_URL, "note": "일별 마감 종가 기록(실시간 아님).", "as_of": ds[-1], "d": ds, "c": cs}
        json.dump(doc, open(p, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
        ok += 1
        time.sleep(0.5)
    print("saved", ok)
    return 0


if __name__ == "__main__":
    sys.exit(main())
