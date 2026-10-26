#!/usr/bin/env python3
"""Collect official FRED CSV observations, without API keys. Do not fabricate missing values."""
import csv, io, json, pathlib, urllib.request, datetime
SERIES={"FEDFUNDS":"Federal funds effective rate","UNRATE":"Unemployment rate","CPIAUCSL":"Consumer price index","INDPRO":"Industrial production","DGS10":"10-year Treasury yield"}
out={"source":"Federal Reserve Bank of St. Louis FRED","source_url":"https://fred.stlouisfed.org/","collected_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"series":{}}
for key,label in SERIES.items():
    try:
        req=urllib.request.Request("https://fred.stlouisfed.org/graph/fredgraph.csv?id="+key,headers={"User-Agent":"MONEY-TRACKER-research/1.0"})
        with urllib.request.urlopen(req,timeout=25) as response:
            rows=list(csv.DictReader(io.StringIO(response.read().decode("utf-8-sig"))))
        points=[]
        for row in rows:
            value=row.get(key,".")
            if value not in ("","."):
                try: points.append({"date":row.get("DATE") or row.get("observation_date"),"value":float(value)})
                except (ValueError,TypeError): pass
        if points: out["series"][key]={"label":label,"points":points[-365:],"latest":points[-1]}
    except Exception as exc:
        print(key,"fetch failed:",str(exc))
path=pathlib.Path("data/us-macro.json")
if not out["series"]:
    raise SystemExit("No observations fetched; existing data preserved")
path.parent.mkdir(parents=True,exist_ok=True)
path.write_text(json.dumps(out,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
print("Saved",len(out["series"]),"series")
