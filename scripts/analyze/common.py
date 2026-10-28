"""분석 엔진 공통: 원본 데이터 로드, 가격 계열, 기간 수익률. 표준 라이브러리만 사용(무료 Actions)."""
import json, os, bisect
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
D = os.path.join(ROOT, "data")
PERIODS = {"1w": 7, "1m": 30, "3m": 91, "1y": 365}
BANNED = ["때문에", "추천", "매수", "매도", "recommend", "should buy", "should sell", "because of"]
SECTOR_BENCH = {  # 업종 → 비교 지수/ETF (data/markets/<id>.json)
    "semiconductor": "SOXX", "tech_ai": "XLK", "energy": "XLE", "finance": "XLF", "health": "XLV",
    "industrial": "XLI", "defense": "ITA", "housing": "XHB", "battery_ev": "LIT", "clean_energy": "ICLN",
}
DEFAULT_BENCH = "GSPC"
SECTOR_NAME = {
    "semiconductor": ("반도체", "Semiconductors"), "tech_ai": ("IT·AI", "Tech & AI"), "energy": ("에너지", "Energy"),
    "finance": ("금융", "Financials"), "health": ("헬스케어", "Health care"), "industrial": ("산업재", "Industrials"),
    "defense": ("방산", "Defense"), "housing": ("주택", "Housing"), "battery_ev": ("배터리·전기차", "Batteries & EVs"),
    "clean_energy": ("청정에너지", "Clean energy"), "consumer": ("소비재", "Consumer"), "auto": ("자동차", "Autos"),
}


def jload(*p):
    with open(os.path.join(D, *p), encoding="utf-8") as f:
        return json.load(f)


def load_series():
    """심볼 → (날짜 리스트, 종가 리스트). 미국 일별 파일 + data/markets 장기 계열 중 더 긴 쪽."""
    ser = {}
    pdir = os.path.join(D, "us", "prices")
    tmp = {}
    for fn in sorted(os.listdir(pdir)):
        if not fn.startswith("2"):
            continue
        with open(os.path.join(pdir, fn), encoding="utf-8") as f:
            j = json.load(f)
        for t, c in j["c"].items():
            tmp.setdefault(t, []).append((j["date"], c))
    for t, rows in tmp.items():
        ser[t] = ([r[0] for r in rows], [r[1] for r in rows])
    mdir = os.path.join(D, "markets")
    for fn in os.listdir(mdir):
        if fn == "index.json" or not fn.endswith(".json"):
            continue
        j = jload("markets", fn)
        if "d" not in j or "c" not in j:
            continue
        sid = fn[:-5]
        pair = (j["d"], j["c"])
        for key in {j.get("symbol", sid), sid}:
            if key not in ser or len(ser[key][0]) < len(pair[0]):
                ser[key] = pair
    return ser


def close_on_or_before(s, day):
    ds, cs = s
    i = bisect.bisect_right(ds, day) - 1
    return (ds[i], cs[i]) if i >= 0 and cs[i] else None


def shift(day, n):
    return (date.fromisoformat(day) + timedelta(days=n)).isoformat()


def period_return(s, days):
    """(시작일, 끝일, 변동률 %) 또는 None. 계열이 기간보다 짧으면 None."""
    ds, cs = s
    if not ds:
        return None
    end = ds[-1]
    start_day = shift(end, -days)
    if ds[0] > shift(start_day, 5):  # 시작 5일 이상 모자라면 계산 안 함
        return None
    a = close_on_or_before(s, start_day) or (ds[0], cs[0])
    b = cs[-1]
    if not a[1] or not b:
        return None
    return a[0], end, round((b / a[1] - 1) * 100, 2)


def banned_hit(text):
    low = text.lower()
    return [w for w in BANNED if w.lower() in low]
