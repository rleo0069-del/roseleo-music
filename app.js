(()=>{
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));
// starfield
const cv=$('#stars'),cx=cv.getContext('2d');let st=[];
function rs(){cv.width=innerWidth*devicePixelRatio;cv.height=innerHeight*devicePixelRatio;st=Array.from({length:Math.min(250,innerWidth/4)},()=>({x:Math.random()*cv.width,y:Math.random()*cv.height,r:Math.random()*1.2*devicePixelRatio+.2,p:Math.random()*6.28,s:.003+Math.random()*.01,v:.01+Math.random()*.04}));if(still)dr()}
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;let raf=0;
function dr(){raf=0;cx.clearRect(0,0,cv.width,cv.height);cx.fillStyle='#fff';for(const s of st){if(!still){s.p+=s.s;s.y+=s.v;if(s.y>cv.height)s.y=0}cx.globalAlpha=.3+.5*Math.abs(Math.sin(s.p));cx.beginPath();cx.arc(s.x,s.y,s.r,0,6.28);cx.fill()}if(!still&&!document.hidden)raf=requestAnimationFrame(dr)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!still&&!raf)raf=requestAnimationFrame(dr)});
addEventListener('resize',rs);rs();dr();
// state
let songs=[],view=[],cur=-1,tag=null,yt=null,ytReady=false,ytTimer;
const audio=$('#audio'),fmt=t=>isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'0:00';
const ytId=u=>{if(!u)return'';const m=String(u).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);return m?m[1]:(/^[\w-]{11}$/.test(u)?u:'')};
const mode=s=>s.audio?'audio':ytId(s.youtube)?'youtube':'link';
fetch('data/songs.json').then(r=>r.json()).then(d=>{songs=d.map(s=>({...s,tags:s.tags||(s.mood?[].concat(s.mood):[])}));tagsUI();render()}).catch(e=>{$('#grid').textContent='Could not load songs.';console.error(e)});
function tagsUI(){const all=[...new Set(songs.flatMap(s=>s.tags))].sort();const w=$('#tags');w.innerHTML='';
 [null,...all].forEach(t=>{const b=document.createElement('button');b.textContent=t||'All';b.setAttribute('aria-pressed',t===tag);b.onclick=()=>{tag=t;tagsUI();render()};w.appendChild(b)})}
$('#search').addEventListener('input',render);
function render(){const q=$('#search').value.trim().toLowerCase();
 view=songs.filter(s=>(!tag||s.tags.includes(tag))&&(!q||[s.title,s.artist,s.lyrics,...s.tags].join(' ').toLowerCase().includes(q)));
 $('#count').textContent=view.length+' of '+songs.length+' songs';
 $('#grid').innerHTML=view.map((s,i)=>{const m=mode(s),y=ytId(s.youtube);const img=s.cover||(y?`https://i.ytimg.com/vi/${y}/hqdefault.jpg`:'');
 return `<article class="card${songs.indexOf(s)===cur?' playing':''}" data-i="${i}"><div class="cover">${esc(s.title).slice(0,2)}${img?`<img src="${esc(img)}" alt="" loading="lazy">`:''}
 ${m==='link'?'':`<button class="pbtn" data-play="${i}" aria-label="Play ${esc(s.title)}">▶</button>`}</div>
 <div class="body"><h3>${esc(s.title)}</h3><div class="meta">${esc(s.artist||'')}${s.duration?' · '+esc(s.duration):''}${s.date?' · '+esc(s.date):''}</div>
 <div class="row">${m==='link'&&s.source?`<a class="btn" href="${esc(s.source)}" target="_blank" rel="noopener">Listen ↗</a>`:''}
 ${s.source&&m!=='link'?`<a class="btn" href="${esc(s.source)}" target="_blank" rel="noopener">Source ↗</a>`:''}
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
})();
