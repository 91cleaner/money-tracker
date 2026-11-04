#!/usr/bin/env python3
"""Build the trimmed public trade file (data/us/trades_public.json) from the private ledger.

Only public-filing fields are kept: member name/id, party/state, ticker, asset, buy/sell,
amount range, trade date, filed date, original filing link, and price move since trade (r, rspy).
The full data/us/trades.json stays private (never shipped to Pages)."""
import json
import math
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEEP = ("id", "who", "c", "tk", "asset", "ty", "d", "fd", "filed", "amt", "doc", "r", "rspy", "verification")
# Public review states only. Never publish arbitrary internal reviewer notes.
PUBLIC_VERIFICATION = frozenset({"machine_parsed_requires_review", "verified_against_original", "unknown"})


def build(out_path):
    src = json.loads((ROOT / "data/us/trades.json").read_text(encoding="utf-8"))
    if not isinstance(src, dict) or not isinstance(src.get("trades"), list):
        raise ValueError("trades.json must contain a trades array; refusing to publish an empty snapshot")
    mem = {}
    try:
        m = json.loads((ROOT / "data/us/members.json").read_text(encoding="utf-8")).get("members", [])
        for x in (m if isinstance(m, list) else m.values()):
            if isinstance(x, dict) and x.get("id"):
                mem[x["id"]] = x
    except FileNotFoundError:
        pass
    rows = []
    for index, t in enumerate(src["trades"]):
        if not isinstance(t, dict):
            raise ValueError(f"Invalid trade row at index {index}; refusing to publish")
        row = {k: t[k] for k in KEEP if k in t and t[k] is not None}
        # The public allowlist covers field names; reject nested values that
        # could smuggle private ledger metadata under an approved key.
        for key, value in row.items():
            if (isinstance(value, bool) or not isinstance(value, (str, int, float))
                    or (isinstance(value, float) and not math.isfinite(value))):
                raise ValueError(f"Invalid public trade field {key!r} at index {index}; refusing to publish")
        if "verification" in row and row["verification"] not in PUBLIC_VERIFICATION:
            row["verification"] = "unknown"
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
    # Publish only after a complete, durable write. A disk/write failure must
    # not truncate the last known-good public snapshot.
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=out.parent,
            prefix=f".{out.name}.", suffix=".tmp", delete=False,
        ) as handle:
            temporary = Path(handle.name)
            json.dump(payload, handle, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, out)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return len(rows)


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "data/us/trades_public.json")
    print(f"trades_public: {build(target)} rows -> {target}")
