#!/usr/bin/env python3
"""국민연금 국내주식 종목 → 본사 시도·시군구.

종목 약명은 한국거래소 정보데이터시스템 종목검색(KIND 상장법인목록과 같은 거래소 종목명)으로
맞추고, 본사 주소는 금융감독원 DART 기업개황에서 가져온다. OpenDART company.json 의 주소와
같은 공시다. 주소에서 시도·시군구가 안 읽히거나 종목을 못 찾으면 위치를 비워 둔다.

  python3 scripts/build_kr_hq_region.py
"""
from __future__ import annotations

import json, math, os, re, threading, time, urllib.parse, urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from decimal import Decimal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOLDINGS = os.path.join(ROOT, "data", "nps", "kr_holdings.json")
OUT = os.path.join(ROOT, "data", "nps", "kr_hq_region.json")
GEO = os.path.join(ROOT, "assets", "geo.json")
CACHE = os.path.join("/tmp", "nps-hq-cache.json")
KST = timezone(timedelta(hours=9))
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
KIND_URL = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13"
KRX_PAGE = "http://data.krx.co.kr/contents/MDC/MAIN/main/index.cmd"
KRX_JSON = "http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"
DART_PAGE = "https://dart.fss.or.kr/dsae001/main.do"
DART_SEARCH = "https://dart.fss.or.kr/dsae001/search.ax"
DART_SELECT = "https://dart.fss.or.kr/dsae001/select.ax"
DART_HIST = "https://dart.fss.or.kr/corp/historyFmlNm.ax"

TAG_RE = re.compile(r"\((?:전환|유상|배당)\)$")
PREF_RE = re.compile(r"^(?P<base>.+?)(?:\s*\d*우[A-Z]?)$")
SIDO_NAMES = [
    ("서울특별시", "서울"), ("부산광역시", "부산"), ("대구광역시", "대구"), ("인천광역시", "인천"),
    ("광주광역시", "광주"), ("대전광역시", "대전"), ("울산광역시", "울산"), ("세종특별자치시", "세종"),
    ("강원특별자치도", "강원"), ("강원도", "강원"), ("경기도", "경기"),
    ("충청북도", "충북"), ("충청남도", "충남"),
    ("전북특별자치도", "전북"), ("전라북도", "전북"), ("전라남도", "전남"),
    ("경상북도", "경북"), ("경상남도", "경남"), ("제주특별자치도", "제주"), ("제주도", "제주"),
    ("서울시", "서울"), ("부산시", "부산"), ("대구시", "대구"), ("인천시", "인천"),
    ("대전시", "대전"), ("울산시", "울산"), ("세종시", "세종"),
    ("서울", "서울"), ("부산", "부산"), ("대구", "대구"), ("인천", "인천"), ("광주", "광주"),
    ("대전", "대전"), ("울산", "울산"), ("세종", "세종"), ("경기", "경기"), ("강원", "강원"),
    ("충북", "충북"), ("충남", "충남"), ("전북", "전북"), ("전남", "전남"), ("경북", "경북"),
    ("경남", "경남"), ("제주", "제주"),
]
# 2026-07-01 전남광주통합특별시. 시·군·구 이름은 그대로라 옛 광주 5개 구·전남 시·군으로 되돌린다.
# 구 이름이 주소에 없으면 광주인지 전남인지 알 수 없어 비운다. collector/cities.py 와 같은 규칙.
JNGJ_PREFIXES = ("전남광주통합특별시", "광주특별시")
JNGJ_GU = ("광산구", "동구", "서구", "남구", "북구")
# 통계청 2013 경계 파일의 옛 구 이름. 같은 행정구역의 개명만 연결한다.
GEO_ALIAS = {("인천", "미추홀구"): ("인천", "남구")}
GK = math.cos(math.radians(36))
GSX = 600 / (6.5 * GK)


def norm(s):
    s = str(s or "").replace("㈜", "").replace("(주)", "").replace("（주）", "").replace("주식회사", "")
    return re.sub(r"\s+", "", s).upper()


def strip_tags(name):
    return TAG_RE.sub("", str(name).strip()).strip()


def preferred_base(name):
    """우선주 접미사만 떼어 보통주 이름을 돌려준다. 보통주 이름이면 None."""
    n = strip_tags(name)
    m = PREF_RE.match(n)
    if not m:
        return None
    base = m.group("base").strip()
    if not base or base == n:
        return None
    return base


def _sigungu_token(tok):
    return len(tok) >= 2 and (tok.endswith("시") or tok.endswith("군") or tok.endswith("구"))


def legacy_jngj(s):
    """통합특별시 주소를 옛 시도 이름으로 바꾼다. 시·군·구가 없으면 None."""
    for p in JNGJ_PREFIXES:
        if not s.startswith(p):
            continue
        rest = s[len(p):].lstrip()
        tok = rest.split(" ")[0] if rest else ""
        gu = next((g for g in JNGJ_GU if tok == g or (tok.startswith(g) and not tok.startswith(g[:-1] + "청"))), None)
        if gu:
            return "광주광역시 " + rest
        if len(tok) >= 2 and tok[-1] in "시군":
            return "전라남도 " + rest
        return None
    return s


def parse_addr(addr):
    """본사 주소에서 시도 짧은 이름과 시군구를 읽는다. 못 읽으면 None. 추측하지 않는다."""
    s = re.sub(r"\s+", " ", addr or "").strip()
    if not s:
        return None
    s = legacy_jngj(s)
    if not s:
        return None
    sido, rest = None, None
    for full, short in sorted(SIDO_NAMES, key=lambda x: -len(x[0])):
        if not s.startswith(full):
            continue
        nxt = s[len(full):]
        if not nxt:
            sido, rest = short, ""
            break
        if nxt[0].isspace():
            sido, rest = short, nxt.strip()
            break
        # '서울시마포구'처럼 시도 바로 뒤에 시·군·구가 붙은 경우만 읽는다.
        tok = nxt.split(" ")[0].strip(" ,")
        if _sigungu_token(tok):
            sido, rest = short, nxt.strip()
            break
    if not sido:
        return None
    if sido == "세종":
        return sido, "세종시"
    if not rest:
        return sido, None
    tok = rest.split(" ")[0].strip(" ,")
    if not (tok.endswith("시") or tok.endswith("군") or tok.endswith("구")):
        return sido, None
    sigungu = tok
    rest2 = rest[len(tok):].strip()
    if tok.endswith("시") and rest2:
        tok2 = rest2.split(" ")[0].strip(" ,")
        if tok2.endswith("구"):
            sigungu = tok + " " + tok2
    return sido, sigungu


def money(v):
    return Decimal(str(v)).quantize(Decimal("0.1"))


def to_ll(p):
    return [round(38.7 - p[1] / GSX, 5), round(124.5 + p[0] / (GK * GSX), 5)]


def load_geo():
    g = json.load(open(GEO, encoding="utf-8"))
    return g["points"]


def geo_ll(points, sido, sigungu):
    if not sido:
        return None
    if sigungu:
        key_s, key_g = GEO_ALIAS.get((sido, sigungu), (sido, sigungu))
        key = key_s + " " + key_g.replace(" ", "")
        if key in points:
            return to_ll(points[key])
        # 시 이름만 있고 경계는 구로 나뉜 경우(부천시). 그 시로 시작하는 점의 중심.
        if " " not in sigungu:
            kids = [points[k] for k in points if k.startswith(sido + " " + sigungu) and k != sido]
            if kids:
                xs = [to_ll(p) for p in kids]
                return [round(sum(a[0] for a in xs) / len(xs), 5), round(sum(a[1] for a in xs) / len(xs), 5)]
        return None
    if sido in points:
        return to_ll(points[sido])
    return None


class Client:
    def __init__(self):
        self.local = threading.local()
        self.cache_lock = threading.Lock()
        self.cache = {}
        if os.path.exists(CACHE):
            try:
                self.cache = json.load(open(CACHE, encoding="utf-8"))
            except Exception:
                self.cache = {}

    def save_cache(self):
        with self.cache_lock:
            tmp = CACHE + ".tmp"
            json.dump(self.cache, open(tmp, "w", encoding="utf-8"), ensure_ascii=False)
            os.replace(tmp, CACHE)

    def opener(self):
        if not getattr(self.local, "op", None):
            import http.cookiejar
            cj = http.cookiejar.CookieJar()
            self.local.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
            self.local.warm = set()
        return self.local.op

    def _req(self, url, data=None, ref=None, timeout=40):
        h = {"User-Agent": UA, "Accept-Language": "ko-KR,ko"}
        if ref:
            h["Referer"] = ref
        body = None
        if data is not None:
            body = urllib.parse.urlencode(data, doseq=True).encode()
            h["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8"
            h["X-Requested-With"] = "XMLHttpRequest"
        last = None
        for i in range(4):
            try:
                r = self.opener().open(urllib.request.Request(url, data=body, headers=h), timeout=timeout)
                return r.read()
            except Exception as e:
                last = e
                time.sleep(0.4 * (i + 1))
        raise RuntimeError(str(last))

    def warm(self, kind):
        if kind in getattr(self.local, "warm", set()):
            return
        if kind == "krx":
            self._req(KRX_PAGE)
        else:
            self._req(DART_PAGE)
        self.local.warm.add(kind)

    def krx_search(self, text):
        self.warm("krx")
        raw = self._req(KRX_JSON, {
            "bld": "dbms/comm/finder/finder_stkisu", "locale": "ko_KR",
            "mktsel": "ALL", "searchText": text, "typeNo": "0",
        }, KRX_PAGE, timeout=60)
        d = json.loads(raw.decode("utf-8", "replace"))
        return d.get("block1") or []

    def dart_search_html(self, text):
        self.warm("dart")
        data = {
            "currentPage": "1", "maxResults": "15", "maxLinks": "5", "sort": "", "series": "asc",
            "textCrpNm": text, "textCrpCik": "", "autoSearch": "true", "businessCode": "all",
            "bsnRgsNo": "", "searchIndex": "", "selectKey": "", "gubun": "",
            "corpType": ["P", "A", "X", "E"],
        }
        return self._req(DART_SEARCH, data, DART_PAGE).decode("utf-8", "replace")

    def dart_rows(self, text):
        t = self.dart_search_html(text)
        rows = []
        for cik, name, code in re.findall(r"select\('(\d+)'\).*?>(.*?)</a>.*?<td>(.*?)</td>", t, re.S):
            rows.append({"cik": cik, "name": re.sub(r"\s+", " ", name).strip(), "code": re.sub(r"\s+", "", code)})
        return rows

    def dart_addr(self, cik):
        t = self._req(DART_SELECT, {"selectKey": cik}, DART_PAGE).decode("utf-8", "replace")
        m = re.search(r"주소</label></th>\s*<td>(.*?)</td>", t, re.S)
        if not m:
            return ""
        addr = re.sub(r"<[^>]+>", " ", m.group(1))
        return re.sub(r"\s+", " ", addr).strip()

    def dart_history(self, cik):
        t = self._req(DART_HIST, {"cik": cik}, DART_PAGE).decode("utf-8", "replace")
        names = []
        for n in re.findall(r"<td[^>]*>\s*([^<]+?)\s*</td>", t):
            n = n.strip()
            if n and n not in ("순번", "회사이름") and not n.isdigit():
                names.append(n)
        return names

    def company_by_code(self, code, code_name):
        key = "code:" + code
        with self.cache_lock:
            hit = self.cache.get(key)
        if hit and hit.get("addr"):
            return hit
        rows = self.dart_rows(code)
        chosen = None
        for r in rows:
            if r["code"] == code:
                chosen = r
                break
        if chosen is None and len(rows) == 1 and rows[0]["code"]:
            chosen = rows[0]
        if chosen is None:
            return None
        addr = self.dart_addr(chosen["cik"])
        rec = {"cik": chosen["cik"], "dart_name": chosen["name"], "listed_code": chosen["code"], "addr": addr, "history": None, "code_name": code_name}
        with self.cache_lock:
            self.cache[key] = rec
        return rec

    def history_of(self, rec, code):
        if rec.get("history") is not None:
            return rec["history"]
        rec["history"] = self.dart_history(rec["cik"])
        with self.cache_lock:
            self.cache["code:" + code] = rec
        return rec["history"]


def hist_has(history, query):
    q = norm(query)
    return any(norm(n) == q for n in history or [])


def looks_preferred_display(name):
    n = strip_tags(name).replace(" ", "")
    return bool(re.search(r"\d*우[A-Z]?$", n)) and preferred_base(name) is not None


def main():
    holdings = json.load(open(HOLDINGS, encoding="utf-8"))
    rows_h = holdings["holdings"]
    total = Decimal(holdings["total_value_100m_krw"])
    cli = Client()
    kind_note = "blocked"
    try:
        b = cli._req(KIND_URL, ref="https://kind.krx.co.kr/corpgeneral/corpList.do?method=loadInitPage", timeout=25)
        kind_note = "ok" if "회사명" in b.decode("utf-8", "replace") else "unexpected"
    except Exception as e:
        kind_note = "blocked: " + type(e).__name__
    print("KIND", kind_note)

    print("KRX 종목 목록…")
    krx = cli.krx_search("")
    print("KRX", len(krx))
    by_norm = defaultdict(list)
    for r in krx:
        by_norm[norm(r["codeName"])].append(r)

    def exact(name):
        hits = by_norm.get(norm(name)) or []
        return hits[0] if len(hits) == 1 else None

    matched_rows = []  # (holding, krx row, how)
    pending = []
    for h in rows_h:
        name = h["company"]
        hit = exact(name)
        how = "exact"
        if hit is None:
            stripped = strip_tags(name)
            if stripped != name:
                hit = exact(stripped)
                how = "tag"
        if hit is None:
            base = preferred_base(name)
            if base:
                hit = exact(base)
                how = "preferred"
        if hit is not None:
            matched_rows.append((h, hit, how))
        else:
            pending.append(h)
    print("이름 일치", len(matched_rows), "남음", len(pending), [h["company"] for h in pending])

    def resolve_former(h):
        name = h["company"]
        try:
            found = cli.krx_search(name)
        except Exception as e:
            print("검색 실패", name, e)
            return h, None, None
        confirmed = []
        for r in found[:8]:
            try:
                rec = cli.company_by_code(r["short_code"], r["codeName"])
            except Exception as e:
                print("개황 실패", name, e)
                continue
            if not rec:
                continue
            try:
                hist = cli.history_of(rec, r["short_code"])
            except Exception:
                hist = []
            if hist_has(hist, name) or hist_has(hist, strip_tags(name)):
                confirmed.append((r, rec))
        ciks = {rec["cik"] for _, rec in confirmed}
        if len(ciks) == 1:
            r, rec = confirmed[0]
            return h, r, "history"
        if len(found) == 1:
            r = found[0]
            qn, cn = norm(name), norm(r["codeName"])
            if qn and qn not in cn and not any(qn in norm(o["codeName"]) and norm(o["codeName"]) != cn for o in krx):
                return h, r, "krx_former_name"
        # DART 회사명 검색은 예전 이름이 정확히 변경내역에 있을 때만.
        try:
            drows = cli.dart_rows(name)
        except Exception:
            drows = []
        hits = []
        for r in drows:
            if not r["code"]:
                continue
            try:
                hist = cli.dart_history(r["cik"])
            except Exception:
                continue
            if hist_has(hist, name) or hist_has(hist, strip_tags(name)):
                hits.append(r)
        if hits and len({r["cik"] for r in hits}) == 1:
            code = hits[0]["code"]
            krx_hit = next((x for x in krx if x["short_code"] == code), None)
            if krx_hit:
                return h, krx_hit, "history"
            return h, {"short_code": code, "codeName": hits[0]["name"]}, "history"
        return h, None, None

    if pending:
        print("예전 이름 확인", len(pending))
        with ThreadPoolExecutor(max_workers=4) as ex:
            futs = [ex.submit(resolve_former, h) for h in pending]
            for fut in as_completed(futs):
                h, hit, how = fut.result()
                if hit:
                    matched_rows.append((h, hit, how))
                    print("  연결", how, h["company"], "→", hit["codeName"], hit["short_code"])
                else:
                    print("  못 찾음", h["company"])
        cli.save_cache()

    need_codes = {}
    for h, hit, how in matched_rows:
        need_codes.setdefault(hit["short_code"], hit["codeName"])
    print("주소 조회", len(need_codes))

    def fetch_code(code):
        try:
            rec = cli.company_by_code(code, need_codes[code])
            return code, rec
        except Exception as e:
            return code, {"error": str(e)}

    resolved = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(fetch_code, c) for c in need_codes]
        done = 0
        for fut in as_completed(futs):
            code, rec = fut.result()
            resolved[code] = rec
            done += 1
            if done % 100 == 0:
                print("  ", done, "/", len(need_codes))
                cli.save_cache()
    cli.save_cache()

    # 우선주 코드가 DART에 없으면 보통주 코드로 다시 조회한다.
    retry = []
    for h, hit, how in matched_rows:
        rec = resolved.get(hit["short_code"])
        if rec and rec.get("addr"):
            continue
        base = preferred_base(hit["codeName"]) or preferred_base(h["company"])
        if not base:
            continue
        commons = [r for r in by_norm.get(norm(base), []) if preferred_base(r["codeName"]) is None]
        if len(commons) == 1:
            retry.append((hit["short_code"], commons[0]))
    if retry:
        print("보통주 코드로 재조회", len(retry))

        def fetch_common(pair):
            src, common = pair
            try:
                rec = cli.company_by_code(common["short_code"], common["codeName"])
                return src, rec
            except Exception as e:
                return src, {"error": str(e)}

        with ThreadPoolExecutor(max_workers=4) as ex:
            for fut in as_completed([ex.submit(fetch_common, p) for p in retry]):
                src, rec = fut.result()
                if rec and rec.get("addr"):
                    resolved[src] = rec
        cli.save_cache()

    points = load_geo()
    companies, unmatched = [], []
    for h, hit, how in matched_rows:
        rec = resolved.get(hit["short_code"]) or {}
        addr = rec.get("addr") or ""
        parsed = parse_addr(addr) if addr else None
        if not rec.get("cik") or not parsed or not parsed[0]:
            unmatched.append({"company": h["company"], "value_100m_krw": h["value_100m_krw"], "rank": h["rank"], "reason": "no_location"})
            continue
        sido, sigungu = parsed
        if not sigungu:
            unmatched.append({"company": h["company"], "value_100m_krw": h["value_100m_krw"], "rank": h["rank"], "reason": "no_sigungu", "sido_text": sido})
            continue
        ll = geo_ll(points, sido, sigungu)
        companies.append({
            "company": h["company"], "value_100m_krw": h["value_100m_krw"], "rank": h["rank"],
            "sido": sido, "sigungu": sigungu, "address": addr, "code": rec.get("listed_code") or hit["short_code"],
            "cik": rec["cik"], "dart_name": rec.get("dart_name") or "", "match": how,
            "lat": None if not ll else ll[0], "lng": None if not ll else ll[1],
        })
    matched_ids = {(h["company"], h["rank"]) for h, _, _ in matched_rows}
    for h in rows_h:
        if (h["company"], h["rank"]) not in matched_ids and not any(u["company"] == h["company"] and u["rank"] == h["rank"] for u in unmatched):
            unmatched.append({"company": h["company"], "value_100m_krw": h["value_100m_krw"], "rank": h["rank"], "reason": "no_name"})

    def emit(d):
        q = money(d)
        return int(q) if q == q.to_integral() else float(q)

    def gname(items):
        plain = [i for i in items if not looks_preferred_display(i["company"])]
        pool = plain or items
        return max(pool, key=lambda i: Decimal(str(i["value_100m_krw"])))["company"]

    by_sido = defaultdict(list)
    for c in companies:
        by_sido[c["sido"]].append(c)
    regions = []
    for sido, items in by_sido.items():
        value = sum((money(i["value_100m_krw"]) for i in items), Decimal("0"))
        groups = defaultdict(list)
        for i in items:
            groups[i["cik"]].append(i)
        ranked_cos = []
        for cik, gs in groups.items():
            ranked_cos.append({"company": gname(gs), "value_100m_krw": emit(sum((money(i["value_100m_krw"]) for i in gs), Decimal("0"))), "cik": cik})
        ranked_cos.sort(key=lambda x: -Decimal(str(x["value_100m_krw"])))
        by_gu = defaultdict(list)
        for i in items:
            by_gu[i["sigungu"]].append(i)
        sigs = []
        for gu, gs in by_gu.items():
            ggroups = defaultdict(list)
            for i in gs:
                ggroups[i["cik"]].append(i)
            tops = []
            for cik, rows in ggroups.items():
                tops.append({"company": gname(rows), "value_100m_krw": emit(sum((money(i["value_100m_krw"]) for i in rows), Decimal("0")))})
            tops.sort(key=lambda x: -Decimal(str(x["value_100m_krw"])))
            ll = geo_ll(points, sido, gu)
            sigs.append({
                "name": gu,
                "value_100m_krw": emit(sum((money(i["value_100m_krw"]) for i in gs), Decimal("0"))),
                "company_count": len(ggroups),
                "top": [{"company": t["company"], "value_100m_krw": t["value_100m_krw"]} for t in tops[:5]],
                "lat": None if not ll else ll[0], "lng": None if not ll else ll[1],
            })
        sigs.sort(key=lambda x: -Decimal(str(x["value_100m_krw"])))
        sll = geo_ll(points, sido, None)
        regions.append({
            "sido": sido,
            "value_100m_krw": emit(value),
            "company_count": len(groups),
            "top": [{"company": t["company"], "value_100m_krw": t["value_100m_krw"]} for t in ranked_cos[:5]],
            "lat": None if not sll else sll[0], "lng": None if not sll else sll[1],
            "sigungu": sigs,
        })
    regions.sort(key=lambda r: -Decimal(str(r["value_100m_krw"])))
    unmatched.sort(key=lambda u: -Decimal(str(u["value_100m_krw"])))
    unmatched_value = sum((money(u["value_100m_krw"]) for u in unmatched), Decimal("0"))
    matched_value = sum((money(c["value_100m_krw"]) for c in companies), Decimal("0"))
    print("matched", emit(matched_value), "unmatched", emit(unmatched_value), "total", emit(matched_value + unmatched_value), "file", holdings["total_value_100m_krw"])
    print("unmatched names:")
    for u in unmatched:
        print(" ", u["value_100m_krw"], u["company"], u.get("reason"))
    if matched_value + unmatched_value != total and matched_value + unmatched_value != money(total):
        # 원 합계가 정수로 떨어지면 money 합과 파일 총액이 같아야 한다.
        if money(matched_value + unmatched_value) != money(total):
            raise SystemExit("합계가 맞지 않음 %s vs %s" % (matched_value + unmatched_value, total))

    fetched = datetime.now(KST).strftime("%Y-%m-%d")
    # 페이지에 나가는 회사 목록은 주소·내부 키를 줄이지 않고 지역만 남긴다. 검산용 원본은 companies.
    out = {
        "fetched": fetched,
        "source": "금융감독원 DART 기업개황의 본사 주소. 종목 이름은 한국거래소 정보데이터시스템 종목검색으로 맞췄다.",
        "source_url": DART_PAGE,
        "sources": [
            {"role": "본사 주소", "name": "금융감독원 DART 기업개황", "url": DART_PAGE,
             "note": "OpenDART company.json 의 주소와 같은 공시"},
            {"role": "종목명", "name": "한국거래소 정보데이터시스템 종목검색", "url": KRX_PAGE,
             "note": "KIND 상장법인목록과 같은 거래소 종목 약명. 받은 날 KIND 응답: " + kind_note},
        ],
        "kind_url": KIND_URL,
        "kind_fetch": kind_note,
        "holdings_as_of": holdings.get("as_of"),
        "holdings_file": "data/nps/kr_holdings.json",
        "total_value_100m_krw": holdings["total_value_100m_krw"],
        "matched_value_100m_krw": emit(matched_value),
        "unmatched_value_100m_krw": emit(unmatched_value),
        "unmatched_count": len({u["company"] for u in unmatched}),
        "unmatched": [{"company": u["company"], "value_100m_krw": u["value_100m_krw"], "rank": u["rank"]} for u in unmatched],
        "regions": regions,
        "companies": [{k: c[k] for k in ("company", "value_100m_krw", "rank", "sido", "sigungu", "code", "match")} for c in companies],
    }
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("wrote", OUT, os.path.getsize(OUT))


if __name__ == "__main__":
    main()
