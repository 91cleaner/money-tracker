#!/usr/bin/env python3
"""Read-only health checks for the public-data flat world map.
Does not require map API keys, tokens, or third-party Python packages.
"""
import datetime as dt
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
errors = []
warnings = []


def check(condition, message):
    if not condition:
        errors.append(message)


def read_json(relative):
    p = ROOT / relative
    if not p.exists():
        errors.append(f"Missing required dataset: {relative}")
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (ValueError, OSError) as exc:
        errors.append(f"Invalid JSON: {relative}: {exc}")
        return {}


page = ROOT / "world-intelligence/index.html"
if not page.exists():
    errors.append("World intelligence map HTML missing")
else:
    html = page.read_text(encoding="utf-8")
    for needle in ("id=\"realEarth\"", "L.map('realEarth'", "tile.openstreetmap.org",
                   "cdn.jsdelivr.net/npm/leaflet", "id=\"journey\"",
                   "id=\"intelFeed\"", "id=\"intelBrief\"", "#rotate{display:none!important}"):
        check(needle in html, f"Map page missing expected feature: {needle}")
    scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", html, flags=re.I | re.S)
    if shutil.which("node"):
        with tempfile.TemporaryDirectory() as directory:
            for i, script in enumerate(scripts, 1):
                p = pathlib.Path(directory) / f"inline-{i}.js"
                p.write_text(script, encoding="utf-8")
                result = subprocess.run(["node", "--check", str(p)], capture_output=True, text=True)
                if result.returncode:
                    errors.append(f"Inline JavaScript {i} syntax error: {result.stderr[-400:]}")
    else:
        warnings.append("Node.js not installed; JavaScript syntax check skipped")

signals_page = ROOT / "world-intelligence/us-signals.html"
if signals_page.exists():
    signals_html = signals_page.read_text(encoding="utf-8")
    check("../../data/" not in signals_html,
          "US Signal Lab has broken two-level data URLs on GitHub Pages")
else:
    errors.append("US Signal Lab HTML missing")

bills = read_json("data/us/bills.json")
trades = read_json("data/us/trades.json")
index = read_json("data/index.json")
check(isinstance(bills.get("stat"), dict) and len(bills.get("stat", {})) > 0,
      "US congressional bills dataset has no member statistics")
check(isinstance(trades.get("trades"), list) and len(trades.get("trades", [])) > 0,
      "US House transactions dataset is empty")
check(isinstance(index.get("cities"), list) and len(index.get("cities", [])) > 0,
      "Korean municipal data index is empty")

today = dt.datetime.now(dt.timezone.utc).date()
for name, value in [("US bills", bills.get("updated")), ("US trades", trades.get("updated")),
                    ("Korean municipal index", index.get("updated"))]:
    if not value:
        warnings.append(f"{name}: update timestamp missing")
        continue
    try:
        date = dt.date.fromisoformat(str(value)[:10])
        if (today - date).days > 2:
            warnings.append(f"{name}: data is {(today - date).days} days old")
    except ValueError:
        warnings.append(f"{name}: unparseable update timestamp {value}")

future = [row for row in trades.get("trades", [])
          if isinstance(row, dict) and str(row.get("d", "")) > today.isoformat()]
if future:
    warnings.append(f"{len(future)} transaction(s) have future-dated transaction dates; verify source PDFs")
if any("403" in str(line) or "Access Denied" in str(line) for line in trades.get("log", [])):
    warnings.append("Senate disclosure index access denied (403); Senate data completeness unverified")
for optional in ("data/us-macro.json", "data/us-house-filings.json"):
    if not (ROOT / optional).exists():
        warnings.append(f"Optional official dataset not generated: {optional}")

print(f"World intelligence health: {len(errors)} error(s), {len(warnings)} warning(s)")
print(f"US House trades: {len(trades.get('trades', []))}; US bill members: {len(bills.get('stat', {}))}; "
      f"Korean cities: {len(index.get('cities', []))}")
for message in warnings:
    print("WARNING:", message)
for message in errors:
    print("ERROR:", message, file=sys.stderr)
sys.exit(1 if errors else 0)
