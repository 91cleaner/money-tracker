/* '남들 의견' 층(읽기 전용): data/opinions/index.json 을 읽어 검색 답 아래에 우리 데이터와 구분해 붙인다.
   서버·AI·API 호출 없음. 글은 모두 textContent 로만 넣는다(HTML 해석 없음). 원문 링크 없는 글은 보여 주지 않는다.
   MTOpinions.render(container, 'NVDA', {en:false, base:'../data/opinions/', asof:'2026-10-28', period:'1m'}) */
(function (root) {
  'use strict';
  var cache = {};
  var DAYS = { '1w': 7, '1m': 30, '3m': 91, '1y': 365 };
  var MAX_QUOTE = 160;
  var X_HOSTS = ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'];
  var TITLE_KO = { CEO: '대표', CFO: '재무책임자', COO: '운영책임자', CTO: '기술책임자', Chairman: '회장', Founder: '창업자' };
  var T = {
    ko: { head: '남들 의견', badge: '의견이에요, 사실 확인 아님', sub: '아래는 각 작성자의 말이에요. 우리가 모은 기록이 아니에요.', exec: '같은 기간 {n} {t}는 이렇게 말했어요', execNoTitle: '같은 기간 {n}는 이렇게 말했어요', link: '원문 ↗', role: { analyst: '애널리스트', trader: '트레이더', influencer: '인플루언서', exec: '임원' }, foot: '투자 조언이 아니에요. 같은 시기에 나온 말일 뿐 원인이 아니에요.' },
    en: { head: 'Others’ opinions', badge: 'Opinion, not fact-checked', sub: 'These are the authors’ own words, not our data.', exec: 'In the same period, {t} {n} said:', execNoTitle: 'In the same period, {n} said:', link: 'Original ↗', role: { analyst: 'Analyst', trader: 'Trader', influencer: 'Influencer', exec: 'Executive' }, foot: 'Not investment advice. Said around the same time; not a cause.' }
  };

  function load(base) {
    base = base || 'data/opinions/';
    if (!cache[base]) {
      cache[base] = fetch(base + 'index.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return cache[base];
  }

  function okUrl(u) {
    try { var p = new URL(u); return p.protocol === 'https:' && !!p.hostname; } catch (e) { return false; }
  }

  // 링크 필수 + 인용 길이 제한. 통과 못 하면 null.
  function clean(r) {
    if (!r || typeof r.text !== 'string' || !r.text.trim() || !okUrl(r.url) || !r.name || !r.created_at) return null;
    var text = r.text.replace(/\s+/g, ' ').trim();
    if (text.length > MAX_QUOTE) text = text.slice(0, MAX_QUOTE - 1).replace(/[\s,.;:]+\S*$/, '') + '…';
    return { name: r.name, handle: r.handle, role: r.role, title: r.title || '', text: text, url: r.url, date: String(r.created_at).slice(0, 10), source: r.source };
  }

  function sinceOf(asof, period) {
    var d = asof ? new Date(asof + 'T00:00:00Z') : new Date();
    if (isNaN(d)) d = new Date();
    return new Date(d.getTime() - (DAYS[period] || 30) * 864e5).toISOString().slice(0, 10);
  }

  // 종목의 {opinions[], exec[]}. 임원 발언은 '같은 기간'이라고 말하므로 답의 기간 안의 것만, 최대 1건.
  function pick(index, symbol, opts) {
    opts = opts || {};
    var t = index && index.tickers && index.tickers[String(symbol || '').toUpperCase()];
    if (!t) return { opinions: [], exec: [] };
    var since = sinceOf(opts.asof, opts.period);
    var op = (t.opinions || []).map(clean).filter(Boolean).slice(0, opts.maxOpinions || 3);
    var ex = (t.exec || []).map(clean).filter(function (x) { return x && x.date >= since; }).slice(0, 1);
    return { opinions: op, exec: ex };
  }

  function execLine(x, lang) {
    var s = T[lang];
    var title = lang === 'en' ? (x.title || '') : (TITLE_KO[x.title] || x.title || '');
    var tpl = title ? s.exec : s.execNoTitle;
    return tpl.replace('{t}', title).replace('{n}', x.name);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function card(x, lang, lead) {
    var s = T[lang];
    var c = el('div', 'mtop-card');
    c.style.cssText = 'margin:6px 0;padding:6px 8px;border-left:3px solid #8a7cff;background:#ffffff0d';
    if (lead) c.append(el('div', 'mtop-lead', lead));
    var q = el('div', 'mtop-quote', '“' + x.text + '”');
    q.style.cssText = 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.5';
    c.append(q);
    var m = el('div', 'mtop-meta');
    m.style.cssText = 'font-size:11px;opacity:.8;margin-top:3px';
    var who = x.name + (x.role && !lead && s.role[x.role] ? ' · ' + s.role[x.role] : '') + ' · ' + x.date + ' · ';
    m.append(document.createTextNode(who));
    var a = el('a', 'mtop-link', s.link);
    a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.color = '#b9b0ff';
    m.append(a);
    c.append(m);
    return c;
  }

  // 컨테이너 끝에 '남들 의견' 상자를 붙인다. 보여 줄 게 없으면 아무것도 붙이지 않고 false.
  function render(container, symbol, opts) {
    opts = opts || {};
    var lang = opts.en ? 'en' : 'ko', s = T[lang];
    return load(opts.base).then(function (idx) {
      var p = pick(idx, symbol, opts);
      if (!p.opinions.length && !p.exec.length) return false;
      var old = container.querySelector('.mtop-box');
      if (old) old.remove();
      var box = el('section', 'mtop-box');
      box.setAttribute('aria-label', s.head);
      box.style.cssText = 'margin-top:14px;padding:10px;border:1px dashed #8a7cff;border-radius:10px;background:#8a7cff14';
      var h = el('div', 'mtop-head');
      h.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-weight:600';
      h.append(el('span', null, '💬 ' + s.head));
      var b = el('span', 'mtop-badge', s.badge);
      b.style.cssText = 'font-size:11px;font-weight:400;padding:1px 7px;border:1px solid #8a7cff;border-radius:99px';
      h.append(b);
      box.append(h);
      var sub = el('div', 'mtop-sub', s.sub);
      sub.style.cssText = 'font-size:11px;opacity:.75;margin-top:3px';
      box.append(sub);
      p.opinions.forEach(function (x) { box.append(card(x, lang)); });
      p.exec.forEach(function (x) { box.append(card(x, lang, execLine(x, lang))); });
      var f = el('div', 'mtop-foot', s.foot);
      f.style.cssText = 'font-size:11px;opacity:.7;margin-top:6px';
      box.append(f);
      container.append(box);
      return true;
    });
  }

  var api = { load: load, pick: pick, clean: clean, execLine: execLine, render: render, MAX_QUOTE: MAX_QUOTE, T: T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MTOpinions = api;
})(typeof window !== 'undefined' ? window : globalThis);
