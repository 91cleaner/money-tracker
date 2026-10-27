import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Script } from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const html = read('world-intelligence/index.html');
// 7b8cbca (10/27) retired the separate world map into a redirect to usa-command.html (checked by command-check.yml).
const retired = /http-equiv="refresh"/.test(html) && html.includes('usa-command.html');

test('retired world map redirects to an existing US command map', { skip: !retired }, () => {
  assert.ok(existsSync(new URL('usa-command.html', root)), 'redirect target missing');
  assert.match(html, /location\.replace\("\.\.\/usa-command\.html"/);
});

test('every inline world-map script compiles', { skip: retired }, () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).filter(script => script.trim());
  assert.ok(scripts.length >= 5, 'expected multiple world-map controllers');
  scripts.forEach((script, index) => assert.doesNotThrow(
    () => new Script(script, { filename: 'world-map-inline-' + index + '.js' })
  ));
});

test('one map container and source-backed law-to-sponsor path exist', { skip: retired }, () => {
  assert.equal((html.match(/id="realEarth"/g) || []).length, 1);
  assert.match(html, /function showSponsor\(b\)/);
  assert.match(html, /billsCache\?\.recent\?\.\[b\.member\]/);
  assert.match(html, /showSponsor\(b\)/);
  assert.match(html, /실거래 데이터 연결 전/);
});

test('Congress.gov legislation archive has source-backed records', () => {
  const data = JSON.parse(read('data/us/bills.json'));
  assert.ok(data.recent && typeof data.recent === 'object');
  const rows = Object.values(data.recent).flat();
  assert.ok(rows.length > 0, 'legislation archive is empty');
  const sourced = rows.filter(row => row && row.u);
  assert.ok(sourced.length > 0, 'no source links');
  for (const row of sourced.slice(0, 100)) {
    assert.match(row.u, /^https:\/\/www\.congress\.gov\/bill\//);
  }
});

test('House trade archive is not silently accepted without official PDF evidence', () => {
  // Machine-parsed candidates moved to their own file in 657a1192a; data/us/trades.json is the disclosure archive.
  const path = new URL('data/us/house-ptr-candidates.json', root);
  if (!existsSync(path) || !readFileSync(path).length) return;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  assert.ok(Array.isArray(data.records), 'candidate archive requires records array');
  for (const row of data.records) {
    assert.match(row.source_pdf || '', /^https:\/\/disclosures-clerk\.house\.gov\/public_disc\/ptr-pdfs\//);
    assert.ok(row.transaction_date && row.filing_id);
    assert.ok(['P', 'S', 'E'].includes(row.type));
    assert.ok(Number.isFinite(row.amount_min_usd) && Number.isFinite(row.amount_max_usd));
    assert.ok(row.amount_max_usd >= row.amount_min_usd);
    assert.equal(row.verification, 'machine_parsed_requires_review');
  }
});
