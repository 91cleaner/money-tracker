#!/usr/bin/env python3
"""Trades dated within 30 days before a company's dated public event -> data/us/trades-before-events.json
Trades: House PTR (data/us/trades.json, trade date 'd') and SEC Form 4 open-market P/S (data/us/insider-form4.json).
Events: 8-K filings (sec-filings.json), presidential documents naming the ticker (whitehouse.json), recalls (recalls.json),
assistance awards >= $1M (assistance-awards.json), plus a fixed list of historical events with official links.
History back to 2020 is read from data/us/history/ptr-{year}.json and data/us/history/form4/{TICKER}.json when present.
Each trade is paired only with the nearest event on or after it (1-30 days later). Dates side by side only: no claim of prior knowledge or cause."""
import json, os, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def J(*p):
    f = os.path.join(ROOT, "data", "us", *p)
    try: return json.load(open(f))
    except Exception: return {}
WIN = 30
ITEM = {"1.01": "material agreement", "1.02": "agreement ended", "2.01": "acquisition or sale completed", "2.02": "earnings results", "2.03": "new financial obligation",
        "2.05": "restructuring costs", "2.06": "impairment", "3.02": "unregistered share sale", "5.02": "executive or director change", "5.07": "shareholder vote",
        "7.01": "Reg FD disclosure", "8.01": "other event", "1.05": "cybersecurity incident", "4.02": "restatement"}
SEMIS = ["NVDA", "AMD", "INTC", "MU", "AMAT", "LRCX", "KLAC", "TSM", "AVGO", "QCOM", "ASML", "MRVL", "TXN", "ADI", "ON", "NXPI", "MCHP"]
HIST = [
 ("2025-04-02", "*", "Presidential tariff order signed (EO 14257, reciprocal tariffs)", "https://www.federalregister.gov/documents/2025/04/07/2025-06063/regulating-imports-with-a-reciprocal-tariff-to-rectify-trade-practices-that-contribute-to-large-and"),
 ("2025-04-09", "*", "Presidential order modifying reciprocal tariff rates (EO 14266, pause)", "https://www.federalregister.gov/documents/2025/04/15/2025-06462/modifying-reciprocal-tariff-rates-to-reflect-trading-partner-retaliation-and-alignment"),
 ("2022-10-07", SEMIS, "Commerce (BIS) advanced computing and chip export rules", "https://www.federalregister.gov/documents/2022/10/13/2022-21658/implementation-of-additional-export-controls-certain-advanced-computing-and-semiconductor"),
 ("2025-04-15", ["NVDA"], "NVIDIA 8-K on H20 export license requirement", "https://www.sec.gov/Archives/edgar/data/1045810/000104581025000082/nvda-20250409.htm"),
 ("2025-07-31", ["PLTR"], "US Army Enterprise Agreement awarded to Palantir (ceiling up to $10B)", "https://www.army.mil/article/287506/u_s_army_awards_enterprise_service_agreement_to_enhance_military_readiness_and_drive_operational_efficiency"),
 ("2022-08-09", SEMIS, "CHIPS and Science Act signed into law (Public Law 117-167)", "https://www.congress.gov/bill/117th-congress/house-bill/4346"),
 ("2022-08-16", ["TSLA", "FSLR", "ENPH", "SEDG", "RIVN", "GM", "F", "NEE", "PLUG", "RUN", "ALB"], "Inflation Reduction Act signed into law (Public Law 117-169)", "https://www.congress.gov/bill/117th-congress/house-bill/5376"),
]
AGENCY = [("OFAC", "Treasury OFAC"), ("BIS", "Commerce BIS"), ("USTR", "USTR"), ("상무부", "Commerce"), ("재무부", "Treasury"), ("국무부", "State"), ("에너지부", "Energy"), ("국방부", "Defense")]
def wh_label(w):
    t = (w.get("t") or "")[:90]
    if w.get("kind") == "presdoc": return "Presidential action: " + t, "presidential"
    ag = next((e for k, e in AGENCY if k in (w.get("type") or "")), "Federal agency")
    return f"Federal Register {w.get('kind') or 'document'} ({ag}): " + t, "agency"
def history():
    hd = os.path.join(ROOT, "data", "us", "history"); P, F = [], {}
    if os.path.isdir(hd):
        for f in sorted(os.listdir(hd)):
            if f.startswith("ptr-") and f.endswith(".json"): P += J("history", f).get("trades", [])
        fd = os.path.join(hd, "form4")
        if os.path.isdir(fd):
            for f in os.listdir(fd): F[f[:-5]] = J("history", "form4", f).get("trades", [])
    return P, F
def d(s):
    try: return datetime.date.fromisoformat(str(s)[:10])
    except Exception: return None
def main():
    T = [t for t in J("trades.json").get("trades", []) if t.get("tk") and t.get("d") and t.get("doc")]
    HP, HF = history()
    seen = {(t["doc"], t["d"], t.get("asset")) for t in T}
    T += [t for t in HP if t.get("tk") and t.get("d") and t.get("doc") and (t["doc"], t["d"], t.get("asset")) not in seen]
    F4 = {k: dict(v) for k, v in J("insider-form4.json").get("companies", {}).items()}
    for tk, rows in HF.items():
        cur = (F4.get(tk) or {}).get("trades", []); k = {(r.get("url"), r.get("date"), r.get("shares")) for r in cur}
        F4[tk] = dict(F4.get(tk) or {}, trades=cur + [r for r in rows if (r.get("url"), r.get("date"), r.get("shares")) not in k])
    SEC = J("sec-filings.json").get("companies", {}); WH = J("whitehouse.json").get("items", [])
    RC = J("recalls.json").get("companies", {}); AS = J("assistance-awards.json").get("companies", {})
    trades = {}
    for t in T:
        trades.setdefault(t["tk"], []).append({"src": "House PTR", "who": t["who"], "role": "House member", "side": {"P": "buy", "S": "sell", "S (partial)": "partial sale"}.get(t.get("ty"), t.get("ty")),
            "amount": t.get("amt"), "trade_date": t["d"], "filed": t.get("filed") or t.get("fd"), "trade_url": t["doc"]})
    for tk, c in F4.items():
        for t in c.get("trades", []):
            if t.get("code") not in ("P", "S") or not t.get("date"): continue
            v = (t.get("shares") or 0) * (t.get("price") or 0)
            trades.setdefault(tk, []).append({"src": "SEC Form 4", "who": t.get("who"), "role": t.get("role") or "insider", "side": "buy" if t["code"] == "P" else "sell",
                "amount": f"{t.get('shares'):,.0f} shares at ${t.get('price'):,.2f} (about ${v:,.0f})" if t.get("price") else f"{t.get('shares'):,.0f} shares",
                "plan": bool(t.get("plan")), "trade_date": t["date"], "filed": t.get("filed"), "trade_url": t.get("url")})
    out, notable = {}, []
    for tk, TR in trades.items():
        ev = []
        for k in (SEC.get(tk) or {}).get("k8", []):
            its = [i for i in k.get("items", []) if i != "9.01"]
            if its: ev.append((k["filed"], "8-K: " + ", ".join(ITEM.get(i, "item " + i) for i in its), k["url"], "8-K"))
        for w in WH:
            if tk in (w.get("tickers") or []) and w.get("u"): ev.append((w.get("sign") or w["date"], *wh_label(w)[:1], w["u"], wh_label(w)[1]))
        for r in (RC.get(tk) or {}).get("items", []): ev.append((r["date"], f"Recall ({r['src']}) {r['id']}", r["url"], "recall"))
        for a in (AS.get(tk) or {}).get("awards", []):
            if (a.get("usd") or 0) >= 1e6: ev.append((a["date"], f"Federal {a['type']} obligation ${a['usd']:,.0f} ({a.get('agency') or ''})", a["url"], "assistance"))
        for dt, who, lab, url in HIST:
            if who == "*" or tk in who: ev.append((dt, lab, url, "historical"))
        ev = sorted({(e[0], e[1]): e for e in ev if d(e[0])}.values())
        M = []
        for t in TR:
            td = d(t["trade_date"])
            if not td or td > datetime.date.today(): continue
            nxt = next((e for e in ev if 1 <= (d(e[0]) - td).days <= WIN), None)
            if nxt: M.append(dict(t, event=nxt[1], event_kind=nxt[3], event_date=nxt[0], event_url=nxt[2], days_before=(d(nxt[0]) - td).days))
        if not M: continue
        M.sort(key=lambda m: (m["event_date"], m["days_before"]), reverse=True)
        out[tk] = {"n": len(M), "n_ptr": sum(m["src"] == "House PTR" for m in M), "n_form4": sum(m["src"] == "SEC Form 4" for m in M), "matches": M[:20]}
        notable += [dict(m, ticker=tk) for m in M if m["event_kind"] in ("historical", "presidential", "agency", "assistance") or (m["event_kind"] == "8-K" and m["src"] == "House PTR")]
    notable.sort(key=lambda m: (m["event_kind"] != "historical", m["src"] != "House PTR", m["days_before"]))
    per = {}; notable = [m for m in notable if per.setdefault(m["event"], []).append(1) or len(per[m["event"]]) <= 6]
    json.dump({"updated": datetime.date.today().isoformat(), "window_days": WIN,
        "note": "Trades dated 1-30 days before a dated public event for the same company. Dates are placed side by side only; this does not show that anyone knew in advance or that one caused the other. House PTR amounts are reported ranges. Form 4 rows marked plan=true were under a 10b5-1 trading plan.",
        "coverage": {"house_ptr_from": min((t["d"] for t in T), default=None), "form4_days": J("insider-form4.json").get("days"), "history_from": "2020-01-01" if (HP or HF) else None},
        "companies": out, "notable": notable[:40]}, open(os.path.join(ROOT, "data", "us", "trades-before-events.json"), "w"), ensure_ascii=False, indent=1)
    print("companies", len(out), "matches", sum(v["n"] for v in out.values()))
if __name__ == "__main__": main()
