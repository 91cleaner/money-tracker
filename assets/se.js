/* 세금추적단 통합 검색 화면. 로직은 se-core.js. 저장된 공개 기록만 보여 주고 잘잘못을 판단하지 않는다.
 * 합계는 사이트와 같은 기준(시청 계약). 시청 외 기관(구청·공단 등)은 따로 보여 주고 ?ext=1 일 때만 더한다. */
(() => {
  'use strict';
  const C = window.SECore;
  const BASE = 'data/search/se/';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https:\/\//i.test(String(u || '')) ? String(u) : '');
  const mask = (s) => (typeof window.maskT === 'function' ? window.maskT(s) : s);
  const S = { core: null, vend: null, bills: null, months: [], want: 0, err: '', cityOf: null, instN: [], vendN: [], memN: [], stockN: [], p0: null, build: '' };
  const out = $('#se-out'), stat = $('#se-stat'), input = $('#se-q'), form = $('#se-form');
  const won = C.won;

  /* ── 불러오기 ─────────────────────────────── */
  // core 를 먼저 받고, 나머지는 같은 build 로 받는다(빌드마다 업체 번호가 바뀌므로 섞이면 안 됨)
  const get = async (f, b) => { const r = await fetch(BASE + f + (b ? '?b=' + encodeURIComponent(b) : ''), { cache: b ? 'default' : 'no-cache' }); if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); };
  const sameBuild = (x, f) => { if (x && x.build && S.build && x.build !== S.build) throw new Error(f + ' build ' + x.build + ' != ' + S.build); return x; };
  const day = (d) => new Date(S.p0.getTime() + d * 864e5).toISOString().slice(0, 10);

  function prepMonth(m) {
    m.title = m.title.map(mask); // 다른 페이지와 같은 가림(지번·행사 출연자 이름)
    m.tn = m.title.map(C.norm);
    m.vnN = m.vname.map(C.normName);
    if (!m.jvs) m.jvs = [];
    const ctx = { instN: S.instN, vendN: S.vendN };
    m.st = new Array(m.n);
    for (let r = 0; r < m.n; r++) m.st[r] = C.searchText(m, r, ctx); // 한 번 합쳐 두면 입력할 때 빠르다
    return m;
  }
  async function boot() {
    try {
      const core = await get('core.json');
      S.core = core; S.build = core.build || ''; S.want = core.months.length;
      const vend = sameBuild(await get('vendors.json', S.build), 'vendors.json');
      S.vend = vend;
      S.p0 = new Date(core.period.first + 'T00:00:00Z');
      S.cityOf = C.makeCityMatcher(core.cities);
      S.instN = core.insts.map((x) => C.normName(x[0]));
      S.vendN = vend.name.map(C.normName);
      S.memN = core.members.map((m) => [C.norm(m[1]), C.norm(m[2]), C.norm(m[3] + ' ' + m[4]), C.norm(m[5])]);
      S.stockN = core.stocks.map((s) => C.normName(s[0]));
      paintStat(); route();
      const list = core.months.map((m) => m[0]);
      let next = 0, pending = 0;
      await new Promise((done) => {
        const pump = () => {
          while (pending < 2 && next < list.length) {
            const mon = list[next++]; pending++;
            get('ct-' + mon + '.json', S.build).then((m) => { sameBuild(m, mon); S.months.push(prepMonth(m)); S.months.sort((a, b) => (a.month < b.month ? 1 : -1)); paintStat(); soon(); })
              .catch((e) => { S.err = '계약 ' + mon + ' 자료를 불러오지 못했어요. 새로고침해 주세요.'; console.warn(e); paintStat(); })
              .finally(() => { pending--; if (next >= list.length && !pending) done(); else pump(); });
          }
        };
        pump();
      });
      S.bills = await get('bills.json', S.build).then((b) => sameBuild(b, 'bills.json')).catch(() => null);
      if (S.bills) S.bills.tn = S.bills.title.map(C.norm);
      paintStat(); soon();
    } catch (e) {
      console.warn(e);
      S.err = '검색 자료를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.';
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
    stat.innerHTML = esc(parts.join(' · ')) + '<br><span class="dim">' + esc(p.first + ' ~ ' + p.last + ' 나라장터 계약 · ' + k.cities + '개 시' + load) + '</span>' + (S.err ? '<br><span class="warn">' + esc(S.err) + '</span>' : '');
  }
  let timer = 0;
  const soon = () => { clearTimeout(timer); timer = setTimeout(route, 120); };

  /* ── 공통 조각 ─────────────────────────────── */
  const extOn = () => new URLSearchParams(location.search).get('ext') === '1';
  const ctx = (pred, more) => Object.assign({ instN: S.instN, vendN: S.vendN, pred, ext: extOn() }, more || {});
  const vName = (k) => (k[0] === 'v' ? S.vend.name[+k.slice(1)] : k.slice(1));
  const vRegion = (k) => (k[0] === 'v' ? S.vend.regions[S.vend.region[+k.slice(1)]] || '' : '');
  const vRef = (k) => vName(k) + '|' + vRegion(k); // 같은 이름의 다른 회사를 섞지 않도록 이름+소재지로 연결
  const instName = (i) => (S.core.insts[i] || [''])[0];
  const city = (i) => S.core.cities[i] || ['', '', '', '', 0, 0, 0, 0, null];
  const g2b = (M, r) => (M.code[r] >= 0 ? S.core.g2b_url.replace('{no}', encodeURIComponent(M.no[r])).replace('{ord}', encodeURIComponent(M.ord[r])).replace('{code}', encodeURIComponent(S.core.codes[M.code[r]])) : '');
  const link = (o, label, cls) => '<a class="' + (cls || 'go') + '" href="?o=' + encodeURIComponent(o) + '" data-o="' + esc(o) + '">' + label + '</a>';
  const vLink = (k, label, cls) => (C.masked(vName(k)) ? '<span class="' + (cls || 'go') + ' nolink" title="개인사업자는 이름을 가려서 서로 다른 사람을 하나로 묶지 않습니다">' + label + '</span>' : link('v:' + vRef(k), label, cls));
  const loadingNote = () => (S.months.length < S.want ? '<p class="note">계약 자료 ' + S.months.length + '/' + S.want + '개월만 반영됨 · 나머지를 받는 대로 숫자가 늘어납니다</p>' : '');
  const extToggle = (agg) => {
    if (extOn()) return '<p class="note">시청 외 기관(구청·공단 등) 계약을 <b>더한</b> 숫자입니다. 업체·시 화면 합계는 시청 계약만 셉니다. <a href="#" data-ext="0">시청 계약만 보기</a></p>';
    if (!agg || !agg.extN) return '';
    return '<p class="note">시청 외 기관(구청·공단 등) 계약 ' + agg.extN.toLocaleString('ko-KR') + '건 ' + esc(won(agg.extSum)) + '은 위 합계에 들어가지 않았어요(시 화면과 같은 기준). <a href="#" data-ext="1">포함해서 보기</a></p>';
  };

  /* 흐름 그림: 왼쪽(발주) → 오른쪽(계약 업체). 띠 굵기 = 계약 금액 */
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
    return '<svg class="flow" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="계약 금액 흐름 그림">' + paths + nodes + '</svg>';
  }

  /* 주별 막대: 마지막 주가 며칠뿐이면 흐리게(진행 중) */
  function weekBars(agg) {
    const days = Math.round((new Date(S.core.period.last + 'T00:00:00Z') - S.p0) / 864e5) + 1;
    const weeks = Math.ceil(days / 7), lastDays = days - (weeks - 1) * 7;
    let mx = 0; for (const [, v] of agg.week) mx = Math.max(mx, v[0]);
    if (!mx) return '';
    let bars = '';
    for (let w = 0; w < weeks; w++) {
      const v = agg.week.get(w), a = v ? v[0] : 0, part = w === weeks - 1 && lastDays < 7;
      bars += '<i class="' + (part ? 'part' : '') + '" style="height:' + Math.max(a ? 4 : 1, Math.round((a / mx) * 100)) + '%" title="' + esc(day(w * 7) + ' 주' + (part ? '(진행 중 ' + lastDays + '일)' : '') + ' · ' + won(a) + (v ? ' · ' + v[1] + '건' : '')) + '"></i>';
    }
    return '<div class="weeks"><div class="wb">' + bars + '</div><div class="wl"><span>' + esc(S.core.period.first.slice(5).replace('-', '.')) + '</span><span>주별 계약 금액' + (lastDays < 7 ? ' · 마지막 주는 ' + lastDays + '일치' : '') + '</span><span>' + esc(S.core.period.last.slice(5).replace('-', '.')) + '</span></div></div>';
  }

  /* 계약 목록 */
  function rowsHtml(agg, mode, n) {
    const list = mode === 'recent' ? agg.recent : agg.top;
    let h = '';
    for (const [mi, r, a] of list.slice(0, n)) {
      const M = S.months[mi], ps = C.parts(M, r), u = safeUrl(g2b(M, r)), ci = city(M.city[r]);
      const vs = ps.map(([v]) => C.vkeyOf(M, r, v));
      const jvNote = ps.length > 1 ? ' · 공동도급 ' + ps.length + '곳(전체 ' + won(M.amount[r]) + ')' : '';
      h += '<li><div class="r1"><b>' + esc(won(a)) + '</b><span>' + esc(day(M.d[r]) + ' · ' + (S.core.methods[M.method[r]] || '') + jvNote) + '</span></div>' +
        '<div class="r2">' + esc(M.title[r]) + '</div>' +
        '<div class="r3">' + link('i:' + instName(M.inst[r]), esc(instName(M.inst[r])), 'chip') + '<span class="arr">→</span>' + vs.map((k) => vLink(k, esc(vName(k)), 'chip v')).join('') +
        '<span class="dim"> ' + esc(ci[2]) + (M.ext[r] ? ' · 시청 외 기관' : '') + '</span>' + (u ? ' <a class="src" href="' + esc(u) + '" target="_blank" rel="noopener">나라장터 원문 ↗</a>' : '') + '</div></li>';
    }
    return h;
  }
  let lastAgg = new Map();
  function listBlock(agg, id) {
    if (!agg || !agg.n) return '';
    lastAgg.set(id, agg);
    const shown = Math.min(20, agg.top.length);
    return '<section class="card"><div class="hd"><h3>계약 목록</h3><div class="seg" data-list="' + id + '"><button class="on" data-m="top">금액순</button><button data-m="recent">최신순</button></div></div>' +
      '<ul class="rows" id="' + id + '" data-n="' + shown + '" data-m="top">' + rowsHtml(agg, 'top', shown) + '</ul>' +
      (agg.n > shown ? '<button class="more" data-more="' + id + '">더 보기 (' + agg.n.toLocaleString('ko-KR') + '건 중 ' + shown + '건)</button>' : '') +
      (agg.n > agg.top.length ? '<p class="note">목록은 상위 ' + agg.top.length + '건까지 보여 줍니다. 합계·흐름은 ' + agg.n.toLocaleString('ko-KR') + '건 전체 기준.</p>' : '') + '</section>';
  }

  /* 한눈에 + 흐름 */
  function flowBlock(agg, opt) {
    if (!agg) return '';
    if (!agg.n) return agg.extN ? '<section class="card"><h3>' + esc(opt.title) + '</h3><p class="note">시청 계약은 없어요.</p>' + extToggle(agg) + '</section>' : '';
    const W = Math.min(720, out.clientWidth - 28 || 340);
    const manyCities = agg.city.size > 1 && !opt.inst;
    const g = manyCities ? C.flowGraph(agg.pairCity, agg.city, agg.vend, opt.nl || 6, opt.nr || 6) : C.flowGraph(agg.pair, agg.inst, agg.vend, opt.nl || 6, opt.nr || 6);
    const labL = manyCities ? (k) => city(+k)[2] : (k) => instName(+k);
    const lt = manyCities ? '발주한 시' : '발주 기관', rt = '계약 업체';
    const topV = C.ranked(agg.vend, 1)[0], topL = manyCities ? C.ranked(agg.city, 1)[0] : C.ranked(agg.inst, 1)[0];
    const kinds = C.ranked(agg.kind).filter(([, a]) => agg.sum && a / agg.sum >= 0.005).map(([k, a]) => esc((S.core.kinds[k] || '기타') + ' ' + Math.round((a / agg.sum) * 100) + '%')).join(' · ');
    const meth = C.ranked(agg.method).sort((x, y) => y[2] - x[2]).slice(0, 4).map(([k, , c]) => esc((S.core.methods[k] || '기타') + ' ' + c.toLocaleString('ko-KR') + '건')).join(' · ');
    return '<section class="card big"><p class="eyebrow">' + esc(opt.title) + '</p>' +
      '<div class="kpi"><div><b>' + esc(won(agg.sum)) + '</b><span>계약 금액 합계</span></div><div><b>' + agg.n.toLocaleString('ko-KR') + '건</b><span>계약</span></div><div><b>' + agg.vend.size.toLocaleString('ko-KR') + '곳</b><span>계약 업체</span></div><div><b>' + agg.city.size + '곳</b><span>시</span></div></div>' +
      '<p class="lead">' + (topL ? '금액이 가장 큰 발주처 <b>' + esc(manyCities ? city(topL[0])[2] : instName(topL[0])) + '</b> ' + esc(won(topL[1])) : '') +
      (topV ? ' · 가장 큰 업체 <b>' + esc(vName(String(topV[0]))) + '</b> ' + esc(won(topV[1])) : '') + '</p>' +
      '<div class="flowhd"><span>' + lt + '</span><span>' + rt + '</span></div>' + flowSvg(g, (k) => C.shortName(labL(k)), (k) => C.shortName(vName(k)), W) +
      weekBars(agg) + '<p class="meta">' + kinds + '<br>' + meth + '</p>' + extToggle(agg) + loadingNote() + '</section>';
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
    const vend = top(S.vendN, (n, i) => { const s = sc(n); return s ? s + Math.log10(1 + S.vend.total[i] + S.vend.ext_total[i]) : 0; }, 8);
    const inst = top(S.instN, (n, i) => { const s = sc(n); return s ? s + Math.log10(1 + S.core.insts[i][2]) : 0; }, 6);
    const memScore = (m) => Math.max(C.nameScore(m[0], qp.whole, qp.toks), m[1] === qp.whole ? 60 : 0, qp.whole.length >= 2 && m[2].includes(qp.whole) ? 40 : 0, qp.whole.length >= 3 && m[3].includes(qp.whole) ? 35 : 0);
    const memAll = S.memN.filter((m) => memScore(m) > 0).length;
    const mem = top(S.memN, memScore, 12);
    const stocks = top(S.stockN, (n, i) => { const s = sc(n); return s ? s + (S.core.stocks[i][1] === 'kr' ? 1 : 0) : 0; }, 6);
    const news = S.core.news.map((n, i) => [i, qp.toks.length && qp.toks.every((t) => C.norm(n[1] + n[4]).includes(t)) ? 1 : 0]).filter((x) => x[1]);
    let bills = [];
    if (S.bills && qp.toks.length && !qp.cities.size) { // 법안은 시와 무관하므로 시를 지정한 검색에서는 뺀다
      const B = S.bills, memIdx = new Set(mem.filter((m) => m[1] >= 72).map((m) => m[0]));
      for (let i = 0; i < B.tn.length && bills.length < 300; i++) {
        if (qp.toks.every((t) => B.tn[i].includes(t)) || memIdx.has(B.member[i])) bills.push(i);
      }
    }

    const agg = S.months.length ? C.scan(S.months, qp, ctx()) : null;
    if (agg && (agg.n || agg.extN)) html += flowBlock(agg, { title: '‘' + qp.raw + '’ 공개 계약 흐름' });
    else if (!S.months.length) html += '<section class="card"><p class="note">계약 자료를 받는 중이에요…</p></section>';

    const group = (title, items) => (items ? '<section class="card"><h3>' + title + '</h3><ul class="ents">' + items + '</ul></section>' : '');
    const vSub = (i) => (S.vend.regions[S.vend.region[i]] || '') + ' · ' + (S.vend.count[i] ? won(S.vend.total[i]) + ' · ' + S.vend.count[i] + '건' : '시청 계약 없음') + (S.vend.ext_count[i] ? ' · 시청 외 기관 ' + won(S.vend.ext_total[i]) : '');
    html += group('업체', vend.map(([i]) => '<li>' + vLink('v' + i, '<b>' + esc(S.vend.name[i]) + '</b><span>' + esc(vSub(i)) + '</span>') + '</li>').join(''));
    html += group('발주 기관', inst.map(([i]) => { const x = S.core.insts[i]; return '<li>' + link('i:' + x[0], '<b>' + esc(x[0]) + '</b><span>' + esc(city(x[1])[2] + ' · ' + won(x[2]) + ' · ' + x[3].toLocaleString('ko-KR') + '건' + (x[4] ? ' · 시청 외 기관' : '')) + '</span>') + '</li>'; }).join(''));
    html += group('시', cityHits.slice(0, 6).map((i) => { const c = city(i); return '<li>' + link('c:' + c[0], '<b>' + esc(c[2]) + '</b><span>' + esc('시청 ' + won(c[4]) + ' · 시청 외 기관 ' + won(c[6])) + '</span>') + '</li>'; }).join(''));
    html += group('국회의원' + (memAll > mem.length ? ' <small>' + memAll + '명 중 ' + mem.length + '명</small>' : ''), mem.map(([i]) => { const m = S.core.members[i]; return '<li>' + link('m:' + m[0], '<b>' + esc(m[1]) + '</b><span>' + esc(m[2] + ' · ' + m[3] + ' · 대표 발의 ' + m[6] + '건') + '</span>') + '</li>'; }).join(''));
    html += group('국민연금 보유 종목', stocks.map(([i]) => { const s = S.core.stocks[i]; return '<li>' + link('s:' + s[0], '<b>' + esc(s[0]) + '</b><span>' + esc((s[1] === 'kr' ? '국내' : '미국') + ' · 평가액 ' + won((s[2] || 0) * 1e8) + (s[4] != null ? ' · 지분 ' + s[4] + '%' : '')) + '</span>') + '</li>'; }).join(''));
    if (bills.length) {
      const B = S.bills;
      html += '<section class="card"><h3>법안 <small>' + bills.length + (bills.length >= 300 ? '+' : '') + '건</small></h3><ul class="ents">' + bills.slice(0, 8).map((i) => billLi(B, i, true)).join('') + '</ul></section>';
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
  function billLi(B, i, who) {
    const m = S.core.members[B.member[i]] || [];
    return '<li><a class="go" href="' + esc(B.bill_url + encodeURIComponent(B.id[i])) + '" target="_blank" rel="noopener"><b>' + esc(B.title[i]) + '</b><span>' + esc(B.date[i] + ' · ' + (B.result[i] || '계류') + (who ? ' · 대표 발의 ' + (m[1] || '') : '') + ' ↗') + '</span></a></li>';
  }

  /* ── 하나 자세히 ─────────────────────────────── */
  function detailView(o) {
    const t = o.slice(0, 1), key = o.slice(2);
    const back = '<button class="back" type="button" data-back>‹ 검색 결과</button>';
    const none = (what) => back + '<section class="card empty"><h3>' + esc(what) + ' 정보를 찾지 못했어요</h3></section>';
    const qpAll = { raw: '', whole: '', toks: [], cities: new Set() };
    if (t === 'v') {
      const bar = key.lastIndexOf('|'), name = bar >= 0 ? key.slice(0, bar) : key, region = bar >= 0 ? key.slice(bar + 1) : null;
      if (C.masked(name)) return none('개인사업자(이름 가림)');
      const idxs = []; S.vend.name.forEach((n, i) => { if (n === name && (region == null || (S.vend.regions[S.vend.region[i]] || '') === region)) idxs.push(i); });
      if (!idxs.length) return none('업체');
      const focus = new Set(idxs);
      const agg = S.months.length ? C.scan(S.months, qpAll, ctx((M, r) => C.parts(M, r).some(([v]) => focus.has(v)), { focus })) : null;
      const i0 = idxs[0], reg = S.vend.regions[S.vend.region[i0]] || '';
      const corpId = S.vend.corp_file[String(i0)];
      const stock = S.core.stocks.find((s) => C.sameCompany(s[0], name));
      const others = []; S.vend.name.forEach((n, i) => { if (n === name && !focus.has(i)) others.push(i); });
      let h = back + '<section class="card head"><p class="eyebrow">업체</p><h2>' + esc(S.vend.name[i0]) + '</h2><p class="sub">' + esc(reg + (idxs.length > 1 ? ' · 같은 이름·같은 소재지 ' + idxs.length + '곳 합산' : '')) + '</p><div id="corp"></div>' +
        (stock ? '<p class="xref">국민연금 보유 종목과 이름이 같아요: ' + link('s:' + stock[0], esc(stock[0]) + ' 보기') + '</p>' : '') +
        (others.length ? '<p class="note">이름이 같은 다른 지역 업체 ' + others.length + '곳은 따로 셉니다: ' + others.slice(0, 4).map((i) => vLink('v' + i, esc(S.vend.regions[S.vend.region[i]] || '소재지 없음'), 'chip')).join(' ') + '</p>' : '') +
        (corpId ? '<p class="links"><a href="vendor.html?v=' + encodeURIComponent(corpId) + '">업체 상세 화면 ›</a></p>' : '') + '</section>';
      h += flowBlock(agg, { title: '누가 이 업체와 계약했나', inst: true }) + listBlock(agg, 'd');
      if (corpId) setTimeout(() => corpInfo(corpId), 0);
      return h;
    }
    if (t === 'i') {
      const ii = S.core.insts.findIndex((x) => x[0] === key);
      if (ii < 0) return none('기관');
      const x = S.core.insts[ii], c = city(x[1]);
      const agg = S.months.length ? C.scan(S.months, qpAll, ctx((M, r) => M.inst[r] === ii, { ext: true })) : null; // 기관 하나를 고르면 그 기관 계약은 모두
      return back + '<section class="card head"><p class="eyebrow">발주 기관' + (x[4] ? ' · 시청 외 기관' : '') + '</p><h2>' + esc(x[0]) + '</h2><p class="sub">' + esc(c[2]) + '</p><p class="links"><a href="city.html?c=' + encodeURIComponent(c[0]) + '">' + esc(c[2]) + ' 화면 ›</a></p></section>' +
        flowBlock(agg, { title: '이 기관과 계약한 업체', inst: true, nl: 1, nr: 8 }) + listBlock(agg, 'd');
    }
    if (t === 'c') {
      const ci = S.core.cities.findIndex((c) => c[0] === key);
      if (ci < 0) return none('시');
      const c = city(ci);
      const agg = S.months.length ? C.scan(S.months, qpAll, ctx((M, r) => M.city[r] === ci)) : null;
      const ls = typeof c[8] === 'number' ? Math.round(c[8] * 100) : null;
      return back + '<section class="card head"><p class="eyebrow">시</p><h2>' + esc(c[2]) + '</h2>' +
        '<p class="sub">' + esc('시청(본청·사업소·의회 등) ' + won(c[4]) + ' · ' + c[5].toLocaleString('ko-KR') + '건') + '<br>' + esc('시청 외 기관(구청·공단 등) ' + won(c[6]) + ' · ' + c[7].toLocaleString('ko-KR') + '건 — 시 합계에는 안 들어감') + '</p>' +
        (ls != null ? '<p class="xref">업체 사업자 주소가 ' + esc(c[2]) + '인 곳과 맺은 계약 금액 <b>' + ls + '%</b> · 그 밖 지역 ' + (100 - ls) + '% <span class="dim">(시청 계약, 공동도급은 지분대로 — 시 화면과 같은 계산)</span></p>' : '') +
        '<p class="links"><a href="city.html?c=' + encodeURIComponent(c[0]) + '">' + esc(c[2]) + ' 지도·자세히 ›</a></p></section>' +
        flowBlock(agg, { title: c[2] + ' 기관 → 계약 업체', inst: true }) + listBlock(agg, 'd');
    }
    if (t === 'm') {
      const mi = S.core.members.findIndex((m) => m[0] === key);
      if (mi < 0) return none('국회의원');
      const m = S.core.members[mi];
      let bl = '';
      if (S.bills) {
        const B = S.bills, res = new Map(); let n = 0;
        for (let i = 0; i < B.title.length; i++) if (B.member[i] === mi) { n++; const r = B.result[i] || '계류'; res.set(r, (res.get(r) || 0) + 1); if (n <= 30) bl += billLi(B, i, false); }
        const rs = [...res].sort((a, b) => b[1] - a[1]).map(([k, v]) => esc(k + ' ' + v)).join(' · ');
        bl = '<section class="card"><h3>대표 발의 법안 <small>' + n + '건</small></h3><p class="meta">' + rs + '</p><ul class="ents">' + bl + '</ul>' + (n > 30 ? '<p class="note">최근 30건만 보여 줍니다.</p>' : '') + '</section>';
      } else bl = '<section class="card"><p class="note">법안 자료를 받는 중이에요…</p></section>';
      return back + '<section class="card head"><p class="eyebrow">국회의원 · 22대</p><h2>' + esc(m[1]) + '</h2><p class="sub">' + esc(m[2] + ' · ' + m[3] + (m[4] ? ' · ' + m[4] : '')) + '</p>' +
        '<p class="meta">' + esc(m[5]) + '<br>' + esc('국외 출장 기록 ' + m[7] + '건 · 대표 발의 ' + m[6] + '건') + '</p>' +
        '<p class="links"><a href="national.html?mp=' + encodeURIComponent(m[1]) + '">국회 살펴보기에서 법 만들기·찬반·출장·징계안 보기 ›</a></p></section>' + bl;
    }
    if (t === 's') {
      const s = S.core.stocks.find((x) => x[0] === key);
      if (!s) return none('종목');
      const vi = []; S.vend.name.forEach((n, i) => { if (C.sameCompany(n, s[0])) vi.push(i); });
      const focus = new Set(vi);
      const agg = vi.length && S.months.length ? C.scan(S.months, qpAll, ctx((M, r) => C.parts(M, r).some(([v]) => focus.has(v)), { focus })) : null;
      const src = safeUrl(s[6]);
      return back + '<section class="card head"><p class="eyebrow">국민연금 보유 종목 · ' + (s[1] === 'kr' ? '국내 주식' : '미국 주식(13F)') + '</p><h2>' + esc(s[0]) + '</h2>' +
        '<div class="kpi"><div><b>' + esc(won((s[2] || 0) * 1e8)) + '</b><span>평가액</span></div>' + (s[3] != null ? '<div><b>' + esc(s[3]) + '%</b><span>국내 주식 중 비중</span></div>' : '') + (s[4] != null ? '<div><b>' + esc(s[4]) + '%</b><span>지분율</span></div>' : '') + '</div>' +
        '<p class="meta">기준 ' + esc(s[5]) + (src ? ' · <a href="' + esc(src) + '" target="_blank" rel="noopener">공시 원문 ↗</a>' : '') + '</p><p class="links"><a href="nps.html">국민연금 화면 ›</a></p></section>' +
        (agg && (agg.n || agg.extN) ? flowBlock(agg, { title: '같은 이름 업체가 맺은 정부 계약', inst: true }) + listBlock(agg, 'd') : '<section class="card"><h3>같은 이름 업체의 정부 계약</h3><p class="note">같은 이름으로 ' + S.core.counts.cities + '개 시와 맺은 계약은 저장된 기간(' + esc(S.core.period.first + '~' + S.core.period.last) + ')에 없습니다.</p></section>') +
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
      hits.slice(0, 8).map((i) => '<li>' + vLink('v' + i, '<b>' + esc(S.vend.name[i]) + '</b><span>' + esc((S.vend.regions[S.vend.region[i]] || '') + ' · ' + won(S.vend.total[i]) + ' · ' + S.vend.count[i] + '건') + '</span>') + '</li>').join('') + '</ul></section>';
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
  let lastKey = '';
  function route() {
    if (!S.core) return;
    const p = new URLSearchParams(location.search), q = (p.get('q') || '').trim(), o = p.get('o') || '';
    const key = q + '\u0002' + o + '\u0002' + p.get('ext') + '\u0002' + S.months.length + '\u0002' + !!S.bills + '\u0002' + out.clientWidth;
    if (key === lastKey) return; // 같은 화면을 다시 그리지 않는다(목록 펼침·정렬 유지)
    lastKey = key;
    if (document.activeElement !== input) input.value = q || (o ? '' : input.value);
    document.body.classList.toggle('has-q', !!(q || o));
    lastAgg = new Map();
    if (o && /^[vicms]:/.test(o)) { out.innerHTML = detailView(o); document.title = o.slice(2).split('|')[0] + ' · 통합 검색 · 세금추적단'; return; }
    if (q) { out.innerHTML = searchView(q); document.title = q + ' · 통합 검색 · 세금추적단'; return; }
    out.innerHTML = homeView();
    document.title = '통합 검색 · 세금추적단';
  }
  function homeView() {
    const ex = ['포항', '하수관로', '청소', 'CCTV', '보도블록', '삼성전자', '전세사기', '국토교통위원회'];
    return '<section class="card"><h3>이렇게 찾아보세요</h3><div class="ex">' + ex.map((x) => '<a href="?q=' + encodeURIComponent(x) + '" data-q="' + esc(x) + '">' + esc(x) + '</a>').join('') + '</div>' +
      '<ul class="tips"><li><b>업체·기관·시</b> 이름 → 누가 누구와 얼마의 계약을 맺었는지 흐름</li><li><b>계약 낱말</b>(하수관로, 청소, CCTV) → 어느 시가 어느 업체와</li><li><b>시 + 낱말</b>(포항 도로) → 그 시 안에서만</li><li><b>의원·위원회·법안 낱말</b> → 대표 발의 기록</li><li><b>회사 이름</b> → 국민연금 보유와 정부 계약을 한 번에</li></ul>' +
      '<p class="note">공개 기록을 모아 보여 줄 뿐 잘잘못을 판단하지 않습니다. 금액은 계약 금액(장기계속은 이번 차수 금액)이고, 합계는 업체·시 화면처럼 시청 계약 기준입니다. 원문은 나라장터·국회 의안정보시스템·국민연금 공시에서 확인하세요.</p></section>';
  }
  const go = (params) => { const u = new URL(location.href); u.search = ''; for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v); history.pushState(null, '', u); route(); window.scrollTo(0, 0); };

  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (q) { go({ q }); input.blur(); } });
  let typing = 0;
  input.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => { const q = input.value.trim(); if (q.length >= 2) { const u = new URL(location.href); u.search = ''; u.searchParams.set('q', q); history.replaceState(null, '', u); route(); } }, 350); });
  addEventListener('popstate', () => route());
  let rz = 0, lastW = out.clientWidth; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (out.clientWidth !== lastW) { lastW = out.clientWidth; route(); } }, 200); }); // 아이폰 주소창 접힘(높이만 변함)에는 다시 그리지 않음
  out.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-o]');
    if (a) { e.preventDefault(); go({ o: a.dataset.o }); return; }
    const ex = e.target.closest('a[data-q]');
    if (ex) { e.preventDefault(); input.value = ex.dataset.q; go({ q: ex.dataset.q }); return; }
    const xt = e.target.closest('a[data-ext]');
    if (xt) { e.preventDefault(); const u = new URL(location.href); if (xt.dataset.ext === '1') u.searchParams.set('ext', '1'); else u.searchParams.delete('ext'); history.replaceState(null, '', u); route(); return; }
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
