"""Snapshot of live aircraft around Korea, the Yellow Sea and the East China Sea from the free adsb.lol API.
adsb.lol does not send CORS headers, so the page reads this snapshot instead of calling the API from the browser.
Stdlib only, no keys."""
import json, time, urllib.request, datetime, pathlib

POINTS = [(37.5, 127.5), (33.0, 124.0), (28.5, 123.0), (24.0, 121.0), (40.5, 131.0)]
BOX = (20.0, 44.0, 115.0, 136.0)  # lat min/max, lon min/max
# ICAO 24-bit address blocks (ICAO Annex 10 allocation)
RANGES = [
    (0x718000, 0x71FFFF, 'KR'), (0x720000, 0x727FFF, 'KP'), (0x780000, 0x7BFFFF, 'CN'),
    (0x840000, 0x87FFFF, 'JP'), (0x899000, 0x8993FF, 'TW'), (0x100000, 0x1FFFFF, 'RU'),
    (0xA00000, 0xAFFFFF, 'US'),
]

def cc(hexid):
    try:
        v = int(hexid, 16)
    except ValueError:
        return 'XX'
    for a, b, c in RANGES:
        if a <= v <= b:
            return c
    return 'XX'

def get(lat, lon):
    req = urllib.request.Request(f'https://api.adsb.lol/v2/point/{lat}/{lon}/250', headers={'User-Agent': 'money-tracker-skysea/1.0 (github.com/91cleaner/money-tracker)'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r).get('ac') or []

seen, ok = {}, 0
for lat, lon in POINTS:
    try:
        for a in get(lat, lon):
            h = (a.get('hex') or '').lower()
            if not h or a.get('lat') is None or a.get('lon') is None:
                continue
            if not (BOX[0] <= a['lat'] <= BOX[1] and BOX[2] <= a['lon'] <= BOX[3]):
                continue
            alt = a.get('alt_baro')
            seen[h] = [h, (a.get('flight') or '').strip(), (a.get('r') or '').strip(), (a.get('t') or '').strip(),
                       round(a['lat'], 4), round(a['lon'], 4), round(a.get('track') or a.get('true_heading') or 0),
                       alt if isinstance(alt, (int, float)) else (0 if alt == 'ground' else None),
                       round(a['gs']) if isinstance(a.get('gs'), (int, float)) else None,
                       'XX' if h.startswith('~') else cc(h)]
        ok += 1
    except Exception as e:
        print('point failed', lat, lon, type(e).__name__)
    time.sleep(1.5)

if ok == 0:
    raise SystemExit('all requests failed; keeping previous snapshot')
counts = {}
for v in seen.values():
    counts[v[-1]] = counts.get(v[-1], 0) + 1
out = {
    'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'source': 'adsb.lol (ODbL)', 'source_url': 'https://www.adsb.lol/', 'box': BOX,
    'fields': ['hex', 'flight', 'reg', 'type', 'lat', 'lon', 'track', 'alt_ft', 'gs_kt', 'cc'],
    'counts': counts, 'count': len(seen), 'ac': sorted(seen.values()),
}
p = pathlib.Path('data/skysea/aircraft.json'); p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print('aircraft', len(seen), counts)
