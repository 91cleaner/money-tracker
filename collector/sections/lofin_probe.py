"""EVFTCT/GVBDAC 필수 인자 찾기. 키 출력 안 함."""
import os, re, json, urllib.request, urllib.parse
KEY = os.environ["LOFIN_KEY"]
def safe(s): return s.replace(KEY, "***")
combos = [{"fyr": "2023"}, {"accnut_year": "2023"}, {"fyr": "2023", "laf_cd": "1100000"}, {"fyr": "2023", "wa_laf_cd": "1100000"},
          {"accnut_year": "2023", "wdr_sfrnd_code": "1100000"}, {"fyr": "2023", "laf_cd": "4111000"}, {"exe_ym": "202312"}]
for code in ["EVFTCT", "GVBDAC"]:
    for c in combos:
        q = urllib.parse.urlencode({"Key": KEY, "Type": "json", "pIndex": 1, "pSize": 2, **c})
        b = urllib.request.urlopen(urllib.request.Request(f"https://www.lofin365.go.kr/lf/hub/{code}?{q}", headers={"User-Agent": "Mozilla/5.0"}), timeout=40).read().decode("utf-8", "replace")
        print(code, c, safe(b)[:700].replace("\n", " "))
        if "INFO-000" in b: break
