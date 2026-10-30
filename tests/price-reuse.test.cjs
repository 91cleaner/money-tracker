// SPCX was a different ETF before SpaceX listed on 2026-06-12: no figure may use those prices.
const fs = require('fs'), assert = require('assert');
const S = JSON.parse(fs.readFileSync(__dirname + '/../data/us/prices/summary.json', 'utf8')).t.SPCX;
const H = JSON.parse(fs.readFileSync(__dirname + '/../data/us/prices/SPCX.json', 'utf8'));
assert.strictEqual(S.ytd, null, 'SPCX ytd must be null (listed 2026-06-12)');
assert.ok(H.d[0] >= '2026-06-12', 'SPCX history must start on or after 2026-06-12');
assert.ok(S.ls && S.ls.d === '2026-06-12', 'listing-day base must be 2026-06-12');
for (const [tk, v] of Object.entries(JSON.parse(fs.readFileSync(__dirname + '/../data/us/prices/summary.json', 'utf8')).t))
  if (v.ytd != null) assert.ok(Math.abs(v.ytd) < 1000, tk + ' impossible ytd');
console.log('price-reuse ok');
{ const assert = require('assert'), fs = require('fs'), path = require('path');
  const S = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/us/prices/summary.json'), 'utf8'));
  assert.equal(S.m1, '최근 21거래일'); assert.match(S.source, /민간 데이터 회사, 공식 자료 아님/);
  assert.ok(!S.t.SATS && S.ended.SATS, 'SATS(이제 Strive 우선주)는 EchoStar 가격으로 보이면 안 됨');
  assert.equal(S.t.CTVA.m1, null); assert.equal(S.t.CTVA.br[0].ok, 'spinoff');
  for (const t of ['KD', 'MRNA', 'PRIM']) assert.equal(S.t[t].ytd, null, t + ' 미확인 급변은 숨김');
  const C = fs.readFileSync(path.join(__dirname, '../company.html'), 'utf8'); assert.ok(C.includes('"최근 21거래일"') && !C.includes('shiftMonth'));
  console.log('price round21 ok'); }
