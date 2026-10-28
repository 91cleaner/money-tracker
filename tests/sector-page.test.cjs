'use strict';
/* Contract checks for sector.html and the sector links added to company.html / member.html. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('sector.html');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
// Words that read as investment advice or causal claims. None may appear anywhere on the page.
const BANNED = /매수 추천|매도 추천|사세요|파세요|사라|팔아라|살 때|팔 때|오를 것|내릴 것|급등 예상|급락 예상|목표가|저평가|고평가|수혜주|강력 추천|지금 사|buy now|sell now|strong buy|price target/i;

test('inline script parses', () => { assert.doesNotThrow(() => new vm.Script(script, { filename: 'sector.inline.js' })); });

test('forbidden advice words are absent (sector, company and member pages)', () => {
  for (const f of ['sector.html', 'company.html', 'member.html']) assert.doesNotMatch(read(f), BANNED, f);
});

test('uses only repository data; optional files hide their section when missing', () => {
  for (const f of ['data/search-index.json', 'data/us/ticker-sectors.json', 'data/us/trades.json', 'data/us/prices/summary.json', 'data/us/federal-awards.json', 'data/us/lobbying.json', 'data/us/facilities.json', 'data/us/ticker-routes.json']) {
    assert.ok(script.includes('"' + f + '"'), f);
    assert.ok(fs.existsSync(path.join(root, f)), f + ' exists');
  }
  assert.ok(script.includes('"data/us/insights.json"'), 'optional insights file is read if present');
  assert.match(script, /ins && ins\.sectors && Array\.isArray\(ins\.sectors\[S\]\)/, 'insights shown only when the file has this sector');
  assert.doesNotMatch(script, /house-ptr-candidates/);
});

test('neutral wording, 90-day filing basis, disclaimer, sources, links', () => {
  assert.match(script, /WINDOW = 90/);
  assert.match(script, /신고일 기준/);
  assert.match(script, /45일/);
  assert.match(script, /투자 조언 아님/);
  assert.match(script, /원인 관계를 뜻하지 않습니다/);
  assert.match(script, /world-intelligence\/\?q=" \+ encodeURIComponent\(sec\.name\)/);
  assert.match(script, /"company\.html\?t=" \+ encodeURIComponent\(t\)/);
  assert.match(script, /"member\.html\?n=" \+ encodeURIComponent\(w\)/);
  assert.match(script, /function safe\(u\) \{ return \/\^https:/);
  assert.doesNotMatch(script, /innerHTML/);
});

test('company.html and member.html only gained a sector link', () => {
  assert.match(read('company.html'), /secEl\.href = "sector\.html\?s=" \+ encodeURIComponent\(ent\.sector\)/);
  assert.match(read('member.html'), /a\.href = "sector\.html\?s=" \+ encodeURIComponent\(s\)/);
});
