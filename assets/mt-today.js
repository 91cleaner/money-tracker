/* Today: 3 cards. Opens only from the tracking menu; the default screen stays the same.
   Facts from collected public records only: newest House trade report, newest SEC Form 4 open-market trade, newest White House action. No advice. */
(() => {
  const en = () => !!(window.MTI18N && window.MTI18N.isEn) || new URLSearchParams(location.search).get('lang') === 'en';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const get = p => fetch('../data/us/' + p + '?v=' + Date.now().toString().slice(0, 7)).then(r => r.ok ? r.json() : null).catch(() => null);
  const md = d => { if (!d) return '?'; const [y, m, dd] = String(d).slice(0, 10).split('-'); return en() ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${+dd}, ${y}` : `${y}년 ${+m}월 ${+dd}일`; };
  const side = c => c === 'P' ? (en() ? 'Buy' : '매수') : c === 'S' ? (en() ? 'Sell' : '매도') : (en() ? 'Other' : '기타');
  function pick(tr, f4, wh) {
    const out = [];
    const t = ((tr && tr.trades) || []).slice().sort((a, b) => String(b.fd).localeCompare(String(a.fd)) || String(b.d).localeCompare(String(a.d)))[0];
    if (t) out.push({ k: 'trade', t });
    let best = null; Object.entries((f4 && f4.companies) || {}).forEach(([sym, c]) => (c.trades || []).forEach(x => { if (!best || String(x.filed) > String(best.filed)) best = Object.assign({ sym }, x); }));
    if (best) out.push({ k: 'form4', t: best });
    const w = ((wh && wh.items) || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (w) out.push({ k: 'wh', t: w });
    return out;
  }
  function cardHtml(c) {
    const E = en(), t = c.t;
    if (c.k === 'trade') return `<h4>${E ? 'Newest lawmaker trade report' : '가장 최근 의원 거래 신고'}</h4>
      <p><b>${esc(t.who)}</b> · ${esc(t.tk)} · ${side(t.ty)}</p>
      <p>${E ? 'Money range' : '금액 범위'}: ${esc(t.amt)}</p>
      <p>${E ? 'Trade date' : '거래일'}: ${md(t.d)} · ${E ? 'Report date' : '신고일'}: ${md(t.fd)}</p>
      <p class="s">${E ? 'Source: U.S. House Clerk' : '출처: 미국 하원 사무처'} · <a href="${esc(t.doc)}" target="_blank" rel="noopener">${E ? 'Original report' : '원본 신고서'}</a></p>`;
    if (c.k === 'form4') return `<h4>${E ? 'Newest company insider trade' : '가장 최근 회사 내부자 거래'}</h4>
      <p><b>${esc(t.who)}</b> · ${esc(t.sym)} · ${side(t.code)}</p>
      <p>${E ? 'Shares' : '주식 수'}: ${Math.round(t.shares).toLocaleString('en-US')} · ${E ? 'Price' : '가격'}: $${(+t.price).toFixed(2)}</p>
      <p>${E ? 'Trade date' : '거래일'}: ${md(t.date)} · ${E ? 'Report date' : '신고일'}: ${md(t.filed)}</p>
      <p class="s">${E ? 'Source: SEC Form 4' : '출처: 미국 증권거래위원회(SEC) 서류 4'} · <a href="${esc(t.url)}" target="_blank" rel="noopener">${E ? 'Original filing' : '원본 서류'}</a></p>`;
    const title = E ? t.t : (t.ko || '');
    return `<h4>${E ? 'Newest White House action' : '가장 최근 백악관 조치'}</h4>
      ${title ? `<p><b>${esc(title)}</b></p>` : `<p>${'제목은 영어 원문만 있어요. 원문 링크를 눌러 보세요.'}</p>`}
      <p>${E ? 'Signed' : '서명일'}: ${md(t.sign)} · ${E ? 'Published' : '관보 게재일'}: ${md(t.date)}</p>
      <p class="s">${E ? 'Source: Federal Register' : '출처: 미국 관보'} · <a href="${esc(t.u)}" target="_blank" rel="noopener">${E ? 'Original document' : '원본 문서'}</a></p>`;
  }
  async function open() {
    let el = document.getElementById('mtToday'); if (el) { el.remove(); return; }
    const E = en(); el = document.createElement('div'); el.id = 'mtToday'; el.setAttribute('role', 'dialog');
    el.innerHTML = `<div class="hd"><b>${E ? 'Today: 3 cards' : '오늘 카드 3장'}</b><button type="button" class="x">${E ? 'Close' : '닫기'}</button></div><div class="bd">${E ? 'Loading...' : '불러오는 중...'}</div>`;
    document.body.append(el); el.querySelector('.x').onclick = () => el.remove();
    const [tr, f4, wh] = await Promise.all([get('trades-recent.json'), get('insider-form4.json'), get('whitehouse.json')]);
    const cs = pick(tr, f4, wh);
    el.querySelector('.bd').innerHTML = cs.length ? cs.map(c => `<section class="c">${cardHtml(c)}</section>`).join('') +
      `<p class="note">${E ? 'These are records only. They do not tell why anyone acted. This is not investment advice.' : '기록만 보여줘요. 왜 그렇게 했는지는 알 수 없어요. 투자 조언이 아니에요.'}</p>`
      : (E ? 'Could not load the records.' : '기록을 불러오지 못했어요.');
  }
  const css = document.createElement('style');
  css.textContent = '#mtToday{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:3000;width:min(920px,94vw);max-height:80dvh;overflow:auto;background:#06130ff7;border:1px solid #2f8a5a;border-radius:4px;padding:10px 12px;color:#d8f5e3;font:13px system-ui,sans-serif;box-shadow:0 10px 30px #000a}#mtToday .hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;color:#8af7af}#mtToday .bd{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px}#mtToday .c{border:1px solid #235e44;border-radius:3px;padding:8px}#mtToday h4{margin:0 0 6px;font-size:13px;color:#8af7af}#mtToday p{margin:3px 0}#mtToday .s{font-size:11px;color:#9cbac6}#mtToday a{color:#68c7d0}#mtToday .note{grid-column:1/-1;font-size:11px;color:#9cbac6}#mtTodayBtn{display:block;width:calc(100% - 6px)}';
  document.head.append(css);
  const add = () => { const t = document.getElementById('topics'); if (!t) return setTimeout(add, 200); if (document.getElementById('mtTodayBtn')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'mtTodayBtn'; b.textContent = en() ? 'Today: 3 cards' : '오늘 카드 3장'; b.onclick = e => { e.stopPropagation(); open(); };
    t.parentNode.insertBefore(b, t); };
  window.mtToday = { open, pick };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add); else add();
})();
