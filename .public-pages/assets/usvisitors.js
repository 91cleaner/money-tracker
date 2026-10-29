/* Public GoatCounter visitor tally. Only show verified provider counts; never estimate. */
(()=>{'use strict';
const target=document.getElementById('us-visitor-count');if(!target)return;
const pad=n=>String(n).padStart(2,'0');
async function update(){
  const now=new Date();
  const kst=new Date(now.getTime()+9*3600000);
  const day=kst.getUTCFullYear()+'-'+pad(kst.getUTCMonth()+1)+'-'+pad(kst.getUTCDate());
  const start=new Date(day+'T00:00:00+09:00').toISOString();
  const end=new Date(new Date(day+'T00:00:00+09:00').getTime()+86400000).toISOString();
  const url='https://moneytracker.goatcounter.com/counter/TOTAL.json?start='+encodeURIComponent(start)+'&end='+encodeURIComponent(end);
  try{
    const r=await fetch(url,{cache:'no-store',mode:'cors'});if(!r.ok)throw Error('counter unavailable');
    const data=await r.json();if(!data||!/^\d[\d,]*$/.test(String(data.count||'')))throw Error('invalid count');
    target.textContent=Number(String(data.count).replace(/,/g,'')).toLocaleString('ko-KR');
    target.title='GoatCounter 기준 오늘 방문 집계 (한국시간). 제공사 캐시로 지연될 수 있음';
  }catch(e){target.textContent='집계 비공개';target.title='GoatCounter 공개 방문 카운터를 사용할 수 없습니다. 사이트 설정에서 공개 카운터를 허용해야 합니다.';}
}
update();document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
})();
