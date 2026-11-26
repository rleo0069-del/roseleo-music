// enhancements.js
(function(){
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));

  let playlists = [];
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
    // Wait until songs exist so we can resolve titles
    const tryDraw = () => {
      if (!window.songs && document.querySelectorAll('#grid .card').length === 0) {
        setTimeout(tryDraw, 200);
        return;
      }
      el.innerHTML = '<h3>Start here</h3>' + START_IDS.map(id => {
        const card = document.querySelector(`[data-slug="${id}"], [data-sid="${id}"]`);
        const title = card ? (card.querySelector('h3')?.textContent || id) : id;
        return `<button class="startcard" data-play-song="${esc(id)}">${esc(title)}</button>`;
      }).join('');
    };
    tryDraw();
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
    const pb = e.target.closest('[data-pl]');
    if (!pb) return;
    const id = pb.dataset.pl;
    const pl = id ? playlists.find(p => p.id === id) : null;
    if (pl && pl.songs && pl.songs.length) {
      // Create a temporary button the existing player already understands
      const tmp = document.createElement('button');
      tmp.setAttribute('data-play-song', pl.songs[0]);
      tmp.style.display = 'none';
      document.body.appendChild(tmp);
      tmp.click();
      tmp.remove();
    }
  });

  fetch('data/playlists.json').then(r => r.json()).then(d => {
    playlists = d;
    drawPlaylists();
  }).catch(()=>{});

  // Draw start-here after a short delay so songs are rendered
  setTimeout(drawStartHere, 800);
})();
