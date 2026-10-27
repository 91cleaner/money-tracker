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
        payload = json.loads(raw)  # Reject invalid snapshots before changing the Worker.
        if route == "/data/us/bills.json":
            # Preserve every bill and official URL, but shorten long action prose
            # so the Cloudflare Worker stays under GitHub's 1 MiB contents limit.
            recent = {}
            for member, items in payload.get("recent", {}).items():
                recent[member] = []
                for item in items:
                    action = str(item.get("a", ""))
                    if len(action) > 60:
                        action = action[:59] + "…"
                    recent[member].append({
                        "n": item.get("n"), "no": item.get("no"),
                        "d": item.get("d"), "a": action,
                        "law": item.get("law"), "pass": item.get("pass"),
                        "u": item.get("u"),
                    })
            payload = {
                "updated": payload.get("updated"),
                "congress": payload.get("congress"),
                "source": payload.get("source"),
                "note": "Compact snapshot; consult the official bill URL for full actions.",
                "recent": recent,
            }
            raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
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
