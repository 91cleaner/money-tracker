/* 태평양 중심 지도: 경도 -30도를 이음매로 삼아 -30~330 범위에 그려요. */
(function () {
  if (!window.L || L._mtPac) return; L._mtPac = 1;
  var S = -30, raw = false;
  var W = window.mtW = function (lo) { while (lo < S) lo += 360; while (lo >= S + 360) lo -= 360; return lo; };
  var proj = L.Map.prototype.project;
  L.Map.prototype.project = function (ll, z) {
    ll = L.latLng(ll); if (raw) return proj.call(this, ll, z);
    var lo = W(ll.lng); return lo === ll.lng ? proj.call(this, ll, z) : proj.call(this, L.latLng(ll.lat, lo), z);
  };
  var pl = L.Polyline.prototype._projectLatlngs;
  L.Polyline.prototype._projectLatlngs = function (lls, res, pb) {
    if (!lls.length || !(lls[0] instanceof L.LatLng)) return pl.call(this, lls, res, pb);
    var mn = 1e9, mx = -1e9, i, c = [], p = null;
    for (i = 0; i < lls.length; i++) { var w = W(lls[i].lng); if (w < mn) mn = w; if (w > mx) mx = w;
      var x = lls[i].lng; if (p !== null) { while (x - p > 180) x -= 360; while (p - x > 180) x += 360; } c.push(x); p = x; }
    if (mx - mn <= 180) return pl.call(this, lls, res, pb);
    var lo = Math.min.apply(null, c), hi = Math.max.apply(null, c);
    if (hi - lo > 180) return pl.call(this, lls, res, pb);
    var m = (lo + hi) / 2, off = W(m) - m, a = [];
    for (i = 0; i < c.length; i++) a.push(L.latLng(lls[i].lat, c[i] + off));
    raw = true; try { pl.call(this, a, res, pb); } finally { raw = false; }
  };
  /* 타일 격자는 원래 경도(-180~180) 기준으로 감싸야 해요 */
  var rg = L.GridLayer.prototype._resetGrid;
  L.GridLayer.prototype._resetGrid = function () { raw = true; try { return rg.apply(this, arguments); } finally { raw = false; } };
  var ct = L.LatLngBounds.prototype.contains;
  L.LatLngBounds.prototype.contains = function (o) {
    if (ct.call(this, o)) return true;
    if (o instanceof L.LatLngBounds || !o) return false;
    var q = L.latLng(o); return ct.call(this, L.latLng(q.lat, W(q.lng))) || ct.call(this, L.latLng(q.lat, W(q.lng) - 360));
  };
})();
