// enhancements.js
(function(){
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));

  let activeGenre = null, playlists = [], currentPlaylist = null;
  const START_IDS = ['bubbling-under-my-frontal-lobes','it-was-the-smartest-and-dumbest-of-times','k3','a-storm-of-tesla-cybercabs','code-the-coder'];

  function findSongIndex(id) {
    if (!window.songs) return -1;
    return window.songs.findIndex(s => s.id === id || s.slug === id);
  }

  function playById(id) {
    const i = findSongIndex(id);
    if (i >= 0 && typeof window.load === 'function') {
      window.load(i, true);
      return true;
    }
    return false;
  }

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
      return `<button class="startcard" data-start="${esc(s.slug||s.id)}">${esc(s.title)}</button>`;
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
      if (typeof window.render === 'function') window.render();
      document.querySelectorAll('#grid .card').forEach(card => {
        const sid = card.dataset.sid || card.dataset.id;
        const s = (window.songs || []).find(x => String(x.id) === sid || x.slug === sid);
        if (!activeGenre || (s && (s.genre === activeGenre || s.genre2 === activeGenre))) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
      return;
    }

    const sb = e.target.closest('[data-start]');
    if (sb) {
      playById(sb.dataset.start);
      return;
    }

    const pb = e.target.closest('[data-pl]');
    if (pb) {
      const id = pb.dataset.pl;
      currentPlaylist = id ? playlists.find(p => p.id === id) : null;
      if (currentPlaylist && currentPlaylist.songs && currentPlaylist.songs.length) {
        playById(currentPlaylist.songs[0]);
      } else if (!currentPlaylist && typeof window.load === 'function') {
        if (typeof window.playable === 'function') {
          const p = window.playable();
          if (p.length) window.load(p[0], true);
        }
      }
    }
  });

  fetch('data/playlists.json').then(r => r.json()).then(d => {
    playlists = d;
    drawPlaylists();
  }).catch(()=>{});

  const check = setInterval(() => {
    if (window.songs && window.songs.length) {
      clearInterval(check);
      tagsUI();
      drawStartHere();
    }
  }, 300);
})();
