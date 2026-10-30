/* 지출 탭 맨 위: 미국 정부 빚·지출 큰 숫자 카드 (재무부 FiscalData, 키 없음) */
(function () {
  var box = document.getElementById('fiscal'); if (!box) return;
  var en = /^en/i.test(navigator.language || '') && !/^ko/i.test(document.documentElement.lang || '');
  function t(ko, e) { return en ? e : ko; }
  function usd(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function words(n) { // 쉬운 말로 읽기
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + t(' 조 달러', ' trillion');
    if (n >= 1e9) return en ? '$' + (n / 1e9).toFixed(1) + ' billion' : Math.round(n / 1e8).toLocaleString('en-US') + '억 달러';
    return usd(n);
  }
  fetch('data/us-fiscal.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
    var h = '<p class="eyebrow">● ' + t('미국 정부 돈 계기판', 'US government money meter') + '</p>';
    if (d.debt) {
      var a = d.debt.latest, b = d.debt.year_ago,
        days = Math.max(1, (new Date(a.date) - new Date(b.date)) / 864e5),
        diff = a.value - b.value, sec = diff / (days * 86400);
      h += '<div class="fc"><span>' + t('나라 빚 전체', 'Total national debt') + '</span><b id="fc-debt" data-v="' + a.value + '">' + usd(a.value) + '</b>' +
        '<small>' + words(a.value) + ' · ' + a.date + '</small></div>';
      h += '<p class="fc-line">' + t('같은 기간(최근 1년) 빚은 ', 'In the same period (last year) the debt went ') +
        (diff >= 0 ? t('늘었어요: ', 'up: ') : t('줄었어요: ', 'down: ')) +
        '<b>' + words(Math.abs(diff)) + '</b> · ' + t('1초에 약 ', 'about ') + '<b>' + usd(Math.abs(sec)) + '</b>' + t('씩이었어요.', ' per second.') + '</p>';
    }
    if (d.outlays) {
      h += '<div class="fc"><span>' + t('이번 회계연도 정부 지출(지금까지)', 'Federal spending this fiscal year so far') + '</span><b id="fc-out" data-v="' + d.outlays.fytd + '">' + usd(d.outlays.fytd) + '</b>' +
        '<small>' + words(d.outlays.fytd) + ' · ' + d.outlays.as_of + '</small></div>';
    }
    h += '<p class="fc-src">' + t('출처: 미국 재무부 FiscalData(무료 공식 자료). 숫자만 보여 드려요. 이유나 좋고 나쁨은 말하지 않아요. 투자 조언 아님.', 'Source: U.S. Treasury FiscalData (free, official). Numbers only: no reasons, no judgement, not investment advice.') + '</p>';
    box.innerHTML = h;
    if (!matchMedia('(prefers-reduced-motion:reduce)').matches) { // 게임처럼 0에서 올라가는 숫자
      ['fc-debt', 'fc-out'].forEach(function (id) {
        var el = document.getElementById(id); if (!el) return;
        var v = +el.dataset.v, s = performance.now();
        (function f(n) { var p = Math.min(1, (n - s) / 1200); el.textContent = usd(v * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(s);
      });
    }
  }).catch(function () { box.hidden = true; });
})();
