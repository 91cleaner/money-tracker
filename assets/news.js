/* 뉴스 로더.
   data/news.json 필드가 달라도 여기서 맞춘다. 파일 내용은 고치지 않는다.
   쓰는 이름: id, title/제목, summary/요약, body/본문(문단 배열 또는 줄바꿈 문자열),
   date/날짜, city/도시, amount/금액, sources/출처([{label,url}] 또는 문자열),
   factchecked(true만 표시), topic/주제(없으면 제목에서 고름). */
(function () {
  function parseSource(s) {
    if (s && typeof s === 'object') {
      const url = String(s.url || s.href || '').trim();
      const label = String(s.label || s.name || s.title || url || '출처').trim();
      return label ? { label, url } : null;
    }
    const str = String(s == null ? '' : s).trim();
    if (!str) return null;
    const m = str.match(/https?:\/\/\S+/);
    if (!m) return { label: str, url: '' };
    const url = m[0].replace(/[),.;]+$/, '');
    const label = (str.slice(0, m.index) + str.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
    return { label: label || url, url };
  }

  function guessTopic(text) {
    const t = String(text || '');
    if (/경수로|차관|대북|남북/.test(t)) return '대북';
    if (/국회|해외|출장|의원/.test(t)) return '국회';
    if (/계약|공사|나라장터/.test(t)) return '계약';
    return '기타';
  }

  function asBody(v) {
    if (Array.isArray(v)) return v.map((x) => String(x == null ? '' : x).trim()).filter(Boolean);
    if (v == null || v === '') return [];
    return String(v).split(/\n+/).map((x) => x.trim()).filter(Boolean);
  }

  function newsNormalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const title = String(raw.title ?? raw['제목'] ?? '').trim();
    const summary = String(raw.summary ?? raw['요약'] ?? raw.key ?? '').trim();
    const date = String(raw.date ?? raw['날짜'] ?? '').trim();
    const city = String(raw.city ?? raw['도시'] ?? '').trim();
    const body = asBody(raw.body ?? raw['본문']);
    const amountRaw = raw.amount ?? raw['금액'];
    const amount = amountRaw == null ? '' : String(amountRaw).trim();
    const srcRaw = raw.sources ?? raw['출처'] ?? [];
    const sources = (Array.isArray(srcRaw) ? srcRaw : [srcRaw]).map(parseSource).filter(Boolean);
    const fact = raw.factchecked ?? raw['팩트체크'];
    const factchecked = fact === true;
    let topic = raw.topic ?? raw['주제'] ?? raw.tag ?? '';
    if (Array.isArray(raw.tags) && raw.tags.length) topic = topic || raw.tags[0];
    topic = String(topic || '').trim() || guessTopic(title + ' ' + summary);
    const id = String(raw.id || '').trim();
    if (!id && !title) return null;
    return { id, title, summary, body, date, city, amount, sources, factchecked, topic };
  }

  function newsFromPayload(data) {
    const list = Array.isArray(data) ? data : (data && (data.articles || data.items || data.news)) || [];
    return list.map(newsNormalize).filter((a) => a && a.factchecked === true && a.id && a.title);
  }

  function maskArticle(a, maskT) {
    const m = typeof maskT === 'function' ? maskT : (s) => s;
    return {
      ...a,
      title: m(a.title),
      summary: m(a.summary),
      city: m(a.city),
      body: a.body.map((p) => m(p)),
      sources: a.sources.map((s) => ({ label: m(s.label), url: s.url })),
    };
  }

  function cityTokens(c) {
    const out = new Set();
    const add = (s) => {
      s = String(s || '').trim();
      if (!s) return;
      out.add(s);
      const last = s.split(/\s+/).pop();
      out.add(last);
      const core = last.replace(/(특별자치시|특별시|광역시|시|군|구)$/g, '');
      if (core) out.add(core);
    };
    add(c && c.name); add(c && c.short); add(c && c.province);
    out.delete('');
    return [...out].filter((t) => t.length >= 2);
  }

  function cityHit(articleCity, slug, cities) {
    if (!slug || !articleCity) return false;
    const c = (cities || []).find((x) => x.slug === slug);
    if (!c) return false;
    const a = String(articleCity).trim();
    if (a.length < 2) return false;
    return cityTokens(c).some((t) => a.includes(t) || t.includes(a));
  }

  function sortNews(list, slug, cities) {
    const rank = (a) => (slug && cityHit(a.city, slug, cities) ? 0 : 1);
    return list.slice().sort((a, b) => {
      const d = rank(a) - rank(b);
      if (d) return d;
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.id < b.id ? 1 : -1;
    });
  }

  function wonFromLabel(s) {
    if (typeof s === 'number' && isFinite(s)) return Math.round(s);
    const t = String(s == null ? '' : s).replace(/,/g, '').replace(/\s/g, '');
    if (!t) return null;
    let n = 0, ok = false;
    const jo = t.match(/(\d+(?:\.\d+)?)조/);
    const eok = t.match(/(\d+(?:\.\d+)?)억/);
    const man = t.match(/(\d+(?:\.\d+)?)만/);
    if (jo) { n += parseFloat(jo[1]) * 1e12; ok = true; }
    if (eok) { n += parseFloat(eok[1]) * 1e8; ok = true; }
    if (man && !jo && !eok) { n += parseFloat(man[1]) * 1e4; ok = true; }
    if (!ok) {
      const d = t.replace(/[^\d.]/g, '');
      if (!d) return null;
      const v = parseFloat(d);
      if (!isFinite(v)) return null;
      if (/원/.test(t) && v >= 1000) return Math.round(v);
      return null;
    }
    return Math.round(n);
  }

  function newsIsNew(newest, seen) {
    return !!(newest && String(newest) > String(seen || ''));
  }

  function newestDate(list) {
    let best = '';
    for (const a of list || []) if (a && a.date && a.date > best) best = a.date;
    return best;
  }

  const api = { newsNormalize, newsFromPayload, maskArticle, parseSource, guessTopic, cityHit, sortNews, wonFromLabel, newsIsNew, newestDate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window === 'undefined') return;
  window.NewsKit = api;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const safeUrl = (u) => {
    try {
      const x = new URL(u, location.origin);
      if (x.protocol === 'http:' || x.protocol === 'https:') return x.href;
    } catch (e) {}
    return '';
  };
  const maskFn = () => (typeof window.maskT === 'function' ? window.maskT : (s) => s);

  function slugFor(city, cities) {
    if (!city) return '';
    for (const c of cities || []) if (cityHit(city, c.slug, cities)) return c.slug;
    return '';
  }

  function cardBits(a) {
    const amt = a.amount ? `<b class="namt" data-tip="기사에 적힌 금액이에요. 본문 숫자를 그대로 보여 줘요.">${esc(a.amount)}</b>` : '';
    return `<span class="nmeta"><span class="ntag">${esc(a.city || '지역 없음')}</span><time datetime="${esc(a.date)}">${esc(a.date || '')}</time></span>
      <span class="ntitle">${esc(a.title)}</span>
      <span class="nsum">${esc(a.summary)}</span>${amt}`;
  }

  async function loadAll() {
    let payload = null;
    try {
      const r = await fetch('data/news.json', { cache: 'no-cache' });
      if (r.ok) payload = await r.json();
    } catch (e) { payload = null; }
    let cities = [];
    try {
      const r = await fetch('data/index.json', { cache: 'no-cache' });
      if (r.ok) cities = ((await r.json()) || {}).cities || [];
    } catch (e) {}
    const raw = payload ? newsFromPayload(payload) : [];
    const articles = raw.map((a) => maskArticle(a, maskFn()));
    return { articles, cities, missing: !payload };
  }

  function renderNews(articles, cities) {
    const heroEl = document.getElementById('news-hero');
    const listEl = document.getElementById('news-list');
    const filters = document.getElementById('news-filters');
    const empty = document.getElementById('news-empty');
    if (!heroEl || !listEl) return;
    const slug = new URLSearchParams(location.search).get('c') || '';
    if (!articles.length) {
      heroEl.innerHTML = '';
      listEl.innerHTML = '';
      if (filters) filters.innerHTML = '';
      if (empty) { empty.hidden = false; empty.textContent = '첫 기사를 준비하고 있어요'; }
      document.dispatchEvent(new CustomEvent('news:ready', { detail: { articles: [] } }));
      return;
    }
    if (empty) empty.hidden = true;
    const citiesU = [...new Set(articles.map((a) => a.city).filter(Boolean))];
    const topics = [...new Set(articles.map((a) => a.topic).filter(Boolean))];
    let cityF = '';
    let topicF = '';
    const draw = () => {
      let rows = articles.slice();
      if (cityF) rows = rows.filter((a) => a.city === cityF);
      if (topicF) rows = rows.filter((a) => a.topic === topicF);
      rows = sortNews(rows, cityF ? '' : slug, cities);
      heroEl.innerHTML = '';
      listEl.innerHTML = '';
      if (!rows.length) {
        listEl.innerHTML = '<p class="nempty2">이 조건의 기사가 없어요.</p>';
        return;
      }
      const hero = rows[0];
      const rest = rows.slice(1);
      heroEl.innerHTML = `<a class="nhero" href="article.html?id=${encodeURIComponent(hero.id)}${slug ? '&c=' + encodeURIComponent(slug) : ''}">
        <span class="nhero-k">오늘의 기사</span>${cardBits(hero)}<span class="nmore">기사 읽기</span></a>`;
      if (!cityF && slug && rows.some((a) => cityHit(a.city, slug, cities))) heroEl.insertAdjacentHTML('beforeend', '<p class="nhint">주소에 고른 시의 기사를 먼저 뒀어요.</p>');
      listEl.innerHTML = rest.map((a) => `<article class="ncard">
        <button type="button" class="ncard-btn" aria-expanded="false">${cardBits(a)}</button>
        <div class="ncard-more" hidden><p>${esc((a.body && a.body[0]) || a.summary)}</p>
        <a href="article.html?id=${encodeURIComponent(a.id)}${slug ? '&c=' + encodeURIComponent(slug) : ''}">기사 읽기</a></div></article>`).join('');
    };
    if (filters) {
      const chip = (kind, val, label) => `<button type="button" class="nchip${val === '' ? ' on' : ''}" data-kind="${kind}" data-v="${esc(val)}">${esc(label)}</button>`;
      filters.innerHTML = `<div class="nchips" role="group" aria-label="도시">${chip('city', '', '전체')}${citiesU.map((c) => chip('city', c, c)).join('')}</div>
        <div class="nchips" role="group" aria-label="주제">${chip('topic', '', '전체')}${topics.map((t) => chip('topic', t, t)).join('')}</div>`;
      filters.addEventListener('click', (e) => {
        const b = e.target.closest('.nchip');
        if (!b) return;
        if (b.dataset.kind === 'city') cityF = b.dataset.v;
        else topicF = b.dataset.v;
        filters.querySelectorAll(`.nchip[data-kind="${b.dataset.kind}"]`).forEach((x) => x.classList.toggle('on', x === b));
        draw();
      });
    }
    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.ncard-btn');
      if (!btn) return;
      const more = btn.parentElement.querySelector('.ncard-more');
      const open = more.hidden;
      more.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    draw();
    document.dispatchEvent(new CustomEvent('news:ready', { detail: { articles } }));
  }

  function renderArticle(articles, cities) {
    const root = document.getElementById('article-root');
    if (!root) return;
    const id = new URLSearchParams(location.search).get('id') || '';
    const a = articles.find((x) => x.id === id);
    const donate = document.getElementById('donate-box');
    const nextSec = document.getElementById('a-next');
    if (!a) {
      root.innerHTML = '<p class="nempty2">기사를 찾지 못했어요.</p><p><a href="news.html">뉴스 목록</a></p>';
      if (donate) donate.hidden = true;
      document.dispatchEvent(new CustomEvent('news:ready', { detail: { articles, current: null } }));
      return;
    }
    const slug = slugFor(a.city, cities);
    const mapHref = slug ? './?c=' + encodeURIComponent(slug) + '#map' : './#map';
    const firstSrc = (a.sources[0] && a.sources[0].label) || '출처 없음';
    const srcLinks = a.sources.map((s) => {
      const href = safeUrl(s.url);
      return href ? `<li><a href="${esc(href)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>` : `<li>${esc(s.label)}</li>`;
    }).join('');
    const pageUrl = location.href.split('#')[0];
    const shareText = a.title + (a.summary ? ' ' + a.summary : '');
    const xHref = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(pageUrl);
    root.innerHTML = `<h1>${esc(a.title)}</h1>
      <p class="adate">${esc(a.date)} · ${esc(firstSrc)}</p>
      <p class="akey">${esc(a.summary)}</p>
      <div class="abody">${a.body.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      <a class="map-go" href="${mapHref}">지도에서 보기</a>
      <ul class="asrc">${srcLinks}</ul>
      <a class="xshare" href="${xHref}" target="_blank" rel="noopener">X에 글 올리기</a>`;
    if (nextSec) {
      const rest = sortNews(articles.filter((x) => x.id !== a.id), '', cities).slice(0, 2);
      nextSec.innerHTML = rest.map((n) => `<a class="ncard ncard-link" href="article.html?id=${encodeURIComponent(n.id)}">
        <span class="nnext-k">다음 기사</span>${cardBits(n)}</a>`).join('') || '<p class="nempty2">다음 기사가 없어요.</p>';
    }
    try { localStorage.setItem('mt-news-seen', newestDate(articles)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('news:ready', { detail: { articles, current: a } }));
  }

  async function boot() {
    if (!document.getElementById('news-hero') && !document.getElementById('article-root')) return;
    const { articles, cities } = await loadAll();
    if (document.getElementById('news-hero')) {
      renderNews(articles, cities);
      try { if (articles.length) localStorage.setItem('mt-news-seen', newestDate(articles)); } catch (e) {}
    }
    if (document.getElementById('article-root')) renderArticle(articles, cities);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
