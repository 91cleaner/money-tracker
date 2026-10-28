'use strict';
/* Contract checks: 한국 종목 경로(삼성전자 등) — 별명 검색, 출처 링크, 쉬운 말투, 중립. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const E = JSON.parse(fs.readFileSync(path.join(root, 'data/search-index.json'), 'utf8')).entities;
const kr = Object.entries(E).filter(([k]) => k.startsWith('company:') && k.endsWith('.KS'));
const norm = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

test('삼성 별명이 삼성전자(005930.KS)로 연결', () => {
  const al = E['company:005930.KS'].aliases.map(norm);
  for (const q of ['삼성 반도체', '삼전', '삼성', 'samsung']) assert.ok(al.includes(norm(q)), q);
});

test('다른 삼성 계열은 "삼성" 단독 별명을 갖지 않음', () => {
  for (const [k, e] of kr) if (k !== 'company:005930.KS') assert.ok(!e.aliases.map(norm).includes('삼성'), k);
});

test('한국 주요 종목 별명 전반', () => {
  const need = { '000660.KS': '하이닉스', '005380.KS': '현대자동차', '373220.KS': '엔솔', '207940.KS': '삼바', '035420.KS': 'naver' };
  for (const [sym, a] of Object.entries(need)) assert.ok(E['company:' + sym].aliases.map(norm).includes(a), sym + ' ' + a);
});

test('한국 종목 경로의 모든 카드에 출처 링크, 빈 카드 없음', () => {
  for (const [k, e] of kr) {
    assert.ok(e.route.length >= 1, k + ' route');
    for (const r of e.route) {
      assert.match(r.source_url || '', /^https?:\/\//, k + ' ' + r.title);
      assert.ok(r.fact && r.fact.length > 5, k + ' fact');
    }
  }
});

test('삼성전자 경로: 미국 조치·거래처(엔비디아)·중국 정책 카드', () => {
  const R = E['company:005930.KS'].route;
  assert.ok(R.length >= 4, 'cards ' + R.length);
  assert.ok(R.some(r => /federalregister\.gov/.test(r.source_url)), 'US action');
  assert.ok(R.some(r => /거래처/.test(r.title) && /sec\.gov/.test(r.source_url)), 'supplier');
  assert.ok(R.some(r => r.title === '한눈에 보기' && /^삼성전자는 한국 대표 반도체 회사예요\. 최근 .+ 미국이 반도체 관련 문서를 \d+번 냈어요\./.test(r.fact)), 'summary');
  assert.ok(!R.some(r => /소속 시장/.test(r.title)), 'old stub card gone');
});

test('한국 종목 카드는 공문체 없이 쉬운 말투 + 중립', () => {
  for (const [k, e] of kr) for (const r of e.route) {
    const t = r.title + ' ' + r.fact;
    if (/^(한눈에 보기|국회에 올라온 법안|주가 기록|미국 회사)/.test(r.title) || /^(미국에서|국회에|.+정부가)/.test(r.fact)) {
      assert.doesNotMatch(t, /데이터상|분류됨|단정 아님|확인됨\./, k + ' ' + r.title);
      assert.doesNotMatch(t, /때문에|추천|매수|매도|사세요|목표가|오를|내릴/, k + ' ' + r.title);
    }
  }
});

test('collect_kr_prices.py: 응답 파싱·병합 (키 없이 동작)', () => {
  const code = [
    'import json, sys', 'sys.path.insert(0, "scripts")', 'import collect_kr_prices as m',
    'j = {"response": {"body": {"items": {"item": [{"basDt": "20261027", "clpr": "70100"}, {"basDt": "20261028", "clpr": "71,000"}, {"basDt": "x", "clpr": "1"}]}}}}',
    'rows = m.parse(j)', 'assert rows == [("2026-10-27", 70100), ("2026-10-28", 71000)], rows',
    'assert m.parse({}) == [] and m.parse(None) == []',
    'one = {"response": {"body": {"items": {"item": {"basDt": "20261028", "clpr": "5"}}}}}', 'assert m.parse(one) == [("2026-10-28", 5)]',
    'ds, cs = m.merge({"d": ["2026-10-27"], "c": [1]}, rows)', 'assert ds == ["2026-10-27", "2026-10-28"] and cs == [70100, 71000]',
    'print("ok")'].join('\n');
  assert.equal(execFileSync('python3', ['-I', '-c', code], { cwd: root, env: { ...process.env, PYTHONPATH: '' } }).toString().trim(), 'ok');
  const src = fs.readFileSync(path.join(root, 'scripts/collect_kr_prices.py'), 'utf8');
  assert.match(src, /DATA_GO_KR_KEY/);
  assert.doesNotMatch(src, /print\([^)"]*\bKEY\b/); // 키 값 출력 금지(문자열 안의 이름은 허용)
});

test('glossary: 종가·수출통제·232조·포고문 설명', () => {
  const g = fs.readFileSync(path.join(root, 'assets/glossary.js'), 'utf8');
  for (const t of ['종가 (마감 가격)', '수출통제', '232조', '포고문']) assert.ok(g.includes(t), t);
});
