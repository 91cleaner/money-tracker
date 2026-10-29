"""Per-ticker House member trades (last 12 months) for the control-room ticker tour stop.

Output: data/us/ticker-members.json  {updated, since, tickers: {SYM: {total, members:[...]}}}
Party/state/district: Congress.gov API (CONGRESS_API_KEY) with cache; members.json only as fallback.
Locations are approximate district centers (Census Gazetteer internal points).
"""
import collections, datetime as dt, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from congress_trades_card import congress_member, short_asset, amt, CACHE, CENTERS, TRADES, ROOT  # noqa: E402

OUT = ROOT / "data/us/ticker-members.json"
SHOW = 6


def main():
    today = dt.datetime.utcnow().date()
    since = (today - dt.timedelta(days=365)).isoformat()
    trades = [t for t in json.load(open(TRADES, encoding="utf-8"))["trades"]
              if t.get("c") == "h" and t.get("tk") and (t.get("d") or "") >= since and t.get("id")]
    centers = json.load(open(CENTERS))["centers"]
    try:
        cache = json.load(open(CACHE))
    except (OSError, ValueError):
        cache = {}
    fallback = {m["id"]: m for m in json.load(open(ROOT / "data/us/members.json", encoding="utf-8"))["members"]}
    by = collections.defaultdict(lambda: collections.defaultdict(list))
    for t in trades:
        by[t["tk"].upper()][t["id"]].append(t)
    out = {}
    for sym, mem in by.items():
        rows = []
        for bid, ts in mem.items():
            info = congress_member(bid, cache)
            if not info:
                f = fallback.get(bid)
                if not f:
                    continue
                info = {"first": "", "last": "", "name": f["name"], "party": f["party"], "state": f["state"], "district": f.get("district")}
            if info["party"] not in ("R", "D") or not info["state"]:
                continue
            d = int(info["district"] or 0)
            ll = centers.get(f"{info['state']}-{d}") or centers.get(f"{info['state']}-0") or centers.get(f"{info['state']}-1")
            if not ll:
                continue
            ts.sort(key=lambda t: t.get("d") or "", reverse=True)
            rows.append({
                "name": f"{info['first']} {info['last']}".strip() or info.get("name") or ts[0].get("who"),
                "p": info["party"], "dist": f"{info['state']}-{d if d else 'AL'}", "ll": ll,
                "n": len(ts), "b": sum(t.get("ty") == "P" for t in ts), "s": sum((t.get("ty") or "").startswith("S") for t in ts),
                "last": [{"s": "BUY" if t.get("ty") == "P" else "SELL" if (t.get("ty") or "").startswith("S") else "EXCHANGE",
                          "amt": amt(t.get("amt")), "d": t.get("d"), "doc": t.get("doc")} for t in ts[:2]],
            })
        if not rows:
            continue
        rows.sort(key=lambda r: r["last"][0]["d"] or "", reverse=True)
        out[sym] = {"total": len(rows), "members": rows[:SHOW]}
    json.dump(cache, open(CACHE, "w"), indent=0, sort_keys=True)
    json.dump({"updated": today.isoformat(), "since": since, "note": "House PTRs only. Amounts are reported ranges. Dots are approximate district locations.",
               "tickers": out}, open(OUT, "w"), separators=(",", ":"))
    print(len(out), "tickers;", {k: out[k]["total"] for k in ("NVDA", "TSLA", "PLTR") if k in out})


if __name__ == "__main__":
    main()
