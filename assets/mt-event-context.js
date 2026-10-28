/* MONEY TRACKER: "같은 기간 있었던 일" 해석 카드 + 검색어 의도 판별.
 * 저장된 공식 기록(data/us/whitehouse.json, data/policy/*.json, data/us/prices, 있으면 data/us/earnings.json)만 쓴다. AI·실시간 시세 없음.
 * 원인을 단정하지 않는다: "같은 기간 ~이 있었다", "과거 n번 평균 ~% (데이터상)". 문구는 assets/i18n.js 의 ctx 표(KO/EN).
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MTEventContext = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";
  var I18N = (typeof module === "object" && module.exports) ? require("./i18n.js") : root.MTI18N;
  var CCS = ["kr", "jp", "eu", "cn", "tw"];

  /* ── 검색어 의도 (단순 키워드 규칙, 한/영) ── */
  var WHY = /왜|이유|주가|떨어|올라|오르|내려|내리|하락|상승|급락|급등|폭락|폭등|빠지|빠져|떡락|떡상|\b(why|down|up|drop(?:s|ped|ping)?|fall(?:s|ing|en)?|fell|rise[sn]?|rising|rose|surge[sd]?|plunge[sd]?|slump(?:s|ed)?|rall(?:y|ies|ied)|jump(?:s|ed)?|sink(?:s|ing)?|sank|stock price|share price)\b/i;
  // 더 구체적인 것(232조)을 먼저 본다.
  var TOPIC_RULES = [
    ["import_232", /232\s?조|section\s?232|철강\s?관세/i],
    ["export_control", /수출\s?(?:통제|규제)|export\s?controls?/i],
    ["sanctions", /제재|sanctions?/i],
    ["tariff", /관세|tariffs?|duties/i]
  ];
  // 정책 항목(data/policy)의 'trade' 태그는 관세·수출통제 같은 무역 주제로 본다.
  var TAG_TOPICS = { trade: ["tariff"] };

  function intent(q) {
    var s = String(q == null ? "" : q).normalize("NFKC").toLowerCase();
    var topic = null;
    for (var i = 0; i < TOPIC_RULES.length; i++) if (TOPIC_RULES[i][1].test(s)) { topic = TOPIC_RULES[i][0]; break; }
    var why = WHY.test(s);
    // 이름만 → tour(전체 경로), 왜·주가·떨어/올라 → why(최근 주가 설명), 주제어 → topic(해당 유형만)
    return { mode: why ? "why" : topic ? "topic" : "tour", topic: topic };
  }

  /* ── 날짜·가격 ── */
  function addDays(iso, n) { var t = new Date(iso + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  function addMonths(iso, n) { var t = new Date(iso + "T00:00:00Z"); t.setUTCMonth(t.getUTCMonth() + n); return t.toISOString().slice(0, 10); }
  function gap(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); }
  var ISO = /^\d{4}-\d{2}-\d{2}$/;

  function parsePrices(j) {
    if (!j) return [];
    var rows = [];
    if (Array.isArray(j.d) && Array.isArray(j.c)) rows = j.d.map(function (d, i) { return [d, j.c[i]]; });
    else {
      var arr = Array.isArray(j) ? j : (j.prices || j.data || j.history || j.series || []);
      rows = (Array.isArray(arr) ? arr : []).map(function (r) { return Array.isArray(r) ? [r[0], r[1]] : [r.date || r.d || r.t, r.close != null ? r.close : r.c != null ? r.c : r.adj_close != null ? r.adj_close : r.price]; });
    }
    return rows.map(function (r) { return { d: String(r[0] || "").slice(0, 10), c: Number(r[1]) }; })
      .filter(function (r) { return ISO.test(r.d) && isFinite(r.c) && r.c > 0; })
      .sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
  }
  function onOrBefore(rows, iso) { for (var i = rows.length - 1; i >= 0; i--) if (rows[i].d <= iso) return rows[i]; return null; }
  // 시작일~끝일 종가 변화. 가격 기간 밖이거나 휴장 때문에 5일 넘게 벌어지면 계산하지 않는다(null).
  function retBetween(rows, startIso, endIso) {
    if (!rows.length || startIso < rows[0].d || endIso > rows[rows.length - 1].d) return null;
    var a = onOrBefore(rows, startIso), b = onOrBefore(rows, endIso);
    if (!a || !b || a.d >= b.d || gap(a.d, startIso) > 5 || gap(b.d, endIso) > 5) return null;
    return { from: a, to: b, pct: (b.c / a.c - 1) * 100 };
  }

  /* ── 기록 합치기: 백악관·관보 + 한/일/EU/중/대만 정책 + 실적 발표일 ── */
  var SIC_SECTORS = [ // 앱용 단순 매핑. 업종 태그는 whitehouse.json / data/policy 의 sectors·tags 와 같은 낱말
    [/^(367|357|3674|3672|3571)/, ["semiconductor", "tech_ai"]], [/^(737|7372|7370|7371|7374)/, ["tech_ai"]],
    [/^(283|384|385|80)/, ["health"]], [/^(13|29|49)/, ["energy"]], [/^(371|3711|3714)/, ["auto", "battery_ev"]],
    [/^(372|376|348|3812)/, ["defense"]], [/^(6[0-7])/, ["finance"]], [/^(15|16|17|65)/, ["housing"]], [/^(373)/, ["shipbuilding"]],
    [/^(35|36|34)/, ["industrial"]]
  ];
  function sectorsOfSic(sic) {
    var s = String(sic || ""); if (!s) return [];
    for (var i = 0; i < SIC_SECTORS.length; i++) if (SIC_SECTORS[i][0].test(s)) return SIC_SECTORS[i][1].slice();
    return [];
  }
  function httpsOnly(u) { return /^https:\/\/[a-z0-9.-]+(?:[/?#]|$)/i.test(u || "") ? u : ""; }

  function normalizeEvents(src) {
    src = src || {}; var out = [];
    ((src.whitehouse && src.whitehouse.items) || []).forEach(function (w) {
      if (!ISO.test(w.date || "") || !httpsOnly(w.u)) return;
      out.push({ id: w.id, date: w.date, title: w.t || w.ko || "", url: w.u, src: w.src || "Federal Register", cc: "us", type: w.type || "관보 문서",
        sectors: w.sectors || [], topics: w.topics || [], tickers: (w.tickers || []).concat(w.tickers_product || []) });
    });
    CCS.forEach(function (cc) {
      var f = src.policy && src.policy[cc]; if (!f) return;
      (f.items || []).forEach(function (p) {
        if (!ISO.test(p.d || "") || !httpsOnly(p.u)) return;
        var topics = []; (p.tags || []).forEach(function (t) { (TAG_TOPICS[t] || []).forEach(function (x) { if (topics.indexOf(x) < 0) topics.push(x); }); });
        out.push({ id: p.id, date: p.d, title: p.t || "", url: p.u, src: p.src || f.source || cc, cc: cc, type: "policy:" + cc,
          sectors: (p.tags || []).filter(function (t) { return !TAG_TOPICS[t]; }), topics: topics, tickers: [], rawTags: p.tags || [] });
      });
    });
    return out;
  }
  function earningsEvents(earn, ticker) {
    var list = earn && earn.tickers && earn.tickers[ticker]; if (!Array.isArray(list)) return [];
    return list.filter(function (e) { return ISO.test(e.date || "") && httpsOnly(e.url); })
      .map(function (e) { return { id: "8k:" + ticker + ":" + e.date, date: e.date, title: ticker, url: e.url, src: "SEC EDGAR 8-K Item 2.02", cc: "us", type: "earnings", sectors: [], topics: [], tickers: [ticker], earnings: true }; });
  }
  function relevant(ev, ctx) {
    if (ev.earnings) return !ctx.topic; // 주제어로 거를 때는 실적 발표일 제외
    if (ctx.topic) return ev.topics.indexOf(ctx.topic) >= 0; // 사용자가 고른 주제는 업종과 상관없이 그 유형 기록만
    if (ev.tickers.indexOf(ctx.ticker) >= 0) return true;
    return (ctx.sectors || []).some(function (s) { return ev.sectors.indexOf(s) >= 0; });
  }

  /* ── 1) 같은 기간 다른 사건 (기준일에 가까운 순) ── */
  function concurrent(events, o) {
    var seen = {}, list = events.filter(function (ev) {
      if (ev.date < o.from || ev.date > o.to || (o.excludeId && ev.id === o.excludeId)) return false;
      if (!relevant(ev, o)) return false;
      var k = ev.date + "|" + ev.title; if (seen[k]) return false; seen[k] = 1; return true;
    });
    list.sort(function (a, b) { return Math.abs(gap(a.date, o.center)) - Math.abs(gap(b.date, o.center)) || (a.date < b.date ? 1 : -1); });
    return o.limit ? list.slice(0, o.limit) : list;
  }

  /* ── 2) 과거 비슷한 발표 때 그 종목의 같은 길이 구간 수익률 ── */
  function reactionStats(rows, dates, before, after) {
    var seen = {}, items = [];
    dates.forEach(function (d) {
      if (seen[d]) return; seen[d] = 1;
      var r = retBetween(rows, addDays(d, -before), addDays(d, after));
      if (r) items.push({ date: d, pct: r.pct });
    });
    var n = items.length, sum = items.reduce(function (s, x) { return s + x.pct; }, 0);
    return { n: n, avg: n ? sum / n : null, up: items.filter(function (x) { return x.pct > 0; }).length, down: items.filter(function (x) { return x.pct < 0; }).length, items: items, before: before, after: after };
  }
  // 같은 type(이전 날짜)이고 같은 종목·업종에 해당하는 과거 이벤트 날짜들
  function pastDates(events, o) {
    return events.filter(function (ev) { return ev.type === o.type && ev.date < o.beforeDate && relevant(ev, o); })
      .map(function (ev) { return ev.date; });
  }

  /* ── 카드 모델 ── */
  function typeLabel(L, ev) {
    if (ev.earnings) return L.earnType;
    if (/^policy:/.test(ev.type)) return fill(L.polType, { cc: L.cc[ev.cc] || ev.cc });
    return (L.types && L.types[ev.type]) || (ev.type + " " + L.typeSuffix);
  }
  function rowsOf(o) { return o.rows || []; }

  // 이벤트 카드(회사 페이지 핀 / 이벤트 한 건): 전후 7일 창
  function buildEvent(o) {
    var rows = rowsOf(o), center = o.date, from = addDays(center, -7), to = addDays(center, 7);
    var events = (o.events || []).concat(earningsEvents(o.earnings, o.ticker));
    var ctx = { ticker: o.ticker, sectors: o.sectors || [] };
    var same = concurrent(events, { from: from, to: to, center: center, ticker: o.ticker, sectors: ctx.sectors, topic: o.topic, excludeId: o.id, limit: o.limit || 6 });
    var past = [];
    if (o.type) {
      var dates = o.pastDates || pastDates(events, { type: o.type, beforeDate: center, ticker: o.ticker, sectors: ctx.sectors, topic: o.topic });
      past.push({ type: o.type, label: o.typeLabelEv || null, ev: o.typeEv || null, stats: reactionStats(rows, dates, 7, 7) });
    }
    var lastD = rows.length ? rows[rows.length - 1].d : to;
    return { kind: "event", ticker: o.ticker, center: center, from: from, to: to, own: retBetween(rows, from, to > lastD ? lastD : to),
      same: same, past: past, sources: sourcesOf(o), priceMeta: o.priceMeta || null, topic: o.topic || null };
  }

  // 관제실 "최근 주가 설명": 마지막 종가 기준 1주·1달
  function buildRecent(o) {
    var rows = rowsOf(o), last = rows[rows.length - 1] || null;
    var events = (o.events || []).concat(earningsEvents(o.earnings, o.ticker));
    var ctx = { ticker: o.ticker, sectors: o.sectors || [] };
    if (!last) return { kind: "recent", ticker: o.ticker, changes: [], same: [], past: [], sources: sourcesOf(o), priceMeta: o.priceMeta || null, topic: o.topic || null, empty: true };
    var m1 = addMonths(last.d, -1), w1 = addDays(last.d, -7);
    var changes = [{ key: "w1", r: retBetween(rows, w1, last.d) }, { key: "m1", r: retBetween(rows, m1, last.d) }];
    var same = concurrent(events, { from: m1, to: last.d, center: last.d, ticker: o.ticker, sectors: ctx.sectors, topic: o.topic, limit: o.limit || 8 });
    var types = [], past = [];
    same.forEach(function (ev) { if (types.length < 3 && !types.some(function (t) { return t.type === ev.type; })) types.push(ev); });
    types.forEach(function (ev) {
      var dates = pastDates(events, { type: ev.type, beforeDate: m1, ticker: o.ticker, sectors: ctx.sectors, topic: o.topic });
      past.push({ type: ev.type, ev: ev, stats7: reactionStats(rows, dates, 0, 7), stats31: reactionStats(rows, dates, 0, 31) });
    });
    return { kind: "recent", ticker: o.ticker, last: last, from: m1, to: last.d, changes: changes, same: same, past: past, topic: o.topic || null, sources: sourcesOf(o), priceMeta: o.priceMeta || null };
  }
  function sourcesOf(o) {
    var s = []; if (o.whitehouse && o.whitehouse.source_url) s.push({ k: "srcPolicy", name: o.whitehouse.source, url: o.whitehouse.source_url, date: (o.whitehouse.updated || "").slice(0, 10) });
    CCS.forEach(function (cc) { var f = o.policy && o.policy[cc]; if (f && f.source_url) s.push({ k: "srcPolicy", name: f.source, url: f.source_url, date: f.updated || "" }); });
    if (o.earnings && o.earnings.source_url) s.push({ k: "srcEarn", name: o.earnings.source, url: o.earnings.source_url, date: o.earnings.updated || "" });
    return s;
  }

  /* ── 문구 (assets/i18n.js ctx 표) ── */
  function fill(t, v) { return String(t).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }
  function langOf(l) { return l === "en" ? "en" : l === "ko" ? "ko" : (I18N && I18N.lang === "en" ? "en" : "ko"); }
  function pct(v) { return v == null || !isFinite(v) ? "-" : (v > 0 ? "+" : "") + v.toFixed(1) + "%"; }
  function num(v) { return v.toLocaleString("en-US", { maximumFractionDigits: 2 }); }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function md(iso, lang, refYear) {
    var y = iso.slice(0, 4), m = +iso.slice(5, 7), d = +iso.slice(8, 10), yr = refYear && y !== refYear;
    return lang === "en" ? MON[m - 1] + " " + d + (yr ? ", " + y : "") : (yr ? y + "/" : "") + m + "/" + d;
  }
  function clip(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function winText(L, before, after) { return before ? fill(L.winAround, { before: before, after: after }) : fill(L.winAfter, { after: after }); }

  // 모델 → 화면에 넣을 문장 목록 (테스트·렌더 공용)
  function lines(model, langIn) {
    var lang = langOf(langIn), L = I18N.ctx[lang], ref = (model.kind === "recent" ? model.to : model.center || "").slice(0, 4), out = { changes: [], same: [], past: [], notes: [] };
    (model.changes || []).forEach(function (c) {
      if (!c.r) return;
      out.changes.push(fill(L.change, { label: L[c.key], from: num(c.r.from.c), to: num(c.r.to.c), pct: pct(c.r.pct), d1: c.r.from.d, d2: c.r.to.d }));
    });
    if (model.kind === "event" && model.own) out.changes.push(fill(L.change, { label: fill(L.ev, { n: 14 }), from: num(model.own.from.c), to: num(model.own.to.c), pct: pct(model.own.pct), d1: model.own.from.d, d2: model.own.to.d }));
    (model.same || []).forEach(function (ev) {
      var label = ev.cc === "us" ? (lang === "en" ? ((L.types && L.types[ev.type]) || ev.type) : ev.type) : (L.cc[ev.cc] || ev.cc) + (lang === "en" ? " policy item" : " 정책·발표");
      out.same.push({ ev: ev, text: ev.earnings ? fill(L.sameEarn, { md: md(ev.date, lang, ref), name: ev.title }) : fill(L.sameItem, { md: md(ev.date, lang, ref), label: label, title: clip(ev.title, 110) }) });
    });
    (model.past || []).forEach(function (p) {
      var ev = p.ev, label = ev ? typeLabel(L, ev) : (p.label || p.type), sets = p.stats7 ? [p.stats7, p.stats31] : [p.stats];
      sets.forEach(function (st) {
        var win = winText(L, st.before, st.after);
        if (!st.n) { if (!out.past.some(function (x) { return !x.n; })) out.past.push({ n: 0, text: L.pastNone }); return; }
        out.past.push({ n: st.n, avg: st.avg, text: fill(L.pastLine, { n: st.n, type: label, tk: model.ticker, win: win, pct: pct(st.avg), up: st.up, down: st.down }) + (st.n < 3 ? " · " + L.pastSmall : "") });
      });
    });
    if (model.topic) out.notes.push(fill(L.topicOnly, { topic: L.topics[model.topic] || model.topic }));
    return out;
  }

  /* ── 화면 ── */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function a(text, url) { var u = httpsOnly(url); if (!u) return el("span", "", text); var x = el("a", "", text); x.href = u; x.target = "_blank"; x.rel = "noopener noreferrer"; return x; }

  function render(box, model, langIn) {
    var lang = langOf(langIn), L = I18N.ctx[lang], ln = lines(model, lang);
    var card = el("section", "mt-ec"); card.setAttribute("aria-label", model.kind === "recent" ? L.titleRecent : L.title);
    card.appendChild(el("h4", "mt-ec-h", (model.kind === "recent" ? L.titleRecent + " · " + model.ticker : L.title)));
    if (model.kind === "recent" && model.empty) card.appendChild(el("p", "mt-ec-n", L.noPrice));
    if (model.kind === "recent" && model.last) {
      card.appendChild(el("h5", "", L.changeHead));
      var ul0 = el("ul"); ln.changes.forEach(function (t) { ul0.appendChild(el("li", "", t)); }); card.appendChild(ul0);
    } else if (ln.changes.length) { var ul1 = el("ul"); ln.changes.forEach(function (t) { ul1.appendChild(el("li", "", t)); }); card.appendChild(ul1); }
    ln.notes.forEach(function (t) { card.appendChild(el("p", "mt-ec-n", t)); });
    // 같은 기간 있었던 일 (가까운 날짜 순)
    card.appendChild(el("h5", "", L.title));
    if (!ln.same.length) card.appendChild(el("p", "mt-ec-n", L.sameNone));
    else {
      card.appendChild(el("p", "mt-ec-n", fill(L.sameIntro, { from: model.from, to: model.to, n: ln.same.length })));
      var ul = el("ul"); ln.same.forEach(function (s) { var li = el("li", "", s.text + " "); li.appendChild(a(L.link, s.ev.url)); ul.appendChild(li); }); card.appendChild(ul);
    }
    // 과거 비슷한 발표 때 반응
    card.appendChild(el("h5", "", L.pastHead));
    if (!ln.past.length) card.appendChild(el("p", "mt-ec-n", L.pastNone));
    else { var up = el("ul"); ln.past.forEach(function (p) { up.appendChild(el("li", "", p.text)); }); card.appendChild(up); }
    card.appendChild(el("p", "mt-ec-d", L.disclaimer));
    var srcs = el("p", "mt-ec-s", L.srcHead + ": ");
    var pm = model.priceMeta; if (pm) { srcs.appendChild(document.createTextNode(L.srcPrice + " " + (pm.source || "data/us/prices") + (pm.as_of || pm.updated ? " (" + L.asOf + " " + (pm.as_of || pm.updated) + ")" : "") + " · ")); }
    model.sources.forEach(function (s) { srcs.appendChild(a(s.name || s.url, s.url)); if (s.date) srcs.appendChild(document.createTextNode(" (" + s.date + ")")); srcs.appendChild(document.createTextNode(" · ")); });
    card.appendChild(srcs);
    box.appendChild(card);
    return card;
  }

  /* ── 자료 불러오기 (한 번만) ── */
  var cache = {};
  function getJSON(u) { if (!cache[u]) cache[u] = fetch(u, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); return cache[u]; }
  function load(base, ticker, pre) {
    pre = pre || {};
    var jobs = [pre.whitehouse || getJSON(base + "data/us/whitehouse.json"), getJSON(base + "data/us/prices/" + encodeURIComponent(ticker) + ".json"), getJSON(base + "data/us/earnings.json"), getJSON(base + "data/us/ticker-sectors.json")]
      .concat(CCS.map(function (cc) { return getJSON(base + "data/policy/" + cc + ".json"); }));
    return Promise.all(jobs).then(function (r) {
      var policy = {}; CCS.forEach(function (cc, i) { policy[cc] = r[4 + i]; });
      var sec = r[3] && r[3].tickers && r[3].tickers[ticker];
      var events = normalizeEvents({ whitehouse: r[0], policy: policy });
      return { events: events, whitehouse: r[0], policy: policy, prices: r[1], rows: parsePrices(r[1]), priceMeta: r[1] ? { source: r[1].source, as_of: r[1].as_of, updated: r[1].updated } : null,
        earnings: r[2], sectors: sectorsOfSic(sec && sec.sic) };
    });
  }
  function style() {
    if (typeof document === "undefined" || document.getElementById("mtEcCss")) return;
    var s = document.createElement("style"); s.id = "mtEcCss";
    s.textContent = ".mt-ec{border:1px solid #2f6f4c;border-radius:10px;padding:10px 12px;margin:8px 0;background:#06160ecc;color:#d9ffe6;font:13px/1.6 system-ui,sans-serif}.mt-ec h4{margin:0 0 6px;font-size:14px;color:#f2fff4}.mt-ec h5{margin:10px 0 3px;font-size:12.5px;color:#9dffbd}.mt-ec ul{margin:0;padding-left:18px}.mt-ec li{margin:3px 0}.mt-ec-n{margin:2px 0;font-size:12px;color:#a6c2b1}.mt-ec-d{margin:10px 0 4px;font-size:11.5px;color:#ffd27a;border-left:3px solid #ffd27a;padding:3px 8px}.mt-ec-s{margin:4px 0 0;font-size:10.5px;color:#7fa792;overflow-wrap:anywhere}.mt-ec a{color:#9beec2}";
    document.head.appendChild(s);
  }
  // 회사 페이지 핀 클릭 → 그 날짜 전후 카드. pin = {k,date,title,id?,type?}
  function eventCard(box, o) {
    style();
    return load(o.base || "", o.ticker, { whitehouse: o.whitehouse }).then(function (D) {
      var wh = o.pin && o.pin.k === "w" ? D.events.filter(function (e) { return e.cc === "us" && e.date === o.pin.date && (o.pin.id ? e.id === o.pin.id : true); })[0] : null;
      var type = wh ? wh.type : (o.pin ? "pin:" + o.pin.k : null), dates = null;
      if (o.pin && o.pin.k !== "w" && o.pins) dates = o.pins.filter(function (p) { return p.k === o.pin.k && p.date < o.pin.date; }).map(function (p) { return p.date; });
      var label = o.pin && o.pin.k === "t" ? "의원 거래 신고" : o.pin && o.pin.k === "b" ? "법안 일정" : null;
      var m = buildEvent({ ticker: o.ticker, date: o.pin.date, id: wh && wh.id, type: type, pastDates: dates, typeEv: wh, typeLabelEv: label, rows: D.rows, events: D.events, earnings: D.earnings, sectors: D.sectors, whitehouse: D.whitehouse, policy: D.policy, priceMeta: D.priceMeta });
      return render(box, m, o.lang);
    });
  }
  // 관제실: 최근 주가 설명 (왜·주가·떨어/올라) 또는 주제 걸러 보기. onFull = "전체 경로 보기"
  function recentCard(box, o) {
    style();
    return load(o.base || "", o.ticker).then(function (D) {
      var m = buildRecent({ ticker: o.ticker, topic: o.topic, rows: D.rows, events: D.events, earnings: D.earnings, sectors: D.sectors, whitehouse: D.whitehouse, policy: D.policy, priceMeta: D.priceMeta });
      var card = render(box, m, o.lang), L = I18N.ctx[langOf(o.lang)];
      if (o.onFull) { var b = el("button", "mt-ec-full", L.fullRoute); b.type = "button"; b.addEventListener("click", o.onFull); card.appendChild(b); }
      return m;
    });
  }

  return { intent: intent, parsePrices: parsePrices, retBetween: retBetween, normalizeEvents: normalizeEvents, earningsEvents: earningsEvents, sectorsOfSic: sectorsOfSic,
    concurrent: concurrent, reactionStats: reactionStats, pastDates: pastDates, buildEvent: buildEvent, buildRecent: buildRecent, lines: lines, render: render,
    load: load, eventCard: eventCard, recentCard: recentCard, TAG_TOPICS: TAG_TOPICS };
});
