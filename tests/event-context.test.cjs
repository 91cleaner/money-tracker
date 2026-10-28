'use strict';
/* Contract checks for assets/mt-event-context.js ("같은 기간 있었던 일" card + search-intent rules) and where it is attached. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const json = f => JSON.parse(read(f));
const M = require('../assets/mt-event-context.js');
const I = require('../assets/i18n.js');

const BAN_KO = /때문에|영향으로|추천|사라|팔아라|목표가|오른다|내린다/;
const BAN_EN = /\b(because|due to|caused by|recommend|should buy|will rise|will fall)\b/i;

test('script parses, builds DOM with textContent only, links https only', () => {
  const js = read('assets/mt-event-context.js');
  assert.doesNotThrow(() => new vm.Script(js, { filename: 'mt-event-context.js' }));
  assert.doesNotMatch(js, /innerHTML/);
  assert.match(js, /\^https:/);
});

test('intent: name only -> tour; why/price/up/down -> why; topic words -> topic (KO + EN)', () => {
  const tour = ['엔비디아', 'NVDA', 'nvidia', '엔비디아 공급망', 'NVDA supply chain', 'setup NVDA'];
  const why = ['엔비디아 주가 왜 그래', 'why is NVDA down', 'why is NVDA up', '엔비디아 왜 떨어져', '엔비디아 왜 올라', '엔비디아 주가', 'NVDA stock price', 'nvda dropped', 'NVDA surge', '엔비디아 하락'];
  tour.forEach(q => assert.equal(M.intent(q).mode, 'tour', q));
  why.forEach(q => assert.equal(M.intent(q).mode, 'why', q));
  const topic = { '엔비디아 관세': 'tariff', 'NVDA tariffs': 'tariff', 'NVDA export controls': 'export_control', '엔비디아 수출통제': 'export_control', '엔비디아 수출 규제': 'export_control', '엔비디아 제재': 'sanctions', 'NVDA sanctions': 'sanctions', '철강 관세 232조': 'import_232' };
  for (const [q, t] of Object.entries(topic)) { const r = M.intent(q); assert.equal(r.mode, 'topic', q); assert.equal(r.topic, t, q); }
  // why + topic: still the price-context mode, filtered to that topic
  assert.deepEqual(M.intent('엔비디아 관세 왜 떨어져'), { mode: 'why', topic: 'tariff' });
  assert.deepEqual(M.intent('why is NVDA down export controls'), { mode: 'why', topic: 'export_control' });
});

// small synthetic fixture: weekdays only, price rises by 1 per trading day from 100
function fixture() {
  const rows = []; let c = 100;
  for (let t = Date.parse('2025-12-01'); t <= Date.parse('2026-03-31'); t += 864e5) {
    const d = new Date(t); if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    rows.push({ d: d.toISOString().slice(0, 10), c: c++ });
  }
  const it = (id, date, t, type, sectors, topics, tickers, u) => ({ id, date, t, u: u || 'https://example.gov/' + id, src: 'FR', type, sectors, topics, tickers: tickers || [], tickers_product: [] });
  const wh = { source: 'Federal Register', source_url: 'https://www.federalregister.gov/', updated: '2026-03-31T00:00Z', items: [
    it('a', '2026-01-12', 'Tariff notice A', 'USTR(무역대표부)', ['semiconductor'], ['tariff']),
    it('b', '2026-01-26', 'Tariff notice B', 'USTR(무역대표부)', ['semiconductor'], ['tariff']),
    it('c', '2026-02-23', 'Tariff notice C', 'USTR(무역대표부)', ['semiconductor'], ['tariff']),
    it('d', '2026-02-20', 'Export rule D', '상무부 BIS(산업안보국)', ['semiconductor'], ['export_control'], ['NVDA']),
    it('e', '2026-02-21', 'Other sector rule', '행정명령', ['housing'], []),
    it('f', '2026-02-22', 'No https link', '행정명령', ['semiconductor'], [], [], 'http://example.gov/f')
  ] };
  const pol = { kr: { source: 'KR source', source_url: 'https://open.assembly.go.kr/', updated: '2026-03-31', items: [
    { id: 'k1', d: '2026-02-24', t: '반도체 지원 법안', u: 'https://open.assembly.go.kr/k1', src: 'KR', tags: ['semiconductor'] },
    { id: 'k2', d: '2026-02-24', t: '주택 법안', u: 'https://open.assembly.go.kr/k2', src: 'KR', tags: ['housing'] }] } };
  const earn = { source: 'SEC EDGAR 8-K Item 2.02', source_url: 'https://www.sec.gov/edgar/search/', updated: '2026-03-31', tickers: { NVDA: [{ date: '2026-02-25', url: 'https://www.sec.gov/Archives/edgar/data/1/2/x.htm' }] } };
  return { rows, wh, pol, earn, events: M.normalizeEvents({ whitehouse: wh, policy: pol }) };
}

test('normalizeEvents drops non-https and undated records; keeps tags as sectors', () => {
  const f = fixture();
  assert.equal(f.events.some(e => e.id === 'f'), false);
  assert.equal(f.events.length, 7);
  assert.deepEqual(f.events.find(e => e.id === 'k1').sectors, ['semiconductor']);
});

test('recent mode: 1w/1m change, same-period items nearest first, sector + ticker filter, earnings included', () => {
  const f = fixture();
  const m = M.buildRecent({ ticker: 'NVDA', rows: f.rows, events: f.events, earnings: f.earn, sectors: ['semiconductor'], whitehouse: f.wh, policy: f.pol, priceMeta: { source: 'x', as_of: '2026-03-31' } });
  assert.equal(m.last.d, '2026-03-31');
  assert.equal(m.changes.length, 2); assert.ok(m.changes.every(c => c.r && c.r.pct > 0));
  assert.equal(m.same.length, 0, 'window 2026-02-28..03-31 holds none of the fixture items');
  const m2 = M.buildRecent({ ticker: 'NVDA', rows: f.rows.filter(r => r.d <= '2026-02-27'), events: f.events, earnings: f.earn, sectors: ['semiconductor'], whitehouse: f.wh, policy: f.pol });
  const ids = m2.same.map(e => e.id);
  const dist = m2.same.map(e => Math.abs(Date.parse('2026-02-27') - Date.parse(e.date)));
  assert.deepEqual(dist.slice().sort((a, b) => a - b), dist, 'nearest date first');
  assert.ok(ids.includes('8k:NVDA:2026-02-25') && ids.includes('d') && ids.includes('k1'));
  assert.ok(!ids.includes('e') && !ids.includes('k2'), 'other sectors are left out');
});

test('past reactions: same type, earlier dates only, return over the same-length window, sample size shown', () => {
  const f = fixture();
  const st = M.reactionStats(f.rows, ['2026-01-12', '2026-01-26', '2026-01-12'], 0, 7);
  assert.equal(st.n, 2, 'duplicate dates counted once');
  assert.equal(st.up, 2); assert.ok(st.avg > 0 && st.avg < 10);
  const dates = M.pastDates(f.events, { type: 'USTR(무역대표부)', beforeDate: '2026-02-23', ticker: 'NVDA', sectors: ['semiconductor'] });
  assert.deepEqual(dates.sort(), ['2026-01-12', '2026-01-26']);
  assert.equal(M.reactionStats(f.rows, ['2026-03-30'], 0, 7).n, 0, 'window past the stored prices is not computed');
  assert.equal(M.reactionStats(f.rows, ['2025-11-20'], 7, 7).n, 0, 'window before the stored prices is not computed');
});

test('event card: +-7 day window excludes the event itself and shows past n', () => {
  const f = fixture();
  const m = M.buildEvent({ ticker: 'NVDA', date: '2026-02-23', id: 'c', type: 'USTR(무역대표부)', rows: f.rows, events: f.events, earnings: f.earn, sectors: ['semiconductor'], whitehouse: f.wh, policy: f.pol });
  assert.equal(m.from, '2026-02-16'); assert.equal(m.to, '2026-03-02');
  assert.ok(!m.same.some(e => e.id === 'c'));
  assert.ok(m.same.some(e => e.id === 'd') && m.same.some(e => e.earnings));
  assert.equal(m.past[0].stats.n, 2);
  assert.ok(m.own && Math.abs(m.own.pct) > 0);
});

test('topic filter keeps only that type of record', () => {
  const f = fixture();
  const m = M.buildRecent({ ticker: 'NVDA', topic: 'export_control', rows: f.rows.filter(r => r.d <= '2026-02-27'), events: f.events, earnings: f.earn, sectors: ['semiconductor'] });
  assert.deepEqual(m.same.map(e => e.id), ['d']);
});

test('wording: neutral KO + EN, disclaimer, no causal or advice words', () => {
  const f = fixture();
  const m = M.buildRecent({ ticker: 'NVDA', rows: f.rows.filter(r => r.d <= '2026-02-27'), events: f.events, earnings: f.earn, sectors: ['semiconductor'], whitehouse: f.wh, policy: f.pol });
  for (const lang of ['ko', 'en']) {
    const L = I.ctx[lang], ln = M.lines(m, lang);
    const all = [].concat(ln.changes, ln.same.map(s => s.text), ln.past.map(p => p.text), ln.notes, Object.values(L).filter(v => typeof v === 'string'));
    assert.ok(ln.same.length && ln.past.length);
    all.forEach(t => assert.doesNotMatch(t, lang === 'ko' ? BAN_KO : BAN_EN, t));
    assert.match(L.disclaimer, lang === 'ko' ? /상관관계일 뿐 원인이 아닙니다.*투자 조언이 아닙니다/ : /Correlation only, not a cause.*Not investment advice/);
    assert.match(ln.same.map(s => s.text).join(' '), lang === 'ko' ? /같은 기간 \d+\/\d+/ : /Same period, \w+ \d+/);
    assert.match(ln.past.map(p => p.text).join(' '), lang === 'ko' ? /과거 \d+번.*평균 [+-][\d.]+% \(데이터상\).*표본 \d+개/ : /\d+ past case\(s\).*average.*\(per data\).*sample size \d+/);
    if (lang === 'en') ln.same.filter(s => s.ev.cc === 'us').forEach(s => assert.doesNotMatch(s.text, /[가-힣]/, s.text));
  }
  assert.match(M.lines(m, 'ko').same.map(s => s.text).join('\n'), /실적 발표\(SEC 8-K 2\.02\)가 있었다/);
});

test('render: DOM card has heading, every item links to https source, disclaimer and sources', () => {
  const mk = tag => ({ tag, className: '', children: [], attrs: {}, textContent: '', appendChild(c) { this.children.push(c); return c; }, setAttribute(k, v) { this.attrs[k] = v; } });
  global.document = { createElement: mk, createTextNode: t => ({ text: t }) };
  try {
    const f = fixture();
    const m = M.buildRecent({ ticker: 'NVDA', rows: f.rows.filter(r => r.d <= '2026-02-27'), events: f.events, earnings: f.earn, sectors: ['semiconductor'], whitehouse: f.wh, policy: f.pol, priceMeta: { source: 'Massive', as_of: '2026-02-27' } });
    const box = mk('div'); M.render(box, m, 'ko');
    const flat = []; (function w(n) { flat.push(n); (n.children || []).forEach(w); })(box);
    const links = flat.filter(n => n.tag === 'a');
    assert.ok(links.length >= m.same.length);
    links.forEach(a => assert.match(a.href, /^https:\/\//));
    const text = flat.map(n => n.textContent || n.text || '').join('\n');
    assert.match(text, /상관관계일 뿐 원인이 아닙니다/);
    assert.match(text, /출처:/);
  } finally { delete global.document; }
});

test('SIC -> sector tags and the earnings collector parser', async () => {
  assert.deepEqual(M.sectorsOfSic('3674'), ['semiconductor', 'tech_ai']);
  assert.deepEqual(M.sectorsOfSic('9999'), []);
  const { extractEarnings } = await import('../scripts/collect-earnings-8k.mjs');
  const sub = { filings: { recent: { form: ['8-K', '8-K', '10-Q'], items: ['2.02,9.01', '5.02', ''], filingDate: ['2026-08-26', '2026-08-01', '2026-08-27'], accessionNumber: ['0001045810-26-000001', '0001045810-26-000002', '0001045810-26-000003'], primaryDocument: ['q2.htm', 'x.htm', 'k.htm'] } } };
  assert.deepEqual(extractEarnings(sub, '1045810', '2026-10-28'), [{ date: '2026-08-26', url: 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000001/q2.htm' }]);
});

test('real data: NVDA recent card builds from the stored files in both languages', () => {
  const wh = json('data/us/whitehouse.json'), pol = {}; ['kr', 'jp', 'eu', 'cn', 'tw'].forEach(c => { pol[c] = json('data/policy/' + c + '.json'); });
  const rows = M.parsePrices(json('data/us/prices/NVDA.json'));
  const sic = json('data/us/ticker-sectors.json').tickers.NVDA.sic;
  const m = M.buildRecent({ ticker: 'NVDA', rows, events: M.normalizeEvents({ whitehouse: wh, policy: pol }), sectors: M.sectorsOfSic(sic), whitehouse: wh, policy: pol });
  assert.ok(m.changes[0].r && m.changes[1].r);
  for (const lang of ['ko', 'en']) { const ln = M.lines(m, lang); [].concat(ln.changes, ln.same.map(s => s.text), ln.past.map(p => p.text)).forEach(t => assert.doesNotMatch(t, lang === 'ko' ? BAN_KO : BAN_EN)); }
});

test('company.html and the 관제실 page load the module and use the intent rules', () => {
  const c = read('company.html');
  assert.match(c, /<script src="assets\/mt-event-context\.js\?v=[^"]+"><\/script>/);
  assert.match(c, /window\.MTEventContext\.eventCard\(holder/);
  assert.match(c, /pins\.push\(\{ k: "w", id: w\.id/);
  const w = read('world-intelligence/index.html');
  assert.match(w, /<script src="\.\.\/assets\/mt-event-context\.js\?v=[^"]+"><\/script>/);
  assert.match(w, /MTEventContext\.intent\(q\)/);
  assert.match(w, /it\.mode!=='tour'/);
  assert.match(w, /MTEventContext\.recentCard\(box/);
  assert.match(w, /onFull:\(\)=>\{hideWhy\(\);start\(tr\)\}/);
  assert.match(read('assets/i18n.js'), /전체 경로 보기/);
});
