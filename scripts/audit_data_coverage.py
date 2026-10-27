#!/usr/bin/env python3
"""Read-only MONEY TRACKER dataset inventory. No network calls or secrets."""
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPECS = {
    "congress_bills": "data/us/bills.json",
    "congress_trades": "data/us/trades.json",
    "house_filings": "data/us-house-filings.json",
    "us_macro": "data/us-macro.json",
    "historical_events": "data/us-events.json",
    "korean_municipal_contracts": "data/index.json",
}
def inspect(name, relative):
    path = ROOT / relative
    result = {"path": relative, "status": "missing", "records": None}
    if not path.exists() or path.stat().st_size == 0:
        result["status"] = "empty" if path.exists() else "missing"
        return result
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("expected JSON object")
        if name == "congress_bills":
            recent = data.get("recent")
            if not isinstance(recent, dict):
                raise ValueError("missing recent legislation map")
            if any(not isinstance(items, list) for items in recent.values()):
                raise ValueError("invalid member legislation list")
            result["records"] = sum(len(items) for items in recent.values())
            result["members"] = len(recent)
        elif name == "us_macro":
            series = data.get("series")
            if not isinstance(series, dict):
                raise ValueError("missing FRED series")
            if any(not isinstance(entry, dict) or not isinstance(entry.get("points"), list)
                   for entry in series.values()):
                raise ValueError("invalid FRED observations")
            result["records"] = sum(len(entry["points"]) for entry in series.values())
            result["series"] = len(series)
        else:
            key = {
                "congress_trades": "records",
                "house_filings": "records",
                "historical_events": "events",
                "korean_municipal_contracts": "cities",
            }[name]
            rows = data.get(key)
            if not isinstance(rows, list):
                raise ValueError("missing or invalid " + key + " array")
            result["records"] = len(rows)
        result["source_updated"] = (data.get("updated") or data.get("collected_at")
                                    or data.get("checked_at") or data.get("generated_at"))
        result["status"] = "present" if result["records"] > 0 else "empty"
    except (ValueError, TypeError, UnicodeError, OSError) as exc:
        result["status"] = "invalid"
        result["error"] = type(exc).__name__

    return result

report = {
    "checked_at": datetime.now(timezone.utc).isoformat(),
    "datasets": {name: inspect(name, path) for name, path in SPECS.items()},
    "limitations": [
        "File presence does not establish accuracy, completeness, freshness or license compliance.",
        "Legislator disclosures may report transaction amount ranges, not exact amounts.",
        "Historical correlation is not proof of causation or investment advice.",
    ],
}
out = ROOT / "data" / "collection-coverage.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k:v["status"] for k,v in report["datasets"].items()}, ensure_ascii=False))
