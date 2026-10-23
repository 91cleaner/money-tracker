// 계약명 속 지번·건물번호를 가린다(동·리 이름은 남김). 모든 data/*.json 응답에 적용.
(()=>{const M=s=>typeof s!=='string'?s:s
 .replace(/\s?(산\s?)?\d+(-\d+)?\s?번지\s?(선|일원|일대|외)?/g,m=>/외$/.test(m)?' 외':/일원|일대/.test(m)?' 일원':' ')
 .replace(/(^|[\s(가-힣])(산\s?)?\d+(-\d+)?\s?(일원|일대)/g,'$1 일원')
 .replace(/([가-힣](?:동|리))\s?(산\s?)?\d+(-\d+)?(?=[\s,()·\]]|외|일원|주변|$)/g,'$1')
 .replace(/([로길])\s?\d+(-\d+)?(?=[\s,()·]|$)/g,'$1')
 .replace(/(^|[\s(])(산\s?)?\d{1,5}-\d{1,5}(?=[\s,()·]|$)/g,'$1')
 .replace(/\s{2,}/g,' ').replace(/\s+([,)\]])/g,'$1').trim();
window.maskT=M;const K=new Set(['title','t','detail']);
const walk=o=>{if(Array.isArray(o))o.forEach(walk);else if(o&&typeof o==='object')for(const k in o){if(K.has(k)&&typeof o[k]==='string')o[k]=M(o[k]);else if(typeof o[k]==='object')walk(o[k]);}return o;};
const J=Response.prototype.json;Response.prototype.json=function(){const u=this.url||'';return J.call(this).then(d=>/\/data\//.test(u)?walk(d):d);};})();
