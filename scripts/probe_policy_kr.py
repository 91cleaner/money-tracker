import os,json,re,urllib.request,urllib.parse,datetime as dt
k=os.environ.get('DATA_GO_KR_KEY','');ek=urllib.parse.quote(k,safe='')
def get(u):
  try:
    r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=30);return r.status,r.read().decode('utf-8','replace')
  except Exception as e: return 'ERR',str(e)[:120]
def red(s): return s.replace(k,'***').replace(ek,'***') if k else s
for i in ['15095335','15074632']:
  s,b=get(f'https://www.data.go.kr/catalog/{i}/openapi.json')
  try:
    d=json.loads(b);print(i,'swagger',d.get('host'),d.get('basePath'),d.get('servers'),list(d.get('paths',{})))
    for p,v in d['paths'].items():
      for m in v.values(): print('  ',p,[x.get('name') for x in m.get('parameters',[])])
  except Exception: pass
  print(i,'urls',sorted(set(re.findall(r'https?://apis[^"\\ <]+',b)))[:6])
e=dt.date.today();st=e-dt.timedelta(days=3);f=lambda x:x.strftime('%Y%m%d')
U={'정책뉴스 policyNewsList':f'https://apis.data.go.kr/1371000/policyNewsService/policyNewsList?serviceKey={ek}&startDate={f(st)}&endDate={f(e)}',
'정책뉴스 v2':f'https://apis.data.go.kr/1371000/policyNewsService/policyNewsList?serviceKey={ek}&startDate={f(e-dt.timedelta(days=1))}&endDate={f(e)}&pageNo=1&numOfRows=5',
'정책뉴스 http':f'http://apis.data.go.kr/1371000/policyNewsService/policyNewsList?serviceKey={ek}&startDate={f(st)}&endDate={f(e)}',
'과기부 msit':f'https://apis.data.go.kr/1721000/msitpressreleaseinfo/pressReleaseList?serviceKey={ek}&numOfRows=5&pageNo=1'}
for n,u in U.items():
  s,b=get(u);code=re.findall(r'<(?:resultCode|returnReasonCode)>([^<]*)',b);print(n,s,'codes',code,'items',len(re.findall(r'<(?:NewsItem|item)>',b)),'total',re.findall(r'<totalCount>(\d+)',b),red(b[:160]).replace('\n',' '))

s,b=get(U['과기부 msit']);it=re.search(r'<item>(.*?)</item>',b,re.S)
if it: print('msit fields',[(t,v[:60]) for t,v in re.findall(r'<(\w+)>([^<]*)</\1>',it.group(1))])
