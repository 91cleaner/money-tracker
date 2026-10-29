"""Weekly card: 'This week in Congress trades' (1600x900 PNG).

Background is a real screenshot of the site's U.S. control-room map; the overlay is
HTML/CSS rendered by the same headless browser. Data: House Clerk PTRs in
data/us/trades.json. Party/state/district: Congress.gov API (CONGRESS_API_KEY).
Dot positions are approximate district centers (Census Gazetteer internal points).
Rules: English only, amount ranges only, no advice or causal wording.
"""
import collections, datetime as dt, json, os, pathlib, sys, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
TRADES = ROOT / "data/us/trades.json"
CENTERS = ROOT / "data/us/district-centers.json"
CACHE = ROOT / "data/us/congress-member-cache.json"
OUTDIR = ROOT / "weekly"
SITE = os.environ.get("WEEKLY_MAP_URL", "https://91cleaner.github.io/money-tracker/world-intelligence/?lang=en")
MAX_CARDS = 10


def pick_window(trades, today):
    filed = sorted({t["filed"] for t in trades if t.get("filed")})
    if not filed:
        sys.exit("no House filings with a filing date")
    end = today
    start = end - dt.timedelta(days=6)
    rows = [t for t in trades if start.isoformat() <= t.get("filed", "") <= end.isoformat()]
    fallback = False
    if not rows:
        end = dt.date.fromisoformat(filed[-1])
        start = end - dt.timedelta(days=6)
        rows = [t for t in trades if start.isoformat() <= t.get("filed", "") <= end.isoformat()]
        fallback = True
    return start, end, rows, fallback


def congress_member(bid, cache):
    if bid in cache:
        return cache[bid]
    key = os.environ.get("CONGRESS_API_KEY", "")
    if not key:
        return None
    url = f"https://api.congress.gov/v3/member/{bid}?format=json&api_key={key}"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "money-tracker"}), timeout=30) as r:
            m = json.load(r)["member"]
    except Exception as e:  # never echo the URL (it carries the key)
        print(f"congress.gov lookup failed for {bid}: {type(e).__name__}")
        return None
    terms = m.get("terms") or []
    t = terms[-1] if terms else {}
    info = {
        "name": m.get("directOrderName") or "",
        "first": m.get("firstName") or "", "last": m.get("lastName") or "",
        "party": ((m.get("partyHistory") or [{}])[-1].get("partyAbbreviation") or "")[:1],
        "state": t.get("stateCode") or "",
        "district": t.get("district"),
    }
    cache[bid] = info
    time.sleep(0.2)
    return info


def short_asset(t):
    if t.get("tk"):
        return t["tk"]
    a = t.get("asset") or "Asset"
    if "Treasury" in a or "T-Bill" in a or "US Treas" in a:
        return "T-Bill" if "Bill" in a else "T-Note" if "Note" in a else "Treasury"
    a = a.split(" - ")[0].split(" (")[0]
    for suf in (" LLC", " L.P.", " LP", " Inc.", " Inc", " Corporation", " Corp.", " Co.", " Fund", " Holdings"):
        a = a.replace(suf, "")
    out = ""
    for w in a.split():
        if len(out) + len(w) + (1 if out else 0) > 18:
            break
        out = f"{out} {w}".strip()
    return (out or a[:18]).rstrip(",;:.-& ")


def amt(a):
    a = (a or "").replace(",000,001", "M").replace(",000,000", "M").replace(",001", "K").replace(",000", "K")
    return a.replace(" - ", "-").replace("Over ", ">")


def build(today):
    trades = [t for t in json.load(open(TRADES, encoding="utf-8"))["trades"] if t.get("c") == "h"]
    start, end, rows, fallback = pick_window(trades, today)
    centers = json.load(open(CENTERS))["centers"]
    try:
        cache = json.load(open(CACHE))
    except (OSError, ValueError):
        cache = {}
    problems = []
    by = collections.OrderedDict()
    for t in rows:
        by.setdefault(t.get("id") or ("?" + t.get("who", "")), []).append(t)
    members = []
    for bid, ts in by.items():
        info = congress_member(bid, cache) if not bid.startswith("?") else None
        if not info or info["party"] not in ("R", "D") or not info["state"]:
            problems.append(f"{ts[0].get('who')}: no Congress.gov party/district match ({len(ts)} trades left off the map)")
            continue
        d = info["district"] or 0
        loc = centers.get(f"{info['state']}-{int(d)}") or centers.get(f"{info['state']}-0") or centers.get(f"{info['state']}-1")
        if not loc:
            problems.append(f"{ts[0].get('who')}: no location for {info['state']}-{d}")
            continue
        ts.sort(key=lambda t: t.get("d") or "", reverse=True)
        lines = [dict(a=short_asset(t), s="BUY" if t.get("ty") == "P" else "SELL" if t.get("ty") in ("S", "S (partial)") else "EXCHANGE",
                      amt=amt(t.get("amt")), d=(t.get("d") or "")[5:].replace("-", "/")) for t in ts]
        name = f"{info['first']} {info['last']}".strip() or ts[0].get("who")
        members.append(dict(id=bid, name=name, p=info["party"], dist=f"{info['state']}-{d if d else 'AL'}",
                            lat=loc[0], lng=loc[1], lines=lines, n=len(ts)))
    json.dump(cache, open(CACHE, "w"), indent=0, sort_keys=True)
    summ = {}
    for P in "RD":
        ms = [m for m in members if m["p"] == P]
        ls = [l for m in ms for l in m["lines"]]
        c = collections.Counter(l["a"] for l in ls)
        summ[P] = dict(m=len(ms), n=len(ls), b=sum(l["s"] == "BUY" for l in ls), s=sum(l["s"] == "SELL" for l in ls),
                       top=[k for k, _ in c.most_common(4)])
    members.sort(key=lambda m: -m["n"])
    shown = members[:MAX_CARDS]
    meta = dict(start=start.isoformat(), end=end.isoformat(), fallback=fallback, generated=today.isoformat(),
                trades=sum(s["n"] for s in summ.values()), members=len(members), summary=summ,
                hidden_members=max(0, len(members) - len(shown)), problems=problems,
                rows=[dict(name=m["name"], party=m["p"], district=m["dist"], trades=m["lines"]) for m in members])
    return shown, meta


def fmt(d):
    return d.strftime("%b %-d, %Y") if isinstance(d, dt.date) else d


def render(shown, meta, png):
    from playwright.sync_api import sync_playwright
    js = (pathlib.Path(__file__).parent / "overlay.js").read_text()
    s, e = dt.date.fromisoformat(meta["start"]), dt.date.fromisoformat(meta["end"])
    sub = (f"House periodic transaction reports filed {s.strftime('%b %-d')} - {e.strftime('%b %-d, %Y')}"
           f" · {meta['trades']} trades · {meta['members']} members")
    if meta["fallback"]:
        sub += " · latest 7 days with filings"
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1600, "height": 900})
        pg.goto(SITE, wait_until="networkidle", timeout=120000)
        pg.wait_for_function("() => window.moneyTrackerMap && window.moneyTrackerMap.latLngToContainerPoint", timeout=60000)
        pg.wait_for_timeout(2500)
        pg.evaluate(js, dict(phase="map"))
        pg.wait_for_timeout(4000)  # tiles
        pg.evaluate(js, dict(phase="draw", d=shown, s=meta["summary"], sub=sub, more=meta["hidden_members"]))
        pg.wait_for_timeout(600)
        pg.screenshot(path=str(png))
        b.close()


def main():
    today = dt.date.fromisoformat(os.environ["WEEKLY_DATE"]) if os.environ.get("WEEKLY_DATE") else dt.datetime.utcnow().date()
    shown, meta = build(today)
    OUTDIR.mkdir(exist_ok=True)
    png = OUTDIR / f"congress-trades-{meta['end']}.png"
    render(shown, meta, png)
    (OUTDIR / "latest.png").write_bytes(png.read_bytes())
    meta["image"] = png.name
    json.dump(meta, open(OUTDIR / "latest.json", "w"), indent=1)
    json.dump(meta, open(OUTDIR / f"congress-trades-{meta['end']}.json", "w"), indent=1)
    print(json.dumps({k: meta[k] for k in ("start", "end", "fallback", "trades", "members", "summary", "problems")}, indent=1))


if __name__ == "__main__":
    main()
