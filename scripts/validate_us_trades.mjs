// Validate official-source House PTR snapshots without implying executed-trade verification.
// Run: node scripts/validate_us_trades.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
const data = JSON.parse(fs.readFileSync('data/us/trades.json', 'utf8'));
assert.equal(data.source, 'Official US House PTR PDF');
assert.ok(Array.isArray(data.records) && data.records.length > 0, 'PTR records missing');
assert.ok(!Number.isNaN(Date.parse(data.collected_at)), 'Invalid collection timestamp');
const seen = new Set();
let unresolvedTickers = 0;
for (const [i, row] of data.records.entries()) {
  const label = `PTR row ${i + 1}`;
  assert.ok(row.member?.trim() && row.asset?.trim(), `${label}: missing member/asset`);
  assert.match(row.filing_id, /^\d{4}-\d+$/, `${label}: invalid filing ID`);
  const url = new URL(row.source_pdf);
  assert.equal(url.protocol, 'https:', `${label}: source must use HTTPS`);
  assert.equal(url.hostname, 'disclosures-clerk.house.gov', `${label}: source must be House Clerk`);
  const [year, number] = row.filing_id.split('-');
  assert.equal(url.pathname, `/public_disc/ptr-pdfs/${year}/${number}.pdf`, `${label}: PDF and filing ID disagree`);
  const filingDate = Date.parse(row.filing_date);
  const tradeDate = Date.parse(row.transaction_date);
  const noticeDate = Date.parse(row.notification_date);
  assert.ok([filingDate, tradeDate, noticeDate].every(Number.isFinite), `${label}: invalid date`);
  assert.ok(tradeDate <= filingDate && noticeDate <= filingDate, `${label}: filing precedes reported event`);
  assert.ok(filingDate <= Date.now() + 86400000, `${label}: filing date in the future`);
  assert.ok(['P', 'S'].includes(row.type), `${label}: unsupported transaction type`);
  assert.ok(Number.isSafeInteger(row.amount_min_usd) && Number.isSafeInteger(row.amount_max_usd) &&
    row.amount_min_usd > 0 && row.amount_min_usd <= row.amount_max_usd, `${label}: invalid disclosed range`);
  assert.equal(row.verification, 'machine_parsed_requires_review',
    `${label}: do not label machine-parsed PTR as independently verified`);
  if (row.ticker == null) unresolvedTickers++;
  else assert.match(row.ticker, /^[A-Z][A-Z0-9.\-]{0,9}$/, `${label}: malformed ticker`);
  const key = [row.filing_id, row.member, row.transaction_date, row.asset, row.type, row.amount_min_usd, row.amount_max_usd].join('|');
  assert.ok(!seen.has(key), `${label}: duplicated reported transaction`);
  seen.add(key);
}
console.log(`House PTR integrity PASS: ${data.records.length} machine-parsed records; ${unresolvedTickers} unresolved tickers; none independently trade-verified.`);
