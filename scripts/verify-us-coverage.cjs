#!/usr/bin/env node
// Validate that reported US record counts match readable JSON files.
// Run: node scripts/verify-us-coverage.cjs
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const coveragePath = path.join(root, 'data/collection-coverage.json');
const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
const datasets = coverage.datasets || {};
let failures = 0;
for (const [name, dataset] of Object.entries(datasets)) {
  if (!dataset || !dataset.path || !dataset.path.endsWith('.json')) continue;
  if (!/^(data\/us\/|data\/us-)/.test(dataset.path)) continue;
  const target = path.resolve(root, dataset.path);
  if (!target.startsWith(root + path.sep)) { console.error('Unsafe path:', name); failures++; continue; }
  if (!fs.existsSync(target)) {
    if (dataset.status === 'present') { console.error('Missing:', name, dataset.path); failures++; }
    continue;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
    const count = Array.isArray(parsed) ? parsed.length : null;
    if (count !== null && Number.isInteger(dataset.records) && count !== dataset.records) {
      console.error('Count mismatch:', name, 'reported', dataset.records, 'actual', count);
      failures++;
    } else {
      console.log('Readable:', name, count === null ? '(object JSON)' : count + ' records');
    }
  } catch (err) {
    console.error('Invalid JSON:', name, err.message);
    failures++;
  }
}
if (failures) { console.error(failures + ' validation failure(s)'); process.exitCode = 1; }
else console.log('US coverage file-read checks passed');
