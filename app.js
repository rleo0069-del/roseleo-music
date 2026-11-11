(()=>{
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));
// starfield
const cv=$('#stars'),cx=cv.getContext('2d');let st=[];
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;let raf=0,lt=0;
const L=[{n:90,r:.7,v:.004,a:.55},{n:60,r:1.1,v:.009,a:.7},{n:30,r:1.6,v:.016,a:.85}];
function rs(){const d=devicePixelRatio||1;cv.width=innerWidth*d;cv.height=innerHeight*d;const k=Math.min(1,innerWidth/1200)*.5+.5;st=[];
 L.forEach(l=>{for(let i=0;i<Math.round(l.n*k);i++)st.push({x:Math.random()*cv.width,y:Math.random()*cv.height,r:(l.r+Math.random()*.4)*d,a:l.a,v:l.v*d,dx:l.v*.35*d,p:Math.random()*6.28,s:.0006+Math.random()*.0022})});if(still)dr(0)}
function dr(t){raf=0;const dt=lt?Math.min(t-lt,50):16;lt=t;cx.clearRect(0,0,cv.width,cv.height);cx.fillStyle='#fff';
 for(const s of st){if(!still){s.p+=s.s*dt;s.y+=s.v*dt;s.x+=s.dx*dt;if(s.y>cv.height)s.y-=cv.height;if(s.x>cv.width)s.x-=cv.width}
  cx.globalAlpha=s.a*(still?.7:.35+.65*Math.abs(Math.sin(s.p)));cx.beginPath();cx.arc(s.x,s.y,s.r,0,6.28);cx.fill()}
 if(!still&&!document.hidden)raf=requestAnimationFrame(dr)}
document.addEventListener('visibilitychange',()=>{lt=0;if(!document.hidden&&!still&&!raf)raf=requestAnimationFrame(dr)});
addEventListener('resize',rs);rs();if(!still)raf=requestAnimationFrame(dr);
// state
let songs=[],view=[],cur=-1,tag=null,yt=null,ytReady=false,ytTimer;
const audio=$('#audio'),fmt=t=>isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'0:00';
const ytId=u=>{if(!u)return'';const m=String(u).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);return m?m[1]:(/^[\w-]{11}$/.test(u)?u:'')};
const mode=s=>s.audio?'audio':ytId(s.youtube)?'youtube':'link';
fetch('data/songs.json').then(r=>r.json()).then(d=>{songs=d.map(s=>({...s,tags:s.tags||(s.mood?[].concat(s.mood):[])}));tagsUI();render();sideUI();chartBind();goHash();dashInit()}).catch(e=>{$('#grid').textContent='Could not load songs.';console.error(e)});
function tagsUI(){const all=[...new Set(songs.flatMap(s=>s.tags))].sort();const w=$('#tags');w.innerHTML='';
 [null,...all].forEach(t=>{const b=document.createElement('button');b.textContent=t||'All';b.setAttribute('aria-pressed',t===tag);b.onclick=()=>{tag=t;tagsUI();render()};w.appendChild(b)})}
$('#search').addEventListener('input',render);
const SECS=[['music','#grid'],['books','#gridBooks'],['children','#gridChildren'],['games','#gridGames']],secOf=s=>SECS.some(x=>x[0]===s.section)?s.section:'music',rank=s=>SECS.findIndex(x=>x[0]===secOf(s));
function render(){const q=$('#search').value.trim().toLowerCase();
 view=songs.map((s,i)=>[s,i]).sort((a,b)=>rank(a[0])-rank(b[0])||a[0].title.localeCompare(b[0].title,undefined,{sensitivity:'base'})||a[1]-b[1]).map(x=>x[0]).filter(s=>(!tag||s.tags.includes(tag))&&(!q||[s.title,s.artist,s.lyrics,...s.tags].join(' ').toLowerCase().includes(q)));
 $('#count').textContent=view.length+' of '+songs.length+' songs';
 const html=view.map((s,i)=>{const m=mode(s),y=ytId(s.youtube);const img=s.cover||(y?`https://i.ytimg.com/vi/${y}/hqdefault.jpg`:'');
 return `<article class="card${songs.indexOf(s)===cur?' playing':''}" data-i="${i}" id="song-${esc(s.id)}"><div class="cover">${esc(s.title).slice(0,2)}${img?`<img src="${esc(img)}" alt="" loading="lazy">`:''}
 ${m==='link'?'':`<button class="pbtn" data-play="${i}" aria-label="Play ${esc(s.title)}">▶</button>`}</div>
 <div class="body"><h3>${esc(s.title)}</h3><div class="meta">${esc(s.artist||'')}${s.duration?' · '+esc(s.duration):''}${s.date?' · '+esc(s.date):''}</div>
 <div class="row">${m==='link'&&s.source?`<a class="btn" href="${esc(s.source)}" target="_blank" rel="noopener">${secOf(s)==='books'?'View':'Open'} ↗</a>`:''}${s.article?`<a class="btn" href="${esc(s.article)}">Read the Grokapedia entry</a>`:''}
 ${s.lyrics?`<button data-ly="${i}" aria-expanded="false">Lyrics</button>`:''}</div>
 ${s.lyrics?`<div class="lyrics" id="ly${i}" hidden>${esc(s.lyrics)}</div>`:''}</div></article>`});
 SECS.forEach(([k,g])=>{const h=view.map((s,i)=>secOf(s)===k?html[i]:'').join('');$(g).innerHTML=h;if(k!=='music')$(g).parentElement.hidden=!h})}
SECS.forEach(([,g])=>$(g).addEventListener('click',e=>{const p=e.target.closest('[data-play]'),l=e.target.closest('[data-ly]');
 if(p){const s=view[+p.dataset.play],i=songs.indexOf(s);i===cur?toggle():load(i,true)}
 if(l){const d=$('#ly'+l.dataset.ly),o=d.hidden;d.hidden=!o;l.setAttribute('aria-expanded',o)}}));
function playable(){return songs.map((s,i)=>i).sort((a,b)=>rank(songs[a])-rank(songs[b])||songs[a].title.localeCompare(songs[b].title,undefined,{sensitivity:'base'})||a-b).filter(i=>mode(songs[i])!=='link')}
function stopAll(){audio.pause();if(yt&&ytReady&&yt.stopVideo)yt.stopVideo();clearInterval(ytTimer)}
function load(i,go){stopAll();cur=i;chartActive();const s=songs[i];dashTrack(s,go);$('#pTitle').textContent=s.title;$('#pArtist').textContent=s.artist||'';
 const y=ytId(s.youtube),img=s.cover||(y?`https://i.ytimg.com/vi/${y}/default.jpg`:'');const pc=$('#pCover');pc.hidden=!img;if(img)pc.src=img;
 $('#ytWrap').classList.toggle('on',mode(s)==='youtube');
 if(mode(s)==='audio'){audio.src=s.audio;audio.volume=+$('#vol').value;if(go)audio.play().catch(()=>{})}
 else withYT(()=>{yt.setVolume($('#vol').value*100);go?yt.loadVideoById(y):yt.cueVideoById(y);ytTimer=setInterval(ytTick,500)});
 render();setBtn(go)}
function withYT(cb){if(ytReady)return cb();window._ytq=cb;if(!window.YT){const t=document.createElement('script');t.src='https://www.youtube.com/iframe_api';document.head.appendChild(t)}}
window.onYouTubeIframeAPIReady=()=>{yt=new YT.Player('yt',{width:240,height:136,playerVars:{playsinline:1,controls:0},events:{onReady:()=>{ytReady=true;window._ytq&&window._ytq()},
 onStateChange:e=>{setBtn(e.data===1);if(e.data===0)step(1)}}})};
function ytTick(){if(!ytReady||mode(songs[cur])!=='youtube')return;const d=yt.getDuration(),t=yt.getCurrentTime();$('#cur').textContent=fmt(t);$('#dur').textContent=fmt(d);if(d)$('#seek').value=t/d*100}
function isPlaying(){if(cur<0)return false;return mode(songs[cur])==='audio'?!audio.paused:(ytReady&&yt.getPlayerState&&yt.getPlayerState()===1)}
function toggle(){if(cur<0){const p=playable();if(p.length)load(p[0],true);return}
 if(mode(songs[cur])==='audio'){audio.paused?audio.play():audio.pause()}else if(ytReady){isPlaying()?yt.pauseVideo():yt.playVideo()}}
function step(d){const p=playable();if(!p.length)return;let k=p.indexOf(cur);k=(k+d+p.length)%p.length;load(p[k],true)}
function setBtn(on){dashPlay(on);$('#play').textContent=on?'⏸':'▶';$('#play').setAttribute('aria-label',on?'Pause':'Play');document.querySelectorAll('.card.playing .pbtn').forEach(b=>b.textContent=on?'⏸':'▶')}
$('#play').onclick=toggle;$('#prev').onclick=()=>step(-1);$('#next').onclick=()=>step(1);
audio.onplay=()=>setBtn(true);audio.onpause=()=>setBtn(false);audio.onended=()=>step(1);
audio.ontimeupdate=()=>{$('#cur').textContent=fmt(audio.currentTime);$('#dur').textContent=fmt(audio.duration);if(audio.duration)$('#seek').value=audio.currentTime/audio.duration*100};
$('#seek').oninput=e=>{if(cur<0)return;const f=e.target.value/100;if(mode(songs[cur])==='audio'){if(audio.duration)audio.currentTime=f*audio.duration}else if(ytReady)yt.seekTo(f*yt.getDuration(),true)};
$('#vol').oninput=e=>{audio.volume=+e.target.value;if(ytReady)yt.setVolume(e.target.value*100)};
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|BUTTON|A/.test(e.target.tagName)){e.preventDefault();toggle()}});

// top: date + news
$('#today').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'});
fetch('data/news.json').then(r=>r.json()).then(n=>{$('#news').innerHTML=n.map(x=>`<li>${x.link?`<a href="${esc(x.link)}"${/^https?:/.test(x.link)?' target="_blank" rel="noopener"':''}>${esc(x.text)}</a>`:esc(x.text)}</li>`).join('')}).catch(()=>{$('.news').hidden=true});
// sidebar

function chartBind(){const root=$('#musicChart');if(!root||root.dataset.bound)return;root.dataset.bound='1';
 root.addEventListener('click',e=>{const li=e.target.closest('.rk[data-sid]');if(!li||!root.contains(li))return;const i=songs.findIndex(s=>String(s.id)===li.dataset.sid);if(i<0)return;if(mode(songs[i])==='link')return;i===cur?toggle():load(i,true)});
 root.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const li=e.target.closest('.rk[data-sid]');if(!li||!root.contains(li))return;e.preventDefault();li.click()})}
function chartActive(){document.querySelectorAll('#musicChart .rk.on').forEach(el=>el.classList.remove('on'));if(cur<0||!songs[cur])return;const el=document.querySelector('#musicChart .rk[data-sid="'+CSS.escape(String(songs[cur].id))+'"]');if(el)el.classList.add('on')}

function sideUI(){$('#sCount').textContent='('+songs.length+')';$('#sList').innerHTML=songs.map((s,i)=>[s,i]).sort((a,b)=>a[0].title.localeCompare(b[0].title,undefined,{sensitivity:'base'})||a[1]-b[1]).map(([s,i])=>{const u=extUrl(s);return `<li><a href="${u?esc(u):'#song-'+esc(s.id)}"${u?' target="_blank" rel="noopener"':` data-si="${i}"`}>${esc(s.title)}</a></li>`}).join('')}
function extUrl(s){const y=ytId(s.youtube);return s.source||(y?'https://www.youtube.com/watch?v='+y:'')}
function focusSong(i,go){const s=songs[i];if(!s)return;
 if(!view.includes(s)){$('#search').value='';tag=null;tagsUI();render()}
 if(mode(s)!=='link')load(i,go);const el=document.getElementById('song-'+s.id);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1600)}}
function goHash(){const m=location.hash.match(/^#song-(.+)$/);if(!m||!songs.length)return;let id=m[1];try{id=decodeURIComponent(id)}catch(e){}
 const i=songs.findIndex(s=>String(s.id)===id);if(i>=0)focusSong(i,false)}
addEventListener('hashchange',goHash);
$('#sFilter').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();$('#sList').querySelectorAll('li').forEach(li=>li.hidden=q&&!li.textContent.toLowerCase().includes(q))});
$('#sList').addEventListener('click',e=>{const l=e.target.closest('[data-si]');if(!l)return;e.preventDefault();focusSong(+l.dataset.si,true);
 if(matchMedia('(max-width:900px)').matches){$('#sideB').classList.remove('open');$('#sideT').setAttribute('aria-expanded','false')}});
$('#sideT').onclick=()=>{const o=$('#sideB').classList.toggle('open');$('#sideT').setAttribute('aria-expanded',o)};
// dashboard
const LS='rl_plays';let plays=0,playing=false,energy=0;try{plays=+localStorage.getItem(LS)||0}catch(e){}
function dashInit(){$('#songN').textContent=songs.length;$('#secTot').textContent=songs.length;
 const n={music:0,books:0,children:0,games:0};songs.forEach(s=>n[secOf(s)]++);
 document.querySelectorAll('[data-sc]').forEach(b=>b.textContent=n[b.dataset.sc]);
 const nm={music:'Music',books:'Books and things',children:'Children’s Music',games:'Games / Extras songs'};
 $('#secList').innerHTML=Object.keys(n).map(k=>`<li><a href="#${k==='games'?'extras':k}"><i></i>${nm[k]}</a><span class="bar"><span style="width:${Math.round(n[k]/songs.length*100)}%"></span></span><b>${n[k]}</b></li>`).join('');
 $('#latest').innerHTML=songs.slice(0,5).map(s=>{const u=extUrl(s);return `<li><a href="${u?esc(u):'#song-'+esc(s.id)}"${u?' target="_blank" rel="noopener"':''}>${esc(s.title)}</a>${s.date?` <small>${esc(s.date)}</small>`:''}</li>`}).join('');
 showStats()}
function showStats(){$('#plays').textContent=plays.toLocaleString();let l='';try{l=localStorage.getItem('rl_last')||''}catch(e){}$('#lastPlayed').textContent=l||'—'}
function dashTrack(s,go){const y=ytId(s.youtube),img=s.cover||(y?`https://i.ytimg.com/vi/${y}/mqdefault.jpg`:'');
 document.querySelectorAll('.ncov').forEach(im=>{if(img){im.src=img;im.hidden=false}else im.hidden=true});
 $('#fTitle').textContent=s.title;$('#fArtist').textContent=s.artist?'· '+s.artist:'';$('#vTitle').textContent=s.title;
 if(go){plays++;try{localStorage.setItem(LS,plays);localStorage.setItem('rl_last',s.title)}catch(e){}showStats()}}
function dashPlay(on){playing=!!on;$('#fPlayI').textContent=on?'⏸':'▶';$('#fPlay').setAttribute('aria-label',on?'Pause':'Play');
 $('#stText').textContent=on?'playing':(cur<0?'idle':'paused');$('#gState').textContent=on?'LIVE':(cur<0?'IDLE':'PAUSED');document.body.classList.toggle('isplaying',playing);if(on&&!vraf)vraf=requestAnimationFrame(viz)}
$('#fPlay').onclick=()=>toggle();$('#fPrev').onclick=()=>step(-1);$('#fNext').onclick=()=>step(1);
function dateTick(){const d=new Date(),p=n=>String(n).padStart(2,'0');$('#bigDate').textContent=p(d.getMonth()+1)+'/'+p(d.getDate())+'/'+d.getFullYear()}
dateTick();setInterval(dateTick,30000);
const vc=$('#viz'),vx=vc.getContext('2d'),arc=$('#gArc'),C=2*Math.PI*50,dj=$('#dj');let vraf=0,ph=0;arc.style.strokeDasharray=C;arc.style.strokeDashoffset=C;
function vsize(){const d=devicePixelRatio||1,r=vc.getBoundingClientRect();vc.width=Math.max(1,r.width*d);vc.height=Math.max(1,r.height*d)}
addEventListener('resize',vsize);vsize();
function viz(t){vraf=0;const w=vc.width,h=vc.height;if(!w||!h){vsize()}
 const tgt=playing?.55+.45*Math.abs(Math.sin(t/240))*(.6+.4*Math.sin(t/1700)):0;energy+=(tgt-energy)*.12;ph+=playing&&!still?.08:0;
 vx.clearRect(0,0,w,h);const g=vx.createLinearGradient(0,0,w,0);g.addColorStop(0,'#38bdf8');g.addColorStop(.5,'#a78bfa');g.addColorStop(1,'#f472b6');
 vx.lineWidth=2*(devicePixelRatio||1);vx.strokeStyle=g;vx.shadowColor='#38bdf8';vx.shadowBlur=8;
 for(let k=0;k<2;k++){vx.globalAlpha=k?.35:1;vx.beginPath();for(let x=0;x<=w;x+=4){const u=x/w,a=(still?.25:energy)*h*.38*(k?.6:1);
  const y=h/2+a*Math.sin(u*18+ph*(k?1.3:1))*Math.sin(u*3.1+ph*.2)+a*.35*Math.sin(u*47-ph*2);x?vx.lineTo(x,y):vx.moveTo(x,y)}vx.stroke()}
 vx.globalAlpha=1;vx.shadowBlur=0;
 const pct=+$('#seek').value||0;arc.style.strokeDashoffset=C*(1-pct/100);$('#gPct').textContent=Math.round(pct)+'%';$('#flowTime').textContent=$('#cur').textContent;
 $('#eNum').textContent=Math.round(energy*100)+'%';
 if(!still){dj.style.setProperty('--e',energy.toFixed(3));dj.classList.toggle('glitch',playing&&Math.random()<.04)}
 if((playing||energy>.01)&&!document.hidden)vraf=requestAnimationFrame(viz)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&playing&&!vraf)vraf=requestAnimationFrame(viz)});
vraf=requestAnimationFrame(viz);
})();

(()=>{const w=document.getElementById('ytWrap'),g=w&&w.querySelector('.ytgrip');if(!g)return;let sx,sy,ox,oy,d=false;
const mv=e=>{if(!d)return;const p=e.touches?e.touches[0]:e;let x=ox+p.clientX-sx,y=oy+p.clientY-sy;x=Math.max(0,Math.min(innerWidth-w.offsetWidth,x));y=Math.max(0,Math.min(innerHeight-w.offsetHeight,y));w.style.left=x+'px';w.style.top=y+'px';w.style.right='auto';w.style.bottom='auto';e.preventDefault()};
const up=()=>{d=false;w.classList.remove('dragging')};
const dn=e=>{const p=e.touches?e.touches[0]:e,r=w.getBoundingClientRect();sx=p.clientX;sy=p.clientY;ox=r.left;oy=r.top;d=true;w.classList.add('dragging');e.preventDefault()};
g.addEventListener('mousedown',dn);g.addEventListener('touchstart',dn,{passive:false});addEventListener('mousemove',mv);addEventListener('touchmove',mv,{passive:false});addEventListener('mouseup',up);addEventListener('touchend',up)})();
