'use strict';
/* Contract checks for assets/firstscreen.js (관제실 검색 첫 화면): one-line answer, 3 evidence cards, flow picture.
   Rephrased questions must land on the same company and the same price number; no cause or advice wording anywhere. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const json = f => JSON.parse(read(f));
const I = require('../assets/intent.js');
const F = require('../assets/firstscreen.js');
const M0 = I.build(json('data/search-index.json'), json('data/intent-lexicon.json'));
const DATA = {
  trades: json('data/us/trades.json').trades,
  awards: json('data/us/federal-awards.json'),
  lobbying: json('data/us/lobbying.json'),
  pac: json('data/us/pac-contributions.json'),
};
const docs = {};
const doc = s => docs[s] || (docs[s] = json('data/answers/' + s + '.json'));
const clone = o => JSON.parse(JSON.stringify(o));
const BAN = /때문에|추천|because|recommend/i;
const HANGUL = /[가-힣]/;

function run(q, lang, name) {
  const parsed = I.parse(q, M0);
  assert.equal(parsed.status, 'ok', q + ' -> ' + JSON.stringify(parsed.candidates));
  const m = F.build(doc(parsed.company.symbol), parsed, DATA, lang || 'ko', { query: q, name });
  assert.ok(m, q);
  return m;
}
const priceOf = m => m.headline.match(/[+−]?\d+\.\d%/)[0];

test('script parses; no network, storage, innerHTML or eval (browser-only, no AI)', () => {
  const src = read('assets/firstscreen.js'), code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotThrow(() => new vm.Script(src, { filename: 'firstscreen.js' }));
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|innerHTML|eval\(/);
});

// 같은 대상·같은 숫자: every question in a group is about one company and must show one and the same price change
const NVDA = [
  '엔비디아 요즘 왜 이래', '젠슨황 회사 관세 맞았어?', 'why is NVDA down', 'NVDA 주가', '엔비디아 의원 매도', 'nvidia tariff',
  '엔비디아', 'NVDA', 'nvidia', '엔비디아 왜 떨어져', '앤비디아 왜 이래', '엔비댜 주가 왜 빠져', 'whats going on with NVDA',
  'NVDA stock lately', '엔비디아 수출통제', 'NVDA china', '엔비디아 최근 왜 올랐어', 'nvdia why down', '엔비디어 주가', '엔비디아 관세',
];
const BAC = ['Laurel Lee BAC', '로렐 리 뱅크오브아메리카', 'BAC', '뱅오아 왜 떨어져', 'bank of america why down', 'BAC 주가'];

for (const [group, sym] of [[NVDA, 'NVDA'], [BAC, 'BAC']]) {
  test(sym + ': ' + group.length + ' rephrased questions -> same company, same price number (KO and EN)', () => {
    const want = doc(sym).periods['1m'].ret;
    for (const lang of ['ko', 'en']) {
      const name = lang === 'en' ? sym : undefined, base = priceOf(run(group[0], lang, name));
      for (const q of group) {
        const m = run(q, lang, name);
        assert.equal(m.symbol, sym, q);
        assert.equal(m.period, '1m', q);
        assert.equal(m.ret, want, q);
        assert.equal(priceOf(m), base, q);
      }
    }
  });
}

test('at least 20 rephrased questions are covered', () => { assert.ok(NVDA.length + BAC.length >= 20); });

test('one-line answer follows the requested shape (KO)', () => {
  const m = run('엔비디아 요즘 왜 이래');
  assert.match(m.headline, /^엔비디아는 최근 한 달 [+−]\d+\.\d%\./);
  assert.match(m.headline, /같은 기간 .*이 있었어요\.$|같은 기간 정책 발표나 의원 거래 신고 기록은 아직 없어요\.$/);
});

test('one-line answer follows the requested shape (EN)', () => {
  const m = run('why is NVDA down', 'en', 'NVIDIA');
  assert.match(m.headline, /^NVIDIA moved [+−]\d+\.\d% over the past month\. /);
  assert.match(m.headline, /In the same period there (was|were) .*\.$|No policy announcement or lawmaker filing is on record yet/);
});

test('headline counts match the data files', () => {
  const m = run('엔비디아 요즘 왜 이래');
  const per = doc('NVDA').periods['1m'];
  const inWin = ty => DATA.trades.filter(t => t.tk === 'NVDA' && t.filed >= per.from && t.filed <= per.to && t.ty === ty).length;
  assert.equal(m.n.sales, inWin('S'));
  assert.equal(m.n.buys, inWin('P'));
  if (m.n.sales) assert.ok(m.headline.includes('의원 매도 신고 ' + m.n.sales + '건'));
  if (m.n.buys) assert.ok(m.headline.includes('의원 매수 신고 ' + m.n.buys + '건'));
});

test('tariff question uses the tariff wording and keeps the same price', () => {
  const t = run('엔비디아 관세'), w = run('엔비디아 왜 떨어져');
  assert.equal(t.topic, 'tariff');
  assert.equal(w.topic, null);
  assert.equal(t.ret, w.ret);
  const d = clone(doc('NVDA'));
  d.answers.tariff['1m'] = { ko: ['같은 기간 관세 관련 공개 기록이 1건 있었다(가까운 순 최대 1건 표시).'], en: [], events: [{ d: '2026-10-10', t: 'Chip duty notice', u: 'https://www.federalregister.gov/x', c: 'us', k: '' }], reaction: null, src: [] };
  const parsed = I.parse('엔비디아 관세', M0);
  assert.match(F.build(d, parsed, { trades: [] }, 'ko', {}).headline, /관세 발표 1건/);
  assert.match(F.build(d, parsed, { trades: [] }, 'en', { name: 'NVIDIA' }).headline, /there was 1 tariff announcement\./);
});

test('three evidence cards in order: price, same period, past cases; flow follows', () => {
  const m = run('엔비디아 주가');
  assert.deepEqual(m.cards.map(c => c.id), ['price', 'events', 'past']);
  assert.ok(m.cards[0].big);
  assert.ok(m.flow.length >= 3);
});

test('past-cases card marks estimates and is honest about small samples', () => {
  const d = clone(doc('NVDA'));
  d.answers.why['1m'].reaction = { mean: -2.16, n: 4, low_n: true, days: 7 };
  const parsed = I.parse('엔비디아 왜 이래', M0);
  const ko = F.text(F.build(d, parsed, DATA, 'ko', {}));
  assert.match(ko, /사례 4건뿐이라 참고만 해요/);
  assert.match(ko, /\(추정\)/);
  const en = F.text(F.build(d, parsed, DATA, 'en', { name: 'NVIDIA' }));
  assert.match(en, /Only 4 cases, so take it lightly/);
  assert.match(en, /\(estimate\)/);
  d.answers.why['1m'].reaction = { mean: 2.29, n: 15, low_n: false, days: 7 };
  assert.doesNotMatch(F.text(F.build(d, parsed, DATA, 'ko', {})), /참고만 해요/);
});

test('missing data is said plainly, never invented', () => {
  const d = clone(doc('NVDA'));
  d.answers.why['1m'] = { ko: [], en: [], events: [], reaction: null, src: [] };
  const parsed = I.parse('엔비디아 왜 이래', M0);
  const m = F.build(d, parsed, { trades: [] }, 'ko', {});
  assert.match(m.headline, /같은 기간 정책 발표나 의원 거래 신고 기록은 아직 없어요/);
  assert.equal(m.cards[2].empty, true);
  assert.match(F.text(m), /아직 기록이 없어요/);
  assert.ok(m.flow.every(f => f.empty));
  const e = F.build(d, parsed, { trades: [] }, 'en', { name: 'NVIDIA' });
  assert.match(e.headline, /No policy announcement or lawmaker filing is on record yet/);
  const noPrice = clone(doc('NVDA')); noPrice.periods = {};
  assert.match(F.build(noPrice, parsed, { trades: [] }, 'ko', {}).headline, /주가 기록이 아직 없어요/);
  assert.equal(F.build(null, parsed, DATA, 'ko', {}), null);
});

test('a lawmaker named in the question is shown first (Laurel Lee BAC)', () => {
  const m = run('Laurel Lee BAC');
  const first = m.cards[1].items[0];
  assert.equal(first.mine, true);
  assert.match(first.text, /Laurel Lee/);
  assert.ok(F.asksMember('Laurel Lee BAC', 'Laurel Lee'));
  assert.ok(!F.asksMember('Lee BAC', 'Laurel Lee'));
  assert.equal(run('BAC').cards[1].items.some(i => i.mine), false);
});

test('explicit period is honoured; generic words fall back to one month', () => {
  assert.equal(run('NVDA this year').period, '1y');
  assert.equal(run('엔비디아 이번주 왜').period, '1w');
  assert.equal(run('엔비디아 요즘').period, '1m');
  assert.equal(run('엔비디아 최근').period, '1m');
  assert.equal(F.plan(I.parse('왜 떨어져', M0)), null);
});

test('no cause / advice wording in any output: all questions, every pack, KO and EN', () => {
  for (const q of NVDA.concat(BAC)) for (const lang of ['ko', 'en']) assert.doesNotMatch(F.text(run(q, lang, lang === 'en' ? 'X' : undefined)), BAN, q);
  const files = fs.readdirSync(path.join(root, 'data/answers')).filter(f => /\.json$/.test(f) && f[0] !== '_');
  assert.ok(files.length > 100);
  let built = 0;
  for (const f of files) {
    const d = json('data/answers/' + f);
    for (const q of [d.symbol + ' 왜 떨어져', d.symbol + ' tariff', d.symbol + ' export controls', d.symbol + ' this year']) {
      const parsed = I.parse(q, M0);
      if (parsed.status !== 'ok' || parsed.company.symbol !== d.symbol) continue;
      built++;
      for (const lang of ['ko', 'en']) assert.doesNotMatch(F.text(F.build(d, parsed, DATA, lang, { query: q })), BAN, f + ' ' + q);
    }
  }
  assert.ok(built > 100);
});

test('EN screen has no Korean outside the flow labels', () => {
  const en = F.text(run('why is NVDA down', 'en', 'NVIDIA'));
  assert.doesNotMatch(en, HANGUL);
});

test('headline never names a cause: only the "same period" pattern', () => {
  for (const q of NVDA) assert.doesNotMatch(run(q).headline, /때문|덕분|탓|영향|due to|caused|driven/i, q);
});

/* render with a tiny DOM stub: DOM calls only, tour button last */
function stubDoc() {
  const mk = tag => ({ tag, className: '', children: [], textContent: '', appendChild(c) { this.children.push(c); return c; } });
  return { createElement: mk };
}
test('render: head, 3 cards, flow, then the tour button (KO and EN)', () => {
  for (const [lang, label] of [['ko', '▶ 전체 경로 투어'], ['en', '▶ Full route tour']]) {
    const m = run('엔비디아 왜 떨어져', lang, lang === 'en' ? 'NVIDIA' : undefined);
    let clicked = 0;
    const box = F.render(m, stubDoc(), () => { clicked++; });
    const kids = box.children;
    assert.equal(kids[0].className, 'fs-head');
    assert.equal(kids[1].className, 'fs-cards');
    assert.equal(kids[1].children.length, 3);
    assert.equal(kids[2].className, 'fs-flow');
    const last = kids[kids.length - 1];
    assert.equal(last.textContent, label);
    last.onclick();
    assert.equal(clicked, 1);
  }
});

test('page wiring: script loaded, search renders the first screen, tour button kept', () => {
  const html = read('world-intelligence/index.html');
  assert.match(html, /<script src="\.\.\/assets\/firstscreen\.js[^"]*" defer>/);
  assert.ok(html.includes('if(await mtIntentCard(q))return;const tr=await tickerRoute'));
  assert.ok(html.includes('F.render(M,document'));
  assert.ok(html.includes("classList.remove('fs-on')"));
  assert.ok(html.includes('Correlation only, not a cause. Not investment advice.'));
  assert.ok(html.includes('데이터상 같은 기간 기록이며 투자 조언이 아닙니다'));
});
