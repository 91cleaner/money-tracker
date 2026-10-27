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

test('미국 관제실: 인라인 JavaScript 구문이 유효하다', () => {
  const inline = [...usa.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs]) => !/\bsrc\s*=/.test(attrs));
  assert.ok(inline.length > 0, '인라인 지도 스크립트가 있어야 합니다');
  inline.forEach(([, , source], i) => assert.doesNotThrow(
    () => new vm.Script(source, { filename: 'usa-command.inline-' + i + '.js' })
  ));
});

test('단일 세계지도에서 질문 → 작전 → 지도 추적 흐름을 유지한다', () => {
  assert.match(usa, /class="pg-map"/);
  assert.match(usa, /id="usCmd"/);
  assert.match(usa, /id="usQuery"/);
  assert.match(usa, /addEventListener\('submit'/);
  assert.match(usa, /function pick\(k\)/);
  assert.match(usa, /function show\(\)/);
  assert.match(usa, /map\.flyTo\(/);
  assert.doesNotMatch(usa, /<button[^>]*data-w="(?:us|world|kr)"/,
    '국가 전환 버튼을 하단에 다시 추가하지 마세요');
});

test('위성 전환: 실제 영상·지명 타일과 줌 이벤트를 유지한다', () => {
  assert.match(usa, /World_Imagery\/MapServer\/tile/);
  assert.match(usa, /World_Boundaries_and_Places\/MapServer\/tile/);
  assert.match(usa, /map\.on\('zoom zoomend moveend',satFade\)/);
  assert.match(usa, /sat\.setOpacity\(o\)/);
  assert.match(usa, /satLab\.setOpacity\(o\*\.85\)/);
  assert.match(usa, /leaflet-sat-pane\{z-index:250!important/);
  assert.match(usa, /leaflet-satlab-pane\{z-index:260!important/);
});

test('데이터 연결 상태를 정직하게 표시한다', () => {
  assert.match(usa, /공개 거래 데이터 · AI 분석 · 실시간 시세: 미연결/);
  assert.match(usa, /PREVIEW · PUBLIC SOURCES/);
  assert.match(usa, /실시간 투자 신호가 아닙니다/);
  assert.match(usa, /관련 공식 자료/);
});

test('메인 진입은 국가 선택 화면을 건너뛰고 미국 세계지도에 진입한다', () => {
  assert.match(index, /location\.replace\('usa-command\.html'/);
  assert.match(index, /http-equiv="refresh" content="0;url=usa-command\.html"/);
});
