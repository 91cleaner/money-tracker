'use strict';
/* Contract checks for bill.html and the alert-bar / search links added to world-intelligence/index.html. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('bill.html');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const BANNED = /매수 추천|매도 추천|사세요|파세요|사라|팔아라|살 때|팔 때|오를 것|내릴 것|급등 예상|급락 예상|목표가|저평가|고평가|수혜주|강력 추천|지금 사|buy now|sell now|strong buy|price target/i;

test('inline script parses', () => { assert.doesNotThrow(() => new vm.Script(script, { filename: 'bill.inline.js' })); });

test('no advice wording', () => { assert.doesNotMatch(html, BANNED); });

test('reads search-index bill entries and existing repo data only', () => {
  for (const f of ['data/search-index.json', 'data/us/bills.json', 'data/us/facilities.json', 'data/policy/kr.json', 'data/policy/jp.json', 'data/policy/eu.json', 'data/us/whitehouse.json']) {
    assert.ok(script.includes('"' + f + '"'), f);
    assert.ok(fs.existsSync(path.join(root, f)), f + ' exists');
  }
  assert.match(script, /"bill:" \+ NO/);
  assert.doesNotMatch(script, /house-ptr-candidates/);
});

test('every bill in the index is reachable and has a sponsor/lobby route shape the page reads', () => {
  const E = JSON.parse(read('data/search-index.json')).entities;
  const bills = Object.keys(E).filter(k => E[k].type === 'bill');
  assert.ok(bills.length > 0);
  for (const k of bills) {
    const no = k.slice(5);
    assert.match(no, /^[A-Z]{1,6} \d{1,5}(:\d{2,3})?$/, k);
    assert.ok(E[k].route.some(s => s.kind === 'bill'), k + ' has status route');
  }
});

test('session caveat for lobbying bill numbers is shown', () => {
  assert.match(script, /회기가 없어 다른 회기/);
  assert.match(script, /투자 조언/);
  assert.match(script, /인과나 영향을 뜻하지 않으며/);
});

test('links are https-only or local, user input is normalised', () => {
  assert.match(script, /function safe\(u\) \{ return \/\^https:/);
  assert.match(script, /function normNo/);
  assert.doesNotMatch(script, /innerHTML/);
});

test('mobile: single column, no fixed widths over 390px', () => {
  assert.match(html, /@media\(max-width:900px\)/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.doesNotMatch(html, /min-width:\s*(3[9]\d|[4-9]\d\d)px/);
});

const room = read('world-intelligence/index.html');
test('command room links bill results to bill.html', () => {
  assert.match(room, /\.\.\/bill\.html\?id=/);
});

test('white house alert bar: real item shape, two labelled groups, safe when empty', () => {
  const wh = JSON.parse(read('data/us/whitehouse.json'));
  assert.ok(Array.isArray(wh.items));
  for (const k of ['date', 't', 'type', 'u', 'sectors']) assert.ok(k in wh.items[0], k);
  assert.match(room, /grpP:'백악관·대통령 조치',grpA:'관련 부처 관보 문서'/);
  assert.doesNotMatch(room, /🏛️/); // no emoji in the UI
  assert.match(room, /Array\.isArray\(w&&w\.items\)/);
  assert.match(room, /if\(!P\.length&&!A\.length\)return/);
});

test('mobile guards added to company / member / sector', () => {
  for (const f of ['company.html', 'member.html', 'sector.html']) assert.match(read(f), /@media\(max-width:480px\)[\s\S]*minmax\(0,1fr\)/, f);
});
