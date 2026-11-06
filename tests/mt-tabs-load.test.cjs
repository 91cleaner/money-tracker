'use strict';
// Browser-like unit regression tests for the Korean US room tab loader.
// Run: node --test tests/mt-tabs-load.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/mt-tabs.js'), 'utf8');
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const daily = (url) => url.includes('/daily/index.json')
  ? ok({ latest: '2026-11-05' }) : ok({ cards: [] });

function mount(fetcher, options = {}) {
  const buttons = [];
  const todayNode = options.today ? { className: '', attached: true, inPanel: false } : null;
  let todayAvailable = !!(todayNode && !options.delayTodayRetry);
  let lateTodayTimer = null;
  const panel = {
    html: '', retry: null,
    set innerHTML(value) {
      this.html = value;
      if (todayNode && todayNode.inPanel) { todayNode.attached = false; todayNode.inPanel = false; }
      this.retry = value.includes('id="tbRetry"') ? {} : null;
    },
    get innerHTML() { return this.html; },
    querySelector(selector) { return selector === '#tbRetry' ? this.retry : null; },
    replaceChildren(child) {
      if (todayNode && child === todayNode) { todayNode.attached = true; todayNode.inPanel = true; this.html = 'TODAY_WIDGET'; }
      this.retry = null;
    }
  };
  const bar = { append(button) { buttons.push(button); }, querySelectorAll() { return buttons; } };
  const hero = { textContent: '' };
  const root = {
    setAttribute() {},
    contains(element) { return !!(todayNode && element === todayNode && todayNode.attached && todayNode.inPanel); },
    querySelector(selector) {
      if (selector === '#mtTabBar') return bar;
      if (selector === '#tbPanel') return panel;
      if (['#tbClk', '#tbHeroN', '#tbHeroL'].includes(selector)) return hero;
      return null;
    }
  };
  const body = { append(element) { element.parentNode = body; } };
  const document = {
    head: { append() {} }, body, readyState: 'complete',
    createElement(tag) {
      if (tag === 'section') return root;
      if (tag === 'button') return { dataset: {}, setAttribute() {} };
      return { textContent: '' };
    },
    getElementById(id) { return id === 'mtToday' && todayNode && todayNode.attached && todayAvailable ? todayNode : null; }
  };
  vm.runInNewContext(source, {
    window: { MTI18N: { isEn: false } }, document,
    location: { search: '' }, URLSearchParams, URL,
    matchMedia: () => ({ matches: false }),
    setInterval() {}, setTimeout(callback, delay) {
      if (options.delayTodayRetry && delay === 2500) { lateTodayTimer = callback; return; }
      callback();
    },
    addEventListener() {}, fetch: fetcher
  }, { filename: 'mt-tabs.js' });
  return {
    panel, hero,
    revealToday() {
      assert.ok(todayNode && lateTodayTimer, 'late Today widget and boot retry are configured');
      todayAvailable = true;
      lateTodayTimer();
    },
    click(id) {
      const button = buttons.find((b) => b.dataset.t === id);
      assert.ok(button, 'tab ' + id + ' exists');
      return button.onclick();
    },
    retry() {
      assert.ok(panel.retry && panel.retry.onclick, 'retry control exists');
      return panel.retry.onclick();
    }
  };
}

test('script parses', () => {
  assert.doesNotThrow(() => new vm.Script(source, { filename: 'mt-tabs.js' }));
});

test('HTTP failure never becomes a false zero, and retry recovers', async () => {
  let failing = true;
  const app = mount(async (url) => url.includes('trades-recent')
    ? failing ? { ok: false, status: 503, json: async () => ({ trades: [] }) }
      : ok({ trades: [{ who: 'Example', tk: 'NVDA', d: '2026-11-01', fd: '2026-11-03', amt: '$1', ty: 'P' }] })
    : daily(url));
  await app.click('mem');
  assert.match(app.panel.html, /불러오지 못했습니다/);
  assert.doesNotMatch(app.panel.html, /신고 0건/);
  failing = false;
  await app.retry();
  assert.match(app.panel.html, /신고 1건/);
});

test('network rejection and invalid JSON are unavailable, not zero', async () => {
  for (const failing of [
    async () => { throw new Error('offline'); },
    async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad JSON'); } })
  ]) {
    const app = mount((url) => url.includes('whitehouse') ? failing() : daily(url));
    await app.click('wh');
    assert.match(app.panel.html, /불러오지 못했습니다/);
    assert.doesNotMatch(app.panel.html, /문서 0건/);
  }
});

test('missing arrays fail closed, while valid empty arrays may show zero', async () => {
  let app = mount(async (url) => url.includes('trades-recent') ? ok({ missing: true }) : daily(url));
  await app.click('mem');
  assert.match(app.panel.html, /불러오지 못했습니다/);
  app = mount(async (url) => url.includes('whitehouse') ? ok({ items: [] }) : daily(url));
  await app.click('wh');
  assert.match(app.panel.html, /대통령 문서 0건/);
});

test('late previous tab response cannot overwrite the current tab', async () => {
  let resolveOld;
  const oldRequest = new Promise((resolve) => { resolveOld = resolve; });
  const app = mount(async (url) => {
    if (url.includes('trades-recent')) return oldRequest;
    if (url.includes('whitehouse')) return ok({ items: [
      { kind: 'presdoc', date: '2026-11-04', u: 'https://www.federalregister.gov/', type: 'Executive order' }
    ] });
    return daily(url);
  });
  const first = app.click('mem');
  await app.click('wh');
  resolveOld(ok({ trades: [] }));
  await first;
  assert.match(app.panel.html, /대통령 문서 1건/);
  assert.doesNotMatch(app.panel.html, /의원 주식 신고/);
});


test('pending loads show a visible status, not stale data or zero', async () => {
  let resolvePTR;
  const pendingPTR = new Promise((resolve) => { resolvePTR = resolve; });
  const app = mount((url) => url.includes('trades-recent')
    ? pendingPTR : Promise.resolve(daily(url)));
  const loading = app.click('mem');
  assert.match(app.panel.html, /공개 자료를 불러오는 중/);
  assert.doesNotMatch(app.panel.html, /신고 0건/);
  resolvePTR(ok({ trades: [{ who: 'Example', tk: 'AAPL', d: '2026-11-01', fd: '2026-11-04', amt: '$100', ty: 'P' }] }));
  await loading;
  assert.match(app.panel.html, /신고 1건/);
  assert.doesNotMatch(app.panel.html, /공개 자료를 불러오는 중/);
});

test('HTTP 404 is unavailable, and retry after a tab switch cannot replace the active view', async () => {
  let rejectOld;
  const oldRequest = new Promise((_, reject) => { rejectOld = reject; });
  const app = mount((url) => url.includes('trades-recent')
    ? oldRequest : Promise.resolve(daily(url)));
  const pending = app.click('mem');
  await app.click('find');
  assert.match(app.panel.html, /많이 찾는 종목/);
  rejectOld(new Error('offline'));
  await pending;
  assert.match(app.panel.html, /많이 찾는 종목/);
  assert.doesNotMatch(app.panel.html, /불러오지 못했습니다/);

  const failed = mount(async (url) => url.includes('whitehouse')
    ? { ok: false, status: 404, json: async () => ({ items: [] }) }
    : daily(url));
  await failed.click('wh');
  assert.match(failed.panel.html, /불러오지 못했습니다/);
  assert.doesNotMatch(failed.panel.html, /대통령 문서 0건/);
});

test('malformed daily index shows unavailable instead of a fabricated summary', async () => {
  const app = mount(async (url) => url.includes('/daily/index.json')
    ? ok({ latest: '../private' }) : daily(url));
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(app.hero.textContent, /일일 요약 자료를 불러오지 못했습니다/);
  assert.doesNotMatch(app.hero.textContent, /의원 주식 신고/);
});

test('malformed cached rows do not poison retry after the source recovers', async () => {
  for (const tab of ['mem', 'wh']) {
    let requests = 0;
    const app = mount(async (url) => {
      if (url.includes('trades-recent') && tab === 'mem') {
        requests++;
        return requests === 1 ? ok({ trades: [null] })
          : ok({ trades: [{ who: 'Example', tk: 'NVDA', d: '2026-11-01', fd: '2026-11-03', amt: '$1', ty: 'P' }] });
      }
      if (url.includes('whitehouse') && tab === 'wh') {
        requests++;
        return requests === 1 ? ok({ items: [null] })
          : ok({ items: [{ kind: 'presdoc', date: '2026-11-05', u: 'https://www.federalregister.gov/', type: 'Executive order' }] });
      }
      return daily(url);
    });
    await app.click(tab);
    assert.match(app.panel.html, /불러오지 못했습니다/);
    await app.retry();
    assert.equal(requests, 2, 'retry must refetch after a malformed row');
    assert.match(app.panel.html, tab === 'mem' ? /신고 1건/ : /대통령 문서 1건/);
  }
});

test('unsafe filing URLs are displayed as non-clickable text', async () => {
  const app = mount(async (url) => url.includes('whitehouse')
    ? ok({ items: [
      { kind: 'presdoc', date: '2026-11-05', u: 'javascript:alert(1)', type: 'Unsafe document' },
      { kind: 'presdoc', date: '2026-11-04', u: 'https://www.federalregister.gov/', type: 'Official document' }
    ] })
    : daily(url));
  await app.click('wh');
  assert.match(app.panel.html, /<div class="tbRow"><span class="l">Unsafe document/);
  assert.doesNotMatch(app.panel.html, /href="javascript:/);
  assert.match(app.panel.html, /href="https:\/\/www\.federalregister\.gov\//);
});

test('Today widget can be restored after switching away and back', async () => {
  const app = mount(async (url) => daily(url), { today: true });
  await app.click('today');
  assert.equal(app.panel.html, 'TODAY_WIDGET');
  await app.click('find');
  assert.match(app.panel.html, /많이 찾는 종목/);
  await app.click('today');
  assert.equal(app.panel.html, 'TODAY_WIDGET');
});

test('ranking tab refreshes when the delayed daily snapshot arrives', async () => {
  let resolveDaily;
  const delayed = new Promise((resolve) => { resolveDaily = resolve; });
  const app = mount(async (url) => url.includes('/daily/index.json')
    ? ok({ latest: '2026-11-05' }) : delayed);
  await app.click('rank');
  assert.match(app.panel.html, /순위 자료를 불러오는 중/);
  resolveDaily(ok({ cards: [], snap: { 'federal-awards.json': { NVDA: 1234 } } }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(app.panel.html, /NVDA/);
  assert.match(app.panel.html, /정부 계약 금액/);
});


test('official-source HTTPS hostnames are exact; lookalikes and insecure URLs are non-clickable', async () => {
  const app = mount(async (url) => url.includes('whitehouse')
    ? ok({ items: [
      { kind: 'presdoc', date: '2026-11-05', u: 'https://www.federalregister.gov.evil.example/doc', type: 'Fake subdomain' },
      { kind: 'presdoc', date: '2026-11-05', u: 'https://www.whitehouse.gov@evil.example/doc', type: 'Credential spoof' },
      { kind: 'presdoc', date: '2026-11-05', u: 'http://www.federalregister.gov/doc', type: 'Plain HTTP' },
      { kind: 'presdoc', date: '2026-11-05', u: 'https://www.federalregister.gov:8443/doc', type: 'Unexpected port' },
      { kind: 'presdoc', date: '2026-11-05', u: 'https://evil.example/doc', type: 'Non-government host' },
      { kind: 'presdoc', date: '2026-11-05', u: 'https://www.federalregister.gov/doc', type: 'Federal Register original' },
      { kind: 'presdoc', date: '2026-11-05', u: 'https://www.whitehouse.gov/briefing-room/', type: 'White House original' }
    ] })
    : daily(url));
  await app.click('wh');
  for (const label of ['Fake subdomain', 'Credential spoof', 'Plain HTTP', 'Unexpected port', 'Non-government host']) {
    assert.ok(app.panel.html.includes('<div class="tbRow"><span class="l">' + label), label + ' must be non-clickable');
  }
  assert.equal((app.panel.html.match(/<a class="tbRow" href=/g) || []).length, 2, 'only official HTTPS rows link');
  assert.match(app.panel.html, /href="https:\/\/www\.federalregister\.gov\/doc"/);
  assert.match(app.panel.html, /href="https:\/\/www\.whitehouse\.gov\/briefing-room\/"/);
});

test('House PTR original links accept only the official Clerk HTTPS origin', async () => {
  const app = mount(async (url) => url.includes('trades-recent')
    ? ok({ trades: [
      { who: 'Fake', tk: '', d: '2026-11-01', fd: '2026-11-05', amt: '$1', ty: 'P', doc: 'https://disclosures-clerk.house.gov.evil.example/public_disc/ptr.pdf' },
      { who: 'Official', tk: '', d: '2026-11-01', fd: '2026-11-05', amt: '$1', ty: 'P', doc: 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/example.pdf' }
    ] })
    : daily(url));
  await app.click('mem');
  assert.match(app.panel.html, /<div class="tbRow"><span class="l">Fake/);
  assert.match(app.panel.html, /href="https:\/\/disclosures-clerk\.house\.gov\/public_disc\/ptr-pdfs\/2026\/example\.pdf"/);
  assert.equal((app.panel.html.match(/<a class="tbRow" href=/g) || []).length, 1);
});


test('late Today widget must not override a tab chosen by the user', async () => {
  const app = mount(async (url) => daily(url), { today: true, delayTodayRetry: true });
  await app.click('find');
  assert.match(app.panel.html, /많이 찾는 종목/);
  app.revealToday(); // simulates the delayed 2.5-second boot check
  assert.match(app.panel.html, /많이 찾는 종목/, 'late widget must not force the Today tab');
  assert.doesNotMatch(app.panel.html, /TODAY_WIDGET/);
  await app.click('today');
  assert.equal(app.panel.html, 'TODAY_WIDGET', 'widget is still available on explicit return');
});

test('late Today widget is restored when Today remains selected', async () => {
  const app = mount(async (url) => daily(url), { today: true, delayTodayRetry: true });
  assert.match(app.panel.html, /오늘의 기록을 불러오는 중/);
  app.revealToday();
  assert.equal(app.panel.html, 'TODAY_WIDGET');
});
