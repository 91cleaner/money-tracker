// 큰 계약 카드(10억+)에 '입찰 정보'를 붙인다. 데이터: data/sec_bid.json (조달청 입찰공고·낙찰정보서비스)
(() => {
  let B = null;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const deco = () => {
    if (!B) return;
    document.querySelectorAll('a[href*="ctrtNo="]').forEach((a) => {
      const card = a.closest('.cc,.ccard,.receipt,.case,article,li,tr'); if (!card || card.dataset.bid) return;
      const m = a.href.match(/ctrtNo=([A-Z0-9]+)/); if (!m) return;
      const no = m[1].length > 13 ? m[1].slice(0, 13) : m[1], x = B[no];
      card.dataset.bid = '1'; if (!x || !x.bn || (!x.n && !x.duty && !x.rgnlmt)) return;
      const rg = x.duty ? `지역 업체 참여 의무 · ${esc(x.duty)} 업체 ${x.duty_rt ?? '?'}% 이상` : x.rgnlmt ? `지역제한 · ${esc(x.rgnlmt)}` : '지역 조건 없음';
      const d = document.createElement(card.tagName === 'TR' ? 'td' : 'div'); d.className = 'bidinfo';
      if (card.tagName === 'TR') d.colSpan = 9;
      // 한 줄로 짧게: 참가 업체 수 · 낙찰률 · 공고 원문
      d.classList.add('bid-1');
      d.innerHTML = `🧾 입찰 ${x.n ? x.n.toLocaleString('ko-KR') + '곳 참가' : '참가 수 없음'}${x.rate != null ? ' · 낙찰률 ' + (Math.round(x.rate * 10) / 10) + '%' : ''}${x.duty || x.rgnlmt ? ' · 지역 업체 조건' : ''}${x.url ? ` · <a href="${esc(x.url)}" target="_blank" rel="noopener">공고 ↗</a>` : ''}`;
      if (card.tagName === 'TR') { const tr = document.createElement('tr'); tr.append(d); card.after(tr); } else card.append(d);
      // 같은 설명을 카드마다 붙이지 않고, 목록 위에 한 번만 둔다
      const list = card.tagName === 'TR' ? card.closest('table') : card.parentElement;
      if (list && !list.dataset.bidnote) {
        list.dataset.bidnote = '1';
        const n = document.createElement('p'); n.className = 'bid-explain';
        n.textContent = '🧾 낙찰률 = 기관이 미리 정한 가격(예정가격)에 견줘 실제로 계약한 금액의 비율 · 출처: 조달청 나라장터';
        n.style.cssText = 'margin:6px 0 10px;font-size:12px;line-height:1.5;color:#9aa6b2';
        list.before(n);
      }
    });
  };
  fetch('data/sec_bid.json', { cache: 'no-cache' }).then((r) => r.ok ? r.json() : null).then((j) => { if (j) { B = j.rows; deco(); new MutationObserver(deco).observe(document.body, { childList: true, subtree: true }); } }).catch(() => {});
})();
