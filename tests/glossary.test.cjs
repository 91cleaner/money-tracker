'use strict';
/* Contract checks for assets/glossary.js (용어 툴팁). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const js = read('assets/glossary.js');
const code = js.replace(/\/\*[\s\S]*?\*\//g, '');

test('script parses', () => { assert.doesNotThrow(() => new vm.Script(js, { filename: 'glossary.js' })); });

test('explains PTR, 13F, 로비(LDA), 의무액 (and PAC) in plain Korean', () => {
  for (const t of ['PTR', '13F', '로비 (LDA 공시)', '의무액', 'PAC']) assert.ok(js.includes(t), t);
  assert.match(js, /45일/);
  assert.match(js, /투자 조언 아님/);
});

test('no network, no storage, no innerHTML; data inserted as text', () => {
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|innerHTML/);
});

test('no advice or gambling wording', () => {
  assert.doesNotMatch(code, /매수|매도|사세요|파세요|추천 종목|목표가|베팅|도박|확률/);
});

test('accessible: button with aria-label/aria-expanded, Escape closes', () => {
  assert.match(js, /aria-label/);
  assert.match(js, /aria-expanded/);
  assert.match(js, /"Escape"/);
});

test('term patterns match the intended labels and not look-alikes', () => {
  const m = js.match(/var PATTERNS = \[([\s\S]*?)\n  \];/)[1];
  const pats = [...m.matchAll(/\["(\w+)", (\/.*\/[a-z]*)\]/g)].map(x => [x[1], eval(x[2])]);
  const hit = s => pats.filter(([, re]) => re.test(s)).map(([k]) => k);
  assert.deepEqual(hit('의원 거래 신고 (하원 PTR)'), ['PTR']);
  assert.deepEqual(hit('로비 공시 (LDA)'), ['LDA']);
  assert.deepEqual(hit('13F 보유'), ['13F']);
  assert.deepEqual(hit('계약 의무액'), ['OBL']);
  assert.deepEqual(hit('PTRX 아님'), []);
});

test('attached to company, member and sector pages before commander.js', () => {
  for (const f of ['company.html', 'member.html', 'sector.html']) {
    assert.match(read(f), /<script src="assets\/glossary\.js\?v=[^"]+"><\/script>\n<script src="assets\/commander\.js/, f);
  }
  assert.ok(fs.existsSync(path.join(root, 'assets/glossary.js')));
});
