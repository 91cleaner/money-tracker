/* 입찰 정보 페이지(bid.html): data/sec_bidpage.json 을 표·목록으로. */
(async () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const won = (n) => { n = Math.round(Number(n) || 0); if (n >= 1e12) { const j = Math.floor(n / 1e12), e = Math.round((n % 1e12) / 1e8); return j.toLocaleString('ko-KR') + '조' + (e ? ' ' + e.toLocaleString('ko-KR') + '억' : '') + '원'; } if (n >= 1e8) return (n >= 1e10 ? Math.round(n / 1e8).toLocaleString('ko-KR') : (n / 1e8).toFixed(1).replace(/\.0$/, '')) + '억원'; return Math.round(n / 1e4).toLocaleString('ko-KR') + '만원'; };
  const md = (s) => (s ? `${+s.slice(5, 7)}월 ${+s.slice(8, 10)}일` : '');
  const sido = (c) => String(c || '').split(' ')[0];
  const d = await fetch('data/sec_bidpage.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!d) { $('lead').textContent = '자료를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'; return; }
  $('upd').textContent = String(d.updated || '').slice(0, 16).replace('T', ' ');
  const P = d.period || {};
  const all = d.by_cat.reduce((s, r) => s + r.n, 0), open = d.by_cat.reduce((s, r) => s + (r.open_n || 0), 0), comp = d.by_cat.reduce((s, r) => s + r.comp_n, 0);
  $('kpi').innerHTML = `<div><b>${all.toLocaleString('ko-KR')}건</b><span>${md(P.from)}~${md(P.to)} 85개 시 계약</span></div>
    <div><b>${(open / all * 100).toFixed(1)}%</b><span>공고를 거친 계약</span></div>
    <div><b>${(comp / all * 100).toFixed(1)}%</b><span>경쟁입찰로 맺은 계약</span></div>`;
  // 분야별 표
  $('catT').innerHTML = `<thead><tr><th>분야</th><th>계약</th><th>공고<br>거침</th><th>경쟁<br>입찰</th><th>참가<br>업체</th><th>낙찰률</th></tr></thead><tbody>` +
    d.by_cat.filter((r) => r.n >= 20).map((r) => `<tr><td>${esc(r.cat)}</td><td>${r.n.toLocaleString('ko-KR')}</td><td><b>${r.open_pct}%</b></td><td>${r.comp_pct}%</td><td>${r.med_bidders != null ? r.med_bidders.toLocaleString('ko-KR') + '곳' : '—'}</td><td>${r.med_rate != null ? r.med_rate + '%' : '—'}</td></tr>`).join('') + '</tbody>';
  const cats = [...new Set(d.by_cat.map((r) => r.cat))];
  const opt = (sel, list, first) => { sel.innerHTML = `<option value="">${first}</option>` + list.map((x) => `<option>${esc(x)}</option>`).join(''); };
  // 주소로 분야·지역 미리 고르기(?cat=청소&sido=경기)
  const qs = new URLSearchParams(location.search);

  // 큰 계약 낙찰 결과
  const B = d.big || [];
  opt($('bCat'), cats.filter((c) => B.some((x) => x.cat === c)), '모든 분야');
  opt($('bSido'), [...new Set(B.map((x) => sido(x.cname)))].sort(), '모든 지역');
  let bShow = 20;
  const bigItem = (x) => `<div class="it"><div class="t">${esc(x.title)}</div><div class="m">${esc(md(x.date))} · ${esc(x.cname)} · ${esc(x.inst)}</div>
    <div><span class="a">${esc(won(x.amount))}</span> <span class="m">${esc(x.vendor || '')}${x.vregion ? ' · ' + esc(x.vregion) : ''}</span></div>
    <div class="chips">${x.n ? `<span class="chip ${x.n === 1 ? 'y' : ''}">${x.n === 1 ? '1곳만 입찰' : '참가 ' + x.n.toLocaleString('ko-KR') + '곳'}</span>` : ''}${x.rate != null ? `<span class="chip ${x.rate >= 95 ? 'y' : ''}">낙찰률 ${(Math.round(x.rate * 10) / 10)}%</span>` : ''}${x.region_rule ? `<span class="chip">지역 업체 ${x.region_kind === '의무' ? '참여 의무' : '제한'} · ${esc(x.region_rule)}</span>` : ''}<span class="chip">${esc(x.bmethod || x.method)}</span></div>
    <div class="ln">${x.bid_url ? `<a href="${esc(x.bid_url)}" target="_blank" rel="noopener">입찰 공고 ↗</a>` : ''}${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">계약 원문 ↗</a>` : ''}</div></div>`;
  const paintB = () => {
    const c = $('bCat').value, s = $('bSido').value, o = $('bSort').value;
    let L = B.filter((x) => (!c || x.cat === c) && (!s || sido(x.cname) === s));
    const k = { d: (a, b) => (b.date > a.date ? 1 : -1), rh: (a, b) => (b.rate ?? -1) - (a.rate ?? -1), rl: (a, b) => (a.rate ?? 999) - (b.rate ?? 999), n: (a, b) => (a.n ?? 1e9) - (b.n ?? 1e9), a: (a, b) => b.amount - a.amount }[o];
    L = L.slice().sort(k);
    $('bigL').innerHTML = L.slice(0, bShow).map(bigItem).join('') || '<p class="sub">조건에 맞는 계약이 없어요.</p>';
    $('bigM').hidden = L.length <= bShow; $('bigM').textContent = `더 보기 (${(L.length - bShow).toLocaleString('ko-KR')}건 더)`;
  };
  ['bCat', 'bSido', 'bSort'].forEach((id) => $(id).addEventListener('change', () => { bShow = 20; paintB(); }));
  $('bigM').onclick = () => { bShow += 30; paintB(); };

  // 최근 경쟁입찰
  const R = d.recent || [];
  opt($('rCat'), cats.filter((c) => R.some((x) => x.cat === c)), '모든 분야');
  opt($('rSido'), [...new Set(R.map((x) => sido(x.cname)))].sort(), '모든 지역');
  let rShow = 30;
  const recItem = (x) => `<div class="it"><div class="t">${esc(x.title)}</div><div class="m">${esc(md(x.date))} · ${esc(x.cname)} · ${esc(x.inst)} · ${esc(x.cat)}</div>
    <div><span class="a">${esc(won(x.amount))}</span> <span class="m">${esc(x.vendor || '')}${x.vregion ? ' · ' + esc(x.vregion) : ''} · ${esc(x.method)}</span></div>
    ${x.url ? `<div class="ln"><a href="${esc(x.url)}" target="_blank" rel="noopener">계약 원문 ↗</a></div>` : ''}</div>`;
  const norm = (t) => String(t || '').replace(/\s+/g, '').toLowerCase();
  const paintR = () => {
    const q = norm($('rQ').value), c = $('rCat').value, s = $('rSido').value;
    const L = R.filter((x) => (!c || x.cat === c) && (!s || sido(x.cname) === s) && (!q || norm(x.title + x.inst + x.cname + x.vendor).includes(q)));
    $('recL').innerHTML = L.slice(0, rShow).map(recItem).join('') || '<p class="sub">조건에 맞는 계약이 없어요.</p>';
    $('recM').hidden = L.length <= rShow; $('recM').textContent = `더 보기 (${(L.length - rShow).toLocaleString('ko-KR')}건 더)`;
  };
  let tm = 0; $('rQ').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { rShow = 30; paintR(); }, 150); });
  ['rCat', 'rSido'].forEach((id) => $(id).addEventListener('change', () => { rShow = 30; paintR(); }));
  $('recM').onclick = () => { rShow += 40; paintR(); };

  if (qs.get('cat')) { $('bCat').value = qs.get('cat'); $('rCat').value = qs.get('cat'); }
  if (qs.get('sido')) { $('bSido').value = qs.get('sido'); $('rSido').value = qs.get('sido'); }
  if (qs.get('q')) $('rQ').value = qs.get('q');
  paintB(); paintR();
  $('src').innerHTML = `출처 ${esc(d.source)} · ${esc(d.note)}`;
})();
