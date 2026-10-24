"""나라 세금 섹션: 공식 API 접근 확인용(키 값은 출력하지 않음)."""
import json, os, urllib.request, urllib.parse
AK = os.environ.get("ASSEMBLY_KEY", "").strip(); DK = os.environ.get("DATA_GO_KR_KEY", "").strip()
print("ASSEMBLY_KEY 있음" if AK else "ASSEMBLY_KEY 없음", "| DATA_GO_KR_KEY 있음" if DK else "| DATA_GO_KR_KEY 없음")
def get(url, p, tag):
    try:
        with urllib.request.urlopen(url + "?" + urllib.parse.urlencode(p), timeout=30) as r:
            b = r.read().decode("utf-8", "replace")
    except Exception as e:
        b = f"ERR {type(e).__name__} {e}"
    for k in (AK, DK):
        if k: b = b.replace(k, "***").replace(urllib.parse.quote(k), "***")
    print(f"=== {tag}\n{b[:1500]}\n", flush=True); return b
os.makedirs("/tmp/probe", exist_ok=True)
for key, tag in ((AK, "AK"), (DK, "DK"), ("", "nokey")):
    b = get("https://open.assembly.go.kr/portal/openapi/OPENSRVAPI", {"Type": "json", "pSize": 1000, **({"KEY": key} if key else {})}, f"catalog {tag}")
    open(f"/tmp/probe/cat_{tag}.json", "w").write(b)
for op in ("getPartyInfoList",):
    get("http://apis.data.go.kr/9760000/PartyInfoInqireService/" + op, {"serviceKey": DK, "resultType": "json", "numOfRows": 3}, "nec party DK")
get("http://apis.data.go.kr/9710000/NationalAssemblyInfoService/getMemberCurrStateList", {"serviceKey": DK, "numOfRows": 3}, "na member DK")
