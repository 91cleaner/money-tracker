#!/usr/bin/env python3
"""한국 추적 종목 일별 종가 → data/kr/prices/<종목코드>.json.

출처: 공공데이터포털 금융위원회_주식시세정보(getStockPriceInfo). 키는 env DATA_GO_KR_KEY(출력 금지).
사용: collect_kr_prices.py [days]   (기본 40일; 처음 채울 때는 400 권장)
"""
import datetime as dt, json, os, sys, time, urllib.error, urllib.parse, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "kr", "prices")
API = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo"
SRC_URL = "https://www.data.go.kr/data/15094808/openapi.do"
# 포털은 Encoding/Decoding 두 가지 키를 준다. 이미 인코딩된 키(%2B, %3D 포함)를 다시 인코딩하면 인증 실패(401/403)가 나므로
# 먼저 풀어서(unquote) 원문으로 만든 뒤 한 번만 인코딩한다. 원문 키에는 '%'가 없어 두 형태 모두 안전하다.
KEY = urllib.parse.unquote(os.environ.get("DATA_GO_KR_KEY", "").strip())


def mask(text):
    """로그에 키가 섞여 나오지 않도록 원문·인코딩 형태를 모두 가린다."""
    if KEY:
        for k in (KEY, urllib.parse.quote(KEY, safe=""), urllib.parse.quote_plus(KEY)):
            text = text.replace(k, "***")
    return text


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
    params = {"resultType": "json", "numOfRows": 1000, "pageNo": 1,
              "likeSrtnCd": code, "beginBasDt": begin, "endBasDt": end}
    q = "serviceKey=" + urllib.parse.quote(KEY, safe="") + "&" + urllib.parse.urlencode(params)
    for i in range(3):
        try:
            req = urllib.request.Request(API + "?" + q, headers={"User-Agent": "MoneyTracker"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode("utf8", "replace")[:200]
            except Exception:
                body = ""
            print(code, "retry HTTPError", e.code, mask(body).replace("\n", " "))
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
    targets = codes()
    for code, name in targets.items():
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
    print("saved", ok, "of", len(targets))
    if targets and ok == 0:
        print("전 종목 실패 — 워크플로를 실패 처리합니다")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
