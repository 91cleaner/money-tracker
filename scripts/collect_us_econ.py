#!/usr/bin/env python3
"""미국 경제 띠 수집기: 물가(CPI)·실업률은 BLS 공개 API, 금리는 FRED(키 있을 때) 또는 Treasury 공식 일별 금리.

무료 공식 자료만 쓴다. 키가 없어도 돈다(BLS v1, Treasury CSV). 키 값은 출력·저장하지 않는다.
못 받은 값은 지어내지 않고, 전부 실패하면 기존 data/us-econ.json 을 그대로 둔다.
출력: data/us-econ.json
"""
import csv, datetime, io, json, os, pathlib, urllib.error, urllib.parse, urllib.request

OUT = pathlib.Path("data/us-econ.json")
UA = "MONEY-TRACKER-research/1.0 (+https://91cleaner.github.io/money-tracker/)"
BLS_KEY = os.environ.get("BLS_API_KEY", "").strip()
FRED_KEY = os.environ.get("FRED_API_KEY", "").strip()
KEEP = 24  # 띠에 쓰는 최근 점 개수


def reason(exc):
    # 주소에 키가 들어 있을 수 있어 메시지는 종류만 남긴다.
    return "HTTP %s" % exc.code if isinstance(exc, urllib.error.HTTPError) else type(exc).__name__


def http(url, data=None, headers=None, timeout=30):
    h = {"User-Agent": UA}
    h.update(headers or {})
    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h), timeout=timeout) as r:
        return r.read().decode("utf-8-sig")


# ---------- BLS ----------
def bls_monthly(series_ids, years=3):
    """BLS 시계열 → {id: [(YYYY-MM, float)...] 오래된 순}. 키가 있으면 v2, 없으면 v1."""
    end = datetime.date.today().year
    body = {"seriesid": series_ids, "startyear": str(end - years + 1), "endyear": str(end)}
    if BLS_KEY:
        body["registrationkey"] = BLS_KEY
        url = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
    else:
        url = "https://api.bls.gov/publicAPI/v1/timeseries/data/"
    raw = http(url, json.dumps(body).encode(), {"Content-Type": "application/json"})
    return parse_bls(json.loads(raw))


def parse_bls(doc):
    if doc.get("status") != "REQUEST_SUCCEEDED":
        raise ValueError("BLS status " + str(doc.get("status")))
    out = {}
    for s in doc.get("Results", {}).get("series", []):
        pts = {}
        for d in s.get("data", []):
            p = d.get("period", "")
            if not p.startswith("M") or p == "M13":
                continue
            try:
                pts["%s-%s" % (d["year"], p[1:])] = float(d["value"])
            except (KeyError, ValueError):
                pass  # '-' 처럼 비어 있는 달은 건너뜀
        out[s["seriesID"]] = sorted(pts.items())
    return out


def yoy_series(points):
    """월별 지수 → 전년 같은 달 대비 %."""
    m = dict(points)
    res = []
    for ym, v in points:
        y, mo = ym.split("-")
        prev = m.get("%d-%s" % (int(y) - 1, mo))
        if prev:
            res.append((ym, round((v / prev - 1) * 100, 1)))
    return res


# ---------- 금리 ----------
def treasury_yields():
    """Treasury 일별 par yield curve CSV → {'2y':[(date,v)], '10y':[(date,v)]} 오래된 순."""
    this = datetime.date.today().year
    rows = []
    for yr in (this - 1, this):
        url = ("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/%d/all"
               "?type=daily_treasury_yield_curve&field_tdr_date_value=%d&page&_format=csv" % (yr, yr))
        try:
            rows += list(csv.DictReader(io.StringIO(http(url))))
        except Exception as exc:
            if yr == this:
                raise
            print("::warning::Treasury %d: %s" % (yr, reason(exc)))
    return parse_treasury(rows)


def parse_treasury(rows):
    out = {"2y": {}, "10y": {}}
    for r in rows:
        try:
            m, d, y = r["Date"].split("/")
            date = "%s-%s-%s" % (y, m, d)
        except (KeyError, ValueError, AttributeError):
            continue
        for k, col in (("2y", "2 Yr"), ("10y", "10 Yr")):
            try:
                out[k][date] = float(r[col])
            except (KeyError, ValueError, TypeError):
                pass
    return {k: sorted(v.items()) for k, v in out.items()}


def fred_daily(series_id):
    """FRED 공식 API(키 필요) → [(date, float)] 오래된 순."""
    q = urllib.parse.urlencode({"series_id": series_id, "api_key": FRED_KEY, "file_type": "json", "sort_order": "desc", "limit": "120"})
    obs = json.loads(http("https://api.stlouisfed.org/fred/series/observations?" + q)).get("observations", [])
    pts = []
    for o in reversed(obs):
        try:
            pts.append((o["date"], float(o["value"])))
        except (KeyError, ValueError):
            pass  # "." 는 값 없음
    return pts


# ---------- 조립 ----------
def card(points, unit, source, url, digits=2, daily=False):
    if not points:
        return None
    pts = points[-KEEP:]
    last = pts[-1]
    prev = pts[-2] if len(pts) > 1 else None
    return {
        "value": round(last[1], digits), "date": last[0],
        "prev": round(prev[1], digits) if prev else None, "prev_date": prev[0] if prev else None,
        "unit": unit, "daily": daily, "source": source, "url": url,
        "points": [[d, round(v, digits)] for d, v in pts],
    }


def main():
    items, notes = {}, []
    try:
        bls = bls_monthly(["CUUR0000SA0", "LNS14000000"])
        cpi = yoy_series(bls.get("CUUR0000SA0", []))
        items["cpi"] = card(cpi, "%", "BLS", "https://www.bls.gov/cpi/", 1)
        items["unrate"] = card(bls.get("LNS14000000", []), "%", "BLS", "https://www.bls.gov/cps/", 1)
    except Exception as exc:
        notes.append("BLS 실패: " + reason(exc))
    rate_src = None
    if FRED_KEY:
        try:
            items["y10"] = card(fred_daily("DGS10"), "%", "FRED", "https://fred.stlouisfed.org/series/DGS10", 2, True)
            items["y2"] = card(fred_daily("DGS2"), "%", "FRED", "https://fred.stlouisfed.org/series/DGS2", 2, True)
            items["fedfunds"] = card(fred_daily("DFF"), "%", "FRED", "https://fred.stlouisfed.org/series/DFF", 2, True)
            rate_src = "FRED"
        except Exception as exc:
            notes.append("FRED 실패: " + reason(exc))
    if not items.get("y10"):
        try:
            t = treasury_yields()
            url = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
            items["y10"] = card(t["10y"], "%", "U.S. Treasury", url, 2, True)
            items["y2"] = card(t["2y"], "%", "U.S. Treasury", url, 2, True)
            rate_src = "Treasury"
        except Exception as exc:
            notes.append("Treasury 실패: " + reason(exc))
    items = {k: v for k, v in items.items() if v}
    for n in notes:
        print("::warning::" + n)
    if not items:
        raise SystemExit("받은 값이 없어 기존 파일을 그대로 둡니다")
    doc = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "rate_source": rate_src, "items": items, "notes": notes,
        "disclaimer": "공식 공개 자료를 그대로 옮긴 것이며 투자 조언이 아닙니다. / Official public data, not investment advice.",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("저장:", ", ".join(sorted(items)))


if __name__ == "__main__":
    main()
