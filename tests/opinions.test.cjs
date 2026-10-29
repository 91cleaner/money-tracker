'use strict';
/* Contract checks for assets/opinions.js ('남들 의견' 화면 층). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const js = read('assets/opinions.js');
const code = js.replace(/\/\*[\s\S]*?\*\//g, '');
const O = require('../assets/opinions.js');

const row = o => Object.assign({ name: 'Jim Cramer', handle: 'jimcramer', role: 'influencer', text: 'Watching chips.', url: 'https://x.com/jimcramer/status/1', created_at: '2026-10-28T01:00:00Z', source: 'x' }, o);

test('safe: no innerHTML/storage, no AI or advice wording', () => {
  assert.doesNotMatch(code, /innerHTML|insertAdjacentHTML|localStorage|sessionStorage|eval\(/);
  assert.doesNotMatch(code, /매수|매도|추천|때문에|목표가|사세요|파세요|because of|recommend/i);
});

test('opinion is labelled as opinion, not fact-checked, in both languages', () => {
  assert.match(O.T.ko.badge, /의견이에요, 사실 확인 아님/);
  assert.match(O.T.en.badge, /not fact-checked/i);
  assert.match(O.T.ko.foot, /투자 조언이 아니에요/);
});

test('a quote without an https link is never shown', () => {
  for (const u of ['', 'http://x.com/a', 'javascript:alert(1)', undefined]) assert.equal(O.clean(row({ url: u })), null);
  assert.ok(O.clean(row()));
});

test('quote is shortened to the limit', () => {
  const c = O.clean(row({ text: 'word '.repeat(100) }));
  assert.ok(c.text.length <= O.MAX_QUOTE, c.text.length);
  assert.match(c.text, /…$/);
});

test('exec line uses the required sentences', () => {
  const x = { name: '젠슨 황', title: 'CEO' };
  assert.equal(O.execLine(x, 'ko'), '같은 기간 젠슨 황 대표는 이렇게 말했어요');
  assert.equal(O.execLine({ name: 'Jensen Huang', title: 'CEO' }, 'en'), 'In the same period, CEO Jensen Huang said:');
});

test('pick: exec only within the answer period, newest opinions first as given', () => {
  const idx = { tickers: { NVDA: { opinions: [row({ text: 'a' }), row({ text: 'b' }), row({ text: 'c' }), row({ text: 'd' })], exec: [row({ role: 'exec', title: 'CEO', created_at: '2026-08-01T00:00:00Z' })] } } };
  const p = O.pick(idx, 'nvda', { asof: '2026-10-28', period: '1m' });
  assert.equal(p.opinions.length, 3);
  assert.equal(p.exec.length, 0);
  const q = O.pick(idx, 'NVDA', { asof: '2026-10-28', period: '3m' });
  assert.equal(q.exec.length, 1);
  assert.deepEqual(O.pick(idx, 'AAPL', {}), { opinions: [], exec: [] });
  assert.deepEqual(O.pick(null, 'NVDA', {}), { opinions: [], exec: [] });
});

test('answer screen wires the section in', () => {
  const html = read('world-intelligence/index.html');
  assert.match(html, /assets\/opinions\.js/);
  assert.match(html, /MTOpinions\.render\(/);
});

test('committed index.json (if any) has linked, short quotes only', () => {
  const idx = JSON.parse(read('data/opinions/index.json'));
  for (const t of Object.values(idx.tickers)) for (const r of [...t.opinions, ...t.exec]) {
    assert.match(r.url, /^https:\/\//);
    assert.ok(r.text.length <= O.MAX_QUOTE);
  }
});
