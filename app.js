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
fetch('data/songs.json').then(r=>r.json()).then(d=>{songs=d.map(s=>({...s,tags:s.tags||(s.mood?[].concat(s.mood):[])}));tagsUI();render();sideUI();goHash()}).catch(e=>{$('#grid').textContent='Could not load songs.';console.error(e)});
function tagsUI(){const all=[...new Set(songs.flatMap(s=>s.tags))].sort();const w=$('#tags');w.innerHTML='';
 [null,...all].forEach(t=>{const b=document.createElement('button');b.textContent=t||'All';b.setAttribute('aria-pressed',t===tag);b.onclick=()=>{tag=t;tagsUI();render()};w.appendChild(b)})}
$('#search').addEventListener('input',render);
function render(){const q=$('#search').value.trim().toLowerCase();
 view=songs.filter(s=>(!tag||s.tags.includes(tag))&&(!q||[s.title,s.artist,s.lyrics,...s.tags].join(' ').toLowerCase().includes(q)));
 $('#count').textContent=view.length+' of '+songs.length+' songs';
 $('#grid').innerHTML=view.map((s,i)=>{const m=mode(s),y=ytId(s.youtube);const img=s.cover||(y?`https://i.ytimg.com/vi/${y}/hqdefault.jpg`:'');
 return `<article class="card${songs.indexOf(s)===cur?' playing':''}" data-i="${i}" id="song-${esc(s.id)}"><div class="cover">${esc(s.title).slice(0,2)}${img?`<img src="${esc(img)}" alt="" loading="lazy">`:''}
 ${m==='link'?'':`<button class="pbtn" data-play="${i}" aria-label="Play ${esc(s.title)}">▶</button>`}</div>
 <div class="body"><h3>${esc(s.title)}</h3><div class="meta">${esc(s.artist||'')}${s.duration?' · '+esc(s.duration):''}${s.date?' · '+esc(s.date):''}</div>
 <div class="row">${m==='link'&&s.source?`<a class="btn" href="${esc(s.source)}" target="_blank" rel="noopener">Listen ↗</a>`:''}
 ${s.lyrics?`<button data-ly="${i}" aria-expanded="false">Lyrics</button>`:''}</div>
 ${s.lyrics?`<div class="lyrics" id="ly${i}" hidden>${esc(s.lyrics)}</div>`:''}</div></article>`}).join('')}
$('#grid').addEventListener('click',e=>{const p=e.target.closest('[data-play]'),l=e.target.closest('[data-ly]');
 if(p){const s=view[+p.dataset.play],i=songs.indexOf(s);i===cur?toggle():load(i,true)}
 if(l){const d=$('#ly'+l.dataset.ly),o=d.hidden;d.hidden=!o;l.setAttribute('aria-expanded',o)}});
function playable(){return songs.map((s,i)=>i).filter(i=>mode(songs[i])!=='link')}
function stopAll(){audio.pause();if(yt&&ytReady&&yt.stopVideo)yt.stopVideo();clearInterval(ytTimer)}
function load(i,go){stopAll();cur=i;const s=songs[i];$('#pTitle').textContent=s.title;$('#pArtist').textContent=s.artist||'';
 const y=ytId(s.youtube),img=s.cover||(y?`https://i.ytimg.com/vi/${y}/default.jpg`:'');const pc=$('#pCover');pc.hidden=!img;if(img)pc.src=img;
 $('#ytWrap').classList.toggle('on',mode(s)==='youtube');
 if(mode(s)==='audio'){audio.src=s.audio;audio.volume=+$('#vol').value;if(go)audio.play().catch(()=>{})}
 else withYT(()=>{yt.setVolume($('#vol').value*100);go?yt.loadVideoById(y):yt.cueVideoById(y);ytTimer=setInterval(ytTick,500)});
 render();setBtn(go)}
function withYT(cb){if(ytReady)return cb();window._ytq=cb;if(!window.YT){const t=document.createElement('script');t.src='https://www.youtube.com/iframe_api';document.head.appendChild(t)}}
window.onYouTubeIframeAPIReady=()=>{yt=new YT.Player('yt',{width:120,height:68,playerVars:{playsinline:1,controls:0},events:{onReady:()=>{ytReady=true;window._ytq&&window._ytq()},
 onStateChange:e=>{setBtn(e.data===1);if(e.data===0)step(1)}}})};
function ytTick(){if(!ytReady||mode(songs[cur])!=='youtube')return;const d=yt.getDuration(),t=yt.getCurrentTime();$('#cur').textContent=fmt(t);$('#dur').textContent=fmt(d);if(d)$('#seek').value=t/d*100}
function isPlaying(){if(cur<0)return false;return mode(songs[cur])==='audio'?!audio.paused:(ytReady&&yt.getPlayerState&&yt.getPlayerState()===1)}
function toggle(){if(cur<0){const p=playable();if(p.length)load(p[0],true);return}
 if(mode(songs[cur])==='audio'){audio.paused?audio.play():audio.pause()}else if(ytReady){isPlaying()?yt.pauseVideo():yt.playVideo()}}
function step(d){const p=playable();if(!p.length)return;let k=p.indexOf(cur);k=(k+d+p.length)%p.length;load(p[k],true)}
function setBtn(on){$('#play').textContent=on?'⏸':'▶';$('#play').setAttribute('aria-label',on?'Pause':'Play');document.querySelectorAll('.card.playing .pbtn').forEach(b=>b.textContent=on?'⏸':'▶')}
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
function sideUI(){$('#sCount').textContent='('+songs.length+')';$('#sList').innerHTML=songs.map((s,i)=>{const u=extUrl(s);return `<li><a href="${u?esc(u):'#song-'+esc(s.id)}"${u?' target="_blank" rel="noopener"':` data-si="${i}"`}>${esc(s.title)}</a></li>`}).join('')}
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
})();
