/* 세금추적단 통합 검색 — 검색·집계 로직 (화면 없음, node 테스트 가능).
 * 저장된 공개 기록(data/search/se/)만 쓴다. 실시간 뉴스·주가·AI 해석은 하지 않는다.
 * 합계 기준은 사이트와 같다: 시청 계약(업체·시 화면 합계). 시청 외 기관(구청·공단 등)은 따로 세고, 원할 때만 더한다.
 * 공동도급은 업체 화면처럼 지분대로 나눈다(collector/jv.py alloc 결과가 색인의 jvs 열).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SECore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LEGAL = /\(주\)|㈜|주식회사|\(유\)|유한회사|\(합\)|합자회사|\(합명\)|합명회사|\(재\)|재단법인|\(사\)|사단법인|\(복\)|사회복지법인|농업회사법인|영농조합법인|협동조합|\bco\.?,?\s*ltd\.?|\binc\.?(?=\s|$)|\bcorp(?:oration)?\.?(?=\s|$)|\bcompany\b|\bltd\.?(?=\s|$)/gi;
  const PUNCT = /[\s·・･.,，()（）[\]{}'"`~!@#$%^&*_+=|\\/:;<>?\-–—]+/g;
  const SEP = '\u0001';

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFKC').toLowerCase().replace(PUNCT, '');
  }
  function normName(s) {
    return norm(String(s == null ? '' : s).normalize('NFKC').replace(LEGAL, ' '));
  }
  function shortName(s) { const x = String(s || '').replace(LEGAL, ' ').replace(/\s+/g, ' ').trim(); return x || String(s || ''); }

  /* 금액: 1조 2,345억원 / 3.4억원 / 1,200만원 */
  function won(n) {
    n = Number(n) || 0;
    const neg = n < 0 ? '-' : '';
    n = Math.abs(n);
    if (n >= 1e12) {
      const jo = Math.floor(n / 1e12), eok = Math.round((n % 1e12) / 1e8);
      return neg + jo.toLocaleString('ko-KR') + '조' + (eok ? ' ' + eok.toLocaleString('ko-KR') + '억원' : '원');
    }
    if (n >= 1e8) {
      const e = n / 1e8;
      return neg + (e >= 100 ? Math.round(e).toLocaleString('ko-KR') : (Math.round(e * 10) / 10).toLocaleString('ko-KR')) + '억원';
    }
    if (n >= 1e4) return neg + Math.round(n / 1e4).toLocaleString('ko-KR') + '만원';
    return neg + Math.round(n).toLocaleString('ko-KR') + '원';
  }

  /* 시 이름 맞추기: "포항", "포항시", "경북 포항시", "서울". "광주"처럼 두 시에 맞으면 둘 다 */
  function cityKeys(c) {
    const name = c[1] || '', short = c[2] || '';
    const set = new Set([norm(name), norm(short), norm(name.replace(/(특별자치시|특별시|광역시|특별자치도|시)$/, ''))]);
    const tail = short.split(/\s+/).pop();
    if (tail) { set.add(norm(tail)); set.add(norm(tail.replace(/시$/, ''))); }
    set.delete('');
    return set;
  }
  function makeCityMatcher(cities) {
    const map = new Map();
    cities.forEach((c, i) => { for (const k of cityKeys(c)) if (k.length >= 2) { if (!map.has(k)) map.set(k, []); if (!map.get(k).includes(i)) map.get(k).push(i); } });
    return (tok) => map.get(norm(tok)) || [];
  }

  /* 질의 → 시 조건 + 나머지 낱말 */
  function parse(q, cityOf) {
    const raw = String(q || '').normalize('NFKC').trim();
    const words = raw.split(/\s+/).filter(Boolean);
    const cities = new Set(), toks = [];
    for (const p of words) {
      const cs = cityOf ? cityOf(p) : [];
      const list = Array.isArray(cs) ? cs : (cs >= 0 ? [cs] : []);
      if (list.length) list.forEach((c) => cities.add(c));
      else { const t = normName(p); if (t && !/^[a-z0-9]$/.test(t)) toks.push(t); } // 영문·숫자 한 글자는 너무 넓어서 뺀다
    }
    return { raw, whole: normName(raw), toks, cities, cityOnly: cities.size > 0 && toks.length === 0 };
  }

  /* 이름 점수: 완전 일치 > 앞부분 > 포함 > 모든 낱말 포함 */
  function nameScore(n, whole, toks) {
    if (!n || !whole) return 0;
    if (n === whole) return 100;
    if (n.startsWith(whole)) return 72;
    if (whole.length >= 2 && n.includes(whole)) return 48;
    if (toks.length > 1 && toks.every((t) => n.includes(t))) return 30;
    return 0;
  }

  /* 낱말이 전혀 다른 뜻의 더 긴 낱말 안에만 있을 때는 맞지 않은 것으로 본다 */
  const NEG = { '청소': /청소년/g, '도로': /도로명/g, '소방': /소방관서장/g };

  /* 한 줄의 업체 몫: [[업체 번호, 금액], ...] (공동도급이면 지분대로) */
  function parts(M, r) {
    const j = M.jvs && M.jvs[r];
    if (j && j.length) return j;
    return [[M.vendor[r], M.amount[r]]];
  }

  /* 미리 합친 검색 문자열(제목·기관·업체들). 화면이 달 파일을 받을 때 한 번 만든다 */
  function searchText(M, r, ctx) {
    let s = M.tn[r] + SEP + (ctx.instN[M.inst[r]] || '');
    for (const [v] of parts(M, r)) s += SEP + (v >= 0 ? ctx.vendN[v] || '' : (M.vnN ? M.vnN[r] : norm(M.vname[r])));
    return s;
  }

  /* 계약 한 줄이 질의에 맞나(시청 외 기관 여부는 scan 이 따로 본다) */
  function rowMatches(M, r, qp, ctx) {
    if (qp.cities.size && !qp.cities.has(M.city[r])) return false;
    if (ctx.pred && !ctx.pred(M, r)) return false;
    if (!qp.toks.length) return true;
    const st = M.st ? M.st[r] : searchText(M, r, ctx);
    for (const tok of qp.toks) {
      if (!st.includes(tok)) return false;
      const neg = NEG[tok];
      if (neg) { // '청소'가 제목의 '청소년' 안에만 있으면 맞지 않음
        const cut = st.indexOf(SEP);
        if (!(st.slice(0, cut).replace(neg, '').includes(tok) || st.slice(cut).includes(tok))) return false;
      }
    }
    return true;
  }

  function vkeyOf(M, r, v) { return v >= 0 ? 'v' + v : 'n' + M.vname[r]; }
  function vkey(M, r) { return vkeyOf(M, r, M.vendor[r]); }

  /* 맞는 계약을 모아 흐름(누가→누구와), 주별 추이, 목록을 만든다.
   * ctx.ext: 시청 외 기관 계약도 더할지. 더하지 않으면 extN/extSum 에 따로 센다.
   * ctx.focus: 업체 번호 Set — 그 업체 몫(공동도급 지분)만 금액으로 센다. */
  function scan(months, qp, ctx, opt) {
    opt = opt || {};
    const limit = opt.limit || 400;
    const agg = { n: 0, sum: 0, extN: 0, extSum: 0, inst: new Map(), vend: new Map(), city: new Map(), kind: new Map(), method: new Map(), week: new Map(), pair: new Map(), pairCity: new Map(), top: [], recent: [] };
    const add = (m, k, a, c) => { const o = m.get(k); if (o) { o[0] += a; o[1] += c; } else m.set(k, [a, c]); };
    for (let mi = 0; mi < months.length; mi++) {
      const M = months[mi];
      for (let r = 0; r < M.n; r++) {
        if (!rowMatches(M, r, qp, ctx)) continue;
        const ps = parts(M, r);
        const mine = ctx.focus ? ps.filter(([v]) => ctx.focus.has(v)) : ps;
        const a = mine.reduce((s, p) => s + (p[1] || 0), 0);
        if (M.ext[r] && !ctx.ext) { agg.extN++; agg.extSum += a; continue; }
        agg.n++; agg.sum += a;
        add(agg.inst, M.inst[r], a, 1); add(agg.city, M.city[r], a, 1);
        add(agg.kind, M.kind[r], a, 1); add(agg.method, M.method[r], a, 1); add(agg.week, Math.floor(M.d[r] / 7), a, 1);
        for (const [v, pa] of mine) {
          const vk = vkeyOf(M, r, v);
          add(agg.vend, vk, pa, 1); add(agg.pair, M.inst[r] + '|' + vk, pa, 1); add(agg.pairCity, M.city[r] + '|' + vk, pa, 1);
        }
        const ref = [mi, r, a, M.d[r]];
        agg.top.push(ref); agg.recent.push(ref);
        if (agg.top.length > limit * 2) { agg.top.sort((x, y) => y[2] - x[2]); agg.top.length = limit; }
        if (agg.recent.length > limit * 2) { agg.recent.sort((x, y) => y[3] - x[3] || y[2] - x[2]); agg.recent.length = limit; }
      }
    }
    agg.top.sort((x, y) => y[2] - x[2]); agg.top.length = Math.min(agg.top.length, limit);
    agg.recent.sort((x, y) => y[3] - x[3] || y[2] - x[2]); agg.recent.length = Math.min(agg.recent.length, limit);
    return agg;
  }

  /* Map → 금액 큰 순 [key, amount, count] */
  function ranked(m, k) {
    const out = [];
    for (const [key, v] of m) out.push([key, v[0], v[1]]);
    out.sort((a, b) => b[1] - a[1] || b[2] - a[2]);
    return k ? out.slice(0, k) : out;
  }

  /* 흐름 그림용: 왼쪽 상위 nl개, 오른쪽 상위 nr개, 나머지는 '기타' */
  function flowGraph(pairMap, leftMap, rightMap, nl, nr) {
    const L = ranked(leftMap), R = ranked(rightMap);
    const lk = new Set(L.slice(0, nl).map((x) => String(x[0]))), rk = new Set(R.slice(0, nr).map((x) => String(x[0])));
    const left = L.slice(0, nl).map((x) => ({ key: String(x[0]), amount: x[1], count: x[2] }));
    const right = R.slice(0, nr).map((x) => ({ key: String(x[0]), amount: x[1], count: x[2] }));
    const restL = L.slice(nl).reduce((s, x) => [s[0] + x[1], s[1] + x[2]], [0, 0]);
    const restR = R.slice(nr).reduce((s, x) => [s[0] + x[1], s[1] + x[2]], [0, 0]);
    if (restL[0] > 0) left.push({ key: '__rest', amount: restL[0], count: restL[1], rest: L.length - nl });
    if (restR[0] > 0) right.push({ key: '__rest', amount: restR[0], count: restR[1], rest: R.length - nr });
    const links = new Map();
    for (const [k, v] of pairMap) {
      const cut = k.indexOf('|');
      let a = k.slice(0, cut), b = k.slice(cut + 1);
      if (!lk.has(a)) a = '__rest';
      if (!rk.has(b)) b = '__rest';
      const key = a + '|' + b;
      links.set(key, (links.get(key) || 0) + v[0]);
    }
    return { left, right, links };
  }

  /* 같은 회사 찾기(업체 ↔ 국민연금 보유 종목): 법인 표기를 뺀 이름이 완전히 같을 때만 */
  function sameCompany(a, b) {
    const x = normName(a), y = normName(b);
    return x.length >= 2 && x === y;
  }

  /* 이름이 가려진 개인사업자는 서로 다른 사람이라 하나로 묶어 링크하지 않는다 */
  function masked(name) { return /^개인사업자/.test(String(name || '').trim()); }

  return { SEP, shortName, norm, normName, won, cityKeys, makeCityMatcher, parse, nameScore, parts, searchText, rowMatches, scan, ranked, flowGraph, sameCompany, vkey, vkeyOf, masked };
});
