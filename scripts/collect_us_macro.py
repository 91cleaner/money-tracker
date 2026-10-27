#!/usr/bin/env python3
"""Collect official FRED CSV observations, without API keys. Do not fabricate missing values."""
import csv, io, json, pathlib, urllib.request, datetime
SERIES={"FEDFUNDS":"Federal funds effective rate","UNRATE":"Unemployment rate","CPIAUCSL":"Consumer price index","INDPRO":"Industrial production","DGS10":"10-year Treasury yield"}
out={"source":"Federal Reserve Bank of St. Louis FRED","source_url":"https://fred.stlouisfed.org/","collected_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"series":{}}
import os, urllib.error, urllib.parse
API_KEY=os.environ.get("FRED_API_KEY","").strip()  # optional free key from fred.stlouisfed.org (GitHub Secret FRED_API_KEY)
def reason(exc):
    return "HTTP %s"%exc.code if isinstance(exc,urllib.error.HTTPError) else type(exc).__name__+": "+str(exc)[:80]
def from_csv(key):
    req=urllib.request.Request("https://fred.stlouisfed.org/graph/fredgraph.csv?id="+key,headers={"User-Agent":"Mozilla/5.0 (MONEY-TRACKER research; +https://91cleaner.github.io/money-tracker/)","Accept":"text/csv,*/*"})
    with urllib.request.urlopen(req,timeout=25) as response:
        rows=list(csv.DictReader(io.StringIO(response.read().decode("utf-8-sig"))))
    return [(row.get("DATE") or row.get("observation_date"),row.get(key,".")) for row in rows]
def from_api(key):
    q=urllib.parse.urlencode({"series_id":key,"api_key":API_KEY,"file_type":"json","sort_order":"desc","limit":"400"})
    with urllib.request.urlopen(urllib.request.Request("https://api.stlouisfed.org/fred/series/observations?"+q,headers={"User-Agent":"MONEY-TRACKER-research/1.0"}),timeout=25) as response:
        obs=json.loads(response.read().decode("utf-8")).get("observations",[])
    return [(o.get("date"),o.get("value",".")) for o in reversed(obs)]
failures=[]
for key,label in SERIES.items():
    rows=None
    for name,fn in (("csv",from_csv),)+((("api",from_api),) if API_KEY else ()):
        try:
            rows=fn(key); break
        except Exception as exc:
            failures.append(f"{key} {name}: {reason(exc)}")  # never print the key itself
    if not rows: continue
    points=[]
    for date,value in rows:
        if value not in ("",".",None):
            try: points.append({"date":date,"value":float(value)})
            except (ValueError,TypeError): pass
    if points: out["series"][key]={"label":label,"points":points[-365:],"latest":points[-1]}
for line in failures:
    print("::warning::FRED fetch failed - "+line)
if failures and not API_KEY:
    print("::warning::FRED CSV is often blocked from cloud runners; add a free FRED_API_KEY GitHub Secret to use the official API instead.")
path=pathlib.Path("data/us-macro.json")
if not out["series"]:
    raise SystemExit("No observations fetched; existing data preserved")
path.parent.mkdir(parents=True,exist_ok=True)
path.write_text(json.dumps(out,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
print("Saved",len(out["series"]),"series")
