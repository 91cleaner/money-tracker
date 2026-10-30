/* 세금추적단 — 한국 노사분규·파업 공시 카드 (Korea labor strike disclosures).
   data/kr/labor.json 을 읽어 (1) 종목의 "같은 기간 있었던 일" 줄 (2) 업종별 분규 추이 (3) 영문 배경 설명을 그린다.
   저장된 글자만 textContent 로 넣고, 링크는 https 만 허용한다. 인과·투자 조언 없음. */
(function () {
  "use strict";
  if (window.MTLabor) return;
  var KIND = { strike: ["노조·파업 관련 공시", "Union / strike-related filing"], halt: ["생산·조업 중단 관련 공시", "Production-halt filing"], suspend: ["영업정지 관련 공시", "Business-suspension filing (not necessarily labor-related)"] };
  var BG_KO = "한국은 대기업·제조업에 산별·기업별 노동조합이 많아, 임금·단체협약 협상이 틀어져 파업이 나면 공장 가동이 멈추거나 납기가 늦어질 수 있습니다. 그래서 투자 정보 사이트들이 노사 공시를 함께 봅니다. 여기서는 공시 제목에 파업·노사분규·생산중단·영업정지가 들어간 것만 모았고, 공시가 있다고 실제 파업이 있었다거나 주가가 움직였다는 뜻은 아닙니다.";
  var BG_EN = "Korea labor strike disclosure: many large Korean manufacturers have company or industry unions. When wage or collective-bargaining talks break down, a strike can pause factory output or delay deliveries, which is why investors read labor-related filings alongside prices. This page only lists filings whose titles contain strike, labor-dispute, production-halt or business-suspension terms. A filing does not mean a strike happened or that the share price moved because of it. Not investment advice.";
  var NOTE = (window.MTI18N && window.MTI18N.isEn) ? "Public records only, no causal claim, not investment advice." : "공개 기록일 뿐 원인 관계가 아니며 투자 조언 아님.";

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function safe(u) { return /^https:\/\/[a-z0-9.-]+(?:[/?#]|$)/i.test(u || "") ? u : null; }
  function link(text, url) { var u = safe(url); if (!u) return el("span", "", text); var a = el("a", "", text); a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer"; return a; }
  function norm(s) { return String(s || "").replace(/\(주\)|㈜|주식회사|\s/g, "").toLowerCase(); }
  function load() { return fetch("data/kr/labor.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }

  /* 한 종목의 노사 공시 → 타임라인 줄 [{date, kind, title, sub, url}] (name 또는 6자리 종목코드로 연결) */
  function eventsFor(data, nameOrCode) {
    var q = norm(nameOrCode); if (!data || !q) return [];
    return (data.disclosures || []).filter(function (d) { return norm(d.corp) === q || d.code === nameOrCode; }).map(function (d) {
      var k = KIND[d.kind] || KIND.strike;
      return { date: d.date, kind: "노사 공시", title: "같은 기간 " + d.corp + " " + k[0] + "가 있었어요: " + d.report, sub: ((window.MTI18N && window.MTI18N.isEn) ? k[1] : k[0]) + " · 공시 제목 기준", url: d.url };
    });
  }

  function listPanel(host, rows, opts) {
    var ol = el("ol", "tl");
    rows.forEach(function (e) {
      var li = el("li"), body = el("div");
      body.append(el("div", "k", e.kind), el("div", "t", e.title));
      var s = el("div", "s"); s.appendChild(document.createTextNode(e.sub + " · ")); s.appendChild(link("원문 ↗ / source", e.url)); body.appendChild(s);
      li.append(el("div", "d", e.date), body); ol.appendChild(li);
    });
    host.appendChild(ol);
  }

  function background(host) {
    var b = el("div", "labor-bg");
    var E = !!(window.MTI18N && window.MTI18N.isEn); b.appendChild(el("p", E ? "note en" : "note", E ? BG_EN : BG_KO)); if (E) b.lastChild.lang = "en";
    host.appendChild(b);
  }

  /* 업종별 월별 분규 건수·근로손실일수. sectorId 가 있으면 그 업종만, 없으면 전체 업종 표. */
  function trend(host, data, sectorId) {
    var inds = (data && data.industries || []).filter(function (i) { return !sectorId || i.sector_id === sectorId; });
    if (!inds.length) { host.appendChild(el("p", "note", ((window.MTI18N && window.MTI18N.isEn) ? "Monthly labor-dispute statistics by industry are not collected yet." : "업종별 월별 노사분규 통계는 아직 모으지 못했어요."))); return false; }
    var months = {}; inds.forEach(function (i) { Object.keys(i.months || {}).forEach(function (m) { months[m] = 1; }); });
    var ms = Object.keys(months).sort().slice(-6);
    var tbl = el("table", "co"), hr = el("tr"); hr.appendChild(el("th", "", "업종 / Industry"));
    ms.forEach(function (m) { hr.appendChild(el("th", "num", m + " 건수·손실일")); }); tbl.appendChild(hr);
    inds.forEach(function (i) {
      var tr = el("tr"); tr.appendChild(el("td", "", i.name));
      ms.forEach(function (m) { var v = (i.months || {})[m]; tr.appendChild(el("td", "num", v ? (v.cases == null ? "-" : v.cases) + "건 · " + (v.lost_days == null ? "-" : v.lost_days) + "일" : "-")); });
      tbl.appendChild(tr);
    });
    host.appendChild(tbl);
    host.appendChild(el("p", "note", "출처: 고용노동부 노사분규 통계(공공데이터포털). 건수=분규 발생 건수, 손실일=근로손실일수. / Source: Ministry of Employment and Labor via data.go.kr. " + NOTE));
    return true;
  }

  /* 패널 하나를 host 에 붙인다. opts: {name, sectorId, title, limit} */
  function render(host, data, opts) {
    opts = opts || {};
    var p = el("section", "panel span2"), h = el("h2", "", opts.title || ((window.MTI18N && window.MTI18N.isEn) ? "Korea labor strike disclosures" : "회사 파업 소식(노사분규·파업 공시)")); p.appendChild(h);
    var ev = opts.name ? eventsFor(data, opts.name) : [];
    if (opts.name) {
      if (ev.length) listPanel(p, ev.slice(0, opts.limit || 10), opts);
      else p.appendChild(el("p", "note", ((window.MTI18N && window.MTI18N.isEn) ? "No labor-related filings found for this stock in the collected period." : "수집된 기간에 이 종목의 노사 관련 공시가 없습니다. 수집이 꺼져 있거나 키가 없을 수도 있습니다.")));
    }
    if (opts.sectorId !== undefined) trend(p, data, opts.sectorId || null);
    background(p);
    p.appendChild(el("p", "note", NOTE));
    host.appendChild(p);
    return p;
  }

  window.MTLabor = { load: load, eventsFor: eventsFor, trend: trend, render: render, background: background, BG_KO: BG_KO, BG_EN: BG_EN };
})();
