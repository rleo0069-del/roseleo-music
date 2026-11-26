// enhancements.js
(function(){
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));

  // Real waveform
  let audioCtx, analyser, sourceNode, freqData;
  function initAnalyser() {
    if (audioCtx || !window.audio) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      sourceNode = audioCtx.createMediaElementSource(window.audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      const tag = document.querySelector('.chart .tag');
      if (tag) tag.textContent = 'LIVE';
    } catch(e) {}
  }

  // Genre filters + Start here + Playlists
  let activeGenre = null, playlists = [], currentPlaylist = null;
  const START_IDS = ['bubbling-under-my-frontal-lobes','it-was-the-smartest-and-dumbest-of-times','k3','a-storm-of-tesla-cybercabs','code-the-coder'];

  function tagsUI() {
    const w = $('#tags');
    if (!w || !window.songs) return;
    w.hidden = false;
    const genres = [...new Set(window.songs.map(s => s.genre).filter(Boolean))].sort();
    w.innerHTML = `<button data-genre="" aria-pressed="${!activeGenre}">All</button>` +
      genres.map(g => `<button data-genre="${esc(g)}" aria-pressed="${activeGenre===g}">${esc(g)}</button>`).join('');
  }

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
      const s = (window.songs || []).find(x => x.id === id || x.slug === id);
      if (!s) return '';
      return `<button class="startcard" data-play-song="${esc(s.slug||s.id)}">${s.title}</button>`;
    }).join('');
  }

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
    const gb = e.target.closest('#tags [data-genre]');
    if (gb) {
      activeGenre = gb.dataset.genre || null;
      tagsUI();
      if (window.render) window.render();
      return;
    }
    const pb = e.target.closest('[data-pl]');
    if (pb) {
      const id = pb.dataset.pl;
      currentPlaylist = id ? playlists.find(p => p.id === id) : null;
      const p = typeof window.playable === 'function' ? window.playable() : [];
      if (p.length && typeof window.load === 'function') window.load(p[0], true);
    }
  });

  fetch('data/playlists.json').then(r => r.json()).then(d => {
    playlists = d;
    drawPlaylists();
  }).catch(()=>{});

  // Wait for songs then init
  const check = setInterval(() => {
    if (window.songs && window.songs.length) {
      clearInterval(check);
      tagsUI();
      drawStartHere();
    }
  }, 300);
})();
