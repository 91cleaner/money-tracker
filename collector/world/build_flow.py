"""관제실 흐름 자료: data/world/topics.json + data/world/topic-<id>.json + data/world/titles-<cc>.json

data/laws/*.json(5개 지역 법안)과 data/markets/*.json(주가 역사)을 묶는다.
- 주제별: 지역별 법안 수·통과 수·월별 추이(최근 36개월)·최근 법안, 관련 시세 목록, 지도 위치
- 통과된 법안마다 '그날 전후 관련 시세 변화'(이전 5거래일 → 이후 20거래일)를 미리 계산해 둔다(인과 아님, 같은 시기 기록)
- 자유 검색용: 지역별 제목 목록(작게)
"""
import bisect
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(__file__))
from topics import PARLIAMENTS, REGION_LABEL, REGION_WORDS, TOPICS  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LAWS = os.path.join(ROOT, "data", "laws")
MK = os.path.join(ROOT, "data", "markets")
OUT = os.path.join(ROOT, "data", "world")
CCS = ["kr", "us", "jp", "tw", "eu"]
MARKET_INDEX = {"kr": "^KS11", "us": "^GSPC", "jp": "^N225", "tw": "^TWII", "eu": "^STOXX50E"}


def passed(cc, r):
    st = (r.get("st") or "")
    if cc == "us":
        return 2 if re.search(r"Became Public Law|Signed by President", st, re.I) else (1 if re.search(r"Passed|agreed to", st, re.I) else 0)
    if cc == "kr":
        return 2 if re.search(r"가결", st) else 0
    if cc == "eu":
        return 2
    if cc == "tw":
        return 2 if re.search(r"三讀", st) else 0
    if cc == "jp":
        return 2 if re.search(r"成立", st) else 0
    return 0


def valid_day(value):
    """Return a verified, non-future ISO calendar day or empty string."""
    try:
        day = date.fromisoformat(str(value or "")[:10])
        return day.isoformat() if day <= date.today() else ""
    except (TypeError, ValueError):
        return ""


def event_date(cc, row):
    """A passage event must use the actual action date, never introduction date.

    US/KR/JP/TW: 'd' is introduction/submission, 'sd' is status/action.
    EU: corpus consists of adopted acts, whose 'd' is document date.
    Missing action dates must not generate misleading market-return events.
    """
    if passed(cc, row) != 2:
        return ""
    return valid_day(row.get("d") if cc == "eu" else row.get("sd"))


def topic_hits(title):
    t = " " + (title or "").lower() + " "
    out = []
    for tp in TOPICS:
        for w in tp["words"]:
            if w.lower() in t:
                out.append(tp["id"])
                break
    return out


def load_markets():
    idx = json.load(open(os.path.join(MK, "index.json"), encoding="utf-8"))["series"]
    series = {}
    for s in idx:
        d = json.load(open(os.path.join(MK, s["file"]), encoding="utf-8"))
        series[s["symbol"]] = (d["d"], d["c"])
    return idx, series


def move(series, sym, day, before=5, after=20):
    """day 의 앞 5거래일 종가 → 뒤 20거래일 종가 변화율(%). 자료가 모자라면 None."""
    if sym not in series:
        return None
    ds, cs = series[sym]
    i = bisect.bisect_left(ds, day)
    if i >= len(ds) or i - before < 0 or i + after >= len(ds):
        return None
    a, b = cs[i - before], cs[i + after]
    return round((b / a - 1) * 100, 2) if a else None


def dump(name, obj):
    os.makedirs(OUT, exist_ok=True)
    tmp = os.path.join(OUT, name + ".tmp")
    json.dump(obj, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, os.path.join(OUT, name))


def main():
    laws = {}
    for cc in CCS:
        try:
            laws[cc] = json.load(open(os.path.join(LAWS, cc + ".json"), encoding="utf-8"))
        except (OSError, ValueError):
            laws[cc] = {"rows": []}
    midx, series = load_markets()
    by_tag = defaultdict(list)
    for s in midx:
        for t in s["tags"]:
            by_tag[t].append(s)
    today = date.today()
    months = []
    y, m = today.year, today.month
    for _ in range(36):
        months.append("%04d-%02d" % (y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    months.reverse()
    first_month = months[0]

    per = {tp["id"]: {"count": Counter(), "passed": Counter(), "monthly": defaultdict(Counter), "recent": defaultdict(list), "events": []} for tp in TOPICS}
    for cc in CCS:
        for r in laws[cc].get("rows", []):
            hits = topic_hits(r.get("t"))
            if not hits:
                continue
            p = passed(cc, r)
            day = (r.get("d") or "")[:10]
            for tid in hits:
                P = per[tid]
                P["count"][cc] += 1
                if p == 2:
                    P["passed"][cc] += 1
                if day[:7] >= first_month:
                    P["monthly"][cc][day[:7]] += 1
                P["recent"][cc].append(r)
                action_day = event_date(cc, r)
                if action_day:
                    P["events"].append((action_day, cc, r))

    topics_out = []
    for tp in TOPICS:
        P = per[tp["id"]]
        syms = []
        for t in tp["tags"]:
            for s in by_tag.get(t, []):
                if s["symbol"] not in [x["symbol"] for x in syms]:
                    syms.append({k: s[k] for k in ("symbol", "name", "region", "currency", "file", "last", "close", "m1", "y1")})
        recent = {}
        for cc in CCS:
            rows = sorted(P["recent"][cc], key=lambda r: (r.get("d") or "", r["id"]), reverse=True)[:60]
            recent[cc] = [{"t": r["t"][:220], "d": r.get("d") or "", "st": (r.get("st") or "")[:80], "u": r.get("u") or "", "by": (r.get("by") or "")[:60], "p": passed(cc, r), "pd": event_date(cc, r)} for r in rows]
        # 통과된 법안 전후 시세(최근 3년, 지역별 대표 지수 + 주제 시세 앞 2개)
        ev = []
        stock_like = [s for s in syms if s["region"] not in ("fx", "commodity", "rates", "crypto")]
        glob_sym = next((s["symbol"] for s in stock_like if s["region"] == "us"), None)
        for day, cc, r in sorted(P["events"], key=lambda e: e[0], reverse=True):
            if day < "%04d-01-01" % (today.year - 5):
                break
            # 법안이 나온 지역의 관련 종목 2개 + (없으면) 미국 대표 + 그 지역 지수
            key_syms = [s["symbol"] for s in stock_like if s["region"] == cc][:2] or ([glob_sym] if glob_sym else [])
            mv = {s: move(series, s, day) for s in key_syms}
            mv[MARKET_INDEX[cc]] = move(series, MARKET_INDEX[cc], day)
            ev.append({"d": day, "cc": cc, "t": r["t"][:180], "u": r.get("u") or "", "mv": {k: v for k, v in mv.items() if v is not None}})
            if len(ev) >= 200:
                break
        doc = {"id": tp["id"], "label": tp["label"], "words": tp["words"], "anchors": tp["anchors"], "parliaments": PARLIAMENTS,
               "count": dict(P["count"]), "passed": dict(P["passed"]), "months": months,
               "monthly": {cc: [P["monthly"][cc].get(mo, 0) for mo in months] for cc in CCS},
               "recent": recent, "markets": syms, "index": MARKET_INDEX, "events": ev,
               "note": "법안 제목 낱말로 주제 분류. 전후 시세는 확인된 통과/성립 날짜(sd; EU는 문서일 d)가 있을 때만 계산하며 인과를 증명하지 않음. 통과일 미확인 법안은 시세 이벤트에서 제외."}
        dump("topic-%s.json" % tp["id"], doc)
        topics_out.append({"id": tp["id"], "label": tp["label"], "tags": tp["tags"], "query": tp["query"] + [w.strip() for w in tp["words"]][:12],
                           "count": sum(P["count"].values()), "by": dict(P["count"])})

    # 자유 검색용 제목 목록
    sizes = {}
    for cc in CCS:
        rows = laws[cc].get("rows", [])
        doc = {"cc": cc, "source": laws[cc].get("source"), "updated": laws[cc].get("updated"),
               "t": [r["t"][:200] for r in rows], "d": [r.get("d") or "" for r in rows], "st": [(r.get("st") or "")[:60] for r in rows],
               "u": [r.get("u") or "" for r in rows], "p": [passed(cc, r) for r in rows],
               "pd": [event_date(cc, r) for r in rows]}
        dump("titles-%s.json" % cc, doc)
        sizes[cc] = len(rows)

    dump("topics.json", {"updated": today.isoformat(), "topics": topics_out, "regions": REGION_LABEL, "region_words": REGION_WORDS,
                         "parliaments": PARLIAMENTS, "laws": {cc: {"count": sizes[cc], "source": laws[cc].get("source"), "updated": laws[cc].get("updated")} for cc in CCS},
                         "markets": [{k: s[k] for k in ("symbol", "name", "region", "currency", "file", "tags", "first", "last", "close", "d1", "m1", "y1")} for s in midx]})
    print("world flow: topics %d, laws %s" % (len(topics_out), sizes))
    for t in topics_out:
        print("  %-14s %6d %s" % (t["id"], t["count"], t["by"]))


if __name__ == "__main__":
    main()
