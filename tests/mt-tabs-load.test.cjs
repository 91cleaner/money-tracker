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

function mount(fetcher) {
  const buttons = [];
  const panel = {
    html: '', retry: null,
    set innerHTML(value) {
      this.html = value;
      this.retry = value.includes('id="tbRetry"') ? {} : null;
    },
    get innerHTML() { return this.html; },
    querySelector(selector) { return selector === '#tbRetry' ? this.retry : null; },
    replaceChildren() {}
  };
  const bar = { append(button) { buttons.push(button); }, querySelectorAll() { return buttons; } };
  const hero = { textContent: '' };
  const root = {
    setAttribute() {},
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
    getElementById() { return null; }
  };
  vm.runInNewContext(source, {
    window: { MTI18N: { isEn: false } }, document,
    location: { search: '' }, URLSearchParams,
    matchMedia: () => ({ matches: false }),
    setInterval() {}, setTimeout(callback) { callback(); },
    addEventListener() {}, fetch: fetcher
  }, { filename: 'mt-tabs.js' });
  return {
    panel,
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
