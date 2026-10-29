'use strict';
/* Contract checks for member.html (US member file page). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'member.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

test('inline script parses', () => { assert.doesNotThrow(() => new vm.Script(script, { filename: 'member.inline.js' })); });

test('reads repository data only (trades_public.json, search-index.json, members.json)', () => {
  for (const f of ['data/us/trades_public.json', 'data/search-index.json', 'data/us/members.json']) {
    assert.ok(script.includes('"' + f + '"'), f);
    assert.ok(fs.existsSync(path.join(root, f)), f + ' exists');
  }
  assert.doesNotMatch(script, /house-ptr-candidates/, 'HANDOFF: trades.json only');
  assert.doesNotMatch(script, /\.pic\b/, 'no member photos');
});

test('neutral wording, filing basis, 45-day notice, overlap wording, disclaimer, links', () => {
  assert.match(script, /신고 기준입니다/);
  assert.match(script, /45일/);
  assert.match(script, /데이터상 겹침/);
  assert.match(script, /공식 관할이 아닙니다/);
  assert.match(script, /투자 조언 아님/);
  assert.match(script, /world-intelligence\/\?q=" \+ encodeURIComponent\(mapName\)/);
  assert.match(script, /company\.html\?t=" \+ encodeURIComponent\(tk\)/);
  assert.doesNotMatch(html, /매수 추천|매도 추천|사세요|파세요|오를 것|내릴 것|목표가|이해충돌|내부자/);
});

test('links are restricted to https and data is inserted as text', () => {
  assert.match(script, /function safe\(u\) \{ return \/\^https:/);
  assert.doesNotMatch(script, /innerHTML/);
});

test("congress timeline panel: key-needed state, same-month wording, no causal words", () => {
  assert.ok(script.includes("data/us/timeline/status.json"));
  assert.match(script, /needs_key/);
  assert.match(script, /같은 달에 /);
  assert.match(script, /Member timeline/);
  assert.doesNotMatch(html, /때문에|추천/);
});
