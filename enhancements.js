// enhancements.js — drops in after app.js
(function(){
  if (typeof songs === 'undefined') return;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));

  // 1. Real waveform for MP3s
  let audioCtx, analyser, sourceNode, freqData;
  function initAnalyser() {
    if (audioCtx || !audio) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      sourceNode = audioCtx.createMediaElementSource(audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      document.querySelector('.chart .tag').textContent = 'LIVE';
    } catch(e) { console.warn('Analyser unavailable', e); }
  }
  const origLoad = window.load;
  if (origLoad) {
    window.load = function(i, go) {
      origLoad(i, go);
      if (songs[i] && mode(songs[i]) === 'audio') initAnalyser();
    };
  }

  // Override viz if present (hook into existing loop)
  const origViz = window.viz;
  if (origViz && typeof vx !== 'undefined') {
    window.viz = function(t) {
      if (analyser && playing && cur >= 0 && mode(songs[cur]) === 'audio') {
        analyser.getByteFrequencyData(freqData);
        // draw bars using freqData while keeping style
        const w = vc.width, h = vc.height;
        vx.clearRect(0,0,w,h);
        const barW = w / freqData.length;
        const g = vx.createLinearGradient(0,0,0,h);
        g.addColorStop(0,'#3b82f6'); g.addColorStop(0.5,'#d4af37'); g.addColorStop(1,'#3b82f6');
        vx.fillStyle = g;
        for (let i = 0; i < freqData.length; i++) {
          const barH = (freqData[i] / 255) * h * 0.9;
          vx.fillRect(i * barW, h - barH, barW - 1, barH);
        }
        return;
      }
      return origViz(t);
    };
  }

  // 2. Genre filters
  let activeGenre = null;
  function tagsUI() {
    const w = $('#tags');
    if (!w || !songs.length) return;
    w.hidden = false;
    const genres = [...new Set(songs.map(s => s.genre).filter(Boolean))].sort();
    w.innerHTML = `<button data-genre="" aria-pressed="${!activeGenre}">All</button>` +
      genres.map(g => `<button data-genre="${esc(g)}" aria-pressed="${activeGenre===g}" style="--chip:${GCOL[g]||'#94a3b8'}">${esc(g)}</button>`).join('');
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('#tags [data-genre]');
    if (!b) return;
    activeGenre = b.dataset.genre || null;
    tagsUI();
    if (window.render) window.render();
  });

  // Patch render filter
  const origRender = window.render;
  if (origRender) {
    window.render = function() {
      // temporary override of view filter by monkey-patching after
      origRender();
      if (activeGenre) {
        // re-filter visible cards (simple approach)
        document.querySelectorAll('#grid .card').forEach(card => {
          const sid = card.dataset.sid;
          const s = songs.find(x => String(x.id) === sid);
          if (s && s.genre !== activeGenre && s.genre2 !== activeGenre) card.style.display = 'none';
          else card.style.display = '';
        });
      }
    };
  }

  // 3. Start here
  const START_IDS = ['bubbling-under-my-frontal-lobes','it-was-the-smartest-and-dumbest-of-times','k3','a-storm-of-tesla-cybercabs','code-the-coder'];
  function drawStartHere() {
    let el = $('#startHere');
    if (!el) {
      el = document.createElement('div');
      el.id = 'startHere';
      el.className = 'starthere';
      const controls = document.querySelector('.controls');
      if (controls) controls.parentNode.insertBefore(el, controls);
    }
    el.innerHTML = '<h3>Start here</h3>' + START_IDS.map(id => {
      const s = songs.find(x => x.id === id || x.slug === id);
      if (!s) return '';
      return `<button class="startcard" data-play-song="${esc(s.slug||s.id)}">${titleHTML ? titleHTML(s) : esc(s.title)}</button>`;
    }).join('');
  }

  // 4. Playlists
  let playlists = [], currentPlaylist = null;
  fetch('data/playlists.json').then(r => r.json()).then(d => {
    playlists = d;
    drawPlaylists();
  }).catch(()=>{});

  function drawPlaylists() {
    let el = $('#playlists');
    if (!el) {
      el = document.createElement('div');
      el.id = 'playlists';
      el.className = 'playlists';
      const tags = $('#tags');
      if (tags) tags.parentNode.insertBefore(el, tags);
    }
    el.innerHTML = '<span>Playlists:</span> ' + playlists.map(p =>
      `<button data-pl="${esc(p.id)}">${esc(p.title)}</button>`
    ).join(' ') + ' <button data-pl="">Catalog</button>';
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pl]');
    if (!b) return;
    const id = b.dataset.pl;
    currentPlaylist = id ? playlists.find(p => p.id === id) : null;
    const p = typeof playable === 'function' ? playable() : [];
    if (p.length && typeof load === 'function') load(p[0], true);
  });

  // Patch playable
  const origPlayable = window.playable;
  if (origPlayable) {
    window.playable = function() {
      if (currentPlaylist) {
        return (currentPlaylist.songs || []).map(id => songs.findIndex(s => s.id === id || s.slug === id)).filter(i => i >= 0 && mode(songs[i]) !== 'link');
      }
      let list = origPlayable();
      if (activeGenre) list = list.filter(i => songs[i].genre === activeGenre || songs[i].genre2 === activeGenre);
      return list;
    };
  }

  // Init after songs load
  const check = setInterval(() => {
    if (songs && songs.length) {
      clearInterval(check);
      tagsUI();
      drawStartHere();
    }
  }, 200);
})();
