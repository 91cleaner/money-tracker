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
pub = json.loads((root / "data/us/trades_public.json").read_text(encoding="utf-8"))
allowed = {"id", "who", "c", "tk", "asset", "ty", "d", "fd", "filed", "amt", "doc", "r", "rspy", "party", "state"}
extra = sorted({k for t in pub.get("trades", []) for k in t} - allowed)
if extra or set(pub) - {"updated", "source", "note", "trades"}:
    sys.exit("trades_public.json has non-public fields: " + ", ".join(extra or sorted(set(pub))))
# Public map's recent House PTR layer must never expose impossible filing dates
# or links outside the official House Clerk PDF archive.
from public_ptr_guard import invalid_rows
recent_path = root / "data/us/trades-recent.json"
if not recent_path.is_file():
    sys.exit("Missing public House PTR recent snapshot")
try:
    recent = json.loads(recent_path.read_text(encoding="utf-8"))
    rejected = invalid_rows(recent)
except (OSError, ValueError) as exc:
    sys.exit(f"Invalid public House PTR snapshot: {exc}")
if rejected:
    sys.exit(f"Unsafe public House PTR rows: {rejected[:5]}")
print("Pages artifact check passed (privacy, PTR chronology and official PDF URL shape).")
