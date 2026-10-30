/* Anonymous, aggregate product events. No cookies, IDs, searches, or user text sent by us. */
(()=>{'use strict';
const allowed={'national.html':'korea_entry','usa-command.html':'usa_entry','intel-lab.html':'research_lab_entry','contracts.html':'local_contracts_entry'};
document.addEventListener('click',event=>{
 const a=event.target.closest?.('a[href]');if(!a)return;
 let pathname;try{pathname=new URL(a.href,location.href).pathname.split('/').pop()}catch{return}
 const key=allowed[pathname];if(!key)return;
 try{window.goatcounter?.count?.({path:'/events/'+key,title:'미국주식추적단 / '+key,event:true})}catch{}
});
})();
