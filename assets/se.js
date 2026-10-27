/* 세금추적단 통합 검색 화면. 로직은 se-core.js. 저장된 공개 기록만 보여 주고 잘잘못을 판단하지 않는다. */
(() => {
  'use strict';
  const C = window.SECore;
  const BASE = 'data/search/se/';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mask = (s) => (typeof window.maskT === 'function' ? window.maskT(s) : s);
  const S = { core: null, vend: null, bills: null, months: [], want: 0, err: '', cityOf: null, instN: [], vendN: [], memN: [], stockN: [], p0: null };
  const out = $('#se-out'), stat = $('#se-stat'), input = $('#se-q'), form = $('#se-form');

  /* ── 불러오기 ─────────────────────────────── */
  const get = async (f) => { const r = await fetch(BASE + f, { cache: 'no-cache' }); if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); };
  const day = (d) => { const t = new Date(S.p0.getTime() + d * 864e5); return t.toISOString().slice(0, 10); };

  function prepMonth(m) {
    m.title = m.title.map(mask); // 다른 페이지와 같은 가림(지번·행사 출연자 이름)
    m.tn = m.title.map(C.norm);
    m.vnN = m.vname.map(C.normName);
    return m;
  }
  async function boot() {
    try {
      const [core, vend] = await Promise.all([get('core.json'), get('vendors.json')]);
      S.core = core; S.vend = vend; S.want = core.months.length;
      S.p0 = new Date(core.period.first + 'T00:00:00Z');
      S.cityOf = C.makeCityMatcher(core.cities);
      S.instN = core.insts.map((x) => C.normName(x[0]));
      S.vendN = vend.name.map(C.normName);
      S.memN = core.members.map((m) => [C.norm(m[1]), C.norm(m[2]), C.norm(m[3] + ' ' + m[4]), C.norm(m[5])]);
      S.stockN = core.stocks.map((s) => C.normName(s[0]));
      paintStat(); route();
      // 계약은 최신 달부터 2개씩 받으며 결과를 채운다
      const list = core.months.map((m) => m[0]);
      let next = 0, pending = 0;
      await new Promise((done) => {
        const pump = () => {
          while (pending < 2 && next < list.length) {
            const mon = list[next++]; pending++;
            get('ct-' + mon + '.json').then((m) => { S.months.push(prepMonth(m)); S.months.sort((a, b) => (a.month < b.month ? 1 : -1)); paintStat(); soon(); })
              .catch((e) => { S.err = '계약 ' + mon + ' 불러오기 실패'; console.warn(e); paintStat(); })
              .finally(() => { pending--; if (next >= list.length && !pending) done(); else pump(); });
          }
        };
        pump();
      });
      S.bills = await get('bills.json').catch(() => null);
      if (S.bills) S.bills.tn = S.bills.title.map(C.norm);
      paintStat(); soon();
    } catch (e) {
      console.warn(e);
      S.err = '검색 자료를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.';
      paintStat();
    }
  }
  function paintStat() {
    if (!S.core) { stat.textContent = S.err || '검색 자료 불러오는 중…'; return; }
    const k = S.core.counts, p = S.core.period, ready = S.months.length;
    const parts = [
      '계약 ' + k.contracts.toLocaleString('ko-KR') + '건', '업체 ' + k.vendors.toLocaleString('ko-KR') + '곳', '기관 ' + k.insts.toLocaleString('ko-KR') + '곳',
      '의원 ' + k.members + '명', '법안 ' + k.bills.toLocaleString('ko-KR') + '건', '국민연금 종목 ' + k.stocks.toLocaleString('ko-KR') + '개',
    ];
    const load = ready < S.want ? ' · 계약 ' + ready + '/' + S.want + '개월 준비 중' : (S.bills ? '' : ' · 법안 준비 중');
    stat.innerHTML = esc(parts.join(' · ')) + '<br><span class="dim">' + esc(p.first + ' ~ ' + p.last + ' 나라장터 계약 기준' + load) + '</span>' + (S.err ? '<br><span class="warn">' + esc(S.err) + '</span>' : '');
  }
  let timer = 0;
  const soon = () => { clearTimeout(timer); timer = setTimeout(route, 120); };

  /* ── 공통 조각 ─────────────────────────────── */
  const ctx = (pred) => ({ instN: S.instN, vendN: S.vendN, pred });
  const vName = (k) => (k[0] === 'v' ? S.vend.name[+k.slice(1)] : k.slice(1));
  const vRegion = (k) => (k[0] === 'v' ? S.vend.regions[S.vend.region[+k.slice(1)]] || '' : '');
  const instName = (i) => (S.core.insts[i] || [''])[0];
  const city = (i) => S.core.cities[i] || ['', '', '', '', 0, 0, 0, 0];
  const g2b = (M, r) => (M.code[r] >= 0 ? S.core.g2b_url.replace('{no}', encodeURIComponent(M.no[r])).replace('{ord}', encodeURIComponent(M.ord[r])).replace('{code}', encodeURIComponent(S.core.codes[M.code[r]])) : '');
  const link = (o, label, cls) => '<a class="' + (cls || 'go') + '" href="?o=' + encodeURIComponent(o) + '" data-o="' + esc(o) + '">' + label + '</a>';
  const loadingNote = () => (S.months.length < S.want ? '<p class="note">계약 자료 ' + S.months.length + '/' + S.want + '개월만 반영됨 · 나머지를 받는 대로 숫자가 늘어납니다</p>' : '');

  /* 흐름 그림: 왼쪽(돈을 낸 곳) → 오른쪽(받은 곳). 띠 굵기 = 금액 */
  function flowSvg(g, labL, labR, W) {
    const nL = g.left.length, nR = g.right.length;
    if (!nL || !nR) return '';
    const gap = 8, minH = 18, H = Math.max(nL, nR) * 40 + 10;
    const labW = Math.max(96, Math.min(150, Math.floor(W * 0.32))), x0 = labW + 6, x1 = W - labW - 6;
    const place = (nodes) => {
      const tot = nodes.reduce((s, n) => s + n.amount, 0) || 1, free = H - gap * (nodes.length - 1);
      const extra = nodes.length * minH > free ? 0 : free - nodes.length * minH;
      let y = 0;
      for (const n of nodes) { n.h = minH + (extra * n.amount) / tot; n.y = y; n.off = 0; y += n.h + gap; }
      return tot;
    };
    const tL = place(g.left); place(g.right);
    const iL = new Map(g.left.map((n) => [n.key, n])), iR = new Map(g.right.map((n) => [n.key, n]));
    const links = [...g.links].map(([k, a]) => { const c = k.indexOf('|'); return { a: iL.get(k.slice(0, c)), b: iR.get(k.slice(c + 1)), v: a }; }).filter((l) => l.a && l.b && l.v > 0);
    links.sort((p, q) => p.a.y - q.a.y || p.b.y - q.b.y);
    let paths = '';
    for (const l of links) {
      const ha = Math.max(1.5, (l.a.h * l.v) / l.a.amount), hb = Math.max(1.5, (l.b.h * l.v) / l.b.amount);
      const ya = l.a.y + l.a.off, yb = l.b.y + l.b.off; l.a.off += ha; l.b.off += hb;
      const m = (x0 + x1) / 2;
      paths += '<path class="band" d="M' + x0 + ',' + ya + ' C' + m + ',' + ya + ' ' + m + ',' + yb + ' ' + x1 + ',' + yb + ' L' + x1 + ',' + (yb + hb) + ' C' + m + ',' + (yb + hb) + ' ' + m + ',' + (ya + ha) + ' ' + x0 + ',' + (ya + ha) + ' Z"><title>' + esc(won(l.v)) + '</title></path>';
    }
    const node = (n, x, side, lab) => {
      const pct = tL ? Math.round((n.amount / tL) * 100) : 0;
      const tx = side === 'L' ? x - 6 : x + 10, anc = side === 'L' ? 'end' : 'start';
      return '<rect class="nd ' + side + '" x="' + (side === 'L' ? x - 4 : x) + '" y="' + n.y + '" width="4" height="' + n.h + '" rx="1"/>' +
        '<text x="' + tx + '" y="' + (n.y + n.h / 2 - 2) + '" text-anchor="' + anc + '" class="nl">' + esc(lab) + '</text>' +
        '<text x="' + tx + '" y="' + (n.y + n.h / 2 + 11) + '" text-anchor="' + anc + '" class="na">' + esc(won(n.amount) + (pct ? ' · ' + pct + '%' : '')) + '</text>';
    };
    const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
    const ch = Math.max(6, Math.floor(labW / 12.5));
    let nodes = '';
    for (const n of g.left) nodes += node(n, x0, 'L', n.key === '__rest' ? '그 밖 ' + n.rest + '곳' : cut(labL(n.key), ch));
    for (const n of g.right) nodes += node(n, x1, 'R', n.key === '__rest' ? '그 밖 ' + n.rest + '곳' : cut(labR(n.key), ch));
    return '<svg class="flow" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="돈 흐름 그림">' + paths + nodes + '</svg>';
  }
  const won = C.won;

  /* 주별 막대 */
  function weekBars(agg) {
    const weeks = Math.ceil(((new Date(S.core.period.last) - S.p0) / 864e5 + 1) / 7);
    let mx = 0; for (const [, v] of agg.week) mx = Math.max(mx, v[0]);
    if (!mx) return '';
    let bars = '';
    for (let w = 0; w < weeks; w++) {
      const v = agg.week.get(w), a = v ? v[0] : 0;
      bars += '<i style="height:' + Math.max(a ? 4 : 1, Math.round((a / mx) * 100)) + '%" title="' + esc(day(w * 7) + ' 주 · ' + won(a) + (v ? ' · ' + v[1] + '건' : '')) + '"></i>';
    }
    return '<div class="weeks"><div class="wb">' + bars + '</div><div class="wl"><span>' + esc(S.core.period.first.slice(5).replace('-', '.')) + '</span><span>주별 계약 금액</span><span>' + esc(S.core.period.last.slice(5).replace('-', '.')) + '</span></div></div>';
  }

  /* 계약 목록 */
  function rowsHtml(agg, mode, n) {
    const list = mode === 'recent' ? agg.recent : agg.top;
    let h = '';
    for (const [mi, r] of list.slice(0, n)) {
      const M = S.months[mi], vk = C.vkey(M, r), u = g2b(M, r), ci = city(M.city[r]);
      h += '<li><div class="r1"><b>' + esc(won(M.amount[r])) + '</b><span>' + esc(day(M.d[r])) + ' · ' + esc(S.core.methods[M.method[r]] || '') + (M.jv[r] ? ' · 공동도급' : '') + '</span></div>' +
        '<div class="r2">' + esc(M.title[r]) + '</div>' +
        '<div class="r3">' + link('i:' + instName(M.inst[r]), esc(instName(M.inst[r])), 'chip') + '<span class="arr">→</span>' + link('v:' + vName(vk), esc(vName(vk)), 'chip v') +
        '<span class="dim"> ' + esc(ci[2]) + '</span>' + (u ? ' <a class="src" href="' + esc(u) + '" target="_blank" rel="noopener">나라장터 원문 ↗</a>' : '') + '</div></li>';
    }
    return h;
  }
  function listBlock(agg, id) {
    if (!agg.n) return '';
    const shown = Math.min(20, agg.top.length);
    return '<section class="card"><div class="hd"><h3>계약 목록</h3><div class="seg" data-list="' + id + '"><button class="on" data-m="top">금액순</button><button data-m="recent">최신순</button></div></div>' +
      '<ul class="rows" id="' + id + '" data-n="' + shown + '" data-m="top">' + rowsHtml(agg, 'top', shown) + '</ul>' +
      (agg.n > shown ? '<button class="more" data-more="' + id + '">더 보기 (' + agg.n.toLocaleString('ko-KR') + '건 중 ' + shown + '건)</button>' : '') +
      (agg.n > agg.top.length ? '<p class="note">목록은 상위 ' + agg.top.length + '건까지 보여 줍니다. 합계·흐름은 ' + agg.n.toLocaleString('ko-KR') + '건 전체 기준.</p>' : '') + '</section>';
  }
  let lastAgg = new Map();

  /* 한눈에 + 흐름 */
  function flowBlock(agg, opt) {
    if (!agg.n) return '';
    const W = Math.min(720, out.clientWidth - 28 || 340);
    const manyCities = agg.city.size > 1 && !opt.inst;
    const g = manyCities ? C.flowGraph(agg.pairCity, agg.city, agg.vend, opt.nl || 6, opt.nr || 6) : C.flowGraph(agg.pair, agg.inst, agg.vend, opt.nl || 6, opt.nr || 6);
    const labL = manyCities ? (k) => city(+k)[2] : (k) => instName(+k);
    const lt = manyCities ? '돈을 낸 시' : '발주 기관', rt = '받은 업체';
    const topV = C.ranked(agg.vend, 1)[0], topL = manyCities ? C.ranked(agg.city, 1)[0] : C.ranked(agg.inst, 1)[0];
    const kinds = C.ranked(agg.kind).filter(([, a]) => agg.sum && a / agg.sum >= 0.005).map(([k, a]) => esc((S.core.kinds[k] || '기타') + ' ' + Math.round((a / agg.sum) * 100) + '%')).join(' · ');
    const meth = C.ranked(agg.method).sort((x, y) => y[2] - x[2]).slice(0, 4).map(([k, a, c]) => esc((S.core.methods[k] || '기타') + ' ' + c.toLocaleString('ko-KR') + '건')).join(' · ');
    return '<section class="card big"><p class="eyebrow">' + esc(opt.title) + '</p>' +
      '<div class="kpi"><div><b>' + esc(won(agg.sum)) + '</b><span>합계</span></div><div><b>' + agg.n.toLocaleString('ko-KR') + '건</b><span>계약</span></div><div><b>' + agg.vend.size.toLocaleString('ko-KR') + '곳</b><span>받은 업체</span></div><div><b>' + agg.city.size + '곳</b><span>시</span></div></div>' +
      '<p class="lead">' + (topL ? '가장 많이 낸 곳 <b>' + esc(manyCities ? city(topL[0])[2] : instName(topL[0])) + '</b> ' + esc(won(topL[1])) : '') +
      (topV ? ' · 가장 많이 받은 곳 <b>' + esc(vName(String(topV[0]))) + '</b> ' + esc(won(topV[1])) : '') + '</p>' +
      '<div class="flowhd"><span>' + lt + '</span><span>' + rt + '</span></div>' + flowSvg(g, (k) => C.shortName(labL(k)), (k) => C.shortName(vName(k)), W) +
      weekBars(agg) + '<p class="meta">' + kinds + '<br>' + meth + '</p>' + loadingNote() + '</section>';
  }

  /* ── 검색 결과 ─────────────────────────────── */
  function searchView(q) {
    const qp = C.parse(q, S.cityOf);
    if (!qp.toks.length && !qp.cities.size) {
      return '<section class="card empty"><h3>검색어를 조금 더 알려 주세요</h3><p>글자 두 개 이상의 이름이나 낱말을 넣어 주세요. 예: 하수관로, 포항, 삼성전자</p></section>' + homeView();
    }
    const top = (arr, score, k) => arr.map((x, i) => [i, score(x, i)]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, k);
    const sc = (n) => C.nameScore(n, qp.whole, qp.toks);
    let html = '';

    const cityHits = [...qp.cities];
    if (!cityHits.length) S.core.cities.forEach((c, i) => { if (sc(C.normName(c[1])) >= 48 || sc(C.normName(c[2])) >= 48) cityHits.push(i); });
    const vend = top(S.vendN, (n, i) => { const s = sc(n); return s ? s + Math.log10(1 + S.vend.total[i]) : 0; }, 8);
    const inst = top(S.instN, (n, i) => { const s = sc(n); return s ? s + Math.log10(1 + S.core.insts[i][2]) : 0; }, 6);
    const memScore = (m) => Math.max(C.nameScore(m[0], qp.whole, qp.toks), m[1] === qp.whole ? 60 : 0, qp.whole.length >= 2 && m[2].includes(qp.whole) ? 40 : 0, qp.whole.length >= 3 && m[3].includes(qp.whole) ? 35 : 0);
    const memAll = S.memN.filter((m) => memScore(m) > 0).length;
    const mem = top(S.memN, memScore, 12);
    const stocks = top(S.stockN, (n, i) => { const s = sc(n); return s ? s + (S.core.stocks[i][1] === 'kr' ? 1 : 0) : 0; }, 6);
    const news = S.core.news.map((n, i) => [i, qp.toks.length && qp.toks.every((t) => C.norm(n[1] + n[4]).includes(t)) ? 1 : 0]).filter((x) => x[1]);
    let bills = [];
    if (S.bills && qp.toks.length && !qp.cities.size) { // 법안은 시와 무관하므로 시를 지정한 검색에서는 뺀다
      const B = S.bills, memIdx = mem.filter((m) => m[1] >= 72).map((m) => m[0]);
      for (let i = 0; i < B.tn.length && bills.length < 300; i++) {
        if (qp.toks.every((t) => B.tn[i].includes(t)) || memIdx.includes(B.member[i])) bills.push(i);
      }
    }

    // 계약 흐름
    const agg = S.months.length ? C.scan(S.months, qp, ctx()) : null;
    if (agg) lastAgg.set('main', agg);
    if (agg && agg.n) html += flowBlock(agg, { title: '‘' + qp.raw + '’ 공개 계약 흐름' });
    else if (!S.months.length) html += '<section class="card"><p class="note">계약 자료를 받는 중이에요…</p></section>';

    const group = (title, items) => (items ? '<section class="card"><h3>' + title + '</h3><ul class="ents">' + items + '</ul></section>' : '');
    html += group('업체', vend.map(([i]) => '<li>' + link('v:' + S.vend.name[i], '<b>' + esc(S.vend.name[i]) + '</b><span>' + esc((S.vend.regions[S.vend.region[i]] || '') + ' · ' + won(S.vend.total[i]) + ' · ' + S.vend.count[i] + '건') + '</span>') + '</li>').join(''));
    html += group('발주 기관', inst.map(([i]) => { const x = S.core.insts[i]; return '<li>' + link('i:' + x[0], '<b>' + esc(x[0]) + '</b><span>' + esc(won(x[2]) + ' · ' + x[3].toLocaleString('ko-KR') + '건') + '</span>') + '</li>'; }).join(''));
    html += group('시', cityHits.slice(0, 6).map((i) => { const c = city(i); return '<li>' + link('c:' + c[0], '<b>' + esc(c[2]) + '</b><span>' + esc('본청 ' + won(c[4]) + ' · 산하기관 포함 ' + won(c[4] + c[6])) + '</span>') + '</li>'; }).join(''));
    html += group('국회의원' + (memAll > mem.length ? ' <small>' + memAll + '명 중 ' + mem.length + '명</small>' : ''), mem.map(([i]) => { const m = S.core.members[i]; return '<li>' + link('m:' + m[0], '<b>' + esc(m[1]) + '</b><span>' + esc(m[2] + ' · ' + m[3] + ' · 대표 발의 ' + m[6] + '건') + '</span>') + '</li>'; }).join(''));
    html += group('국민연금 보유 종목', stocks.map(([i]) => { const s = S.core.stocks[i]; return '<li>' + link('s:' + s[0], '<b>' + esc(s[0]) + '</b><span>' + esc((s[1] === 'kr' ? '국내' : '미국') + ' · 평가액 ' + won((s[2] || 0) * 1e8) + (s[4] != null ? ' · 지분 ' + s[4] + '%' : '')) + '</span>') + '</li>'; }).join(''));
    if (bills.length) {
      const B = S.bills;
      html += '<section class="card"><h3>법안 <small>' + bills.length + (bills.length >= 300 ? '+' : '') + '건</small></h3><ul class="ents">' + bills.slice(0, 8).map((i) => {
        const m = S.core.members[B.member[i]] || [];
        return '<li><a class="go" href="' + esc(B.bill_url + B.id[i]) + '" target="_blank" rel="noopener"><b>' + esc(B.title[i]) + '</b><span>' + esc(B.date[i] + ' · ' + (B.result[i] || '계류') + ' · 대표 발의 ' + (m[1] || '') + ' ↗') + '</span></a></li>';
      }).join('') + '</ul></section>';
    }
    html += group('세금추적단 기사', news.map(([i]) => { const n = S.core.news[i]; return '<li><a class="go" href="article.html?id=' + encodeURIComponent(n[0]) + '"><b>' + esc(n[1]) + '</b><span>' + esc(n[2]) + '</span></a></li>'; }).join(''));
    if (agg && agg.n) html += listBlock(agg, 'main');

    if (!html.replace(/<section class="card"><p class="note">계약 자료를 받는 중이에요…<\/p><\/section>/, '')) {
      html += '<section class="card empty"><h3>저장된 자료에서 찾지 못했어요</h3><p>‘' + esc(qp.raw) + '’와 맞는 계약·업체·기관·의원·법안·종목이 없습니다.</p><ul class="tips"><li>더 짧게: ‘하수관로정비공사’ → ‘하수관로’</li><li>업체는 상호만: ‘(주)OO건설’ → ‘OO건설’</li><li>시 + 낱말: ‘포항 도로’</li></ul>' +
        (S.months.length < S.want || !S.bills ? '<p class="note">아직 받는 중인 자료가 있어요. 잠시 뒤 결과가 바뀔 수 있습니다.</p>' : '') +
        '<p class="note">이 검색은 저장된 공개 기록(' + esc(S.core.period.first + '~' + S.core.period.last) + ' 계약, 22대 국회 대표 발의, 국민연금 공시)만 찾습니다. 실시간 뉴스·주가는 없습니다.</p></section>';
    }
    return html;
  }

  /* ── 하나 자세히 ─────────────────────────────── */
  function detailView(o) {
    const t = o.slice(0, 1), key = o.slice(2);
    const back = '<button class="back" type="button" data-back>‹ 검색 결과</button>';
    const none = (what) => back + '<section class="card empty"><h3>' + esc(what) + ' 정보를 찾지 못했어요</h3></section>';
    const qpAll = { raw: '', whole: '', toks: [], cities: new Set() };
    if (t === 'v') {
      const nk = C.normName(key);
      const idxs = []; S.vendN.forEach((n, i) => { if (S.vend.name[i] === key || (n && n === nk)) idxs.push(i); });
      const isName = !idxs.length;
      const agg = S.months.length ? C.scan(S.months, qpAll, ctx((M, r) => (M.vendor[r] >= 0 ? idxs.includes(M.vendor[r]) : isName && M.vname[r] === key))) : null;
      if (!idxs.length && !(agg && agg.n)) return none('업체');
      lastAgg.set('d', agg);
      const i0 = idxs[0], region = i0 != null ? S.vend.regions[S.vend.region[i0]] : '';
      const corpId = i0 != null ? S.vend.corp_file[String(i0)] : null;
      const stock = S.core.stocks.find((s) => C.sameCompany(s[0], key));
      let h = back + '<section class="card head"><p class="eyebrow">업체</p><h2>' + esc(key) + '</h2><p class="sub">' + esc(region) + (idxs.length > 1 ? ' · 같은 이름 ' + idxs.length + '곳 합산' : '') + '</p><div id="corp"></div>' +
        (stock ? '<p class="xref">국민연금 보유 종목과 이름이 같아요: ' + link('s:' + stock[0], esc(stock[0]) + ' 보기') + '</p>' : '') +
        (corpId ? '<p class="links"><a href="vendor.html?v=' + encodeURIComponent(corpId) + '">업체 상세 화면 ›</a></p>' : '') + '</section>';
      h += flowBlock(agg || { n: 0 }, { title: '누가 이 업체에 계약을 줬나', inst: true }) + listBlock(agg || { n: 0 }, 'd');
      if (corpId) setTimeout(() => corpInfo(corpId), 0);
      return h;
    }
    if (t === 'i') {
      const ii = S.core.insts.findIndex((x) => x[0] === key);
      if (ii < 0) return none('기관');
      const agg = S.months.length ? C.scan(S.months, qpAll, ctx((M, r) => M.inst[r] === ii)) : null;
      lastAgg.set('d', agg);
      const x = S.core.insts[ii], c = city(x[1]);
      return back + '<section class="card head"><p class="eyebrow">발주 기관</p><h2>' + esc(x[0]) + '</h2><p class="sub">' + esc(c[2]) + '</p><p class="links"><a href="city.html?c=' + encodeURIComponent(c[0]) + '">' + esc(c[2]) + ' 화면 ›</a></p></section>' +
        flowBlock(agg || { n: 0 }, { title: '이 기관의 돈이 간 곳', inst: true, nl: 1, nr: 8 }) + listBlock(agg || { n: 0 }, 'd');
    }
    if (t === 'c') {
      const ci = S.core.cities.findIndex((c) => c[0] === key);
      if (ci < 0) return none('시');
      const c = city(ci);
      const agg = S.months.length ? C.scan(S.months, qpAll, ctx((M, r) => M.city[r] === ci)) : null;
      lastAgg.set('d', agg);
      // 업체 소재지가 같은 시인지 (업체 사업자 등록 주소 기준)
      let local = 0;
      if (agg) {
        const stem = c[1].replace(/(특별자치시|특별시|광역시|시)$/, '');
        for (const [k, v] of agg.vend) if (vRegion(k).includes(stem)) local += v[0];
      }
      return back + '<section class="card head"><p class="eyebrow">시</p><h2>' + esc(c[2]) + '</h2><p class="sub">' + esc('본청 ' + won(c[4]) + ' (' + c[5].toLocaleString('ko-KR') + '건) · 산하기관 ' + won(c[6]) + ' (' + c[7].toLocaleString('ko-KR') + '건)') + '</p>' +
        (agg && agg.sum ? '<p class="xref">업체 사업자 주소가 ' + esc(c[2]) + '인 곳에 간 돈 <b>' + Math.round((local / agg.sum) * 100) + '%</b> · 그 밖 지역 ' + Math.round(((agg.sum - local) / agg.sum) * 100) + '%</p>' : '') +
        '<p class="links"><a href="city.html?c=' + encodeURIComponent(c[0]) + '">' + esc(c[2]) + ' 지도·자세히 ›</a></p></section>' +
        flowBlock(agg || { n: 0 }, { title: esc(c[2]) + ' 기관 → 업체', inst: true }) + listBlock(agg || { n: 0 }, 'd');
    }
    if (t === 'm') {
      const mi = S.core.members.findIndex((m) => m[0] === key);
      if (mi < 0) return none('국회의원');
      const m = S.core.members[mi];
      let bl = '';
      if (S.bills) {
        const B = S.bills, res = new Map(); let n = 0;
        for (let i = 0; i < B.title.length; i++) if (B.member[i] === mi) { n++; const r = B.result[i] || '계류'; res.set(r, (res.get(r) || 0) + 1); if (n <= 30) bl += '<li><a class="go" href="' + esc(B.bill_url + B.id[i]) + '" target="_blank" rel="noopener"><b>' + esc(B.title[i]) + '</b><span>' + esc(B.date[i] + ' · ' + (B.result[i] || '계류') + ' ↗') + '</span></a></li>'; }
        const rs = [...res].sort((a, b) => b[1] - a[1]).map(([k, v]) => esc(k + ' ' + v)).join(' · ');
        bl = '<section class="card"><h3>대표 발의 법안 <small>' + n + '건</small></h3><p class="meta">' + rs + '</p><ul class="ents">' + bl + '</ul>' + (n > 30 ? '<p class="note">최근 30건만 보여 줍니다.</p>' : '') + '</section>';
      } else bl = '<section class="card"><p class="note">법안 자료를 받는 중이에요…</p></section>';
      return back + '<section class="card head"><p class="eyebrow">국회의원 · 22대</p><h2>' + esc(m[1]) + '</h2><p class="sub">' + esc(m[2] + ' · ' + m[3] + (m[4] ? ' · ' + m[4] : '')) + '</p>' +
        '<p class="meta">' + esc(m[5]) + '<br>국외 출장 기록 ' + m[7] + '건 · 대표 발의 ' + m[6] + '건</p>' +
        '<p class="links"><a href="national.html?mp=' + encodeURIComponent(m[1]) + '">국회 추적실에서 표결·출장·징계안 보기 ›</a></p></section>' + bl;
    }
    if (t === 's') {
      const s = S.core.stocks.find((x) => x[0] === key);
      if (!s) return none('종목');
      const vi = []; S.vend.name.forEach((n, i) => { if (C.sameCompany(n, s[0])) vi.push(i); });
      const agg = vi.length && S.months.length ? C.scan(S.months, qpAll, ctx((M, r) => vi.includes(M.vendor[r]))) : null;
      if (agg) lastAgg.set('d', agg);
      return back + '<section class="card head"><p class="eyebrow">국민연금 보유 종목 · ' + (s[1] === 'kr' ? '국내 주식' : '미국 주식(13F)') + '</p><h2>' + esc(s[0]) + '</h2>' +
        '<div class="kpi"><div><b>' + esc(won((s[2] || 0) * 1e8)) + '</b><span>평가액</span></div>' + (s[3] != null ? '<div><b>' + s[3] + '%</b><span>국내 주식 중 비중</span></div>' : '') + (s[4] != null ? '<div><b>' + s[4] + '%</b><span>지분율</span></div>' : '') + '</div>' +
        '<p class="meta">기준 ' + esc(s[5]) + (s[6] ? ' · <a href="' + esc(s[6]) + '" target="_blank" rel="noopener">공시 원문 ↗</a>' : '') + '</p><p class="links"><a href="nps.html">국민연금 화면 ›</a></p></section>' +
        (agg && agg.n ? flowBlock(agg, { title: '같은 이름 업체가 받은 정부 계약', inst: true }) + listBlock(agg, 'd') : '<section class="card"><h3>같은 이름 업체의 정부 계약</h3><p class="note">같은 이름으로 85개 시와 맺은 계약은 저장된 기간(' + esc(S.core.period.first + '~' + S.core.period.last) + ')에 없습니다.</p></section>') +
        similarVendors(s[0], vi);
    }
    return none('검색');
  }

  /* 이름에 종목 이름이 들어간 다른 업체 (계열사·대리점일 수도, 전혀 다른 회사일 수도 있다) */
  function similarVendors(name, exclude) {
    const n = C.normName(name);
    if (n.length < 2) return '';
    const hits = [];
    S.vendN.forEach((v, i) => { if (v !== n && v.includes(n) && !exclude.includes(i)) hits.push(i); });
    if (!hits.length) return '';
    hits.sort((a, b) => S.vend.total[b] - S.vend.total[a]);
    return '<section class="card"><h3>이름에 ‘' + esc(name) + '’가 들어간 업체 <small>' + hits.length + '곳</small></h3><p class="note">이름만 비슷할 뿐 같은 회사가 아닐 수 있습니다.</p><ul class="ents">' +
      hits.slice(0, 8).map((i) => '<li>' + link('v:' + S.vend.name[i], '<b>' + esc(S.vend.name[i]) + '</b><span>' + esc((S.vend.regions[S.vend.region[i]] || '') + ' · ' + won(S.vend.total[i]) + ' · ' + S.vend.count[i] + '건') + '</span>') + '</li>').join('') + '</ul></section>';
  }
  async function corpInfo(id) {
    try {
      const r = await fetch('data/vendor/' + encodeURIComponent(id) + '.json', { cache: 'no-cache' });
      if (!r.ok) return;
      const v = await r.json(), c = v.corp;
      const el = $('#corp'); if (!el || !c) return;
      const inds = (c.inds || []).slice(0, 3).map((x) => x.n).join(', ');
      el.innerHTML = '<p class="meta">' + esc([c.opbiz ? '개업 ' + c.opbiz : '', c.emp != null ? '직원 ' + c.emp + '명' : '', c.bsns || '', inds].filter(Boolean).join(' · ')) + '<br><span class="dim">조달청 업체 등록 정보</span></p>';
    } catch (e) { /* 회사 정보가 없어도 흐름은 그대로 */ }
  }

  /* ── 주소·화면 ─────────────────────────────── */
  function route() {
    if (!S.core) return;
    const p = new URLSearchParams(location.search), q = (p.get('q') || '').trim(), o = p.get('o') || '';
    if (document.activeElement !== input) input.value = q || (o ? '' : input.value);
    lastAgg = new Map();
    document.body.classList.toggle('has-q', !!(q || o));
    if (o && /^[vicms]:/.test(o)) { out.innerHTML = detailView(o); document.title = o.slice(2) + ' · 통합 검색 · 세금추적단'; return; }
    if (q) { out.innerHTML = searchView(q); document.title = q + ' · 통합 검색 · 세금추적단'; return; }
    out.innerHTML = homeView();
    document.title = '통합 검색 · 세금추적단';
  }
  function homeView() {
    const ex = ['포항', '하수관로', '청소', 'CCTV', '보도블록', '삼성전자', '전세사기', '국토교통위원회'];
    return '<section class="card"><h3>이렇게 찾아보세요</h3><div class="ex">' + ex.map((x) => '<a href="?q=' + encodeURIComponent(x) + '" data-q="' + esc(x) + '">' + esc(x) + '</a>').join('') + '</div>' +
      '<ul class="tips"><li><b>업체·기관·시</b> 이름 → 누가 누구에게 얼마를 줬는지 흐름</li><li><b>계약 낱말</b>(하수관로, 청소, CCTV) → 어느 시가 어느 업체에</li><li><b>시 + 낱말</b>(포항 도로) → 그 시 안에서만</li><li><b>의원·위원회·법안 낱말</b> → 대표 발의 기록</li><li><b>회사 이름</b> → 국민연금 보유와 정부 계약을 한 번에</li></ul>' +
      '<p class="note">공개 기록을 모아 보여 줄 뿐 잘잘못을 판단하지 않습니다. 금액은 사이트 공통 기준(장기계속은 이번 차수 금액). 원문은 나라장터·국회 의안정보시스템·국민연금 공시에서 확인하세요.</p></section>';
  }
  const go = (params) => { const u = new URL(location.href); u.search = ''; for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v); history.pushState(null, '', u); route(); window.scrollTo(0, 0); };

  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (q) { go({ q }); input.blur(); } });
  let typing = 0;
  input.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => { const q = input.value.trim(); if (q.length >= 2) { const u = new URL(location.href); u.search = ''; u.searchParams.set('q', q); history.replaceState(null, '', u); route(); } }, 260); });
  addEventListener('popstate', route);
  let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(route, 200); });
  out.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-o]');
    if (a) { e.preventDefault(); go({ o: a.dataset.o }); return; }
    const ex = e.target.closest('a[data-q]');
    if (ex) { e.preventDefault(); input.value = ex.dataset.q; go({ q: ex.dataset.q }); return; }
    if (e.target.closest('[data-back]')) { if (history.length > 1) history.back(); else go({}); return; }
    const seg = e.target.closest('.seg button');
    if (seg) {
      const box = seg.parentElement, id = box.dataset.list, ul = document.getElementById(id), agg = lastAgg.get(id);
      if (!ul || !agg) return;
      box.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === seg));
      ul.dataset.m = seg.dataset.m; ul.innerHTML = rowsHtml(agg, ul.dataset.m, +ul.dataset.n);
      return;
    }
    const more = e.target.closest('[data-more]');
    if (more) {
      const id = more.dataset.more, ul = document.getElementById(id), agg = lastAgg.get(id);
      if (!ul || !agg) return;
      const n = Math.min(agg.top.length, +ul.dataset.n + 30);
      ul.dataset.n = n; ul.innerHTML = rowsHtml(agg, ul.dataset.m, n);
      more.textContent = n >= agg.top.length ? '여기까지 (' + n + '건)' : '더 보기 (' + agg.n.toLocaleString('ko-KR') + '건 중 ' + n + '건)';
      if (n >= agg.top.length) more.disabled = true;
    }
  });

  paintStat();
  boot();
})();
