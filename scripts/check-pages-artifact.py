#!/usr/bin/env python3
"""Check generated GitHub Pages artifact for expected public files."""
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import json
import math
import re
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


# Collector errors are published verbatim. Keep useful outage diagnostics,
# but never ship credentials or raw HTML from an upstream exception.
SECRET_IN_ERROR = re.compile(
    r"(?i)(?:\b(?:authorization|x-api-key)\s*[:=]\s*\S+"
    r"|\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)"
    r"\s*[:=]\s*\S+"
    r"|\b(?:gh[pousr]_|github_pat_|sk-)[A-Za-z0-9_-]{12,}"
    r"|\bAKIA[0-9A-Z]{16}\b)"
)


def safe_public_error(value):
    return (isinstance(value, str) and bool(value.strip())
            and "<" not in value and ">" not in value
            and not SECRET_IN_ERROR.search(value))

try:
    pub = json.loads((root / "data/us/trades_public.json").read_text(encoding="utf-8"),
                     object_pairs_hook=unique_keys, parse_constant=reject_constant)
    if not isinstance(pub, dict) or not isinstance(pub.get("trades"), list):
        raise ValueError("trades must be an explicit array")
    if any(not isinstance(t, dict) for t in pub["trades"]):
        raise ValueError("every trade must be an object")
    # A malformed object must not be counted as a reported transaction.
    # An actually empty ledger is represented by trades: [] instead.
    # A published transaction needs enough filing context to be verifiable.
    # In the current official House PTR snapshot all 4,647 rows contain
    # these six fields; sparse/blank records must not inflate trade counts.
    core_fields = ("who", "asset", "ty", "d", "amt", "doc")
    for index, trade in enumerate(pub["trades"]):
        if any(not isinstance(trade.get(key), str) or not trade[key].strip()
               for key in core_fields):
            raise ValueError(f"trade {index}: missing or blank filing identity, transaction, or source")
        # Do not accept plausible-looking but impossible calendar dates.
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", trade["d"]):
            raise ValueError(f"trade {index}: invalid transaction date")
        try:
            date.fromisoformat(trade["d"])
        except ValueError:
            raise ValueError(f"trade {index}: invalid transaction date") from None
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
    # The allowlisted public fields are still displayed in HTML. Prevent
    # upstream filing text/metadata from carrying raw markup or credentials
    # into the published JSON even if a particular view escapes its output.
    def safe_public_text(value):
        return (not isinstance(value, str)
                or ("<" not in value and ">" not in value
                    and not SECRET_IN_ERROR.search(value)))
    if any(not safe_public_text(value) for key, value in pub.items() if key != "trades"):
        raise ValueError("unsafe public ledger metadata")
    if any(not safe_public_text(value)
           for trade in pub["trades"] for value in trade.values()):
        raise ValueError("unsafe public trade text")

    # Filing links are rendered as clickable provenance in several US views.
    # A scalar "doc" value can still be a javascript:/data: URL. Reject unsafe
    # schemes at the release gate even when the UI also validates links.
    def safe_filing_url(value):
        if not isinstance(value, str) or not value or "\\" in value:
            return False
        if any(ch.isspace() or ord(ch) < 32 or ord(ch) == 127 for ch in value):
            return False
        # A valid URL can still contain raw markup delimiters. Several views
        # insert filing links into HTML attributes, so reject delimiter-based
        # attribute/markup injection before the public artifact is released.
        if any(ch in value for ch in ('"', "'", "<", ">", chr(96))):
            return False
        try:
            url = urlsplit(value)
            # Public STOCK Act records must link to the original official
            # House Clerk / Senate eFD filing, not a third-party lookalike.
            if (url.scheme != "https"
                    or url.hostname not in ("disclosures-clerk.house.gov", "efdsearch.senate.gov")
                    or url.username is not None or url.password is not None
                    or url.port not in (None, 443)
                    or url.query or url.fragment):
                return False
            # An official hostname alone does not prove a filing. Reject
            # homepages and unrelated pages masquerading as PTR provenance.
            if url.hostname == "disclosures-clerk.house.gov":
                return bool(re.fullmatch(
                    r"/public_disc/ptr-pdfs/[0-9]{4}/[A-Za-z0-9_-]+\.pdf",
                    url.path, flags=re.IGNORECASE))
            return bool(re.fullmatch(
                r"/search/view/ptr/[A-Za-z0-9_-]+/?", url.path))
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
    # The entire status JSON is copied to public Pages. Unknown top-level
    # fields can expose tokens even when individual error strings are clean.
    if not isinstance(status, dict) or set(status) != {"created_at", "pipeline", "collectors"}:
        raise ValueError("unexpected or missing public collection status fields")
    if status.get("pipeline") != "official-public-no-ai":
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
        # Future collectors are allowed, but arbitrary JSON object keys are
        # not: a credential could otherwise be published as a collector name.
        if not isinstance(name, str) or not re.fullmatch(r"[a-z][a-z0-9_]*", name) or not isinstance(item, dict):
            raise ValueError("invalid collector entry")
        # The actual collector emits three explicit exceptional states. Preserve
        # those errors instead of treating an upstream failure as a missing row.
        state = item.get("status")
        if state == "failed":
            if set(item) != {"status", "error"} or not safe_public_error(item["error"]):
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
        if not isinstance(errors, list) or any(not safe_public_error(e) for e in errors):
            raise ValueError(name + ": errors must be an array of nonempty strings")
except (OSError, UnicodeError, ValueError, TypeError) as exc:
    sys.exit("Invalid public collection-status.json: " + str(exc))

print("Pages artifact check passed.")
