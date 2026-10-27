#!/usr/bin/env python3
"""Validate official House PTR filing metadata and produce a conservative research queue.

No PDF is parsed here; no securities trades are inferred from filings.
"""
import datetime as dt
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
source=ROOT/"data/us-house-filings.json"
out=ROOT/"data/us-ptr-research-queue.json"
if not source.exists() or source.stat().st_size==0:
    print("House index unavailable; PTR research queue not generated")
    raise SystemExit(0)
try:
    payload=json.loads(source.read_text(encoding="utf-8"))
    rows=payload.get("records",[])
    if not isinstance(rows,list): raise ValueError("records is not a list")
    selected=[]
    seen=set()
    for r in rows:
        if not isinstance(r,dict) or str(r.get("filing_type","")).upper()!="P": continue
        url=r.get("document_url")
        if not isinstance(url,str) or not url.startswith("https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/"): continue
        if url in seen: continue
        seen.add(url)
        selected.append({"id":str(r.get("id","")),"member":str(r.get("member","")),"filing_date":str(r.get("filing_date","")),"document_url":url,"status":"awaiting_pdf_review"})
    selected.sort(key=lambda x:x["filing_date"],reverse=True)
    report={"schema_version":1,"generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),"source":"US House Clerk filing index","source_collected_at":payload.get("collected_at"),"count":len(selected),"records":selected[:250],"caveat":"A PTR filing is not a verified transaction. PDF contents and trade dates require separate review."}
    out.write_text(json.dumps(report,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("PTR filing research queue:",len(report["records"]))
except (OSError,ValueError,TypeError) as exc:
    raise SystemExit("Invalid House index: "+str(exc))
