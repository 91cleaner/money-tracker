(()=>{'use strict';
const us=document.body.dataset.page==='us';
const steps=[
 {key:'map',title:'지도 이동',desc:'지도 빈 곳을 손가락으로 밀거나 확대·축소해 보세요.',selector:'#pg .pg-map',event:'pointerup'},
 {key:'mp',title:'의원 찾기',desc:'아래 「의원」 버튼을 직접 눌러 보세요.',selector:'#pg .pg-bar [data-w="mp"]',event:'click'},
 {key:'radar',title:'레이더 사용',desc:'「레이더」 버튼을 직접 눌러 보세요.',selector:'#pg .pg-bar [data-w="radar"]',event:'click'},
 {key:'rank',title:'순위 보기',desc:'「순위」 버튼을 직접 눌러 보세요.',selector:'#pg .pg-bar [data-w="rank"]',event:'click'},
 {key:'random',title:'의원 추적',desc:'주사위 버튼을 눌러 임의의 의원을 선택해 보세요. 상세정보가 열리면 지도로 돌아갈 수 있어요.',selector:'#pg .pg-dice',event:'click'}
];
const css=document.createElement('style');css.textContent=`
.mt-train-launch{position:fixed;right:12px;bottom:calc(154px + env(safe-area-inset-bottom,0px));z-index:1200;min-width:68px;min-height:43px;padding:0 12px;border:1px solid #66ca86;border-radius:11px;background:#123a23;color:#e2ffec;font:800 13px system-ui;cursor:pointer}
.mt-train-card{position:fixed;z-index:3100;left:50%;top:50%;transform:translate(-50%,-50%);width:min(360px,calc(100vw - 24px));border:1px solid #76e79b;border-radius:16px;background:#071d11;color:#eaffef;padding:18px;box-shadow:0 12px 40px #000d;font-family:system-ui}
.mt-train-card[hidden],.mt-train-launch[hidden]{display:none!important}
.mt-train-card h2{font-size:18px;margin:8px 0}.mt-train-card p{font-size:14px;line-height:1.55;margin:8px 0;color:#c5e2ce}
.mt-train-card .progress,.mt-train-card .status{color:#89eeb0;font-size:12px}
.mt-train-actions{display:flex;gap:8px;margin-top:12px}.mt-train-actions button{flex:1;min-height:44px;border:1px solid #39784f;border-radius:10px;background:#163924;color:#effff3;font-weight:800}.mt-train-actions .primary{background:#78eb9f;color:#07200f}
.mt-train-target{outline:3px solid #a0ffc0!important;outline-offset:3px!important;box-shadow:0 0 0 6px #67fa9c3c!important}
@media(max-width:600px){.mt-train-card{top:calc(var(--mt-room-header,145px) + 12px);bottom:auto;transform:translateX(-50%);padding:13px 15px}.mt-train-card h2{font-size:16px;margin:5px 0}.mt-train-card p{font-size:13px;margin:5px 0}.mt-train-actions{margin-top:8px}.mt-train-launch{bottom:calc(150px + env(safe-area-inset-bottom,0px))}body.mt-training .mt-train-launch{display:none!important}}
`;document.head.append(css);
const launch=document.createElement('button');launch.className='mt-train-launch';launch.type='button';launch.textContent='? 훈련';document.body.append(launch);
const card=document.createElement('section');card.className='mt-train-card';card.hidden=true;card.setAttribute('role','dialog');card.setAttribute('aria-label','조작 훈련');
card.innerHTML='<div class="progress"></div><h2></h2><p></p><div class="status" aria-live="polite"></div><div class="mt-train-actions"><button data-act="exit">종료</button><button data-act="skip">건너뛰기</button><button class="primary" data-act="next" disabled>직접 조작해 주세요</button></div>';document.body.append(card);
let index=0,done=false,highlight=null,off=null,started=null;
const getTarget=()=>document.querySelector(steps[index].selector);
function clear(){if(off){off();off=null}if(highlight){highlight.classList.remove('mt-train-target');highlight=null}}
function finish(){clear();card.hidden=true;document.body.classList.remove('mt-training');launch.hidden=false}
function complete(){if(done)return;done=true;card.querySelector('.status').textContent='✓ 조작 성공! 다음 단계로 진행하세요.';const next=card.querySelector('[data-act="next"]');next.disabled=false;next.textContent=index===steps.length-1?'훈련 완료 ✓':'다음 단계 →'}
function render(){clear();done=false;const step=steps[index];card.querySelector('.progress').textContent='TRAINING · '+(index+1)+' / '+steps.length;card.querySelector('h2').textContent=step.title;card.querySelector('p').textContent=step.desc;card.querySelector('.status').textContent='초록색으로 표시된 곳을 직접 조작하세요.';const next=card.querySelector('[data-act="next"]');next.disabled=true;next.textContent='직접 조작해 주세요';const target=getTarget();if(!target||target.getBoundingClientRect().width===0){card.querySelector('.status').textContent='현재 화면에서 버튼을 찾을 수 없어요. 건너뛰기를 누르세요.';return}highlight=target;target.classList.add('mt-train-target');const handler=e=>{if(step.key==='map'&&e.target.closest('button,a,.leaflet-control'))return;complete()};target.addEventListener(step.event,handler,true);off=()=>target.removeEventListener(step.event,handler,true)}
launch.addEventListener('click',()=>{index=0;launch.hidden=true;card.hidden=false;document.body.classList.add('mt-training');render()});
card.addEventListener('click',e=>{const act=e.target.closest('[data-act]')?.dataset.act;if(!act)return;if(act==='exit'){finish();return}if(act==='skip'||act==='next'&&done){if(index===steps.length-1){finish();return}index++;render()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!card.hidden)finish()});
})();
