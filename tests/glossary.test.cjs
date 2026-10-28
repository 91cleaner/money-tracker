'use strict';
/* assets/glossary.js: 용어 툴팁 계약 (PTR · 13F · 로비(LDA) · 의무액). */
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

test('explains PTR, 13F, LDA and 의무액 in plain Korean, with neutral facts', () => {
  for (const t of ['PTR', '13F', 'LDA', '의무액']) assert.ok(js.includes(t), t);
  assert.match(js, /45일/);
  assert.match(js, /합법적인 활동/);
  assert.match(js, /실제로 지급된 돈/);
});

test('no advice/betting wording, text-only insertion, no network or storage', () => {
  assert.doesNotMatch(code, /매수|매도|사세요|파세요|추천 종목|목표가|급등|급락|베팅|배팅|도박|이해충돌|내부자/);
  assert.doesNotMatch(code, /\b(buy|sell|bet|odds|jackpot)\b/i);
  assert.doesNotMatch(code, /innerHTML|fetch\(|localStorage|XMLHttpRequest/);
});

test('accessible: real buttons with aria-label/expanded, Esc closes, tooltip role', () => {
  assert.match(js, /createElement\("button"\)/);
  assert.match(js, /aria-label/); assert.match(js, /aria-expanded/); assert.match(js, /"Escape"/); assert.match(js, /role", "tooltip"/);
});

test('attached to company, member and sector pages before commander.js', () => {
  for (const f of ['company.html', 'member.html', 'sector.html']) {
    assert.match(read(f), /<script src="assets\/glossary\.js\?v=[^"]+" defer><\/script>\n<script src="assets\/commander\.js/, f);
  }
});
