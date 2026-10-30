/* Korean map buttons: Leaflet's built-in zoom tooltips and logo tooltip are English. Korean mode only. */
(function () {
  var en = false; try { var q = new URLSearchParams(location.search).get("lang"); en = q ? q === "en" : localStorage.getItem("mt.lang") === "en"; } catch (e) {}
  var L = window.L; if (en || !L || !L.Control) return;
  if (L.Control.Zoom) { L.Control.Zoom.prototype.options.zoomInTitle = "확대"; L.Control.Zoom.prototype.options.zoomOutTitle = "축소"; }
  if (L.Control.Attribution) L.Control.Attribution.prototype.options.prefix = '<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>';
})();
