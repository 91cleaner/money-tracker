/* 미국주식추적단 — 질문 이해기 (question understander). Runs only in the browser (or node for tests): no network, no storage, no AI.
   A typed question -> company + intent (overview / why / topic / compare / supply) + period (today / week / month / year) + topics.
   Rules come from data/intent-lexicon.json (KO/EN synonyms, nicknames) and data/search-index.json (company names/aliases).
   Spaces, particles and small typos are tolerated (edit distance; Korean is compared by jamo). If no company can be told,
   the closest 3 are returned for "이걸 찾으셨나요?". explain() fills sentence templates with the numbers it is given
   (period change, same-period events, past average) in plain neutral KO/EN. It never claims a cause. Not investment advice. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MTIntent = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var GENERIC_WEEK = ["최근", "요즘", "요새", "근래", "며칠", "recent", "recently", "lately", "these days", "past few days", "few days"];
  var LEGAL = ["corp", "corporation", "inc", "incorporated", "co", "company", "ltd", "limited", "plc", "holdings", "holding", "group", "the", "sa", "nv", "ag", "adr", "lp"];
  var HANGUL = /[가-힣]/;

  /* ---------- text helpers ---------- */
  function spaced(s) {
    return " " + String(s || "").normalize("NFKC").toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9가-힣ㄱ-ㆎ\-&]+/g, " ").replace(/\s+/g, " ").trim() + " ";
  }
  function flatten(s) { return spaced(s).replace(/ /g, ""); }
  function hasHangul(s) { return HANGUL.test(s); }
  var CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ", JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ", JONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";
  function jamo(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i) - 0xAC00;
      if (c >= 0 && c < 11172) out += CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28].trim();
      else out += s[i];
    }
    return out;
  }
  function lev(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      var t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }
  /* best edit distance of alias inside text (windows of alias length -1..+1) -> {d, rel} on jamo for Korean, chars otherwise */
  function windowDist(text, alias) {
    var kor = hasHangul(alias), a = kor ? jamo(alias) : alias, best = 99, n = text.length, m = alias.length;
    if (n === 0) return 99;
    for (var w = Math.max(1, m - 1); w <= m + 1; w++) {
      for (var i = 0; i <= Math.max(0, n - w); i++) {
        var seg = text.substr(i, w), d = lev(kor ? jamo(seg) : seg, a);
        if (d < best) best = d;
      }
    }
    return best;
  }
  function relDist(text, alias) {
    var kor = hasHangul(alias), len = kor ? jamo(alias).length : alias.length;
    return windowDist(text, alias) / Math.max(1, len);
  }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h; }

  /* ---------- matcher compile ---------- */
  function termList(arr) { return (arr || []).map(function (t) { return { raw: t, flat: flatten(t), sp: spaced(t).trim(), latin: !hasHangul(t) }; }).filter(function (t) { return t.flat; }); }

  function stripLegal(name) {
    var w = spaced(name).trim().split(" ");
    while (w.length > 1 && LEGAL.indexOf(w[w.length - 1]) >= 0) w.pop();
    return w.join(" ");
  }

  function build(index, lexicon) {
    var lex = lexicon || {}, ents = (index && index.entities) || {};
    var terms = []; // {kind, id, flat, sp, latin}
    function add(kind, id, arr, extra) {
      termList(arr).forEach(function (t) { t.kind = kind; t.id = id; if (extra) for (var k in extra) t[k] = extra[k]; terms.push(t); });
    }
    Object.keys(lex.intents || {}).forEach(function (id) {
      var o = lex.intents[id];
      add("intent", id, (o.ko || []).concat(o.en || []));
    });
    Object.keys(lex.direction || {}).forEach(function (id) { add("dir", id, (lex.direction[id].ko || []).concat(lex.direction[id].en || [])); });
    Object.keys(lex.periods || {}).forEach(function (id) {
      var o = lex.periods[id];
      add("period", id, (o.ko || []).concat(o.en || []));
    });
    Object.keys(lex.topics || {}).forEach(function (id) { add("topic", id, (lex.topics[id].ko || []).concat(lex.topics[id].en || [])); });
    var stop = termList([].concat((lex.stop || {}).ko || [], (lex.stop || {}).en || []));
    var latinWords = {};
    terms.concat(stop).forEach(function (t) { if (t.latin) latinWords[t.sp] = 1; });

    // companies: aliases + name + symbol + nicknames
    var nick = lex.nicknames || {}, aliasRows = [], companies = {};
    Object.keys(ents).forEach(function (k) {
      var e = ents[k];
      if (!e || e.type !== "company") return;
      var sym = e.symbol || k.replace(/^company:/, "");
      var list = [sym, e.name].concat(e.aliases || []).concat(nick[sym] || []);
      var seen = {};
      companies[sym] = { symbol: sym, name: e.name || sym, sector: e.sector || null, aliases: [] };
      list.forEach(function (a) {
        if (!a) return;
        [a, stripLegal(a)].forEach(function (v) {
          var f = flatten(v);
          if (!f || seen[f]) return;
          var kor = hasHangul(v);
          if (kor ? f.length < 2 : f.length < 1) return;
          seen[f] = 1;
          var isSym = f === flatten(sym);
          aliasRows.push({ sym: sym, flat: f, sp: spaced(v).trim(), kor: kor, isSym: isSym, upperOnly: !kor && (f.length <= 2 || !!latinWords[spaced(v).trim()]) });
          companies[sym].aliases.push(v);
        });
      });
    });
    aliasRows.sort(function (a, b) { return b.flat.length - a.flat.length || (a.sym.indexOf(".") >= 0) - (b.sym.indexOf(".") >= 0); });
    terms.sort(function (a, b) { return b.flat.length - a.flat.length; });
    return { lex: lex, terms: terms, stop: stop, aliases: aliasRows, companies: companies, latinWords: latinWords };
  }

  /* ---------- span claiming (Korean/flat string and latin/spaced string are tracked separately) ---------- */
  function Claims(n) { this.a = new Array(n); }
  Claims.prototype.free = function (i, j) { for (var k = i; k < j; k++) if (this.a[k]) return false; return true; };
  Claims.prototype.take = function (i, j) { for (var k = i; k < j; k++) this.a[k] = 1; };

  function findAll(hay, needle) { var out = [], i = hay.indexOf(needle); while (i >= 0) { out.push(i); i = hay.indexOf(needle, i + 1); } return out; }

  function parse(query, m, opts) {
    opts = opts || {};
    var q = String(query || ""), res = {
      query: q, status: "empty", companies: [], company: null, candidates: [], intent: "overview", strongWhy: false,
      direction: null, period: null, periodExplicit: false, topics: [], matched: []
    };
    if (!q.trim() || !m) return res;
    var sp = spaced(q), flat = sp.replace(/ /g, "");
    var tokensOrig = q.normalize("NFKC").split(/[^A-Za-z0-9가-힣&\-]+/).filter(Boolean);
    var upperTok = {}; tokensOrig.forEach(function (t) { if (t === t.toUpperCase() && /[A-Z]/.test(t)) upperTok[t.toLowerCase()] = 1; });
    var cFlat = new Claims(flat.length), cSp = new Claims(sp.length);

    function wordHits(term) { // latin phrase on spaced text with word boundaries
      var out = [], needle = " " + term + " ", i = sp.indexOf(needle);
      while (i >= 0) { out.push(i + 1); i = sp.indexOf(needle, i + 1); }
      return out;
    }
    function claim(term, latin) {
      var hits = [];
      if (latin) { wordHits(term.sp).forEach(function (i) { if (cSp.free(i, i + term.sp.length)) hits.push(i); }); }
      else findAll(flat, term.flat).forEach(function (i) { if (cFlat.free(i, i + term.flat.length)) hits.push(i); });
      return hits;
    }

    // 1) companies (longest alias first)
    var found = []; // {sym, pos}
    m.aliases.forEach(function (a) {
      var hits;
      if (a.kor) hits = findAll(flat, a.flat).filter(function (i) { return cFlat.free(i, i + a.flat.length); });
      else {
        hits = wordHits(a.sp).filter(function (i) { return cSp.free(i, i + a.sp.length); });
        if (hits.length && a.upperOnly && !(a.sp.indexOf(" ") < 0 && upperTok[a.sp])) hits = [];
      }
      if (!hits.length) return;
      hits.forEach(function (i) { if (a.kor) cFlat.take(i, i + a.flat.length); else cSp.take(i, i + a.sp.length); });
      found.push({ sym: a.sym, pos: a.kor ? hits[0] : hits[0] + 1000000 });
    });
    // Korean first-position order then latin; use text order when both are of one kind
    found.sort(function (x, y) { return x.pos - y.pos; });
    var seenSym = {};
    found.forEach(function (f) { if (!seenSym[f.sym]) { seenSym[f.sym] = 1; res.companies.push(f.sym); } });

    // 2) lexicon terms (longest first)
    var intentHits = { why: 0, supply: 0, compare: 0, overview: 0 }, dirHits = { down: 0, up: 0 }, periodHits = {}, topicHits = {};
    m.terms.forEach(function (t) {
      var hits = claim(t, t.latin);
      if (!hits.length) return;
      hits.forEach(function (i) { if (t.latin) cSp.take(i, i + t.sp.length); else cFlat.take(i, i + t.flat.length); });
      res.matched.push(t.raw);
      if (t.kind === "intent") intentHits[t.id]++;
      else if (t.kind === "dir") dirHits[t.id]++;
      else if (t.kind === "period") periodHits[t.id] = (periodHits[t.id] || 0) + (GENERIC_WEEK.indexOf(t.raw) >= 0 ? 0.5 : 1);
      else if (t.kind === "topic") topicHits[t.id] = (topicHits[t.id] || 0) + 1;
    });
    // typo tolerance for latin lexicon words (tarrif -> tariff, crahs -> crash)
    var residualLatin = [];
    sp.trim().split(" ").forEach(function (w, idx, arr) {
      if (!w || /^\d+$/.test(w)) return;
      var start = sp.indexOf(" " + w + " ") + 1; // first occurrence is enough for claim check
      if (start > 0 && !cSp.free(start, start + w.length)) return;
      if (hasHangul(w)) return;
      if (m.stop.some(function (s) { return s.latin && s.sp === w; })) return;
      if (w.length >= 5) {
        var best = null, bd = 2;
        m.terms.forEach(function (t) {
          if (!t.latin || t.sp.indexOf(" ") >= 0 || t.sp.length < 5) return;
          var d = lev(w, t.sp);
          if (d <= (t.sp.length >= 8 ? 2 : 1) && d < bd) { best = t; bd = d; }
        });
        if (best) {
          res.matched.push(best.raw + "~" + w);
          if (best.kind === "intent") intentHits[best.id]++;
          else if (best.kind === "dir") dirHits[best.id]++;
          else if (best.kind === "period") periodHits[best.id] = (periodHits[best.id] || 0) + 1;
          else if (best.kind === "topic") topicHits[best.id] = (topicHits[best.id] || 0) + 1;
          return;
        }
      }
      residualLatin.push(w);
    });

    // 3) residual text for typo-tolerant company match
    var rest = flat.split(""), residualKor = [];
    for (var i = 0; i < rest.length; i++) if (cFlat.a[i]) rest[i] = "|";
    rest.join("").split(/[^가-힣]+/).forEach(function (p) {
      if (!p) return;
      m.stop.forEach(function (s) { if (!s.latin) p = p.split(s.flat).join("|"); });
      p.split("|").forEach(function (piece) {
        piece = trimParticle(piece, m.lex.particles || []);
        if (piece.length >= 2) residualKor.push(piece);
      });
    });
    var residual = residualKor.concat(residualLatin);

    if (!res.companies.length && residual.length) {
      var scored = {};
      m.aliases.forEach(function (a) {
        residual.forEach(function (r) {
          if (hasHangul(r) !== a.kor) return;
          var sc;
          if (a.kor) {
            var ja = jamo(a.flat), jr = jamo(r);
            sc = 1 - lev(jr, ja) / Math.max(ja.length, jr.length);
            if (a.flat.indexOf(r) === 0 || r.indexOf(a.flat) === 0) sc = Math.max(sc, 0.62);
          } else {
            if (r.length < 3) return;
            sc = 1 - lev(r, a.sp.replace(/ /g, "")) / Math.max(r.length, a.flat.length);
            if (a.flat.indexOf(r) === 0 && r.length >= 3) sc = Math.max(sc, 0.62);
          }
          var cur = scored[a.sym];
          if (!cur || sc > cur.score) scored[a.sym] = { sym: a.sym, score: sc, alias: a, r: r, kor: a.kor };
        });
      });
      var list = Object.keys(scored).map(function (k) { return scored[k]; }).sort(function (x, y) { return y.score - x.score || x.sym.localeCompare(y.sym); });
      var top = list[0];
      var confident = top && top.score >= (top.kor ? (top.alias.flat.length >= 3 ? 0.78 : 2) : (top.alias.flat.length >= 5 ? 0.8 : 2)) && (!list[1] || top.score - list[1].score >= 0.01 || list[1].sym === top.sym);
      if (confident) { res.companies.push(top.sym); res.matched.push(top.alias.flat + "~" + top.r); res.fuzzy = true; }
      else {
        res.candidates = list.filter(function (x) { return x.score >= 0.45; }).slice(0, 3).map(function (x) { return candidate(m, x.sym, x.score); });
      }
    }

    // 4) decisions
    res.companyList = res.companies.map(function (s) { return candidate(m, s, 1); });
    if (res.companyList.length) { res.company = res.companyList[0]; res.status = "ok"; }
    else if (res.candidates.length) res.status = "suggest";
    else res.status = "no_company";

    var topicIds = Object.keys(topicHits);
    res.topics = topicIds.map(function (id) { var t = (m.lex.topics || {})[id] || {}; return { id: id, label_ko: t.label_ko || id, label_en: t.label_en || id, country: t.country || null, match: t.match || [] }; });
    var strong = /(^| )(why|reason|reasons|cause)( |$)/.test(sp) || /왜|이유|원인|무슨일|뭔일|어찌|어떻게된/.test(flat) || dirHits.down + dirHits.up > 0;
    res.strongWhy = strong;
    res.direction = dirHits.down > dirHits.up ? "down" : dirHits.up > dirHits.down ? "up" : null;
    if (res.companyList.length >= 2 || (intentHits.compare && res.companyList.length)) res.intent = "compare";
    else if (intentHits.supply) res.intent = "supply";
    else if (strong) res.intent = "why";
    else if (topicIds.length) res.intent = "topic";
    else if (intentHits.why) res.intent = "why";
    else res.intent = "overview";

    var pids = Object.keys(periodHits);
    if (pids.length) {
      pids.sort(function (a, b) { return periodHits[b] - periodHits[a] || ((m.lex.periods[b] || {}).days || 0) - ((m.lex.periods[a] || {}).days || 0); });
      res.periodExplicit = true;
    }
    var pid = pids[0] || "week", pd = (m.lex.periods || {})[pid] || {};
    res.period = { id: pid, days: pd.days || 7, key: pd.key || "w1", label_ko: pd.label_ko || pid, label_en: pd.label_en || pid };
    return res;
  }

  function trimParticle(p, particles) {
    var changed = true;
    while (changed && p.length > 2) {
      changed = false;
      for (var i = 0; i < particles.length; i++) {
        var x = particles[i];
        if (p.length - x.length >= 2 && p.slice(-x.length) === x) { p = p.slice(0, -x.length); changed = true; break; }
      }
    }
    return p;
  }
  function candidate(m, sym, score) {
    var c = m.companies[sym] || { symbol: sym, name: sym };
    return { symbol: sym, name: c.name, sector: c.sector || null, score: Math.round(score * 100) / 100 };
  }

  /* ---------- explanation templates ---------- */
  function fmtPct(v, lang) {
    if (typeof v !== "number" || !isFinite(v)) return null;
    var s = (Math.round(Math.abs(v) * 100) / 100).toString();
    return (v > 0 ? "+" : v < 0 ? "-" : "") + s + "%";
  }
  function pick(arr, seed) { return arr[seed % arr.length]; }
  function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
  function shortDate(d, lang) {
    var p = String(d).split("-");
    if (p.length < 3) return d;
    if (lang === "en") return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+p[1] - 1] + " " + (+p[2]);
    return +p[1] + "/" + +p[2];
  }

  /* price change for the parsed period from data/us/prices/summary.json entry {d1,w1,m1,ytd}. Falls back to the nearest key. */
  function periodChange(entry, period) {
    if (!entry) return null;
    var order = ["d1", "w1", "m1", "ytd"], key = (period && period.key) || "w1";
    if (typeof entry[key] === "number") return { key: key, pct: entry[key], exact: true };
    for (var i = 0; i < order.length; i++) if (typeof entry[order[i]] === "number") return { key: order[i], pct: entry[order[i]], exact: false };
    return null;
  }
  var KEY_LABEL = { d1: ["하루", "1 day"], w1: ["최근 1주", "past week"], m1: ["최근 1달", "past month"], ytd: ["올해(연초 대비)", "year to date"] };

  /* events inside the window ending at asOf, nearest first. events: [{date, title, type, url}] */
  function sameWindowEvents(events, asOf, days, topics) {
    if (!events || !asOf) return [];
    var ms = (topics || []).reduce(function (a, t) { return a.concat(t.match || []); }, []).map(function (s) { return String(s).toLowerCase(); });
    return events.filter(function (e) {
      if (!e || !e.date) return false;
      var d = daysBetween(e.date, asOf);
      if (d < 0 || d > days) return false;
      if (!ms.length) return true;
      var hay = (String(e.title || "") + " " + String(e.type || "")).toLowerCase();
      return ms.some(function (x) { return hay.indexOf(x) >= 0; });
    }).map(function (e) { return { date: e.date, title: e.title, type: e.type, url: e.url, gap: daysBetween(e.date, asOf) }; })
      .sort(function (a, b) { return a.gap - b.gap; });
  }
  /* past similar announcements: array of numbers (percent returns over the same length window) -> {n, avg} */
  function averageReaction(returns) {
    var v = (returns || []).filter(function (x) { return typeof x === "number" && isFinite(x); });
    if (!v.length) return { n: 0, avg: null };
    return { n: v.length, avg: v.reduce(function (a, b) { return a + b; }, 0) / v.length };
  }

  /* facts: { symbol, name, entry: summary.t[SYMBOL], asOf, events: [...], past: {n, avg}, sources: [{label,url}] } */
  function explain(parsed, facts, lang) {
    lang = lang === "en" ? "en" : "ko";
    var ko = lang === "ko", f = facts || {}, seed = hash(String(parsed && parsed.query || "") + (f.symbol || ""));
    var name = f.name || (parsed && parsed.company && parsed.company.name) || f.symbol || "", sym = f.symbol || (parsed && parsed.company && parsed.company.symbol) || "";
    var who = ko ? name + "(" + sym + ")" : name + " (" + sym + ")";
    var lines = [], period = parsed && parsed.period || { key: "w1", days: 7 };
    var ch = periodChange(f.entry, period);
    var days = ch ? ({ d1: 1, w1: 7, m1: 30, ytd: 365 })[ch.key] : period.days;
    var pl = ch ? KEY_LABEL[ch.key][ko ? 0 : 1] : (ko ? period.label_ko : period.label_en);

    if (parsed && parsed.topics && parsed.topics.length) {
      var tl = parsed.topics.map(function (t) { return ko ? t.label_ko : t.label_en; }).join(ko ? ", " : ", ");
      lines.push(ko ? "'" + tl + "' 주제만 골라 보았습니다." : "Showing only the topic: " + tl + ".");
    }
    if (ch) {
      var p = fmtPct(ch.pct), moved = ch.pct > 0 ? "up" : ch.pct < 0 ? "down" : "flat";
      var asOf = f.asOf ? (ko ? " (" + f.asOf + " 종가 기준)" : " (as of the " + f.asOf + " close)") : "";
      if (ko) {
        var kv = { up: ["올랐습니다", "상승했습니다"], down: ["내렸습니다", "하락했습니다"], flat: ["그대로였습니다", "변화가 없었습니다"] }[moved];
        lines.push(pick([
          who + "의 " + pl + " 종가 변화는 데이터상 " + p + "로, " + pick(kv, seed >> 3) + asOf + ".",
          pl + " 동안 " + who + " 종가는 " + p + " " + pick(kv, seed >> 3) + asOf + "."
        ], seed));
      } else {
        var ev = { up: ["rose", "gained"], down: ["fell", "lost ground"], flat: ["was unchanged", "stayed flat"] }[moved];
        lines.push(pick([
          "Over the " + pl + ", " + who + " closing price " + pick(ev, seed >> 3) + " " + p + " in the data" + asOf + ".",
          who + " " + pick(ev, seed >> 3) + " " + p + " over the " + pl + " by closing prices" + asOf + "."
        ], seed));
      }
      if (parsed && parsed.direction && ((parsed.direction === "down" && ch.pct > 0) || (parsed.direction === "up" && ch.pct < 0))) {
        lines.push(ko ? "질문에서 말한 방향과 달리, 이 기간 종가는 " + (ch.pct > 0 ? "올랐습니다." : "내렸습니다.") : "Unlike the direction in the question, the close " + (ch.pct > 0 ? "rose" : "fell") + " in this period.");
      }
      if (!ch.exact) lines.push(ko ? "물은 기간의 자료가 없어 가까운 기간(" + pl + ")으로 보여 드립니다." : "No data for the exact period asked, so the nearest one (" + pl + ") is shown.");
    } else {
      lines.push(ko ? who + "의 종가 자료를 찾지 못했습니다." : "No closing-price data found for " + who + ".");
    }

    var evs = f.events ? sameWindowEvents(f.events, f.asOf, days, parsed && parsed.topics) : null;
    if (evs) {
      if (!evs.length) lines.push(ko ? "데이터에 잡힌 같은 기간 정책·발표·실적 일정은 없습니다." : "No policy, announcement or earnings date in the data falls in the same period.");
      else {
        var near = evs[0];
        lines.push(ko
          ? "같은 기간 " + evs.length + "건의 정책·발표·실적 일정이 있었습니다. 가장 가까운 것은 " + shortDate(near.date, lang) + " " + near.title + "입니다."
          : "In the same period there " + (evs.length === 1 ? "was 1 policy, announcement or earnings date" : "were " + evs.length + " policy, announcement or earnings dates") + ". The closest was " + shortDate(near.date, lang) + ": " + near.title + ".");
      }
    }
    if (f.past && f.past.n > 0 && typeof f.past.avg === "number") {
      var pa = fmtPct(f.past.avg);
      var few = f.past.n < 5;
      lines.push(ko
        ? "과거 비슷한 발표 뒤 같은 길이 구간은 " + f.past.n + "번 평균 " + pa + "였습니다(데이터상)." + (few ? " 표본이 적어 참고만 하세요." : "")
        : "After similar past announcements, the same-length window averaged " + pa + " over " + f.past.n + " time" + (f.past.n === 1 ? "" : "s") + " (in the data)." + (few ? " The sample is small, so treat it lightly." : ""));
    }
    lines.push(ko ? "상관관계일 뿐 원인이 아니며, 투자 조언이 아닙니다." : "This is correlation only, not a cause, and not investment advice.");
    return { lines: lines, text: lines.join(" "), sources: f.sources || [], lang: lang };
  }

  function suggestText(parsed, lang) {
    var c = (parsed && parsed.candidates) || [];
    if (!c.length) return lang === "en" ? "I could not tell which company you mean. Try a name or ticker, e.g. NVDA." : "어떤 회사인지 알 수 없었어요. 회사 이름이나 티커(예: NVDA)로 다시 물어봐 주세요.";
    var names = c.map(function (x) { return x.name + "(" + x.symbol + ")"; }).join(lang === "en" ? ", " : ", ");
    return lang === "en" ? "Did you mean: " + names + "?" : "이걸 찾으셨나요? " + names;
  }

  /* pre-written summaries (optional): data/us/explain/<T>.json written by a daily workflow from data only (no paid API). */
  function prewrittenUrl(symbol, base) { return (base || "") + "data/us/explain/" + encodeURIComponent(String(symbol || "").toUpperCase()) + ".json"; }
  function prewrittenLines(doc, lang) {
    if (!doc || typeof doc !== "object") return [];
    var arr = doc["summary_" + (lang === "en" ? "en" : "ko")];
    return Array.isArray(arr) ? arr.filter(function (s) { return typeof s === "string" && s; }).slice(0, 5) : [];
  }

  return {
    build: build, parse: parse, explain: explain, suggestText: suggestText,
    periodChange: periodChange, sameWindowEvents: sameWindowEvents, averageReaction: averageReaction,
    prewrittenUrl: prewrittenUrl, prewrittenLines: prewrittenLines,
    _lev: lev, _jamo: jamo, _flat: flatten
  };
});
