/* MONEY TRACKER — 위성 작전 모드 (satellite ops). A game-like guided flight over real satellite imagery on the
   existing control-room map: autopilot with briefing captions (optional Korean voice), manual control, and a clean
   recording mode for promo videos. Facts shown come from collected public data files and official links only.
   No forecast, no recommendation. Self-contained: uses window.MTCommand.map and touches no other module. */
(function () {
  "use strict";
  var root = document.getElementById("pg");
  if (!root || document.getElementById("mtOpsBtn")) return;
  var D = "data/";

  var css = document.createElement("style");
  css.textContent = [
    "#mtOpsBtn{position:absolute;z-index:760;right:112px;top:66px;height:32px;padding:0 12px;border-radius:8px;border:1px solid #3e7354;background:#04150fe6;color:#a2ffba;font:700 12px ui-monospace,Menlo,monospace;cursor:pointer;letter-spacing:.04em}",
    "body.mt-ops #mtOpsBtn{display:none}",
    "body.mt-ops #mtSat,body.mt-ops #mtStatus,body.mt-ops #pg .pg-say,body.mt-ops .leaflet-control-zoom,body.mt-ops #pg .pg-file,body.mt-ops #mtChoices,body.mt-ops #mtResearch,body.mt-ops #mtBoard,body.mt-ops .mt-flight{display:none!important}",
    "body.mt-ops-rec .nbar,body.mt-ops-rec #usCmd,body.mt-ops-rec #mtStatus,body.mt-ops-rec #mtSat,body.mt-ops-rec #pg .pg-top,body.mt-ops-rec #pg .pg-say,body.mt-ops-rec #pg .pg-bar,body.mt-ops-rec #mtBoardBtn,body.mt-ops-rec .leaflet-control-zoom,body.mt-ops-rec #mtTileFallback{display:none!important}",
    "body.mt-ops-rec #pg{height:100dvh!important;min-height:0!important}",
    "#opsHud{position:absolute;z-index:820;left:12px;top:100px;min-width:220px;padding:8px 11px;border:1px solid #2f8a55;border-radius:8px;background:rgba(1,12,6,.72);color:#9dffbf;font:600 11px/1.55 ui-monospace,Menlo,monospace;letter-spacing:.05em;pointer-events:none;text-shadow:0 0 6px rgba(80,255,160,.35)}",
    "body.mt-ops-rec #opsHud{top:12px}",
    "#opsHud .live{color:#ff5a5a}#opsHud .opstg{color:#eafff2;border:0;padding:0;background:none}#opsHud .md{color:#ffd36b}",
    "#opsReticle{position:absolute;z-index:810;left:50%;top:50%;width:150px;height:150px;margin:-75px 0 0 -75px;pointer-events:none;opacity:0;transition:opacity .4s}",
    "#opsReticle.on{opacity:1}#opsReticle svg{width:100%;height:100%;animation:opsLock 1s ease-out both}",
    "@keyframes opsLock{from{transform:scale(1.8) rotate(-30deg);opacity:0}to{transform:none;opacity:1}}",
    "#opsCap{position:absolute;z-index:830;left:50%;transform:translateX(-50%);bottom:calc(74px + env(safe-area-inset-bottom,0px));width:min(720px,calc(100% - 20px));padding:12px 14px 10px;border:1px solid #3aa86a;border-radius:12px;background:rgba(1,10,5,.88);color:#e6fff0;box-shadow:0 10px 34px #000b}",
    "body.mt-ops-rec #opsCap{bottom:calc(16px + env(safe-area-inset-bottom,0px))}",
    "#opsCap .k{font:700 11px ui-monospace,Menlo,monospace;color:#6dffa6;letter-spacing:.08em;margin-bottom:5px}",
    "#opsCap .t{font:600 16px/1.55 system-ui,sans-serif;min-height:3.1em}",
    "#opsCap .s{margin-top:6px;font:11px system-ui,sans-serif;color:#86b79a}#opsCap .s a{color:#7fd8ff;text-decoration:none}",
    "#opsCtl{position:absolute;z-index:840;right:12px;top:104px;display:flex;gap:6px}","body.mt-ops-rec #opsCtl{top:12px}",
    
    "#opsCtl button{min-width:42px;height:38px;border:1px solid #3e7354;border-radius:9px;background:#06170fe8;color:#c9ffdc;font:700 14px ui-monospace,Menlo,monospace;cursor:pointer}",
    "#opsCtl button[aria-pressed=true]{background:#5dff9e;color:#02110a}",
    "@media(max-width:700px){#mtOpsBtn{right:104px;top:62px}#opsHud{top:96px;min-width:0;font-size:10px}#opsCap{bottom:calc(120px + env(safe-area-inset-bottom,0px))}#opsCap .t{font-size:14px}#opsCtl{top:auto;bottom:calc(70px + env(safe-area-inset-bottom,0px));right:8px}body.mt-ops-rec #opsCtl{top:auto;bottom:calc(12px + env(safe-area-inset-bottom,0px))}#opsCtl button{min-width:38px;height:36px}}",
    "@media(max-width:700px){body.mt-ops-rec #opsCap{bottom:calc(64px + env(safe-area-inset-bottom,0px))}}"
  ].join("");
  document.head.appendChild(css);

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function get(p) { return fetch(D + p, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function eok(v) { return Math.round(v / 1e8).toLocaleString("ko-KR"); }
  function pct(v) { return (v >= 0 ? "+" : "") + Number(v).toFixed(1) + "%"; }
  var TK = { NVDA: "엔비디아", AVGO: "브로드컴", TSM: "TSMC", AMD: "AMD", MU: "마이크론", INTC: "인텔", ADI: "아나로그디바이스", LRCX: "램리서치", QCOM: "퀄컴", ASML: "ASML" };

  // Stops of the semiconductor chain. Coordinates: US Capitol (existing mission), TSMC Arizona (Wikipedia, ~1 km),
  // TSMC Fab 12A / head office Hsinchu (Wikipedia), Maricopa County (Census Gazetteer via collected jobs file),
  // Icheon (city coordinates, Wikipedia). Text functions receive collected data `d`.
  var STOPS = [
    { id: "intro", label: "GLOBAL · 위성 링크 연결", at: [28, -40], zoom: 2.75,
      text: function () { return "위성 연결 완료. 반도체 한 개가 법에서 공장으로, 공장에서 일자리와 수출로 어떻게 이어지는지 기록을 따라가 봅니다."; } },
    { id: "capitol", label: "워싱턴 D.C. · 미국 의회", at: [38.8899, -77.0091], zoom: 16,
      text: function () { return "2022년 8월 9일, 이곳 미국 의회가 만든 반도체법(CHIPS and Science Act, H.R.4346)이 법이 됐습니다. 미국 땅에 반도체 공장을 지으면 정부가 돈을 보태겠다는 법입니다."; },
      src: ["Congress.gov · H.R.4346", "https://www.congress.gov/bill/117th-congress/house-bill/4346"] },
    { id: "tsmc-az", label: "애리조나 피닉스 · TSMC 애리조나 공장 부지", at: [33.78, -112.16], zoom: 15, note: "좌표: 위키백과(약 1km 정밀도)",
      text: function () { return "미 상무부는 이 법에 따른 TSMC 애리조나 공장 지원금 확정을 2024년 11월에 발표했습니다. 지금 보이는 곳이 피닉스 북쪽 사막에 들어선 공장 부지입니다."; },
      src: ["미 상무부 보도자료 (2024.11)", "https://www.commerce.gov/news/press-releases/2024/11/biden-harris-administration-announces-chips-incentives-award-tsmc"] },
    { id: "maricopa", label: "애리조나 · 마리코파 카운티 반도체 일자리", at: [33.345, -112.499], zoom: 10, note: "좌표: 미국 인구조사국 카운티 대표점",
      text: function (d) {
        var c = d.jobs && d.jobs.industries && d.jobs.industries["3344"] && d.jobs.industries["3344"].counties.filter(function (x) { return x.fips === "04013"; })[0];
        if (!c) return "이 공장이 있는 마리코파 카운티의 반도체 일자리 기록은 아직 불러오지 못했습니다.";
        return "공장이 있는 마리코파 카운티의 반도체·전자부품 제조 민간 일자리는 " + c.employment.toLocaleString("ko-KR") + "명(" + c.period + ")" +
          "입니다" + (c.yoy_change != null && c.yoy_change !== 0 ? ". 1년 전보다 " + Math.abs(c.yoy_change).toLocaleString("ko-KR") + "명 " + (c.yoy_change > 0 ? "늘었습니다" : "줄었습니다") : "") + ". 공장이 지역 일자리로 이어지는지, 숫자로 직접 확인할 수 있습니다.";
      },
      src: ["미국 노동통계국 QCEW", "https://www.bls.gov/cew/"] },
    { id: "hsinchu", label: "대만 신주 과학단지 · TSMC 본사(12A 공장)", at: [24.773583, 121.013111], zoom: 16, note: "좌표: 위키백과",
      text: function (d) {
        var h = d.tw && d.tw.history && d.tw.history["2330"], p = h && h.points[h.points.length - 1];
        if (!p) return "바다 건너 대만 신주, TSMC 본사입니다.";
        return "바다 건너 대만 신주, TSMC 본사입니다. TSMC가 공시한 " + p.month.replace("-", "년 ") + "월 매출은 약 NT$" + eok(p.revenue * 1000) + "억, 1년 전 같은 달보다 " + pct(p.yoy_pct) + "입니다.";
      },
      src: ["대만증권거래소 월매출 공시", "https://openapi.twse.com.tw/v1/opendata/t187ap05_L"] },
    { id: "icheon", label: "경기도 이천 · SK하이닉스 본사가 있는 도시", at: [37.267, 127.433], zoom: 12, note: "좌표: 도시 대표 좌표(공장 정확한 위치 아님)",
      text: function (d) {
        var it = d.krx && d.krx.items && d.krx.items["8542"];
        if (!it || !it.latest) return "그리고 한국, 메모리 반도체 공장이 모인 경기도 이천입니다.";
        var l = it.latest, pm = (Number(l.month.slice(0, 4)) - 1) + l.month.slice(4), prev = (it.points || []).filter(function (x) { return x.month === pm; })[0];
        return "그리고 한국, 메모리 반도체 공장이 모인 경기도 이천입니다. 관세청 기록으로 " + l.month.replace("-", "년 ") + "월 한국의 집적회로(HS 8542) 수출은 " + eok(l.exp_usd) + "억 달러" +
          (prev && prev.exp_usd ? ", 1년 전 같은 달보다 " + pct((l.exp_usd / prev.exp_usd - 1) * 100) : "") + "입니다.";
      },
      src: ["관세청 품목별 수출입실적", "https://www.data.go.kr/"] },
    { id: "capitol2", label: "다시 워싱턴 · 의원 주식거래 공시", at: [38.8899, -77.0091], zoom: 15,
      text: function (d) {
        var s = d.trades; if (!s || !s.count) return "다시 워싱턴. 의원들의 주식거래 공시 기록을 확인합니다.";
        var top = s.by_ticker.slice(0, 3).map(function (x) { return (TK[x.tk] || x.tk) + " " + x.n + "건"; }).join(", ");
        return "다시 워싱턴. " + s.from + "부터 " + s.to + "까지 미국 하원의원들이 공시한 반도체 종목 거래는 " + s.count + "건입니다(" + top + "). 공개된 기록일 뿐, 잘잘못을 말하는 것은 아닙니다.";
      },
      src: ["미국 하원 재산공개(PTR)", "https://disclosures-clerk.house.gov/FinancialDisclosure"] },
    { id: "outro", label: "MISSION COMPLETE · 사슬 추적 완료", at: [30, 10], zoom: 2.5,
      text: function () { return "법 → 공장 → 일자리 → 매출 → 수출 → 의원 거래. 이 사슬은 모두 공개 기록으로 이어져 있습니다. 판단은 당신이 하세요. — MONEY TRACKER"; } }
  ];

  var S = { on: false, i: -1, auto: true, voice: false, rec: false, data: null, timer: 0, typing: 0, serial: 0, t0: 0, manual: false };
  var btn = el("button", "", "🛰 위성 작전"); btn.id = "mtOpsBtn"; btn.type = "button"; btn.setAttribute("aria-label", "위성 작전 모드 시작");
  root.appendChild(btn);
  var hud, ret, cap, capK, capT, capS, ctl, bPrev, bPlay, bNext, bVoice, bRec, bExit;

  function map() { return window.MTCommand && window.MTCommand.map; }
  function build() {
    hud = el("div"); hud.id = "opsHud"; hud.setAttribute("aria-hidden", "true");
    ret = el("div"); ret.id = "opsReticle";
    ret.innerHTML = '<svg viewBox="0 0 100 100" fill="none" stroke="#6dffa6" stroke-width="1.6"><circle cx="50" cy="50" r="30" stroke-dasharray="6 5"/><path d="M50 4v18M50 78v18M4 50h18M78 50h18"/><path d="M14 14h12M14 14v12M86 14H74M86 14v12M14 86h12M14 86V74M86 86H74M86 86V74" stroke="#d6ff9d"/></svg>';
    cap = el("section"); cap.id = "opsCap"; cap.setAttribute("aria-live", "polite");
    capK = el("div", "k"); capT = el("div", "t"); capS = el("div", "s"); cap.append(capK, capT, capS);
    ctl = el("div"); ctl.id = "opsCtl";
    function b(txt, label, fn) { var x = el("button", "", txt); x.type = "button"; x.setAttribute("aria-label", label); x.addEventListener("click", fn); ctl.appendChild(x); return x; }
    bPrev = b("◀", "이전 지점", function () { go(S.i - 1, true); });
    bPlay = b("❚❚", "자동비행 일시정지/재개", function () { setAuto(!S.auto); });
    bNext = b("▶", "다음 지점", function () { go(S.i + 1, true); });
    bVoice = b("🔈", "음성 브리핑 켜기/끄기", function () { S.voice = !S.voice; bVoice.textContent = S.voice ? "🔊" : "🔈"; bVoice.setAttribute("aria-pressed", String(S.voice)); if (!S.voice) stopVoice(); else speak(capT.dataset.full || ""); });
    bRec = b("⏺", "녹화 모드(화면 정리)", function () { setRec(!S.rec); });
    bExit = b("✕", "위성 작전 종료", stop);
    root.append(hud, ret, cap, ctl);
  }

  function altitudeKm(m) {
    var c = m.getCenter(), z = m.getZoom(), mpp = 156543.03392 * Math.cos(c.lat * Math.PI / 180) / Math.pow(2, z);
    return mpp * m.getSize().y / 1000;
  }
  function fmtCoord(v, pos, neg) { return Math.abs(v).toFixed(4) + "° " + (v >= 0 ? pos : neg); }
  function drawHud() {
    var m = map(); if (!m || !hud) return;
    var c = m.getCenter(), st = STOPS[S.i] || STOPS[0], t = Math.max(0, Math.round((Date.now() - S.t0) / 1000));
    var sat = document.getElementById("pg").classList.contains("sat");
    hud.innerHTML = "";
    var lines = [
      ['<span class="live">●</span> SAT-LINK ' + (sat ? "· 실제 위성 영상" : "· 전략 지도"), ""],
      ["TGT " + String(S.i + 1).padStart(2, "0") + "/" + String(STOPS.length).padStart(2, "0") + " · ", st.label, "tg"],
      ["LAT " + fmtCoord(c.lat, "N", "S") + "  LNG " + fmtCoord(c.lng, "E", "W"), ""],
      ["ALT ≈ " + (function (k) { return k >= 100 ? Math.round(k).toLocaleString("en-US") : k.toFixed(1); })(altitudeKm(m)) + " km · Z " + m.getZoom().toFixed(1), ""],
      ["T+" + String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0") + " · " + (S.manual ? "MANUAL" : S.auto ? "AUTOPILOT" : "HOLD"), "", S.manual ? "md" : ""]
    ];
    lines.forEach(function (l) { var d = el("div"); if (l[2] === "tg") { d.textContent = l[0]; var s = el("span", "opstg", l[1]); d.appendChild(s); } else { d.innerHTML = l[0]; if (l[2]) d.className = l[2]; } hud.appendChild(d); });
  }

  function stopVoice() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} }
  function speak(text) {
    if (!S.voice || !text || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    try { stopVoice(); var u = new SpeechSynthesisUtterance(text.replace(/—/g, ",")); u.lang = "ko-KR"; u.rate = 1.05; window.speechSynthesis.speak(u); } catch (e) {}
  }
  function type(text, done) {
    clearInterval(S.typing); capT.textContent = ""; capT.dataset.full = text;
    var i = 0, reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { capT.textContent = text; done(); return; }
    S.typing = setInterval(function () { i += 2; capT.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(S.typing); done(); } }, 28);
  }

  function fly(m, at, zoom, dur) {
    return new Promise(function (res) {
      var done = false, t; function fin() { if (done) return; done = true; m.off("moveend", fin); clearTimeout(t); res(); }
      m.once("moveend", fin); t = setTimeout(fin, (dur + 1.2) * 1000);
      m.flyTo(at, zoom, { animate: true, duration: dur });
    });
  }
  function go(i, byUser) {
    var m = map(); if (!m || !S.on) return;
    if (i < 0) i = 0; if (i >= STOPS.length) { setAuto(false); return; }
    var my = ++S.serial; clearTimeout(S.timer); clearInterval(S.typing); stopVoice();
    S.i = i; S.manual = false; if (byUser && !S.auto) setAuto(false);
    var st = STOPS[i]; ret.classList.remove("on");
    capK.textContent = "VECTOR · 이동 중 → " + st.label; capT.textContent = ""; capS.textContent = "";
    drawHud();
    var from = m.getCenter(), far = from.distanceTo(L.latLng(st.at)) > 1500000;
    var hop = far && st.zoom > 5 ? fly(m, [(from.lat + st.at[0]) / 2, st.at[1]], Math.max(m.getMinZoom(), 3), 2.2) : Promise.resolve();
    hop.then(function () { if (my !== S.serial) return; return fly(m, st.at, Math.max(m.getMinZoom(), st.zoom), far ? 2.8 : 2.2); }).then(function () {
      if (my !== S.serial) return;
      if (st.zoom >= 8) ret.classList.add("on");
      capK.textContent = (st.zoom >= 8 ? "TARGET LOCK · " : "") + st.label;
      var text = st.text(S.data || {});
      capS.replaceChildren();
      if (st.src) { var a = el("a", "", "원문: " + st.src[0] + " ↗"); a.href = st.src[1]; a.target = "_blank"; a.rel = "noopener noreferrer"; capS.appendChild(a); }
      if (st.note) capS.appendChild(document.createTextNode((st.src ? " · " : "") + st.note));
      speak(text);
      type(text, function () {
        if (my !== S.serial || !S.auto) return;
        S.timer = setTimeout(function () { if (my === S.serial && S.auto) go(S.i + 1); }, Math.max(3500, text.length * (S.voice ? 95 : 45)));
      });
    });
  }
  function setAuto(v) {
    S.auto = v; bPlay.textContent = v ? "❚❚" : "▶▶"; bPlay.setAttribute("aria-pressed", String(!v)); drawHud();
    if (v && capT.dataset.full && capT.textContent.length >= capT.dataset.full.length) { clearTimeout(S.timer); var my = S.serial; S.timer = setTimeout(function () { if (my === S.serial && S.auto) go(S.i + 1); }, 1500); }
    if (!v) clearTimeout(S.timer);
  }
  function setRec(v) { S.rec = v; document.body.classList.toggle("mt-ops-rec", v); bRec.setAttribute("aria-pressed", String(v)); var m = map(); if (m) setTimeout(function () { m.invalidateSize({ pan: false }); }, 50); }

  function userTook() { if (!S.on) return; S.manual = true; if (S.auto) setAuto(false); S.serial++; clearTimeout(S.timer); drawHud(); }
  function keys(e) {
    if (!S.on || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || "")) return;
    var m = map(), k = e.key, step = 120;
    var acts = {
      "ArrowRight": function () { go(S.i + 1, true); }, " ": function () { go(S.i + 1, true); }, "ArrowLeft": function () { go(S.i - 1, true); },
      "p": function () { setAuto(!S.auto); }, "P": function () { setAuto(!S.auto); }, "r": function () { setRec(!S.rec); }, "R": function () { setRec(!S.rec); },
      "h": function () { hud.hidden = !hud.hidden; }, "H": function () { hud.hidden = !hud.hidden; }, "Escape": stop,
      "w": function () { userTook(); m.panBy([0, -step]); }, "s": function () { userTook(); m.panBy([0, step]); }, "a": function () { userTook(); m.panBy([-step, 0]); }, "d": function () { userTook(); m.panBy([step, 0]); },
      "e": function () { userTook(); m.zoomIn(0.5); }, "q": function () { userTook(); m.zoomOut(0.5); }
    };
    if (acts[k]) { e.preventDefault(); acts[k](); }
  }

  function start(opts) {
    var m = map(); if (!m || S.on) return;
    opts = opts || {};
    if (window.MTCommand.cancelTravel) window.MTCommand.cancelTravel();
    if (window.MTMarketBoard) window.MTMarketBoard.close();
    if (!hud) build();
    S.on = true; S.t0 = Date.now(); S.auto = true; bPlay.textContent = "❚❚";
    document.body.classList.add("mt-ops"); hud.hidden = false; cap.hidden = false; ctl.hidden = false; ret.hidden = false;
    if (opts.rec) setRec(true);
    m.on("move", drawHud); m.on("dragstart", userTook);
    var box = m.getContainer(); box.addEventListener("wheel", userTook, { passive: true }); box.addEventListener("touchstart", touchTook, { passive: true });
    document.addEventListener("keydown", keys);
    capK.textContent = "SAT-LINK · 위성 연결 중"; capT.textContent = "공개 자료를 불러오는 중…"; capS.textContent = "";
    Promise.all(["market/factors/us-jobs-by-county.json", "market/factors/tw-monthly-revenue.json", "market/factors/kr-exports-by-item.json", "market/semis-trades-summary.json"].map(get))
      .then(function (r) { S.data = { jobs: r[0], tw: r[1], krx: r[2], trades: r[3] }; go(0); });
  }
  function touchTook(e) { if (e.touches && e.touches.length > 1) userTook(); }
  function stop() {
    var m = map(); if (!S.on) return;
    S.on = false; S.serial++; clearTimeout(S.timer); clearInterval(S.typing); stopVoice();
    document.body.classList.remove("mt-ops"); setRec(false);
    hud.hidden = true; cap.hidden = true; ctl.hidden = true; ret.hidden = true; ret.classList.remove("on");
    if (m) { m.off("move", drawHud); m.off("dragstart", userTook); var box = m.getContainer(); box.removeEventListener("wheel", userTook); box.removeEventListener("touchstart", touchTook); }
    document.removeEventListener("keydown", keys);
  }
  btn.addEventListener("click", function () { start(); });
  window.MTSatelliteOps = { start: start, stop: stop, next: function () { go(S.i + 1, true); }, prev: function () { go(S.i - 1, true); }, stops: STOPS.map(function (s) { return s.id; }), state: function () { return { on: S.on, i: S.i, auto: S.auto, manual: S.manual, rec: S.rec }; } };

  var q = new URLSearchParams(window.location.search);
  if (q.get("ops") === "chips") {
    var tries = 0, iv = setInterval(function () { if (map() || ++tries > 50) { clearInterval(iv); if (map()) start({ rec: q.get("rec") === "1" }); } }, 100);
  }
})();
