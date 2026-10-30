/* US member-trade layer for the world command room.
   Plots members with recent House PTR filings (data/us/trades-recent.json) at their
   office/district location (data/us/members.json). Shown in All and US views. */
(function () {
  var en = function () { return /(^|[?&])lang=en\b/.test(location.search) || document.documentElement.lang === 'en'; };
  var layer = null, busy = null;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s || '').toLowerCase().replace(/\b(dr|jr|sr|ii|iii|mr|mrs|ms)\b\.?/g, ' ').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean); };
  function match(who, M) {
    var w = norm(who); if (!w.length) return null; var last = w[w.length - 1], first = w[0];
    var c = M.filter(function (m) { var n = norm(m.name); return n.length && n[n.length - 1] === last; });
    if (c.length > 1) c = c.filter(function (m) { return norm(m.name)[0] === first; });
    return c.length === 1 ? c[0] : null;
  }
  function load() {
    if (busy) return busy;
    var J = function (u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); };
    busy = Promise.all([J('../data/us/members.json'), J('../data/us/trades-recent.json')]).then(function (x) {
      var M = (x[0] && x[0].members) || [], T = (x[1] && x[1].trades) || [], by = {};
      T.forEach(function (t) { var m = match(t.who, M); if (!m || !m.ll) return; (by[m.id] = by[m.id] || { m: m, t: [] }).t.push(t); });
      return Object.keys(by).map(function (k) { return by[k]; });
    });
    return busy;
  }
  function show() {
    var map = window.moneyTrackerMap; if (!map || !window.L) return;
    if (layer) { if (!map.hasLayer(layer)) layer.addTo(map); return; }
    layer = L.layerGroup().addTo(map);
    var z = function () { map.getContainer().classList.toggle('mtUsFar', map.getZoom() < 4); }; map.on('zoomend', z); z();
    load().then(function (rows) {
      rows.forEach(function (r) {
        var m = r.m, p = m.party === 'R' ? '#ff6b6b' : m.party === 'D' ? '#5aa9ff' : '#cfd8dc';
        var last = m.name.split(' ').slice(-1)[0];
        var html = '<span class="mtUsDot" style="background:' + p + '"></span><span class="mtUsLab">' + esc(last) + ' · ' + r.t.length + '</span>';
        var mk = L.marker(m.ll, { icon: L.divIcon({ className: 'mtUsMk', html: html, iconSize: null, iconAnchor: [6, 6] }), title: m.name });
        var rows = r.t.slice(0, 6).map(function (t) {
          return '<li><b>$' + esc(t.tk) + '</b> ' + (t.ty === 'P' ? (en() ? 'buy' : '매수') : t.ty === 'S' || t.ty === 'S (partial)' ? (en() ? 'sale' : '매도') : esc(t.ty)) + ' ' + esc(t.amt) + ' · ' + esc(t.d) + ' <a href="' + esc(t.doc) + '" target="_blank" rel="noopener">PTR ↗</a></li>';
        }).join('');
        mk.bindPopup('<div class="mtUsPop"><b>' + esc(m.name) + '</b> (' + esc(m.party) + '-' + esc(m.state) + (m.district ? '-' + esc(m.district) : '') + ')<ul>' + rows + '</ul><a href="../member.html?n=' + encodeURIComponent(r.t[0].who) + (en() ? '&lang=en' : '') + '">' + (en() ? 'Member card →' : '의원 카드 →') + '</a><small>' + (en() ? 'Recent House PTR filings. Trade date to filing can lag up to 45 days. Not investment advice.' : '최근 하원 PTR 신고. 거래일→신고일 최대 45일 차이. 투자 조언 아님.') + '</small></div>');
        mk.addTo(layer);
      });
    });
  }
  function hide() { var map = window.moneyTrackerMap; if (map && layer && map.hasLayer(layer)) map.removeLayer(layer); }
  var css = document.createElement('style');
  css.textContent = '.mtUsMk{display:flex!important;align-items:center;gap:4px;white-space:nowrap;pointer-events:auto}.mtUsDot{width:12px;height:12px;border-radius:50%;border:2px solid #021;box-shadow:0 0 6px #000}.mtUsLab{font:700 11px ui-monospace,Menlo,monospace;color:#e8fff1;background:#021a0ecc;border:1px solid #2f8a55;border-radius:4px;padding:1px 4px}.mtUsFar .mtUsLab{display:none}.mtUsPop ul{margin:6px 0;padding-left:16px}.mtUsPop small{display:block;margin-top:6px;color:#567}';
  document.head.appendChild(css);
  function init() {
    var tries = 0, t = setInterval(function () { if (window.moneyTrackerMap || ++tries > 60) { clearInterval(t); show(); } }, 250);
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('#mtOneDock button'); if (!b) return;
      var i = Array.prototype.indexOf.call(b.parentNode.children, b);
      if (i === 0 || i === 1) show(); else if (i === 2) hide();
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.mtUsLayer = { show: show, hide: hide };
})();
