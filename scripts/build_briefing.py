#!/usr/bin/env python3
"""Build "Today's Briefing" cards from data already collected in this repo.

Reads (read-only, no network, no keys):
  data/us/trades-recent.json   House PTR trades (trade -> filing days)
  data/us/trades.json          House PTRs (late filings + same-period price move, % only)
  data/fr/presidential.json    presidential actions + same-period price moves
  data/us/insider-form4.json   SEC Form 4 open-market sales
  data/us/sec-filings.json     8-K filings
  data/us/prices/<date>.json   daily closes (biggest movers)
  data/us-fiscal.json          Treasury debt

Writes:
  data/briefing/today.json
  data/briefing/YYYY-MM-DD.json   (dated archive, same content)

today.json = {date, generated_at, top: [3-5 cards], cards: {late, president, insider, debt}}.
A card is omitted when its data is missing. Wording records what happened in the
same period only; it never states a reason and never gives investment advice.

Scoring (free, deterministic): score = base(0-100) * freshness.
  base:      mover  = max |move %| * 10          late    = max days * 1.6
             action = 55 (+20 with same-period moves, +10 EO/proclamation)
             form4  = log10(total $ sold) * 14   filing  = 40 + 4 * notable 8-Ks
  freshness: 1.0 within 2 days of today, minus 0.15 per extra day, floor 0.2.
"""
import json
import math
import os
import sys
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "briefing")
SITE = "https://91cleaner.github.io/money-tracker/cards.html"


def load(rel):
    try:
        with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def d(s):
    return date.fromisoformat(str(s)[:10])


def fresh(latest, today):
    age = (today - d(latest)).days
    return max(0.2, 1 - 0.15 * max(0, age - 2))


def money(v):
    if v >= 1e9:
        return "$%.1fB" % (v / 1e9)
    if v >= 1e6:
        return "$%.1fM" % (v / 1e6)
    return "$%dK" % round(v / 1e3)


def share(ko, en):
    return {"share_ko": ko + " · 머니트래커", "share_en": en + " · Money Tracker"}


def card(id_, kind, icon, score, **kw):
    c = {"id": id_, "kind": kind, "icon": icon, "score": round(score, 1)}
    c.update(kw)
    return c


# ---------------------------------------------------------------- late board
def build_late(today):
    j = load("data/us/trades-recent.json")
    if not j:
        return None
    rows = []
    for t in j.get("trades", []):
        try:
            days = (d(t["fd"]) - d(t["d"])).days
        except (KeyError, ValueError):
            continue
        if days >= 0 and t.get("tk") and t.get("who"):
            rows.append((days, t))
    rows.sort(key=lambda x: -x[0])
    rows = rows[:3]
    if len(rows) < 3:
        return None
    latest = max(t["fd"] for _, t in rows)
    medals = ["🥇", "🥈", "🥉"]
    out = []
    for i, (days, t) in enumerate(rows):
        out.append({
            "mark": medals[i], "label": "Rep. %s (%s)" % (t["who"], t["tk"]),
            "value_ko": "%d일" % days, "value_en": "%d days" % days,
            "tone": "red" if days > 45 else "amber" if days >= 30 else "yellow",
            "url": t.get("doc"),
        })
    top = rows[0][0]
    return card(
        "late", "late", "🕰️", min(100, top * 1.6) * fresh(latest, today),
        layout="list", date=latest, badge_ko="늦은 신고 클럽", badge_en="LATE CLUB",
        title_ko="신고 기한은 45일. 그런데 👀", title_en="Rule: report within 45 days. Also: 👀",
        sub_ko="하원 최근 신고 중 거래일→신고일이 긴 순서", sub_en="Latest House filings, ranked by days from trade to filing",
        rows=out,
        note_ko="기록일 뿐 잘못의 증거가 아니에요. 투자 조언 아님.", note_en="A record, not proof of wrongdoing. Not investment advice.",
        source_ko="출처: 미 하원 사무처 PTR (거래일→신고일)", source_en="Source: House Clerk PTRs (trade → filing)",
        source_url="https://disclosures-clerk.house.gov/FinancialDisclosure",
        **share('하원 신고 늦은 순위 1위: %s %d일' % (rows[0][1]["who"], top),
                "House late-filing board #1: %s, %d days" % (rows[0][1]["who"], top)))


# ------------------------------------------------- late filing + price move
def px_on(pr, day):
    """Close on `day` or the nearest prior trading day -> (date, close) or None."""
    best = None
    for dt, c in zip(pr.get("d") or [], pr.get("c") or []):
        if dt <= day and c and c > 0:
            best = (dt, c)
    return best


def build_latemove(today):
    """Late filings (> 45 days) paired with a big same-period move. % only, never dollars."""
    j = load("data/us/trades.json")
    if not j:
        return None
    found, cache = [], {}
    for t in j.get("trades", []):
        tk, who, td, fl = t.get("tk"), t.get("who"), t.get("d"), t.get("filed")
        if not (tk and who and td and fl) or t.get("ty", "")[:1] not in ("P", "S"):
            continue
        try:
            lag = (d(fl) - d(td)).days
        except ValueError:
            continue
        if lag <= 45 or (today - d(fl)).days > 14:
            continue
        if tk not in cache:
            cache[tk] = load("data/us/prices/%s.json" % tk)
        pr = cache[tk]
        a = px_on(pr, td) if pr else None
        last = (pr["d"][-1], pr["c"][-1]) if pr and pr.get("d") else None
        if not a or not last or last[0] <= a[0]:
            continue
        pct = (last[1] / a[1] - 1) * 100
        if abs(pct) >= 10 and abs(pct) <= 60:  # skip likely splits / bad ticks
            found.append((abs(pct) * lag, lag, pct, t, a, last))
    if not found:
        return None
    found.sort(key=lambda x: -x[0])
    found = found[:3]
    latest = max(x[3]["filed"] for x in found)
    rows = []
    for _, lag, pct, t, a, last in found:
        verb = "산" if t["ty"][0] == "P" else "판"
        rows.append({
            "mark": "🕰️", "label": "%s %s" % (t["who"].split()[-1], t["tk"]),
            "value_ko": "%d일 · %s 뒤 %+.1f%%" % (lag, verb, pct),
            "value_en": "%dd · %+.1f%% since %s" % (lag, pct, "buy" if verb == "산" else "sale"),
            "tone": "red" if pct < 0 else "green", "url": t.get("doc"),
        })
    w = found[0]
    return card(
        "latemove", "latemove", "🕰️", min(100, 40 + abs(w[2]) + w[1] / 4) * fresh(latest, today),
        layout="list", date=latest, badge_ko="늦은 신고 + 큰 변동", badge_en="LATE + BIG MOVE",
        title_ko="45일 넘게 걸린 신고, 그 사이 주가는?", title_en="Filed after 45 days: what did the price do meanwhile?",
        sub_ko="하원 신고 중 45일 초과 · 거래일 종가 대비 최근 종가 변동(수정종가)",
        sub_en="House filings past 45 days · latest close vs trade-date close (adjusted)",
        rows=rows,
        note_ko="같은 기간 비교일 뿐 이유를 말하지 않아요. 금액은 구간이라 손익은 계산하지 않아요. 투자 조언 아님.",
        note_en="Same-period comparison only, not a reason. Amounts are ranges, so no profit is computed. Not investment advice.",
        source_ko="출처: 하원 PTR · 일별 수정종가 기준", source_en="Source: House PTRs · daily adjusted closes",
        source_url="https://disclosures-clerk.house.gov/FinancialDisclosure",
        **share("45일 넘겨 신고된 거래 중 %s %s: 거래일 대비 %+.1f%%" % (w[3]["who"], w[3]["tk"], w[2]),
                "Filed past 45 days: %s %s, %+.1f%% since the trade date" % (w[3]["who"], w[3]["tk"], w[2])))


# ----------------------------------------------------------- presidential
def build_president(today, n_now=2):
    j = load("data/fr/presidential.json")
    if not j or not j.get("items"):
        return []
    items = sorted(j["items"], key=lambda i: i.get("date", ""), reverse=True)
    out = []
    for now in items:
        if len(out) >= n_now:
            break
        if (today - d(now["date"])).days > 14:
            break
        keys = set(now.get("topics") or []) | set(now.get("sectors") or [])
        then = None
        if keys:
            for p in items:
                if p["id"] == now["id"] or p.get("date", "") >= now["date"] or not p.get("moves"):
                    continue
                if keys & (set(p.get("topics") or []) | set(p.get("sectors") or [])):
                    then = p
                    break
        if not then:
            continue
        base = 55 + (20 if now.get("moves") else 0) + (10 if now.get("eo") or now.get("procl") else 0)
        mv = ", ".join("%s %+.1f%%" % (m["sym"], m["pct"]) for m in then["moves"][:3])
        mv_ko = then.get("same_period_ko") or ""
        out.append(card(
            "president-" + now["id"].split(":")[-1][:40], "president", now.get("icon") or "🏛️",
            base * fresh(now["date"], today),
            layout="versus", date=now["date"],
            badge_ko="대통령 조치", badge_en="PRESIDENTIAL ACTION",
            title_ko="지난번 비슷한 조치 때 같은 기간엔?", title_en="Last similar action: what happened in the same period?",
            now={"tag_ko": "지금 🏛️", "tag_en": "NOW 🏛️", "title": now["title"], "date": now["date"],
                 "type_en": now.get("type_en"), "type_ko": now.get("type"), "url": now.get("url")},
            then={"tag_ko": "지난번 📅", "tag_en": "LAST TIME 📅", "title": then["title"], "date": then["date"],
                  "moves": [{"sym": m["sym"], "pct": m["pct"]} for m in then["moves"][:3]],
                  "period": "%s → %s" % (then["moves"][0]["from"], then["moves"][0]["to"]),
                  "url": then.get("url")},
            stamp_ko="같은 기간 ≠ 원인", stamp_en="Same period ≠ cause",
            note_ko="같은 기간 일어난 움직임일 뿐 이유를 말하는 게 아니에요. 투자 조언 아님.",
            note_en="Moves shown only as what happened in the same period, not a reason. Not investment advice.",
            source_ko="출처: 연방관보 · 백악관 · 종가 (%s)" % then["moves"][0]["to"],
            source_en="Source: Federal Register · White House · closes (%s)" % then["moves"][0]["to"],
            source_url=now.get("url") or j.get("source_url"),
            **share("같은 기간 %s 움직임이 있었어요 (원인 아님)" % mv, "Same period: %s (not a cause)" % mv)))
    return out


# --------------------------------------------------------------- form 4
def build_insider(today):
    j = load("data/us/insider-form4.json")
    if not j or not j.get("companies"):
        return None
    sales = []
    for tk, co in j["companies"].items():
        for t in co.get("trades", []):
            if t.get("code") == "S" and t.get("shares") and t.get("price") and t.get("filed"):
                sales.append((tk, t))
    if not sales:
        return None
    latest = max(t["filed"] for _, t in sales)
    start = d(latest) - timedelta(days=6)
    agg = {}
    for tk, t in sales:
        if d(t["filed"]) < start:
            continue
        a = agg.setdefault((tk, t["who"]), {"v": 0.0, "role": t.get("role") or "", "plan": False, "url": t.get("url")})
        a["v"] += t["shares"] * t["price"]
        a["plan"] = a["plan"] or bool(t.get("plan"))
    ranked = sorted(agg.items(), key=lambda kv: -kv[1]["v"])[:5]
    if len(ranked) < 3:
        return None
    rows = []
    for i, ((tk, who), a) in enumerate(ranked):
        role = a["role"].split(",")[0].strip()[:28] or "insider"
        rows.append({"label": "%s · %s" % (tk, role),
                     "value_ko": "~" + money(a["v"]), "value_en": "~" + money(a["v"]),
                     "tone": "red" if i == 0 else "white", "url": a["url"]})
    any_plan = any(a["plan"] for _, a in ranked)
    total = sum(a["v"] for _, a in ranked)
    return card(
        "insider", "insider", "👀", min(100, math.log10(max(ranked[0][1]["v"], 10)) * 14) * fresh(latest, today),
        layout="list", date=latest, badge_ko="내부자 워치", badge_en="INSIDER WATCH",
        title_ko="이번 주 임원 주식 매도 TOP5 💸", title_en="This week's top insider sales 💸",
        sub_ko="SEC Form 4 공개시장 매도 (%s 이전 7일 신고 기준)" % latest,
        sub_en="SEC Form 4 open-market sales (filed in the 7 days to %s)" % latest,
        rows=rows,
        note_ko="*일부는 미리 정해 둔 매도 계획이에요. 이유는 알 수 없어요. 투자 조언 아님." if any_plan else "이유는 알 수 없어요. 투자 조언 아님.",
        note_en="*Some are pre-scheduled plans. Reasons are unknown. Not investment advice." if any_plan else "Reasons are unknown. Not investment advice.",
        source_ko="출처: SEC Form 4 (EDGAR)", source_en="Source: SEC Form 4 (EDGAR)",
        source_url=j.get("source_url") or "https://www.sec.gov/edgar/search/",
        **share("이번 주 임원 매도 TOP5 합계 약 %s" % money(total), "This week's top 5 insider sales add up to about %s" % money(total)))


# ------------------------------------------------------------------ debt
def build_debt(today):
    j = load("data/us-fiscal.json")
    try:
        debt = j["debt"]
        latest, ago, pts = debt["latest"], debt["year_ago"], debt["points"]
        v = float(latest["value"])
        yv = float(ago["value"])
    except (TypeError, KeyError, ValueError):
        return None
    per_sec = None
    ref = None
    for p in pts:
        if (d(latest["date"]) - d(p["date"])).days <= 30:
            ref = p
            break
    if ref and ref["date"] != latest["date"]:
        secs = (d(latest["date"]) - d(ref["date"])).days * 86400
        per_sec = (v - float(ref["value"])) / secs
    tn = "$%.2f trillion" % (v / 1e12)
    rows = [{"label_ko": "1년 전 같은 날", "label_en": "Same day last year",
             "value_ko": "$%.2f조" % (yv / 1e12), "value_en": "$%.2f T" % (yv / 1e12), "tone": "white"},
            {"label_ko": "1년 사이 늘어난 금액", "label_en": "Change in one year",
             "value_ko": "+$%.2f조" % ((v - yv) / 1e12), "value_en": "+$%.2f T" % ((v - yv) / 1e12), "tone": "red"}]
    if per_sec and per_sec > 0:
        rows.append({"label_ko": "최근 30일 평균 (1초당)", "label_en": "30-day average per second",
                     "value_ko": "+$%s" % format(round(per_sec), ","), "value_en": "+$%s" % format(round(per_sec), ","), "tone": "amber"})
    return card(
        "debt", "debt", "🧾", 30 * fresh(latest["date"], today),
        layout="big", date=latest["date"], badge_ko="국가 채무", badge_en="NATIONAL DEBT",
        title_ko="미국 정부 총 채무", title_en="U.S. total public debt outstanding",
        big={"value": "$" + format(round(v), ","), "short_ko": "$%.2f조" % (v / 1e12), "short_en": tn},
        sub_ko="%s 기준" % latest["date"], sub_en="As of %s" % latest["date"], rows=rows,
        note_ko="공식 집계 숫자예요. 앞으로의 값을 예측하지 않아요.", note_en="Official reported figure. No forecast.",
        source_ko="출처: 미 재무부 FiscalData", source_en="Source: U.S. Treasury FiscalData",
        source_url=j.get("source_url") or "https://fiscaldata.treasury.gov/",
        **share("미국 정부 총 채무 %s (%s 기준)" % ("$%.2f조" % (v / 1e12), latest["date"]),
                "U.S. total public debt: %s (as of %s)" % (tn, latest["date"])))


# --------------------------------------------------------------- movers
def build_movers(today):
    names = sorted(x for x in os.listdir(os.path.join(ROOT, "data/us/prices")) if x[:2] == "20")
    if len(names) < 2:
        return None
    a, b = load("data/us/prices/" + names[-2]), load("data/us/prices/" + names[-1])
    if not a or not b:
        return None
    mv = []
    for sym, c1 in (b.get("c") or {}).items():
        c0 = (a.get("c") or {}).get(sym)
        if c0 and c1 and c0 > 0:
            pct = (c1 / c0 - 1) * 100
            if abs(pct) <= 50:  # skip likely splits / bad ticks
                mv.append((sym, pct))
    mv.sort(key=lambda x: -abs(x[1]))
    mv = mv[:5]
    if len(mv) < 3:
        return None
    rows = [{"label": s, "value_ko": "%+.1f%%" % p, "value_en": "%+.1f%%" % p,
             "tone": "green" if p > 0 else "red", "mark": "📈" if p > 0 else "📉"} for s, p in mv]
    return card(
        "movers", "movers", "🚨", min(100, abs(mv[0][1]) * 10) * fresh(b["date"], today),
        layout="list", date=b["date"], badge_ko="큰 움직임", badge_en="BIG MOVERS",
        title_ko="어제 가장 크게 움직인 종목", title_en="Biggest movers at the last close",
        sub_ko="%s → %s 종가 기준 (우리가 추적하는 종목 중)" % (a["date"], b["date"]),
        sub_en="Close-to-close %s → %s (among tickers we track)" % (a["date"], b["date"]),
        rows=rows,
        note_ko="무슨 일이 있었는지만 보여줘요. 이유는 말하지 않아요. 투자 조언 아님.",
        note_en="Shows what moved, not why. Not investment advice.",
        source_ko="출처: 일별 종가 기록", source_en="Source: daily closing prices",
        source_url="https://91cleaner.github.io/money-tracker/us.html",
        **share("%s 종가 기준 가장 크게 움직인 종목: %s %+.1f%%" % (b["date"], mv[0][0], mv[0][1]),
                "Biggest mover at the %s close: %s %+.1f%%" % (b["date"], mv[0][0], mv[0][1])))


# -------------------------------------------------------------- filings
W8K = {
    "1.03": (10, "파산 관련 신고", "bankruptcy-related filing"),
    "1.05": (9, "사이버 사고 신고", "cybersecurity incident report"),
    "4.02": (8, "재무제표 재작성 알림", "financials non-reliance notice"),
    "3.01": (6, "상장 관련 통지", "listing notice"),
    "5.02": (6, "임원·이사 변경", "officer / director change"),
    "1.01": (5, "주요 계약 체결", "material agreement"),
    "2.01": (5, "인수·처분 완료", "acquisition / disposal completed"),
    "2.05": (5, "구조조정 비용", "exit / restructuring costs"),
}


def build_filings(today):
    j = load("data/us/sec-filings.json")
    if not j or not j.get("companies"):
        return None
    found = []
    latest = ""
    for tk, co in j["companies"].items():
        for f in co.get("k8", []):
            if f.get("filed", "") > latest and d(f["filed"]) <= today:
                latest = f["filed"]
    if not latest:
        return None
    for tk, co in j["companies"].items():
        for f in co.get("k8", []):
            if f.get("filed") != latest:
                continue
            best = max((W8K[i] for i in f.get("items", []) if i in W8K), default=None)
            if best:
                found.append((best, tk, f))
    if len(found) < 3:
        return None
    found.sort(key=lambda x: (-x[0][0], x[1]))
    rows = [{"label": tk, "value_ko": w[1], "value_en": w[2], "tone": "white", "url": f.get("url")}
            for w, tk, f in found[:5]]
    return card(
        "filings", "filings", "📂", (40 + 4 * min(10, len(found))) * fresh(latest, today),
        layout="list", date=latest, badge_ko="새 공시", badge_en="NEW FILINGS",
        title_ko="%s 접수된 8-K 공시 %d건" % (latest, len(found)), title_en="%d notable 8-Ks filed on %s" % (len(found), latest),
        sub_ko="항목 번호로 분류한 일부 (우리가 추적하는 기업)", sub_en="A sample sorted by item number (companies we track)",
        rows=rows,
        note_ko="제출 목록 그대로예요. 해석은 없어요. 투자 조언 아님.", note_en="Filing list as submitted. No interpretation. Not investment advice.",
        source_ko="출처: SEC EDGAR 8-K", source_en="Source: SEC EDGAR 8-K",
        source_url="https://www.sec.gov/edgar/search/",
        **share("%s 새 8-K 공시 %d건" % (latest, len(found)), "%d notable 8-K filings on %s" % (len(found), latest)))


def safe(fn, *a):
    try:
        return fn(*a)
    except Exception as e:  # a broken source must hide its card, not the build
        print("skip %s: %s" % (fn.__name__, e), file=sys.stderr)
        return None


def main():
    today = d(sys.argv[1]) if len(sys.argv) > 1 else datetime.now(timezone.utc).date()
    late, insider, debt = safe(build_late, today), safe(build_insider, today), safe(build_debt, today)
    pres = safe(build_president, today) or []
    cands = [c for c in [late, insider, safe(build_latemove, today), safe(build_movers, today), safe(build_filings, today)] + pres if c]
    cands.sort(key=lambda c: -c["score"])
    top = [c for c in cands if c["score"] >= 15][:5]
    cards = {k: v for k, v in (("late", late), ("latemove", next((c for c in cands if c["id"] == "latemove"), None)), ("president", pres[0] if pres else None), ("insider", insider), ("debt", debt)) if v}
    res = {"date": today.isoformat(), "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
           "site": SITE, "scoring": "score = base(0-100) * freshness; see scripts/build_briefing.py",
           "top": top, "cards": cards}
    os.makedirs(OUT, exist_ok=True)
    body = json.dumps(res, ensure_ascii=False, indent=1) + "\n"
    for name in ("today.json", today.isoformat() + ".json"):
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            f.write(body)
    print("briefing %s: top=%s cards=%s" % (today, [c["id"] for c in top], list(cards)))


if __name__ == "__main__":
    main()
