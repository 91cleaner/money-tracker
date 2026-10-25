(()=>{'use strict';
const us=document.body.dataset.page==='us';
const steps=[
{title:'지도 움직이기',desc:'지도를 확대해 미국 의원들의 위치를 살펴봅니다.',kind:'zoom'},
{title:'의원 보기',desc:'의원 버튼을 눌러 지도에 의원들을 표시합니다.',tool:'mp'},
{title:'레이더',desc:'레이더 기능을 직접 열어 봅니다.',tool:'radar'},
{title:'순위',desc:'의원 순위 기능을 직접 열어 봅니다.',tool:'rank'},
{title:'의원 추적',desc:'주사위로 의원 한 명을 선택하고 기록을 엽니다.',kind:'dice'}
];
const style=document.createElement('style');style.textContent=`
.mt-train-launch{position:fixed;z-index:1350;left:12px;bottom:calc(156px + env(safe-area-inset-bottom,0px));min-height:42px;border:1px solid #69d28d;border-radius:12px;background:#103924;color:#e5ffeb;font:800 13px system-ui;padding:0 14px}
.mt-train-launch[hidden],.mt-train-card[hidden]{display:none!important}
.mt-train-card{position:fixed;z-index:3200;top:50%;left:50%;transform:translate(-50%,-50%);width:min(360px,calc(100vw - 28px));border:1px solid #8ceba8;border-radius:16px;padding:17px;background:#092014;color:#effff4;box-shadow:0 10px 40px #000c;font-family:system-ui}
.mt-train-card .step{font-size:12px;color:#8deca8}.mt-train-card h2{font-size:18px;margin:8px 0}.mt-train-card p{font-size:14px;line-height:1.55;color:#c7e1d0;margin:8px 0}.mt-train-actions{display:flex;gap:8px;margin-top:13px}.mt-train-actions button{min-height:44px;border-radius:10px;border:1px solid #3b8153;background:#153a24;color:#e9ffef;font-weight:800;flex:1}.mt-train-actions .primary{background:#8deba8;color:#082113;flex:1.6}
@media(max-width:600px){.mt-train-card{top:calc(var(--mt-room-header,145px) + 14px);transform:translateX(-50%);padding:14px}.mt-train-card h2{font-size:16px;margin:6px 0}.mt-train-card p{font-size:13px;margin:6px 0}.mt-train-launch{bottom:calc(155px + env(safe-area-inset-bottom,0px));left:12px;right:auto}}
`;document.head.append(style);
const launch=document.createElement('button');launch.type='button';launch.className='mt-train-launch';launch.textContent='? 훈련';document.body.append(launch);
const card=document.createElement('section');card.className='mt-train-card';card.hidden=true;card.setAttribute('role','dialog');card.setAttribute('aria-label','조작 훈련');
card.innerHTML='<div class="step"></div><h2></h2><p></p><div class="mt-train-actions"><button type="button" data-act="exit">종료</button><button type="button" data-act="skip">건너뛰기</button><button type="button" class="primary" data-act="do">실행해 보기 →</button></div>';document.body.append(card);
let index=0;
function backToMap(){if(!us)return;document.body.dataset.mtMobileTab='map';const root=document.getElementById('pg');if(root?.classList.contains('member-selected'))root.querySelector('.mt-return-map')?.click();document.querySelector('.mt-mobile-menu .mt-menu-close')?.click();window.scrollTo({top:0,behavior:'instant'});}
function draw(){const step=steps[index];card.querySelector('.step').textContent='TRAINING · '+(index+1)+' / '+steps.length;card.querySelector('h2').textContent=step.title;card.querySelector('p').textContent=step.desc;card.querySelector('[data-act="do"]').textContent=index===steps.length-1?'의원 추적 실행':'실행해 보기 →';}
function finish(){card.hidden=true;launch.hidden=false;document.body.classList.remove('mt-training')}
function next(){if(index===steps.length-1){finish();return}index++;backToMap();draw()}
function run(){const step=steps[index];backToMap();if(step.tool){const target=document.querySelector('#pg .pg-bar [data-w="'+step.tool+'"]');if(target)target.click();else{card.querySelector('p').textContent='이 기능을 찾을 수 없습니다. 건너뛰기로 진행해 주세요.';return}}else if(step.kind==='zoom'){const z=document.querySelector('#pg .leaflet-control-zoom-in');if(z)z.click();else document.querySelector('#pg .pg-map')?.dispatchEvent(new Event('resize'));}else if(step.kind==='dice'){const dice=document.querySelector('#pg .pg-dice');if(dice)dice.click();else{card.querySelector('p').textContent='주사위 버튼을 찾을 수 없습니다.';return}}if(step.kind==='dice'){finish();return}card.querySelector('p').textContent='✓ 기능을 실행했어요. 다음 단계로 이동합니다.';setTimeout(()=>{if(!card.hidden)next()},750)}
launch.addEventListener('click',()=>{index=0;backToMap();launch.hidden=true;card.hidden=false;document.body.classList.add('mt-training');draw()});
card.addEventListener('click',e=>{const act=e.target.closest('[data-act]')?.dataset.act;if(act==='exit')finish();else if(act==='skip')next();else if(act==='do')run()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!card.hidden)finish()});
})();
