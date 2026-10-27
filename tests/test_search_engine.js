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

// 시 이름 + 낱말 ("광주"는 광주광역시·경기 광주시 둘 다)
const cities = [['pohang', '포항시', '경북 포항시', '경상북도'], ['seoul', '서울특별시', '서울', '서울특별시'], ['gwangju', '광주광역시', '광주', '광주광역시'], ['gwangju-gg', '광주시', '경기 광주시', '경기도']];
const cityOf = C.makeCityMatcher(cities);
assert.deepStrictEqual(cityOf('포항'), [0]);
assert.deepStrictEqual(cityOf('포항시'), [0]);
assert.deepStrictEqual(cityOf('서울'), [1]);
assert.deepStrictEqual(cityOf('광주').sort(), [2, 3]);
assert.deepStrictEqual(cityOf('광주광역시'), [2]);
assert.deepStrictEqual(cityOf('하수관로'), []);
const qp = C.parse('포항 하수관로', cityOf);
assert.deepStrictEqual([...qp.cities], [0]);
assert.deepStrictEqual(qp.toks, ['하수관로']);
assert.ok(C.parse('포항', cityOf).cityOnly);
assert.deepStrictEqual(C.parse('a !!! 2', cityOf).toks, []); // 영문·숫자 한 글자, 기호만 → 낱말 없음
assert.ok(C.masked('개인사업자') && !C.masked('가람건설'));

// 계약 묶음(월 1개): 5번째는 시청 외 기관, 6번째는 공동도급(업체0 70% / 업체1 30%)
const M = {
  n: 6,
  d: [0, 1, 8, 9, 20, 21],
  amount: [100, 200, 300, 400, 50, 1000],
  inst: [0, 0, 1, 1, 0, 0],
  vendor: [0, 1, 0, -1, 1, 0],
  vname: ['', '', '', '개인상회', '', ''],
  title: ['하수관로 정비', '도로 포장', '하수관로 준설', '청소년 수련관 건립', '가로 청소 용역', '하수관로 공동 공사'],
  city: [0, 0, 1, 1, 0, 0], kind: [0, 0, 0, 0, 1, 0], method: [0, 0, 0, 0, 0, 0],
  ext: [0, 0, 0, 0, 1, 0],
  jvs: [0, 0, 0, 0, 0, [[0, 700], [1, 300]]],
};
M.tn = M.title.map(C.norm);
M.vnN = M.vname.map(C.normName);
const ctx = { instN: ['포항시청', '서울시청'].map(C.normName), vendN: ['가나건설', '다라환경'].map(C.normName) };
M.st = M.title.map((_, r) => C.searchText(M, r, ctx));
const run = (q, extra) => C.scan([M], C.parse(q, cityOf), Object.assign({}, ctx, extra || {}));

let a = run('하수관로');
assert.strictEqual(a.n, 3);
assert.strictEqual(a.sum, 1400);
assert.deepStrictEqual(C.ranked(a.city).map((x) => x[0]), [0, 1]);
assert.strictEqual(a.vend.get('v0')[0], 100 + 300 + 700); // 공동도급은 지분대로
assert.strictEqual(a.vend.get('v1')[0], 300);

a = run('포항 하수관로'); // 시 조건
assert.strictEqual(a.n, 2);
assert.strictEqual(a.sum, 1100);

a = run('청소'); // '청소년'만 있는 계약은 빠지고, 시청 외 기관 계약은 따로 센다
assert.strictEqual(a.n, 0);
assert.strictEqual(a.extN, 1);
assert.strictEqual(a.extSum, 50);
a = run('청소', { ext: true }); // 포함하면 더해진다
assert.strictEqual(a.n, 1);
assert.strictEqual(a.sum, 50);

a = run('다라환경'); // 업체 이름(공동도급 참여사 포함)으로도 맞는다
assert.strictEqual(a.n, 2);

// 업체 하나의 흐름: 그 업체 몫만
const focus = new Set([1]);
a = run('', { pred: (m, r) => C.parts(m, r).some(([v]) => focus.has(v)), focus });
assert.strictEqual(a.sum, 200 + 300); // 시청 외 기관 50 은 제외, 공동도급은 30% 몫
assert.strictEqual(a.extSum, 50);
assert.deepStrictEqual(a.recent.map((x) => x[1]), [5, 1]); // 최신순

// 흐름 그림: 상위 1개 + 기타, 띠 합 = 전체 합
a = run('', {});
const g = C.flowGraph(a.pair, a.inst, a.vend, 1, 1);
assert.strictEqual(g.left[g.left.length - 1].key, '__rest');
const linkSum = [...g.links.values()].reduce((s, v) => s + v, 0);
assert.strictEqual(linkSum, a.sum);

// 실제 색인 형식 (있으면)
const dir = path.join(__dirname, '..', 'data', 'search', 'se');
if (fs.existsSync(path.join(dir, 'core.json'))) {
  const core = JSON.parse(fs.readFileSync(path.join(dir, 'core.json'), 'utf8'));
  const vend = JSON.parse(fs.readFileSync(path.join(dir, 'vendors.json'), 'utf8'));
  assert.ok(core.counts.contracts > 1000, 'contracts indexed');
  assert.strictEqual(vend.name.length, core.counts.vendors);
  assert.ok(core.build && vend.build === core.build, 'vendors.json from the same build');
  assert.ok(core.cities.every((c) => c.length >= 9), 'city rows carry local_share');
  let n = 0;
  for (const [mon, cnt] of core.months) {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'ct-' + mon + '.json'), 'utf8'));
    assert.strictEqual(m.n, cnt);
    assert.strictEqual(m.build, core.build, mon + ' same build');
    assert.strictEqual(m.jvs.length, cnt, mon + ' jvs');
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
