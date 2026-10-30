'use strict';
/* 관제실 투어 마지막 요약 카드: 금지어 grep, 표본 3건 미만 문구, 추정 표기, 법안·업종 경로. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'world-intelligence/index.html'), 'utf8');

function load() {
  const m = html.match(/<script id="mt-tour-summary-js">([\s\S]*?)<\/script>/);
  assert.ok(m, 'summary script block exists');
  const noop = () => null;
  const win = { MTI18N: { isEn: false } };
  const document = { getElementById: noop };
  vm.runInNewContext(m[1], { window: win, document, fetch: () => Promise.resolve({ ok: false }), Date, Promise, Math });
  return win.MTTourSummary;
}
const T = load();
const BAN = /때문|추천|because|recommend/i;

const stops = {
  company: [
    { kind: 'supply', title: 'A 공장', fact: '공장' },
    { kind: 'supply', title: 'B 본사', fact: '본사' },
    { kind: 'lobby', title: 'x', fact: '로비 3건' },
    { kind: 'trade', title: 'x', fact: '' },
  ],
  bill: [
    { kind: 'bill', title: 'S 1', fact: '' , date: '2026-07-27' },
    { kind: 'cmte', title: 'x', ref: 'sponsor:W1' },
    { kind: 'lobby', title: 'x', ref: 'lobbying:MSFT' },
  ],
  sector: [
    { title: 'x', ref: 'company:NVDA' },
    { title: 'x', ref: 'factor:us_10y' },
    { title: 'x', ref: 'committee:sen:Commerce' },
  ],
};
const earn = [{ name: 'MSFT', last: '2026-10-28', next: '2027-01-27' }];

function cases() {
  const out = [];
  for (const en of [false, true]) for (const kind of Object.keys(stops)) {
    for (const st of [{ study: { n: 5, mean: 3.2 } }, { study: { n: 1, mean: 9 } }, { packs: [{ n: 8, mean: -2.5 }] }, {}]) {
      out.push(T.build(Object.assign({ en, kind, today: '2026-10-29', stops: stops[kind], m1: 4.1, m1label: 'MSFT', priced: true, earn, latest: '2026-07-27' }, st)));
      out.push(T.build(Object.assign({ en, kind, today: '2026-10-29', stops: stops[kind], earn: [] }, st)));
    }
  }
  return out;
}

test('generated card text has no banned words', () => {
  for (const c of cases()) for (const l of c.lines) {
    assert.doesNotMatch(l, BAN, l);
    assert.doesNotMatch(l, T.BANNED, l);
  }
  // 소스 자체에도 금지어를 단정 문장으로 쓰지 않는다(BANNED 정의 줄 제외).
  const src = html.match(/<script id="mt-tour-summary-js">([\s\S]*?)<\/script>/)[1].split('\n').filter(l => !/const BANNED|^\/\//.test(l)).join('\n');
  assert.doesNotMatch(src, /때문|추천|because|recommend/i);
});

test('pattern: honest when fewer than 3 past cases, estimate label otherwise', () => {
  const few = T.build({ en: false, kind: 'company', today: '2026-10-29', stops: stops.company, study: { n: 2, mean: 5 } });
  assert.match(few.pattern, /비슷한 사례가 아직 적어서/);
  assert.match(few.pattern, /말하기 어려워요/);
  assert.doesNotMatch(few.pattern, /평균/);
  const enFew = T.build({ en: true, kind: 'company', today: '2026-10-29', stops: stops.company });
  assert.match(enFew.pattern, /too few similar past cases/);
  const ok = T.build({ en: false, kind: 'company', today: '2026-10-29', stops: stops.company, study: { n: 4, mean: -1.234 } });
  assert.match(ok.pattern, /과거 비슷한 발표 4번 때 한 달 뒤 주가는 평균 -1\.2% 움직였어요\. 지난 기록일 뿐/);
  const pk = T.build({ en: false, kind: 'sector', today: '2026-10-29', stops: stops.sector, packs: [{ n: 2, mean: 1 }, { n: 4, mean: 4 }] });
  assert.match(pk.pattern, /발표 6번 때.*지난 기록일 뿐/);
});

test('recap uses 같은 기간 form; works for bill and sector routes', () => {
  for (const kind of ['company', 'bill', 'sector']) {
    const c = T.build({ en: false, kind, today: '2026-10-29', stops: stops[kind] });
    assert.match(c.recap, /같은 기간 .+있었어요/);
    assert.ok(c.watch.length >= 1 && c.sources.startsWith('출처:'));
  }
  const b = T.build({ en: false, kind: 'bill', today: '2026-10-29', stops: stops.bill, latest: '2026-07-27' });
  assert.ok(b.watch.some(w => w.includes('2026-07-27')));
  const e = T.build({ en: true, kind: 'company', today: '2026-10-29', stops: stops.company, earn });
  assert.match(e.watch[0], /last earnings report .* was filed \d{4}-\d{2}-\d{2}\.$/); // past dates only, no guessed next date
  assert.doesNotMatch(e.watch[0], /estimate|may come/);
  assert.match(e.recap, /In the same period/);
});

test('next-earnings estimate is in the future and study uses 21 trading days', () => {
  const k8 = [{ filed: '2026-10-28', items: ['2.02'] }, { filed: '2026-07-29', items: ['2.02', '9.01'] }, { filed: '2026-04-29', items: ['2.02'] }];
  const n = T.nextEarn(k8, '2026-10-29');
  assert.equal(n.last, '2026-10-28');
  assert.ok(n.next > '2026-10-29');
  const d = [], c = [];
  for (let i = 0; i < 40; i++) { d.push('2026-01-' + String(i + 1).padStart(2, '0')); c.push(100 + i); }
  const s = T.study({ d, c }, [{ filed: '2026-01-05', items: ['2.02'] }, { filed: '2026-01-05', items: ['2.02'] }, { filed: '2026-01-30', items: ['2.02'] }]);
  assert.equal(s.n, 1); // 중복 제거, 한 달이 안 지난 건 제외
  assert.ok(Math.abs(s.mean - ((125 / 104) - 1) * 100) < 1e-9);
});

test('card is rendered inside the briefing panel, mobile-safe, textContent only', () => {
  assert.match(html, /id="mtTourCard"|#mtTourCard\{/);
  assert.match(html, /@media \(max-width:600px\)\{#mtTourCard/);
  const js = html.match(/<script id="mt-tour-summary-js">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(js, /innerHTML/);
  assert.match(html, /\^\(company\|bill\|sector\):/);
});
