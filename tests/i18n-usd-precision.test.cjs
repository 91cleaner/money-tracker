'use strict';
/* Regression: English dollar amounts below $10k must not collapse distinct disclosed values. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { usd, koUsd } = require('../assets/i18n.js');

test('USD values below $10,000 retain dollars and cents', () => {
  for (const [value, expected] of [
    [0, '$0'],
    [0.01, '$0.01'],
    [999.99, '$999.99'],
    [1499, '$1,499'],
    [1500, '$1,500'],
    [9999.99, '$9,999.99'],
    [-1499, '-$1,499'],
    [-999.99, '-$999.99']
  ]) assert.equal(usd(value), expected, String(value));
});

test('USD compact units, missing values and Korean-unit conversion remain stable', () => {
  for (const [value, expected] of [
    [10000, '$10.00K'],
    [15000, '$15.00K'],
    [1000000, '$1.00M'],
    [1000000000, '$1.00B'],
    [null, '-'],
    [Infinity, '-']
  ]) assert.equal(usd(value), expected, String(value));
  assert.equal(koUsd('5,031', '만'), '$50.31M');
  assert.equal(koUsd('5.0', '억'), '$500.00M');
});
