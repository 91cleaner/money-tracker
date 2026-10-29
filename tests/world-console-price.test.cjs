// 세계 관제실 3달 주가(#263): 기간 기준일 표시·summary 비의존·실패 재시도
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'world-intelligence', 'index.html'), 'utf8');
const src = html.slice(html.indexOf('/*PX-START*/'), html.indexOf('/*PX-END*/'));
assert(src.includes('mkPx'), 'PX block missing');
const mk = (fetchFn) => {
  let n = 0;
  const ctx = vm.createContext({ Promise, Date, Array, String, isFinite, encodeURIComponent, Object });
  vm.runInContext(src + ';this.mkPx=mkPx;this.fmt=fmt', ctx);
  const px = ctx.mkPx(fetchFn, () => { n++; });
  return { px, count: () => n, fmt: ctx.fmt };
};
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
const day = (i) => new Date(Date.UTC(2026, 0, 1) + i * 864e5).toISOString().slice(0, 10);
const series = (len) => {
  const d = [], c = [];
  for (let i = 0; i < len; i++) { d.push(day(i)); c.push(100 + i); }
  return { d, c, as_of: d[len - 1] };
};
const ok = (j) => ({ ok: true, status: 200, json: async () => j });

(async () => {
  // 정상: 90일 이상, summary 없이도 계산, 시작/끝/as_of 노출
  let t = mk(async () => ok(series(200)));
  assert.strictEqual(t.px.get('AAPL').st, 'loading');
  await settle();
  const s = t.px.get('AAPL');
  assert.strictEqual(s.st, 'ready');
  assert.strictEqual(s.to, day(199));
  assert.strictEqual(s.from, day(109));
  assert.strictEqual(s.asof, day(199));
  assert(Math.abs(s.v - (299 / 209 - 1) * 100) < 1e-9);
  assert(t.count() >= 1);

  // 실제 AAPL 파일 계약
  const aapl = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/us/prices/AAPL.json'), 'utf8'));
  const r = mk(async () => ok(aapl));
  r.px.get('AAPL');
  await settle();
  const a = r.px.get('AAPL');
  assert.strictEqual(a.st, 'ready');
  assert.strictEqual(a.to, aapl.as_of);
  assert(a.from <= day(0) || a.from < a.to);
  assert(r.fmt(a.v).endsWith('%'));

  // 90일 미만 -> unavailable(short)
  t = mk(async () => ok(series(60)));
  t.px.get('X');
  await settle();
  assert.deepStrictEqual([t.px.get('X').st, t.px.get('X').why], ['unavailable', 'short']);

  // 404 -> unavailable(missing), 503 -> error, 200 재시도 -> ready (영구 캐시 아님)
  let code = 404;
  const calls = [];
  t = mk(async (u) => {
    calls.push(u);
    if (code === 200) return ok(series(200));
    return { ok: false, status: code };
  });
  t.px.get('Z');
  await settle();
  assert.deepStrictEqual([t.px.get('Z').st, t.px.get('Z').why], ['unavailable', 'missing']);
  code = 503;
  t.px.retry('Z');
  assert.strictEqual(t.px.get('Z').st, 'loading');
  await settle();
  assert.strictEqual(t.px.get('Z').st, 'error');
  code = 200;
  t.px.retry('Z');
  await settle();
  assert.strictEqual(t.px.get('Z').st, 'ready');
  assert.strictEqual(calls.length, 3);

  // error 상태에서 get 반복은 자동 재요청하지 않음
  const c2 = [];
  t = mk(async (u) => { c2.push(u); return { ok: false, status: 503 }; });
  t.px.get('E');
  await settle();
  t.px.get('E');
  t.px.get('E');
  assert.strictEqual(c2.length, 1);

  // 잘못된 JSON / 네트워크 오류 / 형식 오류
  t = mk(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } }));
  t.px.get('J');
  await settle();
  assert.strictEqual(t.px.get('J').st, 'error');
  t = mk(async () => { throw new TypeError('net'); });
  t.px.get('N');
  await settle();
  assert.strictEqual(t.px.get('N').st, 'error');
  t = mk(async () => ok({ d: ['2026-01-01'], c: 'x' }));
  t.px.get('S');
  await settle();
  assert.strictEqual(t.px.get('S').st, 'error');

  // UI 계약
  assert(!html.includes('M3[k]=null') && !html.includes('3달 주가는 준비 중'), 'old permanent-null/placeholder remains');
  const pi = html.slice(html.indexOf('function priceInfo'), html.indexOf('function stampN'));
  assert(pi.indexOf('period===90') < pi.indexOf('P&&P.t'), '90d path must not depend on summary');
  for (const w of ['가격 기준일', 'prices as of', '경로 기간', 'route window', '다시 시도', 'Retry', '불러오지 못했어요',
    'Could not load 3-month prices', '같은 기간 주가', 'not the same period', '90일에 못 미쳐', 'fewer than 90 days']) {
    assert(html.includes(w), 'missing text: ' + w);
  }
  assert(pi.includes('o.from===rf&&o.to===rt'), 'same only when both ends match');
  // 모바일 375/390: 재시도 버튼은 줄바꿈 가능한 전폭 블록, 콘솔은 뷰포트 폭 이내
  assert(html.includes('#mtc .nc+.act{display:block;width:100%'));
  assert(html.includes('max-width:calc(100vw - 24px)'));
  console.log('world-console-price: ok');
})().catch((e) => { console.error(e); process.exit(1); });
