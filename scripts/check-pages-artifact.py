#!/usr/bin/env python3
"""Check generated GitHub Pages artifact for expected public files."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
import math
import sys
from urllib.parse import urlsplit

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".public-pages")
required = (
    "index.html", "search.html", "national.html", "usa-command.html",
    "assets/se.js", "assets/mt-command-ui.js",
    "data/search/se/core.json", "data/national/countries-110m.geojson",
    "data/us/trades_public.json", "data/search/collection-status.json",
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

# Fail closed if the public PTR ledger is missing or malformed. A missing
# "trades" key used to be treated as an empty array, silently publishing zero.
def unique_keys(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            raise ValueError("duplicate key: " + key)
        obj[key] = value
    return obj

def reject_constant(value):
    raise ValueError("non-finite JSON value: " + value)

try:
    pub = json.loads((root / "data/us/trades_public.json").read_text(encoding="utf-8"),
                     object_pairs_hook=unique_keys, parse_constant=reject_constant)
    if not isinstance(pub, dict) or not isinstance(pub.get("trades"), list):
        raise ValueError("trades must be an explicit array")
    if any(not isinstance(t, dict) for t in pub["trades"]):
        raise ValueError("every trade must be an object")
    extra_top = sorted(set(pub) - {"updated", "source", "note", "trades"})
    allowed = {"id", "who", "c", "tk", "asset", "ty", "d", "fd", "filed", "amt", "doc", "r", "rspy", "party", "state"}
    extra_rows = sorted({k for t in pub["trades"] for k in t} - allowed)
    if extra_top or extra_rows:
        raise ValueError("non-public fields: " + ", ".join(extra_top + extra_rows))
    # Allowlisted names alone do not make nested values public. A malformed
    # ledger could hide private objects under a permitted key such as "who".
    # The public builder emits only scalar filing values (or null metadata).
    def public_scalar(value):
        # json.loads accepts 1e309 as float('inf') even with parse_constant
        # rejecting NaN/Infinity tokens. Only finite JSON numbers are safe.
        if type(value) is float:
            return math.isfinite(value)
        return value is None or type(value) in (str, int)
    if any(not public_scalar(value) for key, value in pub.items() if key != "trades"):
        raise ValueError("public ledger metadata must be scalar")
    if any(value is None or not public_scalar(value)
           for trade in pub["trades"] for value in trade.values()):
        raise ValueError("public trade values must be non-null scalars")

    # Filing links are rendered as clickable provenance in several US views.
    # A scalar "doc" value can still be a javascript:/data: URL. Reject unsafe
    # schemes at the release gate even when the UI also validates links.
    def safe_filing_url(value):
        if not isinstance(value, str) or not value or "\\" in value:
            return False
        if any(ch.isspace() or ord(ch) < 32 or ord(ch) == 127 for ch in value):
            return False
        try:
            url = urlsplit(value)
            return (url.scheme in ("http", "https") and bool(url.hostname)
                    and url.username is None and url.password is None)
        except ValueError:
            return False

    if any("doc" in trade and not safe_filing_url(trade["doc"])
           for trade in pub["trades"]):
        raise ValueError("filing doc must be a safe absolute HTTP(S) URL")
except (OSError, UnicodeError, ValueError, TypeError) as exc:
    sys.exit("Invalid public trades_public.json: " + str(exc))

# This status is displayed to explain failed official-data collections. A missing
# or malformed errors array must never silently look like a verified zero count.
status_path = root / "data/search/collection-status.json"
try:
    status = json.loads(status_path.read_text(encoding="utf-8"),
                        object_pairs_hook=unique_keys, parse_constant=reject_constant)
    if not isinstance(status, dict) or status.get("pipeline") != "official-public-no-ai":
        raise ValueError("missing official-public-no-ai pipeline")
    stamp = status.get("created_at")
    if not isinstance(stamp, str):
        raise ValueError("missing created_at timestamp")
    created = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    if created.tzinfo is None or created.utcoffset() is None:
        raise ValueError("created_at must include a timezone")
    # A future-dated collection can falsely appear fresher than the source.
    # Allow minor clock skew, but never publish implausible future timestamps.
    if created > datetime.now(timezone.utc) + timedelta(minutes=10):
        raise ValueError("created_at is in the future")
    collectors = status.get("collectors")
    if not isinstance(collectors, dict):
        raise ValueError("collectors must be an object")
    required_collectors = {"us_federal_register", "japan_diet", "taiwan_legislature", "us_sec"}
    if missing_collectors := sorted(required_collectors - collectors.keys()):
        raise ValueError("missing collectors: " + ", ".join(missing_collectors))
    for name, item in collectors.items():
        if not isinstance(name, str) or not name or not isinstance(item, dict):
            raise ValueError("invalid collector entry")
        # The actual collector emits three explicit exceptional states. Preserve
        # those errors instead of treating an upstream failure as a missing row.
        state = item.get("status")
        if state == "failed":
            if set(item) != {"status", "error"} or not isinstance(item["error"], str) or not item["error"].strip():
                raise ValueError(name + ": failed status requires a nonempty error")
            continue
        if state in ("not-configured", "invalid-term"):
            expected = "us_sec" if state == "not-configured" else "taiwan_legislature"
            if name != expected or set(item) != {"status", "count"} or type(item["count"]) is not int or item["count"] != 0:
                raise ValueError(name + ": invalid " + state + " status")
            continue
        if state is not None:
            raise ValueError(name + ": unknown collector status")
        if set(item) != {"count", "errors"}:
            raise ValueError(name + ": normal status requires count and errors only")
        count, errors = item["count"], item["errors"]
        if type(count) is not int or count < 0:
            raise ValueError(name + ": count must be a nonnegative integer")
        if not isinstance(errors, list) or any(not isinstance(e, str) or not e.strip() for e in errors):
            raise ValueError(name + ": errors must be an array of nonempty strings")
except (OSError, UnicodeError, ValueError, TypeError) as exc:
    sys.exit("Invalid public collection-status.json: " + str(exc))

print("Pages artifact check passed.")
