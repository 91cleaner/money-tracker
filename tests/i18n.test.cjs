'use strict';
/* Contract checks for assets/i18n.js (KO/EN switch) and where it is attached. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const src = read('assets/i18n.js');
const api = require('../assets/i18n.js');

test('script parses and exposes the formatters', () => {
  assert.doesNotThrow(() => new vm.Script(src, { filename: 'i18n.js' }));
  for (const k of ['tr', 'toEn', 'date', 'dateEn', 'usd', 'krw', 'set']) assert.equal(typeof api[k], 'function', k);
});

test('dates: MMM D, YYYY; amounts: $ with K/M/B; KRW keeps 억/만원 in KO', () => {
  assert.equal(api.dateEn('2026-10-01'), 'Oct 1, 2026');
  assert.equal(api.toEn('2026-09-14'), 'Sep 14, 2026');
  assert.equal(api.toEn('2026-10'), 'Oct 2026');
  assert.equal(api.usd(1.1e9), '$1.10B'); assert.equal(api.usd(10.3e6), '$10.30M'); assert.equal(api.usd(15000), '$15K');
  assert.equal(api.koUsd('5,031', '만'), '$50.31M'); assert.equal(api.koUsd('5.0', '억'), '$500.00M');
  assert.equal(api.lang, 'ko'); // node: no ?lang, no storage -> Korean stays the default
  assert.equal(api.krw(250000000), '2.5억원'); assert.equal(api.krw(30000), '3만원');
  assert.equal(api.tr('투자 조언 아님'), '투자 조언 아님', 'KO mode leaves Korean untouched');
});

test('neutral wording survives translation', () => {
  const t = api.toEn;
  assert.equal(t('투자 조언 아님'), 'Not investment advice');
  assert.match(t('신고 기준입니다. STOCK Act상 의원은 거래 후 최대 45일 안에 신고하므로 거래일과 신고일 사이에 차이가 있을 수 있습니다. 금액은 신고서에 적힌 구간입니다. 공개 기록일 뿐 잘잘못 판단이 아니며, 투자 조언이 아닙니다.'),
    /^Based on filings\..*Disclosed \(PTR\), up to 45-day lag.*not investment advice\.$/);
  assert.match(t('데이터상 공개 기록을 정리한 화면입니다. 사거나 팔라는 뜻이 아니며 원인 관계를 단정하지 않습니다.'), /data shows them.*not a suggestion to buy or sell.*no causal claim/);
  assert.doesNotMatch(Object.values({ a: t('종가는 수정종가(adjusted) 기준 2026-10-27 · 등락은 종가 대비 변화율이며 사거나 팔라는 뜻이 아닙니다.') }).join(' '), /[가-힣]/);
});

test('stored insight sentences become English with numbers and dates intact', () => {
  const ins = JSON.parse(read('data/us/insights.json'));
  const lines = []; (function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (typeof o.text === 'string') lines.push(o.text); Object.values(o).forEach(walk); } else if (typeof o === 'string' && /[가-힣]/.test(o)) lines.push(o); })(ins.companies);
  const left = new Set(); let total = 0;
  for (const l of lines) { total++; const e = api.toEn(l.replace(/'[^']*'/g, "'X'")); if (/[가-힣]/.test(e)) left.add(l.slice(0, 60)); }
  assert.ok(total > 100);
  assert.deepEqual([...left].slice(0, 5), [], 'untranslated insight templates');
  assert.equal(api.toEn('하원 PTR 신고 최근 90일(2026-07-24~2026-10-22) 20건(구입 9·처분 11 의원 11명), 직전 90일 14건. 신고 기준, 거래일→신고일 최대 45일 차이 가능.'),
    'House PTR filings, last 90 days (Jul 24, 2026~Oct 22, 2026): 20 (buys 9 · sales 11, 11 members); prior 90 days: 14. Based on filings; disclosed (PTR), up to 45-day lag.');
});

test('page strings: tables, counts, titles', () => {
  const t = api.toEn;
  assert.equal(t('12일 · 45일 초과'), '12 days · over 45 days');
  assert.equal(t('1건 · P1/S0'), '1 filing · P1/S0');
  assert.equal(t('MONEY TRACKER — NVDA 회사 상세'), 'MONEY TRACKER — NVDA · Company file');
  assert.equal(t('구입(P)'), 'Purchase (P)');
  assert.equal(t('반도체'), 'Semiconductors');
  assert.equal(t('Alphabet Inc. (GOOG)'), 'Alphabet Inc. (GOOG)', 'US source text is left as published');
});

test('attached to company, member, sector and the command room; X share follows the language', () => {
  for (const f of ['company.html', 'member.html', 'sector.html']) assert.match(read(f), /<script src="assets\/i18n\.js\?v=[^"]+"><\/script>\n<style>/, f);
  const wi = read('world-intelligence/index.html');
  assert.match(wi, /<script src="\.\.\/assets\/i18n\.js\?v=[^"]+"><\/script>\n<script src="\.\.\/assets\/share\.js/);
  const share = read('assets/share.js');
  assert.match(share, /𝕏 Share/); assert.match(share, /Source: /); assert.match(share, /MTI18N/);
  assert.match(wi, /EN\?'':' · '\+b\.ko/, 'EN uses the original title, not the Korean tag');
  assert.match(src, /\?lang=en|get\("lang"\)/); assert.match(src, /"mt\.lang"/);
});

// ---- DOM behaviour with a tiny fake DOM (no jsdom in this repo) ----
function fakeEnv(search, stored) {
  const mk = (name, type) => {
    const n = { nodeType: type || 1, nodeName: name, childNodes: [], attrs: {}, parentNode: null, listeners: {}, style: {}, className: '' };
    Object.defineProperty(n, 'firstChild', { get() { return n.childNodes[0] || null; } });
    Object.defineProperty(n, 'nextSibling', { get() { const p = n.parentNode; return p ? p.childNodes[p.childNodes.indexOf(n) + 1] || null : null; } });
    n.appendChild = c => { c.parentNode = n; n.childNodes.push(c); return c; };
    n.append = (...cs) => cs.forEach(c => n.appendChild(typeof c === 'string' ? Object.assign(mk('#text', 3), { nodeValue: c }) : c));
    n.insertBefore = (c, ref) => { c.parentNode = n; n.childNodes.splice(ref ? n.childNodes.indexOf(ref) : n.childNodes.length, 0, c); return c; };
    n.setAttribute = (k, v) => { n.attrs[k] = String(v); }; n.getAttribute = k => (k in n.attrs ? n.attrs[k] : null); n.hasAttribute = k => k in n.attrs;
    n.addEventListener = (e, f) => { n.listeners[e] = f; };
    n.querySelector = sel => { const id = /^#(.+)$/.exec(sel); const all = []; (function w(x) { x.childNodes.forEach(c => { all.push(c); w(c); }); })(n); return all.find(c => id ? c.attrs && c.attrs.id === id[1] : c.nodeName.toLowerCase() === sel.replace(/\..*/, '')) || null; };
    Object.defineProperty(n, 'textContent', { set(v) { n.childNodes = []; n.appendChild(Object.assign(mk('#text', 3), { nodeValue: String(v) })); }, get() { return n.childNodes.map(c => c.nodeValue != null ? c.nodeValue : c.textContent).join(''); } });
    Object.defineProperty(n, 'id', { set(v) { n.attrs.id = v; }, get() { return n.attrs.id; } });
    return n;
  };
  const html = mk('HTML'), head = mk('HEAD'), body = mk('BODY'); html.append(head, body);
  const header = mk('HEADER'); header.className = 'bar'; body.appendChild(header);
  const h2 = mk('H2'); h2.textContent = '의원 거래 신고 (하원 PTR)'; body.appendChild(h2);
  const inp = mk('INPUT'); inp.setAttribute('placeholder', '티커'); body.appendChild(inp);
  const td = mk('TD'); td.textContent = '2026-10-01'; body.appendChild(td);
  const store = Object.assign({}, stored), seen = {};
  let observerCb = null;
  const document = { readyState: 'complete', documentElement: html, head, body, createElement: mk, createTextNode: t => Object.assign(mk('#text', 3), { nodeValue: t }), querySelector: s => (s === 'header.bar' ? header : null), getElementById: id => body.querySelector('#' + id), addEventListener() { } };
  const win = { document, location: { search, href: 'https://x.test/company.html' + search, replace: u => { seen.replaced = u; }, reload: () => { seen.reloaded = true; } },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, MutationObserver: function (cb) { observerCb = cb; this.observe = () => { }; this.takeRecords = () => []; } };
  win.window = win; win.URLSearchParams = URLSearchParams; win.URL = URL; win.NodeFilter = {}; win.globalThis = win;
  const ctx = vm.createContext(Object.assign(win, { console, String, Number, Object, Array, RegExp, Date, Math, JSON }));
  vm.runInContext(src, ctx, { filename: 'i18n.js' });
  return { win, document, body, header, h2, inp, td, store, seen, fire: (type, target, added) => observerCb([{ type, target, addedNodes: added || [], attributeName: null }]) };
}

test('?lang=en turns on EN, is saved, translates the page and adds one KO/EN button in the header', () => {
  const e = fakeEnv('?lang=en', {});
  assert.equal(e.win.MTI18N.isEn, true); assert.equal(e.store['mt.lang'], 'en'); assert.equal(e.document.documentElement.lang, 'en');
  assert.equal(e.h2.textContent, 'Member trade filings (House PTR)');
  assert.equal(e.inp.getAttribute('placeholder'), 'Ticker');
  assert.equal(e.td.textContent, 'Oct 1, 2026');
  const btns = e.header.childNodes.filter(c => c.attrs && c.attrs.id === 'mtLangBtn'); assert.equal(btns.length, 1);
  btns[0].listeners.click(); assert.equal(e.store['mt.lang'], 'ko'); assert.match(e.seen.replaced || '', /lang=ko/);
  // text added later (dynamic rendering) is translated too
  const late = e.document.createElement('P'); late.textContent = '투자 조언 아님'; e.body.appendChild(late); e.fire('childList', e.body, [late]);
  assert.equal(late.textContent, 'Not investment advice');
});

test('saved choice applies without ?lang; ?lang=ko overrides it; default is KO and the page stays Korean', () => {
  assert.equal(fakeEnv('', { 'mt.lang': 'en' }).win.MTI18N.isEn, true);
  const k = fakeEnv('?lang=ko', { 'mt.lang': 'en' }); assert.equal(k.win.MTI18N.isEn, false); assert.equal(k.store['mt.lang'], 'ko');
  const d = fakeEnv('', {}); assert.equal(d.win.MTI18N.isEn, false); assert.equal(d.h2.textContent, '의원 거래 신고 (하원 PTR)'); assert.equal(d.td.textContent, '2026-10-01');
});

test('follow-up: card labels, WH types, company chart strings are English; names use Latin alias', () => {
  const en = s => api.toEn(s);
  const cases = {
    '엔비디아 (NVDA) 경로': 'route', '공시': 'Filings', '대략 위치': 'Approx. location', '함께 볼 지표: 유로/달러 환율': 'Indicator to watch: EUR/USD',
    '로비 공시(LDA)': 'Lobbying disclosure (LDA)', '의원 주식 거래(하원 PTR)': 'Member stock trades (House PTR)', '연계 PAC 후원': 'Linked PAC',
    '포고문': 'Proclamation', '상무부 BIS(산업안보국)': 'Commerce BIS', '대통령 조치': 'Presidential action', '1년': '1Y', '주간 순위표': 'Weekly ranking',
    '의원 거래 신고(신고일 기준)': 'by filing date', '백악관·관보 조치': 'Federal Register', '1년 종가 추이 2026-01-02 ~ 2026-10-27': '1Y closing-price trend Jan 2, 2026',
    '의원 거래 신고(신고일 기준) 2026-10-01 외 3건': 'and 3 more'
  };
  for (const [k, v] of Object.entries(cases)) { const o = en(k); assert.ok(o.includes(v), k + ' -> ' + o); }
  const note = en('1달 종가 2026-09-27 ~ 2026-10-27 · 범위 100 ~ 120 · 출처: Massive · 핀 2건. 핀은 같은 기간 공개 기록의 날짜일 뿐 주가 변동의 원인을 뜻하지 않습니다. 의원 거래는 신고일 기준이며 실제 거래는 최대 45일 앞설 수 있습니다. 연방 계약은 날짜별 자료가 없어 핀으로 표시하지 않습니다.');
  assert.ok(!/[가-힣]/.test(note) && /not investment advice/i.test(note), note);
  assert.equal(api.name({ name: '엔비디아', symbol: 'NVDA', aliases: ['NVDA', 'NVIDIA CORP', '엔비디아'] }), '엔비디아'); // KO mode keeps the Korean name (EN picks the Latin alias: "Nvidia Corp.")
});

test('follow-up 2: NVDA route / indicator / lobbying / PAC data leave no Korean in EN', () => {
  const left = [];
  const check = s => { if (typeof s === 'string' && /[가-힣]/.test(s) && /[가-힣]/.test(api.toEn(s))) left.push(s.slice(0, 70)); };
  const walk = (o, skip) => { if (Array.isArray(o)) o.forEach(x => walk(x, skip)); else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => { if (!skip.includes(k)) walk(v, skip); }); else check(o); };
  const idx = JSON.parse(read('data/search-index.json'));
  walk(Object.values(idx.entities).filter(e => e.symbol === 'NVDA' || (e.aliases || []).includes('NVDA')), ['aliases', 'name']); // names are shown through api.name(); aliases are search terms
  walk(JSON.parse(read('data/us/ticker-routes.json')).routes, ['aliases', 'factcheck']); // factcheck is an internal note, not rendered
  walk(JSON.parse(read('data/us/insights.json')).companies.NVDA, []);
  assert.deepEqual(left, [], 'Korean left in EN');
  const t = api.toEn;
  assert.equal(t('함께 볼 지표: 미국 10년 국채 금리'), 'Indicator to watch: US 10-year Treasury yield');
  assert.equal(t('함께 볼 지표: 대만달러/달러 환율'), 'Indicator to watch: TWD/USD exchange rate');
  assert.match(t('요즘 값은 약 431.2억 달러이에요(2026-09).'), /^Recent value: approx\. \$43\.12B \(Sep 2026\)\.$/);
  assert.equal(t('유형(신고대로)'), 'Type (as filed)');
  assert.equal(t('아래 링크'), 'Link below');
  assert.equal(t('◉ 지원되는 작전 경로'), '◉ Supported routes');
  assert.equal(api.tr('공급사 TSMC(파운드리)'), '공급사 TSMC(파운드리)', 'KO mode untouched');
});
