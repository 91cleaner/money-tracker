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
        if isinstance(data, dict):
            for key in ("events", "trades", "transactions", "filings", "observations", "cities"):
                if isinstance(data.get(key), list):
                    result["records"] = len(data[key])
                    break
            if name == "congress_bills":
                result["records"] = sum(len(v) for v in data.get("recent", {}).values() if isinstance(v, list))
            result["source_updated"] = data.get("updated") or data.get("checked_at")
        elif isinstance(data, list):
            result["records"] = len(data)
        result["status"] = "present" if result["records"] is None or result["records"] > 0 else "empty"
    except (ValueError, UnicodeError, OSError) as exc:
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
