/* MONEY TRACKER — 핵심 카드. Renders data/us/insights.json entries (summary + lines{kind,text,src,date}) at the top of
   company / member pages. Text is shown exactly as stored (rule-computed comparisons), with each line's source link and
   date. Nothing is added or reworded. Not investment advice; no causal claim. */
(function () {
  "use strict";
  var KIND = { award: "연방 계약", lobby: "로비", trade: "의원 거래 신고", price: "종가", supply: "공급사", policy: "정책·법안", pac: "PAC" };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function safe(u) { return /^https:\/\/[a-z0-9.-]+(?:[/?#]|$)/i.test(u || "") ? u : null; }
  function srcLine(line) {
    var s = el("span", "ins-src"), u = safe(line && line.src);
    if (u) { var a = el("a", "", "출처 ↗"); a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer"; s.appendChild(a); }
    s.appendChild(document.createTextNode((u ? " · " : "") + "기준일 " + ((line && line.date) || "표기 없음")));
    return s;
  }
  var styled = false;
  function style() {
    if (styled) return; styled = true;
    var css = document.createElement("style");
    css.textContent = ".ins-card{border-color:#2f8a55!important}.ins-card ul{margin:0;padding:0;list-style:none}.ins-card li{padding:6px 0;border-bottom:1px solid #12301f}" +
      ".ins-card li .t{color:#eafff2}.ins-card .ins-src{display:block;font:11px ui-monospace,Menlo,monospace;color:#7fa58f;margin-top:2px}.ins-card .ins-src a{color:#7fd8ff}" +
      ".ins-card .k{font:700 11px ui-monospace,Menlo,monospace;color:#5dff9e;letter-spacing:.06em;margin-right:6px}" +
      ".ins-card details{margin-top:8px}.ins-card summary{cursor:pointer;font:700 12px ui-monospace,Menlo,monospace;color:#9dffbf}" +
      ".ins-card .about{margin:8px 0 0;font-size:12px;color:#7fa58f}";
    document.head.appendChild(css);
  }
  /** container: element to prepend into; entry: {summary:[], lines:[]}; meta: whole insights file (updated, about). */
  function render(container, entry, meta, opts) {
    if (!container || !entry) return null;
    var lines = Array.isArray(entry.lines) ? entry.lines.filter(function (l) { return l && l.text; }) : [];
    var summary = Array.isArray(entry.summary) ? entry.summary.filter(function (s) { return typeof s === "string" && s.trim(); }) : [];
    if (!lines.length && !summary.length) return null;
    style();
    var p = el("section", "panel span2 ins-card"); p.setAttribute("aria-label", "핵심 · 데이터상 비교");
    var h = el("h2", "", "핵심 · 데이터상 비교"); p.appendChild(h);
    var ul = el("ul");
    (summary.length ? summary : lines.map(function (l) { return l.text; })).forEach(function (s) {
      var match = lines.filter(function (l) { return l.text === s; })[0];
      var li = el("li"); if (match && KIND[match.kind]) li.appendChild(el("span", "k", KIND[match.kind])); li.appendChild(el("span", "t", s));
      li.appendChild(srcLine(match)); ul.appendChild(li);
    });
    p.appendChild(ul);
    if (summary.length && lines.length) {
      var d = el("details"); d.appendChild(el("summary", "", "핵심 문장 전체 " + lines.length + "개"));
      var ul2 = el("ul");
      lines.forEach(function (l) { var li = el("li"); li.appendChild(el("span", "k", KIND[l.kind] || l.kind || "기록")); li.appendChild(el("span", "t", l.text)); li.appendChild(srcLine(l)); ul2.appendChild(li); });
      d.appendChild(ul2); p.appendChild(d);
    }
    p.appendChild(el("p", "about", ((meta && meta.about) || "저장된 공개 데이터에서 계산한 비교 수치. 인과 아님. 투자 조언 아님.") + (meta && meta.updated ? " · 파일 기준일 " + meta.updated + " (data/us/insights.json)" : "")));
    container.insertBefore(p, container.firstChild);
    return p;
  }
  window.MTInsights = { render: render };
})();
