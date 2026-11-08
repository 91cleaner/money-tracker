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
  assert.match(html, /window\.MTMood\.show\(moodSlot,/);
  assert.match(html, /MTOpinions\.render\(opinionSlot,/);
  assert.match(html, /function start\(c\)\{\+\+mtQueryEpoch;/);
  assert.match(html, /\$\('world'\)\.onclick=\(\)=>\{\+\+mtQueryEpoch;/);
});


// Exercise the real precomputed-answer renderer, not a stand-in URL filter.
function intentSourceHarness(src) {
  const begin = html.indexOf('async function mtIntentCard(');
  const end = html.indexOf("\n$('previous').onclick=", begin);
  assert.ok(begin >= 0 && end > begin, 'intent answer handler must exist');
  const elements = {};
  const $ = id => {
    if (!elements[id]) elements[id] = {
      children: [],
      append(child) { this.children.push(child); },
      replaceChildren() { this.children = []; },
      removeAttribute() {}
    };
    return elements[id];
  };
  const context = {
    $,
    URL,
    document: { createElement: tag => ({ tag, style: {} }) },
    loadIdx: async () => ({ entities: { 'company:NVDA': { aliases: [] } } }),
    window: {
      mtLex: {},
      MTIntent: { build: () => ({}), parse: () => ({}) },
      MTAnswers: {
        setBase() {},
        plan: () => ({ symbol: 'NVDA', intent: 'why', period: '1m' }),
        get: async () => ({ name: 'NVIDIA', ko: ['Valid answer stays visible'], src })
      }
    },
    routeOf: () => null,
    start() {}
  };
  vm.runInNewContext(html.slice(begin, end) + '\nthis.runIntent=mtIntentCard;', context, { timeout: 1000 });
  return { elements, run: () => context.runIntent('NVIDIA why', () => true) };
}

test('malformed source URLs cannot discard a valid world-search answer', async () => {
  const official = 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20033889.pdf';
  const h = intentSourceHarness(['https:', 'https://[', 'javascript:alert(1)', 'https://user:secret@sec.gov/x', null, official]);
  assert.equal(await h.run(), true);
  assert.equal(h.elements.briefText.textContent, 'Valid answer stays visible');
  const links = h.elements.briefStocks.children.filter(x => x.tag === 'a');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, official);
  assert.equal(links[0].rel, 'noopener noreferrer');
});

test('all-invalid sources preserve answer with visible verification-pending label', async () => {
  const h = intentSourceHarness(['https:', 'http://example.com', 'https://user:pw@example.com']);
  assert.equal(await h.run(), true);
  assert.equal(h.elements.briefText.textContent, 'Valid answer stays visible');
  assert.equal(h.elements.briefStocks.children.filter(x => x.tag === 'a').length, 0);
  assert.ok(h.elements.briefStocks.children.some(x => /검증 대기/.test(x.textContent || '')));
});

test('missing or malformed source collection does not hide the answer', async () => {
  for (const src of [undefined, 'https://example.com', { href: 'https://example.com' }]) {
    const h = intentSourceHarness(src);
    assert.equal(await h.run(), true);
    assert.equal(h.elements.briefText.textContent, 'Valid answer stays visible');
    assert.ok(h.elements.briefStocks.children.some(x => /검증 대기/.test(x.textContent || '')));
  }
});


test('lookalike HTTPS hosts never become clickable official or market sources', async () => {
  const h = intentSourceHarness([
    'https://disclosures-clerk.house.gov.evil.example/public_disc/ptr.pdf',
    'https://finance.yahoo.com.evil.example/quote/NVDA',
    'https://example.com/pretend-official',
    'https://www.congress.gov:8443/bill/1'
  ]);
  assert.equal(await h.run(), true);
  assert.equal(h.elements.briefText.textContent, 'Valid answer stays visible');
  assert.equal(h.elements.briefStocks.children.filter(x => x.tag === 'a').length, 0);
  assert.ok(h.elements.briefStocks.children.some(x => /검증 대기/.test(x.textContent || '')));
});

test('official-domain and third-party price sources are labeled distinctly', async () => {
  const official = 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20033889.pdf';
  const yahoo = 'https://finance.yahoo.com/quote/NVDA';
  const h = intentSourceHarness([official, yahoo]);
  assert.equal(await h.run(), true);
  const links = h.elements.briefStocks.children.filter(x => x.tag === 'a');
  assert.equal(links.length, 2);
  assert.deepEqual(links.map(x => x.href), [official, yahoo]);
  assert.match(links[0].textContent, /정부기관 도메인 참고.*내용 미검증/);
  assert.match(links[1].textContent, /민간 시세 참고/);
  assert.ok(links.every(x => x.rel === 'noopener noreferrer'));
});

test('mixed valid and spoofed sources keep valid answer and flag unverified links', async () => {
  const h = intentSourceHarness([
    'https://finance.yahoo.com/quote/NVDA',
    'https://www.whitehouse.gov.evil.example/briefing',
    'https://user:password@www.congress.gov/bill/1'
  ]);
  assert.equal(await h.run(), true);
  assert.equal(h.elements.briefText.textContent, 'Valid answer stays visible');
  const links = h.elements.briefStocks.children.filter(x => x.tag === 'a');
  assert.equal(links.length, 1);
  assert.match(links[0].textContent, /민간 시세 참고/);
  assert.ok(h.elements.briefStocks.children.some(x => /검증 대기/.test(x.textContent || '')));
});
