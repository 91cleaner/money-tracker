/* 미국주식추적단 / 세금추적단 — daily visitor count. No cookies, no personal data, no account.
   Each browser adds 1 to today's counter once per day (Korea time), and 1 to today's page-view counter per page load.
   The only thing kept in the browser is the date of the last count (localStorage "mt.visit.day").
   Counter: Abacus (free public counting API, abacus.jasoncameron.dev). Numbers: visits.html. */
(function () {
  "use strict";
  var share = !!(document.currentScript && document.currentScript.getAttribute("data-share"));
  try {
    if (!/github\.io$/.test(location.hostname)) return;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return;
    var day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
    var B = "https://abacus.jasoncameron.dev/hit/91cleaner-money-tracker/";
    var go = function (k) { try { fetch(B + k, { mode: "cors", credentials: "omit", keepalive: true }).catch(function () {}); } catch (e) {} };
    if (!share) go("pv-" + day); // share pages redirect at once; the page they open counts the view
    var last = null; try { last = localStorage.getItem("mt.visit.day"); } catch (e) {}
    if (last !== day) { go("v-" + day); try { localStorage.setItem("mt.visit.day", day); } catch (e) {} }
  } catch (e) {}
})();
