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
import tempfile
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


def write_json_atomic(path, payload, *, compact=False):
    """Publish complete JSON, keeping the previous snapshot if writing fails."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            if compact:
                json.dump(payload, stream, ensure_ascii=False, separators=(",", ":"))
            else:
                json.dump(payload, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
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
def select_records(records, previous_status, limit):
    """Advance through the review queue instead of re-reading its first PDFs forever.

    Keep the cursor in the committed status file, so scheduled Actions runs
    resume where the previous run stopped. Wrap after reaching the queue end.
    """
    if not isinstance(records, list):
        raise ValueError("Invalid PTR queue records")
    valid = [row for row in records if isinstance(row, dict) and row.get("id")]
    if not valid:
        return []
    last_id = previous_status.get("last_attempted_filing_id")
    if not last_id:
        prior = previous_status.get("filings", [])
        if isinstance(prior, list) and prior:
            last_id = prior[-1].get("filing_id") if isinstance(prior[-1], dict) else None
    start = 0
    for index, row in enumerate(valid):
        if row["id"] == last_id:
            start = (index + 1) % len(valid)
            break
    return [valid[(start + i) % len(valid)] for i in range(min(limit, len(valid)))]


def main():
    if not QUEUE.exists() or QUEUE.stat().st_size==0:
        print("No verified PTR index queue; skipping extraction")
        return
    queue=json.loads(QUEUE.read_text(encoding="utf-8"))
    previous_status={}
    if STATUS.exists() and STATUS.stat().st_size:
        try:
            previous_status=json.loads(STATUS.read_text(encoding="utf-8"))
            if not isinstance(previous_status,dict):previous_status={}
        except (OSError,ValueError,TypeError):previous_status={}
    records=select_records(queue.get("records",[]),previous_status,MAX_DOCS)
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
    status={"checked_at":dt.datetime.now(dt.timezone.utc).isoformat(),"attempted":len(results),"rows":len(trades),"filings":results,"last_attempted_filing_id":records[-1]["id"] if records else previous_status.get("last_attempted_filing_id"),"warning":"Digital text only. All extracted trades require source review. No OCR, no guessed rows."}
    # Save candidates before advancing the cursor; failed writes must be retried.
    # Do not replace a previously collected dataset with empty output on outage.
    if trades:
        previous=[]
        if OUT.exists() and OUT.stat().st_size:
            existing=json.loads(OUT.read_text(encoding="utf-8"))
            if not isinstance(existing,dict) or not isinstance(existing.get("records"),list):
                raise ValueError("Invalid existing PTR candidates; refusing to overwrite")
            previous=existing["records"]
        combined={}
        for row in previous+trades:
            key=(row.get("filing_id"),row.get("source_page"),row.get("source_table"),row.get("source_row"),row.get("owner"),row.get("transaction_date"),row.get("asset"),row.get("type"),row.get("amount_min_usd"),row.get("amount_max_usd"),row.get("notification_date"))
            combined[key]=row
        write_json_atomic(OUT, {"schema_version":1,"collected_at":status["checked_at"],"source":"Official US House PTR PDF","records":list(combined.values()),"caveat":"Machine-parsed, not independently verified; amount bands are not exact transaction values."}, compact=True)
    write_json_atomic(STATUS, status)
    print(json.dumps({"attempted":len(results),"rows":len(trades)}))
if __name__=="__main__":main()
