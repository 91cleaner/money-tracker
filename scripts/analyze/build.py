"""분석 엔진: 저장된 공개 데이터로 종목별 '답 묶음'을 미리 계산해 <out>/<T>.json 으로 쓴다.

사용: python3 scripts/analyze/build.py [출력폴더=data/answers]
- 외부 API·유료 서버 없음. 방문자는 결과 JSON 만 읽는다.
- 문장은 템플릿(KO/EN), 중립 표현만 쓴다("데이터상", "같은 기간 ~이 있었다"). 원인 단정·권유 표현 금지.
"""
import json, os, re, statistics, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (D, PERIODS, SECTOR_BENCH, DEFAULT_BENCH, SECTOR_NAME, jload, load_series,
                    period_return, close_on_or_before, shift, banned_hit)

INTENTS = ["overview", "why", "tariff", "export_control", "subsidy", "china", "taiwan", "supply_chain", "compare"]
# earnings(실적)는 원본 데이터가 아직 없어 만들지 않는다 → missing 으로 명시.
NO_DATA_INTENTS = {"earnings": "실적 발표 원본 데이터 미수집"}
TOPIC_KO = {"tariff": "관세", "export_control": "수출통제", "subsidy": "보조금", "china": "중국", "taiwan": "대만"}
TOPIC_EN = {"tariff": "tariff", "export_control": "export-control", "subsidy": "subsidy", "china": "China", "taiwan": "Taiwan"}
PERIOD_KO = {"1w": "1주", "1m": "1달", "3m": "3달", "1y": "1년"}
PERIOD_EN = {"1w": "1 week", "1m": "1 month", "3m": "3 months", "1y": "1 year"}
SUPPLY_COUNTRIES = {"cn": ("중국", "China"), "tw": ("대만", "Taiwan"), "jp": ("일본", "Japan"),
                    "kr": ("한국", "Korea"), "eu": ("EU", "EU")}
SUBSIDY_RE = re.compile(r"subsid|CHIPS Act|补贴|补助|보조금|지원금", re.I)
REACTION_DAYS = 7
MAX_EVENTS = 5


def load_events():
    ev = []
    wh = jload("us", "whitehouse.json")
    for i in wh["items"]:
        topics = set(i.get("topics", []))
        if SUBSIDY_RE.search(i["t"]):
            topics.add("subsidy")
        if "tariff" in topics or "import_232" in topics:
            topics.add("tariff")
        countries = set(i.get("countries", []))
        if "cn" in countries:
            topics.add("china")
        if "tw" in countries:
            topics.add("taiwan")
        ev.append({"id": i["id"], "d": i["date"], "t": i["t"], "k": i.get("ko"), "u": i["u"], "src": i.get("src", ""),
                   "country": "us", "sectors": set(i.get("sectors", [])), "topics": topics,
                   "tickers": set(i.get("tickers", [])) | set(i.get("tickers_product", []))})
    for cc in SUPPLY_COUNTRIES:
        p = jload("policy", cc + ".json")
        for i in p["items"]:
            sectors = {t for t in i.get("tags", []) if t != "trade"}
            topics = set()
            if SUBSIDY_RE.search(i["t"]):
                topics.add("subsidy")
            if cc == "cn":
                topics.add("china")
            if cc == "tw":
                topics.add("taiwan")
            ev.append({"id": i["id"], "d": i["d"], "t": i["t"], "k": None, "u": i["u"], "src": i.get("src", ""),
                       "country": cc, "sectors": sectors, "topics": topics, "tickers": set()})
    ev = [e for e in ev if e["d"] and not banned_hit(e["t"] + (e["k"] or ""))]
    ev.sort(key=lambda e: e["d"])
    return ev


def compact(e):
    o = {"d": e["d"], "t": e["t"][:160], "u": e["u"], "c": e["country"]}
    if e["k"]:
        o["k"] = e["k"][:120]
    return o


def reaction(series, evs):
    """공개일 종가 → 7일 뒤 종가 변동률의 평균. 표본(n)과 함께. 인과 단정 아님."""
    rs = []
    seen = set()
    for e in evs:
        if e["d"] in seen:
            continue
        seen.add(e["d"])
        a = close_on_or_before(series, e["d"])
        if not a or a[0] < shift(e["d"], -5):
            continue
        end = shift(e["d"], REACTION_DAYS)
        if end > series[0][-1]:
            continue
        b = close_on_or_before(series, end)
        if b and a[1]:
            rs.append((b[1] / a[1] - 1) * 100)
    if not rs:
        return None
    return {"mean": round(sum(rs) / len(rs), 2), "n": len(rs), "low_n": len(rs) < 5, "days": REACTION_DAYS}


def fnum(x):
    s = ("%.2f" % x).rstrip("0").rstrip(".")
    return ("+" if x > 0 else "") + s


def main(out):
    ser = load_series()
    idx = jload("search-index.json")["entities"]
    companies = {}
    for k, v in idx.items():
        if k.startswith("company:") and v.get("symbol") in ser and len(ser[v["symbol"]][0]) > 5:
            companies[v["symbol"]] = v
    events = load_events()
    asof = max(ser[s][0][-1] for s in companies)
    by_sector = defaultdict(list)
    for s, v in companies.items():
        by_sector[v.get("sector")].append(s)

    # 기간별 수익률(전 종목) → 순위·업종 중앙값
    ret = {p: {} for p in PERIODS}
    for s in companies:
        for p, n in PERIODS.items():
            r = period_return(ser[s], n)
            if r:
                ret[p][s] = r
    os.makedirs(out, exist_ok=True)
    topic_react = defaultdict(list)  # topic → [(event, 업종 평균 반응)]
    trends_react_cache = {}

    for sym, v in companies.items():
        sector = v.get("sector")
        sk, se = SECTOR_NAME.get(sector, ("기타", "Other"))
        bench = SECTOR_BENCH.get(sector, DEFAULT_BENCH)
        name = v["name"]
        res = {"symbol": sym, "name": name, "sector": sector,
               "asof": ser[sym][0][-1], "last": ser[sym][1][-1], "bench_id": bench,
               "src": ["https://finance.yahoo.com/quote/" + sym], "periods": {}, "answers": {},
               "missing": dict(NO_DATA_INTENTS)}
        peers = by_sector[sector]

        def related(e):
            return sym.split(".")[0] in e["tickers"] or (sector in e["sectors"])

        rel_all = [e for e in events if related(e) and e["country"] == "us"]
        react_cache = {}

        def react(topic):
            if topic not in react_cache:
                evs = [e for e in rel_all if topic is None or topic in e["topics"]]
                react_cache[topic] = reaction(ser[sym], evs)
            return react_cache[topic]

        for p, n in PERIODS.items():
            r = ret[p].get(sym)
            if not r:
                continue
            br = period_return(ser[bench], n) if bench in ser else None
            peer_rs = [ret[p][x][2] for x in peers if x in ret[p]]
            med = round(statistics.median(peer_rs), 2) if len(peer_rs) >= 3 else None
            ordered = sorted(peer_rs, reverse=True)
            rank = {"pos": ordered.index(r[2]) + 1, "of": len(ordered)} if len(peer_rs) >= 3 else None
            res["periods"][p] = {
                "from": r[0], "to": r[1], "ret": r[2],
                "bench": {"id": bench, "ret": br[2], "diff": round(r[2] - br[2], 2)} if br else None,
                "sector_median": med, "diff_median": round(r[2] - med, 2) if med is not None else None, "rank": rank}

        for intent in INTENTS:
            per = {}
            for p, n in PERIODS.items():
                pr = res["periods"].get(p)
                if not pr:
                    continue
                lo, hi = shift(pr["to"], -n), pr["to"]
                inwin = [e for e in events if lo <= e["d"] <= hi]
                ko, en, srcs, evs, rc = [], [], [], [], None
                pk, pe = PERIOD_KO[p], PERIOD_EN[p]
                lead_k = "데이터상 %s은(는) 최근 %s 동안 종가 기준 %s%% 움직였다." % (name, pk, fnum(pr["ret"]))
                lead_e = "In the data, %s moved %s%% on a closing-price basis over the past %s." % (name, fnum(pr["ret"]), pe)
                if intent in ("overview", "why", "compare"):
                    ko.append(lead_k)
                    en.append(lead_e)
                if intent in ("overview", "compare", "why"):
                    if pr["bench"]:
                        b = pr["bench"]
                        ko.append("같은 기간 %s(%s)는 %s%%여서 차이는 %s%%p였다." % (b["id"], sk, fnum(b["ret"]), fnum(b["diff"])))
                        en.append("Over the same period %s (%s) moved %s%%, a gap of %s pp." % (b["id"], se, fnum(b["ret"]), fnum(b["diff"])))
                    if pr["sector_median"] is not None:
                        ko.append("%s 업종 종목 %d곳의 중앙값은 %s%%였다." % (sk, len([1 for x in peers if x in ret[p]]), fnum(pr["sector_median"])))
                        en.append("The median of %d %s stocks was %s%%." % (len([1 for x in peers if x in ret[p]]), se, fnum(pr["sector_median"])))
                    if pr["rank"]:
                        ko.append("업종 내 %d곳 중 %d위였다." % (pr["rank"]["of"], pr["rank"]["pos"]))
                        en.append("Ranked %d of %d in the sector." % (pr["rank"]["pos"], pr["rank"]["of"]))

                if intent in ("overview", "why"):
                    cand = [e for e in inwin if related(e) and e["country"] == "us"]
                elif intent in TOPIC_KO:
                    cand = [e for e in inwin if intent in e["topics"] and (related(e) or e["country"] != "us" and sector in e["sectors"])]
                elif intent == "supply_chain":
                    cand = [e for e in inwin if e["country"] in SUPPLY_COUNTRIES and sector in e["sectors"]]
                else:
                    cand = []
                cand.sort(key=lambda e: e["d"], reverse=True)  # 기간 끝에서 가까운 순
                if intent == "supply_chain":
                    seen_c, picked = defaultdict(int), []
                    for e in cand:
                        if seen_c[e["country"]] < 2:
                            seen_c[e["country"]] += 1
                            picked.append(e)
                    cand = picked
                evs = cand[:MAX_EVENTS]

                if intent in TOPIC_KO or intent in ("why", "supply_chain"):
                    if evs:
                        t = TOPIC_KO.get(intent, "정책")
                        te = TOPIC_EN.get(intent, "policy")
                        ko.append("같은 기간 %s 관련 공개 기록이 %d건 있었다(가까운 순 최대 %d건 표시)." % (t, len(cand), len(evs)))
                        en.append("In the same period there were %d public records related to %s (up to %d shown, nearest first)." % (len(cand), te, len(evs)))
                        if intent == "supply_chain":
                            cs = sorted({e["country"] for e in evs})
                            ko.append("국가: " + ", ".join(SUPPLY_COUNTRIES.get(c, ("미국", "US"))[0] if c != "us" else "미국" for c in cs) + ".")
                            en.append("Countries: " + ", ".join(SUPPLY_COUNTRIES[c][1] if c != "us" else "US" for c in cs) + ".")
                    else:
                        ko.append("같은 기간 %s 관련 공개 기록은 데이터상 찾지 못했다." % TOPIC_KO.get(intent, "정책"))
                        en.append("No related public records were found in the data for the same period.")
                if intent in TOPIC_KO or intent == "why":
                    rc = react(intent if intent in TOPIC_KO else None)
                    if rc:
                        ko.append("과거 비슷한 발표 %d건 뒤 %d일간 평균 %s%%였다(표본 %d건%s). 원인을 뜻하지 않는다." % (
                            rc["n"], rc["days"], fnum(rc["mean"]), rc["n"], ", 표본 적음" if rc["low_n"] else ""))
                        en.append("After %d similar past announcements the average %d-day move was %s%% (n=%d%s). This does not imply a cause." % (
                            rc["n"], rc["days"], fnum(rc["mean"]), rc["n"], ", small sample" if rc["low_n"] else ""))
                if intent == "compare" and not pr["bench"] and pr["sector_median"] is None:
                    continue
                if not ko:
                    continue
                srcs = [e["u"] for e in evs] + res["src"]
                per[p] = {"ko": ko, "en": en, "events": [compact(e) for e in evs], "reaction": rc, "src": srcs}
            if per:
                res["answers"][intent] = per
        with open(os.path.join(out, sym + ".json"), "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, separators=(",", ":"))

    # ---- 누적 분석 _trends.json ----
    movers = sorted(((s, ret["1w"][s]) for s in ret["1w"]), key=lambda x: -abs(x[1][2]))[:10]
    wk = shift(asof, -7)
    # 주제별 반응: 사건 1건당 업종 종목 평균 반응 → 주제 평균
    topic_stats = defaultdict(list)
    for e in events:
        if e["country"] != "us" or not e["sectors"] or e["d"] > shift(asof, -REACTION_DAYS):
            continue
        for tp in e["topics"]:
            if tp not in TOPIC_KO:
                continue
            rs = []
            for sec in e["sectors"]:
                for s in by_sector.get(sec, []):
                    r = reaction(ser[s], [e])
                    if r:
                        rs.append(r["mean"])
            if rs:
                topic_stats[tp].append(sum(rs) / len(rs))
    react_rank = sorted(({"topic": tp, "ko": TOPIC_KO[tp], "en": TOPIC_EN[tp], "mean_abs": round(sum(abs(x) for x in v) / len(v), 2),
                          "mean": round(sum(v) / len(v), 2), "n": len(v), "days": REACTION_DAYS} for tp, v in topic_stats.items()),
                        key=lambda x: -x["mean_abs"])
    new_links = [{"d": e["d"], "t": e["t"][:140], "u": e["u"], "tickers": sorted(e["tickers"])}
                 for e in events if e["d"] >= wk and e["tickers"]][:20]
    trends = {
        "asof": asof, "note_ko": "데이터상 계산값. 인과·투자 조언 아님.", "note_en": "Computed from stored data. No causal claim; not advice.",
        "top_movers_1w": [{"symbol": s, "name": companies[s]["name"], "sector": companies[s].get("sector"), "from": r[0], "to": r[1], "ret": r[2]} for s, r in movers],
        "reaction_by_topic": react_rank,
        "new_links": new_links,
        "counts": {"tickers": len(companies), "events": len(events)},
    }
    with open(os.path.join(out, "_trends.json"), "w", encoding="utf-8") as f:
        json.dump(trends, f, ensure_ascii=False, separators=(",", ":"))
    print("answers:", len(companies), "asof", asof)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, "answers"))
