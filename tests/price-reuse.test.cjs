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
  assert.ok(S.t.SATS && S.renamed.SATS.now === 'ECHO', 'SATS = EchoStar, ECHO로 이어 붙임');
  { const X = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/us/prices/SATS.json'), 'utf8')), i = X.d.indexOf('2026-06-24'), E = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/us/prices/2026-10-20.json'), 'utf8'));
    assert.ok(i > 0 && X.rn && X.rn.url.includes('sec.gov')); assert.equal(X.c[X.d.indexOf('2026-10-20')], E.c.ECHO, 'Strive 우선주 가격이 섞이면 안 됨'); }
  { const T = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/us/ticker-sectors.json'), 'utf8')).tickers.SATS; assert.equal(T.cik, 1415404); }
  assert.equal(S.t.CTVA.m1, null); assert.equal(S.t.CTVA.br[0].ok, 'spinoff');
  for (const t of ['KD', 'MRNA', 'PRIM']) assert.equal(S.t[t].ytd, null, t + ' 미확인 급변은 숨김');
  const C = fs.readFileSync(path.join(__dirname, '../company.html'), 'utf8'); assert.ok(C.includes('"최근 21거래일"') && !C.includes('shiftMonth') && C.includes('meta.rn'));
  console.log('price round21 ok'); }
