'use strict';
/* Contract checks for weekly.html (주간 순위표). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'weekly.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

test('inline script parses', () => { assert.doesNotThrow(() => new vm.Script(script, { filename: 'weekly.inline.js' })); });

test('reads repository data files that exist', () => {
  for (const f of ['data/us/trades_public.json', 'data/us/lobbying.json', 'data/us/federal-awards.json']) {
    assert.ok(script.includes('"' + f + '"'), f);
    assert.ok(fs.existsSync(path.join(root, f)), f + ' exists');
  }
});

test('neutral wording, filing basis, 45-day notice, non-weekly boards labelled', () => {
  assert.match(script, /신고 기준이며/);
  assert.match(script, /45일/);
  assert.match(script, /투자 조언 아님/);
  assert.match(script, /문제가 있다는 뜻이 아닙니다/);
  assert.equal((script.match(/주간 자료가 아닙니다/g) || []).length, 2, 'lobbying and contracts are not weekly');
  assert.doesNotMatch(html, /매수|매도|사세요|파세요|오를 것|내릴 것|목표가|베팅|도박|확률/);
});

test('data inserted as text, links relative', () => {
  assert.doesNotMatch(script, /innerHTML/);
  assert.match(script, /company\.html\?t=" \+ encodeURIComponent/);
  assert.match(script, /member\.html\?n=" \+ encodeURIComponent/);
});

test('window is 7 days ending at the newest filing date and the newest week has data', () => {
  const tr = JSON.parse(fs.readFileSync(path.join(root, 'data/us/trades_public.json'), 'utf8')).trades;
  const filed = tr.map(x => x.filed).filter(Boolean).sort();
  const end = filed[filed.length - 1];
  const start = new Date(Date.parse(end + 'T00:00:00Z') - 6 * 864e5).toISOString().slice(0, 10);
  assert.ok(tr.filter(x => x.filed >= start && x.filed <= end).length > 0);
  assert.match(script, /isoAdd\(end, -6\)/);
});

test('linked from the company, member and sector pages', () => {
  for (const f of ['company.html', 'member.html', 'sector.html']) assert.match(fs.readFileSync(path.join(root, f), 'utf8'), /href="weekly\.html"/);
});
