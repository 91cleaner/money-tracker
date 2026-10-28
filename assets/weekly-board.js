/* MONEY TRACKER — 주간 순위표 계산 (순수 함수; 브라우저와 node 테스트에서 같이 씁니다).
   공개 자료만 사용: 하원 PTR 신고(trades.json), 로비 공시 LDA(lobbying.json), 연방 계약(federal-awards.json).
   신고일(filed) 기준. 구간은 '오늘'이 아니라 자료 속 가장 최근 신고일에서 거꾸로 7일(자료 갱신 지연을 반영).
   로비·계약에는 주 단위 날짜가 없어 분기/누적 기준으로 따로 표시하고, 주간이라고 부르지 않습니다. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MTWeekly = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var TK = /^[A-Z][A-Z0-9.\-]{0,9}$/, DAY = /^\d{4}-\d{2}-\d{2}$/;

  function addDays(iso, n) { return new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10); }
  function top(counts, n, extra) {
    return Object.keys(counts).map(function (k) { var r = { key: k, n: counts[k] }; if (extra) extra(r); return r; })
      .sort(function (a, b) { return b.n - a.n || a.key.localeCompare(b.key); }).slice(0, n);
  }

  // 최근 7일(최신 신고일 포함) 신고 건수 Top N: 회사(티커)별, 의원별.
  function weeklyFilings(trades, n) {
    n = n || 10;
    var days = (trades || []).map(function (x) { return x && x.filed; }).filter(function (d) { return DAY.test(d || ""); }).sort();
    if (!days.length) return { from: null, to: null, total: 0, companies: [], members: [] };
    var to = days[days.length - 1], from = addDays(to, -6), c = {}, m = {}, total = 0;
    trades.forEach(function (x) {
      if (!x || !DAY.test(x.filed || "") || x.filed < from || x.filed > to) return;
      total++;
      var tk = String(x.tk || "").toUpperCase();
      if (TK.test(tk)) c[tk] = (c[tk] || 0) + 1;
      if (x.who) m[x.who] = (m[x.who] || 0) + 1;
    });
    return { from: from, to: to, total: total, companies: top(c, n), members: top(m, n) };
  }

  // 로비: 자료에 있는 가장 최근 분기(예: 2026-Q3)의 보고 금액 Top N. 주간 아님.
  function latestQuarterLobbying(lobbying, n) {
    n = n || 10;
    var cs = (lobbying && lobbying.companies) || {}, qs = {};
    Object.keys(cs).forEach(function (tk) { Object.keys(cs[tk].by_quarter || {}).forEach(function (q) { if (/^\d{4}-Q[1-4]$/.test(q) && cs[tk].by_quarter[q] > 0) qs[q] = 1; }); });
    var q = Object.keys(qs).sort().pop();
    if (!q) return { quarter: null, rows: [] };
    var v = {}; Object.keys(cs).forEach(function (tk) { var x = cs[tk].by_quarter[q]; if (x > 0 && TK.test(tk)) v[tk] = x; });
    return { quarter: q, rows: top(v, n) };
  }

  // 연방 계약: 자료 기간 누적 금액 Top N. 날짜별 자료가 없어 주간 변화는 만들 수 없음.
  function awardsTotal(awards, n) {
    n = n || 10;
    var cs = (awards && awards.companies) || {}, v = {};
    Object.keys(cs).forEach(function (tk) { if (cs[tk].total_usd > 0 && TK.test(tk)) v[tk] = cs[tk].total_usd; });
    return { period: (awards && awards.period) || null, rows: top(v, n) };
  }

  return { weeklyFilings: weeklyFilings, latestQuarterLobbying: latestQuarterLobbying, awardsTotal: awardsTotal, addDays: addDays };
});
