"""Compact per-ticker extras for the featured tickers (world-intelligence/ticker-extra.json).

Reads only already-collected official data:
  data/us/sec-filings.json (SEC EDGAR 8-K list), data/us/trades-before-events.json
  (House/Senate PTR and Form 4 trades vs. 8-K/policy dates), data/us/insider-form4.json, data/us/bills.json (Congress.gov sponsored bills, title keyword match).
Writes recent 8-Ks, a one-line timeline (latest trade date vs. next filing/policy date,
days apart, no causal wording) and Form 4 counts. No network.
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda *p: json.load(open(os.path.join(ROOT, *p), encoding="utf-8"))

import re
# Title keywords per ticker for bill matching (title match only; not a claim of effect).
SEMI = r"semiconductor|\bCHIPS Act|\bchips?\b(?! in\b)|microelectronic"
AI = r"artificial intelligence|\bAI\b|data cent|cloud|online|social media|kids online|privacy|broadband|cyber"
KW = {"GOOGL": AI + r"|search engine|antitrust", "AMZN": AI + r"|e-commerce|online market|warehouse", "MSFT": AI, "META": AI, "AAPL": AI + r"|app store|smartphone",
      "NVDA": SEMI + r"|artificial intelligence|export control", "INTC": SEMI, "MU": SEMI + r"|memory chip|\\bDRAM\\b|\\bHBM\\b", "AMD": SEMI, "AVGO": SEMI, "AMAT": SEMI, "CSCO": r"broadband|cyber|network|telecom",
      "TSLA": r"electric vehicle|\bEV\b|autonomous vehicle|self-driving|charging", "SPCX": r"outer space|space (?:launch|force|superiority|leadership|ready|station|exploration|commerce|traffic)|commercial space|satellite|NASA|launch vehicle|spectrum|\bFAA\b",
      "PLTR": r"artificial intelligence|defense procurement|defense software|\\bdata analytics", "LLY": r"drug|pharmac|insulin|obesity|GLP-1|Medicare part d|prescription", "JNJ": r"drug|pharmac|medical device|prescription|talc",
      "ABBV": r"drug|pharmac|prescription|patent", "MRK": r"drug|pharmac|vaccine|prescription", "UNH": r"health insurance|Medicare advantage|medicaid|pharmacy benefit|\bPBM",
      "JPM": r"\bbank|financial institution|deposit|stablecoin|capital requirement", "BAC": r"\bbank|financial institution|deposit|stablecoin|capital requirement",
      "BRK.B": r"insurance|railroad|utility|\bbank", "V": r"credit card|interchange|swipe fee|stablecoin|payment network|digital payment", "MA": r"credit card|interchange|swipe fee|stablecoin|payment network|digital payment",
      "XOM": r"\boil\b|natural gas|petroleum|pipeline|\bLNG\b|drilling|offshore", "CVX": r"\boil\b|natural gas|petroleum|pipeline|\bLNG\b|drilling|offshore",
      "WMT": r"retail|grocery|food price|\bSNAP\b|supply chain", "COST": r"retail|grocery|food price|\bSNAP\b", "PG": r"consumer product|household|tariff",
      "KO": r"beverage|sugar|soda|\bSNAP\b"}

NOISE = re.compile(r"commemorat|recogniz|anniversary|expressing the sense|designating|honoring|in memory", re.I)

def main():
    feat = J("world-intelligence", "featured-tickers.json")
    syms = [i["sym"] for g in feat["groups"] for i in g["items"]]
    sec = J("data", "us", "sec-filings.json").get("companies", {})
    tbe = J("data", "us", "trades-before-events.json").get("companies", {})
    f4 = J("data", "us", "insider-form4.json").get("companies", {})
    bills = J("data", "us", "bills.json")
    mem = {m["id"]: m["name"] for m in J("data", "us", "members.json")["members"]}
    traders = {t: {m["name"] for m in v.get("members", [])} for t, v in J("data", "us", "ticker-members.json")["tickers"].items()}
    allb = {}
    for bid, lst in bills.get("recent", {}).items():
        for b in lst:
            allb.setdefault(b["no"], dict(b, sp=mem.get(bid, bid)))
    out = {}
    for s in dict.fromkeys(syms):
        o = {}
        c = sec.get(s) or {}
        if c.get("k8"):
            o["k8"] = [{"d": k["filed"], "items": k.get("items", []), "url": k["url"]} for k in c["k8"][:5]]
        m = (tbe.get(s) or {}).get("matches") or []
        if m:
            x = max(m, key=lambda r: (r.get("trade_date") or "", r.get("event_date") or ""))
            o["tl"] = {k: x.get(k) for k in ("trade_date", "src", "who", "side", "event", "event_kind", "event_date", "days_before", "trade_url", "event_url")}
            o["tl_n"] = len(m)
        if s in KW:
            rx = re.compile(KW[s], re.I)
            hit = [b for b in allb.values() if rx.search(b["n"]) and not NOISE.search(b["n"])]
            hit.sort(key=lambda b: (b["sp"] in traders.get(s, set()), b["d"]), reverse=True)
            if hit:
                o["bills"] = [{"no": b["no"], "n": b["n"], "d": b["d"], "sp": b["sp"], "tr": b["sp"] in traders.get(s, set()), "u": b["u"], "a": b.get("a", ""), "ad": b.get("ad", "")} for b in hit[:5]]
        f = f4.get(s)
        if f is not None:
            o["f4"] = {"filings": f.get("filings", 0), "trades": len(f.get("trades", [])), "url": f.get("source_url"),
                       "rows": [{k2: x.get(k2) for k2 in ("date", "filed", "code", "shares", "price", "who", "role", "plan", "url")} for x in sorted(f.get("trades", []), key=lambda x: x.get("date") or "", reverse=True)[:12]]}
        if o:
            out[s] = o
    # Lawmaker trades per featured ticker with disclosure lag (trades.json: d = transaction date, filed = report filed date).
    from datetime import date
    D = lambda x: date.fromisoformat(x)
    mm = {m["id"]: m for m in J("data", "us", "members.json")["members"]}
    tr = J("data", "us", "trades.json")["trades"]
    ALIAS = {"GOOG": "GOOGL"}
    rng = [None, None]
    tt = {}
    for t in tr:
        k = ALIAS.get(t.get("tk"), t.get("tk"))
        d, f = t.get("d") or "", t.get("filed") or ""
        if not (re.match(r"\d{4}-\d{2}-\d{2}$", d) and re.match(r"\d{4}-\d{2}-\d{2}$", f)) or d > f:
            continue
        rng[0] = min(rng[0] or d, d); rng[1] = max(rng[1] or d, d)
        if k not in out and k not in syms:
            continue
        m = mm.get(t.get("id")) or {}
        tt.setdefault(k, []).append({"who": t.get("who"), "id": t.get("id"), "p": (m.get("party") or "")[:1], "ch": t.get("c"), "d": d, "f": f,
                                     "ty": t.get("ty"), "amt": t.get("amt"), "doc": t.get("doc"), "late": (D(f) - D(d)).days, "ll": m.get("ll")})
    # Closing prices (data/us/prices/YYYY-MM-DD.json): close on the trade date (or next trading day) and the latest close.
    import glob
    PX = {}
    for fp in sorted(glob.glob(os.path.join(ROOT, "data", "us", "prices", "*.json"))):
        try:
            PX[os.path.basename(fp)[:10]] = json.load(open(fp, encoding="utf-8")).get("c", {})
        except Exception:
            pass
    pdays = sorted(PX)
    for k, v in tt.items():
        last = next((d for d in reversed(pdays) if k in PX[d]), None)
        for r in v:
            d0 = next((d for d in pdays if d >= r["d"] and k in PX[d]), None)
            if d0 and last and d0 < last:
                r["pc"] = [d0, PX[d0][k], last, PX[last][k]]
    # Unusual-trade tags (facts only): first in this ticker for the member, near a matched bill action, filed after 45 days, within 30 days before an 8-K.
    first_any = {}
    for t in tr:
        d = t.get("d") or ""
        if re.match(r"\d{4}-\d{2}-\d{2}$", d) and d <= (t.get("filed") or ""):
            first_any[t.get("who")] = min(first_any.get(t.get("who"), d), d)
    for k, v in tt.items():
        k8 = sorted(x["filed"] for x in (sec.get(k) or {}).get("k8", []))
        bl = (out.get(k) or {}).get("bills") or []
        firsts = {}
        for r in sorted(v, key=lambda r: r["d"]):
            firsts.setdefault(r["who"], r["d"])
        for r in v:
            tg = []
            if firsts[r["who"]] == r["d"] and (D(r["d"]) - D(first_any.get(r["who"], r["d"]))).days >= 90:
                tg.append({"t": "first"})
            for b in bl:
                for bd in {b.get("d"), b.get("ad")} - {None, ""}:
                    if abs((D(bd) - D(r["d"])).days) <= 30:
                        tg.append({"t": "bill", "no": b["no"], "bd": bd, "n": (D(bd) - D(r["d"])).days}); break
                if tg and tg[-1]["t"] == "bill":
                    break
            if r["late"] > 45:
                tg.append({"t": "late"})
            nx = next((x for x in k8 if r["d"] < x and (D(x) - D(r["d"])).days <= 30), None)
            if nx:
                tg.append({"t": "8k", "kd": nx, "n": (D(nx) - D(r["d"])).days})
            if tg:
                r["tags"] = tg
        v.sort(key=lambda r: (r["f"], r["d"]), reverse=True)
        out.setdefault(k, {})["trades"] = v
    tdoc = {"note": "House and Senate periodic transaction reports. late = days from transaction date to report filed date; the STOCK Act deadline is 45 days.",
            "range": rng, "tags_note": "first = first trade in this ticker by this member in our data range, member already reporting other trades 90+ days earlier; bill = within 30 days of the introduction or latest action date of a title-keyword-matched bill; late = filed more than 45 days after the trade; 8k = an 8-K was filed within 30 days after the trade.", "tickers": {k: v["trades"] for k, v in out.items() if v.get("trades")}}
    json.dump(tdoc, open(os.path.join(ROOT, "world-intelligence", "ticker-trades.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    for v in out.values():
        v.pop("trades", None)
    doc = {"note": "Built from SEC EDGAR 8-K lists, House/Senate PTRs and Form 4 already collected in data/us. Timeline = dates only; it does not show a reason.",
           "updated": J("data", "us", "trades-before-events.json").get("updated"), "tickers": out}
    p = os.path.join(ROOT, "world-intelligence", "ticker-extra.json")
    json.dump(doc, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("ticker-extra", len(out))

if __name__ == "__main__":
    main()
