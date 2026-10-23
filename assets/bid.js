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
      d.innerHTML = `<b>🧾 입찰 정보</b> <span>참가 ${x.n ? x.n.toLocaleString('ko-KR') + '곳' : '—'}</span> <span>예상 가격 대비 계약 금액 ${x.rate != null ? x.rate + '%' : '—'}</span> <span>${rg}</span>
        ${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">공고 ${esc(x.bn)} ↗</a>` : ''}
        <small>예상 가격 대비 계약 금액(낙찰률) = 기관이 미리 정한 가격(예정가격)에 견줘 실제로 계약한 금액의 비율 · 출처: 조달청 나라장터 입찰공고·낙찰정보서비스${x.opened ? ' · 개찰 ' + esc(x.opened) : ''}</small>`;
      if (card.tagName === 'TR') { const tr = document.createElement('tr'); tr.append(d); card.after(tr); } else card.append(d);
    });
  };
  fetch('data/sec_bid.json', { cache: 'no-cache' }).then((r) => r.ok ? r.json() : null).then((j) => { if (j) { B = j.rows; deco(); new MutationObserver(deco).observe(document.body, { childList: true, subtree: true }); } }).catch(() => {});
})();
