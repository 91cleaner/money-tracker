#!/usr/bin/env python3
"""정당별 돈 추적 지도 자료 만들기. 입력: 작업 폴더의 map_combined.geojson (공개 규칙 적용본).
개인 수령자 행은 지도 자료에 넣지 않는다(건수만). nt2023·nt*_public CSV는 쓰지 않는다."""
import json, sys, collections, math
clean = lambda v: None if isinstance(v, float) and math.isnan(v) else v
from pathlib import Path
src = Path(sys.argv[1] if len(sys.argv) > 1 else '/workspace/party_money')
out = Path(__file__).resolve().parents[1] / 'data' / 'party'
out.mkdir(parents=True, exist_ok=True)
g = json.load(open(src / 'map_combined.geojson'))
import csv
mask_csv = Path(sys.argv[2] if len(sys.argv) > 2 else '/workspace/agent-tools/indiv_biz_like_names.csv')
MASK = {(r['party_as_of_registration'], int(r['row'])) for r in csv.DictReader(open(mask_csv))} if mask_csv.exists() else set()
masked = 0
# 팩트체크 비서 확인값(2026-10-30). 지급 당시 정당명 기준. 위성정당 몫은 회계보고 PDF 합계에 포함.
EXTRA = {'국민의힘': {'with': [['국민의미래', 2804433130]], 'total_pdf': 41152151070, 'pdf': '2024 회계보고 PDF 648쪽'},
         '더불어민주당': {'with': [['더불어민주연합', 2827091700]], 'total_pdf': 43810007470, 'pdf': '2024 회계보고 PDF 647쪽'},
         '개혁신당': {'with': [], 'total_pdf': 3491858180, 'pdf': '2024 회계보고 PDF 650쪽', 'unverified': True}}
mp = json.load(open(src / 'map_by_party.json'))
P = collections.defaultdict(lambda: {'pts': [], 'sub': [], 'nonseat': []})
for f in g['features']:
    p, geo, L = f['properties'], f['geometry'], f['properties']['layer']
    d = P[p['party']]
    if L == 'expense':
        if p.get('payee_type') not in ('법인', '개인사업자'):
            continue  # 개인은 넣지 않음
        lon, lat = geo['coordinates']
        loc = p.get('location') or ''
        if p['payee_type'] == '개인사업자':
            loc = ' '.join(loc.split()[:3])  # 시군구까지만
        if any((p['party'], int(r)) in MASK for r in (p.get('source_rows') or [])):
            p = dict(p, payee='개인사업자(시군구)'); masked += 1
        mem = sorted({m['name'] for m in p.get('members', [])})
        d['pts'].append([round(lat, 5), round(lon, 5), clean(p.get('payee')), p['payee_type'], loc, p.get('amount_krw'), p.get('n'),
                         1 if p.get('approximate') else 0, 1 if p.get('ocr_possible_error') else 0, mem])
    elif L == 'subsidy':
        d['sub'].append({'type': p.get('payment_type'), 'krw': p.get('amount_krw'), 'year': p.get('year'),
                         'line': [[c[1], c[0]] for c in geo['coordinates']] if geo else None})
    elif L == 'transfer_to_nonseat':
        m = p.get('member') or {}
        d['nonseat'].append({'member': m.get('name'), 'to': p.get('recipient_party'), 'krw': p.get('amount_krw'),
                             'date': p.get('date'), 'raw': p.get('내역_raw'), 'row': p.get('source_row'),
                             'note': '당시 소속: ' + (m.get('party_as_of_registration') or '') if m.get('name') == '홍영표' else None})
index = {'generated': mp['meta'].get('generated'), 'status': '팩트체크 확인(2026-10-30), 개혁신당 보조금만 미확인', 'parties': []}
order = sorted(P, key=lambda n: -(mp['parties'].get(n, {}).get('counts', {}).get('expense_rows') or 0))
for k, name in enumerate(order):  # 정렬한 뒤 파일 번호를 붙인다
    d = P[name]
    c = mp['parties'].get(name, {}).get('counts', {})
    keep = {k2: c.get(k2) for k2 in ('members', 'expense_rows', '법인', '개인사업자', '개인', 'map_points', 'transfers_nonseat', 'subsidy_2024_krw')}
    index['parties'].append({'name': name, 'counts': keep, 'points': len(d['pts']), 'subsidy_extra': EXTRA.get(name),
                             'subsidy': d['sub'], 'nonseat': d['nonseat'], 'file': 'pts-%d.json' % k})
    json.dump(d['pts'], open(out / ('pts-%d.json' % k), 'w'), ensure_ascii=False, separators=(',', ':'), allow_nan=False)
json.dump(index, open(out / 'index.json', 'w'), ensure_ascii=False, separators=(',', ':'), allow_nan=False)
print('masked', masked, sum(x['points'] for x in index['parties']), sum(len(x['nonseat']) for x in index['parties']))
