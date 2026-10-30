/* 관제실 안 '정당별 돈 추적' 모드. 자료: data/party/ (build_party_money.py). 숫자는 팩트체크 비서 확인값. 확인 못 한 것만 '미확인'.
   개인 수령자는 건수만, 점·주소 없음. 평가 문구 없이 원자료 문구와 출처만. */
(() => {
  const V = '202610301445', BASE = '../data/party/';
  const won = (n) => n == null ? '—' : n >= 1e8 ? (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억원' : n >= 1e4 ? Math.round(n / 1e4).toLocaleString('ko-KR') + '만원' : n.toLocaleString('ko-KR') + '원';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const U = '<span class="u">미확인</span>', HOME = [[33.0, 124.6], [38.6, 131.0]];
  let IDX = null, cur = null, panel = null, layer = null, RND = null, bounds = null;
  const css = () => {
    if (document.getElementById('mtPartyCss')) return;
    const s = document.createElement('style'); s.id = 'mtPartyCss';
    s.textContent = `#mtParty{position:fixed;z-index:1600;top:96px;right:12px;width:360px;max-height:calc(100vh - 210px);overflow:auto;background:#06150ff5;border:1px solid #2d6e4b;border-radius:10px;padding:12px 14px;color:#d8f5e3;font:13px/1.55 system-ui,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;box-shadow:0 8px 28px #000a}
#mtParty h2{margin:0 0 4px;font-size:16px;color:#ffb84d}#mtParty h3{font-size:14px;margin:12px 0 4px;color:#ffd166}
#mtParty .x{position:absolute;right:8px;top:6px;background:none;border:0;color:#d8f5e3;font-size:20px;cursor:pointer}
#mtParty .warn{background:#2a1a05;border:1px solid #6b4310;border-radius:8px;padding:8px 10px;margin:8px 0}
#mtParty .chips{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}#mtParty .chips button{background:#0c1f16;color:#d8f5e3;border:1px solid #2d6e4b;border-radius:999px;padding:5px 10px;font-size:12px;cursor:pointer}
#mtParty .chips button[aria-pressed=true]{background:#ff9f0a;color:#111;border-color:#ff9f0a;font-weight:700}
#mtParty .row{display:flex;gap:6px;margin:6px 0}#mtParty .row button{flex:1;background:#0c1f16;color:#ffb84d;border:1px solid #ff9f0a;border-radius:8px;padding:6px;cursor:pointer;font-size:12px}
#mtParty .cards{display:grid;grid-template-columns:1fr 1fr;gap:6px}#mtParty .card{background:#0a1b12;border:1px solid #1d4430;border-radius:8px;padding:6px 8px}#mtParty .card b{display:block;font-size:14px}#mtParty .card b small{display:block;font-weight:400;font-size:11px;color:#b7d9c4}#mtParty .card small{color:#8fbfa0}
#mtParty .u{color:#ffcf70;font-size:11px;border:1px solid #6b4310;border-radius:5px;padding:0 3px;margin-left:3px;white-space:nowrap;font-weight:400}
#mtParty table{width:100%;border-collapse:collapse;font-size:12px}#mtParty td,#mtParty th{border-bottom:1px solid #1d4430;padding:4px 3px;text-align:left;vertical-align:top}
#mtParty dt{font-weight:700}#mtParty dd{margin:0 0 4px;color:#b7d9c4}#mtParty .src{font-size:11px;color:#8fbfa0}
@media(max-width:650px){#mtParty{left:6px;right:6px;width:auto;top:auto;bottom:140px;max-height:46vh}}`;
    document.head.append(s);
  };
  const map = () => window.moneyTrackerMap;
  const reset = () => { const m = map(); if (!m) return; m.invalidateSize(); m.fitBounds(bounds && bounds.isValid() ? bounds : HOME, {padding: [20, 20]}); };
  const arc = (a, b) => { const mx = (a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.25, my = (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.25, p = []; for (let t = 0; t <= 1.0001; t += 1 / 24) { const u = 1 - t; p.push([u * u * a[0] + 2 * u * t * mx + t * t * b[0], u * u * a[1] + 2 * u * t * my + t * t * b[1]]); } return p; };
  function show(i) {
    const P = IDX.parties[i], c = P.counts, $ = (id) => panel.querySelector(id); cur = i;
    panel.querySelectorAll('.chips button').forEach((b, j) => b.setAttribute('aria-pressed', j === i));
    const X = P.subsidy_extra || {}, xu = X.unverified ? U : '';
    let sub = won(c.subsidy_2024_krw) + xu;
    if (X.with && X.with.length) sub += '<small>+ ' + X.with.map((w) => esc(w[0]) + ' ' + won(w[1])).join(', ') + '<br>합계 ' + won(X.total_pdf) + ' (' + esc(X.pdf) + ')</small>';
    else if (X.unverified) sub += '<small>엑셀 ' + won(c.subsidy_2024_krw) + ', ' + esc(X.pdf) + ' ' + won(X.total_pdf) + '. 두 자료가 달라요.</small>';
    $('.cards').innerHTML = [['2024 국고보조금<br>(지급 당시 정당명 기준)', sub], ['의원 수', (c.members || 0) + '명<small>2024년에 신고한 21·22대 의원 전체</small>'], ['지출 기록', (c.expense_rows || 0).toLocaleString('ko-KR') + '건'], ['지도에 찍은 곳', P.points.toLocaleString('ko-KR') + '곳'], ['"개인"에게 쓴 기록', (c['개인'] || 0).toLocaleString('ko-KR') + '건(점 없음)<small>글자 인식(OCR) 오류나 사업자번호가 빠진 기록이 섞여 있을 수 있어요.</small>']]
      .map(([k, v]) => '<div class="card"><small>' + k + '</small><b>' + v + '</b></div>').join('');
    $('.sub').innerHTML = '<tr><th>구분(지급 당시 정당명)</th><th>금액</th><th>지도</th></tr>' + P.subsidy.map((s) => '<tr><td>' + esc(s.year) + ' ' + esc(s.type) + '</td><td>' + won(s.krw) + xu + '</td><td>' + (s.line ? '선 있음' : '정당 위치 없음') + '</td></tr>').join('');
    $('.ns').innerHTML = P.nonseat.length ? '<tr><th>날짜</th><th>의원</th><th>받은 정당</th><th>원자료 내역</th><th>금액</th></tr>' + P.nonseat.map((n) => '<tr><td>' + esc(n.date) + '</td><td>' + esc(n.member) + (n.note ? '<br><small>' + esc(n.note) + '</small>' : '') + '</td><td>' + esc(n.to) + '</td><td>' + esc(n.raw) + '</td><td>' + won(n.krw) + '</td></tr>').join('') : '<tr><td>이 정당은 해당 기록이 없어요.</td></tr>';
    layer.clearLayers(); bounds = L.latLngBounds([]);
    const mx = Math.max(1, ...P.subsidy.map((s) => s.krw || 0));
    P.subsidy.forEach((s) => { if (!s.line) return; L.polyline(arc(s.line[0], s.line[1]), {color: '#ff9f0a', weight: 1.5 + 6 * Math.sqrt(s.krw / mx), opacity: 0.85}).bindPopup('<b>국고보조금</b><br>' + esc(s.year) + ' ' + esc(s.type) + '<br>' + won(s.krw) + ' ' + xu + '<br>선관위 위치는 근사치예요.').addTo(layer); s.line.forEach((p) => bounds.extend(p)); });
    fetch(BASE + P.file + '?v=' + V).then((r) => r.json()).then((pts) => {
      if (cur !== i || !layer) return;
      const top = Math.max(1, ...pts.map((p) => p[5] || 0));
      pts.forEach((p) => {
        L.circleMarker([p[0], p[1]], {radius: 2 + 8 * Math.sqrt((p[5] || 0) / top), color: '#ffd166', weight: 0.5, fillColor: '#ffd166', fillOpacity: 0.55, renderer: RND})
          .bindPopup('<b>' + esc(p[2] || '(이름 없음)') + '</b> (' + esc(p[3]) + ')<br>' + esc(p[4]) + '<br>' + won(p[5]) + ' · ' + (p[6] || 1) + '건<br>의원: ' + esc((p[9] || []).join(', ')) + (p[7] ? '<br>위치는 근사치예요.' : '') + (p[8] ? '<br>글자 오류 가능(OCR).' : '') + '<br><small>출처: 오마이뉴스·경향·뉴스타파</small>').addTo(layer);
        bounds.extend([p[0], p[1]]);
      });
      reset();
    }).catch(() => { $('.cards').insertAdjacentHTML('beforeend', '<div class="card">지도 점을 불러오지 못했어요.</div>'); });
    reset();
  }
  function close() {
    if (panel) panel.remove(); panel = null; if (layer && map()) map().removeLayer(layer); layer = null; cur = null;
    document.body.classList.remove('mt-party');
  }
  function open(name) {
    const m = map(); if (!m || !window.L) return;
    css(); document.getElementById('mtOpen')?.remove(); document.body.classList.remove('mtOpenOn'); sessionStorage.setItem('mtOpenSeen', 1);
    if (!panel) {
      panel = document.createElement('section'); panel.id = 'mtParty'; panel.setAttribute('aria-label', '정당별 돈 추적');
      panel.innerHTML = `<button class="x" type="button" aria-label="닫기">×</button><h2>🏛️ 정당별 돈 추적</h2>
<p>정당을 고르면 돈 흐름이 지도에 나와요. 주황 선은 나라가 준 돈(국고보조금)이에요. 노란 점은 국회의원이 돈을 쓴 곳이에요.</p>
<div class="chips" role="group" aria-label="정당 고르기"></div>
<div class="row"><button type="button" class="home">⟲ 처음으로</button></div>
<div class="warn"><b>꼭 읽어 주세요</b><br>· 숫자는 원자료와 맞춰 봤어요. 확인 못 한 숫자에만 ${U}를 붙였어요.<br>· 정당은 <b>당시 소속</b>이에요. 후원회를 신고할 때의 정당이고, 나중에 당을 옮긴 건 반영 안 됐어요.<br>· 점 위치는 <b>근사치</b>일 수 있어요. 일부는 시·군·구 가운데에 찍었어요.<br>· 원자료는 종이 서류를 기계로 읽은 것(글자 인식, OCR)이라 <b>글자가 틀렸을 수 있어요</b>.<br>· 일반 사람에게 쓴 돈은 "개인"으로만 세고, 지도에 점을 찍지 않아요.<br>· 사람 이름처럼 보이는 가게는 "개인사업자(시군구)"로만 보여 줘요.</div>
<div class="cards"></div>
<h3>국고보조금</h3><p class="src">정당 이름은 돈을 받을 때 이름이에요.</p><table class="sub"></table>
<h3>의석 없는 정당에 낸 돈</h3><p class="src">원자료에 적힌 말 그대로 옮겼어요.</p><table class="ns"></table>
<h3>어려운 말 풀이</h3><dl><dt>국고보조금</dt><dd>나라가 세금으로 정당에 주는 돈이에요.</dd><dt>정치자금</dt><dd>정치 활동에 쓰는 돈이에요. 의원은 쓴 내역을 선관위에 알려야 해요.</dd><dt>법인</dt><dd>회사처럼 법으로 만든 단체예요.</dd><dt>개인사업자</dt><dd>혼자 가게나 사업을 하는 사람이에요. 그래서 시·군·구까지만 보여 줘요.</dd><dt>OCR</dt><dd>사진 속 글자를 기계가 읽어 글로 바꾸는 기술이에요.</dd></dl>
<p class="src">출처: 오마이뉴스·경향신문·뉴스타파 공동 「2024년 국회의원 정치자금 수입·지출」 자료(원자료: 중앙선관위 회계보고). 국고보조금: 중앙선거관리위원회 「연도별 국고보조금 지급내역」(공공누리 출처표시-상업적 이용금지-변경금지). 지도 좌표: © OpenStreetMap contributors(Nominatim). 평가 없이 원자료 문구만 옮겼어요. 정정·삭제 요청: 운영자 연락처 준비 중 ${U}</p>`;
      ['touchstart', 'touchmove', 'pointerdown', 'wheel'].forEach((ev) => panel.addEventListener(ev, (e) => e.stopPropagation(), {passive: true}));
      panel.querySelector('.x').onclick = close; panel.querySelector('.home').onclick = reset;
      document.body.append(panel); document.body.classList.add('mt-party');
    }
    if (!layer) { RND = RND || L.canvas({padding: 0.3}); layer = L.layerGroup().addTo(m); }
    const go = () => {
      const ch = panel.querySelector('.chips');
      if (!ch.children.length) { ch.innerHTML = IDX.parties.map((p, i) => '<button type="button" aria-pressed="false">' + esc(p.name) + '</button>').join(''); [...ch.children].forEach((b, i) => b.onclick = () => show(i)); }
      const k = IDX.parties.findIndex((p) => p.name === name); show(k >= 0 ? k : (cur != null ? cur : 0));
    };
    if (IDX) go(); else fetch(BASE + 'index.json?v=' + V).then((r) => r.json()).then((d) => { IDX = d; if (panel) go(); });
  }
  window.mtParty = {open, close, toggle: () => (panel ? close() : open())};
  const start = () => { const q = new URLSearchParams(location.search).get('party'); if (q != null) { const t = setInterval(() => { if (map()) { clearInterval(t); open(q); } }, 200); setTimeout(() => clearInterval(t), 15000); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
