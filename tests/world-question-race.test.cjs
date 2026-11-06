'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../world-intelligence/index.html'), 'utf8');
const begin = html.indexOf("let mtQueryEpoch=0;\n$('ask').addEventListener('submit',");
const end = html.indexOf('\nconst mtJson=', begin);
assert.ok(begin >= 0 && end > begin, 'question submit handler must exist');
const handler = html.slice(begin, end);

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function harness({ first = async () => false, intent = async () => false, ticker = async q => ({ q }) } = {}) {
  const log = [];
  let listener;
  const elements = {
    ask: { addEventListener(type, fn) { assert.equal(type, 'submit'); listener = fn; } },
    question: { value: '' }
  };
  const context = {
    $: id => elements[id],
    clearFirst: () => log.push(['clear']),
    mtFirstCard: first,
    mtIntentCard: intent,
    tickerRoute: ticker,
    showNone: (q) => log.push(['none', q]),
    start: route => log.push(['start', route.q]),
    showCandidates: q => log.push(['candidates', q])
  };
  vm.runInNewContext(handler, context, { timeout: 1000 });
  assert.equal(typeof listener, 'function');
  return {
    log,
    submit(q) {
      elements.question.value = q;
      return listener({ preventDefault() {} });
    }
  };
}

test('late first-card result A cannot overwrite newer route B', async () => {
  const old = deferred();
  const h = harness({ first: q => q === 'A' ? old.promise : Promise.resolve(false) });
  const a = h.submit('A');
  await h.submit('B');
  old.resolve(false);
  await a;
  assert.deepEqual(h.log.filter(x => x[0] === 'start'), [['start', 'B']]);
});

test('late intent-card result A cannot trigger fallback after B', async () => {
  const old = deferred();
  const h = harness({ intent: q => q === 'A' ? old.promise : Promise.resolve(false) });
  const a = h.submit('A');
  await h.submit('B');
  old.resolve(false);
  await a;
  assert.deepEqual(h.log.filter(x => x[0] === 'start'), [['start', 'B']]);
});

test('late ticker-route A cannot replace newer route B', async () => {
  const old = deferred();
  const h = harness({ ticker: q => q === 'A' ? old.promise : Promise.resolve({ q }) });
  const a = h.submit('A');
  await h.submit('B');
  old.resolve({ q: 'A' });
  await a;
  assert.deepEqual(h.log.filter(x => x[0] === 'start'), [['start', 'B']]);
});

test('single question still follows first-card success and does not start fallback', async () => {
  const h = harness({ first: async () => true });
  await h.submit('single');
  assert.deepEqual(h.log.filter(x => x[0] !== 'clear'), []);
});

test('async renderers and manual map navigation honor question generation', () => {
  assert.match(html, /async function mtFirstCard\(q,isCurrent\)/);
  assert.match(html, /const data=await F\.fetchData\(plan,mtGet\);if\(!isCurrent\(\)\)return false/);
  assert.match(html, /async function mtIntentCard\(q,isCurrent\)/);
  assert.match(html, /let a=await A\.get\(pl\.symbol,pl\.intent,pl\.period\);if\(!isCurrent\(\)\|\|!a\)return false/);
  assert.match(html, /if\(c&&isCurrent\(\)\)\{window\.MTMood\.render/);
  assert.match(html, /MTOpinions\.render\(opinionSlot,/);
  assert.match(html, /function start\(c\)\{\+\+mtQueryEpoch;/);
  assert.match(html, /\$\('world'\)\.onclick=\(\)=>\{\+\+mtQueryEpoch;/);
});
