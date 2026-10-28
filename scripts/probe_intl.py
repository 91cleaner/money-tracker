import urllib.request,sys
U={'meti_atom':'https://www.meti.go.jp/ml_index_release_atom.xml','meti_rss':'https://www.meti.go.jp/rss/index.rdf','jpx_xls':'https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls',
'eu_sparql':'https://publications.europa.eu/webapi/rdf/sparql?query=ASK%7B%3Fs%20%3Fp%20%3Fo%7D','eu_press_rss':'https://ec.europa.eu/commission/presscorner/api/rss?language=en','eu_press_api':'https://ec.europa.eu/commission/presscorner/api/search?language=en&pagesize=5',
'gacc':'http://www.customs.gov.cn/customs/302249/302266/index.html','gacc_s':'https://www.customs.gov.cn/customs/302249/302266/index.html','moea':'https://www.moea.gov.tw/MNS/populace/news/News.aspx?kind=1&menu_id=40','moea_rss':'https://www.moea.gov.tw/Mns/populace/news/NewsRSS.aspx?Kind=1'}
for k,u in U.items():
  try:
    r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0 money-tracker'}),timeout=25);b=r.read();print(k,r.status,len(b),r.headers.get('content-type'),b[:120])
  except Exception as e: print(k,'ERR',str(e)[:100])
