'use strict';
/* Contract checks for assets/labor-card.js, labor.html and data/kr/labor.json (한국 노사분규·파업 공시). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const js = read('assets/labor-card.js');
const page = read('labor.html');
const BAD = /매수|매도|사세요|파세요|사라|팔아라|추천 종목|목표가|베팅|도박|확률|오를 것|내릴 것|buy now|sell now|price target/i;

test('card script parses, text only, https links only, no network except labor.json', () => {
  assert.doesNotThrow(() => new vm.Script(js, { filename: 'labor-card.js' }));
  assert.doesNotMatch(js, /innerHTML|localStorage|sessionStorage/);
  assert.match(js, /function safe\(u\) \{ return \/\^https:/);
  assert.deepEqual([...js.matchAll(/fetch\("([^"]+)"/g)].map(m => m[1]), ['data/kr/labor.json']);
});

test('neutral Korean + English background, no advice or forbidden words', () => {
  assert.match(js, /Korea labor strike disclosures/); assert.match(js, /회사 파업 소식/);
  assert.match(js, /not investment advice/i);
  assert.match(js, /투자 조언 아님/);
  assert.match(js, /원인 관계가 아니며/);
  assert.doesNotMatch(js, BAD);
  assert.doesNotMatch(page, BAD);
});

test('eventsFor links a filing to a stock name or code', () => {
  const ctx = { window: {}, document: {}, fetch: () => {} };
  vm.createContext(ctx); vm.runInContext(js, ctx);
  const d = { disclosures: [{ date: '2026-10-10', corp: '삼성전자', code: '005930', report: '노조 파업', kind: 'strike', url: 'https://dart.fss.or.kr/x' }] };
  const a = ctx.window.MTLabor.eventsFor(d, '삼성전자'), b = ctx.window.MTLabor.eventsFor(d, '005930');
  assert.equal(a.length, 1); assert.equal(b.length, 1);
  assert.match(a[0].title, /같은 기간 삼성전자 노조·파업 관련 공시가 있었어요/);
  assert.equal(ctx.window.MTLabor.eventsFor(d, 'LG').length, 0);
});

test('labor.json shape, sources with recorded reasons, https links', () => {
  const d = JSON.parse(read('data/kr/labor.json'));
  assert.ok(Array.isArray(d.disclosures) && Array.isArray(d.industries));
  assert.ok(d.note && d.note_en);
  assert.deepEqual(d.sources.map(s => s.id), ['dart', 'moel_stats', 'nlrc']);
  for (const s of d.sources) { assert.match(s.url, /^https:\/\//); if (s.status !== 'ok') assert.ok(s.reason, s.id); }
  for (const r of d.disclosures) assert.match(r.url, /^https:\/\/dart\.fss\.or\.kr\//);
});

test('page, sector pages and glossary are wired', () => {
  assert.match(page, /assets\/labor-card\.js/);
  assert.match(page, /회사 파업 소식 모아 보기/);
  for (const f of ['sector.html', 'sector-board.html']) assert.match(read(f), /assets\/labor-card\.js/, f);
  const g = read('assets/glossary.js');
  assert.match(g, /LABOR:/); assert.match(g, /Labor strike filings \(Korea\)/);
  assert.doesNotThrow(() => new vm.Script(page.match(/<script>([\s\S]*?)<\/script>/)[1]));
});

test('no key is ever printed or committed', () => {
  const py = read('collector/kr/labor.py');
  assert.doesNotMatch(py, /print\([^)]*(crtfc_key|serviceKey|environ\[)/);
  assert.match(py, /DART_API_KEY/);
});
