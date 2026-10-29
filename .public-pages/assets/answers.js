/* 미리 계산된 답 묶음(data/answers/<T>.json) 읽기 전용 로더. 서버·API 호출 없음(정적 파일).
   #201 intent.js 에서: MTAnswers.get('NVDA', 'export_control', '1m').then(a => a && a.ko)
   의도 id: overview, why, tariff, export_control, subsidy, china, taiwan, supply_chain, compare */
(function (root) {
  'use strict';
  var cache = {};
  var BASE = 'data/answers/';
  var PERIODS = ['1w', '1m', '3m', '1y'];
  var TOPIC_IDS = ['tariff', 'export_control', 'subsidy', 'china', 'taiwan'];
  var PERIOD_KEY = { today: '1w', week: '1w', month: '1m', year: '1y' };

  // MTIntent.parse() 결과 -> {symbol, intent, period}. overview(이름만)나 회사 없음이면 null = 기존 경로 투어 유지.
  function plan(parsed) {
    if (!parsed || parsed.status !== 'ok' || !parsed.company || !parsed.intent || parsed.intent === 'overview') return null;
    var id = parsed.intent;
    if (id === 'topic') {
      var t = (parsed.topics || []).map(function (x) { return x.id; }).filter(function (x) { return TOPIC_IDS.indexOf(x) >= 0; })[0];
      id = t || 'why';
    } else if (id === 'supply') id = 'supply_chain';
    var pid = parsed.period && parsed.period.id;
    return { symbol: parsed.company.symbol, intent: id, period: PERIOD_KEY[pid] || '1m' };
  }

  function load(sym) {
    var key = String(sym || '').toUpperCase();
    if (!key) return Promise.resolve(null);
    if (!cache[key]) {
      cache[key] = fetch(BASE + encodeURIComponent(key) + '.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return cache[key];
  }

  // 의도·기간에 맞는 묶음 {ko[], en[], events[], reaction, src[]} 또는 null
  function get(sym, intent, period) {
    return load(sym).then(function (d) {
      if (!d || !d.answers) return null;
      var per = d.answers[intent || 'overview'];
      if (!per) return null;
      var p = PERIODS.indexOf(period) >= 0 ? period : '1m';
      var a = per[p] || per['1m'] || null;
      return a ? Object.assign({ symbol: d.symbol, name: d.name, asof: d.asof, period: p }, a) : null;
    });
  }

  function trends() {
    return fetch(BASE + '_trends.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  function setBase(b) { BASE = b; cache = {}; }

  var api = { load: load, get: get, trends: trends, plan: plan, setBase: setBase, PERIODS: PERIODS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MTAnswers = api;
})(typeof window !== 'undefined' ? window : globalThis);
