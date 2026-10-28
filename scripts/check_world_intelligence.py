#!/usr/bin/env python3
"""Read-only checks for the current MONEY TRACKER satellite map and evidence schema.

Checks integrity and source labeling; does not claim a browser or live deployment test.
"""
import datetime as dt
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
errors, warnings = [], []


def check(ok, message):
    if not ok:
        errors.append(message)


def load(relative, required=True):
    path = ROOT / relative
    if not path.exists() or not path.stat().st_size:
        (errors if required else warnings).append("Missing or empty dataset: " + relative)
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise ValueError("expected JSON object")
        return value
    except (ValueError, OSError) as exc:
        (errors if required else warnings).append(f"Invalid dataset {relative}: {exc}")
        return {}


page = ROOT / "world-intelligence/index.html"
html = page.read_text(encoding="utf-8") if page.exists() else ""
# 7b8cbca (10/27) retired the separate world map into a redirect to the single US command map.
# The live map is checked by command-check.yml / usa-map-smoke.yml; here we only confirm the redirect.
RETIRED = 'http-equiv="refresh"' in html and "usa-command.html" in html
if RETIRED:
    check((ROOT / "usa-command.html").is_file(), "Retired world map redirects to missing usa-command.html")
    warnings.append("world-intelligence/index.html retired -> usa-command.html; old map checks skipped")
if not page.exists():
    errors.append("Satellite map HTML missing")
elif not RETIRED:
    for marker in ('id="mapFrame"', 'id="map"', 'id="ask"',
                   'id="candidatePanel"', 'id="brief"', 'id="question"',
                   'server.arcgisonline.com', 'window.moneyTrackerMap',
                   'src="./evidence.js"'):
        check(marker in html, "Map missing feature: " + marker)
    check("document.getElementById('intelLines'),code=" not in html,
          "Old concatenated JavaScript corruption detected")
    check("fallback.style.display='block'" in html,
          "Offline fallback missing")
    scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", html, flags=re.I | re.S)
    evidence = ROOT / "world-intelligence/evidence.js"
    check(evidence.is_file(), "Source evidence overlay script missing")
    if evidence.is_file():
        js = evidence.read_text(encoding="utf-8")
        for marker in ("data/us/bills.json", "data/us/trades.json",
                       "ptr-crosschecks.json", "machine_parsed_requires_review",
                       "disclosures-clerk.house.gov", "www.congress.gov"):
            # Domain guards are written as regular expressions in evidence.js (dots escaped).
            check(marker in js or marker.replace(".", "\\.") in js,
                  "Evidence overlay missing source guard: " + marker)
    if shutil.which("node"):
        with tempfile.TemporaryDirectory() as tmp:
            for i, script in enumerate(scripts, 1):
                target = Path(tmp) / f"inline-{i}.js"
                target.write_text(script, encoding="utf-8")
                run = subprocess.run(["node", "--check", str(target)],
                                     capture_output=True, text=True)
                check(run.returncode == 0, f"Inline JS {i} syntax: {run.stderr[-350:]}")
            if evidence.is_file():
                run = subprocess.run(["node", "--check", str(evidence)],
                                     capture_output=True, text=True)
                check(run.returncode == 0, "Evidence JS syntax: " + run.stderr[-350:])
    else:
        warnings.append("Node unavailable: JavaScript syntax not checked")

worker = ROOT / "cloudflare/admin-worker.js"
if not worker.exists():
    errors.append("Authenticated Cloudflare Worker missing")
else:
    worker_source = worker.read_text(encoding="utf-8")
    check(worker.stat().st_size < 1024 * 1024,
          "Worker exceeds 1 MiB GitHub Contents API limit")
    for marker in ("// BEGIN GENERATED COMMAND ASSETS",
                   "const COMMAND_EVIDENCE_JS=", "const COMMAND_DATA=",
                   "Object.prototype.hasOwnProperty.call(COMMAND_DATA,path)",
                   "script-src 'self'", "connect-src 'self'"):
        check(marker in worker_source, "Authenticated Worker missing: " + marker)
    if shutil.which("node"):
        run = subprocess.run(["node", "--input-type=module", "--check"],
                             input=worker_source, capture_output=True, text=True)
        check(run.returncode == 0, "Worker JavaScript syntax: " + run.stderr[-350:])
    # A UI/data commit can precede its separate generated Worker sync commit.
    # Flag temporary drift without mislabeling it as a live deployment failure.
    try:
        decoder = json.JSONDecoder()
        pos = worker_source.index("const COMMAND_HTML=") + len("const COMMAND_HTML=")
        bundled_html, _ = decoder.raw_decode(worker_source[pos:])
        if page.exists() and bundled_html != html:
            warnings.append("Worker HTML snapshot differs from map source; sync pending")
        pos = worker_source.index("const COMMAND_EVIDENCE_JS=") + len("const COMMAND_EVIDENCE_JS=")
        bundled_js, _ = decoder.raw_decode(worker_source[pos:])
        evidence_path = ROOT / "world-intelligence/evidence.js"
        if evidence_path.exists() and bundled_js != evidence_path.read_text(encoding="utf-8"):
            warnings.append("Worker evidence JS snapshot differs from source; sync pending")
        pos = worker_source.index("const COMMAND_DATA=") + len("const COMMAND_DATA=")
        bundled_data, _ = decoder.raw_decode(worker_source[pos:])
        # The Worker embeds only what the map reads (see sync_command_worker.worker_payload); compare like with like.
        spec = importlib.util.spec_from_file_location("sync_command_worker", ROOT / "scripts/sync_command_worker.py")
        sync = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(sync)
        for route, relative in (
                ("/data/us/trades.json", "data/us/trades.json"),
                ("/data/us/ptr-crosschecks.json", "data/us/ptr-crosschecks.json")):
            expected = sync.worker_payload(route, json.loads((ROOT / relative).read_text(encoding="utf-8")))
            if json.loads(bundled_data[route]) != expected:
                warnings.append("Worker dataset snapshot differs from " + relative)
    except (ValueError, KeyError, OSError) as exc:
        errors.append("Cannot inspect authenticated Worker snapshots: " + str(exc))

bills = load("data/us/bills.json")
recent = bills.get("recent")
stats = bills.get("stat")
check(isinstance(recent, dict) and bool(recent), "Congress bills recent map missing")
check(isinstance(stats, dict) and bool(stats), "Congress bills member statistics missing")
bill_count = 0
if isinstance(recent, dict):
    for member, items in recent.items():
        if not isinstance(items, list):
            errors.append("Congress bill list invalid for member " + member)
            continue
        bill_count += len(items)
        for item in items:
            if not isinstance(item, dict) or not str(item.get("u", "")).startswith(
                    "https://www.congress.gov/bill/"):
                errors.append("Congress bill missing official source URL")
                break

# Machine-parsed House PTR candidates live in their own file since 657a1192a (they no longer overwrite
# the disclosure archive data/us/trades.json, which uses a "trades" array written by collector/us/trades.py).
candidates = load("data/us/house-ptr-candidates.json", required=False)
records = candidates.get("records") if candidates else None
if candidates:
    check(isinstance(records, list), "House PTR candidate schema must use records array")
else:
    warnings.append("House PTR candidates not published yet: candidate and crosscheck matching skipped")
today = dt.datetime.now(dt.timezone.utc).date()
valid_candidates = 0
if isinstance(records, list):
    for i, r in enumerate(records):
        if not isinstance(r, dict):
            errors.append(f"House PTR row {i} is not an object")
            continue
        if r.get("verification") != "machine_parsed_requires_review":
            errors.append(f"House PTR row {i} lacks explicit unverified label")
        if not str(r.get("source_pdf", "")).startswith(
                "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/"):
            errors.append(f"House PTR row {i} has no official PDF")
        else:
            valid_candidates += 1
        try:
            when = dt.date.fromisoformat(r["transaction_date"])
            if when > today:
                warnings.append(f"House PTR row {i} future transaction date")
            low, high = int(r["amount_min_usd"]), int(r["amount_max_usd"])
            if low < 1 or high < low:
                raise ValueError("invalid amount range")
        except (ValueError, TypeError, KeyError) as exc:
            errors.append(f"House PTR row {i} invalid date/amount: {exc}")
    if not records:
        warnings.append("No House PTR candidate rows: do not show trade signals")

ledger = load("data/us/ptr-crosschecks.json", required=False)
checks = ledger.get("checks", [])
check(isinstance(checks, list), "PTR crosscheck ledger must contain checks array")
if isinstance(checks, list) and isinstance(records, list):
    for item in checks:
        if not isinstance(item, dict):
            errors.append("Invalid PTR crosscheck item")
            continue
        if item.get("result") != "matches_reported_filing_fields":
            errors.append("Unsupported PTR crosscheck result")
        fields = ("filing_id", "ticker", "transaction_date", "type",
                  "amount_min_usd", "amount_max_usd")
        same_filing = [r for r in records if isinstance(r, dict) and r.get("filing_id") == item.get("filing_id")]
        if not same_filing:
            # The extraction queue rotates through filings (newest first since 7d2508443), so a hand-checked
            # filing may simply not be in the current candidate archive. That is not a data mismatch.
            warnings.append("PTR crosscheck filing not in current candidate archive: " + str(item.get("filing_id")))
        elif not any(all(item.get(key) == r.get(key) for key in fields) for r in same_filing):
            errors.append("PTR crosscheck does not match archived candidate row: " + str(item.get("filing_id")))
        if not str(item.get("source_pdf", "")).startswith(
                "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/"):
            errors.append("PTR crosscheck source is not official")

for optional in ("data/us-macro.json", "data/us-house-filings.json"):
    path = ROOT / optional
    if not path.exists() or not path.stat().st_size:
        warnings.append("Missing or empty optional dataset: " + optional)

status = load("data/us-ingestion-status.json", required=False)
health = status.get("file_health", {})
if isinstance(health, dict):
    for name in ("us-house-filings.json", "us-macro.json"):
        claimed = health.get(name, {})
        path = ROOT / "data" / name
        if isinstance(claimed, dict) and claimed.get("status") == "present" and (
                not path.exists() or not path.stat().st_size):
            warnings.append("Stale ingestion status claims present but file is empty: " + name)

print(f"World map health: {len(errors)} errors; {len(warnings)} warnings")
print(f"Congress bill records: {bill_count}; House PTR unverified candidates: {valid_candidates}; "
      f"PDF field crosschecks: {len(checks) if isinstance(checks, list) else 0}")
for warning in warnings:
    print("WARNING:", warning)
for error in errors:
    print("ERROR:", error, file=sys.stderr)
sys.exit(1 if errors else 0)
