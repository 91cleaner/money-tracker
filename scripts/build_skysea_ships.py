"""World vessel presence from Global Fishing Watch (4Wings, public-global-presence).
Server side only: the token comes from the GFW_TOKEN secret and is never written anywhere. GFW data arrives a few days late (AIS processing),
so this keeps the newest day that has data. Output is a grid (2 degree cells) by flag state, not live ship positions."""
import json, math, os, sys, datetime, pathlib, urllib.request, urllib.parse

TOKEN = os.environ.get('GFW_TOKEN', '').strip()
if not TOKEN:
    raise SystemExit('GFW_TOKEN missing; keeping previous snapshot')
def box(a, b, c, d):
    return {"type": "Polygon", "coordinates": [[[b, a], [d, a], [d, c], [b, c], [b, a]]]}
TILES = [box(la, lo, la + 40, lo + 60) for la in range(-80, 80, 40) for lo in range(-180, 180, 60)]
CELL = 2.0
FLAG = {'CHN': 'CN', 'KOR': 'KR', 'JPN': 'JP', 'PRK': 'KP', 'TWN': 'TW', 'RUS': 'RU', 'USA': 'US', 'PAN': 'PA', 'LBR': 'LR', 'MHL': 'MH',
        'HKG': 'HK', 'SGP': 'SG', 'MLT': 'MT', 'BHS': 'BS', 'GRC': 'GR', 'NOR': 'NO', 'GBR': 'GB', 'IDN': 'ID', 'ESP': 'ES', 'ITA': 'IT', 'VNM': 'VN', 'IND': 'IN', 'TUR': 'TR'}
DS = 'public-global-presence:latest'

def report(start, end, agg, poly):
    q = urllib.parse.urlencode({'spatial-resolution': 'LOW', 'temporal-resolution': 'ENTIRE', 'group-by': 'FLAG', 'datasets[0]': DS,
                                'date-range': f'{start},{end}', 'format': 'JSON', 'spatial-aggregation': 'true' if agg else 'false'})
    req = urllib.request.Request('https://gateway.api.globalfishingwatch.org/v3/4wings/report?' + q, data=json.dumps({'geojson': poly}).encode(),
                                 headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json',
                                          'User-Agent': 'money-tracker-skysea/1.0 (github.com/91cleaner/money-tracker)'})
    with urllib.request.urlopen(req, timeout=180) as r:
        e = (json.load(r).get('entries') or [{}])[0]
    return next(iter(e.values()), None) if e else None

today = datetime.date.today()
for lag in range(2, 10):
    end = today - datetime.timedelta(days=lag); start = end - datetime.timedelta(days=1)
    try:
        probe = report(start, end, True, TILES[13])
    except Exception as ex:
        print('request failed', type(ex).__name__); probe = None
    if probe:
        break
else:
    raise SystemExit('no recent GFW data; keeping previous snapshot')
counts, grid, ok = {}, {}, 0
for t in TILES:
    try:
        tot = report(start, end, True, t) or []
        cells = report(start, end, False, t) or []
    except Exception as ex:
        print('tile failed', type(ex).__name__); continue
    ok += 1
    for r in tot:
        k = FLAG.get(r.get('flag') or '', 'XX'); counts[k] = counts.get(k, 0) + int(r.get('vesselIDs') or 0)
    for r in cells:
        k = FLAG.get(r.get('flag') or '', 'XX')
        la = math.floor(r['lat'] / CELL) * CELL + CELL / 2; lo = math.floor(r['lon'] / CELL) * CELL + CELL / 2
        key = (la, lo, k); grid[key] = grid.get(key, 0) + int(r.get('vesselIDs') or 0)
if ok < len(TILES) * .7:
    raise SystemExit(f'only {ok}/{len(TILES)} tiles; keeping previous snapshot')
out = {
    'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'date_range': [str(start), str(end)], 'source': 'Global Fishing Watch', 'dataset': DS, 'source_url': 'https://globalfishingwatch.org/',
    'note': 'AIS vessel presence, 2 degree cells by flag state; counts add up vessels seen in each of 24 world tiles that day', 'cell_deg': CELL,
    'fields': ['lat', 'lon', 'cc', 'vessels'], 'counts': counts,
    'cells': sorted([[a, b, c, n] for (a, b, c), n in grid.items()]),
}
p = pathlib.Path('data/skysea/ships.json'); p.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print('ships', out['date_range'], counts, 'cells', len(out['cells']))
