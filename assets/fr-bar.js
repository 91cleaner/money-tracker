/* 상단 알림바: 미국 대통령 문서(행정명령·포고 등) 티커 + 눌러서 여는 카드. 데이터: data/fr/presidential.json (Federal Register API).
   주가는 '같은 기간 ~이 있었어요'만. 투자 조언·원인 단정 없음. */
(() => {
  const EN = !!(window.MTI18N && window.MTI18N.isEn) || /^en/i.test(document.documentElement.lang || "");
  const base = document.currentScript && document.currentScript.src ? new URL("../data/fr/presidential.json", document.currentScript.src).href : "data/fr/presidential.json";
  const T = EN ? { bar: "White House news", more: "tap to open", close: "Close", src: "Source: Federal Register · price moves are just what happened in the same period · not investment advice", open: "Read original ↗", tags: "Topics", none: "" }
               : { bar: "백악관 소식", more: "눌러서 보기", close: "닫기", src: "출처: Federal Register(관보) · 주가는 같은 기간에 있었던 움직임일 뿐이에요 · 투자 조언 아님", open: "원문 보기 ↗", tags: "관련 분야", none: "" };
  const SEC = { semiconductor: ["반도체", "Chips"], tech_ai: ["AI·기술", "AI & tech"], energy: ["에너지", "Energy"], clean_energy: ["청정에너지", "Clean energy"], battery_ev: ["배터리·광물", "Batteries"], auto: ["자동차", "Cars"], health: ["제약·헬스", "Health"],
    defense: ["국방", "Defense"], shipbuilding: ["조선·해운", "Shipping"], industrial: ["철강·산업", "Industry"], finance: ["금융", "Finance"], crypto: ["가상자산", "Crypto"], consumer: ["소비재·농식품", "Consumer"], housing: ["주택", "Housing"] };
  const el = (tag, css, txt) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; };
  fetch(base).then(r => r.ok ? r.json() : null).catch(() => null).then(d => {
    const L = d && Array.isArray(d.items) ? d.items.filter(b => b && b.title && /^https:\/\//.test(b.url || "")).slice(0, 8) : [];
    if (!L.length || document.getElementById("mtFrBar")) return;
    const bar = el("div", "position:sticky;top:0;z-index:1500;display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 12px;background:#06210f;color:#eafff2;border-bottom:2px solid #2bff88;font:700 16px/1.4 system-ui,sans-serif;cursor:pointer;overflow:hidden");
    bar.id = "mtFrBar"; bar.setAttribute("role", "button"); bar.tabIndex = 0;
    const badge = el("span", "flex:none;background:#2bff88;color:#04170b;border-radius:999px;padding:2px 10px;font-size:15px", T.bar);
    const line = el("span", "flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis");
    const hint = el("span", "flex:none;font-size:13px;color:#9effc0", T.more);
    bar.append(badge, line, hint);
    let i = 0; const show = () => { const b = L[i % L.length]; line.textContent = (b.date || "") + " · " + (EN ? b.type_en : b.type) + " — " + (EN ? b.easy_en : b.easy_ko); i++; };
    show(); setInterval(show, 6000);
    const card = el("div", "position:fixed;inset:0;z-index:1600;background:rgba(0,0,0,.72);display:none;overflow:auto;padding:16px");
    const box = el("div", "max-width:560px;margin:0 auto;background:#04170b;color:#eafff2;border:2px solid #2bff88;border-radius:14px;padding:16px;font:16px/1.6 system-ui,sans-serif");
    const head = el("div", "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px");
    head.append(el("b", "font-size:20px", T.bar));
    const x = el("button", "min-height:44px;padding:0 16px;background:#2bff88;color:#04170b;border:0;border-radius:8px;font:700 16px system-ui", T.close); x.onclick = () => (card.style.display = "none"); head.append(x);
    box.append(head);
    L.forEach(b => {
      const c = el("div", "border-top:1px solid #1d5b36;padding:12px 0");
      c.append(el("div", "font-size:13px;color:#9effc0", (b.date || "") + " · " + (EN ? b.type_en : b.type) + (b.eo ? " · EO " + b.eo : "")));
      c.append(el("div", "font-size:18px;font-weight:700;margin:4px 0", EN ? b.easy_en : b.easy_ko));
      const tg = (b.sectors || []).map(s => SEC[s] && SEC[s][+EN]).filter(Boolean);
      if (tg.length || (b.tickers || []).length) c.append(el("div", "font-size:14px", T.tags + ": " + tg.concat(b.tickers || []).join(" · ")));
      const sp = EN ? b.same_period_en : b.same_period_ko; if (sp) c.append(el("div", "font-size:15px;color:#ffe58a;margin-top:4px", "📈 " + sp));
      const a = el("a", "display:inline-block;margin-top:6px;color:#5dff9e;font-size:15px", T.open); a.href = b.url; a.target = "_blank"; a.rel = "noopener noreferrer"; c.append(a);
      box.append(c);
    });
    box.append(el("div", "font-size:12px;color:#8fa89a;margin-top:8px", T.src));
    card.append(box); card.onclick = e => { if (e.target === card) card.style.display = "none"; };
    const open = () => (card.style.display = "block"); bar.onclick = open; bar.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
    document.body.prepend(bar); document.body.append(card);
  });
})();
