/* 미국주식추적단 — 미국 경제 띠 (US economy strip). 관제실 맨 위에 물가·일자리·금리를 크게 보여 준다.
   data/us-econ.json(BLS·FRED·Treasury 공식 자료)만 읽는다. 저장된 글자는 textContent 로만 넣는다.
   해석은 "같은 기간 ~이 있었어요" 형태의 사실만. 원인 단정·투자 조언 없음. 한국어/영어는 MTI18N.isEn 을 따른다. */
(function () {
  "use strict";
  var isBrowser = typeof document !== "undefined";
  var EN = !!(isBrowser && window.MTI18N && window.MTI18N.isEn);

  var DEF = {
    cpi: { ico: "🛒", ko: "물가", en: "Prices", sub_ko: "1년 전보다", sub_en: "vs a year ago",
      what_ko: "물가는 장바구니 물건값이 1년 전보다 얼마나 달라졌는지 보여 줘요. (미국 소비자물가, CPI)",
      what_en: "Prices show how much a basket of everyday goods changed versus a year ago (US CPI)." },
    unrate: { ico: "💼", ko: "일자리", en: "Jobs", sub_ko: "일 못 구한 사람 비율", sub_en: "unemployment rate",
      what_ko: "일자리 칸은 일할 사람 100명 중 일을 구하지 못한 사람이 몇 명인지 보여 줘요. (실업률)",
      what_en: "Out of every 100 people who want to work, how many do not have a job (unemployment rate)." },
    y10: { ico: "🏦", ko: "10년 금리", en: "10-yr rate", sub_ko: "미국 국채 10년", sub_en: "10-year Treasury",
      what_ko: "금리는 돈을 빌려 줄 때 붙는 값이에요. 10년 금리는 미국 정부에 10년 동안 돈을 빌려 줄 때의 이자예요.",
      what_en: "A rate is the price of borrowing money. The 10-year rate is what the US government pays to borrow for 10 years." },
    y2: { ico: "⏱️", ko: "2년 금리", en: "2-yr rate", sub_ko: "미국 국채 2년", sub_en: "2-year Treasury",
      what_ko: "2년 금리는 미국 정부에 2년 동안 돈을 빌려 줄 때의 이자예요.",
      what_en: "The 2-year rate is what the US government pays to borrow for 2 years." },
    fedfunds: { ico: "🏛️", ko: "기준금리(실효)", en: "Fed funds", sub_ko: "은행끼리 하루 빌릴 때", sub_en: "overnight bank rate",
      what_ko: "은행끼리 하루 동안 돈을 빌릴 때의 이자예요. 미국 중앙은행(연준)이 정하는 금리 근처에서 움직여요.",
      what_en: "The rate banks charge each other for overnight loans, which tracks the Federal Reserve's target." }
  };
  var ORDER = ["cpi", "unrate", "y10", "y2", "fedfunds"];

  function fmt(v, u) { return (Math.round(v * 100) / 100).toString() + (u || ""); }
  function dir(it) { if (it.prev == null) return 0; var d = Math.round((it.value - it.prev) * 100); return d > 0 ? 1 : d < 0 ? -1 : 0; }
  function arrow(it) { var d = dir(it); return d > 0 ? "▲" : d < 0 ? "▼" : "＝"; }

  /* "같은 기간 ~이 있었어요" 문장. 값이 하나 이상 있을 때만 만든다. 원인을 말하지 않는다. */
  function sameTime(items, en) {
    var parts = [];
    ORDER.forEach(function (k) {
      var it = items[k]; if (!it || it.prev == null) return;
      var d = DEF[k], m = dir(it), a = fmt(it.prev, "%"), b = fmt(it.value, "%");
      if (en) parts.push(d.en + " " + (m > 0 ? "rose" : m < 0 ? "fell" : "stayed the same") + " (" + a + " to " + b + ")");
      else parts.push(d.ko + "은(는) " + a + "에서 " + b + "로 " + (m > 0 ? "올랐어요." : m < 0 ? "내렸어요." : "그대로예요."));
    });
    if (!parts.length) return "";
    return en ? "In the same period: " + parts.join("; ") + ". These are listed because they happened in the same period; one does not necessarily lead to another."
      : "같은 기간 " + parts.join(" ") + " 같은 기간에 있었던 일을 나열한 것이고, 하나가 다른 하나를 만들었다는 뜻은 아니에요.";
  }

  function spark(points, w, h) {
    if (!points || points.length < 2) return "";
    var vs = points.map(function (p) { return p[1]; }), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), sp = hi - lo || 1;
    return points.map(function (p, i) { return (i ? "L" : "M") + (i * w / (points.length - 1)).toFixed(1) + " " + (h - 2 - (p[1] - lo) / sp * (h - 4)).toFixed(1); }).join("");
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { sameTime: sameTime, dir: dir, spark: spark, fmt: fmt, DEF: DEF, ORDER: ORDER };
  if (!isBrowser || document.getElementById("mtEcon")) return;

  var H = 58;
  var css = document.createElement("style");
  css.textContent =
    "html.mt-econ body{position:relative;transform:translateZ(0);margin-top:" + H + "px;height:calc(100dvh - " + H + "px);overflow:hidden}" +
    "#mtEcon{position:fixed;top:0;left:0;right:0;height:" + H + "px;z-index:1300;display:flex;align-items:stretch;gap:6px;padding:5px 8px;background:#04100bf7;border-bottom:2px solid #2f8a55;box-shadow:0 4px 18px #0009;font-family:system-ui,sans-serif}" +
    "#mtEcon .chips{display:flex;gap:6px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none}#mtEcon .chips::-webkit-scrollbar{display:none}" +
    "#mtEcon .chip{flex:1 0 118px;display:flex;align-items:center;gap:7px;padding:0 10px;border:2px solid #2c6b49;border-radius:12px;background:#0a2217;color:#e8fff1;cursor:pointer;text-align:left;min-height:44px}" +
    "#mtEcon .chip:hover,#mtEcon .chip:focus-visible,#mtEcon .chip[aria-expanded=true]{border-color:#7dffb0;background:#123524;outline:none}" +
    "#mtEcon .ico{font-size:22px;line-height:1}#mtEcon .t{display:flex;flex-direction:column;min-width:0}" +
    "#mtEcon .n{font-size:12px;color:#9fd8b6;white-space:nowrap}#mtEcon .v{font-size:21px;font-weight:900;line-height:1.05;white-space:nowrap}" +
    "#mtEcon .a{font-size:13px;margin-left:4px}#mtEcon .a.u{color:#ffd166}#mtEcon .a.d{color:#7fd8ff}#mtEcon .a.f{color:#9fb8a8}" +
    "#mtEcon .dex{flex:none;display:flex;align-items:center;font-size:12px;color:#ffd166;font-weight:800;white-space:nowrap}" +
    "#mtEcon .x{flex:none;width:34px;border:1px solid #2c6b49;border-radius:10px;background:#0a2217;color:#bfe9cf;cursor:pointer;font-size:14px}" +
    "#mtEconPop{position:fixed;top:" + (H + 6) + "px;left:8px;right:8px;max-width:520px;z-index:1301;background:#05160ff8;border:2px solid #4fbf82;border-radius:14px;padding:14px;color:#eafff2;box-shadow:0 12px 36px #000c;font-family:system-ui,sans-serif}" +
    "#mtEconPop[hidden]{display:none}#mtEconPop h3{margin:0 0 4px;font-size:20px}#mtEconPop p{margin:8px 0;font-size:16px;line-height:1.55}" +
    "#mtEconPop .big{font-size:34px;font-weight:900}#mtEconPop svg{width:100%;height:64px;display:block;margin:6px 0}" +
    "#mtEconPop small{display:block;color:#9fd8b6;font-size:12px;line-height:1.5}#mtEconPop a{color:#7fd8ff}" +
    "#mtEconPop .c{float:right;width:38px;height:38px;border-radius:10px;border:1px solid #4a8b62;background:#10291b;color:#fff;font-size:16px;cursor:pointer}" +
    "html.mt-econ-off body{margin-top:0;height:auto;transform:none}html.mt-econ-off #mtEcon{display:none}" +
    "#mtEconOpen{position:fixed;top:4px;left:50%;transform:translateX(-50%);z-index:1300;display:none;padding:6px 12px;border-radius:0 0 10px 10px;border:1px solid #2f8a55;background:#04150d;color:#a2ffba;font-size:12px;cursor:pointer}" +
    "html.mt-econ-off #mtEconOpen{display:block}" +
    "@media(max-width:650px){#mtEcon .chip{flex-basis:112px}#mtEcon .v{font-size:20px}#mtEcon .dex{display:none}}";
  document.head.appendChild(css);

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function safe(u) { return /^https:\/\/[a-z0-9.-]+(?:[/?#]|$)/i.test(u || "") ? u : null; }
  function todayKey() { return new Date().toISOString().slice(0, 10); }
  function seen() { try { var s = JSON.parse(localStorage.getItem("mt.econ.dex") || "{}"); return s.d === todayKey() ? s.k || [] : []; } catch (e) { return []; } }
  function mark(k) { var s = seen(); if (s.indexOf(k) < 0) s.push(k); try { localStorage.setItem("mt.econ.dex", JSON.stringify({ d: todayKey(), k: s })); } catch (e) { } return s.length; }

  var bar = el("section", ""); bar.id = "mtEcon"; bar.setAttribute("aria-label", EN ? "US economy strip" : "미국 경제 띠");
  var chips = el("div", "chips"), dex = el("div", "dex"), pop = el("section", ""); pop.id = "mtEconPop"; pop.hidden = true; pop.setAttribute("aria-live", "polite");
  var close = el("button", "x", "▴"); close.type = "button"; close.setAttribute("aria-label", EN ? "Hide the economy strip" : "경제 띠 접기");
  var open = el("button", ""); open.id = "mtEconOpen"; open.type = "button"; open.textContent = EN ? "▾ US economy" : "▾ 미국 경제";
  bar.append(chips, dex, close);
  document.documentElement.classList.add("mt-econ");
  document.body.append(pop);
  document.documentElement.append(bar, open);
  close.addEventListener("click", function () { document.documentElement.classList.add("mt-econ-off"); pop.hidden = true; });
  open.addEventListener("click", function () { document.documentElement.classList.remove("mt-econ-off"); });

  function showDex(total) { var n = seen().length; dex.textContent = "🏅 " + n + "/" + total + (EN ? " today" : " 오늘 본 칸"); }

  function showPop(k, it, items, chip, total) {
    var d = DEF[k], open_ = chips.querySelector("[aria-expanded=true]");
    if (open_) open_.setAttribute("aria-expanded", "false");
    if (!pop.hidden && pop.dataset.k === k) { pop.hidden = true; return; }
    pop.dataset.k = k; chip.setAttribute("aria-expanded", "true");
    mark(k); showDex(total);
    pop.replaceChildren();
    var c = el("button", "c", "✕"); c.type = "button"; c.setAttribute("aria-label", EN ? "Close" : "닫기");
    c.addEventListener("click", function () { pop.hidden = true; chip.setAttribute("aria-expanded", "false"); });
    pop.append(c, el("h3", "", d.ico + " " + (EN ? d.en : d.ko)), el("div", "big", fmt(it.value, it.unit) + " " + arrow(it)));
    if (it.prev != null) pop.append(el("small", "", (EN ? "Before: " : "이전: ") + fmt(it.prev, it.unit) + " (" + it.prev_date + ")"));
    var NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 300 64"); s.setAttribute("preserveAspectRatio", "none"); s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(NS, "path"); p.setAttribute("d", spark(it.points, 300, 64)); p.setAttribute("fill", "none"); p.setAttribute("stroke", "#7dffb0"); p.setAttribute("stroke-width", "3"); p.setAttribute("stroke-linejoin", "round"); p.setAttribute("vector-effect", "non-scaling-stroke");
    s.appendChild(p); pop.appendChild(s);
    pop.append(el("p", "", EN ? d.what_en : d.what_ko), el("p", "", sameTime(items, EN)));
    var src = el("small", "", (EN ? "Source: " : "출처: ") + it.source + " · " + it.date + " · ");
    var u = safe(it.url); if (u) { var a = el("a", "", EN ? "official page ↗" : "공식 원문 ↗"); a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer"; src.appendChild(a); }
    pop.append(src, el("small", "", EN ? "Official public data only. Not investment advice." : "공식 공개 자료만 보여 줘요. 투자 조언이 아니에요."));
    pop.hidden = false;
  }

  fetch("../data/us-econ.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (doc) {
    var items = doc && doc.items || {}, keys = ORDER.filter(function (k) { return items[k] && typeof items[k].value === "number"; });
    if (!keys.length) { chips.appendChild(el("span", "n", EN ? "Economy numbers are not ready yet." : "경제 숫자를 아직 못 가져왔어요.")); return; }
    keys.forEach(function (k) {
      var it = items[k], d = DEF[k], b = el("button", "chip"); b.type = "button"; b.setAttribute("aria-expanded", "false");
      b.setAttribute("aria-label", (EN ? d.en : d.ko) + " " + fmt(it.value, it.unit));
      var t = el("span", "t"), v = el("span", "v", fmt(it.value, it.unit)), m = dir(it);
      v.appendChild(el("span", "a " + (m > 0 ? "u" : m < 0 ? "d" : "f"), arrow(it)));
      t.append(el("span", "n", EN ? d.en : d.ko), v);
      b.append(el("span", "ico", d.ico), t);
      b.addEventListener("click", function () { showPop(k, it, items, b, keys.length); });
      chips.appendChild(b);
    });
    showDex(keys.length);
  });
})();
