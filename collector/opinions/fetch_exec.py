"""CEO·임원 발언 수집(무료 공식 출처만): SEC 8-K Item 2.02/7.01 보도자료 첨부(EX-99) + 회사 IR 보도자료 RSS.
-> data/opinions/auto/exec-YYYY-MM-DD.json (드롭 파일과 같은 스키마, source = sec8k | ir_rss). build.py 가 검증·합친다.
한 곳이 실패해도 나머지는 계속한다(실패는 ::warning:: 로만 남김). 목록: data/opinions/execs.json
실행: python3 collector/opinions/fetch_exec.py [--days 10]
"""
import json, os, re, sys, urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from html import unescape
from urllib.parse import urljoin

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as B

UA = {"User-Agent": "money-tracker research bot (github.com/91cleaner/money-tracker)", "Accept-Encoding": "identity"}
ITEMS = ("2.02", "7.01")
QUOTE_RE = re.compile(r"[“\"]([^”\"]{25,600}?)[”\"]")


def get(url, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def strip_html(h):
    h = re.sub(r"(?is)<(script|style).*?</\1>", " ", h)
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    return re.sub(r"\s+", " ", unescape(h)).strip()


def extract_exec_quote(text, exec_name, limit=B.MAX_TEXT):
    """보도자료 본문에서 '"…," said <임원>' 꼴의 첫 인용 한 개를 limit 자 이내로. 없거나 금지 표현이면 None."""
    if not exec_name:
        return None
    last = exec_name.split()[-1]
    for m in QUOTE_RE.finditer(text):
        q = m.group(1).strip().rstrip(",")
        around = text[max(0, m.start() - 120):m.end() + 120]
        if exec_name not in around and last not in around:
            continue
        if len(q) > limit:                       # 첫 문장만 쓰되, 그래도 길면 버린다
            first = re.match(r"(.{20,%d}?[.!?])(\s|$)" % limit, q)
            if not first:
                continue
            q = first.group(1)
        if B.banned_hit(q):
            continue
        return q
    return None


def row(co, quote, day, doc_url, source, rid):
    return {"id": rid, "handle": co["ticker"].lower(), "name": co["exec_name"], "role": "exec", "title": co.get("title", "CEO"),
            "tickers": [co["ticker"]], "text": quote, "lang": "en", "created_at": day + "T00:00:00Z", "url": doc_url, "source": source}


def sec_8k(co, since):
    cik = co["cik"]
    sub = json.loads(get("https://data.sec.gov/submissions/CIK%s.json" % cik))
    rec = sub["filings"]["recent"]
    out = []
    for form, items, day, acc in zip(rec["form"], rec["items"], rec["filingDate"], rec["accessionNumber"]):
        if form != "8-K" or day < since or not any(i in items.split(",") for i in ITEMS):
            continue
        base = "https://www.sec.gov/Archives/edgar/data/%d/%s/" % (int(cik), acc.replace("-", ""))
        idx = json.loads(get(base + "index.json"))
        docs = [d["name"] for d in idx["directory"]["item"] if re.search(r"(?i)ex-?99.*\.html?$", d["name"])]
        for name in docs[:2]:
            q = extract_exec_quote(strip_html(get(base + name)), co["exec_name"])
            if q:
                out.append(row(co, q, day, base + name, "sec8k", "sec8k-%s-%s" % (co["ticker"], acc)))
                break
    return out


def ir_rss(co, since):
    root = ET.fromstring(get(co["ir_rss"]))
    out = []
    for it in root.iter("item"):
        link = (it.findtext("link") or "").strip()
        pub = (it.findtext("pubDate") or "").strip()
        try:
            from email.utils import parsedate_to_datetime
            day = parsedate_to_datetime(pub).astimezone(timezone.utc).date().isoformat()
        except Exception:
            continue
        if day < since or not link.startswith("https://"):
            continue
        body = it.findtext("description") or ""
        q = extract_exec_quote(strip_html(body), co["exec_name"]) or extract_exec_quote(strip_html(get(link)), co["exec_name"])
        if q:
            out.append(row(co, q, day, link, "ir_rss", "ir-%s-%s" % (co["ticker"], re.sub(r"\W+", "", link)[-40:])))
    return out


def main(argv):
    days = int(argv[argv.index("--days") + 1]) if "--days" in argv else 10
    since = (date.today() - timedelta(days=days)).isoformat()
    with open(os.path.join(B.OP, "execs.json"), encoding="utf-8") as f:
        cos = json.load(f)["companies"]
    rows = []
    for co in cos:
        for fn, on in ((sec_8k, bool(co.get("cik"))), (ir_rss, co.get("ir_rss", "").startswith("https://"))):
            if not on:
                continue
            try:
                rows += fn(co, since)
            except Exception as e:   # 한 회사·한 출처 실패가 전체를 막지 않게
                print("::warning::임원 발언 수집 실패 %s %s: %s" % (co["ticker"], fn.__name__, type(e).__name__))
    os.makedirs(os.path.join(B.OP, "auto"), exist_ok=True)
    fp = os.path.join(B.OP, "auto", "exec-%s.json" % date.today().isoformat())
    prev = []
    if os.path.exists(fp):
        with open(fp, encoding="utf-8") as f:
            prev = json.load(f)
    have = {r["id"] for r in rows}
    rows += [r for r in prev if r["id"] not in have]
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("임원 발언 %d건" % len(rows))


if __name__ == "__main__":
    main(sys.argv[1:])
