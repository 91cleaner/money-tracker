"""관제실용 세계 법안 기록: data/laws/<지역>.json  (kr, us, jp, tw, eu)

같은 모양으로 쌓는다: {id, t(제목 원문), d(날짜: 제출·발의·채택), st(상태), sd(상태 날짜), u(원문 링크), by(제안자), k(종류)}
- 매일 새로 받은 것을 이전 기록에 더한다(같은 id 는 새 값으로). 예전 기록은 지우지 않는다.
- 한 지역이 실패해도 다른 지역은 계속하고, 실패 이유를 ::warning:: 으로 남긴다(Actions 로그를 못 읽어도 보이게).
- 공식 출처만 쓴다. 법안 내용 해석·찬반 판단은 하지 않는다.

출처
  kr: 열린국회정보(이미 수집된 data/national/bills/*.json, 22대 대표 발의)
  us: Congress.gov API v3 /bill (CONGRESS_API_KEY) — 119대 의회
  jp: 衆議院 議案 목록(공식 HTML, 회기별)
  tw: 立法院 開放資料(data.ly.gov.tw) — 실패하면 g0v 立法院 API(ly.govapi.tw)
  eu: EUR-Lex(Publications Office) SPARQL — EU 규정(R)·지침(L)·결정(D)
"""
import glob
import html
import json
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "data", "laws")
UA = {"User-Agent": "Mozilla/5.0 (MONEY-TRACKER public-records research; +https://91cleaner.github.io/money-tracker/)", "Accept": "*/*"}
PROBE = os.environ.get("LAWS_PROBE") == "1"  # 브랜치 시험: 저장 대신 표본만 출력
NOW = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")


def get(url, data=None, headers=None, timeout=40, insecure_retry=False):
    h = dict(UA)
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except ssl.SSLError:
        if not insecure_retry:
            raise
        # 일부 정부 사이트는 중간 인증서를 빼먹는다. 공개 자료 '읽기'만 하므로 이 경우에 한해 검증 없이 다시 시도하고 기록한다.
        print("::warning::laws: TLS chain incomplete for " + urllib.parse.urlsplit(url).netloc + " — retried without verification (read-only public data)")
        ctx = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return r.read()


def why(e):
    return ("HTTP %s" % e.code) if hasattr(e, "code") else (type(e).__name__ + ": " + str(e)[:120])


def load(cc):
    try:
        d = json.load(open(os.path.join(OUT, cc + ".json"), encoding="utf-8"))
        return {r["id"]: r for r in d.get("rows", [])}, d
    except (OSError, ValueError):
        return {}, {}


def save(cc, rows, meta):
    if PROBE:
        sample = list(rows.values())[:3]
        print("::notice::laws %s PROBE rows=%d sample=%s" % (cc, len(rows), json.dumps(sample, ensure_ascii=False)[:900]))
        return
    os.makedirs(OUT, exist_ok=True)
    out = sorted(rows.values(), key=lambda r: (r.get("d") or "", r["id"]), reverse=True)
    doc = dict(meta, updated=NOW, count=len(out), rows=out)
    tmp = os.path.join(OUT, cc + ".json.tmp")
    json.dump(doc, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, os.path.join(OUT, cc + ".json"))


# ── 한국: 이미 모은 22대 대표 발의 ───────────────────────────────
def kr():
    mem = json.load(open(os.path.join(ROOT, "data", "national", "members.json"), encoding="utf-8")).get("members", [])
    names = {m["id"]: m.get("name", "") + (" (" + m["party"] + ")" if m.get("party") else "") for m in mem if m.get("id")}
    sec = json.load(open(os.path.join(ROOT, "data", "national", "security.json"), encoding="utf-8"))
    base = sec.get("bill_url") or "https://likms.assembly.go.kr/bill/billDetail.do?billId="
    rows, _ = load("kr")
    for path in glob.glob(os.path.join(ROOT, "data", "national", "bills", "*.json")):
        mid = os.path.basename(path)[:-5]
        lst = json.load(open(path, encoding="utf-8"))
        if isinstance(lst, dict):
            lst = lst.get("bills") or []
        for b in lst:
            if not b.get("id") or not b.get("n"):
                continue
            rows[b["id"]] = {"id": b["id"], "t": b["n"], "d": b.get("d") or "", "st": b.get("r") or "계류", "sd": "", "u": base + b["id"],
                             "by": "대표 발의 " + names.get(mid, ""), "k": "법률안", "c": b.get("c") or ""}
    save("kr", rows, {"cc": "kr", "source": "열린국회정보 (22대 국회 대표 발의)", "source_url": "https://open.assembly.go.kr/"})
    return len(rows)


# ── 미국: Congress.gov ───────────────────────────────────────────
US_KIND = {"HR": "house-bill", "S": "senate-bill", "HRES": "house-resolution", "SRES": "senate-resolution", "HJRES": "house-joint-resolution",
           "SJRES": "senate-joint-resolution", "HCONRES": "house-concurrent-resolution", "SCONRES": "senate-concurrent-resolution"}


def us():
    key = (os.environ.get("CONGRESS_API_KEY") or "").strip()
    if not key:
        print("::warning::laws us: CONGRESS_API_KEY empty — skipped")
        return 0
    congress = int(os.environ.get("US_CONGRESS", "119"))
    rows, prev = load("us")
    since = (prev.get("updated") or "")[:10]
    off, got, budget = 0, 0, time.time() + 9 * 60
    while time.time() < budget:
        q = {"api_key": key, "format": "json", "limit": 250, "offset": off, "sort": "updateDate+desc"}
        if since:  # 지난번 이후 바뀐 것만
            q["fromDateTime"] = since + "T00:00:00Z"
        url = "https://api.congress.gov/v3/bill/%d?%s" % (congress, urllib.parse.urlencode(q, safe="+"))
        try:
            d = json.loads(get(url).decode("utf-8"))
        except Exception as e:
            print("::warning::laws us: congress.gov " + why(e))
            break
        items = d.get("bills") or []
        for b in items:
            t = (b.get("type") or "").upper()
            num = b.get("number")
            if not t or not num:
                continue
            la = b.get("latestAction") or {}
            bid = "%d-%s%s" % (congress, t, num)
            old = rows.get(bid, {})
            rows[bid] = {"id": bid, "t": b.get("title") or "", "d": old.get("d") or b.get("introducedDate") or la.get("actionDate") or "",
                         "st": (la.get("text") or "")[:200], "sd": la.get("actionDate") or "",
                         "u": "https://www.congress.gov/bill/%dth-congress/%s/%s" % (congress, US_KIND.get(t, "house-bill"), num),
                         "by": b.get("originChamber") or "", "k": t}
        got += len(items)
        if len(items) < 250:
            break
        off += 250
        time.sleep(0.4)
    save("us", rows, {"cc": "us", "source": "Congress.gov API (Library of Congress)", "source_url": "https://www.congress.gov/", "congress": congress,
                      "note": "d = introduced date when known, otherwise first seen latest-action date"})
    print("laws us: fetched %d, total %d" % (got, len(rows)))
    return len(rows)


# ── 일본: 衆議院 議案 ────────────────────────────────────────────
JP_BASE = "https://www.shugiin.go.jp/internet/itdb_gian.nsf/html/gian/"


def jp_text(raw):
    for enc in ("shift_jis", "cp932", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("cp932", "replace")


def strip(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def jp():
    rows, _ = load("jp")
    try:
        menu = jp_text(get(JP_BASE + "menu.htm"))
    except Exception as e:
        print("::warning::laws jp: menu " + why(e))
        return len(rows)
    sessions = sorted({int(x) for x in re.findall(r"kaiji(\d{3})\.htm", menu)}, reverse=True)[:int(os.environ.get("JP_SESSIONS", "6"))]
    if not sessions:
        print("::warning::laws jp: no session links on menu.htm (layout changed?) sample=" + strip(menu)[:200])
    for s in sessions:
        try:
            page = jp_text(get(JP_BASE + "kaiji%d.htm" % s))
        except Exception as e:
            print("::warning::laws jp: session %d %s" % (s, why(e)))
            continue
        # 표: 種類(閣法/衆法/参法 등) 블록 안의 행 = 提出回次 | 番号 | 議案件名 | 審議状況 | 経過 | 本文
        kind = ""
        n0 = len(rows)
        for block in re.split(r"(?=<caption)", page, flags=re.I):
            cap = re.search(r"<caption[^>]*>(.*?)</caption>", block, flags=re.I | re.S)
            if cap:
                kind = strip(cap.group(1))
            for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", block, flags=re.I | re.S):
                tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.I | re.S)
                if len(tds) < 4:
                    continue
                cells = [strip(x) for x in tds]
                if not re.match(r"^\d+$", cells[0]) or not re.match(r"^\d+$", cells[1]):
                    continue
                link = re.search(r'href="([^"]+)"', tds[4] if len(tds) > 4 else tr)
                url = urllib.parse.urljoin(JP_BASE + "kaiji%d.htm" % s, html.unescape(link.group(1))) if link else JP_BASE + "kaiji%d.htm" % s
                bid = "%s-%s-%s-%s" % (s, kind or "議案", cells[0], cells[1])
                rows[bid] = {"id": bid, "t": cells[2], "d": "", "st": cells[3], "sd": "", "u": url, "by": kind, "k": kind, "session": s, "submitted_session": int(cells[0])}
        if len(rows) == n0:
            print("::warning::laws jp: session %d parsed 0 rows (layout?) sample=%s" % (s, strip(page)[:200]))
        time.sleep(1.0)
    save("jp", rows, {"cc": "jp", "source": "衆議院 議案情報 (shugiin.go.jp)", "source_url": JP_BASE + "menu.htm",
                      "note": "d is empty: the bill list has no dates; 'session' = Diet session where it was listed"})
    print("laws jp: sessions %s total %d" % (sessions, len(rows)))
    return len(rows)


# ── 대만: 立法院 ─────────────────────────────────────────────────
def tw():
    rows, _ = load("tw")
    term = os.environ.get("TW_TERM", "11")
    tried = []
    # 1) 공식 開放資料: 議案提案 (ID20)
    for _ in range(1):
        url = "https://data.ly.gov.tw/odw/ID20Action.action?" + urllib.parse.urlencode({"term": term, "sessionPeriod": "", "sessionTimes": "", "meetingTimes": "", "billName": "", "billOrg": "", "billProposer": "", "billCosignatory": "", "fileType": "json"})
        try:
            d = json.loads(get(url, insecure_retry=True, timeout=60).decode("utf-8-sig"))
        except Exception as e:
            tried.append("data.ly.gov.tw ID20: " + why(e))
            break
        items = d.get("dataList") or d.get("data") or (d if isinstance(d, list) else [])
        for b in items:
            bid = str(b.get("billNo") or b.get("議案編號") or "")
            if not bid:
                continue
            rows["ly-" + bid] = {"id": "ly-" + bid, "t": b.get("billName") or b.get("議案名稱") or "", "d": str(b.get("date") or b.get("提案日期") or ""),
                                 "st": b.get("billStatus") or b.get("議案狀態") or "", "sd": "", "by": b.get("billOrg") or b.get("billProposer") or "",
                                 "u": b.get("pdfUrl") or b.get("docUrl") or "https://ppg.ly.gov.tw/ppg/bills/%s/details" % bid, "k": "議案"}
    # 2) g0v 立法院 API (공식 데이터를 다시 정리해 주는 공개 API)
    if not rows or tried:
        for page in range(1, int(os.environ.get("TW_PAGES", "20")) + 1):
            url = "https://ly.govapi.tw/v2/bills?" + urllib.parse.urlencode({"屆": term, "page": page, "limit": 200})
            try:
                d = json.loads(get(url, timeout=60).decode("utf-8"))
            except Exception as e:
                tried.append("ly.govapi.tw v2: " + why(e))
                break
            items = d.get("bills") or d.get("data") or []
            if page == 1 and items:
                print("::notice::laws tw: ly.govapi.tw fields=" + ",".join(list(items[0].keys())[:25]))
            for b in items:
                bid = str(b.get("議案編號") or b.get("billNo") or "")
                if not bid:
                    continue
                prop = b.get("提案人") or b.get("提案單位") or ""
                if isinstance(prop, list):
                    prop = "、".join(map(str, prop[:5]))
                rows["ly-" + bid] = {"id": "ly-" + bid, "t": b.get("議案名稱") or b.get("billName") or "", "d": str(b.get("提案日期") or b.get("最新進度日期") or "")[:10],
                                     "st": b.get("議案狀態") or "", "sd": str(b.get("最新進度日期") or "")[:10], "by": str(prop),
                                     "u": b.get("url") or "https://ppg.ly.gov.tw/ppg/bills/%s/details" % bid, "k": b.get("議案類別") or "議案"}
            if len(items) < 200:
                break
            time.sleep(0.5)
    for t in tried:
        print("::warning::laws tw: " + t)
    save("tw", rows, {"cc": "tw", "source": "立法院 開放資料 / g0v 立法院 API", "source_url": "https://data.ly.gov.tw/", "term": term})
    print("laws tw: total %d" % len(rows))
    return len(rows)


# ── 유럽: EUR-Lex SPARQL ─────────────────────────────────────────
EU_SPARQL = "https://publications.europa.eu/webapi/rdf/sparql"


def eu():
    rows, prev = load("eu")
    start_year = int(os.environ.get("EU_FROM_YEAR", "2019"))
    years = range(start_year, date.today().year + 1) if not rows else [date.today().year - 1, date.today().year]
    kinds = {"R": "Regulation", "L": "Directive", "D": "Decision"}
    for y in years:
        q = """
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT DISTINCT ?celex ?date ?title WHERE {
  ?work cdm:resource_legal_id_celex ?celex ; cdm:work_date_document ?date .
  FILTER(?date >= "%d-01-01"^^xsd:date && ?date <= "%d-12-31"^^xsd:date)
  FILTER(REGEX(STR(?celex), "^3%d[RLD][0-9]{4}$"))
  ?exp cdm:expression_belongs_to_work ?work ;
       cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/ENG> ;
       cdm:expression_title ?title .
} LIMIT 4000""" % (y, y, y)
        body = urllib.parse.urlencode({"query": q, "format": "application/sparql-results+json"}).encode()
        try:
            d = json.loads(get(EU_SPARQL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/sparql-results+json"}, timeout=120).decode("utf-8"))
        except Exception as e:
            print("::warning::laws eu: %d %s" % (y, why(e)))
            continue
        n0 = len(rows)
        for b in (d.get("results") or {}).get("bindings") or []:
            celex = b["celex"]["value"]
            k = kinds.get(celex[5], "Act")
            rows[celex] = {"id": celex, "t": b["title"]["value"][:400], "d": b["date"]["value"][:10], "st": "adopted", "sd": b["date"]["value"][:10],
                           "u": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:" + celex, "by": "European Union", "k": k}
        print("laws eu: %d +%d" % (y, len(rows) - n0))
        time.sleep(1.0)
    save("eu", rows, {"cc": "eu", "source": "EUR-Lex (Publications Office of the EU) — regulations, directives, decisions",
                      "source_url": "https://eur-lex.europa.eu/", "note": "adopted acts (sector 3). d = date of document"})
    return len(rows)


def main():
    which = (sys.argv[1:] or ["kr", "us", "jp", "tw", "eu"])
    done = {}
    for cc in which:
        fn = {"kr": kr, "us": us, "jp": jp, "tw": tw, "eu": eu}[cc]
        try:
            done[cc] = fn()
        except Exception as e:
            print("::warning::laws %s failed: %s" % (cc, why(e)))
            done[cc] = None
    print("::notice::laws counts " + json.dumps(done))


if __name__ == "__main__":
    main()
