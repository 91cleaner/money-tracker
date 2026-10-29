'use strict';
/* Contract checks for sector-board.html (업종 히트맵 관제판). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'sector-board.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));

test('inline script parses', () => { assert.doesNotThrow(() => new vm.Script(script, { filename: 'sector-board.inline.js' })); });

test('reads repository data files that exist', () => {
  for (const f of ['data/search-index.json', 'data/us/ticker-sectors.json', 'data/us/trades_public.json', 'data/us/prices/summary.json']) {
    assert.ok(script.includes('"' + f + '"'), f);
    assert.ok(fs.existsSync(path.join(root, f)), f + ' exists');
  }
});

test('neutral wording: same-period numbers, no causation, filing basis, 45 days, disclaimer', () => {
  assert.match(script, /원인이라는 뜻이 아닙니다/);
  assert.match(script, /신고 기준/);
  assert.match(script, /45일/);
  assert.match(script, /투자 조언 아님/);
  assert.doesNotMatch(html, /매수|매도|사세요|파세요|오를 것|내릴 것|목표가|베팅|도박|확률|수익률 예상/);
});

test('colour is never the only cue: signed value and arrows are printed', () => {
  assert.match(script, /▲ \+/);
  assert.match(script, /▼ /);
  assert.match(script, /aria-label/);
  assert.doesNotMatch(script, /innerHTML/);
});

test('real data: sectors have mapped tickers, some with 1-week change', () => {
  const ts = read('data/us/ticker-sectors.json').tickers, pr = read('data/us/prices/summary.json').t;
  const withSector = Object.keys(ts).filter(t => ts[t].sector);
  assert.ok(withSector.length > 100);
  assert.ok(withSector.some(t => pr[t] && typeof pr[t].w1 === 'number'), 'some sector ticker has w1');
});

test('linked from the sector page', () => {
  assert.match(fs.readFileSync(path.join(root, 'sector.html'), 'utf8'), /href="sector-board\.html"/);
});
