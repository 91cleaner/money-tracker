/* 눌러 보는 설명, 두 개 비교, 내 세금 어림, 국민연금 비율 슬라이더.
   숫자는 이미 있는 자료만 쓴다. 인구처럼 없는 상수는 만들지 않는다.
   payment method TBD: 후원 버튼에는 링크와 결제 정보를 넣지 않는다. */
function npsModel(data) {
  if (!data || typeof data !== 'object') return null;
  const latest = data.latest;
  if (latest && latest.mix && typeof latest.reserve_trillion_krw === 'number') {
    const kr = latest.mix['국내주식'];
    const ov = latest.mix['해외주식'];
    if (!Array.isArray(kr) || !Array.isArray(ov) || typeof kr[1] !== 'number' || typeof ov[1] !== 'number') return null;
    const pct = kr[1] + ov[1];
    const total = latest.reserve_trillion_krw * 1e12;
    if (!(total > 0) || !(pct >= 0 && pct <= 100)) return null;
    const items = Object.entries(latest.mix).filter(([, v]) => Array.isArray(v) && typeof v[0] === 'number' && v[0] > 0).map(([name, v]) => ({ name, amount: v[0] * 1e12 }));
    return { total, pct, items, kind: 'fund', asOf: latest.as_of || '' };
  }
  const total = data.total != null ? data.total : data.fund_total;
  const share = data.stock_share != null ? data.stock_share : data.share;
  if (typeof total !== 'number' || typeof share !== 'number') return null;
  if (!isFinite(total) || !isFinite(share) || total <= 0) return null;
  let pct = share;
  if (pct >= 0 && pct <= 1) pct = pct * 100;
  if (!(pct >= 0 && pct <= 100)) return null;
  const items = Array.isArray(data.items) ? data.items : [];
  return { total, pct, items, kind: 'simple' };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { npsModel };

function bootFun() {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wonText = (n) => {
    n = Math.round(Number(n) || 0);
    const a = Math.abs(n), s = n < 0 ? '-' : '';
    if (a >= 1e12) {
      const j = Math.floor(a / 1e12), e = Math.round((a % 1e12) / 1e8);
      return s + j.toLocaleString('ko-KR') + '조' + (e ? ' ' + e.toLocaleString('ko-KR') + '억' : '') + '원';
    }
    if (a >= 1e8) {
      const e = a / 1e8;
      const t = e >= 100 ? Math.round(e).toLocaleString('ko-KR') : (Math.round(e * 10) / 10).toString().replace(/\.0$/, '');
      return s + t + '억원';
    }
    if (a >= 1e4) return s + Math.round(a / 1e4).toLocaleString('ko-KR') + '만원';
    return s + a.toLocaleString('ko-KR') + '원';
  };
  // play.js에 이미 있는 값. 2026년 최저시급 하루 8시간·한 달. 고용노동부. 새 통계가 아님.
  const WAGE_MONTH = 2156880;
  const WAGE_NOTE = '2026년 최저시급으로 하루 8시간, 한 달 일한 돈 · 고용노동부';

  const tipFor = (el) => {
    if (el.dataset.tip) return el.dataset.tip;
    if (el.id === 'k-total') return '이 시가 고른 기간에 맺은 계약 금액을 더한 값이에요.';
    if (el.id === 'k-out') return '다른 지역 업체로 간 금액의 비율이에요.';
    if (el.id === 'k-alerts') return '눈에 띄는 점의 개수예요. 잘못이라는 뜻은 아니에요.';
    if (el.id === 'nat-total') return '전국 시가 고른 기간에 맺은 계약 금액을 더한 값이에요.';
    if (el.classList.contains('dv-v')) return '이 지역이 고른 기간에 맺은 계약 금액을 더한 값이에요.';
    if (el.classList.contains('fg-v')) return '남은 예산이에요. 장난이라 진짜 돈이 나가지 않아요.';
    const sec = el.closest('section');
    const h = sec && sec.querySelector('h2, h3');
    if (h) return h.textContent.replace(/\s+/g, ' ').trim() + '에 나온 숫자예요. 공개된 자료를 더한 값이에요.';
    return '공개된 자료를 더한 숫자예요.';
  };
  const toggleTip = (el) => {
    let tip = el.nextElementSibling;
    if (!tip || !tip.classList.contains('fun-tip')) {
      tip = document.createElement('p');
      tip.className = 'fun-tip';
      el.after(tip);
    }
    const open = tip.hidden !== false && tip.textContent === '';
    if (tip.hidden || tip.textContent === '' || !tip.dataset.open) {
      tip.textContent = tipFor(el);
      tip.hidden = false;
      tip.dataset.open = '1';
      el.setAttribute('aria-expanded', 'true');
    } else {
      tip.hidden = true;
      tip.dataset.open = '';
      el.setAttribute('aria-expanded', 'false');
    }
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('.stat .v, #nat-total, .dv-v, .fg-v, .nw .big, .w .big, .namt, .fun-num');
    if (!el || e.target.closest('a, button, input, select, textarea')) return;
    e.preventDefault();
    toggleTip(el);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest('.stat .v, .nw .big, .fun-num');
    if (!el) return;
    e.preventDefault();
    toggleTip(el);
  });

  const fold = (card, text) => {
    if (!card || card.dataset.fold) return;
    card.dataset.fold = '1';
    card.tabIndex = 0;
    const more = document.createElement('p');
    more.className = 'fun-more';
    more.hidden = true;
    more.textContent = text;
    card.append(more);
    const toggle = () => { more.hidden = !more.hidden; card.setAttribute('aria-expanded', more.hidden ? 'false' : 'true'); };
    card.addEventListener('click', (e) => {
      if (e.target.closest('a, button, input, select')) return;
      toggle();
    });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  };
  const bindFolds = () => {
    document.querySelectorAll('.alert').forEach((c) => fold(c, '눌러서 연 설명이에요. 이 칸은 자료에서 눈에 띄는 점이에요. 잘못이라는 뜻은 아니에요.'));
    document.querySelectorAll('.nw .row:not(.crow)').forEach((c) => fold(c, '이 줄의 돈이에요. 공개된 자료를 그대로 적었어요.'));
    document.querySelectorAll('.stat .v, .nw .big, .w .big, .fun-num, #nat-total').forEach((el) => { if (!el.hasAttribute('tabindex')) el.tabIndex = 0; });
  };
  let foldTimer = 0;
  const scheduleFolds = () => { clearTimeout(foldTimer); foldTimer = setTimeout(bindFolds, 200); };
  bindFolds();
  new MutationObserver(scheduleFolds).observe(document.body, { childList: true, subtree: true });

  const css = document.createElement('style');
  css.textContent = `.pd input{height:44px!important;margin:6px 0!important}
.stat .v,.dv-v,.nw .big,.w .big,.namt,.fun-num,.fg-v,#nat-total,.akey{cursor:pointer;touch-action:manipulation}
.fun-tip,.fun-more{margin:8px 0 0;padding:10px 12px;border-radius:12px;background:#141b24;border:1px solid #2a3544;color:#d5dee8;font-size:15px;line-height:1.5}
.fun-sec{margin:20px 0 8px}
.fun-block{margin:0 0 22px;padding:18px 16px;border:1px solid #24303a;border-radius:18px;background:#0e141b}
.fun-block h2{margin:0 0 8px;font-size:22px;letter-spacing:-.02em}
.fun-note,.fun-formula{margin:6px 0;color:#a9b4c0;font-size:14px;line-height:1.5}
.fun-picks{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.fun-picks label,.fun-calc label{display:grid;gap:4px;font-size:13px;font-weight:700;color:#c5d0da}
.fun-picks select,.fun-calc input,.fun-calc select{min-height:44px;width:100%;box-sizing:border-box;border-radius:12px;border:1px solid #2a3544;background:#0c1218;color:#e8eef5;font:600 16px var(--sans,system-ui);padding:0 10px}
.fun-bars{display:grid;gap:10px;margin-top:12px}
.fun-bar b{display:block;font-size:14px;margin-bottom:4px}
.fun-bar i{display:block;height:14px;border-radius:99px;background:#24303a;overflow:hidden}
.fun-bar i span{display:block;height:100%;background:#ffb020;border-radius:99px}
.fun-bar.b i span{background:#0a84ff}
.fun-bar em{font-style:normal;font-size:16px;font-weight:800}
.fun-tog{display:flex;gap:8px;margin:0 0 10px}
.fun-tog button{min-height:44px;padding:0 14px;border-radius:99px;border:1px solid #2a3544;background:#0c1218;color:#e8eef5;font:700 14px var(--sans,system-ui)}
.fun-tog button.on{background:#ffb020;color:#111;border-color:#ffb020}
.fun-presets{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.fun-presets button{min-height:44px;padding:0 14px;border-radius:12px;border:1px solid #ffb020;background:transparent;color:#ffb020;font:700 14px var(--sans,system-ui)}
.fun-out{font-size:18px;font-weight:700;line-height:1.45;margin:8px 0 0}
.fun-foot{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
.fun-foot a{font-weight:700}
.donate-mini,.fun-donate{min-height:44px;padding:0 14px;border-radius:99px;border:1px dashed #8b97a5;background:transparent;color:#e8eef5;font:700 14px var(--sans,system-ui)}
.nps-slider{width:100%;height:44px;accent-color:#ffb020}
.nps-empty b{display:block;font-size:22px;margin-bottom:6px}
@media(max-width:420px){.fun-picks{grid-template-columns:1fr}}`;
  document.head.appendChild(css);

  // payment method TBD
  const ensureFoot = () => {
    let foot = document.querySelector('footer');
    if (!foot) {
      foot = document.createElement('footer');
      const main = document.querySelector('main');
      (main || document.body).append(foot);
    }
    if (foot.querySelector('.fun-foot')) return;
    const box = document.createElement('span');
    box.className = 'fun-foot';
    box.innerHTML = '<a href="principles.html">중립성 원칙 + 정정 요청</a><button type="button" class="fun-donate" disabled>후원하기 · 준비 중</button>';
    foot.append(box);
  };
  ensureFoot();

  const mountCorr = () => {
    const el = document.getElementById('corr');
    if (!el) return;
    const mask = (s) => (typeof window.maskT === 'function' ? window.maskT(String(s || '')) : String(s || ''));
    fetch('data/corrections.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw 0; return r.json(); }).then((d) => {
      const items = Array.isArray(d) ? d : (d && (d.items || d.corrections)) || [];
      if (!items.length) throw 0;
      el.replaceChildren();
      for (const it of items) {
        const row = document.createElement('article');
        row.className = 'corr';
        const t = document.createElement('b');
        t.textContent = mask(it.date || it['날짜'] || '') + ' ' + mask(it.title || it['제목'] || it.what || '');
        const p = document.createElement('p');
        p.textContent = mask(it.note || it['내용'] || it.text || '');
        row.append(t, p);
        el.append(row);
      }
    }).catch(() => { el.textContent = '아직 정정한 내용이 없어요'; });
  };
  mountCorr();

  function bars(host, a, b) {
    const m = Math.max(a.won, b.won, 1);
    host.innerHTML = [a, b].map((x, i) => `<div class="fun-bar${i ? ' b' : ''}"><b>${esc(x.label)}</b><i><span style="width:${Math.max(4, x.won / m * 100)}%"></span></i><em>${wonText(x.won)}</em></div>`).join('');
  }

  function mountCompare(parent, items, title) {
    const usable = (items || []).filter((x) => typeof x.won === 'number' && isFinite(x.won));
    const sec = document.createElement('section');
    sec.className = 'fun-block';
    sec.innerHTML = `<h2>${esc(title)}</h2>`;
    if (usable.length < 2) {
      sec.insertAdjacentHTML('beforeend', '<p class="fun-note">비교할 숫자가 두 개보다 적어요. 없는 숫자는 만들지 않아요.</p>');
      parent.append(sec);
      return;
    }
    const groups = [...new Set(usable.map((x) => x.group).filter(Boolean))];
    let group = groups[0] || '';
    const picks = document.createElement('div');
    picks.className = 'fun-picks';
    const barHost = document.createElement('div');
    barHost.className = 'fun-bars';
    const tog = document.createElement('div');
    tog.className = 'fun-tog';
    if (groups.length > 1) {
      tog.innerHTML = groups.map((g, i) => `<button type="button" data-g="${esc(g)}" class="${i ? '' : 'on'}">${esc(g)}</button>`).join('');
      sec.append(tog);
    }
    sec.append(picks, barHost);
    parent.append(sec);
    const pool = () => usable.filter((x) => !group || x.group === group);
    const fill = () => {
      const list = pool();
      const prefer = new URLSearchParams(location.search).get('c') || '';
      let i0 = Math.max(0, list.findIndex((x) => x.id === prefer));
      let i1 = i0 === 0 ? Math.min(1, list.length - 1) : 0;
      if (list.length < 2) { barHost.innerHTML = '<p class="fun-note">이 묶음에는 비교할 숫자가 적어요.</p>'; picks.innerHTML = ''; return; }
      const sel = (name, idx) => `<label>${name}<select data-i="${idx}">${list.map((x, i) => `<option value="${i}"${i === idx ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>`;
      picks.innerHTML = sel('가', i0) + sel('나', i1);
      const draw = () => {
        const a = list[+picks.querySelector('[data-i="0"]').value];
        const b = list[+picks.querySelector('[data-i="1"]').value];
        bars(barHost, a, b);
      };
      picks.onchange = draw;
      draw();
    };
    tog.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      group = b.dataset.g;
      tog.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      fill();
    });
    fill();
  }

  function mountCalc(parent, items) {
    const usable = (items || []).filter((x) => typeof x.won === 'number' && x.won > 0);
    if (!usable.length) return;
    const sec = document.createElement('section');
    sec.className = 'fun-block fun-calc';
    sec.innerHTML = `<h2>내 세금으로 치면 얼마</h2>
      <p class="fun-formula">어림 공식: 고른 금액 ÷ 한 달 돈 = 몇 달치. 한 달 돈 ÷ 고른 금액 = 비율.</p>
      <p class="fun-note">어림이에요. 사람 수로 나누지 않아요. 인구 숫자는 이 자료에 없어요.</p>
      <label>어떤 돈이랑 견줄까요<select id="fun-which">${usable.map((x, i) => `<option value="${i}">${esc(x.label)} · ${esc(wonText(x.won))}</option>`).join('')}</select></label>
      <div class="fun-presets"><button type="button" id="fun-wage">최저임금 한 달</button></div>
      <p class="fun-note">${esc(WAGE_NOTE)}</p>
      <label>한 달에 버는 돈 (원)<input id="fun-income" inputmode="numeric" autocomplete="off" placeholder="예: 2000000"></label>
      <label>한 달에 내는 세금 (원)<input id="fun-tax" inputmode="numeric" autocomplete="off" placeholder="아는 만큼만"></label>
      <p class="fun-out" id="fun-out">한 달 돈을 적으면 어림이 나와요.</p>`;
    parent.append(sec);
    const out = sec.querySelector('#fun-out');
    const income = sec.querySelector('#fun-income');
    const tax = sec.querySelector('#fun-tax');
    let mode = 'income';
    const num = (el) => {
      const v = String(el.value || '').replace(/[^\d]/g, '');
      return v ? parseInt(v, 10) : 0;
    };
    const show = () => {
      const spend = usable[+sec.querySelector('#fun-which').value];
      const pay = mode === 'tax' ? num(tax) : num(income);
      if (!spend || !pay) { out.textContent = '한 달 돈을 적으면 어림이 나와요.'; return; }
      const months = spend.won / pay;
      const pct = pay / spend.won * 100;
      const mTxt = months >= 100 ? Math.round(months).toLocaleString('ko-KR') : (Math.round(months * 10) / 10).toString();
      const pTxt = pct >= 1 ? (Math.round(pct * 10) / 10).toString() : (Math.round(pct * 100) / 100).toString();
      const kind = mode === 'tax' ? '한 달 세금' : '한 달에 버는 돈';
      const extra = mode === 'tax' ? '' : ' 세금을 계산한 값은 아니에요.';
      out.textContent = `어림: ${spend.label}은 ${kind} ${pay.toLocaleString('ko-KR')}원으로 약 ${mTxt}달치예요. ${kind}은 이 금액의 약 ${pTxt}%예요.${extra}`;
    };
    sec.querySelector('#fun-wage').addEventListener('click', () => { mode = 'income'; income.value = String(WAGE_MONTH); show(); });
    income.addEventListener('input', () => { mode = 'income'; show(); });
    tax.addEventListener('input', () => { mode = 'tax'; show(); });
    sec.querySelector('#fun-which').addEventListener('change', show);
  }

  async function homeItems() {
    const r = await fetch('data/index.json', { cache: 'no-cache' });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.cities || []).filter((c) => typeof c.total === 'number').map((c) => ({ id: c.slug, label: c.short || c.name, won: c.total, group: '시' }));
  }
  async function cityPack() {
    const r = await fetch('data/index.json', { cache: 'no-cache' });
    if (!r.ok) return { cities: [], cats: [] };
    const d = await r.json();
    const cities = (d.cities || []).filter((c) => typeof c.total === 'number').map((c) => ({ id: c.slug, label: c.short || c.name, won: c.total, group: '시' }));
    const slug = new URLSearchParams(location.search).get('c');
    const me = (d.cities || []).find((c) => c.slug === slug);
    const cats = me && me.by_cat ? Object.entries(me.by_cat).filter(([, v]) => typeof v === 'number').map(([k, v]) => ({ id: k, label: k, won: v, group: '분야' })) : [];
    return { cities, cats };
  }
  async function natItems() {
    const [sup, flw] = await Promise.all([
      fetch('data/national/support.json').then((r) => r.json()),
      fetch('data/national/flows.json').then((r) => r.json()),
    ]);
    const items = [];
    const a = (sup.allowance || []).find((x) => x && x.parts) || null;
    if (a) for (const [k, v] of Object.entries(a.parts)) if (typeof v === 'number') items.push({ id: 'p:' + k, label: k, won: v, group: '수당' });
    for (const f of flw.flows || []) {
      if (f.kind === '경상보조금' && f.period === '3분기' && f.to && typeof f.amount === 'number') items.push({ id: 'g:' + f.to.party, label: f.to.party, won: f.amount, group: '정당' });
    }
    return items;
  }

  const pg = document.body.dataset.page || '';
  const slot = document.createElement('div');
  slot.className = 'fun-sec';
  slot.id = 'fun-slot';

  const run = async () => {
    try {
      if (pg === 'home' || pg === 'index') {
        const dive = document.getElementById('dive');
        if (dive && !document.getElementById('fun-slot')) dive.after(slot);
        const items = await homeItems();
        mountCompare(slot, items, '두 시 비교');
        mountCalc(slot, items);
      } else if (pg === 'city') {
        const stats = document.querySelector('.stats');
        if (stats && !document.getElementById('fun-slot')) stats.after(slot);
        const pack = await cityPack();
        mountCompare(slot, pack.cities.concat(pack.cats), '두 개 비교');
        mountCalc(slot, pack.cities.concat(pack.cats));
      } else if (pg === 'national') {
        const s1 = document.getElementById('s1');
        if (s1 && !document.getElementById('fun-slot')) s1.after(slot);
        const items = await natItems();
        mountCompare(slot, items, '두 개 비교');
        mountCalc(slot, items);
      }
    } catch (e) {}
  };
  if (pg === 'home' || pg === 'index' || pg === 'city' || pg === 'national') run();

  document.addEventListener('news:ready', (e) => {
    const host = document.getElementById('fun-slot');
    if (!host || host.dataset.done) return;
    const articles = (e.detail && e.detail.articles) || [];
    const items = articles.map((a) => {
      const won = window.NewsKit ? window.NewsKit.wonFromLabel(a.amount) : null;
      return won ? { id: a.id, label: a.title, won, group: '기사' } : null;
    }).filter(Boolean);
    if (!items.length) return;
    host.dataset.done = '1';
    mountCompare(host, items, '두 기사 비교');
    const cur = e.detail && e.detail.current;
    if (cur) {
      const one = items.filter((x) => x.id === cur.id);
      mountCalc(host, one);
    } else mountCalc(host, items);
  });

  const nps = document.getElementById('nps-root') || document.getElementById('nps-fun');
  if (nps) {
    const paint = (data) => {
      const model = npsModel(data);
      if (!model) {
        nps.innerHTML = '<p class="nps-empty"><b>자료를 준비하고 있어요</b>주식 비율 숫자가 아직 없어요. 없는 숫자는 만들지 않아요.</p>';
        return;
      }
      const real = Math.round(model.pct * 10) / 10;
      const when = model.asOf ? String(model.asOf).replace(/-/g, '.') + ' 기준, ' : '';
      const src = model.kind === 'fund'
        ? `${when}자료 비율 ${real}%는 국내주식과 해외주식 비율을 더한 값이에요.`
        : `자료에 적힌 비율은 ${real}%예요.`;
      nps.innerHTML = `<h2>주식 비율 움직여 보기</h2><p class="fun-num" data-tip="자료에 적힌 기금 전체 금액이에요.">${esc(wonText(model.total))}</p>
        <p class="fun-note">기금 전체</p>
        <label>주식 비율 <output id="nps-out">${real}%</output>
          <input class="nps-slider" id="nps-range" type="range" min="0" max="100" step="0.1" value="${real}" aria-label="주식 비율">
        </label>
        <p class="fun-formula">어림 공식: 기금 전체 × 고른 비율 = 주식 금액. ${src}</p>
        <p class="fun-out" id="nps-amt"></p>
        <div id="nps-extra"></div>`;
      const range = nps.querySelector('#nps-range');
      const amt = nps.querySelector('#nps-amt');
      const out = nps.querySelector('#nps-out');
      const draw = () => {
        const p = Number(range.value);
        out.textContent = p + '%';
        const part = Math.round(model.total * p / 100);
        const tag = Math.abs(p - real) < 0.05 ? '자료 비율' : '어림';
        amt.textContent = `${tag}: ${p}%이면 약 ${wonText(part)}이에요.`;
      };
      range.addEventListener('input', draw);
      draw();
      const extra = nps.querySelector('#nps-extra');
      const rows = (model.items || []).filter((it) => it && typeof it.amount === 'number').map((it, i) => ({ id: String(i), label: String(it.name || it.label || '항목'), won: it.amount, group: '종목' }));
      mountCompare(extra, rows, '두 종류 비교');
      mountCalc(extra, [{ id: 'fund', label: '기금 전체', won: model.total, group: '기금' }].concat(rows));
    };
    fetch('data/nps.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((data) => {
      if (npsModel(data)) { paint(data); return null; }
      return fetch('data/nps/fund_totals.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null));
    }).then((data) => {
      if (data) paint(data);
      else if (!nps.querySelector('.nps-slider')) paint(null);
    }).catch(() => { nps.innerHTML = '<p class="nps-empty"><b>자료를 준비하고 있어요</b>주식 비율 숫자를 불러오지 못했어요.</p>'; });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootFun);
  else bootFun();
}
