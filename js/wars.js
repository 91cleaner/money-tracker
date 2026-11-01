/* 역사: 나라별 큰 전쟁. 나라 버튼 → 전쟁 버튼 → history.js 재생기(HIS.open)로 짧게 재생. 자료: data/worldhist/wars_index.json, data/worldhist/war_*.json */
(() => {
  const box = document.getElementById('warBox'); if (!box) return;
  const st = document.createElement('style');
  st.textContent = '#warBox{margin-top:8px}#warList[hidden],#warW[hidden]{display:none}#warList,#warW{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px}#warW{grid-template-columns:1fr 1fr}' +
    '#warBox .wb{min-height:44px;border:1px solid #2e6b4a;border-radius:10px;background:#04140b;color:#e8fff0;font:600 14px system-ui,sans-serif;text-align:left;padding:6px 10px;cursor:pointer}#warBox .wb.on{background:#0b2a19;border-color:#5dff9e}#warBox .wb:disabled{opacity:.45;cursor:default}' +
    '#warBox small{display:block;opacity:.65;font-weight:400;font-size:11px}#warW .hd{grid-column:1/-1;font:700 13px system-ui,sans-serif;color:#9effc0;border-top:1px solid #2e6b4a;padding-top:6px}';
  document.head.append(st);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  box.innerHTML = '<button type="button" class="btn prime" id="warOpen" style="width:100%;min-height:44px">역사<span style="display:block;font-weight:400;font-size:11px;opacity:.75">나라별 전쟁</span></button><div id="warList" hidden></div><div id="warW" hidden></div>';
  const $ = (id) => document.getElementById(id);
  let IX = null;
  const load = () => IX ? Promise.resolve(IX) : fetch('data/worldhist/wars_index.json').then((r) => r.json()).then((j) => (IX = j));
  $('warOpen').addEventListener('click', () => {
    const l = $('warList'); if (!l.hidden) { l.hidden = true; $('warW').hidden = true; return; }
    load().then((j) => {
      l.innerHTML = j.map((c, k) => `<button type="button" class="wb" data-k="${k}"${c.wars.length ? '' : ' disabled'}>${esc(c.n)}${c.wars.length ? '' : '<small>준비 중</small>'}</button>`).join('');
      l.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => country(+b.dataset.k, b)));
      l.hidden = false;
    }).catch(() => { l.textContent = '불러오지 못했어요'; l.hidden = false; });
  });
  function country(k, btn) {
    const c = IX[k], w = $('warW');
    $('warList').querySelectorAll('.wb').forEach((b) => b.classList.toggle('on', b === btn));
    w.innerHTML = `<div class="hd">${esc(c.n)}</div>` + c.wars.map((x) => `<button type="button" class="wb" data-id="${esc(x.id)}">${esc(x.title)}<small>${esc(x.period)}</small></button>`).join('');
    w.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { if (window.HIS) HIS.open(b.dataset.id); }));
    w.hidden = false;
  }
})();
