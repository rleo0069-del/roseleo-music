/* Global visit counter: Abacus (abacus.jasoncameron.dev), key roseleo-music/visits.
   Shared by all visitors. One /hit per browser session, otherwise /get. Shown as 1000 + server count.
   If the service fails: last server value seen (marked ≈) or "—". */
(function(){var B='https://abacus.jasoncameron.dev/',P='roseleo-music/visits',OFF=1000,K='rl_hit',L='rl_hit_last';
function el(i){return document.getElementById(i)}
function show(v,stale){var n=el('hitn'),h=el('hits');if(!n)return;n.textContent=v==null?'—':(stale?'≈':'')+(v+OFF).toLocaleString();n.title=stale?'Last known global count (counter offline)':'Global visits, all visitors';if(h)h.hidden=false}
function get(u,t){return fetch(u,{cache:'no-store'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){if(!d||typeof d.value!=='number')throw 0;return d.value}).catch(function(e){if(t>0)return new Promise(function(r){setTimeout(r,1500)}).then(function(){return get(B+'get/'+P,t-1)});throw e})}
var s=null;try{s=sessionStorage.getItem(K)}catch(e){}
get(B+(s?'get/':'hit/')+P,1).then(function(v){try{sessionStorage.setItem(K,'1');localStorage.setItem(L,v)}catch(e){}show(v,false)}).catch(function(){var l=null;try{l=localStorage.getItem(L)}catch(e){}show(l==null?null:+l,true)})})();
