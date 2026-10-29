'use strict';
/* Contract checks for assets/intent.js (질문 이해기) + data/intent-lexicon.json. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const src = read('assets/intent.js');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
const I = require('../assets/intent.js');
const lexicon = JSON.parse(read('data/intent-lexicon.json'));
const index = JSON.parse(read('data/search-index.json'));
const M = I.build(index, lexicon);
const P = q => I.parse(q, M);

test('script parses; no network, storage or innerHTML (browser-only, zero external calls)', () => {
  assert.doesNotThrow(() => new vm.Script(src, { filename: 'intent.js' }));
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|innerHTML|eval\(/);
});

test('lexicon is big enough and covers the required words (KO/EN)', () => {
  const all = JSON.stringify(lexicon);
  for (const w of ['왜', '이유', '무슨일', '떨어', '폭락', '빠져', '올라', '급등', '관세', '수출통제', '규제', '중국', '대만', '실적',
    'why', 'down', 'drop', 'crash', 'up', 'rally', 'tariff', 'export ban', 'china', '앤비디아', '엔비댜', '젠슨황']) assert.ok(all.includes(w), w);
  const n = Object.values(lexicon.intents).concat(Object.values(lexicon.direction), Object.values(lexicon.periods), Object.values(lexicon.topics))
    .reduce((a, o) => a + (o.ko || []).length + (o.en || []).length, 0);
  assert.ok(n >= 300, 'terms ' + n);
  assert.ok(Object.keys(lexicon.nicknames).length >= 50);
});

test('nicknames are merged into search-index aliases', () => {
  const al = index.entities['company:NVDA'].aliases;
  for (const a of ['앤비디아', '엔비댜', '젠슨황 회사']) assert.ok(al.includes(a), a);
});

// [question, symbol|null, intent, extra checks]
const CASES = [
  ['엔비디아', 'NVDA', 'overview'],
  ['NVDA', 'NVDA', 'overview'],
  ['nvidia', 'NVDA', 'overview'],
  ['엔비디아 주가 왜 그래', 'NVDA', 'why'],
  ['엔비디아 왜 떨어져', 'NVDA', 'why', { direction: 'down' }],
  ['엔비디아 왜 올라', 'NVDA', 'why', { direction: 'up' }],
  ['why is NVDA down', 'NVDA', 'why', { direction: 'down' }],
  ['why is NVDA up today', 'NVDA', 'why', { direction: 'up', period: 'today' }],
  ['앤비디아 왜 이래', 'NVDA', 'why'],
  ['엔비댜 주가 왜 빠져', 'NVDA', 'why', { direction: 'down' }],
  ['엔비디아왜떨어져', 'NVDA', 'why', { direction: 'down' }],
  ['엔비디아가 왜 폭락했어?', 'NVDA', 'why', { direction: 'down' }],
  ['엔비디아 요즘 왜이래', 'NVDA', 'why', { period: 'week' }],
  ['엔비디아 이번달 왜 올랐어', 'NVDA', 'why', { direction: 'up', period: 'month' }],
  ['엔비디아 올해 주가', 'NVDA', 'why', { period: 'year' }],
  ['NVDA stock this year', 'NVDA', 'why', { period: 'year' }],
  ['젠슨황 회사 급등 이유', 'NVDA', 'why', { direction: 'up' }],
  ['엔비디아 관세', 'NVDA', 'topic', { topic: 'tariff' }],
  ['NVDA export controls', 'NVDA', 'topic', { topic: 'export_control' }],
  ['엔비디아 수출통제', 'NVDA', 'topic', { topic: 'export_control' }],
  ['엔비디아 중국 규제', 'NVDA', 'topic', { topic: 'china' }],
  ['NVDA china', 'NVDA', 'topic', { topic: 'china' }],
  ['엔비디아 대만', 'NVDA', 'topic', { topic: 'taiwan' }],
  ['NVDA earnings', 'NVDA', 'topic', { topic: 'earnings' }],
  ['엔비디아 실적', 'NVDA', 'topic', { topic: 'earnings' }],
  ['NVDA tariff', 'NVDA', 'topic', { topic: 'tariff' }],
  ['nvidia export ban', 'NVDA', 'topic', { topic: 'export_control' }],
  ['엔비디아 관세 때문에 왜 떨어져', 'NVDA', 'why', { direction: 'down', topic: 'tariff' }],
  ['테슬라', 'TSLA', 'overview'],
  ['테스라 왜 떨어져', 'TSLA', 'why', { direction: 'down' }],
  ['Tesla crash today', 'TSLA', 'why', { direction: 'down', period: 'today' }],
  ['TSLA rally', 'TSLA', 'why', { direction: 'up' }],
  ['애플 주가 왜 올라', 'AAPL', 'why', { direction: 'up' }],
  ['apple stock why down', 'AAPL', 'why', { direction: 'down' }],
  ['인텔 실적', 'INTC', 'topic', { topic: 'earnings' }],
  ['intel earnings', 'INTC', 'topic', { topic: 'earnings' }],
  ['인텔 공급망', 'INTC', 'supply'],
  ['NVDA supply chain', 'NVDA', 'supply'],
  ['엔비디아 협력사', 'NVDA', 'supply'],
  ['엔비디아 vs AMD', 'NVDA', 'compare'],
  ['엔비디아 인텔 비교', 'NVDA', 'compare'],
  ['compare NVDA and AMD', 'NVDA', 'compare'],
  ['마이크로소프트 왜 빠져', 'MSFT', 'why', { direction: 'down' }],
  ['마소 주가', 'MSFT', 'why'],
  ['구글 개요', 'GOOGL', 'overview'],
  ['tsmc 관세', 'TSM', 'topic', { topic: 'tariff' }],
  ['티에스엠씨 왜 떨어져', 'TSM', 'why', { direction: 'down' }],
  ['whats going on with AMD', 'AMD', 'why'],
  ['NVIDIA tarrif news', 'NVDA', 'topic', { topic: 'tariff' }],
  ['nvdia why down', 'NVDA', 'why', { direction: 'down' }],
  ['엔비디어 주가', 'NVDA', 'why'],
];

for (const [q, sym, intent, ex] of CASES) {
  test('question: ' + q, () => {
    const r = P(q);
    assert.equal(r.status, 'ok', JSON.stringify(r.candidates));
    assert.equal(r.company.symbol, sym);
    assert.equal(r.intent, intent);
    if (ex && ex.direction) assert.equal(r.direction, ex.direction);
    if (ex && ex.period) assert.equal(r.period.id, ex.period);
    if (ex && ex.topic) assert.ok(r.topics.some(t => t.id === ex.topic), JSON.stringify(r.topics.map(t => t.id)));
  });
}

test('at least 40 question cases', () => { assert.ok(CASES.length >= 40); });

test('compare keeps both companies', () => {
  const r = P('엔비디아 vs AMD');
  assert.deepEqual(r.companyList.map(c => c.symbol).sort(), ['AMD', 'NVDA']);
});

test('default period is a week; explicit period beats the generic word', () => {
  assert.equal(P('엔비디아 주가 왜 그래').period.id, 'week');
  assert.equal(P('엔비디아 주가 왜 그래').periodExplicit, false);
  assert.equal(P('엔비디아 최근 한달 왜 떨어져').period.id, 'month');
});

test('unknown company: closest 3 are offered as "이걸 찾으셨나요?"', () => {
  const r = P('엔비디 아이 주가 왜 그래 엔비디안');
  assert.ok(['ok', 'suggest'].includes(r.status));
  const s = P('엔비디아사');
  assert.ok(s.status === 'ok' || s.candidates.length > 0);
  const t = P('테슬러 주가');
  assert.ok(t.status === 'ok' ? t.company.symbol === 'TSLA' : t.candidates.some(c => c.symbol === 'TSLA'));
  const none = P('왜 떨어져');
  assert.equal(none.status, 'no_company');
  assert.equal(P('').status, 'empty');
  const sug = I.suggestText({ candidates: [{ name: 'A', symbol: 'AAA' }, { name: 'B', symbol: 'BBB' }] }, 'ko');
  assert.match(sug, /이걸 찾으셨나요\?/);
  assert.match(I.suggestText({ candidates: [{ name: 'A', symbol: 'AAA' }] }, 'en'), /Did you mean/);
});

test('suggest returns at most 3 candidates', () => {
  const r = P('엔비디디아아 이상한글자');
  assert.ok(r.candidates.length <= 3);
});

test('short tickers need capitals; common words are not companies', () => {
  assert.notEqual((P('why is it going down').company || {}).symbol, 'IT');
  assert.equal(P('what is going on').status === 'ok', false);
});

test('edit distance helper and jamo typo tolerance', () => {
  assert.equal(I._lev('kitten', 'sitting'), 3);
  assert.ok(I._lev(I._jamo('테슬러'), I._jamo('테슬라')) === 1);
});

const FACTS = {
  symbol: 'NVDA', name: '엔비디아', asOf: '2026-10-27',
  entry: { d1: 0.9, w1: 0.68, m1: -4.77, ytd: 16.86 },
  events: [
    { date: '2026-10-20', title: '수출통제 규칙 발표', type: 'export' },
    { date: '2026-10-24', title: '관세 발표', type: 'tariff' },
    { date: '2026-08-01', title: '오래된 발표', type: 'tariff' },
  ],
  past: { n: 4, avg: 2.35 },
  sources: [{ label: 'data/us/prices', url: 'data/us/prices/summary.json' }],
};
const BAN = /때문에|영향으로|추천|매수|매도|사세요|파세요|확실|반드시|because|due to|caused by|recommend|buy|sell/i;

test('explain KO: numbers filled, nearest event, past average with sample size, neutral and with disclaimer', () => {
  const r = I.explain(P('엔비디아 이번달 왜 떨어져'), FACTS, 'ko');
  assert.match(r.text, /-4\.77%/);
  assert.match(r.text, /최근 1달/);
  assert.match(r.text, /같은 기간 2건/);
  assert.match(r.text, /10\/24 관세 발표/);
  assert.match(r.text, /과거 비슷한 발표 뒤 .*4번 평균 \+2\.35%/);
  assert.match(r.text, /표본이 적어/);
  assert.match(r.text, /상관관계일 뿐 원인이 아니며, 투자 조언이 아닙니다/);
  assert.doesNotMatch(r.text, BAN);
  assert.equal(r.sources.length, 1);
});

test('explain EN: neutral wording and disclaimer', () => {
  const r = I.explain(P('why is NVDA down this week'), FACTS, 'en');
  assert.match(r.text, /\+0\.68%/);
  assert.match(r.text, /past week/);
  assert.match(r.text, /Unlike the direction in the question/); // asked "down", data is up
  assert.match(r.text, /correlation only, not a cause, and not investment advice/);
  assert.doesNotMatch(r.text, BAN);
});

test('explain: topic filter keeps only matching events; none -> says so', () => {
  const r = I.explain(P('엔비디아 이번달 관세'), FACTS, 'ko');
  assert.match(r.text, /같은 기간 1건/);
  assert.match(r.text, /'관세' 주제만/);
  const none = I.explain(P('엔비디아 이번주 실적'), FACTS, 'ko');
  assert.match(none.text, /같은 기간 정책·발표·실적 일정은 없습니다/);
});

test('explain: sentence wording varies with the question but stays neutral', () => {
  const seen = new Set();
  for (const q of ['엔비디아 왜 올라', '엔비디아 왜 떨어져', 'NVDA 주가', '엔비디아 최근 왜', '엔비디아 이번주 어때', 'NVDA 왜']) {
    const r = I.explain(P(q), FACTS, 'ko'); seen.add(r.lines[0]); assert.doesNotMatch(r.text, BAN);
  }
  assert.ok(seen.size >= 2);
});

test('explain: missing data is stated, nearest period is used and said so', () => {
  const r = I.explain(P('엔비디아 올해'), { symbol: 'NVDA', name: '엔비디아', entry: { w1: 1.2 } }, 'ko');
  assert.match(r.text, /가까운 기간/);
  assert.match(I.explain(P('엔비디아 주가'), { symbol: 'NVDA', name: '엔비디아' }, 'ko').text, /종가 자료를 찾지 못했습니다/);
});

test('helpers: period change, same-window events, average', () => {
  assert.deepEqual(I.periodChange({ w1: 2 }, { key: 'w1' }), { key: 'w1', pct: 2, exact: true });
  assert.equal(I.periodChange({ w1: 2 }, { key: 'm1' }).exact, false);
  assert.equal(I.sameWindowEvents(FACTS.events, FACTS.asOf, 7, []).length, 2);
  assert.deepEqual(I.averageReaction([1, 3]), { n: 2, avg: 2 });
  assert.equal(I.averageReaction([]).n, 0);
});

test('pre-written explain structure (no AI key needed): url and lines', () => {
  assert.equal(I.prewrittenUrl('nvda', ''), 'data/us/explain/NVDA.json');
  assert.deepEqual(I.prewrittenLines({ summary_ko: ['가', '나'], summary_en: ['a'] }, 'en'), ['a']);
  assert.deepEqual(I.prewrittenLines(null, 'ko'), []);
  const schema = JSON.parse(read('data/us/explain/_schema.json'));
  assert.equal(schema.paid_api_allowed, false);
  assert.ok(schema.fields.summary_ko && schema.fields.summary_en && schema.fields.sources);
});

/* 관제실 검색 분기: overview 는 기존 투어, 그 외 의도는 MTAnswers 카드 먼저 */
const A = require('../assets/answers.js');
const htmlWI = read('world-intelligence/index.html');

test('world-intelligence loads intent.js and answers.js', () => {
  assert.match(htmlWI, /<script src="\.\.\/assets\/intent\.js[^"]*"/);
  assert.match(htmlWI, /<script src="\.\.\/assets\/answers\.js"/);
});

test('plan(): name only -> null (tour kept); why/topic -> answer card', () => {
  assert.equal(A.plan(P('엔비디아')), null);
  assert.equal(A.plan(P('NVDA')), null);
  const w = A.plan(P('엔비디아 주가 왜 그래'));
  assert.equal(w.symbol, 'NVDA');
  assert.equal(w.intent, 'why');
  assert.equal(A.plan(P('why is NVDA down')).intent, 'why');
  assert.equal(A.plan(P('NVDA export controls')).intent, 'export_control');
  assert.equal(A.plan(P('엔비디아 관세')).intent, 'tariff');
  assert.equal(A.plan(P('엔비디아 이번달 왜 떨어져')).period, '1m');
  assert.equal(A.plan(P('블라블라 왜 떨어져')), null);
});

test('handler: first screen (assets/firstscreen.js) comes first, caveats kept, tour button follows', () => {
  assert.ok(htmlWI.includes('if(await mtIntentCard(q))return;const tr=await tickerRoute'));
  assert.ok(htmlWI.includes('F.render(M,document'));
  assert.ok(htmlWI.includes('데이터상 같은 기간 기록이며 투자 조언이 아닙니다'));
  assert.ok(htmlWI.includes('Correlation only, not a cause. Not investment advice.'));
  assert.ok(read('assets/firstscreen.js').includes('전체 경로 투어'));
});
