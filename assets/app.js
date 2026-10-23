// 우리 시 돈 추적기 — 전국 목록(home)과 시 상세(city)
const $ = (s, root = document) => root.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const krw = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e12) return s + (a / 1e12).toFixed(1).replace(/\.0$/, '') + '조원';
  if (a >= 1e8) return s + (a / 1e8 >= 100 ? Math.round(a / 1e8).toLocaleString('ko-KR') : (a / 1e8).toFixed(1).replace(/\.0$/, '')) + '억원';
  if (a >= 1e4) return s + Math.round(a / 1e4).toLocaleString('ko-KR') + '만원';
  return s + a.toLocaleString('ko-KR') + '원';
};
const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
const when = (iso) => { if (!iso) return '—'; return new Date(iso).toLocaleString('ko-KR', {month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'}); };
const LABEL = {split: '같은 날 나눠진 계약', threshold: '한도 바로 밑 계약', increase: '계약 금액 증가', repeat: '같은 업체 반복', big: '1억 이상'};
const CATS = ['전체', '청소', '시설관리', '경비', '건설·공사', '용역·연구', '인쇄·홍보', '축제 공연·섭외', '물품', '기타'];
const FEST = '축제 공연·섭외';
// 축제 공연 분야를 고르면 안내 한 줄 (출연자 이름은 수집 단계에서 지움)
const festNote = (anchor, on) => { if (!anchor) return; let n = anchor.parentNode.querySelector(':scope > .fest-note');
  if (!on) { n && n.remove(); return; } if (n) return; n = document.createElement('p'); n.className = 'fest-note small';
  n.textContent = '공연 용역 금액에는 무대·음향·연출이 포함되며 개인 출연료가 아님 · 출처 조달청 나라장터'; anchor.after(n); };
const SOURCE = 'https://www.g2b.go.kr';
const BASE = location.href.replace(/[^/]*([?#].*)?$/, '');
const shareURL = (slug, key) => BASE + 'c/' + slug + '.html' + (key ? '#' + key : '');

async function getJSON(path) {
  const r = await fetch(path + '?t=' + Math.floor(Date.now() / 600000));
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}

// 공유 미지원 → 복사 + 자동으로 사라지는 토스트 (모달 없음)
window.mtCopy = async (url) => { url = new URL(url, location.href).href;
  try { await navigator.clipboard.writeText(url); } catch (e) { const t = document.createElement('textarea'); t.value = url; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;opacity:0'; document.body.append(t); t.select(); try { document.execCommand('copy'); } catch (_) {} t.remove(); }
  const d = document.createElement('div'); d.className = 'mt-toast'; d.setAttribute('role', 'status'); d.textContent = '복사되었어요'; document.body.append(d); setTimeout(() => d.classList.add('out'), 1500); setTimeout(() => d.remove(), 1900); };
window.mtShare = async (url, title) => { if (navigator.share) { try { await navigator.share({title, url: new URL(url, location.href).href}); } catch (e) {} return; } mtCopy(url); };
async function share(url, title) { return mtShare(url, title); }
// 팁·안내 배너: 닫으면 계속 닫힘
document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('.tipban[data-id]').forEach((b) => { const k = 'tip:' + b.dataset.id; if (localStorage.getItem(k)) return b.remove();
  const x = document.createElement('button'); x.type = 'button'; x.className = 'tip-x'; x.setAttribute('aria-label', '닫기'); x.textContent = '×'; x.onclick = () => { try { localStorage.setItem(k, '1'); } catch (e) {} b.remove(); }; b.append(x); }));
// 지도 아래 카드로 스크롤하면 헤더를 로고+티커 한 줄로
{ let on = false; const f = () => { const m = document.querySelector('#dive .dv-map'); const v = !!m && m.getBoundingClientRect().bottom < 60; if (v !== on) { on = v; document.body.classList.toggle('hdr-min', v); } }; addEventListener('scroll', f, {passive: true}); }
const shareBtn = (url, title, cls = 'sharebtn') => { const b = el('button', cls, '공유하기'); b.type = 'button'; b.addEventListener('click', () => share(url, title, b)); return b; };

function emptyBox(title, text, live) {
  const p = el('div', 'empty'); const b = el('b');
  if (live) b.append(el('span', 'pulse'));
  b.append(title); p.append(b, el('span', '', text)); return p;
}

function bars(box, rows, label, value, sub, href) {
  box.replaceChildren();
  if (!rows.length) { box.append(emptyBox('아직 데이터가 없습니다', '계약이 모이면 여기에 나타납니다.')); return; }
  const max = Math.max(...rows.map(value));
  for (const r of rows) {
    const row = el(href && href(r) ? 'a' : 'div', 'barrow' + (href && href(r) ? ' link' : '')); if (href && href(r)) row.href = href(r);
    const l = el('div', 'l'), name = el('span', '', label(r));
    name.title = label(r); if (sub && sub(r)) name.append(el('small', '', sub(r)));
    l.append(name, el('span', 'amt', krw(value(r))));
    const b = el('div', 'b'), i = el('i'); i.style.width = Math.max(2, (max > 0 ? value(r) / max : 0) * 100) + '%'; b.append(i);
    row.append(l, b); box.append(row);
  }
}

function alertList(box, alerts, opts = {}) {
  box.replaceChildren();
  if (!alerts.length) { box.append(opts.empty || emptyBox('눈에 띄는 패턴이 없습니다', '최근 데이터에서 자동으로 찾은 패턴이 없어요.')); return; }
  const limit = opts.limit || alerts.length;
  alerts.forEach((a, n) => {
    const it = el('article', 'alert ' + a.kind); it.id = a.key;
    const top = el('div', 'top'); top.append(el('span', 'pill ' + a.kind, LABEL[a.kind] || a.kind));
    const slug = a.slug || opts.slug;
    if (slug) top.append(shareBtn(shareURL(slug, a.key), a.title));
    it.append(top, el('span', 't', (window.plainT || String)(a.title)));
    if (a.amount != null) it.append(el('span', 'a', krw(a.amount)));
    it.append(el('span', 'd', (window.plainT || String)(a.detail)));
    if (a.explanation && a.explanation.text) {
      const x = el('div', 'x'); x.append(el('b', '', '기관·업체 해명 '), document.createTextNode(`(${a.explanation.by || ''}${a.explanation.date ? ', ' + a.explanation.date : ''}) ${a.explanation.text}`)); it.append(x);
    }
    if (opts.link && a.slug) { const g = el('a', 'go', a.city + ' 자세히 보기 ›'); g.href = 'city.html?c=' + a.slug + '#' + a.key; it.append(g); }
    const src = el('a', 'src', '출처: 조달청 나라장터 공개 계약정보'); src.href = SOURCE; src.target = '_blank'; src.rel = 'noopener'; it.append(src);
    if (n >= limit && a.key !== location.hash.slice(1)) it.hidden = true;
    box.append(it);
  });
  if (alerts.length > limit) {
    const m = el('button', 'more', `${(alerts.length - limit).toLocaleString('ko-KR')}건 더 보기`); m.type = 'button';
    m.addEventListener('click', () => { box.querySelectorAll('article[hidden]').forEach((x) => (x.hidden = false)); m.remove(); }); box.append(m);
  }
}

function chips(box, cats, onPick) {
  box.replaceChildren();
  let cur = cats[0];
  for (const c of cats) {
    const b = el('button', 'chip' + (c === cur ? ' on' : ''), c); b.type = 'button'; b.setAttribute('aria-pressed', c === cur);
    b.addEventListener('click', () => { cur = c; box.querySelectorAll('.chip').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); onPick(c); });
    box.append(b);
  }
}

// ---------- 전국 ----------
const MINWAGE = 10320; // 2026년 최저임금(고용노동부 고시 제2025-41호)
const whenNear = (node, fn) => {
  if (!('IntersectionObserver' in window)) return fn();
  let done = false; const io = new IntersectionObserver((es) => { if (!done && es.some((e) => e.isIntersecting)) { done = true; io.disconnect(); fn(); } }, {rootMargin: '400px'});
  io.observe(node);
};
function countUp(node, to) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !node.dataset.done) { /* 첫 표시만 애니메이션 */ }
  const from = Number(node.dataset.v || 0), t0 = performance.now(), D = node.dataset.done ? 450 : 1400;
  node.dataset.v = to; node.dataset.done = 1;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = krw(to); return; }
  const step = (t) => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); node.textContent = krw(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function receiptCard(r, city) {
  const c = el('article', 'receipt');
  c.append(el('small', 'pill', '계약 영수증 · ' + (r.cat || '기타')), el('div', 'amt', krw(r.amount)), el('b', '', r.title));
  const dl = el('dl');
  for (const [k, v] of [['날짜', r.date], ['일을 맡긴 기관', r.inst], ['업체', r.vendor], ['업체 소재', r.vregion || '확인 중'], ['방식', r.method]]) { dl.append(el('dt', '', k), el('dd', '', v || '—')); }
  const acts = el('div', 'acts');
  if (r.url) { const a = el('a', '', '나라장터 원본 ↗'); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; acts.append(a); }
  acts.append(shareBtn(shareURL(city.slug), `${city.short} · ${r.title} ${krw(r.amount)}`));
  c.append(dl, acts); return c;
}
async function funHome(idx, getCat) {
  // 지난 방문 이후 새 계약 (이 기기에만 숫자 하나 저장)
  try {
    const tot = idx.cities.reduce((s, c) => s + (c.count || 0), 0), prev = Number(localStorage.getItem('mt-seen') || 0);
    const b = $('#newbadge');
    if (prev && tot > prev && b) { b.textContent = `지난 방문 이후 새 계약 ${(tot - prev).toLocaleString('ko-KR')}건`; b.hidden = false; }
    localStorage.setItem('mt-seen', String(tot));
  } catch (e) {}
  const live = idx.cities.filter((c) => c.count);
  // 아무 계약이나 하나
  const lb = $('#lucky-btn'), lc = $('#lucky-card');
  if (lb) lb.addEventListener('click', async () => {
    lb.disabled = true; lb.textContent = '뽑는 중…';
    try {
      let pick = Math.random() * live.reduce((s, c) => s + c.count, 0), city = live[0];
      for (const c of live) { pick -= c.count; if (pick <= 0) { city = c; break; } }
      const d = await getJSON('data/city/' + city.slug + '.json');
      const r = d.rows[Math.floor(Math.random() * d.rows.length)];
      lc.replaceChildren(receiptCard(r, city));
    } catch (e) { lc.replaceChildren(emptyBox('불러오지 못했어요', '잠시 후 다시 눌러 보세요.')); }
    lb.disabled = false; lb.textContent = '하나 더 뽑기';
  });
  // 이번 주 영수증: 보일 때만 시 데이터를 불러옴
  const tb = $('#rcpt tbody'); if (!tb) return;
  tb.append(Object.assign(el('tr'), {innerHTML: '<td colspan="2">영수증을 모으는 중…</td>'}));
  whenNear($('#receipts'), async () => {
    const all = [];
    const last = idx.updated ? new Date(idx.updated) : new Date(); const cut = new Date(last - 7 * 864e5).toISOString().slice(0, 10);
    await Promise.all(live.map((c) => getJSON('data/city/' + c.slug + '.json').then((d) => { for (const r of d.rows) if ((r.odate || r.date) >= cut) all.push({...r, city: c}); }).catch(() => {})));
    let key = 'amount', n = 10, lastCat = null;
    const btns = document.querySelectorAll('#rcpt th button');
    const draw = () => {
      const cat = getCat(); if (cat !== lastCat) { lastCat = cat; } festNote($('#rcpt').closest('.rcpt-wrap') || $('#rcpt'), cat === FEST);
      const list = all.filter((r) => cat === '전체' || r.cat === cat).sort((a, b) => key === 'amount' ? b.amount - a.amount : (b.date > a.date ? 1 : b.date < a.date ? -1 : b.amount - a.amount));
      tb.replaceChildren();
      for (const r of list.slice(0, n)) {
        const tr = el('tr', 'rc3'), a = el('a'); a.href = r.url || shareURL(r.city.slug); a.target = '_blank'; a.rel = 'noopener';
        const ch = el('span', 'rc-chips'); [r.city.short, r.cat, r.ftag || null, r.method && /수의/.test(r.method) ? '경쟁 없는 계약' : null, (r.date || '').slice(5).replace('-', '.')].filter(Boolean).forEach((x) => ch.append(el('i', '', x)));
        a.append(el('small', 'rc-ag', r.inst || ''), el('b', 'rc-amt', krw(r.amount)), ch); a.title = r.title || '';
        const t2 = el('td'); t2.colSpan = 2; t2.append(a);
        tr.append(el('td', 'rc-no', String(tb.children.length + 1).padStart(2, '0')), t2); tb.append(tr);
      }
      if (!list.length) tb.append(Object.assign(el('tr'), {innerHTML: '<td colspan="2">이번 주 해당 계약이 없어요</td>'}));
      const m = $('#rcpt-more'); m.hidden = list.length <= n;
    };
    btns.forEach((b) => b.addEventListener('click', () => { key = b.dataset.k; btns.forEach((x) => { x.setAttribute('aria-pressed', x === b); x.textContent = (x.dataset.k === 'date' ? '날짜' : '금액') + (x === b ? ' ↓' : ''); }); draw(); }));
    $('#rcpt-more').addEventListener('click', () => { n += 20; draw(); });
    document.querySelectorAll('#hero-chips button').forEach((b) => b.addEventListener('click', () => setTimeout(draw)));
    draw();
  });
}
async function homePage() {
  let idx;
  try { idx = await getJSON('data/index.json'); } catch (e) { idx = null; }
  if (!idx || !idx.cities || !idx.cities.some((c) => c.count)) {
    document.body.classList.add('is-empty');
    $('#nat-total').textContent = '곧 공개';
    $('#nat-count').textContent = '첫 데이터를 모으는 중';
    $('#cities').append(emptyBox('데이터를 모으고 있어요', '첫 수집이 끝나면 85개 시가 여기에 나타납니다. 조금만 기다려 주세요.', true));
    $('#q').disabled = true;
    alertList($('#nat-alerts-list'), [], {empty: emptyBox('곧 첫 패턴이 올라옵니다', '공개 계약을 매시간 자동으로 살펴, 눈에 띄는 숫자를 여기에 카드로 보여드릴게요.')});
    return;
  }
  $('#updated').textContent = when(idx.updated);
  $('#days').textContent = idx.days;
  let cat = '전체';
  // 분야를 고르면 그 분야 숫자로 바꿔 보는 값들
  const T = (c) => (cat === '전체' ? c.total : (c.by_cat || {})[cat] || 0);
  const N = (c) => (cat === '전체' ? c.count : (c.n_cat || {})[cat] || 0);
  const A = (c) => (cat === '전체' ? c.alerts : (c.alerts_cat || {})[cat] || 0);
  const TA = (c) => (cat === '전체' ? c.top_alert : (c.top_alert_cat || {})[cat]);
  let cities = idx.cities.slice();
  const sum = (f) => cities.reduce((s, c) => s + (f(c) || 0), 0);
  const catTot = {};
  for (const c of cities) for (const [k, v] of Object.entries(c.by_cat || {})) catTot[k] = (catTot[k] || 0) + v;
  const catList = Object.keys(catTot).filter((k) => catTot[k] > 0).sort((a, b) => catTot[b] - catTot[a]);
  const heroDays = () => { const l = window.__pdLabel && window.__pdLabel(); const k = $('#days') && $('#days').parentNode; if (l && k) { k.firstChild.textContent = '전국 85개 시가 '; $('#days').textContent = l; $('#days').nextSibling.textContent = /^최근/.test(l) ? ' 동안 ' : ' '; } };
  window.__mtPeriod = (i2) => { const B = {}; for (const c of i2.cities || []) B[c.slug] = c; for (const c of cities) if (B[c.slug]) Object.assign(c, B[c.slug]); idx.days = i2.days; heroDays(); setCat(cat); };
  setTimeout(heroDays, 0); setTimeout(heroDays, 1500);
  let mapCtl = null, draw = () => {}, alertsDraw = () => {};
  const setCat = (c) => {
    cat = c;
    countUp($('#nat-total'), sum(T));
    const w = $('#wage'); if (w) { w.replaceChildren(); w.append(`최저임금으로 ${Math.round(sum(T) / MINWAGE / 8 / 365).toLocaleString('ko-KR')}년 일해야 버는 돈`); w.append(el('small', '', '2026년 최저임금 시간당 10,320원(고용노동부 고시), 하루 8시간·매일 일한다고 가정')); }
    $('#hero-k').textContent = cat === '전체' ? '계약으로 쓴 돈' : cat + ' 계약에 쓴 돈';
    $('#nat-count').textContent = (cat === '전체' ? '' : cat + ' ') + '계약 ' + sum(N).toLocaleString('ko-KR') + '건';
    $('#nat-alerts-n').textContent = `전국 ${sum(A).toLocaleString('ko-KR')}건 중 시마다 하나씩.`;
    cities.sort((a, b) => A(b) - A(a) || T(b) - T(a));
    draw($('#q').value.trim()); alertsDraw();
    if (mapCtl) mapCtl.setCat(cat);
    window.__mtCat = cat; window.__dvCat && window.__dvCat(cat);
  };
  if (catList.length) chips($('#hero-chips'), ['전체', ...catList], setCat); else $('#hero-chips').remove();

  let showAll = false;
  draw = (q) => {
    const box = $('#cities'); box.replaceChildren();
    const list = cities.filter((c) => !q || (c.name + c.short + c.province).includes(q));
    const shown = q || showAll ? list : list.slice(0, 6);
    for (const c of shown) {
      const a = el('a', 'city'); a.href = 'city.html?c=' + c.slug;
      const n = el('span', 'n', c.short); n.append(el('span', 'm', `${krw(T(c))} · ${N(c).toLocaleString('ko-KR')}건`));
      const r = el('span', 'r'); r.append(el('span', 'badge ' + (A(c) ? 'on' : 'off'), A(c) ? `징후 ${A(c)}` : '징후 없음'), el('span', 'chev', '›'));
      a.append(n, r); box.append(a);
    }
    if (!list.length) box.append(emptyBox('찾는 시가 없어요', '시 이름만 입력해 보세요. 예: 수원, 창원'));
    if (!q && !showAll && list.length > 6) {
      const m = el('button', 'more', `85개 시 모두 보기`); m.type = 'button'; m.addEventListener('click', () => { showAll = true; draw(''); }); box.append(m);
    }
  };
  $('#q').addEventListener('input', (e) => draw(e.target.value.trim()));
  alertsDraw = () => {
    const top = cities.filter((c) => TA(c)).slice(0, 6).map((c) => ({...TA(c), slug: c.slug, city: c.short, detail: c.short + ' · ' + TA(c).detail}));
    alertList($('#nat-alerts-list'), top, {link: true});
  };
  { const q0 = (new URLSearchParams(location.search).get('cat') || '').replace(/\s+/g, ''); const AL = {'축제': '축제 공연·섭외', '공연': '축제 공연·섭외', '섭외': '축제 공연·섭외'};
    const qc = q0 && (catList.find((k) => k.replace(/\s+/g, '') === q0) || (AL[q0] && catList.includes(AL[q0]) ? AL[q0] : null) || catList.find((k) => k.replace(/\s+/g, '').startsWith(q0)) || catList.find((k) => k.includes(q0))); const ok = !!qc;
    if (ok) setTimeout(() => document.getElementById('dive')?.scrollIntoView({block: 'start'}), 600);
    setCat(ok ? qc : '전체'); if (ok) document.querySelectorAll('#hero-chips button').forEach((b) => { const on = b.textContent.trim() === qc; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); }
  if (window.moneyMap && $('#map')) whenNear($('#map'), () => moneyMap($('#map')).then((m) => { mapCtl = m; if (cat !== '전체') m.setCat(cat); }).catch(() => $('#map').remove()));
  funHome(idx, () => cat);
  if ($('#rank-list')) getJSON('data/rank.json').then((d) => rankList($('#rank-list'), d, {limit: 10, home: true})).catch(() => $('#ranksec').remove());
}

// ---------- 전국 업체 순위 ----------
const PROV_FULL={서울:'서울특별시',부산:'부산광역시',대구:'대구광역시',인천:'인천광역시',광주:'광주광역시',대전:'대전광역시',울산:'울산광역시',세종:'세종특별자치시',경기:'경기도',강원:'강원특별자치도',강원도:'강원특별자치도',충북:'충청북도',충남:'충청남도',전북:'전북특별자치도',전라북도:'전북특별자치도',전남:'전라남도',경북:'경상북도',경남:'경상남도',제주:'제주특별자치도',제주도:'제주특별자치도'};
const normProv=(p)=>PROV_FULL[p]||PROV_FULL[(p||'').replace(/(특별자치시|특별자치도|특별시|광역시)$/,'')]||p;
function rankList(box, d, opts = {}) {
  let sortK = 'total', prov = '';
  const PROV = (r) => normProv((r.region || '').split(' ')[0]);
  const draw = () => {
    box.replaceChildren();
    let list = d.vendors.filter((v) => !prov || PROV(v) === prov);
    list = list.slice().sort((a, b) => b[sortK] - a[sortK] || b.total - a.total).slice(0, opts.limit || 100);
    list.forEach((v, i) => {
      const a = el('a', 'rrow'); a.href = 'vendor.html?v=' + v.id;
      const n = el('span', 'rn', String(i + 1));
      const m = el('span', 'rm'); m.append(el('b', '', v.name), el('small', '', (v.region || '소재지 확인 중') + ` · ${v.count.toLocaleString('ko-KR')}건 · ${v.nc}개 시`));
      a.append(n, m, el('span', 'ra', sortK === 'count' ? v.count.toLocaleString('ko-KR') + '건' : sortK === 'nc' ? v.nc + '개 시' : krw(v.total)), el('span', 'chev', '›'));
      box.append(a);
    });
    if (!list.length) box.append(emptyBox('해당하는 업체가 없어요', '다른 시·도를 골라 보세요.'));
  };
  const tools = $('#rank-tools');
  if (tools && !opts.home) {
    const seg = el('div', 'seg'); seg.setAttribute('role', 'group');
    for (const [k, t] of [['total', '받은 돈'], ['count', '계약 수'], ['nc', '돈 준 시 수']]) {
      const b = el('button', '', t); b.type = 'button'; b.dataset.v = k; b.setAttribute('aria-pressed', k === sortK);
      b.addEventListener('click', () => { sortK = k; seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); draw(); }); seg.append(b);
    }
    const sel = el('select', 'cityselect'); sel.setAttribute('aria-label', '업체 소재 시·도');
    sel.append(Object.assign(el('option', '', '전국 업체'), {value: ''}));
    [...new Set(d.vendors.map(PROV).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')).forEach((p) => sel.append(Object.assign(el('option', '', p + ' 업체'), {value: p})));
    sel.addEventListener('change', () => { prov = sel.value; draw(); });
    tools.append(seg, sel);
  }
  const pr = d.period || {};
  document.querySelectorAll('.rank-period').forEach((e) => (e.textContent = `수집된 기간 기준: ${pr.first || '—'} ~ ${pr.last || '—'}, ${pr.cities || 85}개 시 · 업체 ${(d.total_vendors || d.vendors.length).toLocaleString('ko-KR')}곳`));
  draw();
}

async function rankPage() {
  try { const d = await getJSON('data/rank.json'); $('#updated').textContent = when(d.updated); rankList($('#rank-list'), d); }
  catch (e) { $('#rank-list').append(emptyBox('순위를 준비하고 있어요', '첫 집계가 끝나면 나타납니다.')); }
}

// ---------- 업체 모아 보기 ----------
function corpInfo(c) {
  const box = $('#v-corp'), ib = $('#v-inds');
  if (!c) { box.append(el('p', 'sub', '이 업체의 나라장터 등록 정보는 아직 받지 않았습니다(순위 상위·이상 징후 업체부터 차례로 받습니다).')); return; }
  const now = new Date(), y = (s) => +s.slice(0, 4);
  const age = (s) => now.getFullYear() - y(s);
  const fact = (k, v) => { const f = el('div', 'fact'); f.append(el('span', 'fk', k), el('span', 'fv', v)); box.append(f); };
  if (c.opbiz) fact('설립', `${y(c.opbiz)}년 · ${age(c.opbiz)}년차`);
  if (c.rgst) fact('나라장터 등록', `${c.rgst.slice(0, 7).replace('-', '.')} · ${age(c.rgst)}년차`);
  if (c.bsns) fact('조달 구분', c.bsns);
  if (c.emp) fact('종업원 수', c.emp.toLocaleString('ko-KR') + '명');
  if (c.inds && c.inds.length) {
    ib.append(el('h3', '', `등록 업종 ${c.inds.length}개`));
    const ul = el('ul', 'indlist');
    c.inds.forEach((i, n) => { const li = el('li', i.rep ? 'rep' : ''); li.append(el('span', '', i.n + (i.rep ? ' · 대표' : '')), el('small', '', i.d ? i.d.slice(0, 4) + '년 등록' : '')); if (n >= 6) li.hidden = true; ul.append(li); });
    ib.append(ul);
    if (c.inds.length > 6) { const m = el('button', 'more', `업종 ${c.inds.length - 6}개 더 보기`); m.type = 'button'; m.onclick = () => { ul.querySelectorAll('li[hidden]').forEach((x) => (x.hidden = false)); m.remove(); }; ib.append(m); }
  }
  $('#v-corp-src').textContent += ` 받은 날: ${c.at}.`;
}

// 계약 한 건의 차수 이력·공동도급 (조달청 나라장터 계약정보서비스)
function contractExtra(r) {
  const out = [];
  const sgn = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + krw(Math.abs(x));
  if (r.jv && r.jvp && !(r.jvm && r.jvm.length)) out.push(el('span', 'cc-tags', '여러 업체가 함께 맡은 계약 · 참여 업체 확인 중'));
  if (r.jvm && r.jvm.length) {
    const j = el('div', 'cc-jv'); j.append(el('span', 'cc-tags', '함께 맡은 업체 (나눈 비율)'));
    for (const m of r.jvm) {
      const t = m.id ? el('a', '', `${m.name} ${m.share != null ? m.share + '%' : ''}`) : el('span', '', `${m.name} ${m.share != null ? m.share + '%' : ''}`);
      if (m.id) t.href = 'vendor.html?v=' + m.id;
      j.append(t);
    }
    out.push(j);
  } else if (r.jv) out.push(el('span', 'cc-tags', '여러 업체가 함께 맡음 · 금액은 대표 업체 기준'));
  if ((r.ltc || /^장기/.test(r.lt||'')) && r.this && r.this !== r.amount) out.push(el('span', 'cc-tags', `장기계속계약 · 총 계약금액 ${krw(r.amount)} 기준 (이번 연차분 ${krw(r.this)})`));
  if (r.vers && r.vers.length > 1) {
    if (r.orig) { const up = r.amount - r.orig; out.push(el('span', 'cc-hist', `처음 ${krw(r.orig)} → 지금 ${krw(r.amount)} (${up >= 0 ? '+' : ''}${(up / r.orig * 100).toFixed(1)}%)`)); }
    const ol = el('ol', 'tl');
    r.vers.forEach((v, i) => {
      const p = r.vers[i - 1]; const li = el('li');
      const d = p && v.tot != null && p.tot != null ? v.tot - p.tot : null;
      li.append(el('b', '', `${+v.ord}차`), el('span', '', `${v.date || ''} · 총 ${v.tot != null ? krw(v.tot) : '—'}` + (v.this && v.this !== v.tot ? ` (이번 연차분 ${krw(v.this)})` : '')),
        el('small', '', i === 0 ? '처음 계약' : d ? '금액 변경 ' + sgn(d) : '총액 변화 없음 (기간·조건 등 변경)'));
      ol.append(li);
    });
    out.push(ol);
  } else if (r.hist && r.hist.length) {
    const o = r.hist[0], up = r.amount - o.amount;
    out.push(el('span', 'cc-hist', `확인된 첫 ${+o.ord}차(${o.date}) ${krw(o.amount)} → 지금 ${krw(r.amount)}` + (o.amount ? ` (${up >= 0 ? '+' : ''}${Math.round(up / o.amount * 100)}%)` : '')));
  } else if (r.ord && +r.ord > 1) {
    out.push(el('span', 'cc-tags', `${+r.ord}차 계약 · 차수별 금액은 계약정보서비스에서 금액 큰 계약부터 차례로 받는 중입니다.`));
  }
  if (r.vers || r.jvm) out.push(el('span', 'cc-src', '차수·참여 업체 출처: 조달청 나라장터 계약정보서비스'));
  return out;
}

async function pastHistory(id) {
  let p = null, m = null;
  try { m = await getJSON('data/past/_meta.json'); } catch (e) { return; }
  try { p = await getJSON('data/past/' + id + '.json'); } catch (e) { p = null; }
  const sec = $('#v-past-sec'); if (!sec) return;
  const range = m && m.oldest ? `${m.oldest.replaceAll('-', '.')} ~ ${m.newest.replaceAll('-', '.')}` : '';
  $('#v-past-note').textContent = range ? `지금까지 ${range} (${m.days_done}일치)를 모았습니다. 매일 조금씩 더 과거로 채워집니다.` : '과거 계약을 하루씩 거슬러 올라가며 모으는 중입니다.';
  const box = $('#v-past'); box.replaceChildren();
  const rows = (p && p.rows) || [];
  if (!rows.length) { box.append(el('p', 'note', '최근 계약은 위 \'계약 목록\'에 모두 있어요. 여기는 그보다 오래된 계약을 모으는 곳인데, 이 업체의 오래된 계약은 아직 찾지 못했어요. 매일 더 과거로 모으는 중이에요.')); return; }
  const tot = rows.reduce((a, r) => a + (r.tot || 0), 0);
  box.append(el('p', 'note', `${rows.length.toLocaleString('ko-KR')}건 · 총 계약금액 합계 ${krw(tot)}`));
  for (const r of rows.slice(0, 200)) {
    const c = el('div', 'cc');
    const top = el('div', 'cc-top'); top.append(el('span', 'cc-d', `${r.date} · ${r.city || '기타 기관'} · ${r.kind}`), el('b', 'cc-a', r.tot != null ? krw(r.tot) : '—'));
    const t = r.url ? el('a', 'cc-t', r.title) : el('span', 'cc-t', r.title); if (r.url) { t.href = r.url; t.target = '_blank'; t.rel = 'noopener'; }
    c.append(top, t, el('span', 'cc-i', r.inst + (r.atype && r.atype !== '본청' ? ` [${r.atype}]` : '') + (r.ord ? ` · ${+r.ord}차` : '') + ((r.ltc || /^장기/.test(r.lt||'')) && r.this && r.this !== r.amount ? ` · 장기계속(이번 연차분 ${krw(r.this)})` : '')));
    if (r.m && r.m.length > 1) {
      const j = el('div', 'cc-jv'); j.append(el('span', 'cc-tags', '함께 맡은 업체 (나눈 비율)'));
      for (const x of r.m) { const a = el(x.id && x.id !== id ? 'a' : 'span', '', `${x.name} ${x.share != null ? x.share + '%' : ''}`); if (x.id && x.id !== id) a.href = 'vendor.html?v=' + x.id; j.append(a); }
      c.append(j);
    }
    box.append(c);
  }
}

async function vendorPage() {
  const id = new URLSearchParams(location.search).get('v');
  pastHistory(id);
  let d;
  try { if (!/^[0-9a-zn]+$/.test(id || '')) throw 0; d = await getJSON('data/vendor/' + id + '.json'); } catch (e) {
    $('#title').textContent = '없는 업체입니다'; $('#vregion').replaceChildren('주소가 바뀌었거나 수집 기간에 계약이 없어요. ', Object.assign(el('a', '', '순위 보기 ›'), {href: 'rank.html'})); document.querySelectorAll('.sec, .stats, #stabs').forEach((x) => x.remove()); return;
  }
  document.title = d.name + ' · 우리 시 돈 추적기';
  $('#title').textContent = d.name;
  $('#vregion').textContent = (d.region || '소재지 확인 중') + (d.name === '개인사업자' ? ' · 개인 이름일 수 있어 가렸습니다' : '');
  $('#period').textContent = `수집된 기간 기준: ${d.period.first} ~ ${d.period.last}, ${d.period.cities}개 시`;
  $('#k-total').textContent = krw(d.total); $('#k-count').textContent = d.count.toLocaleString('ko-KR') + '건';
  $('#k-nc').textContent = d.cities.length + '개 시'; $('#k-ni').textContent = `기관 ${d.insts.length}곳`;
  corpInfo(d.corp);
  bars($('#v-cities'), d.cities.slice(0, 10), (r) => r.name, (r) => r.amount, (r) => r.count + '건');
  bars($('#v-insts'), d.insts.slice(0, 10), (r) => r.name, (r) => r.amount, (r) => r.count + '건');
  // 달별
  const mb = $('#v-months'); const ms = Object.entries(d.months); const mx = Math.max(1, ...ms.map((x) => x[1]));
  for (const [m, a] of ms) { const c = el('div', 'mcol'); const i = el('i'); i.style.height = Math.max(3, (a / mx) * 100) + '%'; c.append(el('span', 'mv', krw(a)), el('div', 'mbar'), el('span', 'mk', +m.slice(5) + '월')); c.children[1].append(i); mb.append(c); }
  // 분야별 → 누르면 계약 목록이 그 분야로
  let cat = null;
  const cb = $('#v-cats');
  const drawCats = () => {
    cb.replaceChildren();
    for (const c of d.cats) {
      const b = el('button', 'catrow' + (cat === c.cat ? ' on' : '')); b.type = 'button'; b.setAttribute('aria-pressed', cat === c.cat);
      const l = el('span', 'cn', c.cat); l.append(el('small', '', c.count.toLocaleString('ko-KR') + '건'));
      b.append(l, el('span', 'cp', pct(c.amount / (d.total || 1))), el('span', 'ca', krw(c.amount)));
      const bar = el('i', 'cbar'); bar.style.width = Math.max(2, (c.amount / (d.total || 1)) * 100) + '%'; b.append(bar);
      b.addEventListener('click', () => { cat = cat === c.cat ? null : c.cat; drawCats(); drawRows(); location.hash = 'v-rows-sec'; });
      cb.append(b);
    }
  };
  const drawRows = () => {
    const box = $('#v-rows'); box.replaceChildren();
    const rows = cat ? d.rows.filter((r) => r.cat === cat) : d.rows;
    $('#v-rows-n').textContent = (cat ? cat + ' · ' : '') + rows.length.toLocaleString('ko-KR') + '건' + (cat ? ' (다시 누르면 전체)' : ''); festNote($('#v-rows-n'), cat === FEST);
    for (const r of rows.slice(0, 300)) {
      const c = el('article', 'ccard');
      const top = el('div', 'cc-top'); top.append(el('span', 'cc-d', (r.odate || r.date) + ' · ' + r.cat), el('b', 'cc-a', krw(r.amount)));
      if (r.chg) { const b = el('i', 'sole-badge', '변경'); b.title = `${+r.ord}차 변경 ${r.date}${r.odate ? ' · 원계약 ' + r.odate : ' · 원계약은 수집 기간 전'} · 금액은 변경 후 총계약금액`; top.append(b); }
      if (r.cat === FEST && r.ftag) top.append(el('i', 'sole-badge ftag', r.ftag));
      if (r.cat === FEST && /수의/.test(r.method || '')) top.append(el('i', 'sole-badge', '경쟁 없는 계약'));
      const t = r.url ? el('a', 'cc-t', r.title) : el('span', 'cc-t', r.title); if (r.url) { t.href = r.url; t.target = '_blank'; t.rel = 'noopener'; }
      c.append(top, t, el('span', 'cc-i', r.inst + (r.method ? ' · ' + r.method : '')));
      c.append(...contractExtra(r));
      if (r.url) { const s2 = el('a', 'src', '출처: 조달청 나라장터 원문 ›'); s2.href = r.url; s2.target = '_blank'; s2.rel = 'noopener'; c.append(s2); }
      box.append(c);
    }
    const ch = (cat ? (d.changes || []).filter((r) => r.cat === cat) : (d.changes || []));
    if (ch.length) {
      const det = el('details', 'chg-old'); det.append(el('summary', '', `기간 전에 맺은 계약의 변경 ${ch.length.toLocaleString('ko-KR')}건 · 위 건수·합계에서 제외`));
      for (const r of ch.slice(0, 100)) {
        const c = el('article', 'ccard'); const top = el('div', 'cc-top');
        top.append(el('span', 'cc-d', '변경일 ' + r.date), el('b', 'cc-a', krw(r.amount)), el('i', 'sole-badge', '변경 ' + (+r.ord) + '차'));
        const t = r.url ? el('a', 'cc-t', r.title) : el('span', 'cc-t', r.title); if (r.url) { t.href = r.url; t.target = '_blank'; t.rel = 'noopener'; }
        c.append(top, t, el('span', 'cc-i', r.inst + (r.oy ? ' · 계약번호 기준 ' + r.oy + '년 등록' : '') + ' · 금액은 변경 후 총계약금액')); det.append(c);
      }
      box.append(det);
    }
  };
  drawCats(); drawRows();
  alertList($('#v-alerts'), d.alerts.filter((a) => a.kind !== 'big'), {link: true, limit: 4, empty: emptyBox('데이터상 이상 징후 없음', '이 업체가 들어간 자동 패턴이 없습니다.')});
  $('#share-v').replaceWith(shareBtn(location.href, d.name + ' · 우리 시 돈 추적기', 'sharebtn big'));
}

// ---------- 시 상세 ----------
function stats(city, rows) {
  const key = city.name.replace('특별시', '').replace('광역시', '').replace('특별자치시', '');
  let total = 0, known = 0, local = 0; const inst = {}, ven = {}, reg = {};
  for (const r of rows) {
    total += r.amount;
    (inst[r.inst] ||= {name: r.inst, amount: 0, count: 0}); inst[r.inst].amount += r.amount; inst[r.inst].count++;
    if (r.vendor) { const k = r.bh || r.vendor; (ven[k] ||= {name: r.vendor, id: r.bh, amount: 0, count: 0}); ven[k].amount += r.amount; ven[k].count++; ven[k].region = r.vregion; }
    if (r.vregion) {
      known += r.amount; const p = r.vregion.split(' ')[0]; reg[p] = (reg[p] || 0) + r.amount;
      if (r.vregion.includes(city.name) || r.vregion.startsWith(key)) local += r.amount;
    }
  }
  const top = (o) => Object.values(o).sort((a, b) => b.amount - a.amount).slice(0, 8);
  const dates = rows.map((r) => r.date).sort();
  return {total, count: rows.length, local: known ? local / known : null, known: total ? known / total : null, first: dates[0], last: dates[dates.length - 1],
    inst: top(inst), ven: top(ven), reg: Object.entries(reg).map(([region, amount]) => ({region, amount})).sort((a, b) => b.amount - a.amount).slice(0, 8)};
}

async function cityPage() {
  const slug = new URLSearchParams(location.search).get('c');
  let d;
  try { d = await getJSON('data/city/' + slug + '.json'); } catch (e) {
    $('#title').textContent = '없는 지역입니다';
    $('#lede').replaceChildren('주소가 바뀌었거나 아직 추적하지 않는 곳이에요. ', Object.assign(el('a', '', '홈으로 가기 ›'), {href: './'}));
    document.querySelectorAll('.stats, .sec').forEach((s) => s.remove()); return;
  }
  const guQ = new URLSearchParams(location.search).get('gu');
  if (guQ && /^[가-힣]{1,6}구$/.test(guQ)) { const g = d.rows.filter((r) => (r.inst || '').includes(guQ)); if (g.length) { const ids = new Set(g.map((r) => r.id)); d.rows = g; d.alerts = d.alerts.filter((a) => (a.ids || []).some((i) => ids.has(i))); d.city = Object.assign({}, d.city, {short: d.city.short + ' ' + guQ}); } }
  const name = d.city.short;
  window.__citySlug = slug;
  if (window.regionBar) { document.body.classList.add('has-rbar'); regionBar(slug, (s2) => { location.href = 'city.html?c=' + s2 + location.hash; }); }
  document.querySelectorAll('.tracklinks a').forEach((a) => (a.href = a.getAttribute('href').replace('spend.html', 'spend.html?c=' + slug)));
  document.title = d.city.name + ' 돈 추적기';
  $('#title').textContent = name;
  $('#updated').textContent = when(d.updated);
  const shareTop = $('#share-city'); shareTop.replaceWith(shareBtn(shareURL(slug), d.city.name + ' 돈 추적기', 'sharebtn big'));
  const byId = new Map(d.rows.map((r) => [r.id, r]));
  const hasCat = d.rows.some((r) => r.cat);
  let q = '', cat = '전체', sortK = 'date', dir = -1;

  const render = () => {
    const rows = cat === '전체' ? d.rows : d.rows.filter((r) => r.cat === cat);
    const s = stats(d.city, rows);
    const alerts = cat === '전체' ? d.alerts : d.alerts.filter((a) => (a.ids || []).some((id) => (byId.get(id) || {}).cat === cat));
    const flagged = alerts.filter((a) => a.kind !== 'big').length;
    const what = cat === '전체' ? '' : `${cat} 분야에 `; festNote($('#lede'), cat === FEST);
    $('#range').textContent = s.first ? `${s.first.replaceAll('-', '.')} ~ ${s.last.replaceAll('-', '.')}` : '최근 90일';
    const jo = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 ? '은' : '는'; };
    $('#lede').replaceChildren('최근 90일, ', name + jo(name) + ' ' + what, el('b', '', krw(s.total)), '을 썼고, ',
      s.local == null ? '업체 주소는 확인 중입니다.' : el('b', '', `${pct(1 - s.local)}는 다른 지역 업체`), s.local == null ? '' : '로 갔습니다.');
    const mxr = rows.reduce((a, r) => (!a || r.amount > a.amount ? r : a), null);
    const big = mxr && s.total && mxr.amount / s.total > 0.3;
    let s2 = null; if (big) s2 = stats(d.city, rows.filter((r) => r !== mxr));
    const fr = big ? mxr.amount / s.total : 0; const frac = big ? (fr >= 0.48 && fr <= 0.52 ? `절반(약 ${Math.round(fr * 100)}%)` : `약 ${Math.round(fr * 100)}%`) : '';
    $('#k-total').textContent = krw(s.total); $('#k-count').textContent = `계약 ${s.count.toLocaleString('ko-KR')}건` + (big ? ` · 이 중 1건(${krw(mxr.amount)})이 ${frac} · 최대 계약 빼면 ${krw(s2.total)}` : '');
    const bn = $('#bignote'); if (bn) { bn.hidden = !big; if (big) { bn.replaceChildren('참고: 가장 큰 계약 1건 ', mxr.url ? Object.assign(el('a', '', mxr.title.slice(0, 40)), {href: mxr.url, target: '_blank', rel: 'noopener'}) : mxr.title.slice(0, 40), ` (${krw(mxr.amount)})이 전체의 ${pct(mxr.amount / s.total)}예요. 이 1건을 빼면 ${krw(s2.total)}` + (s2.local != null && s.local != null ? `, 다른 지역 업체 비율은 ${pct(1 - s.local)} → ${pct(1 - s2.local)}` : '') + '이에요.'); } }
    $('#k-out').textContent = s.local == null ? '—' : pct(1 - s.local);
    $('#k-local-s').textContent = (s.known == null ? '주소 확인 중' : `주소가 확인된 계약 ${pct(s.known)} 기준`) + (big && s2.local != null ? ` · 최대 계약 빼면 ${pct(1 - s2.local)}` : '');
    $('#k-alerts').textContent = flagged.toLocaleString('ko-KR') + '건';
    alertList($('#alerts-list'), alerts.filter((a) => a.kind !== 'big'), {slug, limit: 4});
    if (window.__cityTick) window.__cityTick(rows, name);
    $('#share-in').style.width = s.local == null ? '0' : Math.round(s.local * 100) + '%';
    $('#share-in-t').textContent = s.local == null ? '—' : pct(s.local);
    $('#share-out-t').textContent = s.local == null ? '—' : pct(1 - s.local);
    bars($('#regions'), s.reg, (r) => r.region, (r) => r.amount);
    bars($('#vendors'), s.ven, (r) => r.name, (r) => r.amount, (r) => (r.region || '주소 확인 중') + ` · ${r.count}건`, (r) => r.id && 'vendor.html?v=' + r.id);
    bars($('#insts'), s.inst, (r) => r.name, (r) => r.amount, (r) => r.count + '건');
    table(rows);
  };

  const tbl = $('#contracts table');
  let cur = d.rows;
  const table = (rows = cur) => {
    cur = rows;
    const tb = tbl.querySelector('tbody'); tb.replaceChildren();
    tbl.querySelectorAll('th').forEach((th) => th.setAttribute('aria-sort', th.querySelector('button')?.dataset.k === sortK ? (dir > 0 ? 'ascending' : 'descending') : 'none'));
    let list = q ? rows.filter((r) => (r.title + r.vendor + r.inst + (r.vregion || '')).includes(q)) : rows;
    $('#all-n').textContent = list.length.toLocaleString('ko-KR') + '건';
    list = list.slice().sort((a, b) => ((a[sortK] ?? '') < (b[sortK] ?? '') ? -1 : (a[sortK] ?? '') > (b[sortK] ?? '') ? 1 : 0) * dir).slice(0, 1500);
    for (const r of list) {
      const tr = el('tr');
      const title = el('td', 'ttl'); if (r.url) { const a = el('a', '', r.title); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; title.append(a); } else title.textContent = r.title;
      if (r.orig && r.orig !== r.amount) { const up = r.amount - r.orig; title.append(el('small', 'cc-hist', ` 1차 ${krw(r.orig)} → ${up >= 0 ? '+' : ''}${(up / r.orig * 100).toFixed(1)}%`)); }
      else if (r.vers && r.vers.length > 1) title.append(el('small', 'cc-tags', ` ${r.vers.length}개 차수 확인 · 총액 변화 없음`));
      if (r.jvm && r.jvm.length > 1) title.append(el('small', 'cc-tags', ' 함께 맡은 업체: ' + r.jvm.map((m) => `${m.name} ${m.share != null ? m.share + '%' : ''}`).join(', ')));
      tr.append(el('td', '', r.date), el('td', 'hide-narrow', r.inst), title, el('td', '', r.vendor), el('td', 'hide-narrow', r.vregion || '—'), el('td', 'num', r.amount.toLocaleString('ko-KR')));
      tb.append(tr);
    }
  };
  tbl.querySelectorAll('th button').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.k; if (k === sortK) dir *= -1; else { sortK = k; dir = k === 'amount' || k === 'date' ? -1 : 1; } table(); }));
  $('#cq').addEventListener('input', (e) => { q = e.target.value.trim(); table(); });
  if (hasCat) {
    const amt = {}; for (const r of d.rows) amt[r.cat] = (amt[r.cat] || 0) + r.amount;
    const present = ['전체', ...Object.keys(amt).filter((c) => c && amt[c] > 0).sort((x, y) => amt[y] - amt[x])];
    chips($('#cats'), present, (c) => { cat = c; render(); });
  } else $('#cats').remove();
  render();
  if (window.moneyMap && $('#map')) moneyMap($('#map'), {fixed: slug, rows: 5}).catch(() => $('#map').remove());
  if (location.hash && location.hash !== '#map') { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
}

document.addEventListener('DOMContentLoaded', () => {
  const pg = document.body.dataset.page;
  if (pg === 'home') homePage();
  if (pg === 'city') cityPage();
  if (pg === 'rank') rankPage();
  if (pg === 'vendor') vendorPage();
});
