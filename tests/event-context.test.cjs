'use strict';
/* Contract checks for assets/event-context.js (이벤트 해석 카드) and its KO/EN wording. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const EC = require('../assets/event-context.js');
const i18n = require('../assets/i18n.js');

const BANNED = /때문에|영향으로|추천|덕분|탓에|because|due to|caused by|recommend/i;
const rows = [['2026-01-02', 100], ['2026-01-05', 101], ['2026-01-09', 110], ['2026-01-12', 111], ['2026-01-16', 99], ['2026-01-20', 100], ['2026-01-26', 120], ['2026-02-03', 130]]
  .map(([d, c]) => ({ d, c }));

test('windowReturn: close on/before the date to close on/before date+7; null when history ends first', () => {
  const r = EC.windowReturn(rows, '2026-01-05');
  assert.equal(r.d0, '2026-01-05'); assert.equal(r.d1, '2026-01-12');
  assert.ok(Math.abs(r.pct - (111 / 101 - 1) * 100) < 1e-9);
  assert.equal(EC.windowReturn(rows, '2026-02-01'), null);
  assert.equal(EC.windowReturn(rows, 'bad'), null);
});

const wh = [
  { id: 'a', date: '2026-01-05', type: '포고문', t: 'Tariff on chips', u: 'https://www.federalregister.gov/a', sectors: ['semiconductor'], tickers: [] },
  { id: 'b', date: '2026-01-07', type: '행정명령', t: 'AI order', u: 'https://www.whitehouse.gov/b', sectors: ['semiconductor'], tickers: [] },
  { id: 'c', date: '2026-01-07', type: '행정명령', t: 'Shipbuilding order', u: 'https://www.whitehouse.gov/c', sectors: ['shipbuilding'], tickers: [] },
  { id: 'd', date: '2026-01-20', type: '포고문', t: 'Later chip proclamation', u: 'https://www.federalregister.gov/d', sectors: ['semiconductor'], tickers: [] },
  { id: 'e', date: '2025-12-01', type: '포고문', t: 'Outside history', u: 'https://www.federalregister.gov/e', sectors: ['semiconductor'], tickers: [] }
];
const policy = { kr: [{ d: '2026-01-06', t: '반도체 지원', u: 'https://www.msit.go.kr/x', tags: ['semiconductor'] }, { d: '2026-01-06', t: '주택', u: 'https://www.msit.go.kr/y', tags: ['housing'] }], jp: [], eu: [], cn: [], tw: [] };
const pins = [{ k: 't', date: '2026-01-05', url: 'https://x.gov/1' }, { k: 't', date: '2026-01-20', url: '' }, { k: 't', date: '2026-01-26', url: '' }];

test('same-period items: only related (sector/ticker), only inside the window, always with a source link', () => {
  const ev = { k: 'w', id: 'a', type: '포고문', date: '2026-01-05', url: wh[0].u };
  const c = EC.build(ev, { ticker: 'NVDA', sector: 'semiconductor', rows, wh, policy, pins });
  const titles = c.others.map(o => o.title).sort();
  assert.deepEqual(titles, ['AI order', '반도체 지원']);
  assert.ok(c.others.every(o => /^https:\/\//.test(o.url)));
  assert.ok(!titles.includes('Shipbuilding order') && !titles.includes('Tariff on chips'), 'other sector / the event itself excluded');
});

test('past similar announcements: same type + sector, earlier dates, average and sample size', () => {
  const ev = { k: 'w', id: 'd', type: '포고문', date: '2026-01-20', url: wh[3].u };
  const c = EC.build(ev, { ticker: 'NVDA', sector: 'semiconductor', rows, wh, policy, pins });
  // earlier same-type matches: 'a' (2026-01-05, window inside history); 'e' (2025-12-01) has no price window
  assert.equal(c.past.n, 1);
  assert.ok(Math.abs(c.past.avg - (111 / 101 - 1) * 100) < 1e-9);
  const t = EC.build({ k: 't', date: '2026-02-03' }, { ticker: 'NVDA', sector: 'semiconductor', rows, wh: [], policy: {}, pins });
  assert.equal(t.past.n, 2, 'pins 01-05 and 01-20 have complete windows; 01-26 does not reach 02-02');
  const none = EC.build({ k: 'b', date: '2026-02-03' }, { ticker: 'NVDA', sector: 'semiconductor', rows, wh: [], policy: {}, pins });
  assert.equal(none.past.n, 0);
});

test('wording: neutral sentences, closing disclaimer, no causal or advice words (KO and EN)', () => {
  const ev = { k: 'w', id: 'd', type: '포고문', date: '2026-01-20', url: wh[3].u };
  const c = EC.build(ev, { ticker: 'NVDA', sector: 'semiconductor', rows, wh, policy, pins });
  const ca = EC.build({ k: 'w', id: 'a', type: '포고문', date: '2026-01-05', url: wh[0].u }, { ticker: 'NVDA', sector: 'semiconductor', rows, wh, policy, pins });
  const s = EC.sentences(c).concat(EC.sentences(ca)).map(x => x.text);
  assert.ok(s.some(x => /^같은 기간 1\/\d+ .+ 발표 '.+'이\(가\) 있었다\.$/.test(x)));
  assert.ok(s.some(x => /^과거 비슷한 발표 \d+번, .*평균 [+-][\d.]+%\(데이터상, 표본 \d+개/.test(x)));
  assert.equal(EC.FOOT, '상관관계일 뿐 원인이 아님. 투자 조언 아님.');
  for (const x of s.concat(EC.FOOT)) {
    assert.doesNotMatch(x, BANNED);
    const en = i18n.toEn(x);
    assert.doesNotMatch(en, BANNED);
    if (!/'.*[가-힣].*'/.test(x)) assert.doesNotMatch(en, /[가-힣]/, 'fully translated: ' + en);
  }
  assert.equal(i18n.toEn(EC.FOOT), 'Correlation only, not a cause. Not investment advice.');
  assert.equal(i18n.toEn('같은 기간 있었던 일'), 'What happened in the same period');
  assert.match(i18n.toEn('같은 기간 1/22 백악관·관보 발표 \'Tariff\'이(가) 있었다.'), /^In the same period \(1\/22\), a White House \/ Federal Register announcement 'Tariff' was published\.$/);
});

test('every sentence with a number or announcement carries a source link in the card', () => {
  const calls = [];
  const mk = tag => ({ tag, children: [], className: '', style: {}, appendChild(n) { this.children.push(n); return n; }, set textContent(v) { this._t = v; }, get textContent() { return this._t; } });
  const doc = { createElement: mk, createTextNode: t => ({ text: t }) };
  const c = EC.build({ k: 'w', id: 'a', type: '포고문', date: '2026-01-05', url: wh[0].u }, { ticker: 'NVDA', sector: 'semiconductor', rows, wh, policy, pins });
  const box = EC.render(doc, c, { link: (t, u) => { calls.push(u); return { link: u }; } });
  assert.ok(calls.length >= 3 && calls.every(u => /^https:\/\//.test(u)));
  assert.equal(box.children[box.children.length - 1].textContent, EC.FOOT);
});

test('company.html wires the card; i18n has the EN rules; real data builds without throwing', () => {
  const html = read('company.html');
  assert.match(html, /assets\/event-context\.js/);
  assert.match(html, /MTEventContext\.build/);
  assert.match(html, /data\/policy\/" \+ c \+ "\.json"/);
  const whReal = JSON.parse(read('data/us/whitehouse.json')).items;
  const pr = JSON.parse(read('data/us/prices/NVDA.json'));
  const real = pr.d.map((d, i) => ({ d, c: pr.c[i] }));
  const pol = {}; for (const k of ['kr', 'jp', 'eu', 'cn', 'tw']) pol[k] = JSON.parse(read('data/policy/' + k + '.json')).items;
  const hit = whReal.filter(w => w.date >= real[0].d && w.sectors.includes('semiconductor'))[0];
  assert.ok(hit);
  const c = EC.build({ k: 'w', id: hit.id, type: hit.type, date: hit.date, url: hit.u }, { ticker: 'NVDA', sector: 'semiconductor', rows: real, wh: whReal, policy: pol, pins: [] });
  EC.sentences(c).forEach(x => assert.doesNotMatch(x.text, BANNED));
});
