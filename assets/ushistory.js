/* Historical congressional transactions — public disclosures, not investment advice. */
(async function(){
 const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 try {
  const [tr,mem]=await Promise.all(['trades.json','members.json'].map(n=>fetch('data/us/'+n,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})));
  const names=Object.fromEntries((mem.members||[]).map(m=>[m.id,m.name]));
  const all=(tr.trades||[]).filter(t=>t.d).sort((a,b)=>b.d.localeCompare(a.d));
  const years=[...new Set(all.map(t=>t.d.slice(0,4)))].sort().reverse();
  $('year').insertAdjacentHTML('beforeend',years.map(y=>'<option>'+esc(y)+'</option>').join(''));
  function render(){
   const q=$('q').value.trim().toLowerCase(),year=$('year').value,side=$('side').value;
   const rows=all.filter(t=>(!year||t.d.startsWith(year))&&(!side||t.ty===side)&&(!q||[names[t.id],t.who,t.tk,t.asset].some(v=>String(v||'').toLowerCase().includes(q))));
   $('count').textContent=rows.length.toLocaleString()+' matching trades · '+all.length.toLocaleString()+' total records · showing up to 500';
   $('rows').innerHTML=rows.slice(0,500).map(t=>{
    const lag=t.filed&&t.d?Math.round((Date.parse(t.filed)-Date.parse(t.d))/86400000):null;
    const source=typeof t.doc==='string'&&/^https:\/\/(disclosures-clerk\.house\.gov|efdsearch\.senate\.gov)\//.test(t.doc)?'<a href="'+esc(t.doc)+'" target="_blank" rel="noopener noreferrer">Filing</a>':'—';
    return '<tr><td>'+esc(names[t.id]||t.who||'Unknown')+'</td><td><strong>'+esc(t.tk||'—')+'</strong><br><small>'+esc(t.asset||'')+'</small></td><td class="'+(t.ty==='P'?'buy':'sell')+'">'+esc(t.ty==='P'?'BUY':t.ty==='S'?'SELL':t.ty||'—')+'</td><td>'+esc(t.d)+'</td><td>'+esc(t.filed||'—')+'</td><td>'+esc(lag==null?'—':lag+' days')+'</td><td>'+esc(t.amt||'—')+'</td><td>'+source+'</td></tr>';
   }).join('')||'<tr><td colspan="8">No matching records</td></tr>';
  }
  ['q','year','side'].forEach(id=>$(id).addEventListener(id==='q'?'input':'change',render));render();
 }catch(e){$('count').textContent='Could not load disclosure data. Please try again later.';console.error(e);}
})();