// 우리 시 돈 추적기 — 공통 함수와 두 페이지(전국 목록, 시 상세) 그리기
const $ = (s, el = document) => el.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const krw = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e12) return s + (a / 1e12).toFixed(1).replace(/\.0$/, '') + '조원';
  if (a >= 1e8) { const e = Math.floor(a / 1e8), m = Math.round((a % 1e8) / 1e4); return s + e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만' : '') + '원'; }
  if (a >= 1e4) return s + Math.round(a / 1e4).toLocaleString('ko-KR') + '만원';
  return s + a.toLocaleString('ko-KR') + '원';
};
const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
const when = (iso) => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleString('ko-KR', {month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'}); };
const LABEL = {split: '같은 날 나눠진 계약', threshold: '금액선 근처', repeat: '같은 업체 반복', big: '1억 이상'};
const SOURCE = 'https://www.g2b.go.kr';

async function getJSON(path) {
  const r = await fetch(path + '?t=' + Math.floor(Date.now() / 600000));
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}

function bars(box, rows, label, value, sub) {
  box.replaceChildren();
  if (!rows.length) { box.append(el('p', 'empty', '아직 데이터가 없습니다.')); return; }
  const max = Math.max(...rows.map(value));
  for (const r of rows) {
    const row = el('div', 'barrow');
    const l = el('div', 'l', label(r)); l.title = label(r);
    if (sub && sub(r)) l.append(el('small', '', sub(r)));
    const b = el('div', 'b'); const i = el('i'); i.style.width = Math.max(1, (value(r) / max) * 70) + '%';
    b.append(i, el('span', '', krw(value(r)))); row.append(l, b); box.append(row);
  }
}

function alertList(box, alerts) {
  box.replaceChildren();
  if (!alerts.length) { box.append(el('p', 'empty', '최근 데이터에서 눈에 띄는 패턴이 없습니다.')); return; }
  for (const a of alerts) {
    const it = el('div', 'alert ' + a.kind); it.id = a.key;
    it.append(el('span', 'pill ' + a.kind, LABEL[a.kind] || a.kind), el('span', 't', a.title), el('span', 'a', a.amount == null ? '' : krw(a.amount)), el('span', 'd', a.detail));
    if (a.explanation && a.explanation.text) {
      const x = el('div', 'x'); x.append(el('b', '', '기관·업체 해명 '), document.createTextNode(`(${a.explanation.by || ''}${a.explanation.date ? ', ' + a.explanation.date : ''}) ${a.explanation.text}`)); it.append(x);
    }
    const src = el('a', 'src', '출처: 조달청 나라장터 공개 계약정보'); src.href = SOURCE; src.target = '_blank'; src.rel = 'noopener'; it.append(src);
    box.append(it);
  }
}

// ---------- 전국 목록 ----------
async function homePage() {
  let idx;
  try { idx = await getJSON('data/index.json'); } catch (e) { $('#cities').append(el('p', 'empty', '데이터를 준비하고 있습니다. 첫 수집이 끝나면 여기에 시가 나타납니다.')); return; }
  $('#updated').textContent = when(idx.updated);
  $('#days').textContent = idx.days;
  const cities = idx.cities.slice().sort((a, b) => b.alerts - a.alerts || b.total - a.total);
  const tot = cities.reduce((s, c) => s + c.total, 0), cnt = cities.reduce((s, c) => s + c.count, 0), al = cities.reduce((s, c) => s + c.alerts, 0);
  $('#nat-total').textContent = krw(tot); $('#nat-count').textContent = cnt.toLocaleString('ko-KR') + '건'; $('#nat-alerts').textContent = al.toLocaleString('ko-KR') + '건';
  const draw = (q) => {
    const box = $('#cities'); box.replaceChildren();
    for (const c of cities.filter((c) => !q || (c.name + c.short + c.province).includes(q))) {
      const a = el('a', 'city'); a.href = 'city.html?c=' + c.slug;
      a.append(el('span', 'n', c.short), el('span', 'm', `${krw(c.total)} · ${c.count.toLocaleString('ko-KR')}건`),
        el('span', 'm', '시내 업체 비율 ' + pct(c.local_share)), el('span', 'badge ' + (c.alerts ? 'on' : 'off'), c.alerts ? `이상 징후 ${c.alerts}건` : '징후 없음'));
      box.append(a);
    }
  };
  $('#q').addEventListener('input', (e) => draw(e.target.value.trim()));
  draw('');
  const top = cities.filter((c) => c.top_alert).slice(0, 6).map((c) => ({...c.top_alert, detail: c.short + ' · ' + c.top_alert.detail}));
  alertList($('#nat-alerts-list'), top);
}

// ---------- 시 상세 ----------
async function cityPage() {
  const slug = new URLSearchParams(location.search).get('c');
  let d;
  try { d = await getJSON('data/city/' + slug + '.json'); } catch (e) { $('#title').textContent = '시를 찾을 수 없습니다'; return; }
  const s = d.summary;
  document.title = d.city.name + ' 돈 추적기';
  $('#title').textContent = d.city.short + ' 돈 추적기';
  $('#lede').textContent = `최근 공개된 ${d.city.name} 계약 ${s.count.toLocaleString('ko-KR')}건, 합계 ${krw(s.total)}. 그중 데이터상 이상 징후 ${d.alerts.filter((a) => a.kind !== 'big').length}건을 아래에 모았습니다.`;
  $('#updated').textContent = when(d.updated);
  $('#k-total').textContent = krw(s.total); $('#k-range').textContent = `${s.first || '—'} ~ ${s.last || '—'}`;
  $('#k-count').textContent = s.count.toLocaleString('ko-KR') + '건';
  $('#k-local').textContent = pct(s.local_share); $('#k-local-s').textContent = `주소가 확인된 계약 ${pct(s.region_known_share)} 기준`;
  const sh = $('#share i'); sh.style.width = s.local_share == null ? '0' : Math.round(s.local_share * 100) + '%';
  alertList($('#alerts-list'), d.alerts);
  bars($('#insts'), s.top_inst, (r) => r.name, (r) => r.amount, (r) => r.count + '건');
  bars($('#vendors'), s.top_vendors, (r) => r.name, (r) => r.amount, (r) => r.region || '주소 확인 중');
  bars($('#regions'), s.by_region, (r) => r.region, (r) => r.amount);

  let sortK = 'date', dir = -1, q = '';
  const tbl = $('#contracts table');
  tbl.querySelectorAll('th button').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.k; if (k === sortK) dir *= -1; else { sortK = k; dir = k === 'amount' || k === 'date' ? -1 : 1; } table(); }));
  $('#cq').addEventListener('input', (e) => { q = e.target.value.trim(); table(); });
  const table = () => {
    const tb = tbl.querySelector('tbody'); tb.replaceChildren();
    tbl.querySelectorAll('th').forEach((th) => th.setAttribute('aria-sort', th.querySelector('button')?.dataset.k === sortK ? (dir > 0 ? 'ascending' : 'descending') : 'none'));
    let rows = d.rows; if (q) rows = rows.filter((r) => (r.title + r.vendor + r.inst + (r.vregion || '')).includes(q));
    rows = rows.slice().sort((a, b) => ((a[sortK] ?? '') < (b[sortK] ?? '') ? -1 : (a[sortK] ?? '') > (b[sortK] ?? '') ? 1 : 0) * dir).slice(0, 1500);
    for (const r of rows) {
      const tr = el('tr');
      const title = el('td', 'ttl'); if (r.url) { const a = el('a', '', r.title); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; title.append(a); } else title.textContent = r.title;
      tr.append(el('td', '', r.date), el('td', 'hide-narrow', r.inst), title, el('td', '', r.vendor), el('td', 'hide-narrow', r.vregion || '—'), el('td', 'num', r.amount.toLocaleString('ko-KR')));
      tb.append(tr);
    }
  };
  table();
}

if (document.body.dataset.page === 'home') homePage();
if (document.body.dataset.page === 'city') cityPage();
