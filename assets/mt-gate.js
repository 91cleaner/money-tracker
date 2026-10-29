/* Prep-stage passcode gate. Not real security (static site). Disable: SITE_GATE=False in scripts/prepare-public-pages.py */
(function(){
  var H='71842b9599812988aa68fb22fbf131e5e75fde554ef854f9011bfd7d56305388', K='mt_gate_ok';
  try{ if(localStorage.getItem(K)===H) return; }catch(e){}
  var st=document.createElement('style');
  st.textContent='html.mt-locked body{visibility:hidden!important}#mtGate{position:fixed;inset:0;z-index:2147483647;background:#05070c;color:#e8eef8;display:flex;align-items:center;justify-content:center;font:16px system-ui,sans-serif;visibility:visible}#mtGate form{display:flex;flex-direction:column;gap:12px;width:min(320px,86vw)}#mtGate input,#mtGate button{padding:12px;border-radius:8px;border:1px solid #2a3550;background:#0d1320;color:inherit;font:inherit}#mtGate button{background:#f59e0b;color:#111;border:0;cursor:pointer}#mtGate .e{color:#f87171;min-height:1.2em;font-size:14px}';
  document.documentElement.appendChild(st);
  document.documentElement.classList.add('mt-locked');
  function sha(s){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(function(b){return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')})}
  function show(){
    if(document.getElementById('mtGate')) return;
    var d=document.createElement('div'); d.id='mtGate';
    d.innerHTML='<form><strong>Private preview</strong><input type="password" autocomplete="current-password" placeholder="Passcode" aria-label="Passcode"><button type="submit">Enter</button><div class="e"></div></form>';
    document.documentElement.appendChild(d);
    var f=d.querySelector('form'), i=d.querySelector('input'), e=d.querySelector('.e'); i.focus();
    f.addEventListener('submit',function(ev){ev.preventDefault();sha(i.value.trim()).then(function(h){
      if(h===H){try{localStorage.setItem(K,H)}catch(x){} d.remove(); document.documentElement.classList.remove('mt-locked');}
      else{e.textContent='Wrong passcode'; i.value='';}
    });});
  }
  if(document.body) show(); else document.addEventListener('DOMContentLoaded',show);
})();
