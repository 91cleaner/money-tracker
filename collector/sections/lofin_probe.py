"""지방재정365 hub API 탐색: 필드 이름·건수만 출력. 키는 출력 안 함."""
import os, re, json, urllib.request, urllib.parse
KEY = os.environ["LOFIN_KEY"]
def safe(s): return s.replace(KEY, "***")
for code in ["EVFTCT", "UCMZQA", "UCMZQK", "YCEHF", "GVBDAC"]:
    for yr in ["2024", "2023"]:
        q = urllib.parse.urlencode({"Key": KEY, "Type": "json", "pIndex": 1, "pSize": 3, "accnut_year": yr})
        u = f"https://www.lofin365.go.kr/lf/hub/{code}?{q}"
        try:
            b = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=40).read().decode("utf-8", "replace")
        except Exception as e:
            print(code, yr, "err", safe(str(e))); continue
        try: d = json.loads(b)
        except ValueError: print(code, yr, "non-json", safe(re.sub(r"\s+", " ", b))[:300]); continue
        print(code, yr, "top", list(d) if isinstance(d, dict) else type(d))
        print("  ", safe(json.dumps(d, ensure_ascii=False))[:900])
        break
