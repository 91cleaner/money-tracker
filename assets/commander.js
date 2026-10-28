/* MONEY TRACKER — 대장 모드 (commander mode). Shared script for company / member / sector pages and world-intelligence.
   The visitor is the control-room commander: star companies, members and sectors; get three daily tracking missions
   generated from real filings; rank up by opening cards; see new House PTR filings since the last visit.
   Browser storage only (localStorage), no login, no server. No buy/sell buttons, no recommendations,
   no invented live numbers, no betting, odds or leaderboards. Filings are shown on a filing-date basis. */
(function () {
  "use strict";
  if (window.MTCommander) return;
  var me = document.currentScript && document.currentScript.src || "";
  var BASE = me.indexOf("/assets/commander.js") > 0 ? me.slice(0, me.indexOf("/assets/commander.js") + 1) : "./";
  var KEY = "mt.cmdr.v1", SKEY = "mt.cmdr.session";
  var RANKS = [[0, "신입 요원"], [3, "정보 분석관"], [10, "현장 추적관"], [25, "수석 조사관"], [50, "작전 지휘관"], [100, "관제실 대장"]];
  var TY = { P: "구입(P)", S: "처분(S)", E: "교환(E)" };

  // ---------- storage (every access guarded: private mode / blocked storage must not break the page) ----------
  function blank() { return { v: 1, stars: {}, opened: {}, streak: { n: 0, last: null }, missions: null, lastMaxFiled: null, prevMaxFiled: null }; }
  function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || "null"); return s && s.v === 1 ? s : blank(); } catch (e) { return blank(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage unavailable: keep in memory */ } }
  var st = load();

  // ---------- helpers ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function safe(u) { return /^https:\/\/[a-z0-9.-]+(?:[/?#]|$)/i.test(u || "") ? u : null; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function yesterday(iso) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function get(p) { return fetch(BASE + p).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function href(type, id) { return BASE + (type === "company" ? "company.html?t=" : type === "member" ? "member.html?n=" : "sector.html?s=") + encodeURIComponent(id); }
  function key(type, id) { return type + ":" + id; }
  function rankOf(n) { var r = RANKS[0], next = null; for (var i = 0; i < RANKS.length; i++) { if (n >= RANKS[i][0]) r = RANKS[i]; else { next = RANKS[i]; break; } } return { name: r[1], at: r[0], next: next }; }
  function openedCount() { return Object.keys(st.opened).length; }

  // ---------- which card is this page? ----------
  var path = location.pathname, q = new URLSearchParams(location.search), page = null;
  if (/company\.html$/.test(path) && /^[A-Z][A-Z0-9.\-]{0,9}$/.test((q.get("t") || "").toUpperCase())) page = { type: "company", id: q.get("t").toUpperCase() };
  else if (/member\.html$/.test(path) && (q.get("n") || "").trim()) page = { type: "member", id: q.get("n").trim().slice(0, 80) };
  else if (/sector\.html$/.test(path) && /^[a-z][a-z0-9_]{0,30}$/.test(q.get("s") || "")) page = { type: "sector", id: q.get("s") };
  var onMap = /world-intelligence/.test(path);

  // A "visit" = one browser session. At the start of a visit, remember what the newest filing was last time.
  var newVisit = true; try { newVisit = !sessionStorage.getItem(SKEY); sessionStorage.setItem(SKEY, "1"); } catch (e) { }

  // ---------- styles ----------
  var css = document.createElement("style");
  css.textContent = [
    "#mtCmdDock{position:fixed;z-index:2000;right:14px;bottom:" + (onMap ? "86px" : "14px") + ";display:flex;gap:6px;align-items:center;font:700 12px ui-monospace,Menlo,Consolas,monospace}",
    "#mtCmdDock button{height:38px;border-radius:10px;border:1px solid #2f8a55;background:#04150df2;color:#bfffd6;font:inherit;padding:0 12px;cursor:pointer;box-shadow:0 6px 22px #000a}",
    "#mtCmdDock button.on{background:#5dff9e;color:#02110a;border-color:#5dff9e}",
    "#mtCmdDock .badge{display:inline-block;min-width:18px;padding:0 5px;margin-left:5px;border-radius:9px;background:#ffd36b;color:#1b1400;font-size:11px;line-height:18px;text-align:center}",
    "#mtCmdPanel{position:fixed;z-index:2001;right:14px;bottom:" + (onMap ? "132px" : "60px") + ";width:min(390px,calc(100vw - 24px));max-height:min(72vh,620px);overflow:auto;overscroll-behavior:contain;background:rgba(2,12,7,.97);border:1px solid #2f8a55;border-radius:12px;box-shadow:0 14px 40px #000c;color:#d5f7e1;font:13px/1.5 system-ui,-apple-system,sans-serif;padding:12px 14px}",
    "#mtCmdPanel[hidden]{display:none}",
    "#mtCmdPanel h3{margin:0 0 6px;font:700 12px ui-monospace,Menlo,monospace;letter-spacing:.1em;color:#5dff9e}",
    "#mtCmdPanel .rank{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}",
    "#mtCmdPanel .rank b{font-size:18px;color:#eafff2;white-space:nowrap}#mtCmdPanel .rank span{font:11px ui-monospace,Menlo,monospace;color:#7fa58f}",
    "#mtCmdPanel .bar{height:6px;background:#0a2416;border-radius:3px;overflow:hidden;margin-bottom:10px}#mtCmdPanel .bar i{display:block;height:100%;background:#5dff9e}",
    "#mtCmdPanel .tabs{display:flex;gap:4px;margin:6px 0 8px}#mtCmdPanel .tabs button{flex:1;height:30px;border:1px solid #1f5a37;border-radius:7px;background:#03130b;color:#9dffbf;font:700 12px ui-monospace,Menlo,monospace;cursor:pointer}",
    "#mtCmdPanel .tabs button[aria-selected=true]{background:#0d3b22;border-color:#5dff9e;color:#eafff2}",
    "#mtCmdPanel ul{list-style:none;margin:0;padding:0}#mtCmdPanel li{padding:7px 0;border-bottom:1px solid #12301f}",
    "#mtCmdPanel li.done{opacity:.6}#mtCmdPanel li.new{border-left:3px solid #ffd36b;padding-left:8px}",
    "#mtCmdPanel a{color:#7fd8ff;text-decoration:none}#mtCmdPanel a:hover{text-decoration:underline}",
    "#mtCmdPanel .m{font:11px ui-monospace,Menlo,monospace;color:#7fa58f}",
    "#mtCmdPanel .note{margin:8px 0 0;font-size:11.5px;color:#7fa58f}",
    "#mtCmdPanel .x{float:right;min-width:30px;height:28px;border:1px solid #4a8b62;border-radius:7px;background:#10291b;color:#fff;cursor:pointer}",
    "#mtCmdPanel .fire{color:#ffb35d;font-weight:700}",
    "@media(max-width:700px){#mtCmdDock{right:8px;bottom:" + (onMap ? "150px" : "10px") + "}#mtCmdDock button{height:36px;padding:0 10px}#mtCmdPanel{right:8px;bottom:" + (onMap ? "194px" : "54px") + "}}"
  ].join("");
  document.head.appendChild(css);

  // ---------- dock ----------
  var dock = el("div"); dock.id = "mtCmdDock"; dock.setAttribute("role", "region"); dock.setAttribute("aria-label", "대장 모드");
  var starBtn = null;
  if (page) {
    starBtn = el("button"); starBtn.type = "button"; dock.appendChild(starBtn);
    starBtn.addEventListener("click", function () { toggleStar(page.type, page.id); });
  }
  var mainBtn = el("button"); mainBtn.type = "button"; mainBtn.setAttribute("aria-expanded", "false"); mainBtn.setAttribute("aria-controls", "mtCmdPanel");
  dock.appendChild(mainBtn);
  var panel = el("section"); panel.id = "mtCmdPanel"; panel.hidden = true; panel.setAttribute("aria-label", "대장 모드 패널");
  document.body.append(dock, panel);
  var tab = "missions", data = { trades: null, latest: [], maxFiled: null, sectorsOf: null };

  function paintDock() {
    if (starBtn) { var on = !!(st.stars[key(page.type, page.id)]); starBtn.textContent = on ? "★ 추적 중" : "☆ 추적"; starBtn.className = on ? "on" : ""; starBtn.setAttribute("aria-pressed", String(on)); starBtn.setAttribute("aria-label", on ? "추적 목록에서 빼기" : "추적 목록에 넣기"); }
    var r = rankOf(openedCount()), nNew = newCount();
    mainBtn.replaceChildren(document.createTextNode("◉ " + r.name + (st.streak.n ? " · 🔥" + st.streak.n : "")));
    if (nNew) mainBtn.appendChild(el("span", "badge", String(nNew)));
  }

  // ---------- stars ----------
  function toggleStar(type, id) {
    var k = key(type, id);
    if (st.stars[k]) delete st.stars[k];
    else st.stars[k] = { type: type, id: id, at: today(), seen: data.maxFiled || null };
    save(); paintDock(); if (!panel.hidden) render();
  }
  function tradesFor(s) {
    var t = data.trades || [];
    if (s.type === "company") return t.filter(function (x) { return String(x.tk || "").toUpperCase() === s.id; });
    if (s.type === "member") { var n = s.id.toLowerCase(); return t.filter(function (x) { return String(x.who || "").toLowerCase() === n; }); }
    if (s.type === "sector" && data.sectorsOf) return t.filter(function (x) { return data.sectorsOf[String(x.tk || "").toUpperCase()] === s.id; });
    return [];
  }
  function newSince(s) { return tradesFor(s).filter(function (x) { return s.seen ? String(x.filed || "") > s.seen : false; }).length; }
  function newCount() {
    var n = 0; Object.keys(st.stars).forEach(function (k) { n += newSince(st.stars[k]); });
    return n;
  }

  // ---------- missions (3 per day from real filings; deterministic for the date) ----------
  function makeMissions(day) {
    var t = data.trades || [], out = [];
    if (!t.length || !data.maxFiled) return out;
    var latestDay = data.maxFiled, onLatest = t.filter(function (x) { return x.filed === latestDay && x.who; });
    var whos = Array.from(new Set(onLatest.map(function (x) { return x.who; }))).sort();
    if (whos.length) { var w = whos[hash(day + "w") % whos.length]; out.push({ id: "m1", type: "member", target: w, text: "가장 최근 신고일(" + latestDay + ")에 신고한 의원 " + w + " 기록 확인" }); }
    var from = new Date(Date.parse(latestDay) - 30 * 864e5).toISOString().slice(0, 10), cnt = {};
    t.forEach(function (x) { var k = String(x.tk || "").toUpperCase(); if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(k) && String(x.filed || "") >= from) cnt[k] = (cnt[k] || 0) + 1; });
    var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] || a.localeCompare(b); }).slice(0, 12);
    if (top.length) { var c = top[hash(day + "c") % top.length]; out.push({ id: "m2", type: "company", target: c, text: "최근 30일 신고가 많은 종목 중 " + c + " 회사 카드 열람 (신고 " + cnt[c] + "건)" }); }
    var secs = data.sectorsOf && data.hasSectorPage ? Array.from(new Set(top.map(function (k) { return data.sectorsOf[k]; }).filter(Boolean))).sort() : [];
    if (secs.length) { var s = secs[hash(day + "s") % secs.length]; out.push({ id: "m3", type: "sector", target: s, label: data.sectorName && data.sectorName[s] || s, text: "업종 '" + ((data.sectorName && data.sectorName[s]) || s) + "' 살펴보기" }); }
    else if (top.length > 1) { var c2 = top[(hash(day + "c2") + 1) % top.length]; if (c2 !== (out[1] && out[1].target)) out.push({ id: "m3", type: "company", target: c2, text: "종목 " + c2 + " 회사 카드 열람" }); }
    return out;
  }
  function ensureMissions() {
    var d = today();
    if (!st.missions || st.missions.date !== d || !st.missions.list.length) {
      var list = makeMissions(d);
      if (list.length) { st.missions = { date: d, list: list.map(function (m) { m.done = false; return m; }), complete: false }; save(); }
    }
  }
  function checkMissions() {
    if (!st.missions || !page) return;
    var changed = false;
    st.missions.list.forEach(function (m) {
      if (!m.done && m.type === page.type && String(m.target).toLowerCase() === String(page.id).toLowerCase()) { m.done = true; changed = true; }
    });
    if (changed && !st.missions.complete && st.missions.list.every(function (m) { return m.done; })) {
      st.missions.complete = true;
      st.streak = { n: st.streak.last === yesterday(st.missions.date) ? st.streak.n + 1 : (st.streak.last === st.missions.date ? st.streak.n : 1), last: st.missions.date };
    }
    if (changed) save();
  }
  function streakAlive() { if (st.streak.last && st.streak.last !== today() && st.streak.last !== yesterday(today())) { st.streak = { n: 0, last: null }; save(); } }

  // ---------- panel ----------
  function render() {
    panel.replaceChildren();
    var x = el("button", "x", "×"); x.type = "button"; x.setAttribute("aria-label", "닫기"); x.addEventListener("click", toggle); panel.appendChild(x);
    var n = openedCount(), r = rankOf(n);
    panel.appendChild(el("h3", "", "관제실 대장 기록"));
    var rk = el("div", "rank"); rk.append(el("b", "", r.name), el("span", "", "조사한 카드 " + n + "개" + (r.next ? " · 다음 '" + r.next[1] + "'까지 " + (r.next[0] - n) + "개" : " · 최고 계급"))); panel.appendChild(rk);
    var bar = el("div", "bar"), bi = el("i"); bi.style.width = (r.next ? Math.min(100, (n - r.at) / (r.next[0] - r.at) * 100) : 100).toFixed(0) + "%"; bar.appendChild(bi); panel.appendChild(bar);
    if (st.streak.n) panel.appendChild(el("p", "fire", "🔥 연속 임무 완료 " + st.streak.n + "일"));
    var tabs = el("div", "tabs"); tabs.setAttribute("role", "tablist");
    [["missions", "추적 임무"], ["watch", "추적 목록"], ["feed", "새 신고"]].forEach(function (t) {
      var b = el("button", "", t[1]); b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(tab === t[0]));
      b.addEventListener("click", function () { tab = t[0]; render(); }); tabs.appendChild(b);
    });
    panel.appendChild(tabs);
    if (tab === "missions") renderMissions(); else if (tab === "watch") renderWatch(); else renderFeed();
    panel.appendChild(el("p", "note", "브라우저에만 저장(로그인 없음). 하원 PTR 신고 기준이며 거래일→신고일 최대 45일 차이가 있을 수 있습니다. 공개 기록일 뿐 잘잘못 판단이 아니며 투자 조언 아님."));
  }
  function renderMissions() {
    ensureMissions();
    var ul = el("ul");
    if (!st.missions || !st.missions.list.length) ul.appendChild(el("li", "", data.trades ? "오늘 만들 임무 자료가 없습니다." : "공개 자료 불러오는 중…"));
    else st.missions.list.forEach(function (m) {
      var li = el("li", m.done ? "done" : ""), a = el("a", "", (m.done ? "✓ " : "□ ") + m.text); a.href = href(m.type, m.target); li.appendChild(a); ul.appendChild(li);
    });
    panel.appendChild(ul);
    if (st.missions && st.missions.list.length) panel.appendChild(el("p", "m", st.missions.list.filter(function (m) { return m.done; }).length + " / " + st.missions.list.length + " 완료 · 매일 실제 신고 자료로 새로 정해짐 (" + st.missions.date + ")"));
  }
  function renderWatch() {
    var ks = Object.keys(st.stars), ul = el("ul");
    if (!ks.length) ul.appendChild(el("li", "", "아직 추적 중인 카드가 없습니다. 회사·의원·업종 페이지에서 ☆ 추적을 누르세요."));
    ks.sort().forEach(function (k) {
      var s = st.stars[k], li = el("li"), a = el("a", "", (s.type === "company" ? "회사 " : s.type === "member" ? "의원 " : "업종 ") + (s.type === "sector" && data.sectorName && data.sectorName[s.id] ? data.sectorName[s.id] : s.id)); a.href = href(s.type, s.id);
      var nn = data.trades ? newSince(s) : 0; li.appendChild(a);
      li.appendChild(el("div", "m", (nn ? "지난 확인 이후 새 신고 " + nn + "건" : "지난 확인 이후 새 신고 없음") + (s.seen ? " · 기준 신고일 " + s.seen : "") + " · 추적 시작 " + s.at));
      if (nn) li.className = "new";
      ul.appendChild(li);
    });
    panel.appendChild(ul);
  }
  function renderFeed() {
    var ul = el("ul"), list = data.latest.slice(0, 30);
    if (!data.trades) ul.appendChild(el("li", "", "공개 자료 불러오는 중…"));
    else if (!list.length) ul.appendChild(el("li", "", "신고 자료가 없습니다."));
    list.forEach(function (x) {
      var isNew = st.prevMaxFiled && String(x.filed || "") > st.prevMaxFiled, li = el("li", isNew ? "new" : "");
      var top = el("div"); var tk = String(x.tk || "").toUpperCase();
      if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(tk)) { var a = el("a", "", tk); a.href = href("company", tk); top.appendChild(a); top.appendChild(document.createTextNode(" · ")); }
      if (x.who) { var b = el("a", "", x.who); b.href = href("member", x.who); top.appendChild(b); }
      top.appendChild(document.createTextNode(" · " + (TY[String(x.ty || "").charAt(0)] || x.ty || "") + " · " + (x.amt || "")));
      li.appendChild(top);
      var m = el("div", "m", "신고 " + (x.filed || "-") + " · 거래 " + (x.d || "-") + (isNew ? " · 지난 방문 이후 새 신고" : "") + " · ");
      var u = safe(x.doc); if (u) { var c = el("a", "", "PTR 원문 ↗"); c.href = u; c.target = "_blank"; c.rel = "noopener noreferrer"; m.appendChild(c); }
      li.appendChild(m); ul.appendChild(li);
    });
    panel.appendChild(ul);
    panel.appendChild(el("p", "m", "신고일 순(같은 날은 거래일 순). 신고 시각은 원문에 없어 날짜까지만 표시합니다."));
  }
  function toggle() { var open = panel.hidden; panel.hidden = !open; mainBtn.setAttribute("aria-expanded", String(open)); mainBtn.className = open ? "on" : ""; if (open) render(); }
  mainBtn.addEventListener("click", toggle);

  // ---------- boot ----------
  if (page) { st.opened[key(page.type, page.id)] = st.opened[key(page.type, page.id)] || today(); save(); }
  streakAlive();
  paintDock();
  get("data/us/trades.json").then(function (tr) {
    var t = (tr && tr.trades) || [];
    data.trades = t;
    data.latest = t.filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x.filed || ""); }).sort(function (a, b) { return String(b.filed).localeCompare(String(a.filed)) || String(b.d || "").localeCompare(String(a.d || "")); });
    data.maxFiled = data.latest.length ? data.latest[0].filed : null;
    if (newVisit) { st.prevMaxFiled = st.lastMaxFiled || null; st.lastMaxFiled = data.maxFiled; save(); }
    // Opening a starred card counts as checking it.
    if (page && st.stars[key(page.type, page.id)]) { st.stars[key(page.type, page.id)].seen = data.maxFiled; save(); }
    Object.keys(st.stars).forEach(function (k) { if (!st.stars[k].seen) st.stars[k].seen = data.maxFiled; }); save();
    return get("data/search-index.json");
  }).then(function (si) {
    var E = (si && si.entities) || {}, map = {}, names = {};
    Object.keys(E).forEach(function (k) { var v = E[k]; if (v.type === "company" && v.symbol && v.sector) map[String(v.symbol).toUpperCase()] = v.sector; if (v.type === "sector") names[k.slice(7)] = v.name; });
    data.sectorsOf = map; data.sectorName = names;
    // sector.html may not be deployed yet; only then hand out sector missions.
    return fetch(BASE + "sector.html", { method: "HEAD" }).then(function (r) { data.hasSectorPage = r.ok; }).catch(function () { data.hasSectorPage = false; });
  }).then(function () {
    ensureMissions(); checkMissions(); paintDock(); if (!panel.hidden) render();
  });

  window.MTCommander = { state: function () { return JSON.parse(JSON.stringify(st)); }, page: page, open: function () { if (panel.hidden) toggle(); }, close: function () { if (!panel.hidden) toggle(); }, ranks: RANKS.map(function (r) { return r[1]; }) };
})();
