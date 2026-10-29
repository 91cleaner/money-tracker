/* 돈 기록 3종 카드: USAspending(연방 계약) · LDA(로비) · FEC(기업 연계 PAC)
   data/us/federal-awards.json, lobbying.json, pac-contributions.json 을 읽어 보여 줍니다.
   해석은 "같은 기간 ~이 있었어요" 형태만. 원인 단정·투자 조언 없음. */
(function () {
  var EN = !!(window.MTI18N && window.MTI18N.isEn);
  function t(ko, en) { return EN ? en : ko; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function safe(u) { return /^https:\/\/[a-z0-9.-]+(?:[/?#]|$)/i.test(u || "") ? u : null; }
  function usd(v) { if (v == null || !isFinite(v)) return "-"; var a = Math.abs(v); return "$" + (a >= 1e9 ? (v / 1e9).toFixed(2) + "B" : a >= 1e6 ? (v / 1e6).toFixed(1) + "M" : a >= 1e3 ? Math.round(v / 1e3).toLocaleString("en-US") + "K" : Math.round(v).toLocaleString("en-US")); }
  function get(p) { return fetch(p, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }

  var CSS = ".mt3{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}" +
    ".mt3 .c{border:2px solid var(--line2,#2f8a55);border-radius:12px;padding:12px 14px;background:#04150d}" +
    ".mt3 .c .e{font-size:22px}.mt3 .c .k{font:700 13px system-ui,sans-serif;color:var(--g2,#9dffbf);margin:2px 0}" +
    ".mt3 .c .v{font:800 26px/1.2 ui-monospace,Menlo,monospace;color:var(--g,#5dff9e)}" +
    ".mt3 .c .s{font-size:13px;color:var(--txt,#d5f7e1);margin-top:4px}" +
    ".mt3 .c .m{font-size:12px;color:var(--mut,#7fa58f);margin-top:6px}.mt3 .c.off .v{color:var(--mut,#7fa58f);font-size:16px}" +
    ".mt3 .bar{height:8px;border-radius:4px;background:#0b2a19;margin-top:6px;overflow:hidden}.mt3 .bar i{display:block;height:100%;background:var(--g,#5dff9e)}";

  function card(emoji, title, big, lines, src, srcName) {
    var c = el("div", "c" + (big ? "" : " off"));
    c.appendChild(el("div", "e", emoji)); c.appendChild(el("div", "k", title));
    c.appendChild(el("div", "v", big || t("기록 없음", "No record")));
    (lines || []).forEach(function (l) { c.appendChild(el("div", "s", l)); });
    if (!big) c.appendChild(el("div", "s", t("이 자료에서 이름이 맞는 기록을 못 찾았어요.", "No name match found in this data.")));
    var u = safe(src);
    if (u) { var m = el("div", "m"), a = el("a", "", srcName + " ↗"); a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer"; m.appendChild(a); c.appendChild(m); }
    return c;
  }

  function build(tk, aw, lb, pac) {
    var wrap = el("div", "mt3");
    var a = ((aw || {}).companies || {})[tk], l = ((lb || {}).companies || {})[tk], p = ((pac || {}).companies || {})[tk];
    var al = [];
    if (a) {
      (a.top_agencies || []).slice(0, 3).forEach(function (g) { al.push(g.name + " " + usd(g.usd)); });
      al.unshift(t("기간 " + aw.period[0] + " ~ " + aw.period[1], "Period " + aw.period[0] + " – " + aw.period[1]));
    }
    var c1 = card("🏛️", t("정부와 맺은 계약 (USAspending)", "Federal contracts (USAspending)"), a ? usd(a.total_usd) : null, al, a && a.source_url, "USAspending");
    if (a && a.top_agencies && a.top_agencies[0] && a.total_usd > 0) { var b = el("div", "bar"), i = el("i"); i.style.width = Math.min(100, a.top_agencies[0].usd / a.total_usd * 100).toFixed(0) + "%"; b.appendChild(i); c1.insertBefore(b, c1.lastChild); }
    var ll = [];
    if (l) {
      var qs = Object.keys(l.by_quarter || {}).filter(function (k) { return /^\d{4}-Q[1-4]$/.test(k) && l.by_quarter[k] > 0; }).sort();
      var last = qs[qs.length - 1];
      if (last) ll.push(t("가장 최근 분기 " + last + ": " + usd(l.by_quarter[last]) + " 보고됨", "Latest quarter " + last + ": " + usd(l.by_quarter[last]) + " reported"));
      if (l.top_issues && l.top_issues.length) ll.push(t("자주 나온 주제: ", "Common topics: ") + l.top_issues.slice(0, 3).map(function (x) { return x[0]; }).join(", "));
    }
    var c2 = card("📣", t("로비 보고 (LDA)", "Lobbying reports (LDA)"), l ? usd(l.total_usd) : null, ll, l && l.source_url, "LDA");
    var pl = [];
    if (p) {
      pl.push(t("후보 위원회에 낸 돈 " + usd(p.to_federal_candidates_usd), "Given to candidate committees " + usd(p.to_federal_candidates_usd)));
      pl.push(t("임직원이 자발적으로 모은 돈이고 회사 돈이 아니에요", "Raised voluntarily from employees, not company funds"));
    }
    var c3 = card("🗳️", t("기업 연계 PAC (FEC)", "Company-linked PAC (FEC)"), p ? usd(p.receipts_usd) : null, pl, p && p.source_url, "FEC");
    wrap.append(c1, c2, c3);
    return wrap;
  }

  // host: 붙일 부모, tk: 티커, title: 패널 제목(선택)
  function render(host, tk, opts) {
    opts = opts || {};
    return Promise.all([get("data/us/federal-awards.json"), get("data/us/lobbying.json"), get("data/us/pac-contributions.json")]).then(function (r) {
      if (!document.getElementById("mt3css")) { var s = el("style", "", CSS); s.id = "mt3css"; document.head.appendChild(s); }
      var p = el("section", "panel" + (opts.span === false ? "" : " span2"));
      p.appendChild(el("h2", "", opts.title || t("🎮 돈 기록 3종 세트", "🎮 Money records trio")));
      p.appendChild(el("p", "note", t("같은 기간 이런 공개 기록이 있었어요. 서로 원인이라는 뜻은 아니고, 투자 조언도 아니에요.", "These public records exist for the same period. They do not mean one caused another, and this is not investment advice.")));
      p.appendChild(build(tk, r[0], r[1], r[2]));
      p.appendChild(el("p", "note", t("회사 이름이 비슷한 기록만 합쳤어요(자회사 누락·동명 법인 섞임 가능). 원문 링크로 확인하세요.", "Only records with matching company names are summed (subsidiaries may be missed). Check the source link.")));
      if (opts.before && opts.before.parentNode === host) host.insertBefore(p, opts.before); else host.appendChild(p);
      return p;
    });
  }
  window.MTMoneyTrio = { render: render, usd: usd };
})();
