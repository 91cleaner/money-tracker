'use strict';
/* Integrity checks for data/market/sectors.json (sector → factor map) and data/market/calendar.json (official dates). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const json = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const sectors = json('data/market/sectors.json');
const calendar = json('data/market/calendar.json');
const topicIds = [...fs.readFileSync(path.join(root, 'collector/world/topics.py'), 'utf8').matchAll(/\{"id": "([a-z_]+)"/g)].map(m => m[1]);
const https = u => /^https:\/\/[a-z0-9.-]+\//i.test(u || '');

test('every factor has a source link, and collected factors point at real data', () => {
  const ids = new Set();
  for (const f of sectors.factors) {
    assert.ok(!ids.has(f.id), 'duplicate factor ' + f.id); ids.add(f.id);
    assert.ok(['collected', 'planned'].includes(f.status), f.id + ' status');
    assert.ok(https(f.source_url), f.id + ' source_url');
    if (f.market) assert.ok(fs.existsSync(path.join(root, 'data/markets', f.market + '.json')), f.id + ' market file ' + f.market);
    if (f.data) {
      const d = json(f.data.file);
      if (f.data.series) assert.ok(d.series && d.series[f.data.series], f.id + ' series ' + f.data.series + ' in ' + f.data.file);
      if (f.data.company) assert.ok(d.history && d.history[f.data.company], f.id + ' company ' + f.data.company + ' in ' + f.data.file);
      if (f.data.list) assert.ok(Array.isArray(d[f.data.list]) && d[f.data.list].length, f.id + ' list ' + f.data.list + ' in ' + f.data.file);
      assert.ok(f.data.series || f.data.company || f.data.list, f.id + ' data link needs series, company or list');
    }
    if (f.status === 'collected') assert.ok(f.data || f.market, f.id + ' collected but no data link');
  }
});

test('sectors only reference known factors, law topics and market files', () => {
  const factorIds = new Set(sectors.factors.map(f => f.id));
  assert.ok(topicIds.length >= 10, 'law topics parsed from collector/world/topics.py');
  assert.ok(sectors.sectors.length >= 12, 'covers the whole market, not only semiconductors');
  for (const s of sectors.sectors) {
    for (const f of s.factors) assert.ok(factorIds.has(f), s.id + ' -> unknown factor ' + f);
    for (const t of s.law_topics) assert.ok(topicIds.includes(t), s.id + ' -> unknown law topic ' + t);
    for (const m of s.markets) assert.ok(fs.existsSync(path.join(root, 'data/markets', m + '.json')), s.id + ' -> missing data/markets/' + m + '.json');
  }
});

test('reference map stays neutral (no forecast or advice wording)', () => {
  const text = JSON.stringify(sectors);
  assert.match(sectors.about, /예상·추천이 아니며/);
  assert.doesNotMatch(text, /매수|매도|추천 종목|오를 것|내릴 것|목표가|buy signal|sell signal/i);
});

test('calendar events are official, dated, sorted and not running out', () => {
  let prev = '';
  for (const e of calendar.events) {
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/); assert.match(e.start, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(e.start <= e.date, 'start before date ' + e.date);
    assert.ok(e.date >= prev, 'sorted at ' + e.date); prev = e.date;
    assert.ok(https(e.source_url), 'source for ' + e.title + ' ' + e.date);
    assert.match(e.source_url, /federalreserve\.gov|ecb\.europa\.eu|boj\.or\.jp|bok\.or\.kr/, 'official central-bank source only');
  }
  for (const r of calendar.recurring) assert.ok(https(r.source_url), r.id);
  // Central banks publish a year at a time. Fail ~2 months before the list runs out so someone adds next year's dates.
  const soon = new Date(Date.now() + 60 * 86400e3).toISOString().slice(0, 10);
  assert.ok(prev >= soon, 'calendar ends ' + prev + ' — add next year\'s official dates to data/market/calendar.json');
});

test('sectors, factors and calendar are in the offline search index with sources', async () => {
  const { marketReferenceDocuments } = await import('../scripts/market-reference-index.mjs');
  const docs = marketReferenceDocuments(sectors, calendar, () => null, t => t);
  assert.equal(docs.filter(d => d.type === 'sector').length, sectors.sectors.length);
  assert.equal(docs.filter(d => d.type === 'factor').length, sectors.factors.length);
  assert.equal(docs.filter(d => d.type === 'calendar').length, calendar.events.length);
  for (const d of docs) { assert.ok(https(d.url), d.id + ' url'); assert.doesNotMatch(d.summary, /매수|매도|오를 것|내릴 것/); }
  const index = json('data/search/index.json');
  const ids = new Set(index.documents.map(d => d.id));
  for (const id of ['sector-semiconductor', 'factor-us_policy_rate', 'calendar-us-2026-12-09']) assert.ok(ids.has(id), 'index has ' + id + ' (run node scripts/build-local-index.mjs)');
});

test('US trade-control notices are searchable with official links', async () => {
  const { tradeControlDocuments } = await import('../scripts/market-reference-index.mjs');
  const file = json('data/market/factors/us-trade-controls.json');
  const docs = tradeControlDocuments(file);
  assert.equal(docs.length, file.documents.length);
  for (const d of docs) assert.match(d.url, /^https:\/\/www\.federalregister\.gov\//);
  assert.ok(docs.some(d => d.aliases.includes('중국')), 'China-related notices carry the 중국 alias');
});

test('China MOFCOM announcements are searchable with official links', async () => {
  const { mofcomDocuments } = await import('../scripts/market-reference-index.mjs');
  const file = json('data/market/factors/cn-mofcom-announcements.json');
  const docs = mofcomDocuments(file);
  assert.ok(docs.length >= 1 && docs.length === file.items.length);
  for (const d of docs) { assert.match(d.url, /^https:\/\/www\.mofcom\.gov\.cn\//); assert.ok(d.aliases.includes('중국')); }
});
