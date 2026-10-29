'use strict';
/* '분위기 + 과거' 카드(assets/mood.js) 계약 검사: 사례 0~2건 문구, 금지어, 결정적 계산, 데이터셋 형식. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../assets/mood.js');
const root = path.resolve(__dirname, '..');
const history = JSON.parse(fs.readFileSync(path.join(root, 'data/history/events.json'), 'utf8')).events;
const BANNED = /때문에|추천|because|recommend/i;

// 2018-01-01부터 평일 날짜, 종가는 단순 규칙(저장 가격 모양 {d,c})
function series(start, days, f) {
  const d = [], c = [];
  const t = new Date(start + 'T00:00:00Z');
  while (d.length < days) {
    if (t.getUTCDay() % 6) { d.push(t.toISOString().slice(0, 10)); c.push(f(d.length - 1)); }
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return { d, c };
}
const S = series('2018-01-01', 1200, i => Math.round((100 + i * 0.05) * 100) / 100);
const ev = (id, kind, date, extra) => Object.assign({ id, kind, date, title: { ko: id, en: id }, source: 'https://example.gov/' + id }, extra);
const texts = card => JSON.stringify([card.ko, card.en]);

test('events.json: 날짜 형식, https 공식 출처, KO/EN 제목, 예시 4건 포함', () => {
  const ids = history.map(e => e.id);
  for (const id of ['2018-sec232-steel-aluminum', '2018-sec301-china-first', '2020-covid-selloff', '2022-bis-semiconductor-controls']) assert.ok(ids.includes(id), id);
  const want = { '2018-sec232-steel-aluminum': '2018-03-08', '2018-sec301-china-first': '2018-07-06', '2022-bis-semiconductor-controls': '2022-10-07' };
  for (const e of history) {
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(e.source, /^https:\/\/(www\.federalregister\.gov|ustr\.gov|fred\.stlouisfed\.org|www\.bis\.gov|www\.bis\.doc\.gov|www\.whitehouse\.gov)\//);
    assert.ok(e.title.ko && e.title.en && e.date_check);
    if (want[e.id]) assert.equal(e.date, want[e.id]);
  }
  const covid = history.find(e => e.id === '2020-covid-selloff');
  assert.equal(covid.start_date, '2020-02-19');
  assert.equal(covid.date, '2020-03-23');
  assert.doesNotMatch(JSON.stringify(history), BANNED);
});

test('키워드 점수: 전문가 걱정 + CEO 자신감 -> 의견이 엇갈려요', () => {
  assert.equal(M.scoreText('수요 둔화 우려와 하향 조정'), -1);
  assert.equal(M.scoreText('We are confident in strong demand'), 1);
  const card = M.build({
    opinions: {
      experts: [{ text: '수요 둔화 우려' }, { text: 'downgrade on risk' }, { text: '실적 부진 경고' }],
      ceo: [{ text: '성장에 자신 있다' }, { text: 'strong demand, record quarter' }]
    },
    trades: [{ ty: 'S' }, { ty: 'S' }, { ty: 'P' }]
  });
  assert.equal(card.groups.experts.tilt, 'worry');
  assert.equal(card.groups.ceo.tilt, 'confident');
  assert.equal(card.mood, 'mixed');
  assert.match(card.ko.mood, /의견이 엇갈려요/);
  assert.match(card.en.mood, /split/);
});

test('기록이 하나도 없으면 지어내지 않고 "아직 기록이 없어요"', () => {
  const card = M.build({ drop: -5, kinds: ['tariff'], series: S, history: [] });
  assert.equal(card.mood, 'none');
  assert.match(card.ko.mood, /아직 기록이 없어요/);
  assert.ok(card.ko.rows.every(r => /아직 기록이 없어요/.test(r)));
  assert.ok(card.en.rows.every(r => /No records yet/.test(r)));
});

test('사례 0건: 솔직한 문구', () => {
  const card = M.build({ drop: -5, kinds: ['tariff'], series: S, history: [] });
  assert.equal(card.past.n, 0);
  assert.match(card.ko.past, /사례 0건/);
  assert.match(card.en.past, /0 cases/);
  assert.doesNotMatch(card.ko.feel, /평균/);
  assert.doesNotMatch(texts(card), BANNED);
});

test('사례 1~2건: "사례 n건뿐이라 참고만 해요", 끝맺음 "이랬던 적이 있어요"', () => {
  for (const n of [1, 2]) {
    const h = [ev('a', 'tariff', '2018-06-04'), ev('b', 'tariff', '2018-09-03')].slice(0, n);
    const card = M.build({ drop: 2, kinds: ['tariff'], series: S, history: h, opinions: { experts: [{ text: '우려' }] } });
    assert.equal(card.past.n, n);
    assert.ok(card.ko.past.includes('사례 ' + n + '건뿐이라 참고만 해요'));
    assert.match(card.ko.past, /\(추정\)/);
    assert.match(card.en.past, /Only \d+ cases?/);
    assert.match(card.en.past, /estimate/);
    assert.match(card.ko.feel, /이랬던 적이 있어요\.$/);
    assert.match(card.ko.feel, /참고만 해요/);
    assert.doesNotMatch(texts(card), BANNED);
  }
});

test('사례 3건 이상: 뿐이라 문구 없음, 1주/1달/3달 평균과 (추정)', () => {
  const h = [ev('a', 'tariff', '2018-06-04'), ev('b', 'tariff', '2018-09-03'), ev('c', 'tariff', '2019-01-07')];
  const card = M.build({ drop: 2, kinds: ['tariff'], series: S, history: h });
  assert.equal(card.past.n, 3);
  assert.doesNotMatch(card.ko.past, /뿐이라/);
  for (const w of ['1주', '1달', '3달']) assert.ok(card.ko.past.includes(w), w);
  assert.match(card.ko.feel, /이랬던 적이 있어요\.$/);
});

test('가격 기록 범위 밖 사건과 하락폭이 다른 사건은 사례에서 빼고 이유를 남김', () => {
  const h = [ev('old', 'tariff', '2010-01-04'), ev('far', 'tariff', '2018-06-04'), ev('other', 'export_control', '2018-06-04')];
  const r = M.findSimilar(S, h, { kinds: ['tariff'], drop: -30 });
  assert.equal(r.n, 0);
  assert.deepEqual(r.skipped.map(x => x.why).sort(), ['different_size', 'no_price']);
});

test('시작일이 있는 사건(코로나)은 시작~기준일 하락폭으로 비교', () => {
  const s = series('2020-01-01', 200, i => (i < 35 ? 100 : i < 60 ? 100 - (i - 35) * 1.2 : 70 + (i - 60) * 0.5));
  const h = [ev('crash', 'market_selloff', s.d[59], { start_date: s.d[35] })];
  const r = M.findSimilar(s, h, { kinds: ['market_selloff'], drop: -28 });
  assert.equal(r.n, 1);
  assert.ok(r.cases[0].before < -20);
  assert.ok(r.avg['1w'].mean > 0);
});

test('같은 입력이면 항상 같은 결과(결정적)', () => {
  const inp = () => ({
    symbol: 'NVDA', drop: 1.5, kinds: ['tariff', 'export_control'], series: S,
    history: [ev('a', 'tariff', '2018-06-04'), ev('b', 'export_control', '2019-03-04')].reverse(),
    opinions: { experts: [{ text: '우려' }, { text: 'strong growth' }] }, trades: [{ ty: 'S' }, { ty: 'P' }]
  });
  const a = JSON.stringify(M.build(inp())), b = JSON.stringify(M.build(inp()));
  assert.equal(a, b);
});

test('발표 제목에서 같은 종류 사건 찾기', () => {
  assert.deepEqual(M.kindsOfEvents([{ k: '관세·수입제한(232조)' }, { t: 'New export controls on chips' }]), ['export_control', 'tariff']);
  assert.deepEqual(M.kindsOfEvents([]), []);
});

test('mood.js: 네트워크는 load 안에서만, innerHTML/eval 없음', () => {
  const src = fs.readFileSync(path.join(root, 'assets/mood.js'), 'utf8');
  assert.doesNotMatch(src, /innerHTML|eval\(|localStorage|XMLHttpRequest|Date\.now|Math\.random/);
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ''), /추천|때문에|because|recommend/i);
});
