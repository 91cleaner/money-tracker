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
const LABEL = {split: '같은 날 나눠진 계약', threshold: '금액선 근처', repeat: '같은 업체 반복', big: '1억 이상'};
const CATS = ['전체', '청소', '시설관리', '경비', '건설·공사', '용역·연구', '인쇄·홍보', '물품', '기타'];
const SOURCE = 'https://www.g2b.go.kr';
const BASE = location.href.replace(/[^/]*([?#].*)?$/, '');
const shareURL = (slug, key) => BASE + 'c/' + slug + '.html' + (key ? '#' + key : '');

async function getJSON(path) {
  const r = await fetch(path + '?t=' + Math.floor(Date.now() / 600000));
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}

async function share(url, title, btn) {
  if (navigator.share) { try { await navigator.share({title, url}); } catch (e) {} return; }
  try { await navigator.clipboard.writeText(url); } catch (e) { prompt('링크를 복사하세요', url); return; }
  const old = btn.textContent; btn.textContent = '링크 복사됨'; setTimeout(() => (btn.textContent = old), 1600);
}
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
    it.append(top, el('span', 't', a.title));
    if (a.amount != null) it.append(el('span', 'a', krw(a.amount)));
    it.append(el('span', 'd', a.detail));
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
  let mapCtl = null, draw = () => {}, alertsDraw = () => {};
  const setCat = (c) => {
    cat = c;
    $('#nat-total').textContent = krw(sum(T));
    $('#hero-k').textContent = cat === '전체' ? '계약으로 쓴 돈' : cat + ' 계약에 쓴 돈';
    $('#nat-count').textContent = (cat === '전체' ? '' : cat + ' ') + '계약 ' + sum(N).toLocaleString('ko-KR') + '건';
    $('#nat-alerts-n').textContent = `전국 ${sum(A).toLocaleString('ko-KR')}건 중 시마다 하나씩.`;
    cities.sort((a, b) => A(b) - A(a) || T(b) - T(a));
    draw($('#q').value.trim()); alertsDraw();
    if (mapCtl) mapCtl.setCat(cat);
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
  setCat('전체');
  if (window.moneyMap && $('#map')) moneyMap($('#map')).then((m) => { mapCtl = m; if (cat !== '전체') m.setCat(cat); }).catch(() => $('#map').remove());
  if ($('#rank-list')) getJSON('data/rank.json').then((d) => rankList($('#rank-list'), d, {limit: 10, home: true})).catch(() => $('#ranksec').remove());
}

// ---------- 전국 업체 순위 ----------
function rankList(box, d, opts = {}) {
  let sortK = 'total', prov = '';
  const PROV = (r) => (r.region || '').split(' ')[0];
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
async function vendorPage() {
  const id = new URLSearchParams(location.search).get('v');
  let d;
  try { if (!/^[0-9a-zn]+$/.test(id || '')) throw 0; d = await getJSON('data/vendor/' + id + '.json'); } catch (e) {
    $('#title').textContent = '업체를 찾지 못했어요'; document.querySelectorAll('.sec, .stats').forEach((x) => x.remove()); return;
  }
  document.title = d.name + ' · 우리 시 돈 추적기';
  $('#title').textContent = d.name;
  $('#vregion').textContent = (d.region || '소재지 확인 중') + (d.name === '개인사업자' ? ' · 개인 이름일 수 있어 가렸습니다' : '');
  $('#period').textContent = `수집된 기간 기준: ${d.period.first} ~ ${d.period.last}, ${d.period.cities}개 시`;
  $('#k-total').textContent = krw(d.total); $('#k-count').textContent = d.count.toLocaleString('ko-KR') + '건';
  $('#k-nc').textContent = d.cities.length + '개 시'; $('#k-ni').textContent = `기관 ${d.insts.length}곳`;
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
      b.addEventListener('click', () => { cat = cat === c.cat ? null : c.cat; drawCats(); drawRows(); $('#v-rows-sec').scrollIntoView({behavior: 'smooth'}); });
      cb.append(b);
    }
  };
  const drawRows = () => {
    const box = $('#v-rows'); box.replaceChildren();
    const rows = cat ? d.rows.filter((r) => r.cat === cat) : d.rows;
    $('#v-rows-n').textContent = (cat ? cat + ' · ' : '') + rows.length.toLocaleString('ko-KR') + '건' + (cat ? ' (다시 누르면 전체)' : '');
    for (const r of rows.slice(0, 300)) {
      const c = el('article', 'ccard');
      const top = el('div', 'cc-top'); top.append(el('span', 'cc-d', r.date + ' · ' + r.cat), el('b', 'cc-a', krw(r.amount)));
      const t = r.url ? el('a', 'cc-t', r.title) : el('span', 'cc-t', r.title); if (r.url) { t.href = r.url; t.target = '_blank'; t.rel = 'noopener'; }
      c.append(top, t, el('span', 'cc-i', r.inst + (r.method ? ' · ' + r.method : '')));
      if (r.url) { const s2 = el('a', 'src', '출처: 조달청 나라장터 원문 ›'); s2.href = r.url; s2.target = '_blank'; s2.rel = 'noopener'; c.append(s2); }
      box.append(c);
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
    $('#title').textContent = '아직 데이터가 없어요';
    $('#lede').textContent = '첫 수집이 끝나면 이 시의 계약이 여기에 나타납니다. 조금만 기다려 주세요.';
    document.querySelectorAll('.stats, .sec').forEach((s) => s.remove()); return;
  }
  const name = d.city.short;
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
    const what = cat === '전체' ? '' : `${cat} 분야에 `;
    $('#range').textContent = s.first ? `${s.first.replaceAll('-', '.')} ~ ${s.last.replaceAll('-', '.')}` : '최근 90일';
    $('#lede').replaceChildren('최근 90일, ', name + '는 ' + what, el('b', '', krw(s.total)), '을 썼고, ',
      s.local == null ? '업체 주소는 확인 중입니다.' : el('b', '', `${pct(1 - s.local)}는 다른 지역 업체`), s.local == null ? '' : '로 갔습니다.');
    $('#k-total').textContent = krw(s.total); $('#k-count').textContent = `계약 ${s.count.toLocaleString('ko-KR')}건`;
    $('#k-out').textContent = s.local == null ? '—' : pct(1 - s.local);
    $('#k-local-s').textContent = s.known == null ? '주소 확인 중' : `주소가 확인된 계약 ${pct(s.known)} 기준`;
    $('#k-alerts').textContent = flagged.toLocaleString('ko-KR') + '건';
    alertList($('#alerts-list'), alerts, {slug, limit: 4});
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
  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
}

document.addEventListener('DOMContentLoaded', () => {
  const pg = document.body.dataset.page;
  if (pg === 'home') homePage();
  if (pg === 'city') cityPage();
  if (pg === 'rank') rankPage();
  if (pg === 'vendor') vendorPage();
});
