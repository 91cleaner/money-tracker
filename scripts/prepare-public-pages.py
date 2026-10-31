#!/usr/bin/env python3
"""Prepare a public-only Pages artifact. No source, workers, or private configuration."""
from pathlib import Path
import shutil
import sys

# Passcode gate removed (site is public). Kept as a flag for reference only.
SITE_GATE = False

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".public-pages"
PUBLIC_DIRS = ("assets", "data", "c", "s", "world-intelligence", "3ac9ae3", "9590438", "b387449", "weekly")
# Private US trade datasets must never be shipped to public GitHub Pages.
PRIVATE_DATA_FILES = {"data/us/trades.json", "data/us/house-ptr-candidates.json", "data/us/ptr-crosschecks.json"}
# .geojson: national map country borders (polgame.js), .csv: trip downloads (national.js) — both are fetched by public pages
PUBLIC_EXTENSIONS = {".html", ".css", ".js", ".json", ".geojson", ".csv", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".webmanifest", ".txt"}
PUBLIC_ROOT_FILES = {".nojekyll"}
EXCLUDED_PARTS = {"__pycache__", ".git", "private", "internal", "secrets", "credentials", "debug"}
BLOCKED_NAMES = {".env", "wrangler.jsonc", "wrangler.toml"}
BLOCKED_SUFFIXES = (".pem", ".key", ".p12", ".sqlite", ".db")
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()
def safe(path):
    if path.is_symlink():
        return False
    rel = path.relative_to(ROOT)
    if rel.as_posix() in PRIVATE_DATA_FILES or rel.as_posix().startswith("data/us/history/"):
        return False
    if any(part.lower() in EXCLUDED_PARTS or part.lower().startswith(".") for part in rel.parts):
        return rel.as_posix() in PUBLIC_ROOT_FILES
    if path.name.lower() in BLOCKED_NAMES or path.suffix.lower() in BLOCKED_SUFFIXES:
        return False
    return path.suffix.lower() in PUBLIC_EXTENSIONS
for child in ROOT.iterdir():
    if child.is_file() and (child.name in PUBLIC_ROOT_FILES or (safe(child) and child.suffix.lower() in PUBLIC_EXTENSIONS)):
        shutil.copy2(child, OUT / child.name)
for dirname in PUBLIC_DIRS:
    directory = ROOT / dirname
    if not directory.exists():
        continue
    for src in directory.rglob("*"):
        if not src.is_file() or not safe(src):
            continue
        rel = src.relative_to(ROOT)
        target = OUT / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, target)
# Trimmed public trade file built from the private ledger (decision #136: US trades are public).
sys.path.insert(0, str(ROOT / "scripts"))
from build_public_trades import build as build_public_trades
build_public_trades(OUT / "data/us/trades_public.json")
# Check the generated public trade summary before any workflow can publish it.
# This catches nested private metadata even in workflows that only build the artifact.
import json
from public_ptr_guard import validate_public_trades
validate_public_trades(json.loads((OUT / "data/us/trades_public.json").read_text(encoding="utf-8")))
# Quarantine invalid House PTR chronology/official-source links in the PUBLIC COPY only.
# The collector-owned source data remains unchanged for source reconciliation.
from public_ptr_guard import sanitize_file
recent_path = OUT / "data/us/trades-recent.json"
if not recent_path.is_file():
    sys.exit("Missing public House PTR recent snapshot")
kept, excluded = sanitize_file(recent_path)
print(f"Public House PTR: {kept} chronology-screened rows (not independently verified executions), {excluded} excluded")
for required in ("index.html", "usa-command.html", "national.html", "assets/mt-command-ui.js", "data/national/countries-110m.geojson", "search.html", "assets/se.js", "data/search/se/core.json", "data/us/trades_public.json"):
    if not (OUT / required).exists():
        sys.exit(f"Missing required public file: {required}")
for forbidden in ("cloudflare/admin-worker.js", "worker/private-api.js", "wrangler.jsonc", "collector/collect.py", ".github/workflows/deploy-pages.yml"):
    if (OUT / forbidden).exists():
        sys.exit(f"Private/source file in public artifact: {forbidden}")
print(f"Prepared {sum(1 for x in OUT.rglob('*') if x.is_file())} public files in {OUT}")
