#!/usr/bin/env python3
"""Synchronize the authenticated Cloudflare /command with the single-map UI.

Embeds snapshots of already archived public-source JSON into the private Worker.
This is a build step, not a live API or independently verified trading feed.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKER = ROOT / "cloudflare/admin-worker.js"
BEGIN = "// BEGIN GENERATED COMMAND ASSETS\n"
END = "// END GENERATED COMMAND ASSETS\n"
FILES = {
    "/data/us/bills.json": "data/us/bills.json",
    "/data/us/trades.json": "data/us/trades.json",
    "/data/us/ptr-crosschecks.json": "data/us/ptr-crosschecks.json",
}


def js_string(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def build():
    page = (ROOT / "world-intelligence/index.html").read_text(encoding="utf-8")
    script = (ROOT / "world-intelligence/evidence.js").read_text(encoding="utf-8")
    data = {}
    for route, relative in FILES.items():
        raw = (ROOT / relative).read_text(encoding="utf-8")
        json.loads(raw)  # Reject invalid snapshots before changing the Worker.
        data[route] = raw
    output = (
        BEGIN
        + "const COMMAND_HTML=" + js_string(page) + ";\n"
        + "const COMMAND_EVIDENCE_JS=" + js_string(script) + ";\n"
        + "const COMMAND_DATA=" + js_string(data) + ";\n"
        + END
    )
    original = WORKER.read_text(encoding="utf-8")
    if BEGIN not in original or END not in original:
        raise SystemExit("Worker missing generated asset markers")
    start = original.index(BEGIN)
    finish = original.index(END, start) + len(END)
    updated = original[:start] + output + original[finish:]
    if updated != original:
        WORKER.write_text(updated, encoding="utf-8")
        print("Synchronized authenticated /command assets")
    else:
        print("Command assets already synchronized")


if __name__ == "__main__":
    build()
