"""국회 API 엿보기(수동 실행용): 표결·발의·징계안 관련 API 코드가 무엇을 돌려주는지 필드와 첫 줄만 data/debug/assembly_probe.json 에 남긴다. 키는 남기지 않는다."""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

AK = os.environ.get("ASSEMBLY_KEY", "")
BASE = "https://open.assembly.go.kr/portal/openapi/"
TRY = [
    ("nojepdqqaweusdfbi", {"AGE": "22"}),                     # 본회의 표결정보(의원별)
    ("nzmimeepazxkubdpn", {"AGE": "22"}),                     # 국회의원 발의법률안
    ("TVBPMBILL11", {"AGE": "22"}),                           # 의안정보 통합
    ("nwbpacrgavhjryiph", {"AGE": "22"}),                     # 본회의 처리안건(?)
    ("ncocpgfiaoituanbr", {"AGE": "22"}),                     # 본회의 처리안건 법률안(?)
    ("BILLRCP", {"AGE": "22"}),                               # 의안 접수목록(?)
    ("ALLBILL", {"AGE": "22"}),                               # 의안 통합(?)
    ("nojepdqqaweusdfbi", {"AGE": "22", "BILL_NAME": "결의안"}),
]


def call(code, p):
    q = {"Type": "json", "pIndex": 1, "pSize": 3, **({"KEY": AK} if AK else {}), **p}
    url = BASE + code + "?" + urllib.parse.urlencode(q)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 money-tracker"}), timeout=40) as r:
            d = json.loads(r.read().decode("utf-8", "replace"))
    except Exception as e:
        return {"error": type(e).__name__}
    if code not in d:
        return {"result": d.get("RESULT")}
    head = d[code][0]["head"]
    rows = d[code][1].get("row", []) if len(d[code]) > 1 else []
    return {"total": head[0].get("list_total_count"), "fields": sorted(rows[0].keys()) if rows else [], "first": rows[0] if rows else None}


out = {}
for code, p in TRY:
    out[code + " " + json.dumps(p, ensure_ascii=False)] = call(code, p)
    time.sleep(0.5)
os.makedirs("data/debug", exist_ok=True)
json.dump(out, open("data/debug/assembly_probe.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps({k: (v.get("total"), v.get("result") or v.get("error")) for k, v in out.items()}, ensure_ascii=False, indent=1))
