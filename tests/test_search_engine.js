// 통합 검색(assets/se-core.js) 단위 테스트 + 실제 색인(data/search/se) 형식 점검. 실행: node tests/test_search_engine.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const C = require('../assets/se-core.js');

// 이름 다듬기
assert.strictEqual(C.normName('(주)포항환경건설'), C.normName('주식회사 포항환경건설'));
assert.strictEqual(C.normName('일신건설 주식회사'), '일신건설');
assert.strictEqual(C.shortName('주식회사 도화엔지니어링'), '도화엔지니어링');
assert.ok(C.sameCompany('삼성전자(주)', '삼성전자'));
assert.ok(!C.sameCompany('삼성전자로지텍(주)', '삼성전자'));

// 금액 표기
assert.strictEqual(C.won(175800000000), '1,758억원');
assert.strictEqual(C.won(2970000000), '29.7억원');
assert.strictEqual(C.won(23580000), '2,358만원');
assert.strictEqual(C.won(1234500000000), '1조 2,345억원');

// 시 이름 + 낱말
const cities = [['pohang', '포항시', '경북 포항시', '경상북도'], ['seoul', '서울특별시', '서울', '서울특별시']];
const cityOf = C.makeCityMatcher(cities);
assert.strictEqual(cityOf('포항'), 0);
assert.strictEqual(cityOf('포항시'), 0);
assert.strictEqual(cityOf('서울'), 1);
assert.strictEqual(cityOf('하수관로'), -1);
const qp = C.parse('포항 하수관로', cityOf);
assert.deepStrictEqual([...qp.cities], [0]);
assert.deepStrictEqual(qp.toks, ['하수관로']);
assert.ok(C.parse('포항', cityOf).cityOnly);

// 계약 묶음(월 1개)
const M = {
  n: 5,
  d: [0, 1, 8, 9, 20],
  amount: [100, 200, 300, 400, 50],
  inst: [0, 0, 1, 1, 0],
  vendor: [0, 1, 0, -1, 1],
  vname: ['', '', '', '개인상회', ''],
  title: ['하수관로 정비', '도로 포장', '하수관로 준설', '청소년 수련관 건립', '가로 청소 용역'],
  city: [0, 0, 1, 1, 0], kind: [0, 0, 0, 0, 1], method: [0, 0, 0, 0, 0],
};
M.tn = M.title.map(C.norm);
M.vnN = M.vname.map(C.normName);
const ctx = { instN: ['포항시청', '서울시청'].map(C.normName), vendN: ['가나건설', '다라환경'].map(C.normName) };
const all = (q, pred) => C.scan([M], C.parse(q, cityOf), { ...ctx, pred });

let a = all('하수관로');
assert.strictEqual(a.n, 2);
assert.strictEqual(a.sum, 400);
assert.deepStrictEqual(C.ranked(a.city).map((x) => x[0]), [1, 0]);

a = all('포항 하수관로'); // 시 조건
assert.strictEqual(a.n, 1);
assert.strictEqual(a.sum, 100);

a = all('청소'); // '청소년'만 있는 계약은 빠진다
assert.strictEqual(a.n, 1);
assert.strictEqual(a.top[0][1], 4);

a = all('가나건설'); // 업체 이름으로도 맞는다
assert.strictEqual(a.n, 2);

a = all('', (m, r) => m.vendor[r] === 0); // 업체 하나의 흐름
assert.strictEqual(a.sum, 400);
assert.strictEqual(a.inst.size, 2);
assert.deepStrictEqual(a.recent.map((x) => x[1]), [2, 0]); // 최신순

// 흐름 그림: 상위 1개 + 기타
a = all('', null);
const g = C.flowGraph(a.pair, a.inst, a.vend, 1, 1);
assert.strictEqual(g.left.length, 2);
assert.strictEqual(g.left[1].key, '__rest');
const linkSum = [...g.links.values()].reduce((s, v) => s + v, 0);
assert.strictEqual(linkSum, a.sum); // 띠 합 = 전체 합

// 실제 색인 형식 (있으면)
const dir = path.join(__dirname, '..', 'data', 'search', 'se');
if (fs.existsSync(path.join(dir, 'core.json'))) {
  const core = JSON.parse(fs.readFileSync(path.join(dir, 'core.json'), 'utf8'));
  const vend = JSON.parse(fs.readFileSync(path.join(dir, 'vendors.json'), 'utf8'));
  assert.ok(core.counts.contracts > 1000, 'contracts indexed');
  assert.strictEqual(vend.name.length, core.counts.vendors);
  let n = 0;
  for (const [mon, cnt] of core.months) {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'ct-' + mon + '.json'), 'utf8'));
    assert.strictEqual(m.n, cnt);
    for (const k of ['d', 'amount', 'inst', 'vendor', 'vname', 'title', 'no', 'ord', 'code', 'city']) assert.strictEqual(m[k].length, cnt, mon + ' ' + k);
    assert.ok(m.vendor.every((v) => v < vend.name.length), 'vendor index in range');
    assert.ok(m.inst.every((v) => v < core.insts.length), 'inst index in range');
    n += cnt;
  }
  assert.strictEqual(n, core.counts.contracts);
  // 미국 의원 주식 거래는 공개 화면에서 내렸으므로 색인에 없어야 한다
  assert.ok(!fs.existsSync(path.join(dir, 'us-trades.json')));
  assert.ok(!JSON.stringify(core).includes('ptr'), 'no US trade data in core');
  console.log('ok search engine: ' + n + ' contracts in index');
} else {
  console.log('ok search engine (no index built)');
}
