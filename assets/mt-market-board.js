/* 미국주식추적단 — 상황판 (market situation board). Shows collected public data only: upcoming official dates,
   policy rates, Taiwan monthly revenue, latest US/China trade-control notices, sector → factor links.
   No forecast, no recommendation. Every number links to its source. Self-contained: does not touch other modules. */
(function () {
  "use strict";
  var root = document.getElementById("pg");
  if (!root || document.getElementById("mtBoardBtn")) return;
  var D = "data/market/";
  var css = document.createElement("style");
  css.textContent =
    "#mtBoardBtn{position:absolute;z-index:760;right:12px;top:66px;height:32px;padding:0 12px;border-radius:8px;border:1px solid #3e7354;background:#04150fe6;color:#a2ffba;font:700 12px ui-monospace,Menlo,monospace;cursor:pointer;letter-spacing:.04em}" +
    "#mtBoardBtn[aria-expanded=true]{background:#5dff9e;color:#02110a}" +
    "#mtBoard{position:absolute;z-index:770;right:12px;top:104px;width:min(380px,calc(100% - 24px));max-height:min(62dvh,560px);overflow:auto;overscroll-behavior:contain;background:rgba(2,12,7,.96);border:1px solid #2a7a4a;border-radius:12px;box-shadow:0 12px 36px #000c;color:#d5f7e1;font:12px/1.45 system-ui,sans-serif;padding:10px 12px}" +
    "#mtBoard[hidden]{display:none}#mtBoard h4{margin:10px 0 5px;font:700 11px ui-monospace,Menlo,monospace;color:#80ffad;letter-spacing:.06em}#mtBoard h4:first-of-type{margin-top:2px}" +
    "#mtBoard .r{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid #12301f}#mtBoard .r span:last-child{color:#eafff2;text-align:right;white-space:nowrap}" +
    "#mtBoard a{color:#7fd8ff;text-decoration:none}#mtBoard a:hover{text-decoration:underline}#mtBoard .muted{color:#7fa58f;font-size:11px}" +
    "#mtBoard select{width:100%;margin:2px 0 4px;background:#06170f;color:#d5f7e1;border:1px solid #2a7a4a;border-radius:6px;padding:5px;font-size:16px}" +
    "#mtBoard .x{position:sticky;top:0;float:right;min-width:32px;min-height:28px;border:1px solid #4a8b62;border-radius:7px;background:#10291b;color:#fff;cursor:pointer}" +
    "@media(max-width:650px){#mtBoardBtn{top:62px;right:8px}#mtBoard{top:98px;right:8px;max-height:46dvh}}";
  document.head.appendChild(css);

  var btn = document.createElement("button");
  btn.id = "mtBoardBtn"; btn.type = "button"; btn.textContent = "▦ 상황판";
  btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", "mtBoard");
  var panel = document.createElement("section");
  panel.id = "mtBoard"; panel.hidden = true; panel.setAttribute("aria-label", "공개 자료 상황판");
  root.appendChild(btn); root.appendChild(panel);

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function link(text, url) { var a = el("a", "", text); if (/^https:\/\//.test(url || "")) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; } return a; }
  function row(left, right) { var r = el("div", "r"); var l = el("span"); if (left && left.nodeType) l.appendChild(left); else l.textContent = left; var v = el("span"); if (right && right.nodeType) v.appendChild(right); else v.textContent = right; r.append(l, v); return r; }
  function get(f) { return fetch(D + f, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  var REGION = { us: "미국", eu: "유로존", jp: "일본", kr: "한국" };
  var RATE = { KR: "한국", US: "미국", XM: "유로존", JP: "일본", CN: "중국", GB: "영국" };
  var loaded = false;

  function render(cal, sectors, rates, tw, usTrade, cn, krx) {
    panel.replaceChildren();
    var x = el("button", "x", "×"); x.type = "button"; x.setAttribute("aria-label", "상황판 닫기"); x.addEventListener("click", toggle); panel.appendChild(x);
    panel.appendChild(el("p", "muted", "공개 자료 그대로 · 예상·추천 아님 · 판단은 이용자"));

    panel.appendChild(el("h4", "", "다가오는 공식 일정"));
    var today = new Date().toISOString().slice(0, 10);
    var next = ((cal && cal.events) || []).filter(function (e) { return e.date >= today; }).slice(0, 6);
    if (!next.length) panel.appendChild(el("p", "muted", "등록된 다가오는 일정 없음"));
    next.forEach(function (e) { panel.appendChild(row(link((REGION[e.region] || e.region) + " · " + e.title.replace(/^(미국|유럽중앙은행|일본은행)\s*/, ""), e.source_url), e.date + (e.tentative ? " (잠정)" : ""))); });

    panel.appendChild(el("h4", "", "기준금리 (BIS 월간)"));
    var rs = (rates && rates.series) || {};
    Object.keys(RATE).forEach(function (k) { if (rs[k]) panel.appendChild(row(RATE[k], rs[k].latest.value.toFixed(2) + "% · " + rs[k].latest.date)); });
    panel.appendChild(el("p", "muted")).appendChild(link("출처: BIS 중앙은행 정책금리", rates && rates.source_url));

    panel.appendChild(el("h4", "", "대만 월매출 (전년 대비)"));
    [["2330", "TSMC"], ["2454", "미디어텍"], ["2317", "폭스콘"], ["2308", "델타"]].forEach(function (pair) {
      var c = pair[0], h = tw && tw.history && tw.history[c], p = h && h.points[h.points.length - 1];
      if (p) panel.appendChild(row(pair[1] + " · " + p.month, p.yoy_pct == null ? "-" : (p.yoy_pct >= 0 ? "+" : "") + p.yoy_pct.toFixed(1) + "%"));
    });
    panel.appendChild(el("p", "muted")).appendChild(link("출처: 대만증권거래소 공시", tw && tw.source_url));

    if (krx && krx.items) {
      panel.appendChild(el("h4", "", "한국 품목별 수출 (관세청)"));
      [["8542", "집적회로(반도체)"], ["8703", "승용차"], ["2710", "석유제품"], ["8901", "선박"], ["8507", "배터리"]].forEach(function (pair) {
        var it = krx.items[pair[0]]; if (!it || !it.latest) return;
        var l = it.latest, pm = (Number(l.month.slice(0, 4)) - 1) + l.month.slice(4), prev = (it.points || []).filter(function (p) { return p.month === pm; })[0];
        var yoy = prev && prev.exp_usd ? (l.exp_usd / prev.exp_usd - 1) * 100 : null;
        panel.appendChild(row(pair[1] + " · " + l.month, Math.round(l.exp_usd / 1e8).toLocaleString("en-US") + "억 달러" + (yoy == null ? "" : " (" + (yoy >= 0 ? "+" : "") + yoy.toFixed(1) + "%)")));
      });
      panel.appendChild(el("p", "muted")).appendChild(link("출처: 관세청 (HS 품목 기준, 산업부 분류와 다를 수 있음)", krx.source_url));
    }
    panel.appendChild(el("h4", "", "최근 수출통제·관세 고시"));
    ((usTrade && usTrade.documents) || []).filter(function (d) { return d.entity_list || d.china; }).slice(0, 3)
      .forEach(function (d) { panel.appendChild(row(link("미국 · " + d.title.slice(0, 54), d.url), d.date)); });
    ((cn && cn.items) || []).filter(function (d) { return d.export_control; }).slice(0, 3)
      .forEach(function (d) { panel.appendChild(row(link("중국 · " + d.title.replace(/^商务部\s*/, "").slice(0, 40), d.url), d.number ? d.number.replace("-", "-제") + "호" : "")); });

    panel.appendChild(el("h4", "", "업종별로 함께 볼 공개 지표"));
    var list = (sectors && sectors.sectors) || [], factors = {};
    ((sectors && sectors.factors) || []).forEach(function (f) { factors[f.id] = f; });
    var sel = el("select"); sel.setAttribute("aria-label", "업종 선택");
    list.forEach(function (s) { var o = el("option", "", s.label); o.value = s.id; sel.appendChild(o); });
    var box = el("div");
    function showSector() {
      box.replaceChildren();
      var s = list.filter(function (v) { return v.id === sel.value; })[0]; if (!s) return;
      s.factors.forEach(function (id) { var f = factors[id]; if (f) box.appendChild(row(link(f.label, f.source_url), f.status === "collected" ? "수집 중" : "예정")); });
    }
    sel.addEventListener("change", showSector);
    if (list.length) { panel.append(sel, box); showSector(); }
    panel.appendChild(el("p", "muted", "참고용 연결이며 원인 관계를 단정하지 않습니다."));
  }

  function load() {
    if (loaded) return; loaded = true;
    panel.replaceChildren(el("p", "muted", "공개 자료 불러오는 중…"));
    Promise.all(["calendar.json", "sectors.json", "factors/policy-rates.json", "factors/tw-monthly-revenue.json", "factors/us-trade-controls.json", "factors/cn-mofcom-announcements.json", "factors/kr-exports-by-item.json"].map(get))
      .then(function (r) { render.apply(null, r); })
      .catch(function () { panel.replaceChildren(el("p", "muted", "자료를 불러오지 못했습니다.")); loaded = false; });
  }
  function toggle() {
    var open = panel.hidden;
    panel.hidden = !open; btn.setAttribute("aria-expanded", String(open));
    if (open) load();
  }
  btn.addEventListener("click", toggle);
  window.MTMarketBoard = { open: function () { if (panel.hidden) toggle(); }, close: function () { if (!panel.hidden) toggle(); } };
})();
