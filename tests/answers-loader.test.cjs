'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const loaderPath = require.resolve('../assets/answers.js');

async function withAnswerFixture(fixture, callback) {
  const originalFetch = global.fetch;
  const requests = [];
  try {
    delete require.cache[loaderPath];
    global.fetch = async (url) => {
      requests.push(url);
      return { ok: true, json: async () => fixture };
    };
    const answers = require(loaderPath);
    await callback(answers, requests);
  } finally {
    global.fetch = originalFetch;
    delete require.cache[loaderPath];
  }
}

const fixture = {
  symbol: 'NVDA', name: 'NVIDIA', asof: '2026-10-26',
  answers: { overview: {
    '1m': { ko: ['1개월 종가 기록'], en: ['One month of closing prices'], period: 'incorrect' },
    '3m': { ko: ['3개월 종가 기록'] },
  } },
};

test('explicit unavailable 1w period returns null rather than silently substituting 1m', async () => {
  await withAnswerFixture(fixture, async (answers, requests) => {
    assert.equal(await answers.get('nvda', 'overview', '1w'), null);
    assert.deepEqual(requests, ['data/answers/NVDA.json']);
  });
});

test('available period is labeled correctly even if source data has a conflicting period field', async () => {
  await withAnswerFixture(fixture, async (answers) => {
    const a = await answers.get('NVDA', 'overview', '3m');
    assert.equal(a.period, '3m');
    assert.equal(a.ko[0], '3개월 종가 기록');
    assert.equal(a.asof, '2026-10-26');
  });
});

test('unsupported explicit period returns null instead of a misleading 1m answer', async () => {
  await withAnswerFixture(fixture, async (answers) => {
    assert.equal(await answers.get('NVDA', 'overview', 'today'), null);
  });
});

test('omitted period defaults to 1m and is accurately labeled', async () => {
  await withAnswerFixture(fixture, async (answers) => {
    const a = await answers.get('NVDA', 'overview');
    assert.equal(a.period, '1m');
    assert.equal(a.ko[0], '1개월 종가 기록');
  });
});

test('unknown intent returns null without inventing a summary', async () => {
  await withAnswerFixture(fixture, async (answers) => {
    assert.equal(await answers.get('NVDA', 'earnings', '1m'), null);
  });
});
