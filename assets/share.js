/* 미국주식추적단 — "X에 공유" button.
   Builds a post for https://x.com/intent/post?text= from what the page already shows:
   one key line (data/us/insights.json summary, or the page's own counts) + its official source link + date + this page's link.
   Text stays within X's 280-weight limit (Korean = 2, each URL = 23). Neutral wording only; the line text comes from
   the data files as-is. No keys, no tracking, no network calls except reading insights.json on the command map.

   Pages:   MTShare.button({head, line, src, date, url}) -> <a class="btn mt-share">
            MTShare.pick(insightsEntry)                  -> {line, src, date} | null
            MTShare.meta(title, description)             -> updates og:/twitter: tags for this view
            MTShare.url({t: "NVDA"})                     -> this page's link with only those params
   Command map (world-intelligence): watches the briefing panel and adds a share link under the source link
   while a data route (company/member/sector) is open. Demo routes get no share link. */
(function () {
  "use strict";
  if (window.MTShare) return;
  var LIMIT = 280, URLW = 23;
  var I18N = window.MTI18N, tr = function (s) { return I18N ? I18N.tr(s) : s; }; // EN: Korean page strings -> English
  var script = document.currentScript;
  var BASE = (function () { try { return new URL("..", script.src).href; } catch (e) { return ""; } })(); // repo root

  // X counts code points in these ranges as 1, everything else (Hangul, emoji, CJK) as 2.
  function cw(cp) { return (cp <= 4351 || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247)) ? 1 : 2; }
  function weight(s) { var n = 0; for (var ch of String(s || "")) n += cw(ch.codePointAt(0)); return n; }
  function cut(s, max) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    if (weight(s) <= max) return s;
    var out = "", n = 0, room = max - 2; // "…" (U+2026) counts 2 on X
    for (var ch of s) { var w = cw(ch.codePointAt(0)); if (n + w > room) break; out += ch; n += w; }
    return out.replace(/[\s,·(]+$/, "") + "…";
  }
  function https(u) { return typeof u === "string" && /^https:\/\/[^\s]+$/.test(u) ? u : ""; }

  function text(o) {
    o = o || {};
    var url = (/^https?:\/\/\S+$/.test(o.url || "") ? o.url : "") || location.href.split("#")[0], src = https(o.src), head = String(o.head || "").trim();
    if (I18N && I18N.isEn && url && !/[?&]lang=en\b/.test(url)) url += (url.indexOf("?") < 0 ? "?" : "&") + "lang=en";
    var EN = I18N && I18N.isEn;
    var tail = EN ? (src ? "\nSource: " + src : "") + (o.date ? (src ? " (as of " : "\nAs of ") + I18N.dateEn(o.date) + (src ? ")" : "") : "") + "\n" + url
      : (src ? "\n출처: " + src : "") + (o.date ? (src ? " (" : "\n") + o.date + " 기준" + (src ? ")" : "") : "") + "\n" + url;
    var fixed = weight(tail.replace(src, "").replace(url, "")) + URLW * (src ? 2 : 1);
    if (EN) head = head.replace(/ (의원|업종)$/, "");
    if (EN && /[\uac00-\ud7a3]/.test(head) && I18N.name) { var hm = head.match(/^(.*?)\s*\(([A-Z0-9.]{1,12})\)\s*$/); if (hm) { var nn = I18N.name({ name: hm[1], symbol: hm[2], aliases: [] }); if (nn && !/[\uac00-\ud7a3]/.test(nn)) head = nn + " (" + hm[2] + ")"; } }
    head = tr(head);
    var body = tr(String(o.line || "").trim());
    var first = head && body ? head + " · " + body : (head || body);
    return cut(first, LIMIT - fixed) + tail;
  }
  function href(o) { return "https://x.com/intent/post?text=" + encodeURIComponent(text(o)); }

  function pick(entry) {
    if (!entry || typeof entry !== "object") return null;
    if (Array.isArray(entry)) { var x = entry.filter(function (v) { return v && (v.text || v.title); })[0]; return x ? { line: x.text || x.title, src: https(x.src || x.url), date: x.date || "" } : null; }
    var lines = Array.isArray(entry.lines) ? entry.lines.filter(function (l) { return l && l.text; }) : [];
    var sum = Array.isArray(entry.summary) ? entry.summary.filter(Boolean) : [];
    var s = sum[0], hit = s ? lines.filter(function (l) { return l.text === s; })[0] : null;
    var l = hit || (s ? null : lines[0]);
    if (!s && !l) return null;
    return { line: s || l.text, src: https(l && l.src), date: (l && l.date) || "" };
  }

  function url(params) {
    var q = Object.keys(params || {}).filter(function (k) { return params[k] != null && params[k] !== ""; })
      .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
    return location.origin + location.pathname + (q ? "?" + q : "");
  }

  function setMeta(attr, key, val) {
    var m = document.head.querySelector("meta[" + attr + '="' + key + '"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute(attr, key); document.head.appendChild(m); }
    m.setAttribute("content", val);
  }
  function meta(title, desc) {
    if (!document.head) return;
    title = tr(title); desc = tr(desc);
    if (title) { setMeta("property", "og:title", title); setMeta("name", "twitter:title", title); }
    if (desc) { desc = cut(desc, 300); setMeta("property", "og:description", desc); setMeta("name", "twitter:description", desc); }
  }

  function button(o) {
    var a = document.createElement("a");
    a.className = "btn mt-share";
    a.target = "_blank"; a.rel = "noopener noreferrer";
    var EN = I18N && I18N.isEn;
    a.textContent = EN ? "𝕏 Share" : "𝕏 공유";
    a.href = href(o);
    a.title = (EN ? "Share on X: " : "X에 공유: ") + text(o);
    a.setAttribute("aria-label", EN ? "Share on X (new window)" : "X에 공유 (새 창)");
    return a;
  }

  window.MTShare = { text: text, href: href, pick: pick, url: url, meta: meta, button: button, weight: weight };

  /* ---- command map (world-intelligence) ---- */
  function onMap() { return !!document.getElementById("briefTitle") && !!document.getElementById("source"); }
  var INS = null, insLoad = null;
  function insights() {
    if (!insLoad) insLoad = fetch(BASE + "data/us/insights.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; }).then(function (d) { INS = d; return d; });
    return insLoad;
  }
  // Own line under the source link (the page hides the source line when a stop has no source URL).
  function mapLink() {
    var srcA = document.getElementById("source"), a = document.getElementById("mtShareX");
    var srcP = srcA && srcA.parentNode;
    if (!a && srcP && srcP.parentNode) {
      var p = document.createElement("p"); p.id = "mtShareP"; p.hidden = true;
      a = document.createElement("a"); a.id = "mtShareX"; a.target = "_blank"; a.rel = "noopener noreferrer";
      var EN = I18N && I18N.isEn;
      a.textContent = EN ? "𝕏 Share this route" : "𝕏 이 경로 공유"; a.setAttribute("aria-label", EN ? "Share on X (new window)" : "X에 공유 (새 창)");
      p.appendChild(a); srcP.after(p);
    }
    return a;
  }
  var seq = 0;
  async function mapUpdate() {
    var a = mapLink(); if (!a) return;
    var box = a.parentNode, my = ++seq;
    var m = window.mtCur && window.mtCur(), brief = document.getElementById("brief");
    if (!m || !brief || brief.hidden) { box.hidden = true; return; } // demo routes / closed brief: nothing to share
    var ti = (document.getElementById("briefTitle") || {}).textContent || "", mm = ti.match(/ · (\d+)\//);
    var step = (m.meta || [])[mm ? +mm[1] - 1 : 0] || {};
    var e = null; try { var idx = window.mtApi && window.mtApi.loadIdx ? await window.mtApi.loadIdx() : null; e = idx && idx.entities ? idx.entities[m.ticker] : null; } catch (err) { e = null; }
    var id = String(m.ticker || ""), kind = id.split(":")[0], key = id.slice(kind.length + 1);
    await insights();
    var bag = INS && (kind === "company" ? INS.companies : kind === "sector" ? INS.sectors : kind === "member" ? INS.members : null);
    var p = bag ? pick(bag[key] || (e && bag[e.name])) : null;
    if (!p) p = { line: [step.region, step.fact].filter(Boolean).join(" — "), src: https(step.source_url), date: step.date || "" };
    var name = (e && e.name) || String(m.title || "").replace(/ (경로|route)$/, "");
    var head = kind === "company" && e && e.symbol ? name + "(" + e.symbol + ")" : name;
    var o = { head: head, line: p.line, src: p.src, date: p.date, url: url({ q: (e && (e.symbol || (kind === "member" && e.aliases && e.aliases[0]))) || name }) };
    if (my !== seq) return; // a newer stop was shown while we were loading
    a.href = href(o); a.title = (I18N && I18N.isEn ? "Share on X: " : "X에 공유: ") + text(o); box.hidden = false;
    // Same link on the route control bar (#mtBar, shown only for data routes), so it is visible without scrolling the brief.
    var bar = document.getElementById("mtBar"), bx = document.getElementById("mtShareBarX");
    if (bar && !bx) {
      bx = document.createElement("a"); bx.id = "mtShareBarX"; bx.target = "_blank"; bx.rel = "noopener noreferrer"; bx.textContent = "𝕏";
      bx.setAttribute("aria-label", I18N && I18N.isEn ? "Share this route on X (new window)" : "이 경로 X에 공유 (새 창)");
      bx.style.cssText = "display:inline-flex;align-items:center;justify-content:center;min-height:36px;min-width:36px;padding:0 10px;background:#04170b;color:#5dff9e;border:1px solid #2bff88;border-radius:6px;font:inherit;text-decoration:none;white-space:nowrap";
      bar.appendChild(bx);
    }
    if (bx) { bx.href = a.href; bx.title = a.title; }
    meta("미국주식추적단 관제실 — " + head, p.line);
  }
  // Watch the briefing title instead of wrapping mtAfterShow: demo routes and "no data" panels never call it.
  function hookMap() {
    if (!onMap()) return;
    var t = 0, kick = function () { clearTimeout(t); t = setTimeout(function () { mapUpdate().catch(function () {}); }, 80); };
    var obs = new MutationObserver(kick);
    obs.observe(document.getElementById("briefTitle"), { childList: true, characterData: true, subtree: true });
    var brief = document.getElementById("brief"); if (brief) obs.observe(brief, { attributes: true, attributeFilter: ["hidden"] });
    kick();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hookMap); else hookMap();
})();
