/* '분위기 + 과거' 카드: 규칙 기반 계산만 함(유료 AI·서버 없음). 같은 입력이면 항상 같은 값.
   MTMood.build({...}) -> {mood, past, ko:{...}, en:{...}} / MTMood.render(el, card, isEn) / MTMood.load(base, symbol)
   입력 층: 주가(drop), 발표(events), 의원 거래(trades), 돈 흐름(flows), 전문가(opinions.experts), CEO(opinions.ceo).
   저장된 기록만 씀. 없으면 "아직 기록이 없어요". 원인 단정·추천 표현 없음. */
(function (root) {
  'use strict';
  var HORIZONS = [['1w', 5], ['1m', 21], ['3m', 63]];
  var WORRY = ['우려', '걱정', '부담', '위험', '리스크', '둔화', '하향', '약세', '불안', '악화', '타격', '부진', '축소', '감소', '경고', '불확실',
    'concern', 'worr', 'risk', 'slowdown', 'slowing', 'downgrade', 'weak', 'pressure', 'headwind', 'uncertain', 'warn', 'decline', 'cut '];
  var CONFIDENT = ['자신', '낙관', '기대', '강세', '상향', '성장', '호조', '확대', '견조', '순항', '증가', '최고', '수요 강',
    'confident', 'optimis', 'strong', 'upgrade', 'growth', 'record', 'bullish', 'demand', 'beat', 'raise', 'outperform'];
  var KIND_WORDS = [['export_control', /수출\s*통제|수출\s*규제|export\s*(control|ban|restriction)/i], ['tariff', /관세|tariff/i]];

  function count(text, words) {
    var t = String(text || '').toLowerCase(), n = 0;
    for (var i = 0; i < words.length; i++) if (t.indexOf(words[i]) >= 0) n++;
    return n;
  }
  // 글 하나의 방향: -1 걱정, +1 자신감, 0 중립/모름
  function scoreText(text) {
    var w = count(text, WORRY), c = count(text, CONFIDENT);
    return c > w ? 1 : w > c ? -1 : 0;
  }
  function tiltOf(worry, conf) {
    var tot = worry + conf;
    if (!tot) return 'neutral';
    var s = (worry - conf) / tot;
    return s >= 0.4 ? 'worry' : s <= -0.4 ? 'confident' : 'mixed';
  }
  // items: [{text}] -> {n, worry, confident, tilt}. n=0 이면 tilt 'none'(기록 없음)
  function groupTilt(items) {
    var w = 0, c = 0, list = items || [];
    list.forEach(function (it) { var s = scoreText(it && it.text); if (s < 0) w++; else if (s > 0) c++; });
    return { n: list.length, worry: w, confident: c, tilt: list.length ? tiltOf(w, c) : 'none' };
  }
  // 의원 거래: S=판매(걱정 쪽), P=구매(자신감 쪽). E(교환) 등은 방향에서 뺀다.
  function tradesTilt(trades) {
    var w = 0, c = 0, list = trades || [];
    list.forEach(function (t) { if (t && t.ty === 'S') w++; else if (t && t.ty === 'P') c++; });
    return { n: list.length, worry: w, confident: c, tilt: list.length ? tiltOf(w, c) : 'none' };
  }
  // 묶음별 경향 -> 전체 분위기. 걱정과 자신감이 같이 있으면 'mixed'(의견이 엇갈려요)
  function mix(groups) {
    var seen = {}, any = false;
    Object.keys(groups).forEach(function (k) {
      var t = groups[k] && groups[k].tilt;
      if (t && t !== 'none' && t !== 'neutral') { seen[t] = true; any = true; }
    });
    if (!any) return 'none';
    if (seen.mixed || (seen.worry && seen.confident)) return 'mixed';
    return seen.worry ? 'worry' : 'confident';
  }

  // ---- 비슷한 과거 ----
  function idxOnOrBefore(d, date) {
    var lo = 0, hi = d.length - 1, r = -1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (d[m] <= date) { r = m; lo = m + 1; } else hi = m - 1; }
    return r;
  }
  function pct(a, b) { return Math.round((b / a - 1) * 10000) / 100; }
  function kindsOfEvents(evs) {
    var out = {};
    (evs || []).forEach(function (e) {
      var s = (e.k || '') + ' ' + (e.t || '');
      KIND_WORDS.forEach(function (kw) { if (kw[1].test(s)) out[kw[0]] = true; });
    });
    return Object.keys(out).sort();
  }
  // series {d:[날짜], c:[종가]}. events: data/history/events.json 의 events. opt {kinds, drop, tol, exclude}
  // 하락폭 비교: 사건 기준일 직전(시작일 또는 21거래일 전)~기준일 수익률이 현재 하락폭과 tol%p 이내.
  function findSimilar(series, events, opt) {
    opt = opt || {};
    var kinds = opt.kinds || [], tol = opt.tol == null ? 8 : opt.tol, out = { cases: [], skipped: [], kinds: kinds };
    var d = (series && series.d) || [], c = (series && series.c) || [];
    (events || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function (e) {
      if (kinds.indexOf(e.kind) < 0 || e.id === opt.exclude) return;
      var i = idxOnOrBefore(d, e.date);
      if (i < 0 || !d.length || e.date < d[0]) { out.skipped.push({ id: e.id, why: 'no_price' }); return; }
      var j = e.start_date ? idxOnOrBefore(d, e.start_date) : i - 21;
      if (j < 0 || (e.start_date && e.start_date < d[0])) { out.skipped.push({ id: e.id, why: 'no_price' }); return; }
      var before = pct(c[j], c[i]);
      if (typeof opt.drop === 'number' && Math.abs(before - opt.drop) > tol) { out.skipped.push({ id: e.id, why: 'different_size' }); return; }
      var after = {};
      HORIZONS.forEach(function (h) { after[h[0]] = i + h[1] < d.length ? pct(c[i], c[i + h[1]]) : null; });
      out.cases.push({ id: e.id, date: e.date, title: e.title, source: e.source, before: before, after: after });
    });
    var avg = {};
    HORIZONS.forEach(function (h) {
      var v = out.cases.map(function (x) { return x.after[h[0]]; }).filter(function (x) { return x != null; });
      avg[h[0]] = v.length ? { mean: Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length * 100) / 100, n: v.length } : null;
    });
    out.n = out.cases.length;
    out.avg = avg;
    return out;
  }

  // ---- 문장 ----
  function sgn(x) { return (x > 0 ? '+' : '') + x + '%'; }
  var MOOD_KO = { worry: '다들 걱정하는 쪽이에요', confident: '대체로 자신 있어 하는 쪽이에요', mixed: '의견이 엇갈려요', none: '아직 기록이 없어요' };
  var MOOD_EN = { worry: 'Most views lean worried.', confident: 'Most views lean confident.', mixed: 'Views are split.', none: 'No records yet.' };
  var GRP_KO = { experts: '전문가', ceo: 'CEO 발언', members: '의원 거래' };
  var GRP_EN = { experts: 'Experts', ceo: 'CEO remarks', members: 'Lawmaker trades' };
  var TILT_KO = { worry: '걱정 쪽', confident: '자신감 쪽', mixed: '엇갈림', neutral: '뚜렷하지 않음', none: '아직 기록이 없어요' };
  var TILT_EN = { worry: 'leans worried', confident: 'leans confident', mixed: 'split', neutral: 'no clear lean', none: 'No records yet' };
  var OPEN_KO = { worry: '처음엔 걱정이 많았는데', confident: '처음엔 다들 자신 있어 했는데', mixed: '처음엔 의견이 엇갈렸는데', none: '처음엔 주가가 크게 움직였는데' };
  var OPEN_EN = { worry: 'At first many were worried, but', confident: 'At first many were confident, but', mixed: 'At first views were split, but', none: 'At first the price moved a lot, but' };

  function pastText(past) {
    var n = past.n, k3 = past.avg['3m'], k1 = past.avg['1m'], k1w = past.avg['1w'];
    var ko, en;
    if (n === 0) {
      ko = '저장된 기록에서 비슷한 때를 아직 못 찾았어요(사례 0건).';
      en = 'No similar past case found in the stored records (0 cases).';
    } else {
      var parts = [], partsEn = [];
      [['1w', '1주', '1 week'], ['1m', '1달', '1 month'], ['3m', '3달', '3 months']].forEach(function (h) {
        var a = past.avg[h[0]];
        if (a) { parts.push(h[1] + ' 뒤 평균 ' + sgn(a.mean)); partsEn.push(h[2] + ' later averaged ' + sgn(a.mean)); }
      });
      var tail = parts.length ? parts.join(', ') + '(추정)였어요.' : '그 뒤 주가 기록이 아직 모자라요.';
      var tailEn = partsEn.length ? partsEn.join(', ') + ' (estimate).' : 'Not enough price history after them yet.';
      ko = '비슷한 때 ' + n + '건: ' + tail;
      en = n + ' similar past case' + (n === 1 ? '' : 's') + ': ' + tailEn;
      if (n <= 2) { ko += ' 사례 ' + n + '건뿐이라 참고만 해요.'; en += ' Only ' + n + ' case' + (n === 1 ? '' : 's') + ', so treat as reference only.'; }
    }
    return { ko: ko, en: en };
  }
  function feelText(mood, past) {
    var n = past.n, a = past.avg['3m'] || past.avg['1m'] || past.avg['1w'];
    var hz = past.avg['3m'] ? ['석 달', 'three months'] : past.avg['1m'] ? ['한 달', 'one month'] : ['1주', 'one week'];
    if (!n || !a) return {
      ko: '비교할 만한 과거 기록이 아직 없어서 이랬던 적이 있다고 말하기 어려워요.',
      en: 'There is no comparable past record yet, so there is nothing to say it has gone this way before.'
    };
    var ko = OPEN_KO[mood] + ' ' + hz[0] + ' 뒤엔 평균 ' + sgn(a.mean) + '(추정)로 이랬던 적이 있어요.';
    var en = OPEN_EN[mood] + ' ' + hz[1] + ' later the average was ' + sgn(a.mean) + ' (estimate) - it has gone like this before.';
    if (n <= 2) { ko = '사례 ' + n + '건뿐이라 참고만 해요. ' + ko; en = 'Only ' + n + ' case' + (n === 1 ? '' : 's') + ', reference only. ' + en; }
    return { ko: ko, en: en };
  }

  // 입력: {symbol, name, asof, drop, kinds, series, history, opinions:{experts,ceo}, trades, events, flows}
  function build(inp) {
    inp = inp || {};
    var op = inp.opinions || {};
    var groups = { experts: groupTilt(op.experts), ceo: groupTilt(op.ceo), members: tradesTilt(inp.trades) };
    var mood = mix(groups);
    var kinds = inp.kinds && inp.kinds.length ? inp.kinds : kindsOfEvents(inp.events);
    var past = findSimilar(inp.series, inp.history, { kinds: kinds, drop: inp.drop });
    var layers = {
      price: typeof inp.drop === 'number' ? { drop: inp.drop } : null,
      events: (inp.events || []).length,
      members: groups.members.n,
      flows: (inp.flows || []).length,
      experts: groups.experts.n,
      ceo: groups.ceo.n
    };
    var pt = pastText(past), ft = feelText(mood, past);
    var rows = Object.keys(groups).map(function (g) { return { id: g, n: groups[g].n, tilt: groups[g].tilt }; });
    var ko = {
      title: '분위기 + 과거',
      mood: mood === 'none' ? MOOD_KO.none + ' (전문가·CEO·의원 거래)' : MOOD_KO[mood],
      rows: rows.map(function (r) { return GRP_KO[r.id] + ': ' + (r.n ? TILT_KO[r.tilt] + ' (' + r.n + '건)' : TILT_KO.none); }),
      past: pt.ko, feel: ft.ko,
      note: '같은 기간 기록을 모아 본 것이고 원인을 뜻하지 않아요. 투자 조언이 아니에요.'
    };
    var en = {
      title: 'Mood + past',
      mood: mood === 'none' ? MOOD_EN.none + ' (experts, CEO, lawmaker trades)' : MOOD_EN[mood],
      rows: rows.map(function (r) { return GRP_EN[r.id] + ': ' + (r.n ? TILT_EN[r.tilt] + ' (' + r.n + ')' : TILT_EN.none); }),
      past: pt.en, feel: ft.en,
      note: 'Records gathered for the same period; this does not imply a cause. Not investment advice.'
    };
    return { symbol: inp.symbol || null, asof: inp.asof || null, mood: mood, groups: groups, layers: layers, past: past, ko: ko, en: en };
  }

  // ---- 화면 (textContent 만 사용) ----
  function render(el, card, isEn) {
    var t = isEn ? card.en : card.ko, doc = el.ownerDocument;
    el.replaceChildren();
    function add(tag, text, css) { var n = doc.createElement(tag); n.textContent = text; if (css) n.style.cssText = css; el.append(n); return n; }
    add('h3', '◉ ' + t.title, 'margin:0 0 6px');
    add('p', t.mood, 'font-weight:700;margin:0 0 4px');
    var ul = doc.createElement('ul'); ul.style.cssText = 'margin:0 0 6px;padding-left:18px';
    t.rows.forEach(function (r) { var li = doc.createElement('li'); li.textContent = r; ul.append(li); });
    el.append(ul);
    add('p', t.past, 'margin:0 0 4px');
    add('p', t.feel, 'margin:0 0 4px');
    var src = doc.createElement('p'); src.style.cssText = 'margin:0 0 4px;font-size:12px';
    card.past.cases.forEach(function (c) {
      if (!/^https:/.test(c.source)) return;
      var a = doc.createElement('a'); a.href = c.source; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = (isEn ? c.title.en : c.title.ko) + ' ↗ '; a.style.cssText = 'display:block;color:#5dff9e';
      src.append(a);
    });
    el.append(src);
    add('small', t.note);
  }

  function getJson(u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  // 브라우저용: base 는 저장소 루트 상대 경로(예: '../'). answers 팩(MTAnswers.get 결과)을 같이 받아 입력을 만든다.
  function load(base, symbol, pack) {
    var sym = String(symbol || '').toUpperCase();
    return Promise.all([
      getJson(base + 'data/history/events.json'),
      getJson(base + 'data/us/prices/' + encodeURIComponent(sym) + '.json'),
      getJson(base + 'data/us/trades-recent.json'),
      getJson(base + 'data/history/opinions.json')
    ]).then(function (r) {
      var hist = (r[0] && r[0].events) || [], op = r[3] && r[3].symbols && r[3].symbols[sym] || {};
      var trades = ((r[2] && r[2].trades) || []).filter(function (t) { return t.tk === sym; });
      return build({
        symbol: sym, asof: pack && pack.asof, drop: pack && pack.drop, events: pack && pack.events,
        series: r[1], history: hist, trades: trades, opinions: op
      });
    });
  }

  var api = { scoreText: scoreText, groupTilt: groupTilt, tradesTilt: tradesTilt, mix: mix, findSimilar: findSimilar,
    kindsOfEvents: kindsOfEvents, build: build, render: render, load: load, HORIZONS: HORIZONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MTMood = api;
})(typeof window !== 'undefined' ? window : globalThis);
