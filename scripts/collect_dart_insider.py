"""DART 임원·주요주주 특정증권등 소유상황보고 (OpenDART elestock) for Korean tickers in world-intelligence/dossier.json.
Writes world-intelligence/kr-insiders.json. Key from env DART_API_KEY (never printed)."""
import io, json, os, sys, urllib.request, zipfile, xml.etree.ElementTree as ET
from datetime import date, timedelta
K = os.environ['DART_API_KEY']
def get(u):
    with urllib.request.urlopen(u, timeout=60) as r: return r.read()
z = zipfile.ZipFile(io.BytesIO(get(f'https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key={K}')))
root = ET.fromstring(z.read(z.namelist()[0]))
cc = {e.findtext('stock_code').strip(): e.findtext('corp_code') for e in root.iter('list') if (e.findtext('stock_code') or '').strip()}
syms = [s for s in json.load(open('world-intelligence/dossier.json'))['tickers'] if s.endswith('.KS')]
since = (date.today() - timedelta(days=180)).strftime('%Y%m%d')
num = lambda v: int(str(v).replace(',', '').replace('-', '0') or 0) if str(v).replace(',', '').lstrip('-').isdigit() else None
out = {'note': 'DART 임원·주요주주 특정증권등 소유상황보고(OpenDART elestock). 접수일 기준 최근 180일. 증감 = 보고 주식수 변동. 가격·금액은 보고서 원문 확인.', 'updated': date.today().isoformat(), 'tickers': {}}
for s in syms:
    c = cc.get(s.split('.')[0])
    if not c: continue
    j = json.loads(get(f'https://opendart.fss.or.kr/api/elestock.json?crtfc_key={K}&corp_code={c}'))
    rows = []
    for i in j.get('list', []):
        if i.get('rcept_dt', '').replace('-', '') < since: continue
        ch = str(i.get('sp_stock_lmp_irds_cnt', '0')).replace(',', '')
        try: ch = int(ch)
        except ValueError: ch = 0
        hold = str(i.get('sp_stock_lmp_cnt', '0')).replace(',', '')
        rows.append({'who': i.get('repror'), 'role': i.get('isu_exctv_ofcps') or i.get('isu_main_shrholdr') or '',
                     'date': i.get('rcept_dt'), 'chg': ch, 'held': int(hold) if hold.isdigit() else None,
                     'rate': i.get('sp_stock_lmp_rate'), 'url': 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=' + i.get('rcept_no', '')})
    rows.sort(key=lambda r: r['date'], reverse=True)
    out['tickers'][s] = {'corp_code': c, 'rows': rows[:40]}
    print(s, j.get('status'), len(rows))
json.dump(out, open('world-intelligence/kr-insiders.json', 'w'), ensure_ascii=False, separators=(',', ':'))
