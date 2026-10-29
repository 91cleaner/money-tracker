'use strict';
/* 관제실 검색 첫 화면(assets/firstscreen.js): 말만 바꾼 질문 묶음 -> 같은 의도·같은 답, 의도가 다르면 다른 화면, 금지어 없음. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const I = require('../assets/intent.js');
const F = require('../assets/firstscreen.js');
const M = I.build(read('data/search-index.json'), read('data/intent-lexicon.json'));
const lex = read('data/first-screen-lexicon.json');
const members = read('data/us/members.json').members.map(m => ({ id: m.id, name: m.name }));
const getJson = p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'data', p), 'utf8')));
const ANYWORD = /(때문에|추천|because|recommend)/i;

async function screen(q, lang) {
  const plan = F.understand(q, I, M, members, lex);
  const data = await F.fetchData(plan, getJson);
  const doc = F.build(plan, data, lang || 'ko', null);
  return { plan, doc, text: F.toText(doc) };
}
const numbers = t => (t.match(/[+−-]?\d[\d,.]*%?/g) || []).join('|');

const GROUPS = {
  why: { kind: 'why', symbol: 'NVDA', qs: ['엔비디아 왜 떨어져', 'why is NVDA down', '엔비디아 요즘 왜 이래', 'NVDA 주가', '앤비디아 왜 이래', '엔비디아왜떨어져', '엔비디아가 왜 폭락했어?', 'why did nvidia drop', '젠슨황 회사 급등 이유'] },
  topic: { kind: 'topic', symbol: 'NVDA', qs: ['엔비디아 관세', 'nvidia tariff', 'NVDA tariff', '젠슨황 회사 관세 맞았어?', '엔비디아 상호관세'] },
  member: { kind: 'member', symbol: 'NVDA', qs: ['엔비디아 의원 매도', '의원 누가 엔비디아 팔았어', 'NVDA congress sale', 'which lawmaker sold nvidia'] },
  memberLee: { kind: 'member', symbol: 'BAC', qs: ['Laurel Lee BAC', '로렐 리 뱅크오브아메리카', 'Laurel Lee Bank of America'] },
  money: { kind: 'money', symbol: 'NVDA', qs: ['엔비디아 로비', 'nvidia lobbying', 'NVDA lobby'] },
  contract: { kind: 'money', symbol: 'LMT', qs: ['록히드마틴 정부 계약', 'Lockheed Martin government contract'] },
  overview: { kind: 'overview', symbol: 'NVDA', qs: ['엔비디아', 'NVDA', 'nvidia'] }
};

for (const [name, g] of Object.entries(GROUPS)) {
  test('intent group ' + name + ': 말만 바꿔도 같은 의도·같은 대상·같은 답', async () => {
    const outs = [];
    for (const q of g.qs) {
      const r = await screen(q);
      assert.equal(r.plan.kind, g.kind, q + ' -> ' + r.plan.kind);
      assert.equal(r.plan.symbol, g.symbol, q + ' symbol');
      outs.push(r);
    }
    if (g.kind === 'overview') return;
    const base = outs[0];
    outs.forEach((o, i) => assert.equal(o.text, base.text, g.qs[i] + ' differs from ' + g.qs[0]));
  });
}

test('why: 한 줄 답 + 카드 3장 + 흐름 그림, 숫자가 데이터와 같다', async () => {
  const { doc, text } = await screen('엔비디아 왜 떨어져');
  const pack = read('data/answers/NVDA.json');
  assert.equal(doc.kind, 'why');
  assert.equal(doc.cards.length, 3);
  assert.ok(doc.flow && doc.flow.nodes.length === 3);
  assert.match(doc.headline, /최근 한 달/);
  assert.ok(doc.headline.includes(F._pct(pack.periods['1m'].ret)), doc.headline);
  assert.ok(doc.tour);
  assert.match(text, /같은 기간/);
  assert.match(text, /▶ 전체 경로 투어/);
});

test('why EN: 영어 한 줄 답과 같은 숫자', async () => {
  const ko = await screen('why is NVDA down', 'ko'), en = await screen('why is NVDA down', 'en');
  assert.match(en.doc.headline, /moved .* over the past month/);
  assert.ok(en.doc.headline.includes(F._pct(read('data/answers/NVDA.json').periods['1m'].ret)));
  assert.equal(numbers(en.doc.headline.replace(/^\S+/, '')), numbers(ko.doc.headline.replace(/^\S+/, '')));
  assert.equal(en.plan.symbol, ko.plan.symbol);
  assert.doesNotMatch(en.text, /[가-힣]/);
});

test('말하는 기간이 있으면 기간이 바뀐다(이번달=1달, 올해=1년)', async () => {
  const a = await screen('엔비디아 올해 주가'), b = await screen('엔비디아 이번달 왜 올랐어');
  assert.equal(a.plan.period, '1y'); assert.equal(b.plan.period, '1m');
  assert.notEqual(a.doc.headline, b.doc.headline);
});

test('의도가 다르면 첫 화면이 서로 다르다', async () => {
  const kinds = {};
  for (const [q, k] of [['엔비디아 왜 떨어져', 'why'], ['엔비디아 관세', 'topic'], ['엔비디아 의원 매도', 'member'], ['엔비디아 로비', 'money']]) {
    const r = await screen(q); assert.equal(r.doc.kind, k); kinds[k] = r.text;
  }
  const v = Object.values(kinds);
  assert.equal(new Set(v).size, v.length);
  assert.equal(new Set(['why', 'topic', 'member', 'money'].map(k => kinds[k].split('\n')[0])).size, 4);
});

test('의원: 로렐 리 BAC 거래 목록 + 판 뒤 주가 변화', async () => {
  const { doc, plan } = await screen('Laurel Lee BAC');
  assert.equal(plan.member.id, 'L000597');
  assert.equal(doc.kind, 'member');
  const t = read('data/us/trades_public.json').trades.filter(x => x.id === 'L000597' && x.tk === 'BAC');
  assert.ok(t.length >= 2);
  assert.equal(doc.cards[0].lines.length, Math.min(8, t.length));
  assert.match(doc.headline, /Laurel M?\.? ?Lee|Laurel Lee/);
  assert.ok(doc.cards[1].big.includes('−'), doc.cards[1].big);
  const only = await screen('Laurel Lee');
  assert.equal(only.doc.kind, 'member'); assert.ok(only.doc.cards[0].lines.length > 0);
});

test('돈 흐름 그림: 로비는 회사→워싱턴 화살표와 큰 숫자', async () => {
  const { doc } = await screen('엔비디아 로비');
  assert.equal(doc.flow.nodes.length, 2);
  assert.ok(doc.flow.edges[0].label.includes('1,538만') || doc.flow.edges[0].label.includes('만 달러'), doc.flow.edges[0].label);
  const c = await screen('록히드마틴 정부 계약');
  assert.ok(c.doc.flow.nodes[0].sub.includes('DOD'));
});

test('주제 전용: 그 주제 기록만, 없으면 아직 기록이 없어요(지어내지 않음)', async () => {
  const t = await screen('엔비디아 노조');
  assert.equal(t.doc.kind, 'topic');
  assert.ok(t.doc.empty);
  assert.match(t.text, /아직 기록이 없어요/);
  const x = await screen('수출 단속');
  assert.equal(x.plan.kind, 'topic'); assert.ok(x.doc.suggest.length);
  const n = await screen('노조'); assert.equal(n.plan.kind, 'topic');
  const e = await screen('엔비디아 정부 계약', 'en');
  assert.match(e.text, /No records yet|contracts/);
});

test('회사 이름만 = 전체 경로 투어(첫 화면 카드 없음), 공급망·비교는 옛 경로', async () => {
  const o = await screen('엔비디아');
  assert.equal(o.doc, null);
  assert.equal(o.plan.kind, 'overview');
  assert.equal((await screen('엔비디아 공급망')).plan.kind, 'other');
});

test('금지어(때문에·추천·because·recommend)가 어떤 화면에도 없다', async () => {
  const qs = [].concat(...Object.values(GROUPS).map(g => g.qs), ['엔비디아 관세 때문에 왜 떨어져', 'TSLA why down', '테슬라 노조', '애플 의원 매도', 'MSFT lobbying', 'Pelosi', '펠로시 엔비디아']);
  for (const q of qs) for (const lang of ['ko', 'en']) {
    const { text } = await screen(q, lang);
    assert.doesNotMatch(text, F.FORBIDDEN, q + ' ' + lang);
  }
});

test('렌더 코드는 innerHTML 을 쓰지 않고 네트워크를 직접 부르지 않는다', () => {
  const code = fs.readFileSync(path.join(root, 'assets/firstscreen.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /innerHTML|fetch\(|XMLHttpRequest|eval\(|localStorage/);
});
