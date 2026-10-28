'use strict';
/* company.html 종가 차트 사건 핀 + 종목별 시계열 계약 검사. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'company.html'), 'utf8');

test('range buttons, pins with sources, neutral wording', () => {
  for (const r of ['1주', '1달', '1년', '전체']) assert.ok(html.includes('["' + r + '"'), r);
  assert.match(html, /data\/us\/whitehouse\.json/);
  assert.match(html, /출처 ↗/);
  assert.match(html, /신고일 기준/);
  assert.match(html, /45일/);
  assert.match(html, /연방 계약은 날짜별 자료가 없어/);
  assert.match(html, /주가 변동의 원인을 뜻하지 않습니다/);
  assert.doesNotMatch(html, /매수 추천|매도 추천|사세요|파세요|오를 것|내릴 것|목표가/);
});

test('collect_prices writes per-ticker series', () => {
  const py = fs.readFileSync(path.join(root, 'scripts/collect_prices.py'), 'utf8');
  assert.match(py, /def write_series/);
  const f = path.join(root, 'data/us/prices/NVDA.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(j.d.length, j.c.length);
  assert.ok(j.d.length > 20);
});
