'use strict';
/* world-intelligence/index.html 인라인 스크립트가 문법 오류 없이 첫 화면 모듈과 이어져 있는지 확인. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.resolve(__dirname, '../world-intelligence/index.html'), 'utf8');

test('inline scripts parse', () => {
  const re = /<script(?![^>]*\bsrc)[^>]*>([\s\S]*?)<\/script>/g;
  let m, n = 0;
  while ((m = re.exec(html))) { n++; assert.doesNotThrow(() => new vm.Script(m[1], { filename: 'inline' + n })); }
  assert.ok(n > 3);
});

test('page loads firstscreen.js, has the mount point, and tries the new screen before the old card', () => {
  assert.match(html, /assets\/firstscreen\.js/);
  assert.match(html, /id="mtFirst"/);
  assert.match(html, /clearFirst\(\);if\(await mtFirstCard\(q\)\)return;if\(await mtIntentCard\(q\)\)return;/);
});
