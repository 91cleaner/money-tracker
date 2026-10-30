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
