/* MONEY TRACKER — 관제실 검색 첫 화면 (first screen of a command-room search). Browser or node; no network, no storage, no AI.
   Turns MTIntent.parse() output + the pre-computed answer pack (data/answers/<T>.json, #202) + a few static data files
   into one model: a one-line answer, 3 evidence cards, and a money/stock flow picture. render() draws it with DOM calls only.
   Wording rule: only "같은 기간 ~이 있었어요" / "In the same period there was ...". Never a cause, never advice.
   Missing data is said plainly ("아직 기록이 없어요" / "no record yet"), never filled in. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MTFirst = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TOPIC_IDS = ["tariff", "export_control", "subsidy", "china", "taiwan"];
  var PERIOD_KEY = { today: "1w", week: "1w", month: "1m", year: "1y" };
  var PERIOD_LABEL = { "1w": ["최근 1주", "the past week"], "1m": ["최근 한 달", "the past month"], "3m": ["최근 3달", "the past 3 months"], "1y": ["최근 1년", "the past year"] };
  var EVENT_NOUN = { // [ko, en singular, en plural]
    tariff: ["관세 발표", "tariff announcement", "tariff announcements"],
    export_control: ["수출통제 발표", "export-control announcement", "export-control announcements"],
    subsidy: ["보조금 발표", "subsidy announcement", "subsidy announcements"],
    china: ["중국 관련 발표", "China-related announcement", "China-related announcements"],
    taiwan: ["대만 관련 발표", "Taiwan-related announcement", "Taiwan-related announcements"],
    why: ["정책 발표", "policy announcement", "policy announcements"]
  };
  var FORBIDDEN = /때문에|추천|because|recommend/i;
  var MAX_ITEMS = 3;

  /* ---------- small helpers ---------- */
  function num(v) { return typeof v === "number" && isFinite(v); }
  function pct(v) {
    if (!num(v)) return null;
    var r = Math.round(Math.abs(v) * 10) / 10;
    return (v > 0 && r > 0 ? "+" : v < 0 && r > 0 ? "−" : "") + r.toFixed(1) + "%";
  }
  function money(v) {
    if (!num(v) || v <= 0) return null;
    var u = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
    for (var i = 0; i < u.length; i++) if (v >= u[i][0]) return "$" + (Math.round(v / u[i][0] * 10) / 10) + u[i][1];
    return "$" + Math.round(v);
  }
  function topic(s, ko, ho) { // 은/는, 이/가 by final consonant
    s = String(s || "");
    var c = s.charCodeAt(s.length - 1) - 0xAC00;
    var has = c >= 0 && c < 11172 ? c % 28 !== 0 : false;
    return s + (has ? ko : ho);
  }
  function md(d, en) {
    var p = String(d || "").split("-");
    if (p.length < 3) return String(d || "");
    return en ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+p[1] - 1] + " " + (+p[2]) : +p[1] + "/" + +p[2];
  }
  function safeText(s) { return FORBIDDEN.test(String(s || "")) ? "" : String(s || ""); }

  /* ---------- which pack entry / period ---------- */
  function topicId(parsed) {
    var t = ((parsed && parsed.topics) || []).map(function (x) { return x.id; }).filter(function (x) { return TOPIC_IDS.indexOf(x) >= 0; })[0];
    return t || null;
  }
  /* "요즘/recent" and no period at all both mean the same default (1 month) so rephrased questions give the same numbers. */
  function periodKey(parsed) {
    if (!parsed || !parsed.period || !parsed.periodExplicit || parsed.periodGeneric) return "1m";
    return PERIOD_KEY[parsed.period.id] || "1m";
  }
  function plan(parsed) {
    if (!parsed || parsed.status !== "ok" || !parsed.company) return null;
    var t = topicId(parsed);
    return { symbol: parsed.company.symbol, topic: t, intent: t || "why", period: periodKey(parsed) };
  }

  /* ---------- lawmaker filings ---------- */
  function amountRange(s) {
    var n = (String(s || "").match(/[\d,]+/g) || []).map(function (x) { return +x.replace(/,/g, ""); }).filter(function (x) { return x > 0; });
    if (!n.length) return null;
    return /over/i.test(s) && n.length === 1 ? [n[0], n[0]] : [Math.min.apply(null, n), Math.max.apply(null, n)];
  }
  function nameTokens(who) {
    return String(who || "").toLowerCase().replace(/[^a-z\s'\-]/g, " ").split(/\s+/).filter(function (t) { return t.length >= 2 && ["mr", "mrs", "ms", "dr", "jr", "sr", "ii", "iii"].indexOf(t) < 0; });
  }
  /* the asked-for lawmaker: first and last name both written in the question (Latin spelling, as in the filings) */
  function asksMember(query, who) {
    var t = nameTokens(who), q = " " + String(query || "").toLowerCase().replace(/[^a-z\s'\-]/g, " ").replace(/\s+/g, " ") + " ";
    if (t.length < 2) return false;
    return q.indexOf(" " + t[0] + " ") >= 0 && q.indexOf(" " + t[t.length - 1] + " ") >= 0;
  }
  function tradeKind(ty) { return ty === "S" ? "sale" : ty === "P" ? "purchase" : "other"; }
  function filingsFor(trades, symbol, from, to) {
    return (trades || []).filter(function (t) { return t && t.tk === symbol && t.filed && t.filed >= from && t.filed <= to && (t.ty === "S" || t.ty === "P"); })
      .sort(function (a, b) { return a.filed < b.filed ? 1 : a.filed > b.filed ? -1 : 0; });
  }

  function packCount(a) { // pack text is the only place that keeps the full count; events[] is capped
    var lines = (a && a.ko) || [], m;
    for (var i = 0; i < lines.length; i++) if ((m = /공개 기록이 (\d+)건/.exec(lines[i]))) return +m[1];
    return a && a.events ? a.events.length : 0;
  }

  /* ---------- model ---------- */
  /* doc: data/answers/<T>.json. data: {trades:[...], awards:{companies}, lobbying:{companies}, pac:{companies}}.
     opts: {query, name (display name override, e.g. English)} */
  function build(doc, parsed, data, lang, opts) {
    opts = opts || {}; data = data || {};
    var en = lang === "en", p = plan(parsed);
    if (!p || !doc) return null;
    var sym = p.symbol, name = opts.name || doc.name || sym;
    var per = doc.periods && doc.periods[p.period];
    var packs = doc.answers || {};
    var a = (packs[p.intent] && packs[p.intent][p.period]) || (packs.why && packs.why[p.period]) || null;
    var label = PERIOD_LABEL[p.period][en ? 1 : 0];
    var from = per && per.from, to = per && per.to || doc.asof;
    var noun = EVENT_NOUN[p.topic || "why"];
    var M = { symbol: sym, name: name, lang: en ? "en" : "ko", period: p.period, periodLabel: label, from: from || null, to: to || null, topic: p.topic, asof: doc.asof || null };

    // (a) price
    var ret = per && num(per.ret) ? per.ret : null;
    M.ret = ret;

    // (b) same-period happenings
    var nPolicy = a ? packCount(a) : 0;
    var events = a && a.events ? a.events.slice(0, MAX_ITEMS) : [];
    var filings = from && to ? filingsFor(data.trades, sym, from, to) : [];
    var sales = filings.filter(function (t) { return t.ty === "S"; }), buys = filings.filter(function (t) { return t.ty === "P"; });
    var mine = (data.trades || []).filter(function (t) { return t && t.tk === sym && asksMember(opts.query, t.who); })
      .sort(function (x, y) { return x.filed < y.filed ? 1 : -1; }).slice(0, 2);

    // headline
    var parts = [];
    if (nPolicy) parts.push({ n: nPolicy, ko: noun[0] + " " + nPolicy + "건", en: nPolicy + " " + (nPolicy === 1 ? noun[1] : noun[2]) });
    if (sales.length) parts.push({ n: sales.length, ko: "의원 매도 신고 " + sales.length + "건", en: sales.length + " lawmaker sale filing" + (sales.length === 1 ? "" : "s") });
    if (buys.length) parts.push({ n: buys.length, ko: "의원 매수 신고 " + buys.length + "건", en: buys.length + " lawmaker purchase filing" + (buys.length === 1 ? "" : "s") });
    var head;
    if (en) {
      head = ret === null ? "No price record yet for " + name + "." : name + " moved " + pct(ret) + " over " + label + ".";
      if (parts.length) {
        var list = parts.map(function (x) { return x.en; });
        var joined = list.length > 1 ? list.slice(0, -1).join(", ") + " and " + list[list.length - 1] : list[0];
        head += " In the same period there " + (parts[0].n === 1 ? "was " : "were ") + joined + ".";
      } else head += " No policy announcement or lawmaker filing is on record yet for the same period.";
    } else {
      head = ret === null ? name + " 주가 기록이 아직 없어요." : topic(name, "은", "는") + " " + label + " " + pct(ret) + ".";
      if (parts.length) head += " 같은 기간 " + parts.map(function (x) { return x.ko; }).join(", ") + "이 있었어요.";
      else head += " 같은 기간 정책 발표나 의원 거래 신고 기록은 아직 없어요.";
    }
    M.headline = head;

    // card a
    var cardA = { id: "price", title: en ? "Price move" : "주가 변화", big: pct(ret), lines: [], empty: ret === null };
    if (ret !== null) {
      cardA.lines.push(from + " → " + to + (en ? " (closing prices)" : " 종가 기준"));
      if (per.bench && num(per.bench.ret)) cardA.lines.push((en ? "Benchmark " : "비교 지수 ") + per.bench.id + " " + pct(per.bench.ret));
      if (per.rank && per.rank.pos) cardA.lines.push(en ? "Rank " + per.rank.pos + " of " + per.rank.of + " in its sector" : "같은 업종 " + per.rank.of + "곳 중 " + per.rank.pos + "위");
    } else cardA.lines.push(en ? "No record yet" : "아직 기록이 없어요");

    // card b
    var items = [];
    var mineDocs = {};
    mine.forEach(function (t) { mineDocs[t.doc + t.d + t.amt] = 1; });
    mine.forEach(function (t) { items.push({ kind: "member", mine: true, date: t.filed, text: (en ? "You asked about " : "찾으신 의원 ") + t.who + ": " + (en ? tradeKind(t.ty) + " filing" : (t.ty === "S" ? "매도" : "매수") + " 신고") + (t.amt ? " " + t.amt : ""), url: t.doc }); });
    events.forEach(function (e) { var t = safeText(e.t); items.push({ kind: "policy", date: e.d, text: (en ? "Announcement: " : "발표·공시: ") + (t || (en ? "(see source)" : "(원문 링크에서 확인)")), url: e.u }); });
    filings.filter(function (t) { return !mineDocs[t.doc + t.d + t.amt]; }).slice(0, MAX_ITEMS).forEach(function (t) { items.push({ kind: "member", date: t.filed, text: (en ? "Lawmaker " : "의원 ") + t.who + " " + (en ? tradeKind(t.ty) + " filing" : (t.ty === "S" ? "매도" : "매수") + " 신고") + (t.amt ? " " + t.amt : ""), url: t.doc }); });
    var seen = {};
    items = items.filter(function (x) { var k = x.kind + x.date + x.text; if (seen[k]) return false; seen[k] = 1; return true; });
    var cardB = { id: "events", title: en ? "Same period" : "같은 기간 있었던 일", big: String(nPolicy + filings.length), unit: en ? "records" : "건", items: items, lines: [], empty: !items.length && !nPolicy && !filings.length };
    var flowData = flows(data, sym, en);
    cardB.lines.push(flowData.some(function (f) { return !f.empty && f.undated; })
      ? (en ? "Contracts, lobbying and donations only have running totals, so they are in the picture below." : "계약·로비·기부는 누적 합계만 있어 아래 그림에 따로 보여 드려요.")
      : (en ? "Contracts, lobbying, donations: no record yet." : "계약·로비·기부: 아직 기록이 없어요."));
    if (cardB.empty) cardB.big = en ? "0" : "0";
    if (cardB.empty) cardB.lines.unshift(en ? "No record yet" : "아직 기록이 없어요");
    M.n = { policy: nPolicy, sales: sales.length, buys: buys.length };

    // card c
    var rc = a && a.reaction;
    var cardC = { id: "past", title: en ? "Similar cases before" : "과거 비슷했던 경우", lines: [], empty: !rc };
    if (rc && num(rc.mean) && rc.n > 0) {
      cardC.big = pct(rc.mean);
      cardC.lines.push(en ? "Average " + rc.days + "-day move after " + rc.n + " similar past announcements (estimate)" : "비슷한 발표 " + rc.n + "건 뒤 " + rc.days + "일 평균 (추정)");
      if (rc.low_n || rc.n < 5) cardC.lines.push(en ? "Only " + rc.n + " cases, so take it lightly." : "사례 " + rc.n + "건뿐이라 참고만 해요.");
      cardC.lines.push(en ? "Not a cause." : "원인을 뜻하지 않아요.");
      cardC.empty = false;
    } else { cardC.empty = true; cardC.lines.push(en ? "No record yet" : "아직 기록이 없어요"); }
    M.cards = [cardA, cardB, cardC];

    // flow picture
    var fl = [];
    if (filings.length) {
      var lo = 0, hi = 0;
      filings.forEach(function (t) { var r = amountRange(t.amt); if (r) { lo += r[0]; hi += r[1]; } });
      fl.push({ from: en ? "Lawmakers" : "의원", to: sym, big: en ? sales.length + (sales.length === 1 ? " sale · " : " sales · ") + buys.length + (buys.length === 1 ? " purchase" : " purchases") : sales.length + "건 매도 · " + buys.length + "건 매수",
        line: lo ? (en ? "Filed amounts add up to between " + money(lo) + " and " + money(hi) + " (ranges, not exact)" : "신고 금액 구간을 더하면 " + money(lo) + "~" + money(hi) + " 사이예요(정확한 금액 아님)") : (en ? "Amounts not stated" : "금액 구간 정보 없음") });
    } else fl.push({ from: en ? "Lawmakers" : "의원", to: sym, empty: true, line: en ? "No record yet" : "아직 기록이 없어요" });
    M.flow = fl.concat(flowData);
    M.caveat = en ? "Same-period records only, not a cause. Estimates are marked. Not investment advice." : "같은 기간 기록일 뿐 원인이 아니에요. 추정은 표시해 뒀어요. 투자 조언이 아니에요.";
    M.sources = (a && a.src || []).filter(function (u) { return /^https:/.test(u); });
    return M;
  }

  /* running totals: not dated by day, so they are shown as flows and labelled with what they cover */
  function flows(data, sym, en) {
    var out = [], aw = data.awards && data.awards.companies && data.awards.companies[sym];
    var lb = data.lobbying && data.lobbying.companies && data.lobbying.companies[sym];
    var pc = data.pac && data.pac.companies && data.pac.companies[sym];
    var s = aw && money(aw.total_usd);
    out.push(s ? { from: en ? "Federal government" : "연방 정부", to: sym, big: s, line: en ? "Contract awards since " + ((data.awards.period) || "") + " (USAspending)" : "계약 누적 · " + (data.awards.period || "") + " 이후(USAspending)", undated: true }
      : { from: en ? "Federal government" : "연방 정부", to: sym, empty: true, line: en ? "No record yet" : "아직 기록이 없어요" });
    s = lb && money(lb.total_usd);
    out.push(s ? { from: sym, to: en ? "Lobbying" : "로비", big: s, line: en ? "Lobbying reported, running total (public filings)" : "로비 신고 누적 합계(공개 신고 기준)", undated: true }
      : { from: sym, to: en ? "Lobbying" : "로비", empty: true, line: en ? "No record yet" : "아직 기록이 없어요" });
    s = pc && money(pc.to_federal_candidates_usd);
    out.push(s ? { from: en ? "Company PAC" : "회사 PAC", to: en ? "Candidates" : "연방 후보", big: s, line: en ? (pc.cycle || "") + " election cycle (FEC)" : (pc.cycle || "") + " 선거 주기 누적(FEC)", undated: true }
      : { from: en ? "Company PAC" : "회사 PAC", to: en ? "Candidates" : "연방 후보", empty: true, line: en ? "No record yet" : "아직 기록이 없어요" });
    return out;
  }

  /* ---------- text (for tests and screen readers) ---------- */
  function text(M) {
    if (!M) return "";
    var out = [M.headline];
    M.cards.forEach(function (c) {
      out.push(c.title + (c.big ? " " + c.big : ""));
      c.lines.forEach(function (l) { out.push(l); });
      (c.items || []).forEach(function (i) { out.push(i.text); });
    });
    M.flow.forEach(function (f) { out.push(f.from + " → " + f.to + (f.big ? " " + f.big : "") + " " + f.line); });
    out.push(M.caveat);
    return out.join("\n");
  }

  /* ---------- render (DOM calls only; no innerHTML) ---------- */
  function el(doc, tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; return e; }
  function render(M, doc, onTour) {
    var en = M.lang === "en", box = el(doc, "div", "fs");
    box.appendChild(el(doc, "p", "fs-head", M.headline));
    var cards = el(doc, "div", "fs-cards");
    M.cards.forEach(function (c) {
      var d = el(doc, "div", "fs-card fs-" + c.id + (c.empty ? " fs-empty" : ""));
      d.appendChild(el(doc, "b", "fs-ct", c.title));
      if (c.big && !c.empty) d.appendChild(el(doc, "span", "fs-big" + (c.id === "price" ? (M.ret < 0 ? " fs-dn" : M.ret > 0 ? " fs-up" : "") : ""), c.big + (c.unit ? " " + c.unit : "")));
      c.lines.forEach(function (l) { d.appendChild(el(doc, "span", "fs-ln", l)); });
      if (c.items && c.items.length) {
        var ul = el(doc, "ul", "fs-items");
        c.items.forEach(function (i) {
          var li = el(doc, "li", i.mine ? "fs-mine" : ""), t = md(i.date, en) + " · " + i.text;
          if (i.url && /^https:/.test(i.url)) { var a = el(doc, "a", "", t); a.href = i.url; a.target = "_blank"; a.rel = "noopener noreferrer"; li.appendChild(a); }
          else li.textContent = t;
          ul.appendChild(li);
        });
        d.appendChild(ul);
      }
      cards.appendChild(d);
    });
    box.appendChild(cards);
    var flow = el(doc, "div", "fs-flow");
    flow.appendChild(el(doc, "b", "fs-ct", en ? "Money & stock flow" : "돈·주식 흐름"));
    M.flow.forEach(function (f) {
      var r = el(doc, "div", "fs-row" + (f.empty ? " fs-empty" : ""));
      r.appendChild(el(doc, "span", "fs-node", f.from));
      var arrow = el(doc, "span", "fs-arrow");
      arrow.appendChild(el(doc, "span", "fs-abig", f.big || "—"));
      arrow.appendChild(el(doc, "span", "fs-aline", "──▶"));
      r.appendChild(arrow);
      r.appendChild(el(doc, "span", "fs-node", f.to));
      r.appendChild(el(doc, "span", "fs-note", f.line));
      flow.appendChild(r);
    });
    box.appendChild(flow);
    if (onTour) {
      var b = el(doc, "button", "mtSug fs-tour", en ? "▶ Full route tour" : "▶ 전체 경로 투어");
      b.type = "button"; b.onclick = onTour; box.appendChild(b);
    }
    return box;
  }

  return { plan: plan, periodKey: periodKey, topicId: topicId, build: build, text: text, render: render, asksMember: asksMember, FORBIDDEN: FORBIDDEN };
});
