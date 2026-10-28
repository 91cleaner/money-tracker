'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const usa = read('usa-command.html');
const index = read('index.html');
const command = read('assets/mt-command-ui.js');

test('US command inline JavaScript parses', () => {
  const inline = [...usa.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs]) => !/\bsrc\s*=/.test(attrs));
  assert.ok(inline.length > 0);
  inline.forEach(([, , source], i) => assert.doesNotThrow(
    () => new vm.Script(source, { filename: 'usa-command.inline-' + i + '.js' })
  ));
});

test('one map: question -> evidence selection -> route (no automatic invented answer)', () => {
  for (const marker of ['class="pg-map"', 'id="usCmd"', 'id="usQuery"', 'id="usFile"']) {
    assert.ok(usa.includes(marker), marker);
  }
  assert.match(usa, /assets\/mt-command-ui\.js\?v=/);
  assert.match(usa, /assets\/mt-research-ui\.js\?v=/);
  assert.match(command, /form\.addEventListener\("submit"/);
  assert.match(command, /window\.MTResearch\.show\(q\)/);
  assert.match(command, /function selectMission\(id\)/);
  assert.match(command, /function selectStep\(index\)/);
  assert.match(command, /map\.flyTo\(/);
  assert.match(command, /getCurrent:function/);
  assert.doesNotMatch(usa, /<button[^>]*data-w="(?:us|world|kr)"/);
});

test('actual satellite tiles and failure-tolerant map tiles are wired in command JS', () => {
  assert.match(command, /World_Imagery\/MapServer\/tile/);
  assert.match(command, /World_Boundaries_and_Places\/MapServer\/tile/);
  assert.match(command, /map\.on\("zoom zoomend",syncSatellite\)/);
  assert.match(command, /sat\.setOpacity\(opacity\)/);
  assert.match(command, /satLabels\.setOpacity\(opacity\*\.86\)/);
  assert.match(command, /dark\.on\("tileerror"/);
  assert.match(command, /tile\.openstreetmap\.org/);
});

test('user zoom stops the scripted flight and the map stays inside the drawn world', () => {
  // A zoom by wheel, +/- button, double-click, pinch or keyboard must cancel the flight, or its next phase undoes the zoom.
  assert.match(command, /function userTookZoom\(\)\{if\(!flight\.hidden\)cancelTravel\(\);\}/);
  for (const ev of ['"wheel",userTookZoom', '"dblclick",userTookZoom', '"touchstart"', '"keydown"', '"pointerdown",userTookZoom']) {
    assert.ok(command.includes(ev), ev);
  }
  assert.match(command, /var zoomControl=L\.control\.zoom\(/);
  // Same world limit idea as the Korean room (polgame.js WORLD), with wide longitude so worldCopyJump still works.
  assert.match(command, /map\.setMaxBounds\(L\.latLngBounds\(\[\[-60,-540\],\[78,540\]\]\)\)/);
  assert.match(command, /maxBoundsViscosity=1/);
});

test('public preview labels disconnected AI, real-time prices and signals honestly', () => {
  assert.match(usa, /PREVIEW · PUBLIC SOURCES/);
  assert.match(usa, /AI 분석 OFF · 실시간 시세 OFF/);
  assert.match(command, /실시간 거래 데이터·AI 분석·매수\/매도 신호는 제공되지 않습니다/);
  assert.match(command, /거래\/시세\/AI 미연결/);
});

test('country selection remains intentional, without a redirect into the US map', () => {
  assert.match(index, /href="national\.html"/);
  assert.match(index, /href="usa-command\.html"/);
  assert.match(index, /시스템 연결 상태/);
  assert.match(index, /비공개 관리자 데이터는 별도 인증 필요/);
  assert.doesNotMatch(index, /location\.replace\('usa-command\.html'/);
});

test('mobile query focus and compact map explanation stay usable', () => {
  assert.match(usa, /#usCmd input\{font-size:16px;/);
  assert.match(usa, /id="mt-map-only-controller"/);
  assert.match(usa, /if\(file\.hidden\)\{if\(file\.classList\.contains\('mt-peek'\)\)/);
  assert.match(usa, /if\(!close\.isConnected\)file\.appendChild\(close\)/);
  assert.match(usa, /aria-label','추적 설명 닫기'/);
});

test('market situation board is loaded as its own module and stays neutral', () => {
  const board = read('assets/mt-market-board.js');
  assert.match(usa, /<script src="assets\/mt-market-board\.js\?v=[^"]+"><\/script><\/body>/);
  assert.doesNotThrow(() => new vm.Script(board, { filename: 'mt-market-board.js' }));
  assert.match(board, /예상·추천 아님/);
  assert.doesNotMatch(board, /매수|매도|오를 것|내릴 것/);
  for (const f of ['calendar.json', 'sectors.json', 'factors/policy-rates.json', 'factors/tw-monthly-revenue.json', 'factors/us-trade-controls.json', 'factors/cn-mofcom-announcements.json']) {
    assert.ok(board.includes('"' + f + '"'), f);
    assert.ok(fs.existsSync(path.join(root, 'data/market', f)), 'data/market/' + f);
  }
});
