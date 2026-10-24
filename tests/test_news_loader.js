/* node tests/test_news_loader.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '..');
const News = require(path.join(root, 'assets/news.js'));
const { npsModel } = require(path.join(root, 'assets/fun.js'));

const handoff = path.join('/cursor/stores/bot/handoff/news.json');
const dataNews = path.join(root, 'data/news.json');
if (fs.existsSync(handoff)) {
  assert.strictEqual(fs.readFileSync(dataNews).equals(fs.readFileSync(handoff)), true, 'news.json bytes');
}

const real = News.newsFromPayload(JSON.parse(fs.readFileSync(dataNews, 'utf8')));
assert.strictEqual(real.length, 3);
assert.deepStrictEqual(real.map((a) => a.id), [
  '2026-10-24-nk-loan',
  '2026-10-24-chuncheon-contract',
  '2026-10-24-assembly-trips',
]);
assert.ok(real.every((a) => a.factchecked === true));
assert.ok(real[0].body.length >= 4);
assert.strictEqual(real[0].sources[0].url, 'https://www.mk.co.kr/news/economy/12180428');
assert.ok(!real[0].sources[0].label.includes('http'));
assert.strictEqual(real[0].topic, '대북');
assert.strictEqual(real[1].topic, '계약');
assert.strictEqual(real[2].topic, '국회');
assert.strictEqual(real[2].amount, '');
assert.strictEqual(News.wonFromLabel(real[0].amount), 1374400000000);
assert.strictEqual(News.wonFromLabel(real[1].amount), 15170000000);
assert.strictEqual(News.wonFromLabel(real[2].amount), null);

const fake = News.newsFromPayload(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/news.json'), 'utf8')));
assert.deepStrictEqual(fake.map((a) => a.id), ['fake-keep', 'fake-ko']);
assert.deepStrictEqual(fake[1].body, ['첫째 줄임.', '둘째 줄임.']);
assert.strictEqual(fake[1].sources[1].url, '');
assert.strictEqual(fake[0].topic, '테스트');

const cities = [
  { slug: 'chuncheon', name: '춘천시', short: '강원 춘천시' },
  { slug: 'seoul', name: '서울특별시', short: '서울' },
];
assert.strictEqual(News.cityHit('춘천', 'chuncheon', cities), true);
assert.strictEqual(News.cityHit('전국(국가)', 'chuncheon', cities), false);
assert.strictEqual(News.cityHit('전국(국가)', 'seoul', cities), false);
const sorted = News.sortNews(real, 'chuncheon', cities);
assert.strictEqual(sorted[0].id, '2026-10-24-chuncheon-contract');
assert.strictEqual(News.newsIsNew('2026-10-24', ''), true);
assert.strictEqual(News.newsIsNew('2026-10-24', '2026-10-24'), false);
assert.strictEqual(News.newsIsNew('2026-10-25', '2026-10-24'), true);

const nps = npsModel(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/nps.json'), 'utf8')));
assert.strictEqual(nps.total, 1000000000000);
assert.strictEqual(nps.pct, 40);
assert.strictEqual(npsModel(null), null);
assert.strictEqual(npsModel({ total: 10 }), null);
const fund = npsModel({ latest: { reserve_trillion_krw: 2, mix: { '국내주식': [0.4, 20], '해외주식': [0.6, 30], '국내채권': [1, 50] } } });
assert.strictEqual(fund.kind, 'fund');
assert.strictEqual(fund.pct, 50);
assert.strictEqual(fund.total, 2e12);
assert.strictEqual(fund.items.length, 3);
const fundPath = path.join(root, 'data/nps/fund_totals.json');
if (fs.existsSync(fundPath)) {
  const live = npsModel(JSON.parse(fs.readFileSync(fundPath, 'utf8')));
  assert.ok(live && live.kind === 'fund' && live.pct > 0 && live.pct <= 100);
}

const sandbox = { console };
function Response() {}
Response.prototype.json = function () { return Promise.resolve(null); };
sandbox.Response = Response;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/mask.js'), 'utf8'), sandbox);
assert.strictEqual(sandbox.maskT('역삼동 12번지 도로').includes('번지'), false);
const masked = sandbox.maskT('김철수 콘서트');
assert.ok(masked.includes('○○○'), masked);

const banned = ['news.html', 'article.html', 'principles.html', 'nps.html', 'assets/news.js', 'assets/fun.js', 'assets/nav.js', 'assets/refresh.css'];
for (const f of banned) {
  const t = fs.readFileSync(path.join(root, f), 'utf8');
  assert.strictEqual(t.includes('기부'), false, f + ' says 기부');
}
assert.ok(fs.readFileSync(path.join(root, 'article.html'), 'utf8').includes('후원하기'));
assert.ok(fs.readFileSync(path.join(root, 'article.html'), 'utf8').includes('payment method TBD'));
assert.ok(!/mailto:|@/.test(fs.readFileSync(path.join(root, 'principles.html'), 'utf8').replace(/pretendard@/g, '')));
assert.strictEqual(fs.existsSync(path.join(root, 'data/corrections.json')), false);

console.log('ok', real.length, 'articles');
