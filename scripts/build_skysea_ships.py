"""Vessel presence around Korea, the Yellow Sea and the East China Sea from Global Fishing Watch (4Wings, public-global-presence).
Server side only: the token comes from the GFW_TOKEN secret and is never written anywhere. GFW data arrives a few days late (AIS processing),
so this keeps the newest day that has data. Output is a grid (0.5 degree cells) by flag state, not live ship positions."""
import json, os, sys, datetime, pathlib, urllib.request, urllib.parse

TOKEN = os.environ.get('GFW_TOKEN', '').strip()
if not TOKEN:
    raise SystemExit('GFW_TOKEN missing; keeping previous snapshot')
POLY = {"type": "Polygon", "coordinates": [[[117, 21.5], [133.5, 21.5], [133.5, 42.5], [117, 42.5], [117, 21.5]]]}
FLAG = {'CHN': 'CN', 'KOR': 'KR', 'JPN': 'JP', 'PRK': 'KP', 'TWN': 'TW', 'RUS': 'RU', 'USA': 'US'}
DS = 'public-global-presence:latest'

def report(start, end, agg):
    q = urllib.parse.urlencode({'spatial-resolution': 'LOW', 'temporal-resolution': 'ENTIRE', 'group-by': 'FLAG', 'datasets[0]': DS,
                                'date-range': f'{start},{end}', 'format': 'JSON', 'spatial-aggregation': 'true' if agg else 'false'})
    req = urllib.request.Request('https://gateway.api.globalfishingwatch.org/v3/4wings/report?' + q, data=json.dumps({'geojson': POLY}).encode(),
                                 headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json',
                                          'User-Agent': 'money-tracker-skysea/1.0 (github.com/91cleaner/money-tracker)'})
    with urllib.request.urlopen(req, timeout=180) as r:
        e = (json.load(r).get('entries') or [{}])[0]
    return next(iter(e.values()), None) if e else None

today = datetime.date.today()
for lag in range(2, 10):
    end = today - datetime.timedelta(days=lag); start = end - datetime.timedelta(days=1)
    try:
        tot = report(start, end, True)
    except Exception as ex:
        print('request failed', type(ex).__name__); tot = None
    if tot:
        break
else:
    raise SystemExit('no recent GFW data; keeping previous snapshot')
cells = report(start, end, False) or []
counts = {}
for r in tot:
    k = FLAG.get(r.get('flag') or '', 'XX'); counts[k] = counts.get(k, 0) + int(r.get('vesselIDs') or 0)
grid = {}
for r in cells:
    k = FLAG.get(r.get('flag') or '', 'XX'); la = round(int(r['lat'] * 2) / 2 + .25, 2); lo = round(int(r['lon'] * 2) / 2 + .25, 2)
    key = (la, lo, k); grid[key] = grid.get(key, 0) + int(r.get('vesselIDs') or 0)
out = {
    'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'date_range': [str(start), str(end)], 'source': 'Global Fishing Watch', 'dataset': DS, 'source_url': 'https://globalfishingwatch.org/',
    'note': 'AIS vessel presence, 0.5 degree cells by flag state; counts are vessels seen in the box that day',
    'fields': ['lat', 'lon', 'cc', 'vessels'], 'counts': counts,
    'cells': sorted([[a, b, c, n] for (a, b, c), n in grid.items()]),
}
p = pathlib.Path('data/skysea/ships.json'); p.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print('ships', out['date_range'], counts, 'cells', len(out['cells']))
