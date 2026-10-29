#!/usr/bin/env python3
"""Build the trimmed public trade file (data/us/trades_public.json) from the private ledger.

Only public-filing fields are kept: member name/id, party/state, ticker, asset, buy/sell,
amount range, trade date, filed date, original filing link, and price move since trade (r, rspy).
The full data/us/trades.json stays private (never shipped to Pages)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEEP = ("id", "who", "c", "tk", "asset", "ty", "d", "fd", "filed", "amt", "doc", "r", "rspy")


def build(out_path):
    src = json.loads((ROOT / "data/us/trades.json").read_text(encoding="utf-8"))
    mem = {}
    try:
        m = json.loads((ROOT / "data/us/members.json").read_text(encoding="utf-8")).get("members", [])
        for x in (m if isinstance(m, list) else m.values()):
            if isinstance(x, dict) and x.get("id"):
                mem[x["id"]] = x
    except FileNotFoundError:
        pass
    rows = []
    for t in src.get("trades", []):
        row = {k: t[k] for k in KEEP if k in t and t[k] is not None}
        if isinstance(row.get("asset"), str) and len(row["asset"]) > 120:
            row["asset"] = row["asset"][:119] + "…"
        info = mem.get(t.get("id")) or {}
        if info.get("party"):
            row["party"] = info["party"]
        if info.get("state"):
            row["state"] = info["state"]
        rows.append(row)
    payload = {
        "updated": src.get("updated"),
        "source": src.get("source"),
        "note": "Public summary of official STOCK Act filings. Amounts are ranges; r = stock price move since trade, not member profit.",
        "trades": rows,
    }
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return len(rows)


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "data/us/trades_public.json")
    print(f"trades_public: {build(target)} rows -> {target}")
