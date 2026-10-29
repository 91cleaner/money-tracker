'use strict';
/* #269 후속(#271): 정식 회사명 주어, 의원 조회, 하나의 기간 창, 분위기 카드 연결, 개요 투어, 연방 계약 이름 매칭. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const I = require('../assets/intent.js');
const F = require('../assets/firstscreen.js');
const Mood = require('../assets/mood.js');
const index = read('data/search-index.json');
const M = I.build(index, read('data/intent-lexicon.json'));
const lex = read('data/first-screen-lexicon.json');
const members = read('data/us/members.json').members.map(m => ({ id: m.id, name: m.name }));
const getJson = p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'data', p), 'utf8')));
const html = fs.readFileSync(path.join(root, 'world-intelligence/index.html'), 'utf8');

async function screen(q, lang) {
  const plan = F.understand(q, I, M, members, lex);
  const data = await F.fetchData(plan, getJson);
  const names = plan.symbol ? F.namesFor(index, plan.symbol, null) : null;
  const doc = F.build(plan, data, lang || 'ko', names);
  return { plan, data, doc, text: F.toText(doc) };
}

test('1) 별칭으로 물어도 한 줄 답은 정식 회사명(엔비디아)으로 시작한다', async () => {
  for (const q of ['젠슨황 회사 왜 이래', '젠슨 황 왜 떨어져', 'jensen 왜 이래', 'jensen huang why is it down', '젠슨황 회사 관세', '젠슨황 회사 로비']) {
    const { plan, doc } = await screen(q);
    assert.equal(plan.symbol, 'NVDA', q);
    assert.ok(doc.headline.startsWith('엔비디아'), q + ' -> ' + doc.headline);
    assert.doesNotMatch(doc.headline, /젠슨|jensen/i, q);
  }
  assert.equal(F.namesFor(index, 'NVDA', null).ko, '엔비디아');
  assert.equal(F.namesFor(index, 'NVDA', 'NVIDIA').en, 'NVIDIA');
  const en = await screen('why is jensen down', 'en');
  assert.doesNotMatch(en.doc.headline, /[가-힣]|jensen/i);
});

test('1) 페이지는 가장 긴 별칭이 아니라 정식 이름(namesFor)을 쓴다', () => {
  assert.match(html, /window\.MTFirst\.namesFor\(ix,sym,en\)/);
  assert.doesNotMatch(html, /ko=al\.filter\(x=>\/\[가-힣\]\/\.test\(x\)\)\[0\]/);
});

test('2) 의원 의도: Laurel Lee BAC 는 거래 2건과 가격 파일 기준 r', async () => {
  const { plan, doc, text } = await screen('Laurel Lee BAC');
  assert.equal(plan.kind, 'member');
  assert.equal(plan.member.id, 'L000597');
  assert.equal(doc.empty, false);
  assert.equal(doc.cards[0].big, '2건');
  assert.match(text, /8\/24 매도/);
  assert.match(text, /−18\.7%/);
  assert.doesNotMatch(text, /−18\.3%/);
});

test('2) 의원 의도: "의원 누가 엔비디아 팔았어"는 매도만, 누가 많이 팔았는지', async () => {
  const { plan, doc, text } = await screen('의원 누가 엔비디아 팔았어');
  assert.equal(plan.kind, 'member'); assert.equal(plan.side, 'sell');
  assert.equal(doc.empty, false);
  assert.match(doc.headline, /매도 \d+건, 매수 0건/);
  assert.match(text, /누가: .*Daniel Meuser 매도 7건/);
  assert.doesNotMatch(doc.cards[0].lines.join('\n'), /매수 ·/);
});

test('2) 의원 성(Meuser)만 써도 찾고 매수 필터도 된다', async () => {
  const sold = await screen('Meuser NVDA 매도');
  assert.equal(sold.plan.member.name, 'Daniel Meuser');
  assert.match(sold.doc.headline, /매도 7건/);
  const bought = await screen('who bought nvidia congress');
  assert.equal(bought.plan.side, 'buy');
  assert.match(bought.doc.headline, /매도 0건, 매수 \d+건/);
});

test('2) 거래 자료가 없으면 빈 화면 대신 이유를 보여 준다', async () => {
  const plan = F.understand('Laurel Lee BAC', I, M, members, lex);
  const doc = F.build(plan, { trades: null }, 'ko', F.namesFor(index, 'BAC', null));
  assert.equal(doc.empty, true);
  assert.match(F.toText(doc), /불러오지 못했어요/);
});

test('3) 모든 카드가 같은 기간 창을 쓰고 화면에 적는다 (왜 이래 vs 관세)', async () => {
  const why = await screen('엔비디아 왜 이래'), tariff = await screen('엔비디아 관세');
  const re = /최근 30일\(\d{4}-\d{2}-\d{2}~\d{2}-\d{2}\) 기준/;
  assert.match(why.doc.window, re);
  assert.equal(tariff.doc.window, why.doc.window);
  ['price', 'events'].forEach(id => assert.equal(why.doc.cards.find(c => c.id === id).window, why.doc.window));
  assert.ok(why.doc.cards.find(c => c.id === 'past').window, '과거 카드는 자기 기준을 적는다');
  assert.match(why.text, re);
  assert.match(tariff.text, re);
});

test('3) 기간 안에 기록이 없으면 두 카드 모두 "없음"이고, 긴 기간 기록은 안내만 한다', async () => {
  const tariff = await screen('엔비디아 관세'); /* 관세 기록은 있지만 최근 30일 밖 */
  assert.equal(tariff.doc.empty, true);
  assert.match(tariff.text, /최근 1년\)에는 3건 있었어요/);
  const year = await screen('엔비디아 관세 올해');
  assert.equal(year.doc.empty, false);
  assert.match(year.doc.window, /최근 365일/);
  const why = await screen('엔비디아 왜 이래');
  assert.equal(why.doc.cards.find(c => c.id === 'events').lines.some(l => /관세/.test(typeof l === 'string' ? l : l.text)), false);
});

test('3) 연방 계약: 티커 행이 없어도 회사 이름(수령자 검색어)으로 찾는다', () => {
  const aw = read('data/us/federal-awards.json');
  assert.equal(F.awardFor(aw, 'MSFT', M.companies.MSFT), aw.companies.MSFT);
  const fake = { companies: { GOOGL: { query: 'ALPHABET', recipient_names: ['ALPHABET INC.'], total_usd: 5 }, XX: { query: 'OTHER', total_usd: 9 } } };
  assert.equal(F.awardFor(fake, 'GOOG', { aliases: ['Alphabet Inc.', '구글'] }), fake.companies.GOOGL);
  assert.equal(F.awardFor({ companies: { ZZ: { query: 'NVIDIA', recipient_names: ['NVIDIA CORPORATION'], total_usd: 7 } } }, 'NVDA', M.companies.NVDA).total_usd, 7);
  assert.equal(F.awardFor(fake, 'NVDA', M.companies.NVDA), null);
  assert.equal(F.awardFor(fake, 'ZZZZ', null), null);
});

test('3) 엔비디아 정부 계약: 자료에 없으면 조회한 기간·범위와 이유를 쓴다', async () => {
  const { doc, text } = await screen('엔비디아 정부 계약');
  const aw = read('data/us/federal-awards.json');
  if (F.awardFor(aw, 'NVDA', M.companies.NVDA)) { assert.equal(doc.empty, false); return; }
  assert.equal(doc.cards[0].id, 'contract');
  assert.ok(doc.cards[0].window.includes(aw.period[0]));
  assert.match(text, /티커 NVDA 와 회사 이름 모두 맞는 수령자가 없었어요/);
});

test('3) 연방 계약이 있는 회사는 금액과 집계 기간이 같이 나온다', async () => {
  const { doc, text } = await screen('마이크로소프트 정부 계약');
  assert.equal(doc.empty, false);
  assert.ok(doc.cards[0].window.includes(read('data/us/federal-awards.json').period[0]));
  assert.match(text, /달러/);
});

test('4) 분위기+과거 카드: 기간 창과 비었을 때의 이유가 카드에 들어간다', () => {
  const win = { from: '2026-09-28', to: '2026-10-28', ko: '최근 30일(2026-09-28~10-28) 기준', en: 'past 30 days (2026-09-28 to 10-28)' };
  const empty = Mood.build({ symbol: 'NVDA', window: win, trades: [], series: { d: [], c: [] }, history: [] });
  assert.equal(empty.mood, 'none');
  assert.match(empty.ko.reason, /보여 줄 근거가 아직 없어요/);
  assert.equal(empty.ko.window, win.ko);
  const full = Mood.build({ symbol: 'NVDA', window: win, trades: [{ ty: 'S' }], series: { d: [], c: [] }, history: [] });
  assert.equal(full.ko.reason, null);
});

test('4) 분위기 카드가 첫 화면 경로에 연결되고 이전 카드는 지워진다', () => {
  assert.match(html, /window\.MTMood\.show\(mc,'\.\.\/',plan\.symbol,/);
  assert.match(html, /window:F\.windowPair\(plan,data\)/);
  assert.match(html, /const mo=\$\("moodCard"\);if\(mo\)\{mo\.hidden=true;mo\.replaceChildren\(\)\}/);
  assert.equal(typeof Mood.show, 'function');
});

test('4) Mood.show: 못 만들면 이유 문장을 보여 주고 숨기지 않는다', async () => {
  const el = { hidden: true, ownerDocument: { createElement: () => ({ set textContent(v) { this.t = v; }, get textContent() { return this.t; } }) }, replaceChildren() { this.kids = []; }, append(n) { this.kids.push(n); }, kids: [] };
  const prev = global.fetch;
  global.fetch = () => Promise.reject(new Error('offline'));
  try {
    const c = await Mood.show(el, '../', 'NVDA', { window: { ko: 'x', en: 'x' } }, false);
    assert.equal(el.hidden, false);
    if (c === null) assert.match(el.kids[0].textContent, /만들지 못했어요/);
    else assert.equal(c.mood, 'none'); /* load() swallows fetch errors and builds an empty card with its reason */
  } finally { global.fetch = prev; }
});

test('5) "엔비디아"만 입력하면 개요 의도라 전체 경로 투어를 바로 시작한다', async () => {
  for (const q of ['엔비디아', 'NVDA', 'nvidia', '젠슨황 회사', 'jensen', '젠슨 황']) {
    const { plan, doc } = await screen(q);
    assert.equal(plan.kind, 'overview', q);
    assert.equal(plan.symbol, 'NVDA', q);
    assert.equal(doc, null, q + ': 카드 화면이 아니라 투어로 간다');
  }
  assert.match(html, /plan\.kind==='overview'&&plan\.symbol\)\{const r=routeOf\('company:'\+plan\.symbol\);if\(r\)\{start\(r\);return true\}\}/);
});

test('같은 질문은 같은 기간 창·같은 숫자(결정적)', async () => {
  const a = await screen('엔비디아 왜 이래'), b = await screen('엔비디아 왜 떨어져');
  assert.equal(a.text, b.text);
  assert.doesNotMatch(F.toText(a.doc), /because|recommend|때문에|추천/i);
});
