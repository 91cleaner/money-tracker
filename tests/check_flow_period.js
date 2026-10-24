/* assets/period.js fixFlows 가 전체 기간 값을 유지하고, 짧은 기간은 local ≤ known ≤ total 인지. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const dl = read('data/daily.json');
const fd = read('data/flow_daily.json');
const fl = read('data/flows.json');

const sandbox = {
  window: null, self: null, location: {search: '', href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: ''},
  sessionStorage: {getItem() { return null; }, setItem() {}, removeItem() {}},
  addEventListener() {},
  document: {readyState: 'loading', addEventListener() {}, querySelector() { return null; }, head: {append() {}}, body: {prepend() {}}, createElement() { return {textContent: '', style: {setProperty() {}}, querySelector() { return null; }, append() {}}; }},
  fetch: async () => ({ok: true, json: async () => ({})}),
  URLSearchParams, URL, history: {replaceState() {}, state: null}, scrollTo() {}, scrollY: 0, console,
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/period.js'), 'utf8'), sandbox, {filename: 'assets/period.js'});
if (typeof sandbox.__fixFlows !== 'function') {
  console.error('__fixFlows missing');
  process.exit(1);
}

const shift = (s, k) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const lo0 = dl.cover_from || dl.first;
const stops = [7, 14, 30, 60, 90, 0];
const err = [];
const sumTotal = (slug, from, to) => { let t = 0; const m = (dl.c || {})[slug] || {}; for (const k in m) if (k >= from && k <= to) t += m[k][1] || 0; return t; };

for (const s of stops) {
  let from = s ? shift(dl.last, 1 - s) : lo0;
  if (from < lo0) from = lo0;
  const w = {dl, from, to: dl.last, d: s, lo: lo0};
  const x = JSON.parse(JSON.stringify(fl));
  sandbox.__fixFlows(x, w, fd);
  const full = from <= dl.first && dl.last >= dl.last;
  for (const slug in fl.cities) {
    const c = x.cities[slug], o = fl.cities[slug];
    const tot = sumTotal(slug, from, dl.last);
    if (c.total !== tot) err.push(`${slug} ${s} total ${c.total} ≠ daily ${tot}`);
    if (full) {
      if (c.local !== o.local || c.known !== o.known || JSON.stringify(c.flows) !== JSON.stringify(o.flows) || JSON.stringify(c.other) !== JSON.stringify(o.other) || c.__pf) err.push(`${slug} 전체 기간 값이 바뀜`);
      continue;
    }
    if (!c.__pf) err.push(`${slug} ${s} __pf 없음`);
    if (!(c.local <= c.known && c.known <= c.total)) err.push(`${slug} ${s} local ${c.local} known ${c.known} total ${c.total}`);
    const sumF = (c.flows || []).reduce((a, f) => a + f.amount, 0) + ((c.other && c.other.amount) || 0);
    if (sumF !== c.known) err.push(`${slug} ${s} 흐름 합 ${sumF} ≠ known ${c.known}`);
  }
}

const w30from = shift(dl.last, 1 - 30);
const x30 = JSON.parse(JSON.stringify(fl));
sandbox.__fixFlows(x30, {dl, from: w30from < lo0 ? lo0 : w30from, to: dl.last, d: 30, lo: lo0}, fd);
const my = x30.cities.miryang;
const myTot = sumTotal('miryang', w30from < lo0 ? lo0 : w30from, dl.last);
const eok = myTot / 1e8 >= 100 ? Math.round(myTot / 1e8) : null;
if (!(my.local <= my.known && my.known <= my.total && my.total === myTot)) err.push(`밀양 30일 ${my.local} ${my.known} ${my.total} daily ${myTot}`);
if (dl.last === '2026-10-24' && myTot === 19863897747) {
  if (eok !== 199) err.push(`밀양 30일 표기 ${eok}억, 199억이 아님`);
  if (my.known !== myTot) err.push(`밀양 30일 known ${my.known} ≠ 합계 ${myTot}`);
  const home = (my.flows || []).find((f) => f.to === '경남 밀양시');
  if (!home || home.amount > myTot || home.amount >= fl.cities.miryang.local) err.push(`밀양 우리 시 흐름 ${home && home.amount}`);
}

if (err.length) {
  console.error(err.slice(0, 30).join('\n'));
  process.exit(1);
}
console.log('ok', Object.keys(fl.cities).length, 'cities');
