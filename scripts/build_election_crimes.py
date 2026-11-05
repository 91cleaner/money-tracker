"""Election-crime charges collector (no keys).
Source: justice.gov press-release API (OPA + all U.S. Attorneys' Offices), title keyword search.
Keeps only case announcements (charged / indicted / arrested / pleaded / convicted / sentenced).
Per-state counts use U.S. Attorney releases only (OPA round-ups repeat them, so they are listed but not counted).
People per release are read from the title or teaser; when a plural has no number, 2 is counted as a minimum.
DHS/ICE releases are kept as linked cards (data/elcrime_dhs.json, hand-checked) and are not counted."""
import json, re, os, html, time, urllib.request, datetime
OUT = 'data/elcrime.json'
H = {'User-Agent': 'Mozilla/5.0 (money-tracker collector)'}
SINCE = int(datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc).timestamp())
KW = ['voting', 'vote', 'voter', 'voted', 'votes', 'election', 'ballot', 'ballots']
CASE = re.compile(r'\b(charg|indict|arrest|arraign|plead|pleads|guilty|convict|sentenc|admits|complaint)', re.I)
SKIP = re.compile(r'(sues|lawsuit|monitor|integrity plan|election officer|warns|data shows|available to receive|announces steps|election day program|responds to allegations|complaint against .*association|terrorist removal|coordinators)', re.I)
CONV = re.compile(r'(guilty|convicted|sentenced|admits|pleads|pled|pleaded)', re.I)
NUM = {'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12, 'dozen': 12}
ST = {'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT','Delaware':'DE','District of Columbia':'DC','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY','Puerto Rico':'PR','Virgin Islands':'VI','Guam':'GU'}

def get(kw, pg):
    u = f'https://www.justice.gov/api/v1/press_releases.json?pagesize=50&page={pg}&sort=date&direction=DESC&title={kw}'
    for t in range(3):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=60))['results']
        except Exception:
            time.sleep(5)
    return []

def comp(r):
    c = r.get('component')
    if isinstance(c, str):
        return re.findall(r"'name': '([^']+)'", c)
    return [x.get('name', '') for x in (c or [])]

def state(r):
    for n in comp(r):
        m = re.match(r'USAO - ([^,]+)', n)
        if m and m.group(1).strip() in ST:
            return ST[m.group(1).strip()]
    return None

PN = r'(?:(?:more|additional|foreign|non-?|lawful|pennsylvania|illegal|north carolina)\s*)*(?:aliens?|non-?citizens?|noncitizens|foreign nationals|nationals|individuals|defendants|people|persons|canadians|foreigners|federal indictments|more|charged|indicted|arrested|men|women)\b'
def people(t, teaser):
    w = r'(\d{1,3}|' + '|'.join(NUM) + r')'
    for s in (t, teaser):
        m = re.search(r'\b' + w + r'\s+' + PN, s, re.I)
        if m:
            v = m.group(1).lower()
            return (int(v) if v.isdigit() else NUM[v]), True
    if re.search(r'husband and wife|(man|woman|national|citizen) and [a-z ]*(man|woman|national|citizen)\b', t, re.I):
        return 2, True
    if re.search(r'\b(aliens|non-?citizens|noncitizens|nationals|canadians|defendants|foreigners|individuals)\b', t, re.I) or re.search(r'^multiple', t, re.I):
        return 2, False
    return 1, True

def main():
    old = json.load(open(OUT)) if os.path.exists(OUT) else {'cases': []}
    have = {c['id']: c for c in old['cases']}
    full = not have
    seen = {}
    for kw in KW:
        for pg in range(10 if full else 1):
            rs = get(kw, pg)
            for r in rs:
                if int(r['date']) >= SINCE:
                    seen[r['uuid']] = r
            if not rs or int(rs[-1]['date']) < SINCE:
                break
    for r in seen.values():
        t = html.unescape(r['title']).strip()
        if not CASE.search(t) or SKIP.search(t):
            continue
        tz = html.unescape(re.sub('<[^>]+>', '', r.get('teaser') or '')).strip()
        office = r['url'].split('/')[3]
        n, exact = people(t, tz)
        d = datetime.datetime.fromtimestamp(int(r['date']), datetime.timezone.utc).strftime('%Y-%m-%d')
        have[r['uuid']] = {'id': r['uuid'], 'd': d, 'st': state(r), 'of': office, 'opa': office == 'opa',
                           't': t, 'tz': tz[:400], 'n': n, 'nx': exact,
                           's': 'convicted' if CONV.search(t) else 'charged', 'u': r['url']}
    cs = sorted(have.values(), key=lambda c: (c['d'], c['id']), reverse=True)
    fix = json.load(open('data/elcrime_fix.json')) if os.path.exists('data/elcrime_fix.json') else {}
    by, dup = {}, set()
    for c in cs:
        k = (c['d'], re.sub(r'\W+', '', c['t'].lower())[:50])
        c['dup'] = (not c['opa']) and k in dup
        if c['id'] in fix:
            c['dup'] = True; c['why'] = fix[c['id']]
        if not c['opa']:
            dup.add(k)
        if c['opa'] or c['dup'] or not c['st']:
            continue
        b = by.setdefault(c['st'], {'n': 0, 'cases': 0, 'conv': 0})
        b['n'] += c['n']; b['cases'] += 1; b['conv'] += c['n'] if c['s'] == 'convicted' else 0
    out = {'src': 'https://www.justice.gov/news', 'since': '2026-01-01', 'cases': cs, 'states': by}
    if os.path.exists('data/elcrime_dhs.json'):
        out['dhs'] = json.load(open('data/elcrime_dhs.json'))
    new = json.dumps(out, ensure_ascii=False, indent=0, sort_keys=True)
    if not os.path.exists(OUT) or open(OUT).read() != new:
        open(OUT, 'w').write(new)
    print(len(cs), 'cases', sum(b['n'] for b in by.values()), 'people in', len(by), 'states')

if __name__ == '__main__':
    main()
