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


def get(url, data=None, headers=None, timeout=40, insecure_retry=False, legacy=False):
    h = dict(UA)
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h)
    ctx = None
    if legacy:
        # 대만 立法院 서버는 옛 TLS 재협상을 써서 OpenSSL 3 기본값이 거부한다(UNSAFE_LEGACY_RENEGOTIATION_DISABLED).
        ctx = ssl.create_default_context()
        ctx.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0x4)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return r.read()
    except ssl.SSLError:
        if not insecure_retry:
            raise
        # 일부 정부 사이트는 중간 인증서를 빼먹는다. 공개 자료 '읽기'만 하므로 이 경우에 한해 검증 없이 다시 시도하고 기록한다.
        print("::warning::laws: TLS chain incomplete for " + urllib.parse.urlsplit(url).netloc + " — retried without verification (read-only public data)")
        ctx = ssl._create_unverified_context()
        if legacy:
            ctx.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0x4)
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
    """119대(현재) + 과거 의회(US_CONGRESSES, 기본 119,118,117). 과거 의회는 한 번 다 받으면(backfilled) 이후엔 바뀐 것만."""
    key = (os.environ.get("CONGRESS_API_KEY") or "").strip()
    if not key:
        print("::warning::laws us: CONGRESS_API_KEY empty — skipped")
        return 0
    congresses = [int(x) for x in os.environ.get("US_CONGRESSES", "119,118,117").split(",") if x.strip()]
    rows, prev = load("us")
    backfilled = set(prev.get("backfilled") or [])
    if any(r.startswith("119-") for r in rows):
        backfilled.add(119)  # 첫 실행에서 119대는 이미 다 받음
    budget = time.time() + float(os.environ.get("US_BUDGET_MIN", "18")) * 60
    since = (prev.get("updated") or "")[:10]
    for congress in congresses:
        off, got, complete = int((prev.get("resume") or {}).get(str(congress), 0)), 0, False
        incremental = congress in backfilled and since
        while time.time() < budget:
            q = {"api_key": key, "format": "json", "limit": 250, "offset": off, "sort": "updateDate+desc"}
            if incremental:
                q["fromDateTime"] = since + "T00:00:00Z"
            url = "https://api.congress.gov/v3/bill/%d?%s" % (congress, urllib.parse.urlencode(q, safe="+"))
            try:
                d = json.loads(get(url).decode("utf-8"))
            except Exception as e:
                print("::warning::laws us %d: congress.gov %s" % (congress, why(e)))
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
                             "by": b.get("originChamber") or "", "k": t, "congress": congress}
            got += len(items)
            off += len(items)
            if len(items) < 250:
                complete = True
                break
            time.sleep(0.4)
        if complete:
            backfilled.add(congress)
            (prev.setdefault("resume", {})).pop(str(congress), None)
        elif not incremental:
            prev.setdefault("resume", {})[str(congress)] = off  # 다음 실행에서 이어서
        print("laws us %d: fetched %d%s" % (congress, got, " (complete)" if complete else " (resume at %d)" % off))
    save("us", rows, {"cc": "us", "source": "Congress.gov API (Library of Congress)", "source_url": "https://www.congress.gov/", "congresses": congresses,
                      "backfilled": sorted(backfilled), "resume": prev.get("resume") or {},
                      "note": "d = introduced date when known, otherwise first seen latest-action date"})
    print("laws us: total %d" % len(rows))
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
    cur = re.search(r"第\s*(\d{3})\s*回国会", strip(menu))
    links = {int(x) for x in re.findall(r"kaiji(\d{3})\.htm", menu)}
    top = int(cur.group(1)) if cur else (max(links) if links else 0)
    if not top:
        print("::warning::laws jp: cannot find current session number sample=" + strip(menu)[:200])
        return len(rows)
    n = int(os.environ.get("JP_SESSIONS", "8"))
    sessions = list(range(top, max(top - n, 150), -1))
    for s in sessions:
        page = None
        for name in (("menu.htm",) if s == top else ()) + ("kaiji%d.htm" % s,):
            try:
                page = menu if name == "menu.htm" else jp_text(get(JP_BASE + name))
                break
            except Exception as e:
                print("::warning::laws jp: session %d %s %s" % (s, name, why(e)))
        if page is None:
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
                url = urllib.parse.urljoin(JP_BASE + "menu.htm", html.unescape(link.group(1))) if link else JP_BASE + "menu.htm"
                bid = "%s-%s-%s-%s" % (s, kind or "議案", cells[0], cells[1])
                rows[bid] = {"id": bid, "t": cells[2], "d": "", "st": cells[3], "sd": "", "u": url, "by": kind, "k": kind, "session": s, "submitted_session": int(cells[0])}
        if len(rows) == n0:
            trs = re.findall(r"<tr[^>]*>(.*?)</tr>", page, flags=re.I | re.S)
            print("::warning::laws jp: session %d parsed 0 rows (layout?) tables=%d rows=%d first_row=%s" % (s, len(re.findall(r"<table", page, flags=re.I)), len(trs), strip(trs[1] if len(trs) > 1 else page)[:240]))
        time.sleep(1.0)
    jp_dates(rows)
    save("jp", rows, {"cc": "jp", "source": "衆議院 議案情報 (shugiin.go.jp)", "source_url": JP_BASE + "menu.htm",
                      "note": "d = 衆議院 議案受理日(경과 페이지), sd = 성립·공포 등 마지막 날짜. 날짜는 하루 예산만큼 채움"})
    print("laws jp: sessions %s total %d" % (sessions, len(rows)))
    return len(rows)


ERA = {"令和": 2018, "平成": 1988, "昭和": 1925}


def jp_date(txt):
    m = re.search(r"(令和|平成|昭和)\s*(元|\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日", txt)
    if not m:
        return ""
    y = 1 if m.group(2) == "元" else int(m.group(2))
    return "%04d-%02d-%02d" % (ERA[m.group(1)] + y, int(m.group(3)), int(m.group(4)))


def jp_dates(rows):
    """경과 페이지에서 衆議院 議案受理年月日(제출)·성립/공포 날짜를 읽는다. 예산 안에서 날짜 없는 것부터."""
    budget = time.time() + float(os.environ.get("JP_DATE_BUDGET_MIN", "8")) * 60
    todo = [r for r in rows.values() if not r.get("d") and "/keika/" in (r.get("u") or "")]
    todo.sort(key=lambda r: -int(r.get("session") or 0))
    done = 0
    for r in todo:
        if time.time() > budget:
            break
        try:
            page = strip(jp_text(get(r["u"])))
        except Exception as e:
            print("::warning::laws jp keika %s %s" % (r["id"], why(e)))
            time.sleep(2)
            continue
        recv = re.search(r"衆議院議案受理年月日\s*(\S+\s*\S*\s*\S*)", page)
        d = jp_date(recv.group(1)) if recv else ""
        if not d:  # 참의원 先議 등: 참의원 受理 날짜
            recv = re.search(r"参議院議案受理年月日\s*(\S+\s*\S*\s*\S*)", page)
            d = jp_date(recv.group(1)) if recv else ""
        last = ""
        for label in ("公布年月日", "成立年月日", "衆議院議決年月日"):
            m = re.search(label + r"\s*(\S+\s*\S*\s*\S*)", page)
            if m and jp_date(m.group(1)):
                last = jp_date(m.group(1))
                break
        if d:
            r["d"] = d
        if last:
            r["sd"] = last
        done += 1
        time.sleep(0.8)
    left = sum(1 for r in rows.values() if not r.get("d"))
    print("laws jp: dates filled %d this run, %d still without date" % (done, left))


# ── 대만: 立法院 ─────────────────────────────────────────────────
def tw():
    rows, _ = load("tw")
    term = os.environ.get("TW_TERM", "11")
    tried = []
    # 1) 공식 開放資料: 議案提案 (ID20)
    for _ in range(1):
        url = "https://data.ly.gov.tw/odw/ID20Action.action?" + urllib.parse.urlencode({"term": term, "sessionPeriod": "", "sessionTimes": "", "meetingTimes": "", "billName": "", "billOrg": "", "billProposer": "", "billCosignatory": "", "fileType": "json"})
        try:
            d = json.loads(get(url, insecure_retry=True, legacy=True, timeout=90).decode("utf-8-sig"))
        except Exception as e:
            tried.append("data.ly.gov.tw ID20: " + why(e))
            break
        items = d.get("dataList") or d.get("data") or (d if isinstance(d, list) else [])
        if items:
            print("::notice::laws tw official fields=" + ",".join(list(items[0].keys())[:30]) + " sample=" + json.dumps(items[0], ensure_ascii=False)[:400])
        today = date.today().isoformat()
        for b in items:
            bid = str(b.get("billNo") or b.get("議案編號") or "")
            if not bid:
                continue
            raw_d = str(b.get("date") or b.get("提案日期") or b.get("billDate") or b.get("receiveDate") or b.get("收文日期") or "")[:10].replace("/", "-")
            if re.match(r"^\d{7}$", raw_d.replace("-", "")):  # 民國 날짜(예: 1131015) → 서기
                x = raw_d.replace("-", ""); raw_d = "%04d-%s-%s" % (int(x[:3]) + 1911, x[3:5], x[5:7])
            if raw_d > today:
                raw_d = ""
            rows["ly-" + bid] = {"id": "ly-" + bid, "t": b.get("billName") or b.get("議案名稱") or "", "d": raw_d,
                                 "st": b.get("billStatus") or b.get("議案狀態") or "", "sd": "", "by": b.get("billOrg") or b.get("billProposer") or "",
                                 "u": b.get("pdfUrl") or b.get("docUrl") or "https://ppg.ly.gov.tw/ppg/bills/%s/details" % bid, "k": "議案"}
    # 2) g0v 立法院 API (공식 데이터를 다시 정리해 주는 공개 API). 천천히, 429면 기다렸다가, 다음 실행에서 이어서.
    if not rows or tried:
        state_path = os.path.join(OUT, "tw.state.json")
        try:
            state = json.load(open(state_path, encoding="utf-8"))
        except (OSError, ValueError):
            state = {}
        page = int(state.get("next_page") or 1)
        today = date.today().isoformat()
        budget = time.time() + float(os.environ.get("TW_BUDGET_MIN", "12")) * 60
        done_all = False
        while time.time() < budget:
            url = "https://ly.govapi.tw/v2/bills?" + urllib.parse.urlencode({"屆": term, "page": page, "limit": 200})
            d = None
            for wait in (0, 30, 90):
                if wait:
                    time.sleep(wait)
                try:
                    d = json.loads(get(url, timeout=60).decode("utf-8"))
                    break
                except Exception as e:
                    if getattr(e, "code", None) == 429:
                        continue
                    tried.append("ly.govapi.tw v2 page %d: %s" % (page, why(e)))
                    break
            if d is None:
                if not any("page %d" % page in t for t in tried):
                    tried.append("ly.govapi.tw v2 page %d: HTTP 429 after retries (will resume)" % page)
                break
            items = d.get("bills") or d.get("data") or []
            for b in items:
                bid = str(b.get("議案編號") or b.get("billNo") or "")
                if not bid:
                    continue
                prop = b.get("提案人") or b.get("提案單位/提案委員") or b.get("提案單位") or ""
                if isinstance(prop, list):
                    prop = "、".join(map(str, prop[:5]))
                latest = str(b.get("最新進度日期") or "")[:10]
                first = str(b.get("提案日期") or "")[:10]
                if not first and latest and latest <= today:
                    first = latest  # 제안일이 없으면 지난 진행 날짜만(앞으로 열릴 회의 날짜는 쓰지 않음)
                rows["ly-" + bid] = {"id": "ly-" + bid, "t": b.get("議案名稱") or b.get("billName") or "", "d": first,
                                     "st": b.get("議案狀態") or "", "sd": latest, "by": str(prop)[:120],
                                     "u": b.get("url") or "https://ppg.ly.gov.tw/ppg/bills/%s/details" % bid, "k": b.get("議案類別") or "議案"}
            if len(items) < 200:
                done_all = True
                break
            page += 1
            time.sleep(3)
        if not PROBE:
            os.makedirs(OUT, exist_ok=True)
            json.dump({"next_page": 1 if done_all else page, "updated": NOW}, open(state_path, "w", encoding="utf-8"))
        print("laws tw: g0v pages up to %d%s" % (page, " (complete)" if done_all else " (resume next run)"))
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
