(()=>{'use strict';
const country=document.body.dataset.page==='us'?'us':'national';
const isUS=country==='us';
const steps=[
{selector:'#pg .pg-map',title:'01 · 지도 움직이기',desc:'지도를 손가락으로 밀어 보세요. 두 손가락으로 확대·축소할 수 있어요.'},
{selector:'#pg .pg-bar [data-w="mp"]',title:'02 · 의원 살펴보기',desc:'의원 버튼을 눌러 공개 기록을 찾아보세요.'},
{selector:'#pg .pg-bar [data-w="radar"]',title:'03 · 레이더',desc:'레이더 버튼을 눌러 활동을 탐색해 보세요.'},
{selector:'#pg .pg-bar [data-w="rank"]',title:'04 · 순위',desc:'순위 버튼에서 공개 지표를 확인해 보세요.'},
{selector:'#pg .pg-bar [data-w="'+(isUS?'trades':'trip')+'"]',title:isUS?'05 · 주식 거래':'05 · 국외활동',desc:isUS?'의원들의 신고된 주식 거래를 확인할 수 있어요. 모바일에서는 전체 메뉴를 이용하세요.':'국회의원의 국외활동 관련 공개 자료를 찾아보세요.'},
{selector:'#pg .pg-file',title:'06 · 의원 기록',desc:'지도에서 의원을 선택하면 상세 기록을 볼 수 있어요. 닫기 또는 지도로 돌아가기로 복귀하세요.'}
];
const style=document.createElement('style');style.textContent=`
.mt-train-launch{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));right:94px;z-index:2500;min-height:40px;padding:0 13px;border-radius:11px;border:1px solid #69cc89;background:#123b25;color:#d5ffe1;font:800 13px system-ui;cursor:pointer}
.mt-train-card{position:fixed;z-index:3100;left:50%;top:44%;transform:translate(-50%,-50%);width:min(calc(100vw - 30px),360px);background:#091d12;border:1px solid #7ee9a2;border-radius:18px;padding:20px;color:#effff3;box-shadow:0 12px 50px #000d;font-family:system-ui}
.mt-train-card[hidden]{display:none!important}.mt-train-card h2{font-size:18px;margin:10px 0}.mt-train-card p{font-size:14px;line-height:1.65;color:#c0ddca}.mt-train-card .progress{font-size:12px;color:#87e9a7}.mt-train-actions{display:flex;gap:8px;margin-top:17px}.mt-train-actions button{flex:1;min-height:44px;border-radius:10px;border:1px solid #397c52;background:#183a26;color:#edfff1;font-weight:800}.mt-train-actions button.primary{background:#7bed9f;color:#06200f}.mt-train-target{outline:3px solid #87ffa9!important;outline-offset:3px!important;box-shadow:0 0 0 7px #6aff9738!important}
@media(max-width:600px){.mt-train-launch{position:fixed;top:auto;bottom:calc(151px + env(safe-area-inset-bottom,0px));right:12px;z-index:1200;padding:0 12px;min-height:43px}.mt-train-card{top:auto;bottom:calc(155px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);padding:14px 16px}.mt-train-card h2{font-size:16px;margin:6px 0}.mt-train-card p{font-size:13px;margin:6px 0}.mt-train-actions{margin-top:10px}body.mt-training .mt-train-launch{display:none!important}}
`;document.head.append(style);
const launch=document.createElement('button');launch.className='mt-train-launch';launch.type='button';launch.textContent='? 훈련';launch.setAttribute('aria-label','조작 훈련 시작');document.body.append(launch);
const card=document.createElement('section');card.className='mt-train-card';card.hidden=true;card.setAttribute('role','dialog');card.setAttribute('aria-modal','false');card.setAttribute('aria-label','조작 훈련');
card.innerHTML='<div class="progress"></div><h2></h2><p></p><div class="mt-train-actions"><button type="button" data-act="exit">종료</button><button type="button" data-act="prev">이전</button><button type="button" class="primary" data-act="next">다음 →</button></div>';document.body.append(card);
let index=0,highlight=null;
function clear(){if(highlight)highlight.classList.remove('mt-train-target');highlight=null}
function stop(){clear();card.hidden=true;document.body.classList.remove('mt-training');launch.focus()}
function render(){clear();const s=steps[index];card.querySelector('.progress').textContent='TRAINING MODE · '+(index+1)+' / '+steps.length;card.querySelector('h2').textContent=s.title;card.querySelector('p').textContent=s.desc;card.querySelector('[data-act="prev"]').disabled=index===0;card.querySelector('[data-act="next"]').textContent=index===steps.length-1?'훈련 완료 ✓':'다음 →';const t=document.querySelector(s.selector);if(t&&t.getBoundingClientRect().width>0){highlight=t;t.classList.add('mt-train-target')} }
launch.addEventListener('click',()=>{index=0;card.hidden=false;document.body.classList.add('mt-training');render()});
card.addEventListener('click',e=>{const a=e.target.closest('[data-act]')?.dataset.act;if(a==='exit')stop();if(a==='prev'&&index>0){index--;render()}if(a==='next'){if(index===steps.length-1)stop();else{index++;render()}}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!card.hidden)stop()});
})();
