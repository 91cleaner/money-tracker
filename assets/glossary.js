/* 미국주식추적단 — 용어 툴팁. Adds a small "?" button after headings / table heads / labels that mention a public-record term
   (PTR, 13F, 로비(LDA), 의무액, PAC, 노사분규·파업 공시). Click (or Enter/Space) opens a plain-Korean explanation; Esc / outside click closes.
   Explicit use: <span data-term="PTR">PTR</span>. No network, no storage, no innerHTML. Explanations describe the record only. */
(function () {
  "use strict";
  if (window.MTGlossary) return;
  var TERMS = {
    PTR: { name: "PTR (정기 거래 보고서)", body: "Periodic Transaction Report. 미국 의원(과 배우자·부양자녀)의 주식 등 거래를 알리는 신고서입니다. STOCK Act에 따라 거래를 안 날부터 30일 이내, 늦어도 거래 후 45일 이내에 신고해야 합니다. 그래서 거래일과 신고일은 다를 수 있고, 이 사이트는 '신고 기준'으로 날짜를 보여 줍니다. 금액은 정확한 값이 아니라 범위로 공개됩니다." },
    "13F": { name: "13F (기관투자가 보유 보고서)", body: "운용자산이 1억 달러를 넘는 기관투자가가 분기마다 SEC에 내는 보유 주식 보고서(Form 13F)입니다. 분기가 끝나고 45일 안에 내기 때문에 시차가 있고, 대상 증권의 보유분만 담겨 일부 해외 자산 등은 빠질 수 있습니다." },
    LDA: { name: "로비 (LDA 공시)", body: "로비공개법(Lobbying Disclosure Act)에 따라 로비스트·로비회사가 의회와 행정부를 상대로 한 활동과 금액을 분기마다 보고한 공시입니다. 금액은 보고서에 적힌 값이며, 로비가 성공했는지나 어떤 영향을 줬는지는 알려 주지 않습니다." },
    OBL: { name: "의무액", body: "연방 계약에서 정부가 지급하기로 법적으로 약정한 금액(obligation)입니다. 실제로 돈이 지급된 금액과는 다를 수 있고, 계약이 바뀌면 늘거나 줄 수 있습니다." },
    PAC: { name: "PAC (정치활동위원회)", body: "Political Action Committee. 기업·단체 구성원 등이 모은 돈을 후보나 정당에 기부하는 조직입니다. 기부 내역은 연방선거관리위원회(FEC)에 공개됩니다. 기부 기록은 사실 정리일 뿐 대가 관계를 뜻하지 않습니다." },
    CLOSE: { name: "종가 (마감 가격)", body: "그날 장이 끝날 때의 마지막 가격이에요. 하루 중에 오르내린 값이 아니라 마감 때 값 하나만 보여 줘요. 실시간 가격이 아니에요." },
    EXPORT: { name: "수출통제", body: "나라가 어떤 물건이나 기술을 다른 나라에 못 팔게 하거나, 허락을 받아야 팔 수 있게 하는 규칙이에요. 예를 들어 미국은 첨단 반도체를 어느 나라에 팔 때 허가를 받게 하기도 해요." },
    S232: { name: "나라 안보를 이유로 수입품에 세금 매기는 법 (Sec. 232)", body: "미국 대통령이 나라 안전과 관련된 수입품에 관세를 매기거나 수입을 줄일 수 있게 한 법 조항이에요. 어떤 물건에 쓰였는지는 원문 링크에서 확인하세요." },
    PROCL: { name: "포고문", body: "미국 대통령이 공식적으로 알리는 문서의 한 종류예요. 관세 같은 정책을 알릴 때도 쓰여요. 이 사이트는 제목과 원문 링크만 보여 줘요." },
    DUE45: { name: "주식 숙제 제출 기한 (45일)", body: "미국 의원은 주식을 사거나 판 뒤 45일 안에 '이렇게 거래했어요' 하고 나라에 알려야 해요. 학교 숙제 제출 기한 같은 거예요. 이 기한(STOCK Act 45일)을 넘기면 '늦게 냈다'고 표시해요. 늦게 냈다는 사실만 보여 줄 뿐, 잘못했다는 뜻은 아니에요." },
    FORM4: { name: "회사 높은 사람이 자기 회사 주식 판 기록 (Form 4)", body: "회사 임원이나 큰 주주가 자기 회사 주식을 사거나 팔면, 2영업일 안에 미국 증권위원회(SEC)에 내는 기록이에요. 누가 언제 얼마나 거래했는지가 적혀 있어요. 기록이 있다는 사실만 보여 주고, 앞으로 주가가 어떻게 될지는 알려 주지 않아요." },
    PLAN: { name: "미리 예약해둔 판매 (10b5-1)", body: "회사 높은 사람이 미리 날짜와 조건을 정해 두고, 그대로 자동으로 사고파는 계획이에요. 이 계획에 따른 거래는 거래 기록에 따로 표시돼요. 표시가 있다는 사실만 보여 줘요." },
    BILL: { name: "법안 (한 줄 설명)", body: "새로 만들거나 고치려고 국회에 올린 법의 초안이에요. 이 사이트는 법안 이름 옆에 '무슨 내용인지'를 한 줄로 쉽게 적어요. 정확한 내용은 원문 링크에서 확인하세요." },
    LABOR: { name: "회사 파업 소식(노사분규·파업 공시)", body: "한국 기업이 금융감독원 전자공시(DART)나 거래소에 낸 공시 중 제목에 파업·노사분규·생산중단·영업정지가 들어간 것입니다. 공시가 있다고 실제 파업이 일어났다는 뜻은 아닙니다." }
  };

  // English wording for ?lang=en (same terms, plain words; no Korean left on screen)
  var EN = {
    PTR: { name: "PTR (Periodic Transaction Report)", body: "A form that US lawmakers (and spouses and dependent children) file to report stock trades. Under the STOCK Act it is due within 30 days of learning about a trade, and no later than 45 days after it. So the trade date and the filing date can differ, and this site shows dates by filing. Amounts are public as ranges, not exact values." },
    "13F": { name: "13F (institutional holdings report)", body: "A quarterly report (Form 13F) that big investors managing over $100 million send to the SEC, listing the stocks they hold. It is due 45 days after the quarter ends, so it runs late, and it only covers certain securities, so some foreign assets may be missing." },
    LDA: { name: "Lobbying (LDA filing)", body: "A quarterly filing under the Lobbying Disclosure Act. Lobbyists and lobbying firms report what they did with Congress and the executive branch, and how much was spent. The amount is what the report says. It does not tell whether the lobbying worked or what effect it had." },
    OBL: { name: "Obligation", body: "The amount the government legally promised to pay on a federal contract. It can differ from the money actually paid, and it can go up or down if the contract changes." },
    PAC: { name: "PAC (Political Action Committee)", body: "A group that collects money from company or group members and gives it to candidates or parties. Gifts are public at the Federal Election Commission (FEC). A gift record is just a fact. It does not mean anything was given in return." },
    CLOSE: { name: "Closing price", body: "The last price when the market closed that day. It is one number at the close, not the ups and downs during the day. It is not a live price." },
    EXPORT: { name: "Export controls", body: "Rules where a country bans selling some goods or technology abroad, or requires a permit first. For example, the US can require a permit to sell advanced chips to certain countries." },
    S232: { name: "Law for taxing imports for national security reasons (Sec. 232)", body: "A part of US law that lets the President put tariffs on, or cut, imports tied to national security. Check the source link to see which goods it was used on." },
    PROCL: { name: "Proclamation", body: "A kind of official notice from the US President. It is sometimes used to announce policies like tariffs. This site only shows the title and the source link." },
    DUE45: { name: "Stock homework due date (45 days)", body: "After a US lawmaker buys or sells a stock, they must tell the government within 45 days, like a homework due date at school. If it comes in later than that (the STOCK Act 45-day limit), the site marks it as late. This only shows that it was late. It does not say anyone did something wrong." },
    FORM4: { name: "Record of a company insider trading their own company's stock (Form 4)", body: "When a company officer or big shareholder buys or sells stock in their own company, they file this record with the US Securities and Exchange Commission (SEC) within 2 business days. It shows who traded, when and how much. It only shows that the record exists. It says nothing about where the price goes next." },
    PLAN: { name: "Pre-scheduled sale (10b5-1)", body: "A plan where a company insider sets the dates and rules ahead of time, and the trades then happen automatically. Trades under such a plan are marked in the filing. The site only shows that mark." },
    BILL: { name: "Bill (one-line summary)", body: "A draft of a law put forward to make a new rule or change an old one. Next to each bill name the site adds a one-line plain summary of what it does. Check the source link for the exact text." },
    LABOR: { name: "Labor strike filings (Korea)", body: "Filings that Korean companies sent to the DART system or an exchange with strike, labor dispute, production halt or business suspension in the title. A filing does not mean a strike really happened." }
  };
  var EN_NOTE = "Public-record term guide. Not investment advice.", EN_LABEL = " - what does this mean?";
  var isEn = !!(window.MTI18N && window.MTI18N.isEn);
  function tname(k) { return isEn && EN[k] ? EN[k].name : TERMS[k].name; }
  var PATTERNS = [
    ["PTR", /(^|[^A-Za-z])PTR(?![A-Za-z])/],
    ["13F", /(^|[^A-Za-z0-9])13F(?![A-Za-z0-9])/],
    ["LDA", /(^|[^A-Za-z])LDA(?![A-Za-z])|로비/],
    ["OBL", /의무액|obligat/i],
    ["PAC", /(^|[^A-Za-z])PAC(?![A-Za-z])/],
    ["CLOSE", /종가/],
    ["EXPORT", /수출통제|수출 통제/],
    ["S232", /232조|Section 232|Sec\. 232/i],
    ["DUE45", /주식 숙제|45일 기한|45-day deadline|homework due/i],
    ["FORM4", /Form 4/],
    ["PLAN", /10b5-1/],
    ["PROCL", /포고문/],
    ["LABOR", /파업|노사분규|labor strike/i]
  ];
  var SELECTOR = "h2,h3,th,.k,.kind,[data-term]";
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var css = document.createElement("style");
  css.textContent = [
    ".mt-gl{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin-left:5px;padding:0;border-radius:50%;border:1px solid #4a8b62;background:#10291b;color:#9dffbf;font:700 11px/1 system-ui,sans-serif;cursor:pointer;vertical-align:middle;text-transform:none;letter-spacing:0}",
    ".mt-gl:hover,.mt-gl[aria-expanded=true]{background:#5dff9e;color:#02110a;border-color:#5dff9e}",
    ".mt-gl:focus-visible{outline:2px solid #7fd8ff;outline-offset:2px}",
    "#mtGlPop{position:fixed;z-index:2100;max-width:min(340px,calc(100vw - 20px));background:rgba(2,12,7,.98);border:1px solid #2f8a55;border-radius:10px;box-shadow:0 12px 34px #000c;color:#d5f7e1;font:13px/1.55 system-ui,-apple-system,sans-serif;padding:10px 12px;text-transform:none;letter-spacing:0}",
    "#mtGlPop[hidden]{display:none}",
    "#mtGlPop b{display:block;margin-bottom:4px;color:#5dff9e;font:700 12px ui-monospace,Menlo,monospace}",
    "#mtGlPop small{display:block;margin-top:6px;color:#7fa58f;font-size:11.5px}"
  ].join("");
  document.head.appendChild(css);

  var pop = el("div"); pop.id = "mtGlPop"; pop.hidden = true; pop.setAttribute("role", "note");
  var popName = el("b"), popBody = el("span"), popNote = el("small", "", isEn ? EN_NOTE : "공개 기록 용어 설명이며 투자 조언 아님.");
  pop.append(popName, popBody, popNote);
  document.body.appendChild(pop);
  var current = null;

  function close() { pop.hidden = true; if (current) { current.setAttribute("aria-expanded", "false"); current.focus && current.focus(); } current = null; }
  function open(btn, key) {
    var t = TERMS[key]; if (!t) return;
    if (current) current.setAttribute("aria-expanded", "false");
    current = btn; btn.setAttribute("aria-expanded", "true");
    popName.textContent = tname(key); popBody.textContent = isEn && EN[key] ? EN[key].body : t.body; pop.hidden = false;
    var r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.max(10, Math.min(r.left, window.innerWidth - w - 10));
    var top = r.bottom + 6; if (top + h > window.innerHeight - 10) top = Math.max(10, r.top - h - 6);
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pop.hidden) close(); });
  document.addEventListener("click", function (e) { if (!pop.hidden && !pop.contains(e.target) && !(e.target.closest && e.target.closest(".mt-gl"))) { pop.hidden = true; if (current) current.setAttribute("aria-expanded", "false"); current = null; } });
  window.addEventListener("scroll", function () { if (!pop.hidden) { pop.hidden = true; if (current) current.setAttribute("aria-expanded", "false"); current = null; } }, true);

  function addButton(host, key) {
    var b = el("button", "mt-gl", "?"); b.type = "button";
    b.setAttribute("aria-label", isEn ? tname(key) + EN_LABEL : TERMS[key].name + " 뜻 보기"); b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); if (current === b && !pop.hidden) close(); else open(b, key); });
    host.appendChild(b);
  }
  function decorate(host) {
    if (host.getAttribute("data-gl") || host.closest("#mtGlPop,#mtCmdPanel")) return;
    host.setAttribute("data-gl", "1");
    var explicit = (host.getAttribute("data-term") || "").toUpperCase(), text = host.textContent || "", n = 0;
    if (explicit) { var k = explicit === "로비" ? "LDA" : explicit === "의무액" ? "OBL" : explicit; if (TERMS[k]) addButton(host, k); return; }
    for (var i = 0; i < PATTERNS.length && n < 2; i++) if (PATTERNS[i][1].test(text)) { addButton(host, PATTERNS[i][0]); n++; }
  }
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches(SELECTOR)) decorate(root);
    var hits = root.querySelectorAll ? root.querySelectorAll(SELECTOR) : [];
    for (var i = 0; i < hits.length; i++) decorate(hits[i]);
  }
  var queued = false, pending = [];
  new MutationObserver(function (ms) {
    ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) pending.push(n); }); });
    if (queued || !pending.length) return; queued = true;
    requestAnimationFrame(function () { queued = false; var p = pending; pending = []; p.forEach(scan); });
  }).observe(document.body, { childList: true, subtree: true });
  scan(document.body);

  window.MTGlossary = { terms: Object.keys(TERMS), scan: function () { scan(document.body); } };
})();
