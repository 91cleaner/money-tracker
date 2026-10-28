'use strict';
/* Contract checks for assets/share.js ("X에 공유") and its use on company / member / sector / command map. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const js = read('assets/share.js');

function load() {
  const meta = [];
  const el = () => ({ setAttribute() {}, appendChild() {}, append() {}, style: {} });
  const document = {
    readyState: 'complete', currentScript: { src: 'https://91cleaner.github.io/money-tracker/assets/share.js' },
    head: { querySelector: () => null, appendChild: m => meta.push(m) },
    getElementById: () => null, createElement: el, addEventListener() {},
  };
  const window = {};
  const location = { href: 'https://91cleaner.github.io/money-tracker/company.html?t=NVDA#x', origin: 'https://91cleaner.github.io', pathname: '/money-tracker/company.html' };
  vm.runInNewContext(js, { window, document, location, URL, fetch: () => Promise.reject(new Error('offline')), MutationObserver: function () { this.observe = () => {}; }, setTimeout, clearTimeout });
  return window.MTShare;
}
// X weighting: these ranges count 1, everything else 2; each URL counts 23.
const W = s => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0); n += (c <= 4351 || (c >= 8192 && c <= 8205) || (c >= 8208 && c <= 8223) || (c >= 8242 && c <= 8247)) ? 1 : 2; } return n; };
const tweet = t => W(t.replace(/https?:\/\/\S+/g, 'x'.repeat(23)));

test('share script parses, uses the X intent URL and no HTML injection', () => {
  assert.doesNotThrow(() => new vm.Script(js, { filename: 'share.js' }));
  assert.match(js, /https:\/\/x\.com\/intent\/post\?text=/);
  assert.doesNotMatch(js, /innerHTML|document\.write/);
  assert.doesNotMatch(js.replace(/\/\*[\s\S]*?\*\//g, ''), /매수 추천|매도 추천|사라|팔아라|목표가|오를|내릴/);
});

test('post = key line + official source + date + page link, within 280', () => {
  const S = load();
  const t = S.text({ head: '엔비디아(NVDA)', line: '로비 보고 금액 2026 Q1·Q2·Q3 $6.0M(공시 기준, 데이터상).', src: 'https://lda.gov/filings/public/filing/search/?client=NVIDIA', date: '2026-10-28', url: S.url({ t: 'NVDA' }) });
  const lines = t.split('\n');
  assert.equal(lines[0], '엔비디아(NVDA) · 로비 보고 금액 2026 Q1·Q2·Q3 $6.0M(공시 기준, 데이터상).');
  assert.equal(lines[1], '출처: https://lda.gov/filings/public/filing/search/?client=NVIDIA (2026-10-28 기준)');
  assert.equal(lines[2], 'https://91cleaner.github.io/money-tracker/company.html?t=NVDA');
  assert.ok(tweet(t) <= 280);
  assert.ok(S.href({ line: 'x' }).startsWith('https://x.com/intent/post?text='));
});

test('long Korean lines are cut with … so the post never exceeds 280', () => {
  const S = load();
  const long = '연방 계약 의무액과 로비 보고 금액, 하원 거래 신고 건수를 같은 기간 기준으로 정리한 데이터상 비교 수치입니다. '.repeat(6);
  const t = S.text({ head: '마이크로소프트(MSFT)', line: long, src: 'https://www.usaspending.gov/search/?hash=&keyword=MICROSOFT', date: '2026-10-28', url: 'https://91cleaner.github.io/money-tracker/company.html?t=MSFT' });
  assert.ok(tweet(t) <= 280, 'weight ' + tweet(t));
  assert.ok(tweet(t) >= 260, 'uses the room it has: ' + tweet(t));
  assert.match(t.split('\n')[0], /…$/);
  assert.match(t, /\n출처: https:\/\/www\.usaspending\.gov\/search\/\?hash=&keyword=MICROSOFT \(2026-10-28 기준\)\nhttps:\/\/91cleaner/);
});

test('non-https sources are dropped, never shown as 출처', () => {
  const S = load();
  const t = S.text({ head: 'A', line: 'b', src: 'javascript:alert(1)', date: '2026-10-28', url: 'https://91cleaner.github.io/money-tracker/sector.html?s=x' });
  assert.doesNotMatch(t, /출처|javascript/);
  assert.match(t, /^A · b\n2026-10-28 기준\nhttps:/);
});

test('pick takes the first summary sentence with its matching line source/date', () => {
  const S = load();
  const p = S.pick({ lines: [{ text: 'L1', src: 'https://a.gov/1', date: '2026-10-01' }, { text: 'L2', src: 'https://b.gov/2', date: '2026-10-02' }], summary: ['L2', 'L1'] });
  assert.deepEqual(JSON.parse(JSON.stringify(p)), { line: 'L2', src: 'https://b.gov/2', date: '2026-10-02' });
  assert.equal(S.pick(null), null);
  assert.equal(S.pick({ lines: [], summary: [] }), null);
  assert.equal(S.pick([{ title: 'T', url: 'http://x' }]).src, '');
});

test('pages: og/twitter meta, share script, button in the action row', () => {
  for (const f of ['company.html', 'member.html', 'sector.html']) {
    const h = read(f);
    for (const m of ['og:title', 'og:description', 'og:image', 'twitter:card', 'twitter:title', 'twitter:description']) assert.match(h, new RegExp('(property|name)="' + m + '"'), f + ' ' + m);
    assert.match(h, /<script src="assets\/share\.js\?v=[^"]+"><\/script>/, f);
    assert.match(h, /acts\.appendChild\(window\.MTShare\.button\(/, f);
    assert.match(h, /window\.MTShare\.meta\(/, f);
  }
  const w = read('world-intelligence/index.html');
  assert.match(w, /<script src="\.\.\/assets\/share\.js\?v=[^"]+" defer><\/script>/);
  assert.match(w, /property="og:title"/);
  assert.equal((w.match(/id="map"/g) || []).length, 1, 'still exactly one map container');
});
