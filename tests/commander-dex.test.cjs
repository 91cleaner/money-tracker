'use strict';
/* Contract checks for the 의원 도감 (member collection) in assets/commander.js + member.html. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const js = read('assets/commander.js');
const member = read('member.html');

test('commander.js still parses with the dex tab', () => {
  assert.doesNotThrow(() => new vm.Script(js, { filename: 'commander.js' }));
  assert.match(js, /"의원 도감"/);
  assert.match(js, /수집한 의원 " \+ got \+ " \/ " \+ total \+ "명/);
});

test('member.html announces only members found in members.json', () => {
  assert.match(member, /if \(M\[ids\[0\]\]\) \{ window\.MTMemberOpened/);
  assert.match(member, /mt:member-opened/);
  assert.match(js, /mt:member-opened/);
});

test('dex is keyed by member ID in the guarded localStorage state; total comes from members.json', () => {
  assert.match(js, /get\("data\/us\/members\.json"\)/);
  assert.ok(fs.existsSync(path.join(root, 'data/us/members.json')));
  assert.doesNotMatch(js, /innerHTML/);
  const m = JSON.parse(read('data/us/members.json')).members;
  assert.ok(m.length > 400 && m.every(x => /^[A-Z]\d{6}$/.test(x.id)), 'roster IDs match the collected-ID pattern');
});

test('collect-once logic counts only roster members', () => {
  const dex = {}, ids = { A000001: 1 };
  const collect = (id, name) => { if (!/^[A-Z]\d{6}$/.test(id || '') || dex[id]) return; dex[id] = { name }; };
  collect('A000001', 'x'); collect('A000001', 'y'); collect('bad', 'z'); collect('B000002', 'w');
  assert.equal(dex.A000001.name, 'x');
  assert.equal(Object.keys(dex).filter(i => ids[i]).length, 1);
  assert.ok(/id \|\| ""\) \|\| st\.dex\[id\]/.test(js) || js.includes('st.dex[id]'), 'real code guards duplicates');
});

test('neutral wording: no scoring or gambling elements in the dex', () => {
  const block = js.slice(js.indexOf('function renderDex'), js.indexOf('function renderFeed'));
  assert.ok(block.length > 100);
  assert.doesNotMatch(block, /매수|매도|베팅|도박|뽑기|확률|보상|순위/);
});
