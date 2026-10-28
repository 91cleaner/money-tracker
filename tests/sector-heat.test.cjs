'use strict';
/* heatmap.html / assets/sector-heat.js: 업종 히트맵 계산과 중립 문구 계약. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const H = require('../assets/sector-heat.js');
const html = read('heatmap.html');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

test('inline script parses', () => { assert.doesNotThrow(() => new vm.Script(inline)); });

test('build: 7일 신고 건수와 w1 중앙값, 가격 3개 미만이면 null', () => {
  const tickers = { A: { sector: 'energy' }, B: { sector: 'energy' }, C: { sector: 'energy' }, D: { sector: 'utilities' }, E: {} };
  const trades = [
    { tk: 'A', filed: '2026-10-20' }, { tk: 'b', filed: '2026-10-14' }, { tk: 'A', filed: '2026-10-13' },
    { tk: 'D', filed: '2026-10-19' }, { tk: 'E', filed: '2026-10-19' }, { tk: 'ZZ', filed: '2026-10-19' },
  ];
  const prices = { A: { w1: 1 }, B: { w1: 5 }, C: { w1: -3 }, D: { w1: 9 } };
  const r = H.build(tickers, trades, prices);
  assert.equal(r.from, '2026-10-14'); assert.equal(r.to, '2026-10-20');
  const by = Object.fromEntries(r.rows.map(x => [x.sector, x]));
  assert.equal(by.energy.events, 2); assert.equal(by.energy.change, 1); assert.equal(by.energy.priced, 3);
  assert.equal(by.utilities.events, 1); assert.equal(by.utilities.change, null);
  assert.equal(r.rows[0].sector, 'energy');
  assert.equal(H.median([1, 2, 3, 4]), 2.5);
  assert.deepEqual(H.build({}, [], {}).rows, []);
});

test('real data yields sectors with events and changes', () => {
  const r = H.build(JSON.parse(read('data/us/ticker-sectors.json')).tickers, JSON.parse(read('data/us/trades.json')).trades, JSON.parse(read('data/us/prices/summary.json')).t);
  assert.ok(r.rows.length >= 5);
  assert.ok(r.rows.some(x => x.events > 0) && r.rows.some(x => x.change !== null));
});

test('neutral wording: 인과 아님, 신고 기준, 45일, 투자 조언 아님, 색 외 기호', () => {
  assert.match(html, /인과를 뜻하지 않습니다/); assert.match(html, /신고 기준/); assert.match(html, /45일/); assert.match(html, /투자 조언 아님/);
  assert.match(html, /▲/); assert.match(html, /▼/);
  const code = (html + read('assets/sector-heat.js')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /매수|매도|사세요|파세요|추천 종목|목표가|급등|급락|베팅|배팅|도박|이해충돌|내부자/);
  assert.doesNotMatch(code, /\b(buy|sell|bet|odds|jackpot)\b/i);
  assert.doesNotMatch(inline, /innerHTML/);
  assert.match(read('assets/nav.js'), /heatmap\.html/);
});
