/* MONEY TRACKER 관제실: 세계 법안·주가 흐름.
 * 저장된 기록(data/world: 한국·미국·일본·대만·유럽 법안, data/markets: 일별 종가)만 쓴다. AI·실시간 시세 없음.
 * "왜 이런 흐름인가"는 같은 시기에 일어난 일을 날짜·숫자·원문으로 나란히 보여 주는 것이며, 법안이 주가를 움직였다는 증명이 아니다.
 */
(function () {
  'use strict';
  var BASE = 'data/world/', MK = 'data/markets/';
  var CCS = ['us', 'kr', 'jp', 'tw', 'eu'];
  var FLAG = { us: '🇺🇸', kr: '🇰🇷', jp: '🇯🇵', tw: '🇹🇼', eu: '🇪🇺' };
  var cache = {};
  function getJSON(u) {
    if (!cache[u]) cache[u] = fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
    return cache[u];
  }
  function norm(s) { return String(s == null ? '' : s).normalize('NFKC').toLowerCase(); }
  function squash(s) { return norm(s).replace(/[\s·.,()\-]+/g, ''); }
  function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }
  function add(p, tag, cls, text) { var x = el(tag, cls, text); p.appendChild(x); return x; }
  function safe(u) { return /^https:\/\//.test(String(u || '')) ? String(u) : ''; }
  function pct(v) { return v == null || isNaN(v) ? '—' : (v > 0 ? '+' : '') + (Math.round(v * 10) / 10) + '%'; }
  function n(v) { return Number(v || 0).toLocaleString('ko-KR'); }
  // 받침에 맞는 조사: josa('미국', '이', '가') → '미국이'
  function josa(word, a, b) {
    var ch = String(word || '').trim().slice(-1), code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) return word + (((code - 0xac00) % 28) ? a : b);
    if (/[0-9]/.test(ch)) return word + ('013678'.indexOf(ch) >= 0 ? a : b);
    return word + (/[a-z]/i.test(ch) ? b : a);
  }
  // 금리처럼 '수준'이 의미 있는 것은 1년 전 → 지금으로
  function otherText(m) {
    if (m.symbol === '^TNX' && m.close != null && m.y1 != null) { var prev = m.close / (1 + m.y1 / 100); return '미국 10년 국채 금리 ' + prev.toFixed(2) + '% → ' + Number(m.close).toFixed(2) + '%'; }
    if (/=X$/.test(m.symbol) && m.close != null && m.y1 != null) { var p0 = m.close / (1 + m.y1 / 100); return m.name + ' ' + p0.toFixed(p0 < 10 ? 3 : 0) + ' → ' + Number(m.close).toFixed(m.close < 10 ? 3 : 0); }
    return m.name + ' ' + pct(m.y1);
  }

  /* ── 질문 해석: 주제·지역·종목 (낱말 규칙, 화면에 그대로 보여 줌) ── */
  function resolve(q, T) {
    var nq = norm(q), sq = squash(q);
    var regions = CCS.filter(function (cc) {
      return (T.region_words[cc] || []).some(function (w) {
        w = norm(w);
        if (/^[a-z]{1,3}$/.test(w)) return new RegExp('(^|[^a-z])' + w + '([^a-z]|$)').test(nq);
        return w.length >= 2 && nq.indexOf(w) >= 0;
      });
    });
    var syms = T.markets.filter(function (m) {
      var nm = squash(m.name), sy = norm(m.symbol).replace(/^\^/, '').replace(/[.=-].*$/, '');
      return (nm.length >= 2 && sq.indexOf(nm) >= 0) || (sy.length >= 3 && /^[a-z]+$/.test(sy) && new RegExp('(^|[^a-z])' + sy + '([^a-z]|$)').test(nq));
    });
    var scores = T.topics.map(function (t) {
      var s = 0, why = [];
      (t.query || []).forEach(function (w) { var x = squash(w); if (x.length >= 2 && sq.indexOf(x) >= 0) { s += x.length; why.push(w.trim()); } });
      if (sq.indexOf(squash(t.label)) >= 0) { s += 10; why.push(t.label); }
      syms.forEach(function (m) { if ((t.tags || []).some(function (g) { return m.tags.indexOf(g) >= 0; })) { s += 3; why.push(m.name); } });
      return { id: t.id, label: t.label, s: s, why: why };
    }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; });
    return { topics: scores.slice(0, 2), regions: regions, symbols: syms };
  }

  /* ── 시세 ── */
  function monthlyClose(series, months) {
    var out = {}, d = series.d, c = series.c;
    for (var i = 0; i < d.length; i++) out[d[i].slice(0, 7)] = c[i];
    return months.map(function (m) { return out[m] == null ? null : out[m]; });
  }
  function changeOver(series, tradingDays) {
    var c = series.c; if (!c || c.length <= tradingDays) return null;
    var a = c[c.length - 1 - tradingDays], b = c[c.length - 1];
    return a ? (b / a - 1) * 100 : null;
  }

  /* ── 그림: 36개월 법안 막대(지역별 쌓기) + 대표 시세 선 ── */
  var COLOR = { us: '#7fb3ff', kr: '#ff8a8a', jp: '#ffd27a', tw: '#7dffb0', eu: '#c9a7ff' };
  function chart(box, topic, months, line, lineName) {
    var W = 420, H = 150, L = 6, R = 6, T = 8, B = 18, nm = months.length, bw = (W - L - R) / nm;
    var tot = months.map(function (_, i) { return CCS.reduce(function (s, cc) { return s + ((topic.monthly[cc] || [])[i] || 0); }, 0); });
    var mx = Math.max.apply(null, tot.concat([1]));
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mt-w-chart" role="img" aria-label="월별 법안 수와 시세">';
    for (var i = 0; i < nm; i++) {
      var y = H - B;
      CCS.forEach(function (cc) {
        var v = (topic.monthly[cc] || [])[i] || 0; if (!v) return;
        var h = (v / mx) * (H - T - B - 4);
        y -= h;
        svg += '<rect x="' + (L + i * bw + 1).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + COLOR[cc] + '" opacity=".85"><title>' + months[i] + ' ' + cc.toUpperCase() + ' ' + v + '건</title></rect>';
      });
    }
    if (line && line.some(function (v) { return v != null; })) {
      var vals = line.filter(function (v) { return v != null; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pts = [];
      line.forEach(function (v, k) { if (v == null) return; pts.push((L + k * bw + bw / 2).toFixed(1) + ',' + (T + (1 - (v - lo) / ((hi - lo) || 1)) * (H - T - B - 4)).toFixed(1)); });
      svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#f2fff4" stroke-width="1.8"><title>' + lineName.replace(/[<&]/g, '') + ' 월말 종가</title></polyline>';
    }
    svg += '<text x="' + L + '" y="' + (H - 4) + '" class="mt-w-ax">' + months[0] + '</text><text x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end" class="mt-w-ax">' + months[nm - 1] + '</text></svg>';
    var wrap = add(box, 'div', 'mt-w-chartbox');
    wrap.innerHTML = svg; // 숫자·고정 문자열만 들어간 SVG (사용자 입력 없음)
    var lg = add(box, 'div', 'mt-w-legend');
    CCS.forEach(function (cc) { var s = add(lg, 'span', '', FLAG[cc] + ' ' + cc.toUpperCase()); s.style.borderColor = COLOR[cc]; });
    if (lineName) add(lg, 'span', 'mt-w-line', '— ' + lineName);
  }

  /* ── 지도 따라가기 ── */
  var layer = null, timer = 0;
  function clearTrace(api) { clearTimeout(timer); timer = 0; if (layer && api && api.map) { try { api.map.removeLayer(layer); } catch (e) {} } layer = null; }
  var traceBtns = [];
  function setBtns(txt) { traceBtns.forEach(function (b) { if (b.isConnected) b.textContent = txt; }); }
  function trace(api, steps, list, stopBtn, collapse) {
    clearTrace(api);
    if (collapse) collapse(); // 폰에서 패널이 지도를 덮지 않게 접는다
    if (!window.L || !api || !api.map) return;
    layer = window.L.layerGroup().addTo(api.map);
    steps.forEach(function (s, i) {
      window.L.circleMarker([s.lat, s.lng], { radius: s.kind === 'law' ? 9 : 7, color: s.kind === 'law' ? '#f2fff4' : '#ffd27a', weight: 2, fillColor: COLOR[s.cc] || '#7dffb0', fillOpacity: 0.85 })
        .bindTooltip((i + 1) + '. ' + s.label, { permanent: false, direction: 'top' }).addTo(layer);
      if (i) window.L.polyline([[steps[i - 1].lat, steps[i - 1].lng], [s.lat, s.lng]], { color: '#74ffb0', dashArray: '6 8', weight: 2, opacity: 0.7 }).addTo(layer);
    });
    var i = 0;
    function next() {
      if (i >= steps.length) { setBtns('▶ 다시 따라가기'); timer = 0; return; }
      var s = steps[i];
      [].forEach.call(list.children, function (li, k) { li.classList.toggle('on', k === i); });
      if (typeof api.travelTo === 'function') api.travelTo([s.lat, s.lng], s.kind === 'law' ? 6 : 9, (i + 1) + '/' + steps.length + ' · ' + s.label);
      i++;
      timer = setTimeout(next, 5200);
    }
    setBtns('■ 멈춤');
    next();
  }

  /* ── 주제 흐름 ── */
  function renderTopic(box, T, R, topic, ctx) {
    var focus = R.regions.length ? R.regions : CCS.slice();
    var months = topic.months, nm = months.length;
    var sum = function (cc, a, b) { return ((topic.monthly[cc] || []).slice(a, b)).reduce(function (s, v) { return s + v; }, 0); };
    var last12 = {}, prev12 = {};
    CCS.forEach(function (cc) { last12[cc] = sum(cc, nm - 12, nm); prev12[cc] = sum(cc, nm - 24, nm - 12); });
    var order = CCS.slice().sort(function (a, b) { return last12[b] - last12[a]; });

    var head = add(box, 'div', 'mt-w-head');
    add(head, 'b', '', '🌐 세계 법안·주가 흐름 · ' + topic.label);
    add(head, 'span', 'mt-w-why', '묶은 낱말: ' + (R.topics[0].why.filter(function (w, i, a) { return a.indexOf(w) === i; }).slice(0, 4).join(', ') || topic.label));

    // 지역별 법안
    var tbl = add(box, 'div', 'mt-w-regions');
    CCS.forEach(function (cc) {
      var row = add(tbl, 'div', 'mt-w-reg' + (focus.indexOf(cc) >= 0 ? '' : ' dim'));
      add(row, 'span', 'f', FLAG[cc] + ' ' + T.regions[cc]);
      add(row, 'span', 'c', n(topic.count[cc] || 0) + '건');
      add(row, 'span', 'p', '통과 ' + n(topic.passed[cc] || 0));
      var undated = (topic.recent[cc] || []).some(function (r) { return !r.d; });
      add(row, 'span', 'y', undated && !last12[cc] ? '날짜 채우는 중' : '최근 1년 ' + n(last12[cc]) + (prev12[cc] ? ' (' + pct((last12[cc] / prev12[cc] - 1) * 100) + ')' : ''));
    });

    // 대표 시세: 질문한 종목 > 질문 지역의 주제 종목 > 미국 주제 종목
    var mks = topic.markets.filter(function (m) { return ['fx', 'commodity', 'rates', 'crypto'].indexOf(m.region) < 0 || topic.id === 'crypto' || topic.id === 'energy'; });
    var asked = R.symbols.filter(function (s) { return mks.some(function (m) { return m.symbol === s.symbol; }); });
    var main = (asked[0] && mks.find(function (m) { return m.symbol === asked[0].symbol; })) || mks.find(function (m) { return focus.indexOf(m.region) >= 0 && focus.length < 5; }) || mks.find(function (m) { return m.region === 'us'; }) || mks[0];
    var charted = add(box, 'div', 'mt-w-chartslot');
    var explain = add(box, 'div', 'mt-w-explain');
    add(explain, 'h4', '', '왜 이런 흐름인가 — 저장된 기록으로 본 같은 시기의 일');
    var ul = add(explain, 'ul', '');
    var top = order[0];
    var focusLaws = focus.reduce(function (s, cc) { return s + (topic.count[cc] || 0); }, 0);
    if (focus.length < 5 && !focusLaws) add(ul, 'li', 'mt-w-other', focus.map(function (cc) { return FLAG[cc] + ' ' + T.regions[cc]; }).join(', ') + '에서는 저장된 법안 중 ' + topic.label + ' 낱말이 들어간 것이 아직 없어요(대만 ' + n((T.laws.tw || {}).count) + '건·일본 ' + n((T.laws.jp || {}).count) + '건 수집). 다른 나라 흐름과 함께 봐 주세요.');
    var li1 = add(ul, 'li', '');
    li1.textContent = '최근 12개월 ' + topic.label + ' 법안은 ' + FLAG[top] + ' ' + josa(T.regions[top], '이', '가') + ' 가장 많아요(' + n(last12[top]) + '건' + (prev12[top] ? ', 그 전 12개월보다 ' + pct((last12[top] / prev12[top] - 1) * 100) : '') + ').' +
      (order[1] && last12[order[1]] ? ' 다음은 ' + FLAG[order[1]] + ' ' + T.regions[order[1]] + ' ' + n(last12[order[1]]) + '건.' : '');
    var peak = -1, pv = 0;
    for (var k = 0; k < nm; k++) { var s = CCS.reduce(function (a, cc) { return a + ((topic.monthly[cc] || [])[k] || 0); }, 0); if (s > pv) { pv = s; peak = k; } }
    if (peak >= 0) add(ul, 'li', '', '3년 중 법안이 가장 몰린 달은 ' + months[peak] + '(' + pv + '건)이에요.');

    var loads = [];
    var pick = mks.filter(function (m) { return m === main || (focus.indexOf(m.region) >= 0 && focus.length < 5); }).slice(0, 3);
    if (pick.indexOf(main) < 0 && main) pick.unshift(main);
    pick.forEach(function (m) { loads.push(getJSON(MK + m.file).then(function (sr) { return { m: m, s: sr }; }).catch(function () { return null; })); });
    var idxSyms = focus.slice(0, 2).map(function (cc) { return topic.index[cc]; });
    idxSyms.forEach(function (sym) { var m = T.markets.find(function (x) { return x.symbol === sym; }); if (m) loads.push(getJSON(MK + m.file).then(function (sr) { return { m: m, s: sr, idx: true }; }).catch(function () { return null; })); });
    Promise.all(loads).then(function (rs) {
      rs = rs.filter(Boolean);
      var mainS = rs.find(function (x) { return main && x.m.symbol === main.symbol; });
      chart(charted, topic, months, mainS ? monthlyClose(mainS.s, months) : null, mainS ? mainS.m.name : '');
      var moves = rs.map(function (x) { return { m: x.m, y1: changeOver(x.s, 252), idx: x.idx }; }).filter(function (x) { return x.y1 != null; });
      var stocks = moves.filter(function (x) { return !x.idx; }), idxs = moves.filter(function (x) { return x.idx; });
      if (stocks.length) {
        var li = add(ul, 'li', '');
        li.textContent = '같은 12개월 시세: ' + stocks.map(function (x) { return x.m.name + ' ' + pct(x.y1); }).join(', ') +
          (idxs.length ? ' / 지수: ' + idxs.map(function (x) { return x.m.name + ' ' + pct(x.y1); }).join(', ') : '') +
          (idxs.length ? ' → ' + josa(stocks[0].m.name, '은', '는') + ' ' + idxs[0].m.name + '보다 ' + '수익률이 ' + pct(Math.abs(stocks[0].y1 - idxs[0].y1)).replace(/^[+-]/, '').replace('%', '%p') + (stocks[0].y1 >= idxs[0].y1 ? ' 높았어요.' : ' 낮았어요.') : '');
      }
    });

    // 통과 법안 직후 20거래일
    var usable = function (e) { return Object.keys(e.mv || {}).length >= 2; };
    var ev = topic.events.filter(function (e) { return focus.indexOf(e.cc) >= 0 && usable(e); }), evOther = false;
    if (!ev.length && focus.length < 5) { ev = topic.events.filter(usable); evOther = ev.length > 0; }
    if (ev.length) {
      var rel = [], idx = [], beat = 0;
      ev.forEach(function (e) {
        var keys = Object.keys(e.mv), ik = topic.index[e.cc], sk = keys.find(function (x) { return x !== ik; });
        if (sk && e.mv[ik] != null) { rel.push(e.mv[sk]); idx.push(e.mv[ik]); if (e.mv[sk] > e.mv[ik]) beat++; }
      });
      if (rel.length) {
        var avg = function (a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; };
        add(ul, 'li', '', (evOther ? '(질문한 나라는 아직 계산할 통과 법안이 없어 다른 나라 기준) ' : '') + '통과된 법안 ' + rel.length + '건의 "통과 5거래일 전 → 20거래일 후"를 평균하면, 그 지역 관련 종목 ' + pct(avg(rel)) + ', 지역 지수 ' + pct(avg(idx)) +
          '. ' + rel.length + '건 중 ' + beat + '건은 관련 종목이 지수보다 더 올랐어요.');
      }
    } else add(ul, 'li', '', '최근 5년 안에 통과된 법안 중, 전후 시세를 계산할 수 있는 것은 아직 없어요.');

    // 다른 요인(법안 말고도 시세를 움직이는 것)
    var other = ['^TNX', 'KRW=X', 'CL=F', 'EURUSD=X'].map(function (sym) { return T.markets.find(function (m) { return m.symbol === sym; }); }).filter(Boolean);
    if (other.length) add(ul, 'li', 'mt-w-other', '같은 1년 다른 요인: ' + other.map(otherText).join(', ') + ' — 금리·환율·유가도 같이 봐야 해요.');
    add(explain, 'p', 'mt-w-caution', '이 설명은 같은 시기에 함께 일어난 일을 나란히 놓은 것이에요. 법안이 주가를 움직였다는 증거가 아니고, 실적·금리·환율·전쟁 같은 다른 원인이 클 수 있어요.');

    // 근거: 통과 법안 + 지역별 최근 법안
    var evb = add(box, 'div', 'mt-w-evidence');
    add(evb, 'h4', '', '근거 기록 (원문)');
    ev.slice(0, 6).forEach(function (e) {
      var row = add(evb, 'div', 'mt-w-ev');
      add(row, 'span', 'd', e.d + ' ' + FLAG[e.cc] + ' 통과');
      var a = add(row, safe(e.u) ? 'a' : 'span', 't', e.t);
      if (safe(e.u)) { a.href = safe(e.u); a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      add(row, 'span', 'm', Object.keys(e.mv).map(function (k) { return k + ' ' + pct(e.mv[k]); }).join(' · '));
    });
    var evRegions = focus.filter(function (cc) { return (topic.recent[cc] || []).length; });
    if (!evRegions.length) evRegions = order.filter(function (cc) { return (topic.recent[cc] || []).length; }).slice(0, 2);
    evRegions.forEach(function (cc) {
      var list = (topic.recent[cc] || []).slice(0, 3);
      list.forEach(function (r) {
        var row = add(evb, 'div', 'mt-w-ev');
        add(row, 'span', 'd', (r.p === 2 ? (r.pd || '통과일 미확인') + ' ' + FLAG[cc] + ' 통과' : (r.d || '제출일 미확인') + ' ' + FLAG[cc] + ' 제출'));
        var a = add(row, safe(r.u) ? 'a' : 'span', 't', r.t);
        if (safe(r.u)) { a.href = safe(r.u); a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        if (r.st) add(row, 'span', 'm', r.st);
      });
    });

    // 지도 따라가기: 최근 법안이 많은 지역 순 → 의회 → 그 지역 산업 현장
    var steps = [];
    var stepRegions = order.filter(function (cc) { return last12[cc] > 0 && focus.indexOf(cc) >= 0; });
    if (!stepRegions.length) stepRegions = focus.concat(order.filter(function (cc) { return last12[cc] > 0 && focus.indexOf(cc) < 0; }));
    stepRegions.slice(0, 4).forEach(function (cc) {
      var p = topic.parliaments[cc];
      if (p && (last12[cc] || topic.count[cc])) steps.push({ lat: p.lat, lng: p.lng, cc: cc, kind: 'law', label: FLAG[cc] + ' ' + p.name + ' · ' + (last12[cc] ? '최근 1년 ' + topic.label + ' 법안 ' + last12[cc] + '건' : topic.label + ' 법안 ' + (topic.count[cc] || 0) + '건') });
      (topic.anchors || []).filter(function (a) { return a.cc === cc; }).slice(0, 2).forEach(function (a) { steps.push({ lat: a.lat, lng: a.lng, cc: cc, kind: 'site', label: a.name }); });
    });
    if (steps.length) {
      var tb = add(box, 'div', 'mt-w-trace');
      add(tb, 'h4', '', '지도로 따라가기 (' + steps.length + '곳)');
      var ol = add(tb, 'ol', '');
      steps.forEach(function (s) { add(ol, 'li', '', s.label); });
      var btn = add(tb, 'button', 'mt-w-go', '▶ 지도로 따라가기'); btn.type = 'button';
      traceBtns = [btn];
      btn.addEventListener('click', function () { if (timer) { clearTrace(ctx.api); setBtns('▶ 지도로 따라가기'); [].forEach.call(ol.children, function (li) { li.classList.remove('on'); }); } else trace(ctx.api, steps, ol, btn, ctx.collapse); });
      ctx.traceBtn = btn;
    }
    var src = add(box, 'p', 'mt-w-src', '출처: Congress.gov · 열린국회정보 · 衆議院 議案情報 · 立法院 開放資料 · EUR-Lex · Yahoo Finance 일별 종가. 법안 묶음은 제목 낱말 규칙(위 "묶은 낱말"), 통과 = 미국 법률 성립·한국 가결·대만 三讀·일본 成立·EU 채택.');
    src.title = topic.note || '';

    return { text: topic.label + ' 법안 ' + n(CCS.reduce(function (s, cc) { return s + (topic.count[cc] || 0); }, 0)) + '건 · ' + order.filter(function (cc) { return topic.count[cc]; }).slice(0, 3).map(function (cc) { return FLAG[cc] + ' ' + n(topic.count[cc]); }).join(' ') + (main && main.y1 != null ? ' · ' + main.name + ' 1년 ' + pct(main.y1) : ''), steps: steps };
  }

  /* ── 주제가 없을 때: 5개 지역 법안 제목에서 직접 찾기 ── */
  function renderTitles(box, T, q, R, ctx) {
    var toks = norm(q).split(/\s+/).map(function (t) { return t.replace(/[?!.,]+$/, ''); }).filter(function (t) { return t.length >= 2 && !(T.region_words && CCS.some(function (cc) { return (T.region_words[cc] || []).indexOf(t) >= 0; })); });
    var head = add(box, 'div', 'mt-w-head');
    add(head, 'b', '', '🌐 5개 지역 법안 제목에서 찾기');
    var status = add(box, 'p', 'mt-w-src', '한국·미국·일본·대만·유럽 법안 제목을 불러오는 중…');
    if (!toks.length) { status.textContent = '찾을 낱말이 없어요.'; return Promise.resolve({ text: '', steps: [] }); }
    var focus = R.regions.length ? R.regions : CCS;
    return Promise.all(focus.map(function (cc) { return getJSON(BASE + 'titles-' + cc + '.json').then(function (d) { return [cc, d]; }).catch(function () { return [cc, null]; }); })).then(function (rs) {
      var total = 0, per = {}, hits = [];
      rs.forEach(function (x) {
        var cc = x[0], d = x[1]; per[cc] = 0; if (!d) return;
        for (var i = 0; i < d.t.length; i++) {
          var t = norm(d.t[i]);
          if (toks.every(function (k) { return t.indexOf(k) >= 0; })) { per[cc]++; total++; if (hits.length < 400) hits.push({ cc: cc, t: d.t[i], d: d.d[i], st: d.st[i], u: d.u[i], p: d.p[i], pd: (d.pd || [])[i] || '' }); }
        }
      });
      status.textContent = total ? '제목에 "' + toks.join(' ') + '"가 들어간 법안 ' + n(total) + '건' : '"' + toks.join(' ') + '"가 들어간 법안 제목은 저장된 기록에 없어요. 다른 낱말(한국어·영어·일본어·중국어)로도 찾아보세요.';
      if (!total) return { text: '', steps: [] };
      var tbl = add(box, 'div', 'mt-w-regions');
      CCS.forEach(function (cc) { if (per[cc] == null) return; var row = add(tbl, 'div', 'mt-w-reg'); add(row, 'span', 'f', FLAG[cc] + ' ' + T.regions[cc]); add(row, 'span', 'c', n(per[cc]) + '건'); });
      hits.sort(function (a, b) { return (b.d || '').localeCompare(a.d || ''); });
      var evb = add(box, 'div', 'mt-w-evidence');
      hits.slice(0, 12).forEach(function (r) {
        var row = add(evb, 'div', 'mt-w-ev');
        add(row, 'span', 'd', (r.p === 2 ? (r.pd || '통과일 미확인') + ' ' + FLAG[r.cc] + ' 통과' : (r.d || '제출일 미확인') + ' ' + FLAG[r.cc] + ' 제출'));
        var a = add(row, safe(r.u) ? 'a' : 'span', 't', r.t);
        if (safe(r.u)) { a.href = safe(r.u); a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        if (r.st) add(row, 'span', 'm', r.st);
      });
      var steps = CCS.filter(function (cc) { return per[cc]; }).sort(function (a, b) { return per[b] - per[a]; }).map(function (cc) { var p = T.parliaments[cc]; return { lat: p.lat, lng: p.lng, cc: cc, kind: 'law', label: FLAG[cc] + ' ' + p.name + ' · 관련 법안 ' + per[cc] + '건' }; });
      if (steps.length) {
        var tb = add(box, 'div', 'mt-w-trace'); var ol = add(tb, 'ol', ''); steps.forEach(function (s) { add(ol, 'li', '', s.label); });
        var btn = add(tb, 'button', 'mt-w-go', '▶ 지도로 따라가기'); btn.type = 'button';
        traceBtns = [btn];
        btn.addEventListener('click', function () { if (timer) { clearTrace(ctx.api); setBtns('▶ 지도로 따라가기'); } else trace(ctx.api, steps, ol, btn, ctx.collapse); });
        ctx.traceBtn = btn;
      }
      add(box, 'p', 'mt-w-src', '출처: Congress.gov · 열린국회정보 · 衆議院 · 立法院 · EUR-Lex. 제목 일치만 본 것이며 내용 분석은 아님.');
      return { text: '법안 ' + n(total) + '건 · ' + CCS.filter(function (cc) { return per[cc]; }).map(function (cc) { return FLAG[cc] + ' ' + n(per[cc]); }).join(' '), steps: steps };
    });
  }

  function render(box, query, ctx) {
    ctx = ctx || {};
    clearTrace(ctx.api);
    traceBtns = [];
    box.textContent = '';
    var mini = ctx.mini;
    if (mini) mini.textContent = '🌐 세계 법안·주가 흐름 확인 중…';
    getJSON(BASE + 'topics.json').then(function (T) {
      var R = resolve(query, T);
      var done = function (res) {
        if (!mini) return;
        mini.textContent = res && res.text ? '🌐 ' + res.text : '🌐 관련 법안 흐름 없음';
        if (ctx.actions && res && res.text && !ctx.actions.querySelector('.mt-w-quick')) {
          var b = el('button', 'mt-w-quick', '🌐 흐름 보기'); b.type = 'button';
          b.addEventListener('click', function () { if (ctx.expand) ctx.expand(); box.scrollIntoView({ block: 'start' }); });
          ctx.actions.insertBefore(b, ctx.actions.firstChild);
          if (res.steps && res.steps.length) {
            var g = el('button', 'mt-w-quick', '▶ 지도로 따라가기'); g.type = 'button';
            traceBtns.push(g);
            g.addEventListener('click', function () { if (ctx.traceBtn) ctx.traceBtn.click(); });
            ctx.actions.insertBefore(g, b.nextSibling);
          }
        }
      };
      if (R.topics.length) {
        return getJSON(BASE + 'topic-' + R.topics[0].id + '.json').then(function (topic) { done(renderTopic(box, T, R, topic, ctx)); });
      }
      return renderTitles(box, T, query, R, ctx).then(done);
    }).catch(function () {
      if (mini) mini.textContent = '🌐 세계 법안·주가 자료를 불러오지 못했어요';
    });
  }

  var css = document.createElement('style');
  css.textContent = [
    '#mtResearch .mt-world{margin:10px 0 4px;padding:10px;border:1px solid #2f6f4c;border-radius:11px;background:#06160ecc}',
    '#mtResearch .mt-world-mini{font:12px/1.4 system-ui,sans-serif;color:#d9ffe6;margin:4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#mtResearch .mt-w-head{display:flex;flex-direction:column;gap:2px;margin-bottom:6px}#mtResearch .mt-w-head b{color:#f2fff4;font-size:14px}',
    '#mtResearch .mt-w-why{font-size:11px;color:#8fc9a5}',
    '#mtResearch .mt-w-regions{display:grid;gap:3px;margin:6px 0}',
    '#mtResearch .mt-w-reg{display:grid;grid-template-columns:1.2fr .8fr .8fr 1.6fr;gap:6px;font-size:12px;color:#d1ead8;padding:3px 0;border-bottom:1px dashed #1f4a30}',
    '#mtResearch .mt-w-reg.dim{opacity:.45}#mtResearch .mt-w-reg .c{color:#ffd27a;font-weight:700}#mtResearch .mt-w-reg .p{color:#7dffb0}#mtResearch .mt-w-reg .y{color:#a6c2b1}',
    '#mtResearch .mt-w-chart{width:100%;height:auto;display:block;margin-top:6px}#mtResearch .mt-w-ax{fill:#8fc9a5;font:9px ui-monospace,monospace}',
    '#mtResearch .mt-w-legend{display:flex;flex-wrap:wrap;gap:6px;font-size:10.5px;color:#a6c2b1;margin:3px 0 6px}#mtResearch .mt-w-legend span{border-left:8px solid;padding-left:4px}#mtResearch .mt-w-legend .mt-w-line{border:0;color:#f2fff4}',
    '#mtResearch .mt-w-explain h4,#mtResearch .mt-w-evidence h4,#mtResearch .mt-w-trace h4{font-size:12.5px;color:#9dffbd;margin:10px 0 4px}',
    '#mtResearch .mt-w-explain ul{margin:0;padding-left:16px}#mtResearch .mt-w-explain li{font-size:12.5px;line-height:1.6;color:#e6fbee;margin:3px 0}',
    '#mtResearch .mt-w-other{color:#bcd9c6!important}',
    '#mtResearch .mt-w-caution{font-size:11px;color:#ffd27a;border-left:3px solid #ffd27a;padding:4px 8px;margin:6px 0}',
    '#mtResearch .mt-w-ev{display:grid;gap:1px;padding:5px 0;border-top:1px solid #12301f;font-size:12px}#mtResearch .mt-w-ev .d{color:#8fc9a5;font:11px ui-monospace,monospace}',
    '#mtResearch .mt-w-ev .t{color:#e6fbee}#mtResearch .mt-w-ev a.t{color:#9beec2}#mtResearch .mt-w-ev .m{color:#a6c2b1;font-size:11px}',
    '#mtResearch .mt-w-trace ol{margin:0 0 6px;padding-left:18px;font-size:12px;color:#d1ead8}#mtResearch .mt-w-trace li.on{color:#f2fff4;font-weight:700}',
    '#mtResearch .mt-w-go{border:1px solid #4b9c65;border-radius:7px;background:#155032;color:#eaffef;padding:8px 12px;font:700 13px system-ui;cursor:pointer}',
    '#mtResearch .mt-w-src{font-size:10.5px;color:#7fa792;line-height:1.5;margin-top:8px}'
  ].join('\n');
  document.head.appendChild(css);
  window.MTWorldFlow = { render: render, resolve: resolve };
})();
