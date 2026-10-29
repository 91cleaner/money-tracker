/* MONEY TRACKER — 관제실 검색 첫 화면 (first screen of a search). 브라우저/노드 공용, 네트워크 직접 호출 없음(fetchJson 을 받아서 씀), AI 없음.
   질문 -> 의도(why / topic / member / money / overview) 하나를 고르고, 의도마다 다른 첫 화면(한 줄 답 + 근거 카드 + 흐름 그림)을 만든다.
   같은 의도를 다른 말로 물으면 같은 대상·같은 숫자로 간다(기간 말이 없으면 항상 최근 1달).
   규칙: "같은 기간 ~이 있었어요" 형식만. 원인 단정·추천 금지. 기록이 없으면 "아직 기록이 없어요". 투자 조언 아님. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MTFirst = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PERIOD_DAYS = { '1w': 7, '1m': 30, '3m': 91, '1y': 365 };
  var PERIOD_KEY = { today: '1w', week: '1w', month: '1m', year: '1y' };
  var PLABEL = {
    '1w': ['최근 1주', 'the past week'], '1m': ['최근 한 달', 'the past month'],
    '3m': ['최근 3달', 'the past 3 months'], '1y': ['최근 1년', 'the past year']
  };
  var NONE = ['아직 기록이 없어요', 'No records yet'];
  var FORBIDDEN = /because|recommend|때문에|추천/i;

  /* ---------- text helpers ---------- */
  function flat(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/['’`.]/g, '').replace(/[^a-z0-9가-힣\-&]+/g, ''); }
  function words(s) { return ' ' + String(s || '').normalize('NFKC').toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9가-힣\-&]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }
  function hasHangul(s) { return /[가-힣]/.test(s); }
  /* term list hit: Korean by flattened substring, Latin by whole words */
  function hit(q, terms) {
    var f = flat(q), w = words(q);
    return (terms || []).some(function (t) {
      if (hasHangul(t)) return f.indexOf(flat(t)) >= 0;
      return w.indexOf(' ' + words(t).trim() + ' ') >= 0;
    });
  }
  function josa(name, a, b) {
    var c = String(name || '').slice(-1).charCodeAt(0) - 0xAC00;
    if (c < 0 || c > 11171) return a + '(' + b + ')';
    return c % 28 ? a : b;
  }
  function pick(lang, ko, en) { return lang === 'en' ? en : ko; }
  function pct(v, d) {
    if (typeof v !== 'number' || !isFinite(v)) return null;
    var s = (Math.round(Math.abs(v) * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).toFixed(d == null ? 1 : d);
    return (v > 0 ? '+' : v < 0 ? '−' : '') + s + '%';
  }
  function usd(v, lang) {
    if (typeof v !== 'number' || !isFinite(v) || v <= 0) return null;
    if (lang === 'en') {
      if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
      if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
      return '$' + Math.round(v).toLocaleString('en-US');
    }
    if (v >= 1e8) return '약 ' + Math.round(v / 1e8).toLocaleString('en-US') + '억 달러';
    if (v >= 1e4) return '약 ' + Math.round(v / 1e4).toLocaleString('en-US') + '만 달러';
    return Math.round(v).toLocaleString('en-US') + '달러';
  }
  function dayDiff(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
  function md(d, lang) {
    var p = String(d || '').split('-');
    if (p.length < 3) return d || '';
    return lang === 'en' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+p[1] - 1] + ' ' + (+p[2]) : (+p[1]) + '/' + (+p[2]);
  }
  function safeTitle(t, lang) { return FORBIDDEN.test(t || '') ? pick(lang, '(제목은 원문 링크에서 확인)', '(see the source for the title)') : t; }

  /* ---------- member lookup ---------- */
  function memberKey(name) { return words(name).trim().split(' ').filter(function (t) { return !/^(mr|mrs|ms|dr|jr|sr|ii|iii)$/.test(t) && t.length > 1; }); }
  /* members: [{id,name}] ; returns {id,name,cut} where cut = query text without the name */
  function findMember(q, members, lex) {
    var f = flat(q), w = words(q), best = null;
    var ko = (lex && lex.member_ko) || {};
    (members || []).forEach(function (m) {
      var hitLen = 0;
      (ko[m.id] || []).forEach(function (a) { if (f.indexOf(flat(a)) >= 0) hitLen = Math.max(hitLen, flat(a).length + 5); });
      var k = memberKey(m.name);
      if (k.length >= 2 && k.every(function (t) { return w.indexOf(' ' + t + ' ') >= 0; })) hitLen = Math.max(hitLen, k.join('').length);
      if (hitLen && (!best || hitLen > best.len)) best = { id: m.id, name: m.name, len: hitLen, key: k, ko: ko[m.id] || [] };
    });
    if (!best) return null;
    var cut = String(q);
    best.ko.concat([]).sort(function (a, b) { return b.length - a.length; }).forEach(function (a) {
      cut = cut.replace(new RegExp(a.split('').filter(function (c) { return c.trim(); }).join('\\s*'), 'g'), ' ');
    });
    best.key.forEach(function (t) { cut = cut.replace(new RegExp('\\b' + t.replace(/[^a-z0-9]/g, '.?') + '\\b', 'ig'), ' '); });
    cut = cut.replace(/\b[A-Z]\.?\b/g, ' ');
    return { id: best.id, name: best.name, cut: cut };
  }

  /* ---------- 1) intent ---------- */
  /* I = MTIntent, M = I.build(...), members = [{id,name}], lex = first-screen-lexicon.
     -> {kind: why|topic|member|money|overview|other|none, symbol, company, member, topics[], money, period, periodExplicit, query} */
  function understand(q, I, M, members, lex) {
    lex = lex || {};
    var mem = findMember(q, members, lex);
    var parsed = I.parse(mem ? mem.cut : q, M);
    var plan = { query: q, kind: 'none', symbol: null, company: null, member: mem ? { id: mem.id, name: mem.name } : null, topics: [], money: null, period: '1m', periodExplicit: false, parsed: parsed };
    if (parsed && parsed.status === 'ok' && parsed.company) { plan.symbol = parsed.company.symbol; plan.company = parsed.company; }
    plan.topics = (parsed && parsed.topics) || [];
    /* "요즘/최근/recently" are vague, not a period: only a real week word picks the 1-week window */
    var weekWord = /이번\s*주|지난\s*주|일주일|1\s*주|7\s*일|this week|past week|last week|7 days|1 week|\bweek\b/i.test(q);
    if (parsed && parsed.periodExplicit && parsed.period && (parsed.period.id !== 'week' || weekWord)) { plan.periodExplicit = true; plan.period = PERIOD_KEY[parsed.period.id] || '1m'; }
    var m = lex.money || {}, money = null;
    if (hit(q, (m.lobby || {}).ko) || hit(q, (m.lobby || {}).en)) money = 'lobby';
    else if (hit(q, (m.donation || {}).ko) || hit(q, (m.donation || {}).en)) money = 'donation';
    else if (hit(q, (m.contract || {}).ko) || hit(q, (m.contract || {}).en)) money = 'contract';
    else if (hit(q, (m.any || {}).ko) || hit(q, (m.any || {}).en)) money = 'all';
    var memberWord = hit(q, (lex.member || {}).ko) || hit(q, (lex.member || {}).en);
    if (mem || memberWord) plan.kind = 'member';
    else if (money) { plan.kind = 'money'; plan.money = money; }
    else if (parsed && parsed.intent === 'topic' && plan.topics.length) plan.kind = 'topic';
    else if (!plan.symbol && plan.topics.length) plan.kind = 'topic';
    else if (!plan.symbol) plan.kind = 'none';
    else if (parsed.intent === 'why') plan.kind = 'why';
    else if (parsed.intent === 'overview') plan.kind = 'overview';
    else plan.kind = 'other'; /* supply / compare: old path */
    return plan;
  }

  /* ---------- 2) data ---------- */
  /* getJson(path) -> Promise<json|null>; path is relative to data/ (e.g. 'answers/NVDA.json'). Small files are cached by the caller. */
  function fetchData(plan, getJson) {
    var sym = plan.symbol, out = { asof: null }, jobs = [];
    function job(key, path) { jobs.push(Promise.resolve(getJson(path)).then(function (d) { out[key] = d || null; }, function () { out[key] = null; })); }
    if (sym && (plan.kind === 'why' || plan.kind === 'topic')) job('pack', 'answers/' + encodeURIComponent(sym) + '.json');
    if (plan.kind === 'why' || plan.kind === 'member' || plan.kind === 'topic') job('trades', 'us/trades.json');
    if (plan.kind === 'money') { job('lob', 'us/lobbying.json'); job('awards', 'us/federal-awards.json'); job('pac', 'us/pac-contributions.json'); }
    return Promise.all(jobs).then(function () { return out; });
  }

  /* ---------- 3) building blocks ---------- */
  function tradesOf(data, sym, memberId) {
    return ((data && data.trades && data.trades.trades) || []).filter(function (t) {
      return (!sym || t.tk === sym) && (!memberId || t.id === memberId);
    });
  }
  function isSale(t) { return String(t.ty || '').charAt(0) === 'S'; }
  function isBuy(t) { return String(t.ty || '').charAt(0) === 'P'; }
  function evKind(e) {
    var h = (String(e.t || '') + ' ' + String(e.k || '')).toLowerCase();
    if (/관세|tariff|import/.test(h)) return 'tariff';
    if (/수출통제|export|entity list|sanction|제재/.test(h)) return 'export';
    return 'other';
  }
  var EVK = { tariff: ['관세·수입제한 발표', 'tariff announcement'], export: ['수출통제 발표', 'export-control announcement'], other: ['정책 발표', 'policy announcement'] };
  function evCount(a) { /* the pack caps listed events; the sentence "N건 있었다" keeps the true count */
    var n = (a.events || []).length, m = /(\d+)건 있었다/.exec((a.ko || []).join(' '));
    return m ? Math.max(n, +m[1]) : n;
  }
  function inWindow(date, asof, days) { var g = dayDiff(date, asof); return g >= 0 && g <= days; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function base(plan, lang, kind, name) {
    return { kind: kind, lang: lang, symbol: plan.symbol, name: name, period: plan.period, headline: '', cards: [], flow: null, list: [], tour: !!plan.symbol, empty: false, sources: [] };
  }
  function emptyDoc(plan, lang, kind, name, what) {
    var d = base(plan, lang, kind, name);
    d.empty = true;
    d.headline = (name ? name + ' · ' : '') + (what ? what + ': ' : '') + pick(lang, NONE[0], NONE[1]) + '.';
    d.cards = [{ id: 'none', title: pick(lang, '기록', 'Records'), big: '—', lines: [pick(lang, NONE[0] + '. 지어내지 않고 기록이 쌓이면 보여 드려요.', NONE[1] + '. Nothing is made up; this fills in when records appear.')] }];
    return d;
  }
  var CAVEAT = ['같은 기간에 있었던 일을 나란히 놓은 것이고 원인을 뜻하지 않아요. 투자 조언이 아니에요.', 'These are things that happened in the same period, side by side. They do not show a cause. Not investment advice.'];

  /* ---------- 4) screens ---------- */
  function buildWhy(plan, data, lang, name) {
    var pack = data.pack, p = plan.period;
    if (!pack || !pack.periods || !pack.periods[p]) return emptyDoc(plan, lang, 'why', name, pick(lang, PLABEL[p][0] + ' 주가', 'price'));
    var pd = pack.periods[p], a = (pack.answers && pack.answers.why && pack.answers.why[p]) || {}, asof = pack.asof, days = PERIOD_DAYS[p];
    var d = base(plan, lang, 'why', name), pl = PLABEL[p][lang === 'en' ? 1 : 0];
    var evs = a.events || [], nEv = evCount(a), byKind = { tariff: 0, export: 0, other: 0 };
    evs.forEach(function (e) { byKind[evKind(e)]++; });
    if (nEv > evs.length) byKind.other += nEv - evs.length;
    var tr = tradesOf(data, plan.symbol).filter(function (t) { return t.filed && inWindow(t.filed, asof, days); });
    var sells = tr.filter(isSale), buys = tr.filter(isBuy);
    /* headline */
    var parts = [];
    ['tariff', 'export', 'other'].forEach(function (k) { if (byKind[k]) parts.push(lang === 'en' ? plural(byKind[k], EVK[k][1], EVK[k][1] + 's') : EVK[k][0] + ' ' + byKind[k] + '건'); });
    if (sells.length) parts.push(lang === 'en' ? plural(sells.length, 'lawmaker sale filing', 'lawmaker sale filings') : '의원 매도 신고 ' + sells.length + '건');
    if (buys.length) parts.push(lang === 'en' ? plural(buys.length, 'lawmaker purchase filing', 'lawmaker purchase filings') : '의원 매수 신고 ' + buys.length + '건');
    var move = pct(pd.ret);
    d.headline = lang === 'en'
      ? name + ' moved ' + move + ' over ' + pl + '.' + (parts.length ? ' In the same period there ' + (nEv + sells.length + buys.length === 1 ? 'was ' : 'were ') + parts.join(' and ') + '.' : ' Nothing else was recorded in the same period.')
      : name + josa(name, '은', '는') + ' ' + pl + ' ' + move + '.' + (parts.length ? ' 같은 기간 ' + parts.join(', ') + '이 있었어요.' : ' 같은 기간 잡힌 기록은 아직 없어요.');
    /* (a) price */
    var l1 = [];
    if (pd.bench) l1.push(pick(lang, '같은 기간 ' + pd.bench.id + ' ' + pct(pd.bench.ret) + ' (차이 ' + pct(pd.bench.diff) + 'p)', 'Same period: ' + pd.bench.id + ' ' + pct(pd.bench.ret) + ' (gap ' + pct(pd.bench.diff) + ' pts)'));
    if (pd.rank) l1.push(pick(lang, '같은 업종 ' + pd.rank.of + '곳 중 ' + pd.rank.pos + '위', 'Rank ' + pd.rank.pos + ' of ' + pd.rank.of + ' in its sector'));
    d.cards.push({ id: 'price', title: pick(lang, '① 주가 변화', '1 Price change'), big: move, sub: pl + ' · ' + pick(lang, '종가 기준', 'by closing price'), lines: l1 });
    /* (b) same period */
    var l2 = [];
    evs.slice(0, 2).forEach(function (e) { l2.push({ text: md(e.d, lang) + ' ' + safeTitle(e.t, lang), url: /^https:/.test(e.u || '') ? e.u : null }); });
    if (sells.length || buys.length) l2.push(pick(lang, '의원 거래 신고: 매도 ' + sells.length + '건 · 매수 ' + buys.length + '건 (신고일 기준)', 'Lawmaker filings: ' + sells.length + ' sale(s), ' + buys.length + ' purchase(s) (by filing date)'));
    if (!l2.length) l2.push(pick(lang, '이 기간엔 ' + NONE[0] + '.', 'No records in this period yet.'));
    d.cards.push({ id: 'events', title: pick(lang, '② 같은 기간 있었던 일', '2 What happened in the same period'), big: String(nEv + sells.length + buys.length) + pick(lang, '건', ''), sub: pick(lang, '발표·의원 거래 신고', 'announcements and filings'), lines: l2 });
    /* (c) past similar */
    var r = a.reaction, l3 = [];
    if (r && r.n > 0) {
      l3.push(pick(lang, '과거 비슷한 발표 ' + r.n + '건 뒤 ' + r.days + '일간 평균 ' + pct(r.mean) + ' (추정)', 'After ' + r.n + ' similar past announcements the ' + r.days + '-day average was ' + pct(r.mean) + ' (estimate)'));
      l3.push(r.n < 5 ? pick(lang, '사례 ' + r.n + '건뿐이라 참고만 해요.', 'Only ' + r.n + ' cases, so treat it lightly.') : pick(lang, '사례 ' + r.n + '건 기준이에요.', 'Based on ' + r.n + ' cases.'));
    } else l3.push(pick(lang, NONE[0] + '.', NONE[1] + '.'));
    d.cards.push({ id: 'past', title: pick(lang, '③ 과거 비슷했던 경우', '3 Similar cases in the past'), big: r && r.n ? pct(r.mean) : '—', sub: r && r.n ? pick(lang, '그 뒤 평균 · 추정', 'average after · estimate') : '', lines: l3, estimate: true });
    /* flow */
    d.flow = {
      title: pick(lang, '같은 기간 흐름', 'Same-period picture'),
      nodes: [
        { id: 'events', label: pick(lang, '정책·발표', 'Announcements'), big: String(nEv), sub: pick(lang, '건', 'records') },
        { id: 'co', label: name, big: move, sub: pl },
        { id: 'trades', label: pick(lang, '의원 거래 신고', 'Lawmaker filings'), big: String(sells.length + buys.length), sub: pick(lang, '매도 ' + sells.length + ' · 매수 ' + buys.length, sells.length + ' sales · ' + buys.length + ' buys') }
      ],
      edges: [{ a: 'events', b: 'co', label: pick(lang, '같은 기간', 'same period') }, { a: 'trades', b: 'co', label: pick(lang, '같은 기간', 'same period') }]
    };
    d.sources = (a.src || pack.src || []).concat(sells.concat(buys).slice(0, 3).map(function (t) { return t.doc; })).filter(function (u) { return /^https:/.test(u || ''); });
    return d;
  }

  function topicLabel(plan, lang) { return plan.topics.map(function (t) { return lang === 'en' ? t.label_en : t.label_ko; }).join(lang === 'en' ? ', ' : '·'); }
  function buildTopic(plan, data, lang, name) {
    var tl = topicLabel(plan, lang), ms = plan.topics.reduce(function (x, t) { return x.concat(t.match || []); }, []).map(function (s) { return String(s).toLowerCase(); });
    if (!plan.symbol) {
      var d0 = emptyDoc(plan, lang, 'topic', '', "'" + tl + "'");
      d0.headline = pick(lang, "'" + tl + "' 기록은 회사별로 보여 드려요. 회사 이름을 같이 물어봐 주세요. 예: 엔비디아 " + tl, "'" + tl + "' records are shown per company. Add a company, e.g. NVDA " + tl + '.');
      d0.empty = true; d0.suggest = ['NVDA', 'TSLA', 'AAPL', 'LMT', 'BA'];
      return d0;
    }
    var pack = data.pack;
    if (!pack) return emptyDoc(plan, lang, 'topic', name, "'" + tl + "'");
    var pl = PLABEL[plan.period][lang === 'en' ? 1 : 0], w = pack.answers && pack.answers.why;
    function match(e) { var h = (String(e.t || '') + ' ' + String(e.k || '')).toLowerCase(); return ms.some(function (x) { return h.indexOf(x) >= 0; }); }
    var inP = ((w && w[plan.period] && w[plan.period].events) || []).filter(match);
    var inY = ((w && w['1y'] && w['1y'].events) || []).filter(match);
    var d = base(plan, lang, 'topic', name);
    var shown = inP.length ? inP : inY, scope = inP.length ? pl : PLABEL['1y'][lang === 'en' ? 1 : 0];
    if (!shown.length) return emptyDoc(plan, lang, 'topic', name, "'" + tl + "'");
    d.headline = lang === 'en'
      ? 'For ' + name + ", '" + tl + "' has " + shown.length + ' public record' + (shown.length === 1 ? '' : 's') + ' over ' + scope + (inP.length ? '.' : ' (none in ' + pl + ').')
      : name + " '" + tl + "' 기록은 " + scope + ' 동안 ' + shown.length + '건 있었어요' + (inP.length ? '.' : ' (' + pl + '에는 ' + NONE[0] + ').');
    d.cards.push({ id: 'topic', title: pick(lang, "'" + tl + "' 기록", "'" + tl + "' records"), big: String(shown.length) + pick(lang, '건', ''), sub: scope,
      lines: shown.slice(0, 6).map(function (e) { return { text: md(e.d, lang) + ' ' + safeTitle(e.t, lang), url: /^https:/.test(e.u || '') ? e.u : null }; }) });
    d.flow = { title: pick(lang, '기록 흐름', 'Record flow'), nodes: [{ id: 'g', label: pick(lang, '미국 정부 발표', 'U.S. government'), big: String(shown.length), sub: "'" + tl + "'" }, { id: 'co', label: name, big: '', sub: pick(lang, '이름이 나온 기록', 'named in records') }], edges: [{ a: 'g', b: 'co', label: pick(lang, '같은 기간', 'same period') }] };
    d.sources = shown.map(function (e) { return e.u; }).filter(function (u) { return /^https:/.test(u || ''); }).slice(0, 6);
    return d;
  }

  function buildMember(plan, data, lang, name, memberName) {
    var mid = plan.member && plan.member.id, sym = plan.symbol;
    var list = tradesOf(data, sym, mid).filter(function (t) { return t.tk || sym; }).sort(function (a, b) { return String(b.d).localeCompare(String(a.d)); });
    var who = memberName || (lang === 'en' ? 'Lawmakers' : '의원');
    var what = (name || '') ? ' · ' + name : '';
    if (!list.length) return emptyDoc(plan, lang, 'member', who, pick(lang, '의원 거래' + what, 'lawmaker trades' + what));
    var d = base(plan, lang, 'member', name);
    var sells = list.filter(isSale), buys = list.filter(isBuy);
    var rs = sells.map(function (t) { return t.r; }).filter(function (x) { return typeof x === 'number'; });
    var avg = rs.length ? rs.reduce(function (a, b) { return a + b; }, 0) / rs.length : null;
    var subject = mid ? who + (lang === 'en' ? '' : ' 의원') : '';
    var target = sym ? name : pick(lang, '주식', 'stocks');
    d.headline = lang === 'en'
      ? (mid ? who : 'Lawmakers') + ' filed ' + sells.length + ' sale(s) and ' + buys.length + ' purchase(s)' + (sym ? ' of ' + name : '') + ' in the public records.' + (avg != null ? ' After the sales, the stock moved ' + pct(avg) + ' on average to the latest close (' + rs.length + ' case' + (rs.length === 1 ? '' : 's') + ').' : '')
      : (mid ? subject + josa(subject, '은', '는') : '의원들은') + ' 공개 기록상 ' + (sym ? name + ' ' : '') + '매도 ' + sells.length + '건, 매수 ' + buys.length + '건을 신고했어요.' + (avg != null ? ' 판 날 이후 최근 종가까지 주가는 평균 ' + pct(avg) + '였어요(' + rs.length + '건).' : '');
    var rows = list.slice(0, 8).map(function (t) {
      var side = isSale(t) ? pick(lang, '매도', 'sale') : isBuy(t) ? pick(lang, '매수', 'purchase') : pick(lang, '교환', 'exchange');
      var tx = md(t.d, lang) + ' ' + side + ' · ' + t.amt + (mid ? '' : ' · ' + t.who) + (sym ? '' : ' · ' + (t.tk || '—'));
      if (typeof t.r === 'number') tx += ' → ' + pick(lang, '이후 ', 'since: ') + pct(t.r);
      return { text: tx, url: /^https:/.test(t.doc || '') ? t.doc : null };
    });
    d.cards.push({ id: 'list', title: pick(lang, '① 거래 목록', '1 Trades'), big: String(list.length) + pick(lang, '건', ''), sub: pick(lang, '신고된 거래 · 최신순', 'filed trades · newest first'), lines: rows });
    var l2 = [];
    if (rs.length) {
      l2.push(pick(lang, '판 날 이후 최근 종가까지 평균 ' + pct(avg) + ' (' + rs.length + '건)', 'From the sale date to the latest close: ' + pct(avg) + ' on average (' + rs.length + ')'));
      var sp = sells.map(function (t) { return t.rspy; }).filter(function (x) { return typeof x === 'number'; });
      if (sp.length) l2.push(pick(lang, '같은 기간 S&P 500 평균 ' + pct(sp.reduce(function (a, b) { return a + b; }, 0) / sp.length), 'Same period S&P 500: ' + pct(sp.reduce(function (a, b) { return a + b; }, 0) / sp.length) + ' on average'));
      l2.push(rs.length < 5 ? pick(lang, '사례 ' + rs.length + '건뿐이라 참고만 해요. (추정)', 'Only ' + rs.length + ' cases, so treat it lightly. (estimate)') : pick(lang, '사례 ' + rs.length + '건 기준 (추정)', 'Based on ' + rs.length + ' cases (estimate)'));
    } else l2.push(pick(lang, NONE[0] + '.', NONE[1] + '.'));
    d.cards.push({ id: 'after', title: pick(lang, '② 판 뒤 주가 변화', '2 Price after the sales'), big: avg != null ? pct(avg) : '—', sub: avg != null ? pick(lang, '평균 · 추정', 'average · estimate') : '', lines: l2, estimate: true });
    var lags = list.filter(function (t) { return t.d && t.filed; }).map(function (t) { return dayDiff(t.d, t.filed); });
    var l3 = [];
    if (lags.length) {
      var late = lags.filter(function (x) { return x > 45; }).length;
      l3.push(pick(lang, '거래일에서 신고일까지 평균 ' + Math.round(lags.reduce(function (a, b) { return a + b; }, 0) / lags.length) + '일', 'Average ' + Math.round(lags.reduce(function (a, b) { return a + b; }, 0) / lags.length) + ' days from trade to filing'));
      l3.push(pick(lang, '신고 기한(45일) 넘긴 건 ' + late + '건 · 기록일 뿐 잘잘못 아님', late + ' filed after the 45-day mark · a record, not a judgment'));
    } else l3.push(pick(lang, NONE[0] + '.', NONE[1] + '.'));
    d.cards.push({ id: 'lag', title: pick(lang, '③ 신고까지 걸린 시간', '3 Time to file'), big: lags.length ? Math.round(lags.reduce(function (a, b) { return a + b; }, 0) / lags.length) + pick(lang, '일', ' d') : '—', sub: pick(lang, '평균', 'average'), lines: l3 });
    d.flow = {
      title: pick(lang, '주식 흐름', 'Stock picture'),
      nodes: [
        { id: 'm', label: mid ? who : pick(lang, '의원들', 'Lawmakers'), big: String(sells.length), sub: pick(lang, '매도 신고', 'sale filings') },
        { id: 'co', label: target, big: avg != null ? pct(avg) : '—', sub: pick(lang, '판 뒤 평균', 'after sales, avg') }
      ],
      edges: [{ a: 'm', b: 'co', label: pick(lang, '신고된 거래', 'filed trades') }]
    };
    d.sources = list.slice(0, 4).map(function (t) { return t.doc; }).filter(function (u) { return /^https:/.test(u || ''); });
    return d;
  }

  function latestQuarter(by) {
    var ks = Object.keys(by || {}).filter(function (k) { return /-Q\d$/.test(k); }).sort();
    return ks.length ? ks[ks.length - 1] : null;
  }
  function buildMoney(plan, data, lang, name) {
    var sym = plan.symbol, kind = plan.money;
    if (!sym) { var d0 = emptyDoc(plan, lang, 'money', '', pick(lang, '돈 흐름', 'money flow')); d0.headline = pick(lang, '돈 흐름은 회사별로 보여 드려요. 회사 이름을 같이 물어봐 주세요. 예: 엔비디아 로비', 'Money flows are shown per company. Add a company, e.g. NVDA lobbying.'); d0.suggest = ['NVDA', 'LMT', 'MSFT', 'BA', 'PLTR']; return d0; }
    var aw = data.awards && data.awards.companies && data.awards.companies[sym], lb = data.lob && data.lob.companies && data.lob.companies[sym], pc = data.pac && data.pac.companies && data.pac.companies[sym];
    if (aw && !(aw.total_usd > 0)) aw = null;
    var d = base(plan, lang, 'money', name), nodes = [], edges = [], heads = [], srcs = [];
    var want = function (k) { return kind === 'all' || kind === k; };
    var co = { id: 'co', label: name, big: '', sub: '' };
    if (want('contract')) {
      if (aw) {
        var top = (aw.top_agencies || []).slice(0, 3), t = usd(aw.total_usd, lang);
        nodes.push({ id: 'gov', label: pick(lang, '미국 연방 정부', 'U.S. federal government'), big: '', sub: top.map(function (x) { return x.code; }).join(' · ') });
        edges.push({ a: 'gov', b: 'co', label: pick(lang, '계약 ' + t, 'contracts ' + t) });
        heads.push(lang === 'en' ? 'federal contracts of ' + t + ' in the data (' + (data.awards.period || []).join(' to ') + ')' : '연방 정부 계약 합계 ' + t + ' (' + (data.awards.period || []).join(' ~ ') + ')');
        d.cards.push({ id: 'contract', title: pick(lang, '① 정부 계약', '1 Government contracts'), big: t, sub: pick(lang, '기간 합계 · 이름 일치 기준', 'period total · by name match'), lines: top.map(function (x) { return x.name + ' ' + usd(x.usd, lang); }).concat((aw.top_states || []).slice(0, 1).map(function (s) { return pick(lang, '주별 1위 ' + s.name, 'Top state ' + s.name); })) });
        srcs.push(aw.source_url);
      } else d.cards.push({ id: 'contract', title: pick(lang, '① 정부 계약', '1 Government contracts'), big: '—', lines: [pick(lang, NONE[0] + '.', NONE[1] + '.')] });
    }
    if (want('lobby')) {
      if (lb && lb.total_usd > 0) {
        var q = latestQuarter(lb.by_quarter), iss = (lb.top_issues || []).slice(0, 3), t2 = usd(lb.total_usd, lang);
        nodes.push({ id: 'dc', label: pick(lang, '워싱턴 로비', 'Washington lobbying'), big: '', sub: iss.map(function (x) { return x[0]; }).join(' · ') });
        edges.push({ a: 'co', b: 'dc', label: pick(lang, '로비 보고 ' + t2, 'lobbying reported ' + t2) });
        heads.push(lang === 'en' ? 'lobbying reports totaling ' + t2 + ' across ' + lb.filings + ' filings' : '로비 공시 ' + lb.filings + '건, 보고 금액 합계 ' + t2);
        d.cards.push({ id: 'lobby', title: pick(lang, '② 로비 공시', '2 Lobbying filings'), big: t2, sub: pick(lang, '공시 ' + lb.filings + '건 합계', lb.filings + ' filings total'), lines: iss.map(function (x) { return x[0] + ' · ' + x[1] + pick(lang, '건', ''); }).concat(q ? [pick(lang, '가장 최근 분기 ' + q + ': ' + usd(lb.by_quarter[q], lang), 'Latest quarter ' + q + ': ' + usd(lb.by_quarter[q], lang))] : []) });
        srcs.push(lb.source_url);
      } else d.cards.push({ id: 'lobby', title: pick(lang, '② 로비 공시', '2 Lobbying filings'), big: '—', lines: [pick(lang, NONE[0] + '.', NONE[1] + '.')] });
    }
    if (want('donation')) {
      if (pc && pc.receipts_usd > 0) {
        var t3 = usd(pc.receipts_usd, lang), to = usd(pc.to_federal_candidates_usd, lang);
        nodes.push({ id: 'pac', label: pick(lang, '임직원 PAC', 'Employee PAC'), big: '', sub: pc.committee_name });
        edges.push({ a: 'pac', b: 'co', label: pick(lang, '모금 ' + t3, 'raised ' + t3) });
        heads.push(lang === 'en' ? 'its employee PAC raised ' + t3 + (to ? ' and gave ' + to + ' to federal candidates' : '') + ' in the ' + pc.cycle + ' cycle' : '임직원 PAC가 ' + pc.cycle + ' 선거 주기에 ' + t3 + '을 모았고' + (to ? ' 연방 후보에게 ' + to + '을 줬어요' : ' 후보 기부는 ' + NONE[0]));
        d.cards.push({ id: 'donation', title: pick(lang, '③ 정치 기부(PAC)', '3 Political giving (PAC)'), big: t3, sub: pick(lang, pc.cycle + ' 주기 모금', pc.cycle + ' cycle receipts'), lines: [pick(lang, '연방 후보에게 ' + (to || '0달러'), 'To federal candidates: ' + (to || '$0')), pick(lang, '회사 돈이 아니라 임직원 자발 기부로 운영돼요.', 'Funded by voluntary employee giving, not company money.')] });
        srcs.push(pc.source_url);
      } else d.cards.push({ id: 'donation', title: pick(lang, '③ 정치 기부(PAC)', '3 Political giving (PAC)'), big: '—', lines: [pick(lang, NONE[0] + '.', NONE[1] + '.')] });
    }
    if (!nodes.length) return emptyDoc(plan, lang, 'money', name, pick(lang, { contract: '정부 계약', lobby: '로비', donation: '정치 기부', all: '돈 흐름' }[kind], { contract: 'government contracts', lobby: 'lobbying', donation: 'political giving', all: 'money flow' }[kind]));
    nodes.push(co);
    d.headline = lang === 'en' ? name + ': ' + heads.join('; ') + '.' : name + ': ' + heads.join(' / ') + '. 공개 기록 기준이에요.';
    d.flow = { title: pick(lang, '돈 흐름', 'Money flow'), nodes: nodes, edges: edges };
    d.sources = srcs.filter(function (u) { return /^https:/.test(u || ''); });
    return d;
  }

  /* plan + data -> screen document (null for kinds that keep the old tour / old path) */
  function build(plan, data, lang, names) {
    lang = lang === 'en' ? 'en' : 'ko';
    var name = (names && (lang === 'en' ? names.en : names.ko)) || (data && data.pack && data.pack.name) || plan.symbol || '';
    if (lang === 'en' && hasHangul(name)) name = plan.symbol || name; /* no English name given: show the ticker */
    var doc = null;
    if (plan.kind === 'why') doc = buildWhy(plan, data || {}, lang, name);
    else if (plan.kind === 'topic') doc = buildTopic(plan, data || {}, lang, name);
    else if (plan.kind === 'member') doc = buildMember(plan, data || {}, lang, name, plan.member && plan.member.name);
    else if (plan.kind === 'money') doc = buildMoney(plan, data || {}, lang, name);
    if (doc) { doc.caveat = pick(lang, CAVEAT[0], CAVEAT[1]); doc.tourLabel = pick(lang, '▶ 전체 경로 투어', '▶ Full route tour'); }
    return doc;
  }

  /* plain text of a document (used for checks and for the one-line share) */
  function toText(doc) {
    if (!doc) return '';
    var out = [doc.headline];
    doc.cards.forEach(function (c) {
      out.push(c.title, c.big, c.sub || '');
      c.lines.forEach(function (l) { out.push(typeof l === 'string' ? l : l.text); });
    });
    if (doc.flow) { out.push(doc.flow.title); doc.flow.nodes.forEach(function (n) { out.push(n.label, n.big, n.sub); }); doc.flow.edges.forEach(function (e) { out.push(e.label); }); }
    out.push(doc.caveat, doc.tourLabel);
    return out.filter(Boolean).join('\n');
  }

  /* ---------- 5) drawing (DOM, textContent only) ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null && text !== '') e.textContent = text; return e; }
  function render(doc, box, onTour) {
    box.replaceChildren();
    box.dataset.kind = doc.kind;
    box.append(el('p', 'mtfHead', doc.headline));
    var cards = el('div', 'mtfCards');
    doc.cards.forEach(function (c) {
      var card = el('section', 'mtfCard mtf-' + c.id);
      card.append(el('h3', '', c.title), el('div', 'mtfBig', c.big), el('div', 'mtfSub', c.sub));
      var ul = el('ul');
      c.lines.forEach(function (l) {
        var li = el('li');
        if (typeof l === 'string') li.textContent = l;
        else if (l.url) { var a = el('a', '', l.text); a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(a); }
        else li.textContent = l.text;
        ul.append(li);
      });
      card.append(ul);
      if (c.estimate) card.append(el('span', 'mtfTag', doc.lang === 'en' ? 'estimate' : '추정'));
      cards.append(card);
    });
    box.append(cards);
    if (doc.flow) {
      var fig = el('div', 'mtfFlow'); fig.append(el('h3', '', doc.flow.title));
      var row = el('div', 'mtfRow');
      doc.flow.nodes.forEach(function (n, i) {
        if (i) {
          var e = doc.flow.edges.filter(function (x) { return x.b === n.id || x.a === n.id; })[i - 1] || doc.flow.edges[0];
          var ar = el('div', 'mtfArrow'); ar.append(el('span', '', e ? e.label : ''), el('b', '', '➜')); row.append(ar);
        }
        var nd = el('div', 'mtfNode'); nd.append(el('div', 'mtfNodeName', n.label), el('div', 'mtfNodeBig', n.big), el('div', 'mtfNodeSub', n.sub)); row.append(nd);
      });
      fig.append(row); box.append(fig);
    }
    if (doc.suggest) { var sg = el('div', 'mtfSuggest'); doc.suggest.forEach(function (s) { var b = el('button', 'mtSug', s); b.type = 'button'; b.dataset.q = s; sg.append(b); }); box.append(sg); }
    box.append(el('small', 'mtfCaveat', doc.caveat));
    doc.sources.slice(0, 4).forEach(function (u) { var a = el('a', 'mtfSrc', (doc.lang === 'en' ? 'Source ↗ ' : '출처 ↗ ') + new URL(u).hostname); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; box.append(a); });
    if (doc.tour && onTour) { var t = el('button', 'mtSug mtfTour', doc.tourLabel); t.type = 'button'; t.onclick = onTour; box.append(t); }
    return box;
  }

  return { understand: understand, fetchData: fetchData, build: build, toText: toText, render: render, FORBIDDEN: FORBIDDEN, _findMember: findMember, _josa: josa, _pct: pct };
});
