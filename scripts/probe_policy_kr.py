#!/usr/bin/env python3
"""한국 정책·의안 API 접근 확인. 키는 절대 출력하지 않음: HTTP 상태, resultCode/메시지, 항목 수만."""
import os, re, urllib.request, urllib.parse, datetime as dt
K = os.environ.get("DATA_GO_KR_KEY", "").strip(); ek = urllib.parse.quote(K, safe="")
e = dt.date.today(); s = e - dt.timedelta(days=7); f = lambda d: d.strftime("%Y%m%d")
P = {
 "정책브리핑 보도자료(1371000/pressReleaseService)": f"https://apis.data.go.kr/1371000/pressReleaseService/pressReleaseList?serviceKey={ek}&startDate={f(s)}&endDate={f(e)}",
 "정책브리핑 정책뉴스(1371000/policyNewsService)": f"https://apis.data.go.kr/1371000/policyNewsService/policyNewsList?serviceKey={ek}&startDate={f(s)}&endDate={f(e)}",
 "국회사무처 의안정보 getBillInfoList(9710000/BillInfoService2)": f"https://apis.data.go.kr/9710000/BillInfoService2/getBillInfoList?serviceKey={ek}&numOfRows=5&pageNo=1&ord=A01&start_ord=22&end_ord=22",
 "국회사무처 의안정보 getRecentRceptList(9710000/BillInfoService2)": f"https://apis.data.go.kr/9710000/BillInfoService2/getRecentRceptList?serviceKey={ek}&numOfRows=5&pageNo=1",
 "열린국회정보 의원발의법률안(nzmimeepazxkubdpn, 키없음)": "https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn?Type=json&pIndex=1&pSize=5&AGE=22",
 "열린국회정보 법률안 전체(TVBPMBILL11, 키없음)": "https://open.assembly.go.kr/portal/openapi/TVBPMBILL11?Type=json&pIndex=1&pSize=5",
}
for name, u in P.items():
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=40); st = r.status; b = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as x: st = x.code; b = x.read().decode("utf-8", "replace")
    except Exception as x: print(f"[{name}] ERR {type(x).__name__}"); continue
    if K: b = b.replace(K, "***").replace(ek, "***")
    code = re.findall(r"<(?:resultCode|returnReasonCode|CODE)>([^<]+)<|\"CODE\"\s*:\s*\"([^\"]+)\"", b)[:1]
    msg = re.findall(r"<(?:resultMsg|returnAuthMsg|MESSAGE)>([^<]+)<|\"MESSAGE\"\s*:\s*\"([^\"]+)\"", b)[:1]
    n = len(re.findall(r"<item>|<NewsItem>|\"BILL_ID\"|\"BILL_NO\"", b)); tot = re.findall(r"<totalCount>(\d+)<|\"list_total_count\"\s*:\s*(\d+)", b)[:1]
    print(f"[{name}] HTTP {st} code={code} msg={msg} items={n} total={tot} head={b[:160]!r}")
