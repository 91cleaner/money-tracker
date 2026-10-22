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

function bars(box, rows, label, value, sub) {
  box.replaceChildren();
  if (!rows.length) { box.append(emptyBox('아직 데이터가 없습니다', '계약이 모이면 여기에 나타납니다.')); return; }
  const max = Math.max(...rows.map(value));
  for (const r of rows) {
    const row = el('div', 'barrow'), l = el('div', 'l'), name = el('span', '', label(r));
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
  const cities = idx.cities.slice().sort((a, b) => b.alerts - a.alerts || b.total - a.total);
  const sum = (f) => cities.reduce((s, c) => s + (f(c) || 0), 0);
  const setHero = (cat) => {
    const clean = cat !== '전체';
    const f = (c) => (clean ? ((c.by_cat || {})['청소'] || 0) + ((c.by_cat || {})['시설관리'] || 0) : c.total);
    $('#nat-total').textContent = krw(sum(f));
    $('#hero-k').textContent = clean ? '청소·시설관리 계약에 쓴 돈' : '계약으로 쓴 돈';
  };
  if (cities.some((c) => c.by_cat)) chips($('#hero-chips'), ['전체', '청소·시설관리'], setHero); else $('#hero-chips').remove();
  setHero('전체');
  $('#nat-count').textContent = '계약 ' + sum((c) => c.count).toLocaleString('ko-KR') + '건';
  const al = sum((c) => c.alerts);
  $('#nat-alerts-n').textContent = `전국 ${al.toLocaleString('ko-KR')}건 중 시마다 하나씩.`;

  let showAll = false;
  const draw = (q) => {
    const box = $('#cities'); box.replaceChildren();
    const list = cities.filter((c) => !q || (c.name + c.short + c.province).includes(q));
    const shown = q || showAll ? list : list.slice(0, 6);
    for (const c of shown) {
      const a = el('a', 'city'); a.href = 'city.html?c=' + c.slug;
      const n = el('span', 'n', c.short); n.append(el('span', 'm', `${krw(c.total)} · ${c.count.toLocaleString('ko-KR')}건`));
      const r = el('span', 'r'); r.append(el('span', 'badge ' + (c.alerts ? 'on' : 'off'), c.alerts ? `징후 ${c.alerts}` : '징후 없음'), el('span', 'chev', '›'));
      a.append(n, r); box.append(a);
    }
    if (!list.length) box.append(emptyBox('찾는 시가 없어요', '시 이름만 입력해 보세요. 예: 수원, 창원'));
    if (!q && !showAll && list.length > 6) {
      const m = el('button', 'more', `85개 시 모두 보기`); m.type = 'button'; m.addEventListener('click', () => { showAll = true; draw(''); }); box.append(m);
    }
  };
  $('#q').addEventListener('input', (e) => draw(e.target.value.trim()));
  draw('');
  const top = cities.filter((c) => c.top_alert).slice(0, 6).map((c) => ({...c.top_alert, slug: c.slug, city: c.short, detail: c.short + ' · ' + c.top_alert.detail}));
  alertList($('#nat-alerts-list'), top, {link: true});
}

// ---------- 시 상세 ----------
function stats(city, rows) {
  const key = city.name.replace('특별시', '').replace('광역시', '').replace('특별자치시', '');
  let total = 0, known = 0, local = 0; const inst = {}, ven = {}, reg = {};
  for (const r of rows) {
    total += r.amount;
    (inst[r.inst] ||= {name: r.inst, amount: 0, count: 0}); inst[r.inst].amount += r.amount; inst[r.inst].count++;
    if (r.vendor) { (ven[r.vendor] ||= {name: r.vendor, amount: 0, count: 0}); ven[r.vendor].amount += r.amount; ven[r.vendor].count++; ven[r.vendor].region = r.vregion; }
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
    bars($('#vendors'), s.ven, (r) => r.name, (r) => r.amount, (r) => (r.region || '주소 확인 중') + ` · ${r.count}건`);
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
    const present = CATS.filter((c) => c === '전체' || d.rows.some((r) => r.cat === c));
    chips($('#cats'), present, (c) => { cat = c; render(); });
  } else $('#cats').remove();
  render();
  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
}

if (document.body.dataset.page === 'home') homePage();
if (document.body.dataset.page === 'city') cityPage();
