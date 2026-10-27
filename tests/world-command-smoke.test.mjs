import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const html = readFileSync(new URL('../world-intelligence/index.html', import.meta.url), 'utf8');
// 7b8cbca (10/27) retired this page into a redirect to the single US command map (tested by command-check.yml).
const retired = /http-equiv="refresh"/.test(html) && html.includes('usa-command.html');

test('retired world command page redirects to usa-command.html', { skip: !retired }, () => {
  assert.match(html, /url=\.\.\/usa-command\.html/);
  assert.match(html, /location\.replace\("\.\.\/usa-command\.html"\+location\.search\+location\.hash\)/);
});

test('world command HTML retains map and command controls', { skip: retired }, () => {
  for (const id of ['map', 'mapFrame', 'ask', 'question', 'topics', 'brief', 'candidatePanel', 'candidateList', 'world', 'next', 'previous']) {
    assert.match(html, new RegExp('id="' + id + '"'), 'missing #' + id);
  }
});

test('real map uses no-key OSM and does not repeat world tiles', { skip: retired }, () => {
  assert.match(html, /tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(html, /noWrap:true/);
  assert.match(html, /worldCopyJump:false/);
  assert.doesNotMatch(html, /cartocdn\.com|API KEY REQUIRED/);
});

test('questions require an explicit route selection before tracking', { skip: retired }, () => {
  assert.match(html, /function showCandidates\(q\)/);
  assert.match(html, /cases\.filter\(c=>c\.re\.test\(q\)\)/);
  assert.match(html, /b\.addEventListener\('click',\(\)=>start\(c\)\)/);
  assert.match(html, /\$\('ask'\)\.addEventListener\('submit',e=>\{e\.preventDefault\(\)/);
  assert.match(html, /L\.polyline\(/);
});

test('prototype discloses disconnected AI and trade data without verified claims', { skip: retired }, () => {
  assert.match(html, /AI 분석 미연결/);
  assert.match(html, /실시간 거래 데이터 미연결/);
  assert.match(html, /DEMO CONTEXT/);
  assert.doesNotMatch(html, /VERIFIED CONTEXT/);
});

test('every inline script is valid JavaScript', { skip: retired }, () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x => x[1]).filter(Boolean);
  assert.ok(scripts.length >= 3);
  for (const [i, source] of scripts.entries()) {
    assert.doesNotThrow(() => new Script(source, { filename: 'inline-' + i + '.js' }));
  }
});
