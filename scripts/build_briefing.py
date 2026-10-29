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
import re
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


_KO, _EN = {}, None


def tidy(nm):
    nm = re.sub(r"\s*/[A-Z]{2}/?$", "", nm).strip()
    return nm.title().replace("'S", "'s") if nm.isupper() else nm


def co_ko(tk):
    """Korean company name (data/answers/<TK>.json), falling back to the English name."""
    if tk not in _KO:
        j = load("data/answers/%s.json" % tk.replace("/", "_"))
        nm = j.get("name") if isinstance(j, dict) else None
        _KO[tk] = nm if nm and re.search("[가-힣]", nm) else co_en(tk) if not nm or nm == tk else tidy(nm)
    return _KO[tk]


def co_en(tk):
    """English company name from SEC filings data, title-cased; ticker only as a last resort."""
    global _EN
    if _EN is None:
        cs = (load("data/us/sec-filings.json") or {}).get("companies", {})
        _EN = {k: v.get("name") for k, v in cs.items() if v.get("name")}
    nm = _EN.get(tk)
    if not nm:
        return tk
    return tidy(nm)


def role_ko(r):
    r = (r or "").split(",")[0]
    for key, ko in (("Chief Executive", "최고경영자(CEO)"), ("CEO", "최고경영자(CEO)"), ("Chief Financial", "재무 책임자(CFO)"),
                    ("CFO", "재무 책임자(CFO)"), ("10%", "큰 주주"), ("Chair", "이사회 의장"), ("Director", "이사"),
                    ("President", "사장"), ("VP", "부사장급"), ("Vice", "부사장급"), ("Chief", "임원"), ("Officer", "임원")):
        if key.lower() in r.lower():
            return ko
    return "회사 내부자"


def role_en(r):
    r = (r or "").split(",")[0].strip()[:28]
    return r or "insider"


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
            "mark": medals[i],
            "label_ko": "%s 의원 · %s" % (t["who"], co_ko(t["tk"])), "label_en": "Rep. %s · %s" % (t["who"], co_en(t["tk"])),
            "value_ko": "%d일 걸림" % days, "value_en": "%d days" % days,
            "tone": "red" if days > 45 else "amber" if days >= 30 else "yellow",
            "url": t.get("doc"),
        })
    top = rows[0][0]
    return card(
        "late", "late", "🕰️", min(100, top * 1.6) * fresh(latest, today),
        layout="list", date=latest, badge_ko="늦은 신고 클럽", badge_en="LATE CLUB",
        title_ko="미국 국회의원 주식 숙제 늦게 낸 사람들", title_en="US lawmakers who handed in their stock homework late",
        sub_ko="주식 숙제 제출 기한 (45일) · 우리는 월세 하루만 늦어도 연락 오는데 💀",
        sub_en="Stock-homework deadline (45 days) · We get a call if rent is 1 day late 💀",
        rows=out,
        note_ko="기록일 뿐 잘못의 증거가 아니에요. 투자 조언 아님.", note_en="A record, not proof of wrongdoing. Not investment advice.",
        source_ko="출처: 미 하원 사무처 주식 거래 신고서 (PTR) · 거래일→제출일", source_en="Source: House Clerk stock-trade reports (PTR) · trade → filing",
        source_url="https://disclosures-clerk.house.gov/FinancialDisclosure",
        **share('미국 국회의원 주식 숙제 늦게 낸 1위: %s 의원 %d일 / 우리는 월세 하루만 늦어도 연락 오는데 💀' % (rows[0][1]["who"], top),
                "US lawmaker stock homework, latest hand-in #1: Rep. %s, %d days / we get a call if rent is 1 day late 💀" % (rows[0][1]["who"], top)))


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
PLAIN = {
    "import_232": ("나라 안보를 이유로 수입품에 세금 매기는 법 (Sec. 232)에 따른 조치",
                   "An action under the law for taxing imports for national security reasons (Sec. 232)"),
    "tariff": ("수입품에 매기는 세금(관세)을 바꾸는 조치", "An action changing the tax on imported goods (tariffs)"),
    "sanctions": ("특정 나라·단체와의 거래를 막는 조치 (제재)", "An action blocking dealings with certain countries or groups (sanctions)"),
    "export_control": ("특정 물건을 해외에 못 팔게 하는 조치 (수출 통제)", "An action limiting which goods can be sold abroad (export controls)"),
}


def plain(it):
    for t in it.get("topics") or []:
        if t in PLAIN:
            return PLAIN[t]
    return ("대통령이 서명한 공식 문서", "An official document signed by the President")


def move_row(m):
    return {"name_ko": co_ko(m["sym"]), "name_en": co_en(m["sym"]), "pct": m["pct"]}


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
        mv_ko = ", ".join("%s %+.1f%%" % (co_ko(m["sym"]), m["pct"]) for m in then["moves"][:2])
        mv_en = ", ".join("%s %+.1f%%" % (co_en(m["sym"]), m["pct"]) for m in then["moves"][:2])
        out.append(card(
            "president-" + now["id"].split(":")[-1][:40], "president", now.get("icon") or "🏛️",
            base * fresh(now["date"], today),
            layout="versus", date=now["date"],
            badge_ko="대통령 조치", badge_en="PRESIDENTIAL ACTION",
            title_ko="지난번 비슷한 조치 때 같은 기간엔?", title_en="Last similar move: what happened in the same period?",
            now={"tag_ko": "지금 🏛️", "tag_en": "NOW 🏛️", "title": now["title"], "date": now["date"],
                 "plain_ko": plain(now)[0], "plain_en": plain(now)[1],
                 "type_en": now.get("type_en"), "type_ko": now.get("type"), "url": now.get("url")},
            then={"tag_ko": "지난번 📅", "tag_en": "LAST TIME 📅", "title": then["title"], "date": then["date"],
                  "plain_ko": plain(then)[0], "plain_en": plain(then)[1],
                  "moves": [move_row(m) for m in then["moves"][:3]],
                  "period": "%s → %s" % (then["moves"][0]["from"], then["moves"][0]["to"]),
                  "url": then.get("url")},
            stamp_ko="같은 기간 ≠ 원인", stamp_en="Same period ≠ cause",
            note_ko="같은 기간 일어난 움직임일 뿐 이유를 말하는 게 아니에요. 투자 조언 아님.",
            note_en="Moves shown only as what happened in the same period, not a reason. Not investment advice.",
            source_ko="출처: 미국 관보 · 백악관 · 종가 기록 (%s)" % then["moves"][0]["to"],
            source_en="Source: Federal Register · White House · closing prices (%s)" % then["moves"][0]["to"],
            source_url=now.get("url") or j.get("source_url"),
            **share("지난번 비슷한 조치 때 같은 기간엔 %s 움직임이 있었어요 (원인 아님)" % mv_ko,
                "Last similar move, same period: %s (not a cause)" % mv_en)))
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
        rows.append({"label_ko": "%s · %s" % (co_ko(tk), role_ko(a["role"])), "label_en": "%s · %s" % (co_en(tk), role_en(a["role"])),
                     "value_ko": "~" + money(a["v"]), "value_en": "~" + money(a["v"]),
                     "tone": "red" if i == 0 else "white", "url": a["url"]})
    any_plan = any(a["plan"] for _, a in ranked)
    total = sum(a["v"] for _, a in ranked)
    return card(
        "insider", "insider", "👀", min(100, math.log10(max(ranked[0][1]["v"], 10)) * 14) * fresh(latest, today),
        layout="list", date=latest, badge_ko="내부자 워치", badge_en="INSIDER WATCH",
        title_ko="회사 높은 사람들이 이번 주 판 자기 회사 주식 TOP5 💸", title_en="Company bigwigs' own-stock sales this week: top 5 💸",
        sub_ko="회사 높은 사람이 자기 회사 주식 판 기록 (Form 4) · %s까지 7일" % latest,
        sub_en="Record of company insiders selling their own stock (Form 4) · 7 days to %s" % latest,
        rows=rows,
        note_ko="일부는 미리 예약해둔 판매 (10b5-1)예요. 판 이유는 알 수 없어요. 투자 조언 아님." if any_plan else "이유는 알 수 없어요. 투자 조언 아님.",
        note_en="Some are pre-scheduled sales (10b5-1). The reason for a sale is unknown. Not investment advice." if any_plan else "Reasons are unknown. Not investment advice.",
        source_ko="출처: 미 증권위원회(SEC) 임원 거래 기록 (Form 4)", source_en="Source: SEC insider-trade records (Form 4)",
        source_url=j.get("source_url") or "https://www.sec.gov/edgar/search/",
        **share("회사 높은 사람 5명이 이번 주 자기 회사 주식을 약 %s어치 팔았다는 기록" % money(total),
                "5 company insiders' own-stock sales this week add up to about %s on record" % money(total)))


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
    rows = [{"label_ko": "1년 전 같은 날엔", "label_en": "Same day last year",
             "value_ko": "$%.2f조" % (yv / 1e12), "value_en": "$%.2f T" % (yv / 1e12), "tone": "white"},
            {"label_ko": "1년 사이 불어난 빚", "label_en": "Debt added in one year",
             "value_ko": "+$%.2f조" % ((v - yv) / 1e12), "value_en": "+$%.2f T" % ((v - yv) / 1e12), "tone": "red"}]
    if per_sec and per_sec > 0:
        rows.append({"label_ko": "1초마다 늘어난 빚 (최근 30일 평균)", "label_en": "Added every second (30-day avg)",
                     "value_ko": "+$%s" % format(round(per_sec), ","), "value_en": "+$%s" % format(round(per_sec), ","), "tone": "amber"})
    return card(
        "debt", "debt", "🧾", 30 * fresh(latest["date"], today),
        layout="big", date=latest["date"], badge_ko="국가 채무", badge_en="NATIONAL DEBT",
        title_ko="미국 정부가 지금까지 진 빚 (총 채무)", title_en="How much the US government owes (total public debt)",
        big={"value": "$" + format(round(v), ","), "short_ko": "$%.2f조" % (v / 1e12), "short_en": tn},
        sub_ko="%s 기준" % latest["date"], sub_en="As of %s" % latest["date"], rows=rows,
        note_ko="공식 집계 숫자예요. 앞으로 얼마가 될지는 말하지 않아요. 투자 조언 아님.", note_en="Official reported figure. No forecast. Not investment advice.",
        source_ko="출처: 미 재무부 재정 데이터 (FiscalData)", source_en="Source: U.S. Treasury FiscalData",
        source_url=j.get("source_url") or "https://fiscaldata.treasury.gov/",
        **share("미국 정부가 지금까지 진 빚 %s (%s 기준)" % ("$%.2f조" % (v / 1e12), latest["date"]),
                "How much the US government owes: %s (as of %s)" % (tn, latest["date"])))


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
    rows = [{"label_ko": co_ko(s), "label_en": co_en(s), "value_ko": "%+.1f%%" % p, "value_en": "%+.1f%%" % p,
             "tone": "green" if p > 0 else "red", "mark": "📈" if p > 0 else "📉"} for s, p in mv]
    return card(
        "movers", "movers", "🚨", min(100, abs(mv[0][1]) * 10) * fresh(b["date"], today),
        layout="list", date=b["date"], badge_ko="큰 움직임", badge_en="BIG MOVERS",
        title_ko="어제 가장 크게 움직인 회사들", title_en="Companies that moved most at the last close",
        sub_ko="%s → %s 마감 가격 비교 (우리가 지켜보는 회사 중)" % (a["date"], b["date"]),
        sub_en="Closing price %s → %s (among companies we track)" % (a["date"], b["date"]),
        rows=rows,
        note_ko="무슨 일이 있었는지만 보여줘요. 이유는 말하지 않아요. 투자 조언 아님.",
        note_en="Shows what moved, not why. Not investment advice.",
        source_ko="출처: 일별 마감 가격 기록", source_en="Source: daily closing prices",
        source_url="https://91cleaner.github.io/money-tracker/us.html",
        **share("%s 마감 기준 가장 크게 움직인 회사: %s %+.1f%%" % (b["date"], co_ko(mv[0][0]), mv[0][1]),
                "Biggest mover at the %s close: %s %+.1f%%" % (b["date"], co_en(mv[0][0]), mv[0][1])))


# -------------------------------------------------------------- filings
W8K = {
    "1.03": (10, "파산 절차 관련 신고", "bankruptcy-related filing"),
    "1.05": (9, "사이버 사고 신고", "cybersecurity incident report"),
    "4.02": (8, "장부를 다시 쓴다는 알림", "financials non-reliance notice"),
    "3.01": (6, "증시 상장 유지 관련 통지", "listing notice"),
    "5.02": (6, "임원·이사가 바뀜", "officer / director change"),
    "1.01": (5, "큰 계약을 맺음", "material agreement"),
    "2.01": (5, "회사·사업을 사거나 판 일 마무리", "acquisition / disposal completed"),
    "2.05": (5, "구조조정에 드는 돈", "exit / restructuring costs"),
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
    rows = [{"label_ko": co_ko(tk), "label_en": co_en(tk), "value_ko": w[1], "value_en": w[2], "tone": "white", "url": f.get("url")}
            for w, tk, f in found[:5]]
    return card(
        "filings", "filings", "📂", (40 + 4 * min(10, len(found))) * fresh(latest, today),
        layout="list", date=latest, badge_ko="새 공시", badge_en="NEW FILINGS",
        title_ko="%s 회사들이 낸 '큰 소식' 신고서 %d건" % (latest, len(found)), title_en="%d 'big news' notices companies filed on %s" % (len(found), latest),
        sub_ko="큰 일이 생기면 바로 내는 서류 (8-K) 중 일부 · 우리가 지켜보는 회사",
        sub_en="Some of the notices companies file right after big events (8-K) · companies we track",
        rows=rows,
        note_ko="낸 목록 그대로예요. 해석은 없어요. 투자 조언 아님.", note_en="Filing list as submitted. No interpretation. Not investment advice.",
        source_ko="출처: 미 증권위원회(SEC) 8-K 신고서", source_en="Source: SEC 8-K notices (EDGAR)",
        source_url="https://www.sec.gov/edgar/search/",
        **share("%s 회사들이 낸 '큰 소식' 신고서 %d건" % (latest, len(found)),
                "%d 'big news' notices companies filed on %s" % (len(found), latest)))


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
