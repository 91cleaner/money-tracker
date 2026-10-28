/* 미리 계산된 답 묶음(data/answers/<T>.json) 읽기 전용 로더. 서버·API 호출 없음(정적 파일).
   #201 intent.js 에서: MTAnswers.get('NVDA', 'export_control', '1m').then(a => a && a.ko)
   의도 id: overview, why, tariff, export_control, subsidy, china, taiwan, supply_chain, compare */
(function (root) {
  'use strict';
  var cache = {};
  var BASE = 'data/answers/';
  var PERIODS = ['1w', '1m', '3m', '1y'];

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
      var p = period == null || period === '' ? '1m' : period;
      if (PERIODS.indexOf(p) < 0) return null;
      // An explicit 1w/3m/1y request must not silently display a 1m answer.
      var a = per[p] || null;
      return a ? Object.assign({}, a, { symbol: d.symbol, name: d.name, asof: d.asof, period: p }) : null;
    });
  }

  function trends() {
    return fetch(BASE + '_trends.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  var api = { load: load, get: get, trends: trends, PERIODS: PERIODS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MTAnswers = api;
})(typeof window !== 'undefined' ? window : globalThis);
