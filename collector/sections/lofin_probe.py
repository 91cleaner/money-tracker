"""지방재정365 탐색: data.go.kr 상세 페이지에서 lofin 주소(pdtaId)를 찾고 키로 호출해 필드 이름·건수만 출력. 키는 절대 출력하지 않음."""
import os, re, json, urllib.request, urllib.parse
KEY = os.environ.get("LOFIN_KEY", "")
def get(u, t=40):
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=t) as r: return r.read().decode("utf-8", "replace")
def safe(s): return s.replace(KEY, "***") if KEY else s
ids = {}
for dn in ["15056968", "15138715", "15138721", "15057384"]:
    try:
        h = get(f"https://www.data.go.kr/data/{dn}/openapi.do")
        found = sorted(set(re.findall(r"(?:pdtaId|infId)=([A-Z0-9]{20,40})", h)))
        print(dn, "ids:", found); ids[dn] = found
    except Exception as e: print(dn, "page err", e)
for dn, fl in ids.items():
    for pid in fl:
        for base in ["https://www.lofin365.go.kr/portal/LF5110000.do"]:
            q = urllib.parse.urlencode({"pdtaId": pid, "key": KEY, "type": "json", "pindex": 1, "psize": 5})
            try:
                b = get(base + "?" + q)
                try:
                    d = json.loads(b)
                    def walk(o, p=""):
                        if isinstance(o, dict):
                            for k, v in o.items():
                                if isinstance(v, (dict, list)): walk(v, p + k + ".")
                                elif k.lower() in ("list_total_count", "code", "message", "result", "totalcount"): print("   ", p + k, "=", safe(str(v))[:120])
                            if all(not isinstance(v, (dict, list)) for v in o.values()) and len(o) > 4: print("    row keys:", list(o)); print("    sample:", safe(json.dumps(o, ensure_ascii=False))[:400])
                        elif isinstance(o, list) and o: walk(o[0], p + "[0].")
                    print(dn, pid, "json ok"); walk(d)
                except ValueError: print(dn, pid, "non-json:", safe(re.sub(r"\s+", " ", b))[:300])
            except Exception as e: print(dn, pid, "err", safe(str(e)))
