'use strict';
/* weekly.html / assets/weekly-board.js: 주간 순위표 계산과 중립 문구 계약. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const W = require('../assets/weekly-board.js');
const html = read('weekly.html');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

test('scripts parse', () => { assert.doesNotThrow(() => new vm.Script(inline)); });

test('weeklyFilings: 최신 신고일부터 7일, 건수순 Top N, 동률은 이름순', () => {
  const t = [
    { tk: 'AAA', who: 'Kim', filed: '2026-10-20' },
    { tk: 'AAA', who: 'Kim', filed: '2026-10-14' },
    { tk: 'AAA', who: 'Lee', filed: '2026-10-13' }, // 7일 구간(10-14~10-20) 밖
    { tk: 'BBB', who: 'Lee', filed: '2026-10-18' },
    { tk: null, who: 'Lee', filed: '2026-10-19' },
    { tk: 'ccc', who: 'Park', filed: 'bad' },
  ];
  const r = W.weeklyFilings(t, 10);
  assert.equal(r.from, '2026-10-14'); assert.equal(r.to, '2026-10-20'); assert.equal(r.total, 4);
  assert.deepEqual(r.companies.map(x => [x.key, x.n]), [['AAA', 2], ['BBB', 1]]);
  assert.deepEqual(r.members.map(x => [x.key, x.n]), [['Kim', 2], ['Lee', 2]]);
  assert.equal(W.weeklyFilings([], 10).total, 0);
  assert.equal(W.weeklyFilings(Array.from({ length: 30 }, (_, i) => ({ tk: 'T' + i, filed: '2026-10-20' })), 10).companies.length, 10);
});

test('latestQuarterLobbying / awardsTotal', () => {
  const l = W.latestQuarterLobbying({ companies: { A: { by_quarter: { '2026-Q2': 5, '2026-1T': 9 } }, B: { by_quarter: { '2026-Q2': 7, '2026-Q3': 2 } } } }, 10);
  assert.equal(l.quarter, '2026-Q3'); assert.deepEqual(l.rows.map(r => r.key), ['B']);
  const a = W.awardsTotal({ period: ['2024-10-01', '2026-10-28'], companies: { A: { total_usd: 3 }, B: { total_usd: 9 }, C: { total_usd: 0 } } }, 10);
  assert.deepEqual(a.rows.map(r => r.key), ['B', 'A']);
});

test('real data produces a ranking', () => {
  const tr = JSON.parse(read('data/us/trades.json')).trades;
  const r = W.weeklyFilings(tr, 10);
  assert.ok(r.total > 0 && r.companies.length > 0 && r.members.length > 0);
  assert.ok(W.latestQuarterLobbying(JSON.parse(read('data/us/lobbying.json')), 10).rows.length > 0);
  assert.ok(W.awardsTotal(JSON.parse(read('data/us/federal-awards.json')), 10).rows.length > 0);
});

test('neutral wording, filing basis, no advice/betting, text-only insertion', () => {
  assert.match(html, /투자 조언 아님/); assert.match(html, /신고 기준/); assert.match(html, /45일/);
  assert.match(html, /주간 순위가 아닙니다/);
  const code = (html + read('assets/weekly-board.js')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /매수|매도|사세요|파세요|추천 종목|목표가|급등|급락|베팅|배팅|도박|이해충돌|내부자/);
  assert.doesNotMatch(code, /\b(buy|sell|bet|odds|jackpot)\b/i);
  assert.doesNotMatch(inline, /innerHTML/);
  assert.match(read('assets/nav.js'), /weekly\.html/);
});
