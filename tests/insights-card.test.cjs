'use strict';
/* Contract checks for assets/insights-card.js and its use on company.html / member.html. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const js = read('assets/insights-card.js');

test('card script parses, shows stored text only, links https only', () => {
  assert.doesNotThrow(() => new vm.Script(js, { filename: 'insights-card.js' }));
  assert.doesNotMatch(js, /innerHTML/);
  assert.match(js, /function safe\(u\) \{ return \/\^https:/);
  assert.match(js, /기준일/);
  assert.match(js, /투자 조언 아님/);
  assert.doesNotMatch(js, /매수|매도|사라|팔아라|목표가/);
});

test('company.html loads insights.json and renders the card first', () => {
  const c = read('company.html');
  assert.match(c, /<script src="assets\/insights-card\.js\?v=[^"]+"><\/script>/);
  assert.match(c, /get\("data\/us\/insights\.json"\)/);
  assert.match(c, /window\.MTInsights\.render\(app, ins\.companies\[T\], ins\)/);
});

test('member.html renders the card only when insights.json has a member entry', () => {
  const m = read('member.html');
  assert.match(m, /<script src="assets\/insights-card\.js\?v=[^"]+"><\/script>/);
  assert.match(m, /INS && INS\.members && window\.MTInsights/);
});

test('insights.json shape matches what the card reads', () => {
  const d = JSON.parse(read('data/us/insights.json'));
  const nv = d.companies && d.companies.NVDA;
  assert.ok(nv && Array.isArray(nv.lines) && Array.isArray(nv.summary));
  for (const l of nv.lines) { assert.ok(l.kind && l.text); if (l.src) assert.match(l.src, /^https:\/\//); }
});
