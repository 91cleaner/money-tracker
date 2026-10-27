// Validate the current machine-parsed STOCK Act disclosure snapshot.
// Disclosure PDFs are evidence of reports, NOT proof of executed transactions.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const data = JSON.parse(fs.readFileSync('data/us/trades.json', 'utf8'));
assert.match(data.source, /U\.S\. House Clerk financial disclosures/);
assert.ok(Array.isArray(data.trades) && data.trades.length > 0, 'Disclosure trades missing');
assert.ok(Number.isFinite(Date.parse(data.updated)), 'Invalid dataset timestamp');
const anomalies = { incomplete_amount: 0, transaction_after_filing: 0, future_transaction: 0, duplicate: 0 };
const seen = new Set();
for (const [i, row] of data.trades.entries()) {
  const label = 'disclosure row ' + (i + 1);
  assert.ok(typeof row.who === 'string' && row.who.trim(), label + ': missing member');
  assert.ok(typeof row.asset === 'string' && row.asset.trim(), label + ': missing asset');
  assert.ok(typeof row.id === 'string' && row.id.trim(), label + ': missing member ID');
  assert.ok(['P', 'S', 'E'].includes(row.ty), label + ': invalid transaction category');
  assert.ok(['h', 's'].includes(row.c), label + ': unknown chamber');
  const source = new URL(row.doc);
  assert.equal(source.protocol, 'https:', label + ': insecure source');
  if (row.c === 'h') {
    assert.equal(source.hostname, 'disclosures-clerk.house.gov', label + ': not House Clerk');
    assert.match(source.pathname, /^\/public_disc\/ptr-pdfs\/\d{4}\/\d+\.pdf$/, label + ': not PTR PDF');
  } else {
    assert.equal(source.hostname, 'efdsearch.senate.gov', label + ': not Senate eFD');
  }
  const transaction = Date.parse(row.d);
  const filed = Date.parse(row.filed);
  assert.ok(Number.isFinite(transaction) && Number.isFinite(filed), label + ': invalid dates');
  if (transaction > filed) anomalies.transaction_after_filing++;
  if (transaction > Date.now() + 86400000) anomalies.future_transaction++;
  const amount = /^\$([\d,]+) - \$([\d,]+)$/.exec(row.amt || '');
  if (!amount) anomalies.incomplete_amount++;
  else {
    const min = Number(amount[1].replaceAll(',', ''));
    const max = Number(amount[2].replaceAll(',', ''));
    assert.ok(min > 0 && max >= min, label + ': reversed amount range');
  }
  if (row.tk != null) assert.match(row.tk, /^[A-Z][A-Z0-9.\-]{0,12}$/, label + ': invalid ticker');
  const key = [row.doc, row.who, row.d, row.asset, row.ty, row.amt].join('|');
  if (seen.has(key)) anomalies.duplicate++;
  seen.add(key);
}
const totalAnomalies = Object.values(anomalies).reduce((a, b) => a + b, 0);
assert.ok(totalAnomalies <= Math.max(100, Math.ceil(data.trades.length * 0.05)),
  'Too many machine-parsing anomalies: ' + JSON.stringify(anomalies));
console.log('Disclosure source integrity PASS: ' + data.trades.length +
  ' reported rows; anomalies=' + JSON.stringify(anomalies) +
  '; none independently execution-verified or live.');
