'use strict';
/* Contract checks for company.html (US company file page). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'company.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

test('inline script parses', () => { assert.doesNotThrow(() => new vm.Script(script, { filename: 'company.inline.js' })); });

test('reads only repository data files named in the spec', () => {
  for (const f of ['data/search-index.json', 'data/us/ticker-sectors.json', 'data/us/trades.json', 'data/us/lobbying.json', 'data/us/pac-contributions.json', 'data/us/ticker-routes.json', 'data/us/members.json']) {
    assert.ok(script.includes('"' + f + '"'), f);
    assert.ok(fs.existsSync(path.join(root, f)), f + ' exists');
  }
  assert.match(script, /"data\/us\/prices\/" \+ encodeURIComponent\(T\) \+ "\.json"/);
  assert.match(script, /주가 데이터 준비 중/);
  assert.doesNotMatch(script, /house-ptr-candidates/, 'HANDOFF: trades.json only');
});

test('neutral wording, filing basis, 45-day notice, disclaimer, map link', () => {
  assert.match(script, /신고 기준입니다/);
  assert.match(script, /45일/);
  assert.match(script, /투자 조언 아님/);
  assert.match(script, /원인 관계를 뜻하지 않습니다|원인 관계를 단정하지 않습니다/);
  assert.match(script, /world-intelligence\/\?q=" \+ encodeURIComponent\(T\)/);
  assert.doesNotMatch(html, /매수 추천|매도 추천|사세요|파세요|오를 것|내릴 것|목표가/);
});

test('links are restricted to https and data is inserted as text', () => {
  assert.match(script, /function safe\(u\) \{ return \/\^https:/);
  assert.doesNotMatch(script, /innerHTML/);
});

test('one-month close comparison clamps month-end dates, including leap years', () => {
  // Exercise the actual inline helper rather than a copied date implementation.
  const start = script.indexOf('function shiftMonth(iso)');
  const end = script.indexOf('function change(', start);
  assert.ok(start >= 0 && end > start, 'shiftMonth helper is present');
  const shiftMonth = vm.runInNewContext(script.slice(start, end) + '\nshiftMonth;');
  for (const [input, expected] of [
    ['2026-03-31', '2026-02-28'],
    ['2024-03-31', '2024-02-29'],
    ['2026-05-31', '2026-04-30'],
    ['2026-01-31', '2025-12-31'],
    ['2026-06-15', '2026-05-15'],
  ]) assert.equal(shiftMonth(input), expected, input);
});
