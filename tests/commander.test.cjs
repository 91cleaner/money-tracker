'use strict';
/* Contract checks for assets/commander.js (대장 모드) and where it is attached. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const js = read('assets/commander.js');
// Code without comments (the header comment itself lists what is NOT allowed).
const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'])\/\/[^\n]*/g, '$1');

test('script parses', () => { assert.doesNotThrow(() => new vm.Script(js, { filename: 'commander.js' })); });

test('no trading, advice, fake live numbers or gambling elements', () => {
  assert.doesNotMatch(code, /매수|매도|사세요|파세요|사라|팔아라|추천 종목|목표가|수익률 예상|급등|급락/);
  assert.doesNotMatch(code, /\b(buy|sell|bet|bets|betting|odds|jackpot|casino|lottery|slots?|leaderboard)\b/i);
  assert.doesNotMatch(code, /베팅|배팅|도박|잭팟|복권|당첨|순위표|랭킹|코인 획득|포인트 획득/);
  assert.doesNotMatch(code, /Math\.random/, 'missions must come from real data, not random numbers');
  assert.doesNotMatch(code, /setInterval/, 'no ticking fake live counters');
  assert.match(js, /투자 조언 아님/);
  assert.match(js, /신고 기준/);
  assert.match(js, /45일/);
});

test('browser storage only, every access guarded', () => {
  assert.doesNotMatch(js, /fetch\([^)]*method:\s*"POST"/i);
  for (const m of js.matchAll(/localStorage\.(getItem|setItem)/g)) {
    const before = js.slice(Math.max(0, m.index - 80), m.index);
    assert.match(before, /try \{/, 'localStorage call guarded by try: ' + m[0]);
  }
  assert.match(js, /sessionStorage/);
  assert.doesNotMatch(js, /innerHTML/);
});

test('ranks go from 신입 요원 to 관제실 대장 by opened cards', () => {
  const ranks = [...js.matchAll(/\[(\d+), "([^"]+)"\]/g)].map(m => [Number(m[1]), m[2]]);
  assert.equal(ranks[0][1], '신입 요원'); assert.equal(ranks[ranks.length - 1][1], '관제실 대장');
  for (let i = 1; i < ranks.length; i++) assert.ok(ranks[i][0] > ranks[i - 1][0]);
});

test('attached to company, member and world-intelligence with one script line each', () => {
  assert.match(read('company.html'), /<script src="assets\/commander\.js\?v=[^"]+"><\/script>\n<\/body>/);
  assert.match(read('member.html'), /<script src="assets\/commander\.js\?v=[^"]+"><\/script>\n<\/body>/);
  const wi = read('world-intelligence/index.html');
  assert.equal((wi.match(/commander\.js/g) || []).length, 1);
  assert.match(wi, /<script src="\.\.\/assets\/commander\.js\?v=[^"]+" defer><\/script>\n<\/body><\/html>/);
});
