/* MONEY TRACKER — 이벤트 해석 카드 ("같은 기간 있었던 일"). Pure functions (node-testable) + a small DOM renderer.
   For one dated event (a pin on the company price chart) it lists
   (1) what else the saved data shows in the same window (White House / Federal Register items and KR/JP/EU/CN/TW policy items
       that share the company's sector tag or name it; earnings dates are left out until an official SEC 8-K Item 2.02 feed is stored),
   (2) the company's own closing-price move over the same-length window after past, similar announcements (average + sample size).
   Wording is fixed here and neutral: "같은 기간 ~이 있었다", "과거 n번 평균 ~%(데이터상)". No causal words, no advice.
   Korean sentences are translated by assets/i18n.js (RULES) in ?lang=en. */
(function (root) {
  "use strict";
  var WIN = 7;                       // calendar days: from the close on/before the event date to the close on/before date+7
  var MAXOTHER = 6;
  var COUNTRY = { wh: "백악관·관보", kr: "한국", jp: "일본", eu: "EU", cn: "중국", tw: "대만" };
  var ISO = /^\d{4}-\d{2}-\d{2}$/;
  function addDays(iso, n) { var t = new Date(iso + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  function onOrBefore(rows, iso) { for (var i = rows.length - 1; i >= 0; i--) if (rows[i].d <= iso) return rows[i]; return null; }
  function pct(n) { return (n >= 0 ? "+" : "") + n.toFixed(2) + "%"; }
  function md(iso) { return Number(iso.slice(5, 7)) + "/" + Number(iso.slice(8, 10)); }

  /** rows: [{d,c}] sorted. Returns {d0,c0,d1,c1,pct} or null when the window is not fully inside the price history. */
  function windowReturn(rows, date) {
    if (!rows || rows.length < 2 || !ISO.test(date || "")) return null;
    var a = onOrBefore(rows, date), end = addDays(date, WIN);
    if (!a || end > rows[rows.length - 1].d) return null;
    var b = onOrBefore(rows, end);
    if (!b || b.d <= a.d) return null;
    return { d0: a.d, c0: a.c, d1: b.d, c1: b.c, pct: (b.c / a.c - 1) * 100 };
  }

  /** An item is "related" when it names the ticker or shares the company's sector tag. */
  function related(it, ticker, sector) {
    if ((it.tickers || []).indexOf(ticker) >= 0 || (it.tickers_product || []).indexOf(ticker) >= 0) return true;
    return !!sector && ((it.sectors || []).indexOf(sector) >= 0 || (it.tags || []).indexOf(sector) >= 0);
  }

  /** ev: {date,k,id?,url?,type?}; ctx: {ticker, sector, rows, wh:[items], policy:{kr:[],jp:[],eu:[],cn:[],tw:[]}, pins:[{k,date,url}]} */
  function build(ev, ctx) {
    var out = { date: ev.date, others: [], moreOthers: 0, move: null, past: null };
    var lo = addDays(ev.date, -WIN), hi = addDays(ev.date, WIN), all = [];
    function pushItems(list, key, f) {
      (list || []).forEach(function (it) {
        var d = f.d(it); if (!ISO.test(d || "") || d < lo || d > hi) return;
        if (key === "wh" && ev.k === "w" && d === ev.date && (it.u === ev.url || it.id === ev.id)) return;
        if (!related(it, ctx.ticker, ctx.sector)) return;
        var u = f.u(it); if (!/^https?:\/\//.test(u || "")) return;
        all.push({ date: d, label: COUNTRY[key], title: String(f.t(it) || "").replace(/\s+/g, " ").slice(0, 110), url: u });
      });
    }
    pushItems(ctx.wh, "wh", { d: function (i) { return i.date; }, u: function (i) { return i.u; }, t: function (i) { return i.t; } });
    ["kr", "jp", "eu", "cn", "tw"].forEach(function (c) {
      pushItems((ctx.policy || {})[c], c, { d: function (i) { return i.d; }, u: function (i) { return i.u; }, t: function (i) { return i.t; } });
    });
    all.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    out.others = all.slice(0, MAXOTHER); out.moreOthers = Math.max(0, all.length - MAXOTHER);

    out.move = windowReturn(ctx.rows, ev.date);

    // past similar announcements: same kind (for White House items also the same document type and a ticker/sector match), earlier date
    var cand = {};
    if (ev.k === "w") {
      (ctx.wh || []).forEach(function (it) {
        if (it.date >= ev.date || !related(it, ctx.ticker, ctx.sector)) return;
        if (ev.type && it.type !== ev.type) return;
        cand[it.date] = it.u;
      });
    } else {
      (ctx.pins || []).forEach(function (p) { if (p.k === ev.k && p.date < ev.date) cand[p.date] = p.url || ""; });
    }
    var rets = [];
    Object.keys(cand).sort().forEach(function (d) { var r = windowReturn(ctx.rows, d); if (r) rets.push(r); });
    // announcements whose windows start on the same trading day count once
    var seen = {}; rets = rets.filter(function (r) { if (seen[r.d0]) return false; seen[r.d0] = 1; return true; });
    var sum = 0; rets.forEach(function (r) { sum += r.pct; });
    out.past = { n: rets.length, avg: rets.length ? sum / rets.length : null, days: WIN };
    return out;
  }

  var SRC_PRICE = "https://massive.com/";
  /** Neutral sentences with their source link. Each entry: {text, url}. */
  function sentences(c) {
    var s = [];
    c.others.forEach(function (o) { s.push({ text: "같은 기간 " + md(o.date) + " " + o.label + " 발표 '" + o.title + "'이(가) 있었다.", url: o.url }); });
    if (c.moreOthers) s.push({ text: "같은 기간 같은 분야 기록이 " + c.moreOthers + "건 더 있었다(데이터상).", url: null });
    if (c.move) s.push({ text: "이 이벤트 전후(" + c.move.d0 + "~" + c.move.d1 + ") 종가는 " + pct(c.move.pct) + "였다(데이터상).", url: SRC_PRICE });
    if (c.past && c.past.n) s.push({ text: "과거 비슷한 발표 " + c.past.n + "번, 같은 길이(" + c.past.days + "일) 구간 평균 " + pct(c.past.avg) + "(데이터상, 표본 " + c.past.n + "개" + (c.past.n < 5 ? ", 적어서 참고만" : "") + ").", url: SRC_PRICE });
    else if (c.past) s.push({ text: "과거 비슷한 발표의 가격 기록은 표본 0개라 평균을 내지 않았다.", url: null });
    return s;
  }
  var FOOT = "상관관계일 뿐 원인이 아님. 투자 조언 아님.";

  function render(doc, c, h) {
    var box = doc.createElement("div"); box.className = "evctx";
    var t = doc.createElement("div"); t.className = "k"; t.textContent = "같은 기간 있었던 일"; box.appendChild(t);
    var ul = doc.createElement("ul"); ul.style.cssText = "margin:4px 0 0;padding-left:18px";
    sentences(c).forEach(function (x) {
      var li = doc.createElement("li"); li.appendChild(doc.createTextNode(x.text));
      if (x.url && h && h.link) { li.appendChild(doc.createTextNode(" ")); li.appendChild(h.link("출처 ↗", x.url)); }
      ul.appendChild(li);
    });
    box.appendChild(ul);
    var f = doc.createElement("div"); f.className = "s"; f.textContent = FOOT; box.appendChild(f);
    return box;
  }

  var api = { WIN: WIN, windowReturn: windowReturn, build: build, sentences: sentences, render: render, FOOT: FOOT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MTEventContext = api;
})(typeof window !== "undefined" ? window : globalThis);
