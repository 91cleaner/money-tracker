#!/usr/bin/env python3
"""Conservative US House digital PTR PDF extraction.

Only table rows with valid dates, transaction codes and disclosed amount bands
are exported. Scanned PDFs and ambiguous rows remain in review, never guessed.
Run after build_ptr_research_queue.py. Requires pdfplumber.
"""
import datetime as dt
import io
import json
import os
import re
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
QUEUE=ROOT/"data/us-ptr-research-queue.json"
OUT=ROOT/"data/us/house-ptr-candidates.json"  # Review-only; never overwrite legacy disclosure trades.json
STATUS=ROOT/"data/us-ptr-extraction-status.json"
MAX_DOCS=max(1,min(int(os.getenv("PTR_MAX_DOCS","8")),25))
DATE=re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$")
BAND=re.compile(r"\$\s*([\d,]+)\s*[-–]\s*\$\s*([\d,]+)")
TICKER=re.compile(r"\(([A-Z][A-Z0-9.]{0,6})\)")
def date(v):
    v=" ".join(str(v or "").split())
    if not DATE.fullmatch(v): return None
    try:return dt.datetime.strptime(v,"%m/%d/%Y").date().isoformat()
    except ValueError:return None
def clean(v):return " ".join(str(v or "").split())
def parse_row(cells,record):
    cells=[clean(x) for x in cells]
    if len(cells)<7:return None
    # Official e-filed format: ID, Owner, Asset, Transaction Type, Date, Notification Date, Amount, ...
    owner,asset,kind,when,notified,amount=cells[1:7]
    trade_date=date(when);notice_date=date(notified)
    match=BAND.search(amount)
    if not trade_date or not match or kind not in ("P","S","E") or len(asset)<3:return None
    low,high=[int(x.replace(",","")) for x in match.groups()]
    if low<1 or high<low:return None
    ticker=TICKER.search(asset)
    return {"member":record["member"],"filing_date":record["filing_date"],
            "transaction_date":trade_date,"notification_date":notice_date,
            "owner":owner or None,"asset":asset[:350],"ticker":ticker.group(1) if ticker else None,
            "type":kind,"amount_min_usd":low,"amount_max_usd":high,
            "source_pdf":record["document_url"],"filing_id":record["id"],
            "verification":"machine_parsed_requires_review"}
def extract(raw,record):
    import pdfplumber
    output=[]
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for page_number, page in enumerate(pdf.pages[:12], start=1):
            for table_number, table in enumerate(page.extract_tables() or [], start=1):
                if not table:continue
                header=" ".join(clean(x).lower() for x in table[0])
                if "asset" not in header or "amount" not in header or "transaction" not in header:continue
                for row_number, cells in enumerate(table[1:], start=1):
                    item=parse_row(cells,record)
                    if item:
                        item.update(source_page=page_number, source_table=table_number, source_row=row_number)
                        output.append(item)
    return output
def main():
    if not QUEUE.exists() or QUEUE.stat().st_size==0:
        print("No verified PTR index queue; skipping extraction")
        return
    queue=json.loads(QUEUE.read_text(encoding="utf-8"))
    records=queue.get("records",[])[:MAX_DOCS]
    trades=[];results=[]
    for record in records:
        url=record.get("document_url","")
        if not url.startswith("https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/"):continue
        try:
            request=urllib.request.Request(url,headers={"User-Agent":"MoneyTrackerResearch/1.0"})
            with urllib.request.urlopen(request,timeout=25) as response:
                if int(response.headers.get("Content-Length","0"))>12000000:raise ValueError("oversized PDF")
                raw=response.read(12000001)
            if not raw.startswith(b"%PDF") or len(raw)>12000000:raise ValueError("invalid PDF")
            found=extract(raw,record)
            trades.extend(found)
            results.append({"filing_id":record["id"],"status":"parsed_needs_review" if found else "no_verified_rows","rows":len(found)})
        except Exception as exc:
            results.append({"filing_id":record.get("id"),"status":"error","reason":type(exc).__name__})
    status={"checked_at":dt.datetime.now(dt.timezone.utc).isoformat(),"attempted":len(results),"rows":len(trades),"filings":results,"warning":"Digital text only. All extracted trades require source review. No OCR, no guessed rows."}
    STATUS.write_text(json.dumps(status,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    # Do not replace a previously collected dataset with empty output on outage.
    if trades:
        previous=[]
        if OUT.exists() and OUT.stat().st_size:
            try:previous=json.loads(OUT.read_text(encoding="utf-8")).get("records",[])
            except (ValueError,TypeError):pass
        combined={}
        for row in previous+trades:
            key=(row.get("filing_id"),row.get("source_page"),row.get("source_table"),row.get("source_row"),row.get("owner"),row.get("transaction_date"),row.get("asset"),row.get("type"),row.get("amount_min_usd"),row.get("amount_max_usd"),row.get("notification_date"))
            combined[key]=row
        OUT.parent.mkdir(parents=True,exist_ok=True)
        OUT.write_text(json.dumps({"schema_version":1,"collected_at":status["checked_at"],"source":"Official US House PTR PDF","records":list(combined.values()),"caveat":"Machine-parsed, not independently verified; amount bands are not exact transaction values."},ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print(json.dumps({"attempted":len(results),"rows":len(trades)}))
if __name__=="__main__":main()
