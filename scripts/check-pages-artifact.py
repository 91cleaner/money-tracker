#!/usr/bin/env python3
"""Check generated GitHub Pages artifact for expected public files."""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".public-pages")
required = (
    "index.html", "search.html", "national.html", "usa-command.html",
    "assets/se.js", "assets/mt-command-ui.js",
    "data/search/se/core.json", "data/national/countries-110m.geojson",
    "data/us/trades_public.json",
)
missing = [name for name in required if not (root / name).is_file()]
if missing:
    sys.exit("Missing public assets: " + ", ".join(missing))

forbidden = (
    "cloudflare/admin-worker.js", "worker/private-api.js",
    "wrangler.jsonc", "collector/collect.py",
    "data/us/trades.json", "data/us/house-ptr-candidates.json",
    "data/us/ptr-crosschecks.json",
)
exposed = [name for name in forbidden if (root / name).exists()] + (["data/us/history/"] if (root / "data/us/history").exists() else [])
if exposed:
    sys.exit("Unexpected files in public artifact: " + ", ".join(exposed))
import json
import math
import re
from datetime import datetime


def reject_non_json_number(value):
    raise ValueError(f"Non-standard JSON numeric constant: {value}")


pub = json.loads(
    (root / "data/us/trades_public.json").read_text(encoding="utf-8"),
    parse_constant=reject_non_json_number,
)
if (not isinstance(pub, dict) or not isinstance(pub.get("trades"), list)
        or any(not isinstance(row, dict) for row in pub["trades"])):
    sys.exit("trades_public.json must contain a trades array of objects")
if any(any(isinstance(value, bool) or not isinstance(value, (str, int, float))
           or (isinstance(value, float) and not math.isfinite(value))
           for value in row.values()) for row in pub["trades"]):
    sys.exit("trades_public.json rows must contain only finite scalar values")
public_review_states = {"machine_parsed_requires_review", "verified_against_original", "unknown"}
if any("verification" in row and row["verification"] not in public_review_states
       for row in pub["trades"]):
    sys.exit("trades_public.json verification must be an approved public status")
# The public builder intentionally retains a source-review warning per trade.
# Keep this in sync with scripts/build_public_trades.py KEEP.
allowed = {"id", "who", "c", "tk", "asset", "ty", "d", "fd", "filed", "amt", "doc", "r", "rspy", "party", "state", "verification"}
extra = sorted({k for t in pub.get("trades", []) for k in t} - allowed)
if extra or set(pub) - {"updated", "source", "note", "trades"}:
    sys.exit("trades_public.json has non-public fields: " + ", ".join(extra or sorted(set(pub))))

# Validate top-level metadata independently of the builder: a hand-edited
# artifact must not bypass the trade-row privacy allowlist.
if pub.get("source") != "Official STOCK Act disclosures (see original filing links)" or pub.get("note") != "Public summary of official STOCK Act filings. Amounts are ranges; r = stock price move since trade, not member profit.":
    sys.exit("trades_public.json contains unapproved public metadata")
updated = pub.get("updated")
if updated is not None:
    if (not isinstance(updated, str) or len(updated) > 40
            or not re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+\-]+Z?)?", updated)):
        sys.exit("trades_public.json has invalid updated metadata")
    try:
        datetime.fromisoformat(updated.replace("Z", "+00:00"))
    except ValueError:
        sys.exit("trades_public.json has invalid updated metadata")
print("Pages artifact check passed.")
