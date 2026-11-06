'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual mtGet implementation embedded in the command room.
// No network, browser, or live data is needed for these deterministic tests.
const html = fs.readFileSync(path.join(__dirname, '..', 'world-intelligence', 'index.html'), 'utf8');
function makeGet(fetch) {
  const start = html.indexOf('const mtJson={};');
  const end = html.indexOf('function mtNames(', start);
  assert.ok(start >= 0 && end > start, 'question cache source must be present');
  const context = { fetch };
  vm.runInNewContext(html.slice(start, end) + '\nthis.mtGet=mtGet;', context);
  return context.mtGet;
}

test('HTTP error is not cached as an empty result: next question retries', async () => {
  let calls = 0;
  const get = makeGet(async () => {
    calls++;
    return calls === 1
      ? { ok: false, status: 503, json: () => { throw Error('must not parse 503'); } }
      : { ok: true, json: async () => ({ rows: [1] }) };
  });
  assert.equal(await get('us/members.json'), null);
  assert.equal((await get('us/members.json')).rows.length, 1);
  assert.equal(calls, 2);
});

test('network failure is evicted and a later request can recover', async () => {
  let calls = 0;
  const get = makeGet(async () => {
    if (++calls === 1) throw Error('offline');
    return { ok: true, json: async () => ({ ok: true }) };
  });
  assert.equal(await get('first-screen-lexicon.json'), null);
  assert.equal((await get('first-screen-lexicon.json')).ok, true);
  assert.equal(calls, 2);
});

test('malformed JSON is evicted rather than permanently cached', async () => {
  let calls = 0;
  const get = makeGet(async () => {
    calls++;
    return { ok: true, json: async () => {
      if (calls === 1) throw SyntaxError('invalid JSON');
      return { entries: [] };
    } };
  });
  assert.equal(await get('us/members.json'), null);
  assert.equal((await get('us/members.json')).entries.length, 0);
  assert.equal(calls, 2);
});

test('concurrent successful requests still share one fetch and retain valid empty data', async () => {
  let calls = 0;
  let finish;
  const get = makeGet(() => {
    calls++;
    return new Promise(resolve => { finish = resolve; });
  });
  const first = get('first-screen-lexicon.json');
  const second = get('first-screen-lexicon.json');
  assert.strictEqual(first, second);
  finish({ ok: true, json: async () => ({ entries: [] }) });
  assert.equal((await first).entries.length, 0);
  assert.equal((await get('first-screen-lexicon.json')).entries.length, 0);
  assert.equal(calls, 1);
});
