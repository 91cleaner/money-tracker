#!/usr/bin/env python3
"""2026 Q2 13F 보유 종목 → 본사 주(미국) 또는 나라.

금액은 data/nps/holdings_us_2026Q2.json 그대로 쓴다.
위치는 SEC EDGAR 제출 서류의 사업장 주소(addresses.business)만 쓴다.
설립지(state of incorporation)나 이름만 보고 도시를 짐작하지 않는다.
티커는 OpenFIGI의 CUSIP/CINS 매칭과 SEC 티커 파일로 확인하고, 둘 다 없으면 비운다.

  python3 scripts/build_us_hq_region.py
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOLD = os.path.join(ROOT, "data", "nps", "holdings_us_2026Q2.json")
OUT = os.path.join(ROOT, "data", "nps", "us_hq_region.json")
TICK_OUT = os.path.join(ROOT, "data", "nps", "us_tickers.json")
CACHE = os.path.join("/tmp", "nps-us-hq-cache.json")
UA = (os.environ.get("SEC_USER_AGENT") or os.environ.get("SEC_UA") or "MoneyTracker research Leecheolhan91@gmail.com")

# USPS 2글자 코드. 이 표에 없는 코드는 미국 주로 보지 않는다.
USPS = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "DC": "District of Columbia",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois",
    "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana",
    "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota",
    "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon",
    "PA": "Pennsylvania", "PR": "Puerto Rico", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
}
KO_STATE = {
    "AL": "앨라배마", "AK": "알래스카", "AZ": "애리조나", "AR": "아칸소", "CA": "캘리포니아",
    "CO": "콜로라도", "CT": "코네티컷", "DE": "델라웨어", "DC": "워싱턴 D.C.", "FL": "플로리다",
    "GA": "조지아", "HI": "하와이", "ID": "아이다호", "IL": "일리노이", "IN": "인디애나",
    "IA": "아이오와", "KS": "캔자스", "KY": "켄터키", "LA": "루이지애나", "ME": "메인",
    "MD": "메릴랜드", "MA": "매사추세츠", "MI": "미시간", "MN": "미네소타", "MS": "미시시피",
    "MO": "미주리", "MT": "몬태나", "NE": "네브래스카", "NV": "네바다", "NH": "뉴햄프셔",
    "NJ": "뉴저지", "NM": "뉴멕시코", "NY": "뉴욕", "NC": "노스캐롤라이나", "ND": "노스다코타",
    "OH": "오하이오", "OK": "오클라호마", "OR": "오리건", "PA": "펜실베이니아", "PR": "푸에르토리코",
    "RI": "로드아일랜드", "SC": "사우스캐롤라이나", "SD": "사우스다코타", "TN": "테네시",
    "TX": "텍사스", "UT": "유타", "VT": "버몬트", "VA": "버지니아", "WA": "워싱턴",
    "WV": "웨스트버지니아", "WI": "위스콘신", "WY": "와이오밍",
}
# SEC가 적어 둔 영어 나라 이름을 지도에 쓸 한국 말로 바꾼다. 표에 없으면 영어 이름을 그대로 쓴다.
KO_COUNTRY = {
    "united kingdom": "영국", "ireland": "아일랜드", "luxembourg": "룩셈부르크",
    "netherlands": "네덜란드", "switzerland": "스위스", "cayman islands": "케이맨 제도",
    "bermuda": "버뮤다", "singapore": "싱가포르", "china": "중국", "hong kong": "홍콩",
    "japan": "일본", "taiwan": "대만", "germany": "독일", "france": "프랑스",
    "canada": "캐나다", "israel": "이스라엘", "south korea": "대한민국", "korea": "대한민국",
    "australia": "호주", "sweden": "스웨덴", "denmark": "덴마크", "spain": "스페인",
    "italy": "이탈리아", "brazil": "브라질", "india": "인도", "mexico": "멕시코",
    "belgium": "벨기에", "austria": "오스트리아", "finland": "핀란드", "norway": "노르웨이",
    "jersey": "저지", "guernsey": "건지", "british virgin islands": "영국령 버진아일랜드",
    "united arab emirates": "아랍에미리트", "south africa": "남아프리카 공화국",
    "chile": "칠레", "argentina": "아르헨티나", "portugal": "포르투갈",
    "new zealand": "뉴질랜드", "malaysia": "말레이시아", "thailand": "태국",
    "indonesia": "인도네시아", "philippines": "필리핀", "vietnam": "베트남",
    "poland": "폴란드", "greece": "그리스", "turkey": "튀르키예", "russia": "러시아",
    "ukraine": "우크라이나", "cyprus": "키프로스", "malta": "몰타", "panama": "파나마",
    "bahamas": "바하마", "liberia": "라이베리아", "marshall islands": "마셜 제도",
    "monaco": "모나코", "liechtenstein": "리히텐슈타인", "curacao": "퀴라소",
    "isle of man": "맨섬", "macau": "마카오", "puerto rico": "푸에르토리코",
    "united states": "미국", "uruguay": "우루과이", "colombia": "콜롬비아",
    "peru": "페루", "czech republic": "체코", "czechia": "체코", "hungary": "헝가리",
    "romania": "루마니아", "iceland": "아이슬란드", "qatar": "카타르",
    "saudi arabia": "사우디아라비아", "egypt": "이집트", "nigeria": "나이지리아",
    "mauritius": "모리셔스", "seychelles": "세이셸", "barbados": "바베이도스",
}
# 좌표표의 이름과 SEC 이름이 공식적으로 다를 때만 연결한다.
COUNTRY_ALIAS = {
    "uk": "united kingdom", "great britain": "united kingdom", "u k": "united kingdom",
    "republic of korea": "south korea", "korea republic of": "south korea",
    "korea south": "south korea", "republic of south korea": "south korea",
    "russian federation": "russia", "czechia": "czech republic",
    "turkiye": "turkey", "taiwan province of china": "taiwan",
    "hong kong sar": "hong kong", "hong kong sar china": "hong kong",
    "macao": "macau", "macao sar": "macau", "viet nam": "vietnam",
    "united states of america": "united states", "usa": "united states",
    "the netherlands": "netherlands", "holland": "netherlands",
    "czech republic": "czech republic", "republic of ireland": "ireland",
    "people s republic of china": "china", "prc": "china",
    "republic of china": "taiwan",
}


def norm_name(s):
    s = str(s or "").lower().replace("&", " and ")
    s = s.replace("’", "").replace("'", "")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def ko_country(name_en):
    key = norm_name(name_en)
    key = COUNTRY_ALIAS.get(key, key)
    return KO_COUNTRY.get(key) or str(name_en or "").strip()


def pct(value, total):
    if not total:
        return 0.0
    q = (Decimal(value) / Decimal(total) * Decimal(100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return float(q)


def place_from_address(addr):
    """사업장 주소에서 미국 주 또는 나라만 고른다. 없으면 None."""
    if not isinstance(addr, dict):
        return None
    country = str(addr.get("country") or "").strip()
    code = str(addr.get("countryCode") or "").strip()
    st = str(addr.get("stateOrCountry") or "").strip().upper()
    desc = str(addr.get("stateOrCountryDescription") or "").strip()
    foreign = addr.get("isForeignLocation") in (1, True, "1")
    if not foreign and st in USPS and not country:
        return {"kind": "state", "code": st, "name_en": USPS[st], "name": KO_STATE[st]}
    cname = country
    if not cname and desc and norm_name(desc) != norm_name(st) and len(desc) > 2:
        cname = desc
    if not cname:
        return None
    return {"kind": "country", "code": code or st or norm_name(cname), "name_en": cname, "name": ko_country(cname)}


def _get(url, data=None, headers=None, timeout=60):
    h = {"User-Agent": UA, "Accept-Encoding": "identity"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read()


def _load_cache():
    if os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as f:
            return json.load(f)
    return {"figi": {}, "sub": {}}


def _save_cache(cache):
    tmp = CACHE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cache, f)
    os.replace(tmp, CACHE)


def _figi_batch(chunk, alpha_as_cins):
    jobs = []
    for c in chunk:
        letter = c[:1].isalpha()
        kind = "ID_CINS" if letter == alpha_as_cins else "ID_CUSIP"
        jobs.append({"idType": kind, "idValue": c})
    while True:
        try:
            raw = _get("https://api.openfigi.com/v3/mapping", json.dumps(jobs).encode(), {"Content-Type": "application/json"})
            break
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print("openfigi 429, wait")
                time.sleep(15)
                continue
            if e.code == 400 and len(chunk) > 1:
                out = []
                for one in chunk:
                    out.extend(_figi_batch([one], alpha_as_cins))
                return out
            raise
    data = json.loads(raw)
    if not isinstance(data, list) or len(data) != len(chunk):
        raise RuntimeError("openfigi shape")
    return data


def fetch_figi(cusips, cache):
    pending = [c for c in cusips if c not in cache["figi"]]
    i = 0
    while i < len(pending):
        chunk = pending[i:i + 10]
        data = _figi_batch(chunk, True)
        for c, item in zip(chunk, data):
            cache["figi"][c] = figi_record(item)
        _save_cache(cache)
        i += len(chunk)
        print(f"figi {min(i, len(pending))}/{len(pending)}")
        time.sleep(2.6)
    retry = [c for c in cusips if not cache["figi"].get(c)]
    j = 0
    while j < len(retry):
        chunk = retry[j:j + 10]
        data = _figi_batch(chunk, False)
        for c, item in zip(chunk, data):
            got = figi_record(item)
            if got.get("ticker") or got.get("name"):
                cache["figi"][c] = got
        _save_cache(cache)
        j += len(chunk)
        if j < len(retry):
            time.sleep(2.6)
        print(f"figi retry {min(j, len(retry))}/{len(retry)}")


def pick_ticker(item):
    """미국 통합 시세(exchCode US)에서 티커가 하나일 때만 고른다."""
    rows = [r for r in (item.get("data") or []) if r.get("exchCode") == "US" and r.get("ticker")]
    tickers = []
    for r in rows:
        t = str(r["ticker"]).strip().upper()
        if t and t not in tickers:
            tickers.append(t)
    if len(tickers) == 1:
        return tickers[0]
    return None


def figi_record(item):
    names = []
    for r in item.get("data") or []:
        n = str(r.get("name") or "").strip()
        if n and n not in names:
            names.append(n)
    name = None
    if names and len({norm_name(n) for n in names}) == 1:
        name = names[0]
    return {"ticker": pick_ticker(item), "name": name}


def figi_ticker(v):
    if isinstance(v, str):
        return v
    if isinstance(v, dict):
        return v.get("ticker")
    return None


def figi_name(v):
    if isinstance(v, dict):
        return v.get("name")
    return None


def load_ticker_cik():
    out = {}

    def add(ticker, cik):
        if not ticker or cik in (None, ""):
            return
        key = str(ticker).strip().upper()
        cik_s = str(int(cik))
        out.setdefault(key, cik_s)
        out.setdefault(key.replace(".", "-"), cik_s)
        out.setdefault(key.replace("/", "-"), cik_s)

    ticks = json.loads(_get("https://www.sec.gov/files/company_tickers.json"))
    for row in ticks.values():
        add(row.get("ticker"), row.get("cik_str"))
    ex = json.loads(_get("https://www.sec.gov/files/company_tickers_exchange.json"))
    fields = ex["fields"]
    ti, ci = fields.index("ticker"), fields.index("cik")
    for row in ex["data"]:
        add(row[ti], row[ci])
    mf = json.loads(_get("https://www.sec.gov/files/company_tickers_mf.json"))
    fields = mf["fields"]
    ti, ci = fields.index("symbol"), fields.index("cik")
    for row in mf["data"]:
        add(row[ti], row[ci])
    return out


def fetch_submissions(ciks, cache):
    for n, cik in enumerate(ciks, 1):
        if cik in cache["sub"]:
            continue
        url = f"https://www.sec.gov/search-filings/edgar-application-programming-interfacesCIK{str(cik).zfill(10)}.json"
        try:
            sub = json.loads(_get(url))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(10)
                sub = json.loads(_get(url))
            else:
                cache["sub"][cik] = {"error": e.code}
                _save_cache(cache)
                continue
        biz = (sub.get("addresses") or {}).get("business") or {}
        cache["sub"][cik] = {
            "name": sub.get("name"),
            "business": {
                "city": biz.get("city"),
                "stateOrCountry": biz.get("stateOrCountry"),
                "stateOrCountryDescription": biz.get("stateOrCountryDescription"),
                "country": biz.get("country"),
                "countryCode": biz.get("countryCode"),
                "isForeignLocation": biz.get("isForeignLocation"),
            },
        }
        if n % 25 == 0:
            _save_cache(cache)
            print(f"edgar {n}/{len(ciks)}")
        time.sleep(0.15)
    _save_cache(cache)


def ring_centroid(ring):
    pts = [p[:2] for p in ring]
    if len(pts) < 3:
        return None
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        cross = x1 * y2 - x2 * y1
        a += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    if abs(a) < 1e-9:
        return None
    a *= 0.5
    return {"lng": cx / (6 * a), "lat": cy / (6 * a), "area": abs(a)}


def geom_centroid(geom):
    gtype = geom.get("type")
    if gtype == "Polygon":
        parts = [geom["coordinates"][0]]
    elif gtype == "MultiPolygon":
        parts = [p[0] for p in geom["coordinates"]]
    else:
        return None
    best = None
    for ring in parts:
        got = ring_centroid(ring)
        if got and (best is None or got["area"] > best["area"]):
            best = got
    return best


def load_state_centroids():
    raw = json.loads(_get("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"))
    out = {}
    for feat in raw["features"]:
        name = feat["properties"]["name"]
        cen = geom_centroid(feat["geometry"])
        if not cen:
            continue
        out[name] = {"lat": round(cen["lat"], 4), "lng": round(cen["lng"], 4)}
    return out


def load_country_centroids():
    text = _get("https://raw.githubusercontent.com/google/dspl/master/samples/google/canonical/countries.csv").decode("utf-8")
    out = {}
    for i, line in enumerate(text.splitlines()):
        if i == 0 or not line.strip():
            continue
        parts = next(csv_rows([line]))
        if len(parts) < 4:
            continue
        _iso, lat, lng, name = parts[0], parts[1], parts[2], parts[3]
        try:
            out[norm_name(name)] = {"lat": round(float(lat), 4), "lng": round(float(lng), 4), "name": name}
        except ValueError:
            continue
    return out


def csv_rows(lines):
    import csv
    return csv.reader(lines)


def country_point(name_en, table):
    """SEC 주소 문장에서 좌표표에 있는 나라 이름만 고른다."""
    key = COUNTRY_ALIAS.get(norm_name(name_en), norm_name(name_en))
    if key in table:
        return table[key]
    parts = norm_name(name_en).split()
    for n in (3, 2, 1):
        if len(parts) < n:
            continue
        tail = " ".join(parts[-n:])
        tail = COUNTRY_ALIAS.get(tail, tail)
        if tail in table:
            return table[tail]
    return None


def frame_of(place):
    if place["kind"] == "country":
        return "world"
    if place["code"] in ("AK", "HI", "PR"):
        return place["code"].lower()
    return "lower48"


def build():
    with open(HOLD, encoding="utf-8") as f:
        hold = json.load(f)
    rows = hold["holdings"]
    total = int(hold["total_value_usd"])
    cusips = []
    seen = set()
    for row in rows:
        c = row["cusip"]
        if c not in seen:
            seen.add(c)
            cusips.append(c)
    cache = _load_cache()
    fetch_figi(cusips, cache)
    cik_by_ticker = load_ticker_cik()
    name_cik = {}
    name_dup = set()
    ex = json.loads(_get("https://www.sec.gov/files/company_tickers_exchange.json"))
    fields = ex["fields"]
    ni, ci = fields.index("name"), fields.index("cik")
    for row in ex["data"]:
        key = norm_name(row[ni])
        if not key:
            continue
        cik_s = str(int(row[ci]))
        if key in name_cik and name_cik[key] != cik_s:
            name_dup.add(key)
        else:
            name_cik[key] = cik_s
    for key in name_dup:
        name_cik.pop(key, None)
    line_cik = {}
    tickers = {}
    for row in rows:
        rec = cache["figi"].get(row["cusip"])
        t = figi_ticker(rec)
        if t:
            tickers[row["cusip"]] = t
        cik = None
        if t:
            cik = cik_by_ticker.get(t) or cik_by_ticker.get(t.replace(".", "-")) or cik_by_ticker.get(t.replace("/", "-"))
        if not cik:
            nm = figi_name(rec)
            if nm:
                cik = name_cik.get(norm_name(nm))
        if cik:
            line_cik[row["cusip"]] = cik
    ciks = sorted(set(line_cik.values()))
    print("ciks", len(ciks), "tickers", len(tickers), "lines", len(rows))
    fetch_submissions(ciks, cache)
    state_xy = load_state_centroids()
    country_xy = load_country_centroids()

    by_cik = defaultdict(list)
    no_cik = []
    for row in rows:
        cik = line_cik.get(row["cusip"])
        if cik:
            by_cik[cik].append(row)
        else:
            no_cik.append(row)
    name_to_ciks = defaultdict(set)
    for cik, lines in by_cik.items():
        for x in lines:
            name_to_ciks[x["issuer"].strip()].add(cik)
    for row in no_cik:
        ciks_for_name = name_to_ciks.get(row["issuer"].strip()) or set()
        if len(ciks_for_name) == 1:
            by_cik[next(iter(ciks_for_name))].append(row)

    def pack(lines, cik, addr, place, reason):
        name = sorted(lines, key=lambda z: -int(z["value_usd"]))[0]["issuer"].strip()
        top_ticker = None
        for x in sorted(lines, key=lambda z: -int(z["value_usd"])):
            if tickers.get(x["cusip"]):
                top_ticker = tickers[x["cusip"]]
                break
        item = {
            "company": name,
            "value_usd": sum(int(x["value_usd"]) for x in lines),
            "cusips": [x["cusip"] for x in lines],
            "ticker": top_ticker,
            "cik": cik,
        }
        if place:
            if place["kind"] == "state":
                xy = state_xy.get(place["name_en"])
            else:
                xy = country_point(place["name_en"], country_xy)
                if xy and xy.get("name"):
                    place = dict(place, name_en=xy["name"], name=ko_country(xy["name"]))
            if not xy:
                item["reason"] = "주소의 이름은 있으나 지도 중심 좌표 자료에 그 이름이 없어요"
                item["place_name"] = place["name"]
                unmatched.append(item)
                return
            item.update({
                "kind": place["kind"], "code": place["code"], "name": place["name"], "name_en": place["name_en"],
                "lat": xy["lat"], "lng": xy["lng"], "city": (addr or {}).get("city"),
            })
            companies.append(item)
        else:
            item["reason"] = reason
            unmatched.append(item)

    companies = []
    unmatched = []
    for cik, lines in by_cik.items():
        sub = cache["sub"].get(cik) or {}
        addr = sub.get("business")
        place = place_from_address(addr)
        reason = None if place else "EDGAR 사업장 주소에 주나 나라가 없어요"
        pack(lines, cik, addr, place, reason)
    leftover = []
    for row in no_cik:
        ciks_for_name = name_to_ciks.get(row["issuer"].strip()) or set()
        if len(ciks_for_name) == 1:
            continue
        leftover.append(row)
    left_names = defaultdict(list)
    for row in leftover:
        left_names[row["issuer"].strip()].append(row)
    for name, lines in left_names.items():
        ciks_for_name = name_to_ciks.get(name) or set()
        reason = "같은 이름에 회사 번호가 여러 개라 주소를 고르지 않았어요" if len(ciks_for_name) > 1 else "SEC 회사 번호를 못 찾았어요"
        pack(lines, None, None, None, reason)

    regions = {}
    for c in companies:
        key = (c["kind"], c["code"])
        bucket = regions.get(key)
        if not bucket:
            bucket = {
                "kind": c["kind"],
                "code": c["code"],
                "name": c["name"],
                "name_en": c["name_en"],
                "lat": c["lat"],
                "lng": c["lng"],
                "frame": frame_of(c),
                "value_usd": 0,
                "company_count": 0,
                "companies": [],
            }
            regions[key] = bucket
        bucket["value_usd"] += c["value_usd"]
        bucket["company_count"] += 1
        bucket["companies"].append({"company": c["company"], "ticker": c["ticker"], "value_usd": c["value_usd"]})

    region_list = []
    for bucket in regions.values():
        bucket["companies"].sort(key=lambda x: -x["value_usd"])
        bucket["top"] = bucket["companies"][:5]
        del bucket["companies"]
        bucket["pct"] = pct(bucket["value_usd"], total)
        region_list.append(bucket)
    region_list.sort(key=lambda r: (-r["value_usd"], r["name"]))

    unmatched.sort(key=lambda x: -x["value_usd"])
    unmatched_value = sum(x["value_usd"] for x in unmatched)
    matched_value = sum(x["value_usd"] for x in companies)
    if matched_value + unmatched_value != total:
        raise SystemExit(f"sum mismatch {matched_value} + {unmatched_value} != {total}")

    countries = [r["name"] for r in region_list if r["kind"] == "country"]
    out = {
        "fetched": "2026-10-24",
        "holdings_as_of": hold["period"],
        "holdings_file": "data/nps/holdings_us_2026Q2.json",
        "quarter": hold["quarter"],
        "total_value_usd": total,
        "total_label_usd": "$155.08B",
        "scope_line": "미국 주식만 공개돼 있어요 (미국 13F 자료 기준)",
        "other_overseas_files": False,
        "source": "SEC EDGAR 13F-HR 보유 금액과, 각 회사 제출 서류의 사업장 주소",
        "sources": [
            {"role": "보유 금액", "name": "SEC EDGAR 13F-HR", "url": hold["filing_url"]},
            {"role": "본사 주소", "name": "SEC EDGAR 회사 사업장 주소", "url": "https://www.sec.gov/search-filings/edgar-application-programming-interfaces"},
            {"role": "티커", "name": "OpenFIGI CUSIP·CINS", "url": "https://www.openfigi.com/"},
            {"role": "미국 주 위치", "name": "미국 주 경계의 중심", "url": "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"},
            {"role": "나라 위치", "name": "나라 중심 좌표", "url": "https://raw.githubusercontent.com/google/dspl/master/samples/google/canonical/countries.csv"},
        ],
        "regions": region_list,
        "unmatched_count": len(unmatched),
        "unmatched_value_usd": unmatched_value,
        "unmatched_pct": pct(unmatched_value, total),
        "unmatched": unmatched,
        "company_count": len(companies) + len(unmatched),
        "matched_company_count": len(companies),
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    with open(TICK_OUT, "w", encoding="utf-8") as f:
        json.dump({"cusip": tickers, "source": "OpenFIGI ID_CUSIP/ID_CINS, exchCode US"}, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("regions", len(region_list), "countries", countries)
    print("unmatched", len(unmatched), unmatched_value, "pct", out["unmatched_pct"])
    print("TOP")
    for r in region_list[:8]:
        print(f"  {r['name']:16} {r['value_usd']/1e9:8.2f}B {r['pct']:6.2f}% n={r['company_count']} {r['kind']}")
    if unmatched[:8]:
        print("MISS")
        for u in unmatched[:8]:
            print(f"  {u['value_usd']/1e9:8.2f}B {u['company']} {u.get('reason')}")


if __name__ == "__main__":
    build()
