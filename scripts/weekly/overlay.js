(a) => {
  const m = window.moneyTrackerMap, box = m.getContainer();
  if (a.phase === "map") {
    // Show only the Leaflet map: hide every sibling along the map's ancestor chain (top stats bar, tickers, panels).
    let el = box;
    while (el && el !== document.documentElement) {
      for (const sib of el.parentElement.children) if (sib !== el && sib.tagName !== "SCRIPT" && sib.tagName !== "STYLE" && sib.tagName !== "HEAD") sib.style.setProperty("display", "none", "important");
      el = el.parentElement;
    }
    box.querySelectorAll(".leaflet-control-container,.leaflet-marker-pane,.leaflet-popup-pane,.leaflet-tooltip-pane,.leaflet-overlay-pane,.leaflet-shadow-pane")
      .forEach(e => e.style.setProperty("display", "none", "important"));
    for (const e of [document.documentElement, document.body]) { e.style.setProperty("padding", "0", "important"); e.style.setProperty("margin", "0", "important"); }
    for (let e = box.parentElement; e && e !== document.body; e = e.parentElement) Object.assign(e.style, { position: "fixed", inset: "0", width: "1600px", height: "900px", transform: "none", margin: "0", padding: "0", top: "0", left: "0" });
    Object.assign(box.style, { position: "fixed", inset: "0", width: "1600px", height: "900px", zIndex: 1 });
    document.documentElement.style.overflow = "hidden"; window.scrollTo(0, 0);
    m.invalidateSize();
    m.fitBounds([[24.5, -124.5], [49.2, -67]], { paddingTopLeft: [40, 140], paddingBottomRight: [440, 80], animate: false });
    return;
  }
  window.scrollTo(0, 0);
  const OR = "#ff9f1c", RED = "#b45a50", BLU = "#5577a8", BG = "#0b120d";
  const col = p => (p === "R" ? RED : BLU);
  document.getElementById("wk")?.remove();
  const W = document.createElement("div"); W.id = "wk";
  W.style.cssText = "position:fixed;left:0;top:0;width:1600px;height:900px;zoom:1;transform:none;z-index:2147483000;font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:#f2efe9;pointer-events:none";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let html = `<div style="position:absolute;left:0;right:0;top:0;height:130px;background:linear-gradient(${BG}f2,${BG}00)"></div>
  <div style="position:absolute;left:48px;top:28px;white-space:nowrap">
   <div style="font:600 15px ui-monospace,Menlo,monospace;letter-spacing:3px;color:${OR}"><span class="kt"></span> · WEEKLY</div>
   <style>.kt::before{content:"\\C138\\AE08\\CD94\\C801\\B2E8"}</style>
   <div style="font-size:38px;font-weight:800;margin-top:4px">This week in Congress trades</div>
   <div style="font-size:16px;color:#c9c4b8;margin-top:4px">${esc(a.sub)}</div></div>`;
  const sum = (P, label) => { const s = a.s[P]; return `<div style="font-size:16px;font-weight:800;color:${col(P) === RED ? "#d27a6f" : "#7f9fd0"}">${label}</div>
   <div style="font-size:13px;color:#d8d3c8;margin-top:3px">${s.m} ${s.m === 1 ? "member" : "members"} · ${s.n} ${s.n === 1 ? "trade" : "trades"} · <b style="color:${OR}">${s.b} ${s.b === 1 ? "buy" : "buys"}</b> / ${s.s} ${s.s === 1 ? "sell" : "sells"}</div>
   <div style="font:12px ui-monospace,Menlo,monospace;color:#9c978c;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Most traded: ${esc(s.top.reduce((o, t) => (o.length && (o.join(", ") + ", " + t).length > 36) ? o : (o.length < 3 ? [...o, t] : o), []).join(", ") || "none")}</div>`; };
  html += `<div id="wk-side" style="position:absolute;right:40px;top:150px;width:360px;background:${BG}e6;border:1px solid ${OR}55;border-radius:6px;padding:18px">
   <div style="font:600 12px ui-monospace,Menlo,monospace;letter-spacing:2px;color:#9c978c;margin-bottom:12px">BY PARTY</div>
   ${sum("R", "Republicans")}<div style="height:1px;background:#ffffff1f;margin:14px 0"></div>${sum("D", "Democrats")}
   <div style="font-size:11px;color:#9c978c;margin-top:16px;line-height:1.5">Dot = approximate home-district location. Dates = trade date. Amounts are reported ranges.${a.more ? `<br>${a.more} more members not shown on the map.` : ""}</div></div>
   <div id="wk-foot" style="position:absolute;left:0;right:0;bottom:0;height:48px;background:${BG};border-top:1px solid ${OR}66;display:flex;align-items:center;padding:0 48px;font-size:13px;color:#b8b3a8;white-space:nowrap">Source: U.S. House Clerk periodic transaction reports (PTR) · Party and district: Congress.gov · Public records, not investment advice</div>
   <svg id="wk-svg" width="1600" height="900" style="position:absolute;inset:0"></svg>`;
  W.innerHTML = html; document.documentElement.appendChild(W);
  const svg = W.querySelector("#wk-svg"), NS = "http://www.w3.org/2000/svg";
  const rect = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const hit = (A, B, pad = 8) => A.x < B.x + B.w + pad && B.x < A.x + A.w + pad && A.y < B.y + B.h + pad && B.y < A.y + A.h + pad;
  const blocked = [rect(W.querySelector("#wk-side")), { x: 0, y: 0, w: 1600, h: 128 }, { x: 0, y: 852, w: 1600, h: 48 }];
  const pts = a.d.map(x => { const p = m.latLngToContainerPoint([x.lat, x.lng]); return { ...x, x: Math.min(1140, Math.max(30, p.x)), y: Math.min(830, Math.max(140, p.y)) }; });
  pts.forEach(x => blocked.push({ x: x.x - 9, y: x.y - 9, w: 18, h: 18 }));
  for (const x of pts) {
    const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", x.x); c.setAttribute("cy", x.y); c.setAttribute("r", 16); c.setAttribute("fill", col(x.p)); c.setAttribute("opacity", .2); svg.appendChild(c);
    const d = document.createElementNS(NS, "circle"); d.setAttribute("cx", x.x); d.setAttribute("cy", x.y); d.setAttribute("r", 7); d.setAttribute("fill", col(x.p)); d.setAttribute("stroke", BG); d.setAttribute("stroke-width", 2); svg.appendChild(d);
  }
  for (const x of pts) {
    const mono = "font:12px ui-monospace,Menlo,monospace;color:#d8d3c8;margin-top:2px";
    let body;
    if (x.lines.length > 3) {
      const nb = x.lines.filter(l => l.s === "BUY").length, ns = x.lines.filter(l => l.s === "SELL").length;
      const cnt = {}; x.lines.forEach(l => cnt[l.a] = (cnt[l.a] || 0) + 1);
      const top = Object.entries(cnt).sort((p, q) => q[1] - p[1]).slice(0, 3).map(e => e[0]).join(", ");
      const ds = x.lines.map(l => l.d).sort();
      body = `<div style="${mono}">${x.lines.length} trades · <b style="color:${OR}">${nb} ${nb === 1 ? "buy" : "buys"}</b> / <b style="color:${OR}">${ns} ${ns === 1 ? "sell" : "sells"}</b></div>` +
        `<div style="${mono}">Top: ${esc(top)}</div><div style="${mono};color:#9c978c">Trade dates ${esc(ds[0])} - ${esc(ds[ds.length - 1])}</div>`;
    } else {
      body = x.lines.map(l => `<div style="${mono}">${esc(l.a)} <b style="color:${OR}">${l.s}</b> ${esc(l.amt)} · ${esc(l.d)}</div>`).join("");
    }
    const card = document.createElement("div");
    card.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;background:${BG}e8;border:1px solid #ffffff22;border-left:3px solid ${col(x.p)};padding:6px 10px;border-radius:4px`;
    card.innerHTML = `<div style="font-size:14px;font-weight:700"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${col(x.p)};margin-right:6px"></span>${esc(x.name)} <span style="color:#9c978c;font-weight:400;font-size:12px">${x.p} · ${esc(x.dist)}</span></div>` + body;
    W.appendChild(card);
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let best = null;
    outer: for (const r of [40, 80, 130, 190, 260, 340]) {
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * 2 * Math.PI - Math.PI / 4;
        const cx = x.x + r * Math.cos(ang), cy = x.y + r * Math.sin(ang);
        const R = { x: cos(ang) >= 0 ? cx : cx - cw, y: cy - ch / 2, w: cw, h: ch };
        if (R.x < 20 || R.y < 130 || R.x + R.w > 1580 || R.y + R.h > 845) continue;
        if (blocked.some(B => hit(R, B))) continue;
        best = R; break outer;
      }
    }
    function cos(t) { return Math.cos(t); }
    if (!best) best = { x: Math.min(1100, x.x + 20), y: Math.min(800, x.y + 20), w: cw, h: ch };
    blocked.push(best);
    card.style.left = best.x + "px"; card.style.top = best.y + "px";
    const ax = best.x + (best.x >= x.x ? 0 : cw), ay = best.y + Math.min(ch / 2, 14);
    const ln = document.createElementNS(NS, "line");
    ln.setAttribute("x1", x.x); ln.setAttribute("y1", x.y); ln.setAttribute("x2", ax); ln.setAttribute("y2", ay);
    ln.setAttribute("stroke", OR); ln.setAttribute("stroke-width", 1.6); ln.setAttribute("opacity", .85);
    svg.insertBefore(ln, svg.firstChild);
  }
}
