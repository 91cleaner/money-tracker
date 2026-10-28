/* MONEY TRACKER — 용어 툴팁. PTR · 13F · 로비(LDA) · 의무액 옆에 ? 버튼을 달아 쉬운 설명을 보여줍니다.
   페이지마다 용어별로 처음 나오는 한 곳에만 붙고(화면이 나중에 그려져도 따라감), 링크 안·버튼 안·패널은 건드리지 않습니다.
   설명은 공개 제도 설명일 뿐이며 투자 조언 아님. 외부 요청·저장 없음. */
(function () {
  "use strict";
  if (window.MTGlossary) return;
  var DEFS = {
    ptr: { title: "PTR (거래 신고서)", text: "미 의회 의원이 주식 같은 증권을 사거나 팔았을 때 내는 신고서(Periodic Transaction Report)입니다. STOCK Act에 따라 거래 후 45일 안에 내야 해서, 거래일과 신고일이 다를 수 있습니다. 이 사이트는 신고일 기준으로 보여 주며, 금액은 정확한 값이 아니라 범위로 공개됩니다." },
    f13: { title: "13F (기관 보유 주식 보고서)", text: "미국 SEC에 일정 규모(운용자산 1억 달러) 이상 기관투자자가 분기마다 내는 보유 주식 목록입니다. 분기가 끝나고 최대 45일 뒤에 공개되므로 지금의 보유 상태와는 다를 수 있습니다." },
    lda: { title: "로비 공시 (LDA)", text: "로비 활동 공개법(Lobbying Disclosure Act)에 따라 로비 회사와 기업이 분기마다 의뢰인·주제·금액을 신고한 공시입니다. 로비는 합법적인 활동이며, 보고된 금액은 신고서에 적힌 값 그대로입니다. 어떤 결과를 냈는지는 알려 주지 않습니다." },
    obl: { title: "의무액 (계약 의무 금액)", text: "연방 정부가 계약에 따라 지급하기로 법적으로 약속한 금액(obligation)입니다. 실제로 지급된 돈이나 회사의 매출과는 다를 수 있으며, 여러 해에 걸친 계약이 한 번에 잡힐 수 있습니다." }
  };
  var TERMS = [[/\bPTR\b/, "ptr"], [/\b13F\b/, "f13"], [/\bLDA\b/, "lda"], [/로비/, "lda"], [/의무액/, "obl"]];
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|BUTTON|A|SELECT|OPTION|NOSCRIPT|SVG|CODE)$/;
  var done = {}, tip = null, openBtn = null, busy = false, timer = 0;

  var css = document.createElement("style");
  css.textContent = ".mtgl{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin:0 3px;padding:0;border:1px solid #4a8b62;border-radius:50%;background:#10291b;color:#9dffbf;font:700 11px/1 ui-monospace,Menlo,monospace;cursor:pointer;vertical-align:middle}" +
    ".mtgl:focus-visible,.mtgl[aria-expanded=true]{outline:2px solid #5dff9e;outline-offset:1px}" +
    "#mtGlTip{position:absolute;z-index:2500;max-width:min(320px,calc(100vw - 20px));background:#020c07;border:1px solid #2f8a55;border-radius:10px;box-shadow:0 10px 30px #000c;color:#d5f7e1;font:13px/1.55 system-ui,-apple-system,sans-serif;padding:10px 12px}" +
    "#mtGlTip b{display:block;margin-bottom:4px;color:#5dff9e;font:700 12px ui-monospace,Menlo,monospace}#mtGlTip[hidden]{display:none}";
  document.head.appendChild(css);

  function closeTip() { if (tip) tip.hidden = true; if (openBtn) { openBtn.setAttribute("aria-expanded", "false"); openBtn = null; } }
  function showTip(btn, id) {
    if (openBtn === btn) { closeTip(); return; }
    closeTip();
    if (!tip) { tip = document.createElement("div"); tip.id = "mtGlTip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
    var d = DEFS[id], t = document.createElement("b"); t.textContent = d.title;
    var p = document.createElement("span"); p.textContent = d.text;
    tip.replaceChildren(t, p); tip.hidden = false;
    var r = btn.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - w - 8)) + "px";
    tip.style.top = (window.scrollY + r.bottom + 6) + "px";
    btn.setAttribute("aria-expanded", "true"); btn.setAttribute("aria-describedby", "mtGlTip"); openBtn = btn;
  }
  function makeBtn(id, label) {
    var b = document.createElement("button"); b.type = "button"; b.className = "mtgl"; b.textContent = "?";
    b.setAttribute("aria-label", label + " 쉬운 설명"); b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", function (e) { e.stopPropagation(); showTip(b, id); });
    return b;
  }
  function scan() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        for (var e = n.parentNode; e && e !== document.body; e = e.parentNode) {
          if (e.nodeType !== 1 || SKIP.test(e.nodeName) || e.id === "mtCmdDock" || e.id === "mtCmdPanel" || e.id === "mtGlTip" || e.hasAttribute("data-gl-skip")) return NodeFilter.FILTER_REJECT;
        }
        return n.nodeValue && n.nodeValue.length > 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }), nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      for (var i = 0; i < TERMS.length; i++) {
        var id = TERMS[i][1]; if (done[id]) continue;
        var m = TERMS[i][0].exec(node.nodeValue); if (!m) continue;
        done[id] = true;
        var after = node.splitText(m.index + m[0].length);
        after.parentNode.insertBefore(makeBtn(id, m[0]), after);
        return;
      }
    });
  }
  function run() { if (busy) return; busy = true; try { scan(); } finally { busy = false; } }
  function later() { clearTimeout(timer); timer = setTimeout(run, 250); }

  document.addEventListener("click", closeTip);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { var b = openBtn; closeTip(); if (b) b.focus(); } });
  run();
  new MutationObserver(function () { if (!busy && Object.keys(done).length < 4) later(); }).observe(document.body, { childList: true, subtree: true });

  window.MTGlossary = { terms: Object.keys(DEFS) };
})();
