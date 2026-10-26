#!/usr/bin/env python3
"""Archive official House financial disclosure filing metadata. Not individual trades."""
import datetime as dt
import io
import json
import pathlib
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = pathlib.Path("data")
ROOT.mkdir(exist_ok=True)
NOW = dt.datetime.now(dt.timezone.utc)
YEAR = NOW.year
def download(url):
    req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0 (compatible; MoneyTrackerResearch/1.0)"})
    with urllib.request.urlopen(req, timeout=35) as response:
        return response.read()

def tag(node, name):
    for child in node:
        if child.tag.split("}")[-1].lower() == name.lower():
            return (child.text or "").strip()
    return ""

def parse_xml(raw, year):
    root = ET.fromstring(raw)
    records = []
    for row in root.iter():
        if row.tag.split("}")[-1].lower() not in ("member", "filing", "row"):
            continue
        doc = tag(row, "DocID")
        kind = tag(row, "FilingType")
        if not doc or not kind:
            continue
        records.append({
            "id": str(year) + "-" + doc,
            "year": year,
            "member": " ".join(filter(None, [tag(row, "First"), tag(row, "Last")])) or tag(row, "Name"),
            "state": tag(row, "StateDst"),
            "filing_type": kind,
            "filing_date": tag(row, "FilingDate"),
            "document_url": "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/" + str(year) + "/" + doc + ".pdf" if kind.upper() == "P" else None,
            "source_index": "https://disclosures-clerk.house.gov/public_disc/financial-pdfs/" + str(year) + "FD.xml"
        })
    return records

archive = {}
existing = ROOT / "us-house-filings.json"
if existing.exists():
    try:
        old = json.loads(existing.read_text(encoding="utf-8"))
        archive = {str(x["id"]):x for x in old.get("records", [])}
    except (ValueError, KeyError, TypeError): pass
success = 0
errors = []
for year in [YEAR - 1, YEAR]:
    url = "https://disclosures-clerk.house.gov/public_disc/financial-pdfs/" + str(year) + "FD.xml"
    try:
        try:
            raw = download(url)
        except Exception:
            raw = download(url.replace("FD.xml", "FD.zip"))
        if raw[:2] == b"PK":
            with zipfile.ZipFile(io.BytesIO(raw)) as z:
                name = next(n for n in z.namelist() if n.lower().endswith(".xml"))
                raw = z.read(name)
        items = parse_xml(raw, year)
        if not items: raise ValueError("no filing rows parsed")
        for item in items: archive[item["id"]] = item
        print(year, len(items), "filings")
        success += 1
    except Exception as exc:
        errors.append({"year":year,"error":str(exc)[:180]})
        print(year, "failed", str(exc))
if not success and not archive:
    raise SystemExit("No verified House filing metadata; will not publish fabricated records")
records = sorted(archive.values(), key=lambda x:(x.get("year",0),x.get("filing_date",""),x["id"]),reverse=True)
payload = {"schema_version":1,"dataset":"US House financial disclosure filing index","collected_at":NOW.isoformat(),"source":"US House Clerk public financial disclosures","source_url":"https://disclosures-clerk.house.gov/FinancialDisclosure","records":records,"errors":errors,"caveat":"Filing metadata, not parsed securities trades. A filing is not evidence of wrongdoing or profit."}
existing.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
print("Archived",len(records),"verified filings")
