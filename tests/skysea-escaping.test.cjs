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
