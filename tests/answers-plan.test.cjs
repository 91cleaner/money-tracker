'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../assets/answers.js');

const parsed = (patch = {}) => ({
  status: 'ok', company: { symbol: 'NVDA' }, intent: 'why',
  topics: [], period: null, periodExplicit: false, ...patch,
});

test('no period defaults to an explicitly labeled month', () => {
  assert.deepEqual(A.plan(parsed()), { symbol: 'NVDA', intent: 'why', period: '1m' });
});

test('explicit week and month retain their exact meaning', () => {
  assert.equal(A.plan(parsed({ period: { id: 'week' }, periodExplicit: true })).period, '1w');
  assert.equal(A.plan(parsed({ period: { id: 'month' }, periodExplicit: true })).period, '1m');
});

test('today never masquerades as a one-week answer', () => {
  assert.equal(A.plan(parsed({ period: { id: 'today' }, periodExplicit: true })), null);
});

test('ambiguous YTD/rolling-year never masquerades as a one-year answer', () => {
  assert.equal(A.plan(parsed({ period: { id: 'year', key: 'ytd' }, periodExplicit: true })), null);
});

test('unknown explicit periods fail closed', () => {
  assert.equal(A.plan(parsed({ period: { id: 'quarter' }, periodExplicit: true })), null);
  assert.equal(A.plan(parsed({ period: null, periodExplicit: true })), null);
});

test('supported topics map exactly, unsupported earnings does not turn into why', () => {
  assert.deepEqual(A.plan(parsed({ intent: 'topic', topics: [{ id: 'tariff' }] })),
    { symbol: 'NVDA', intent: 'tariff', period: '1m' });
  assert.equal(A.plan(parsed({ intent: 'topic', topics: [{ id: 'earnings' }] })), null);
  assert.equal(A.plan(parsed({ intent: 'topic', topics: [] })), null);
});

test('supply intent remains supported and invalid inputs fail closed', () => {
  assert.equal(A.plan(parsed({ intent: 'supply' })).intent, 'supply_chain');
  assert.equal(A.plan(parsed({ status: 'ambiguous' })), null);
  assert.equal(A.plan(parsed({ company: null })), null);
  assert.equal(A.plan(parsed({ intent: 'overview' })), null);
});
