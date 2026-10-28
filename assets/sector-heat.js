/* MONEY TRACKER — 업종 히트맵 계산 (순수 함수; 브라우저와 node 테스트에서 같이 씁니다).
   업종별로 (a) 최근 7일 의원 거래 신고 건수(신고일 기준, 자료 속 최신 신고일부터 거꾸로)와
   (b) 소속 종목의 5거래일(약 1주) 종가 변화 중앙값을 나란히 놓습니다.
   두 숫자는 같은 기간 공개 기록일 뿐 서로의 원인·결과를 뜻하지 않습니다. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MTSectorHeat = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var DAY = /^\d{4}-\d{2}-\d{2}$/, MIN_PRICED = 3;
  var NAMES = {
    technology: "기술", financials: "금융", healthcare: "헬스케어", industrials: "산업재", consumer_discretionary: "경기소비재",
    consumer_staples: "필수소비재", utilities: "유틸리티", energy: "에너지", real_estate: "부동산", materials: "소재",
    transportation: "운송", construction: "건설", mining: "광업", aerospace_defense: "항공우주·방산", communications: "통신", services: "서비스", agriculture: "농업"
  };

  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  // tickers: ticker-sectors.json 의 tickers, trades: trades.json 의 trades, prices: prices/summary.json 의 t
  function build(tickers, trades, prices) {
    tickers = tickers || {}; prices = prices || {};
    var days = (trades || []).map(function (x) { return x && x.filed; }).filter(function (d) { return DAY.test(d || ""); }).sort();
    var to = days.length ? days[days.length - 1] : null;
    var from = to ? new Date(Date.parse(to + "T00:00:00Z") - 6 * 864e5).toISOString().slice(0, 10) : null;
    var rows = {};
    function row(s) { return rows[s] || (rows[s] = { sector: s, name: NAMES[s] || s, tickers: 0, events: 0, changes: [] }); }
    Object.keys(tickers).forEach(function (tk) {
      var s = tickers[tk] && tickers[tk].sector; if (!s) return;
      var r = row(s); r.tickers++;
      var p = prices[tk]; if (p && typeof p.w1 === "number" && isFinite(p.w1)) r.changes.push(p.w1);
    });
    (trades || []).forEach(function (x) {
      if (!x || !from || !DAY.test(x.filed || "") || x.filed < from || x.filed > to) return;
      var t = tickers[String(x.tk || "").toUpperCase()], s = t && t.sector; if (s) row(s).events++;
    });
    var list = Object.keys(rows).map(function (k) {
      var r = rows[k];
      return { sector: r.sector, name: r.name, tickers: r.tickers, priced: r.changes.length, events: r.events, change: r.changes.length >= MIN_PRICED ? median(r.changes) : null };
    }).sort(function (a, b) { return b.events - a.events || a.sector.localeCompare(b.sector); });
    return { from: from, to: to, rows: list };
  }

  return { build: build, median: median, names: NAMES };
});
