"""World aircraft snapshot from the free adsb.lol API (no key). adsb.lol has no free whole-world feed and blocks
browser calls (no CORS), so this asks its 250 nm 'point' endpoint over a grid that covers the busy air regions
of the world (not every ocean). Stdlib only."""
import json, math, time, urllib.request, datetime, pathlib, concurrent.futures as cf

REGIONS = [  # lat min, lon min, lat max, lon max
    (15, -130, 62, -52), (35, -12, 64, 42), (12, 28, 42, 62), (5, 64, 36, 92), (18, 96, 46, 146),
    (-11, 94, 18, 128), (-42, 112, -10, 156), (-36, 172, -34, 178), (-35, -76, 6, -34), (-35, 14, -18, 34),
    (-6, 28, 12, 46), (4, -18, 37, 12), (45, -52, 60, -12), (18, -160, 22, -154), (42, 42, 58, 90), (55, 90, 64, 140),
]
def points():
    pts = set()
    for la in range(-40, 66, 7):
        step = 7 / max(.35, math.cos(math.radians(la)))
        lo = -180.0
        while lo < 180:
            if any(a - 3 <= la <= c + 3 and b - 3 <= lo <= d + 3 for a, b, c, d in REGIONS):
                pts.add((la, round(lo, 1)))
            lo += step
    return sorted(pts)

# ICAO 24-bit address blocks (ICAO Annex 10)
RANGES = [(0xA00000, 0xAFFFFF, 'US'), (0x780000, 0x7BFFFF, 'CN'), (0x718000, 0x71FFFF, 'KR'), (0x720000, 0x727FFF, 'KP'),
          (0x840000, 0x87FFFF, 'JP'), (0x899000, 0x8993FF, 'TW'), (0x100000, 0x1FFFFF, 'RU'), (0x400000, 0x43FFFF, 'GB'),
          (0x3C0000, 0x3FFFFF, 'DE'), (0x380000, 0x3BFFFF, 'FR'), (0x800000, 0x83FFFF, 'IN'), (0xC00000, 0xC3FFFF, 'CA'),
          (0x7C0000, 0x7FFFFF, 'AU'), (0x4B8000, 0x4BFFFF, 'TR'), (0x896000, 0x896FFF, 'AE'), (0x300000, 0x33FFFF, 'IT'),
          (0x340000, 0x37FFFF, 'ES'), (0xE40000, 0xE7FFFF, 'BR'), (0x0D0000, 0x0D7FFF, 'MX'), (0x710000, 0x717FFF, 'SA')]
def cc(h):
    try: v = int(h, 16)
    except ValueError: return 'XX'
    for a, b, c in RANGES:
        if a <= v <= b: return c
    return 'XX'

DEADLINE = time.time() + 400
def get(p):
    la, lo = p
    for t in range(2):
        if time.time() > DEADLINE: return None
        try:
            req = urllib.request.Request(f'https://api.adsb.lol/v2/point/{la}/{lo}/250', headers={'User-Agent': 'money-tracker-skysea/1.0 (github.com/91cleaner/money-tracker)'})
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.load(r).get('ac') or []
        except Exception:
            time.sleep(1 + t)
    return None

P = points(); seen = {}; ok = 0; gps = {}
with cf.ThreadPoolExecutor(2) as ex:
    for res in ex.map(get, P):
        if res is None: continue
        ok += 1
        for a in res:
            h = (a.get('hex') or '').lower()
            if not h or a.get('lat') is None or a.get('lon') is None: continue
            alt = a.get('alt_baro'); alt = alt if isinstance(alt, (int, float)) else (0 if alt == 'ground' else None)
            if alt == 0: continue  # keep flying aircraft only, keeps the file small
            nacp, nic = a.get('nac_p'), a.get('nic')
            if isinstance(nacp, int) or isinstance(nic, int):
                g = gps.setdefault((int(a['lat'] // 1), int(a['lon'] // 1), h), 0)
                gps[(int(a['lat'] // 1), int(a['lon'] // 1), h)] = 1 if ((isinstance(nacp, int) and nacp < 8) or (isinstance(nic, int) and nic < 7)) else 0
            seen[h] = [h, (a.get('flight') or '').strip(), (a.get('t') or '').strip(), round(a['lat'], 2), round(a['lon'], 2),
                       round(a.get('track') or a.get('true_heading') or 0), alt,
                       round(a['gs']) if isinstance(a.get('gs'), (int, float)) else None, 'XX' if h.startswith('~') else cc(h), 1 if (a.get('dbFlags') or 0) & 1 else 0]
if ok < len(P) * .5:
    raise SystemExit(f'only {ok}/{len(P)} requests worked; keeping previous snapshot')
counts = {}
gc = {}
for (la, lo, _), bad in gps.items():
    c = gc.setdefault((la, lo), [la + .5, lo + .5, 0, 0]); c[2] += 1; c[3] += bad
gc = [c for c in gc.values() if c[2] >= 3]
for v in seen.values(): counts[v[8]] = counts.get(v[8], 0) + 1
out = {'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'source': 'adsb.lol (ODbL)',
       'source_url': 'https://www.adsb.lol/', 'coverage': f'{ok} of {len(P)} areas, 250 nm each, busy air regions only',
       'fields': ['hex', 'flight', 'type', 'lat', 'lon', 'track', 'alt_ft', 'gs_kt', 'cc', 'mil'], 'counts': counts, 'count': len(seen), 'mil': sum(v[9] for v in seen.values()),
       'gps_fields': ['lat', 'lon', 'planes', 'bad'], 'gps_rule': 'nac_p<8 or nic<7', 'gps': gc,
       'ac': sorted(seen.values())}
p = pathlib.Path('data/skysea/aircraft.json'); p.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print('aircraft', len(seen), 'areas', ok, '/', len(P), 'bytes', p.stat().st_size, sorted(counts.items(), key=lambda x: -x[1])[:12])
