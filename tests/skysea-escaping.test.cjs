'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'skysea.html'), 'utf8');

test('SkySea inline scripts parse', () => {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs]) => !/\bsrc\s*=/.test(attrs));
  assert.ok(scripts.length > 0);
  scripts.forEach(([, , code], i) => assert.doesNotThrow(
    () => new vm.Script(code, { filename: 'skysea-inline-' + i + '.js' })
  ));
});

test('SkySea escaping helper neutralizes telemetry HTML', () => {
  const line = html.split('\n').find(s => s.trim().startsWith('const esc ='));
  assert.ok(line, 'shared HTML escape helper exists');
  const esc = vm.runInNewContext(line + '\nesc');
  assert.equal(esc("<img src=x onerror='alert(1)'>&"),
    '&lt;img src=x onerror=&#39;alert(1)&#39;&gt;&amp;');
});

test('aircraft and AIS click details escape untrusted text and numeric slots', () => {
  for (const marker of [
    '${esc(name)}</div>등록 나라:',
    '고도: ${esc(fmt(alt))}',
    '속도: ${esc(fmt(gs))}',
    '방향 ${esc(tr || 0)}도',
    "기체: ${esc(ty || '정보 없음')} · 고유 번호 ${esc(String(hex).toUpperCase())}",
    "${esc(nm || '이름 없는 배')}</div>나라:",
    '종류: ${esc(ty)}',
    '속도: ${esc(sog)} kt · 방향 ${esc(hd)}도'
  ]) assert.ok(html.includes(marker), marker);
});

test('country search results escape GeoJSON-backed names and codes', () => {
  assert.ok(html.includes('${esc(e.ko)} <span style="opacity:.6">${esc(e.cc)}</span>'));
});


// Exercise the actual template literals, not only their source markers. This
// catches regressions where an escape call is present elsewhere on the line
// but the user-visible HTML interpolates raw feed values.
const escLine = html.split('\n').find(s => s.trim().startsWith('const esc ='));
const escapeHtml = vm.runInNewContext(escLine + '\nesc');
const hostile = '<img src=x onerror=alert(1)>';

function detailTemplate(marker) {
  const line = html.split('\n').find(s => s.includes(marker));
  assert.ok(line, 'SkySea detail renderer: ' + marker);
  const match = line.match(/innerHTML = (\x60[^\x60]*\x60);/);
  assert.ok(match, 'HTML detail template found: ' + marker);
  return match[1];
}

function assertHostileEscaped(rendered) {
  assert.doesNotMatch(rendered, /<img\b/i, 'untrusted HTML must not become an element');
  assert.ok(rendered.includes('&lt;img src=x onerror=alert(1)&gt;'),
    'hostile value should remain visible as escaped text');
}

test('rendered SkySea aircraft detail escapes hostile feed fields', () => {
  const output = vm.runInNewContext(detailTemplate('planeRec.push({'), {
    esc: escapeHtml, name: hostile, hex: hostile, ty: hostile,
    alt: hostile, gs: hostile, tr: hostile, mil: false,
    cc: 'US', NM: { US: 'United States' }, fmt: x => x
  });
  assertHostileEscaped(output);
});

test('rendered SkySea AIS vessel detail escapes hostile feed fields', () => {
  const output = vm.runInNewContext(detailTemplate('liveRec.push({'), {
    esc: escapeHtml, nm: hostile, ty: hostile, sog: hostile,
    hd: hostile, cc: 'XX', NM: {}, live: { updated: '2026-11-06' },
    kstL: () => '21:00'
  });
  assertHostileEscaped(output);
});

test('rendered country-search button escapes hostile GeoJSON labels', () => {
  const line = html.split('\n').find(s => s.includes("r.map((e, i) =>"));
  assert.ok(line, 'country result renderer exists');
  const match = line.match(/r\.map\(\(e, i\) => (\x60[^\x60]*\x60)\)\.join\(''\)/);
  assert.ok(match, 'country result template found');
  const output = vm.runInNewContext(match[1], {
    esc: escapeHtml, e: { ko: hostile, cc: hostile }, i: 0
  });
  assertHostileEscaped(output);
});
