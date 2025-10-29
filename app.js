const FADE_MS = 2000;

// === Selectores ===
const notesEl = document.getElementById('notes');
const saveNotesBtn = document.getElementById('saveNotes');
const clearNotesBtn = document.getElementById('clearNotes');

const imagesInput = document.getElementById('imagesInput');
const thumbs = document.getElementById('thumbs');
const openViewerBtn = document.getElementById('openViewer');
const clearImagesBtn = document.getElementById('clearImages');
const foldersList = document.getElementById('foldersList');

const ytUrlInput = document.getElementById('ytUrl');
const ytNameInput = document.getElementById('ytName');
const addTrackBtn = document.getElementById('addTrack');
const saveTracksBtn = document.getElementById('saveTracks');
const clearTracksBtn = document.getElementById('clearTracks');
const tracksList = document.getElementById('tracksList');

const groupNameInput = document.getElementById('groupName');
const createGroupBtn = document.getElementById('createGroup');
const saveGroupsBtn = document.getElementById('saveGroupsBtn');
const groupsListEl = document.getElementById('groupsList');

const addEnemyBtn = document.getElementById('addEnemy');
const clearEnemiesBtn = document.getElementById('clearEnemies');
const enemyList = document.getElementById('enemyList');
const enemyNameInput = document.getElementById('enemyName');
const enemyHPInput = document.getElementById('enemyHP');
const enemyACInput = document.getElementById('enemyAC');
const enemySpeedInput = document.getElementById('enemySpeed');

// === Keys de almacenamiento ===
const NOTES_KEY = 'dm_notes_v1';
const TRACKS_KEY = 'dm_tracks_v1';
const GROUPS_KEY = 'dm_groups_v1';
const ENEMIES_KEY = 'dm_enemies_v1';

// === Estado ===
let images = [];
let imageTree = { name: 'root', folders: {}, images: [] };
let currentPath = [];
let groups = [];
let tracks = [];
let players = [];
let enemies = [];
let viewerWindow = null;
let YTready = false;

// === API YouTube ===
window.onYouTubeIframeAPIReady = () => { YTready = true; initAllPlayers(); };

// === Utilidades ===
const escapeHtml = s => String(s).replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

const fileToDataURL = file => new Promise(res => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.readAsDataURL(file);
});

const extractYouTubeID = url => {
  try {
    const u = new URL(url.trim());
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const parts = u.pathname.split('/');
    return parts.pop() || parts.pop();
  } catch {
    const r = url.match(/(youtu\.be\/|v=|\/embed\/|\/v\/)([A-Za-z0-9_-]{6,})/);
    return r ? r[2] : null;
  }
};

const getCurrentYTVolumeSafe = p => { try { return p.getVolume(); } catch { return 100; } };

const fadeYTVolume = (p, from, to, dur) => new Promise(res => {
  const steps = Math.max(6, Math.round(dur / 50));
  const delta = (to - from) / steps;
  let cur = from, i = 0;
  const id = setInterval(() => {
    i++;
    cur += delta;
    const v = Math.max(0, Math.min(100, Math.round(cur)));
    try { p.setVolume(v); } catch { }
    if (i >= steps) { clearInterval(id); try { p.setVolume(to); } catch { }; res(); }
  }, Math.round(dur / steps));
});

// === Tabs ===
document.querySelectorAll('.tab-header').forEach(h => {
  h.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const container = btn.closest('.left-col, .right-col');
      const tab = btn.dataset.tab;
      container.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.music-section, .left-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tab).classList.add('active');
    });
  });
});

// === Notas ===
const loadNotes = () => { const t = localStorage.getItem(NOTES_KEY); if (t) notesEl.value = t; };
const saveNotes = () => localStorage.setItem(NOTES_KEY, notesEl.value);
saveNotesBtn.addEventListener('click', saveNotes);
clearNotesBtn.addEventListener('click', () => {
  if (confirm('¿Borrar notas?')) { notesEl.value = ''; saveNotes(); }
});
loadNotes();

// === Imágenes ===
imagesInput.addEventListener('change', async e => {
  const fileList = Array.from(e.target.files || []);
  const imgs = fileList
    .filter(f => f.type && f.type.startsWith('image/'))
    .map(f => {
      let rel = f.webkitRelativePath || f.name;
      if (!rel.includes('/') && imagesInput?.files?.length > 1) {
        const folder = (f.name.split('_')[0] || 'Sin carpeta');
        rel = `${folder}/${f.name}`;
      }
      return { file: f, rel };
    })
    .sort((a, b) => a.rel.localeCompare(b.rel, undefined, { numeric: true, sensitivity: 'base' }));

  const results = await Promise.all(imgs.map(async it => ({
    name: it.file.name,
    dataUrl: await fileToDataURL(it.file),
    relativePath: it.rel
  })));

  images = results;
  buildImageTree();
  renderFolderTree();
  renderThumbs();
});

function buildImageTree() {
  imageTree = { name: 'root', folders: {}, images: [] };
  for (const img of images) {
    const parts = img.relativePath.split('/');
    let node = imageTree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      if (isFile) {
        node.images.push(img);
      } else {
        node.folders[part] = node.folders[part] || { name: part, folders: {}, images: [] };
        node = node.folders[part];
      }
    }
  }
}

function renderFolderTree() {
  foldersList.innerHTML = '';
  const renderNode = (node, path = []) => {
    const div = document.createElement('div');
    div.className = 'folder';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'folder-name';
    nameDiv.textContent = node.name === 'root' ? '📁 Raíz' : node.name;
    div.appendChild(nameDiv);

    nameDiv.addEventListener('click', () => {
      if (node.name !== 'root') div.classList.toggle('open');
      currentPath = path;
      renderThumbs();
      foldersList.querySelectorAll('.folder').forEach(f => f.classList.remove('active'));
      div.classList.add('active');
    });

    const contentsDiv = document.createElement('div');
    contentsDiv.className = 'folder-contents';
    for (const key in node.folders) {
      const child = renderNode(node.folders[key], [...path, key]);
      contentsDiv.appendChild(child);
    }
    div.appendChild(contentsDiv);
    return div;
  };
  foldersList.appendChild(renderNode(imageTree));
  if (Object.keys(imageTree.folders).length === 0) {
    foldersList.innerHTML = '<div class="folder active"><div class="folder-name">📁 Raíz (sin subcarpetas)</div></div>';
  }
}

function getNodeAtPath(path) {
  let node = imageTree;
  for (const p of path) {
    if (!node.folders[p]) return node;
    node = node.folders[p];
  }
  return node;
}

function renderThumbs() {
  thumbs.innerHTML = '';
  const node = getNodeAtPath(currentPath);
  node.images.forEach((it, i) => {
    const t = document.createElement('div');
    t.className = 'thumb';
    const img = document.createElement('img');
    img.src = it.dataUrl;
    t.append(img);
    t.title = it.relativePath || it.name;
    t.addEventListener('click', () => {
      sendViewer({ type: 'showImage', index: i, data: it });
      window._dm_current = i;
    });
    thumbs.appendChild(t);
  });
}

openViewerBtn.addEventListener('click', () => {
  if (viewerWindow && !viewerWindow.closed) return viewerWindow.focus();
  viewerWindow = window.open('', 'dm_viewer', 'width=1200,height=700');
  viewerWindow.document.write(`
    <!doctype html><html><head><meta charset="utf-8">
    <style>
      body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh}
      img{max-width:100%;max-height:100%}
    </style></head><body><div id="stage"></div>
    <script>
      window.addEventListener('message', e=>{
        const d=e.data;if(!d)return;
        if(d.type==='showImage'){
          const s=document.getElementById('stage');
          s.innerHTML='';
          const i=document.createElement('img');
          i.src=d.data.dataUrl;
          s.appendChild(i);
        }
      });
      window.opener&&window.opener.postMessage({type:'viewerReady'}, '*');
    <\/script></body></html>`);
});

const sendViewer = msg => {
  if (!viewerWindow || viewerWindow.closed)
    return alert('Abre primero la pantalla de jugadores.');
  viewerWindow.postMessage(msg, '*');
};

clearImagesBtn.addEventListener('click', () => {
  if (confirm('¿Limpiar todas las imágenes?')) {
    images = [];
    thumbs.innerHTML = '';
    foldersList.innerHTML = '';
    imagesInput.value = '';
    sendViewer({ type: 'clear' });
  }
});

// === Enemigos ===
const loadEnemies = () => {
  const raw = localStorage.getItem(ENEMIES_KEY);
  if (!raw) return;
  try { enemies = JSON.parse(raw) || []; } catch { enemies = []; }
  renderEnemies();
};
const saveEnemies = () => localStorage.setItem(ENEMIES_KEY, JSON.stringify(enemies));

addEnemyBtn.addEventListener('click', () => {
  const name = enemyNameInput.value.trim();
  const hp = Number(enemyHPInput.value);
  const ac = Number(enemyACInput.value);
  const speed = Number(enemySpeedInput.value);
  if (!name || !hp) return alert('Introduce al menos nombre y HP.');
  enemies.push({ id: Date.now(), name, hp, ac, speed, current: hp });
  renderEnemies(); saveEnemies();
  [enemyNameInput, enemyHPInput, enemyACInput, enemySpeedInput].forEach(i => i.value = '');
});

clearEnemiesBtn.addEventListener('click', () => {
  if (confirm('¿Eliminar todos los enemigos?')) {
    enemies = [];
    saveEnemies();
    renderEnemies();
  }
});

function renderEnemies() {
  enemyList.innerHTML = '';
  enemies.forEach(e => {
    const div = document.createElement('div');
    div.className = 'enemy-card';
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>${escapeHtml(e.name)}</strong>
        <div>
          <button data-id="${e.id}" class="damage small">Daño</button>
          <button data-id="${e.id}" class="heal small">Curar</button>
          <button data-id="${e.id}" class="remove small secondary">X</button>
        </div>
      </div>
      <div style="font-size:0.9rem;color:rgba(255,255,255,0.8)">AC ${e.ac || '-'} · Vel ${e.speed || '-'}</div>
      <div class="hp-bar"><div class="hp-fill" style="width:${(e.current / e.hp) * 100}%"></div></div>
      <div>${e.current}/${e.hp} HP</div>`;
    enemyList.appendChild(div);
  });

  enemyList.querySelectorAll('.damage').forEach(b => b.onclick = () => adjustHP(b.dataset.id, -1));
  enemyList.querySelectorAll('.heal').forEach(b => b.onclick = () => adjustHP(b.dataset.id, 1));
  enemyList.querySelectorAll('.remove').forEach(b => b.onclick = () => {
    enemies = enemies.filter(x => x.id != b.dataset.id);
    saveEnemies();
    renderEnemies();
  });
}

function adjustHP(id, mod) {
  const e = enemies.find(x => x.id == id);
  if (!e) return;
  const val = prompt(mod > 0 ? '¿Cuánto sana?' : '¿Cuánto daño recibe?');
  if (!val) return;
  const n = Number(val);
  if (isNaN(n)) return;
  e.current = mod > 0 ? Math.min(e.hp, e.current + n) : Math.max(0, e.current - n);
  saveEnemies();
  renderEnemies();
}
loadEnemies();

// === Música y grupos ===

// GROUPS (persist)
const loadGroups = ()=> {
  const raw = localStorage.getItem(GROUPS_KEY);
  if(!raw) return;
  try{ groups = JSON.parse(raw) || []; }catch{ groups=[]; }
  renderGroups();
};
const saveGroups = ()=> localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));

createGroupBtn.addEventListener('click', ()=> {
  const name = (groupNameInput.value||'').trim();
  if(!name) return alert('Pon un nombre al grupo.');
  const id = 'g'+Date.now();
  groups.push({ id, name, volume:100 });
  groupNameInput.value='';
  renderGroups(); saveGroups(); renderTracksList();
});
saveGroupsBtn?.addEventListener('click', ()=>{ saveGroups(); alert('Grupos guardados.'); });

function renderGroups(){
  groupsListEl.innerHTML = '';
  groups.forEach(g=>{
    const pill = document.createElement('div'); pill.className='group-pill';
    pill.innerHTML = `<strong>${escapeHtml(g.name)}</strong>`;
    const ctrls = document.createElement('div'); ctrls.className='group-controls';
    const vol = document.createElement('input'); vol.type='range'; vol.min=0; vol.max=100; vol.value=g.volume;
    const play = document.createElement('button'); play.textContent='Play';
    const pause = document.createElement('button'); pause.textContent='Pause';
    const stop = document.createElement('button'); stop.textContent='Stop';
    const del = document.createElement('button'); del.textContent='Eliminar'; del.className='secondary';
    ctrls.append(vol, play, pause, stop, del);
    pill.appendChild(ctrls);
    groupsListEl.appendChild(pill);

    vol.addEventListener('input', ()=> {
      g.volume = Number(vol.value); saveGroups(); applyGroupVolumes(g.id);
    });
    play.addEventListener('click', ()=> controlGroup(g.id, 'play'));
    pause.addEventListener('click', ()=> controlGroup(g.id, 'pause'));
    stop.addEventListener('click', ()=> controlGroup(g.id, 'stop'));
    del.addEventListener('click', ()=> {
      if(confirm(`Eliminar grupo "${g.name}" ?`)){
        groups = groups.filter(x=> x.id !== g.id);
        players.forEach(p=> p.data.groups = (p.data.groups||[]).filter(id=> id !== g.id));
        saveGroups(); renderGroups(); renderTracksList();
      }
    });
  });
}

// MUSIC TRACKS (persist + players)
const loadTracks = ()=> {
  const raw = localStorage.getItem(TRACKS_KEY);
  if(!raw) return;
  try{ tracks = JSON.parse(raw) || []; }catch{ tracks = []; }
  renderTracksList(); initAllPlayers();
};
const saveTracks = ()=> localStorage.setItem(TRACKS_KEY, JSON.stringify(tracks));

addTrackBtn.addEventListener('click', ()=> {
  const url = (ytUrlInput.value||'').trim();
  if(!url) return alert('Pega una URL de YouTube.');
  const id = extractYouTubeID(url);
  if(!id) return alert('No se pudo extraer ID de YouTube.');
  const name = (ytNameInput.value||'').trim() || ('Pista ' + (tracks.length+1));
  tracks.push({ videoId: id, name, volume: 80, loop:false, groups: [] });
  ytUrlInput.value=''; ytNameInput.value='';
  renderTracksList(); saveTracks(); initAllPlayers();
});
saveTracksBtn.addEventListener('click', ()=> { saveTracks(); saveGroups(); alert('Pistas y grupos guardados.'); });
clearTracksBtn.addEventListener('click', ()=> {
  if(confirm('¿Borrar todas las pistas?')){ tracks=[]; players.forEach(p=> { try{ p.player.destroy(); }catch{} }); players = []; saveTracks(); renderTracksList(); }
});

function renderTracksList(){
  tracksList.innerHTML = '';
  players = players.filter(x=> false); // clear players array (we'll re-init)
  tracks.forEach((t, index) => {
    const block = document.createElement('div'); block.className = 'track'; block.id = 'track_' + index;
    block.innerHTML = `
      <div class="meta"><div><strong>${escapeHtml(t.name)}</strong></div></div>
      <div id="player_${index}" class="yt-frame"></div>
      <div class="group-chips" id="chips_${index}"></div>
      <div class="controls">
        <div class="row">
          <button data-i="${index}" class="play">Play</button>
          <button data-i="${index}" class="pause">Pause</button>
          <button data-i="${index}" class="stop secondary">Stop</button>
          <button data-i="${index}" class="rm secondary">Eliminar</button>
        </div>
        <div class="row">
          <label>Vol <input type="range" min="0" max="100" value="${t.volume}" data-i="${index}" class="vol"></label>
          <label><input type="checkbox" data-i="${index}" class="loop" ${t.loop ? 'checked' : ''} /> Bucle</label>
        </div>
      </div>
    `;
    tracksList.appendChild(block);
    renderChipsForTrack(index);
  });

  // attach control listeners
  tracksList.querySelectorAll('.play').forEach(b => b.onclick = async e => {
    const i = Number(e.target.dataset.i); const p = players[i]?.player; if(!p) return;
    try { p.setVolume(0); p.playVideo(); await fadeYTVolume(p, 0, tracks[i].volume, FADE_MS); } catch {}
  });
  tracksList.querySelectorAll('.pause').forEach(b => b.onclick = async e => {
    const i = Number(e.target.dataset.i); const p = players[i]?.player; if(!p) return;
    try { await fadeYTVolume(p, getCurrentYTVolumeSafe(p), 0, FADE_MS); p.pauseVideo(); } catch {}
  });
  tracksList.querySelectorAll('.stop').forEach(b => b.onclick = async e => {
    const i = Number(e.target.dataset.i); const p = players[i]?.player; if(!p) return;
    try { await fadeYTVolume(p, getCurrentYTVolumeSafe(p), 0, FADE_MS); p.stopVideo(); } catch {}
  });
  tracksList.querySelectorAll('.rm').forEach(b => b.onclick = e => {
    const i = Number(e.target.dataset.i);
    if(confirm('Eliminar pista?')){ if(players[i]?.player) try{ players[i].player.destroy(); }catch{} tracks.splice(i,1); saveTracks(); renderTracksList(); initAllPlayers(); }
  });

  tracksList.querySelectorAll('.vol').forEach(r => r.addEventListener('input', e => {
    const i = Number(e.target.dataset.i); const v = Number(e.target.value); tracks[i].volume = v;
    const p = players[i]?.player; if(p) try{ p.setVolume(v); }catch{}
    saveTracks();
  }));
  tracksList.querySelectorAll('.loop').forEach(chk => chk.addEventListener('change', e => {
    const i = Number(e.target.dataset.i); tracks[i].loop = e.target.checked; saveTracks();
  }));
}

function renderChipsForTrack(index){
  const container = document.getElementById('chips_' + index);
  if(!container) return;
  container.innerHTML = '';
  const noneChip = document.createElement('div'); noneChip.className='chip ' + (tracks[index].groups.length === 0 ? 'active' : '');
  noneChip.textContent = '🟡 Ninguno';
  noneChip.addEventListener('click', ()=>{ tracks[index].groups = []; saveTracks(); renderChipsForTrack(index); });
  container.appendChild(noneChip);

  groups.forEach(g=>{
    const chip = document.createElement('div'); chip.className = 'chip' + (tracks[index].groups && tracks[index].groups.includes(g.id) ? ' active' : '');
    chip.textContent = g.name;
    chip.addEventListener('click', ()=>{
      const arr = tracks[index].groups || [];
      if(arr.includes(g.id)) tracks[index].groups = arr.filter(x=> x !== g.id);
      else tracks[index].groups = [...arr, g.id];
      saveTracks(); renderChipsForTrack(index);
    });
    container.appendChild(chip);
  });
}

// INIT YouTube players for all tracks
function initAllPlayers(){
  // destroy existing players in DOM (if any)
  // recreate players array aligned with tracks indexes
  players = tracks.map((t, i) => ({
    id: 'player_' + i,
    videoId: t.videoId,
    player: null,
    data: { name: t.name, volume: t.volume, loop: !!t.loop, groups: Array.isArray(t.groups) ? t.groups.slice() : [] }
  }));

  // init players when API ready
  players.forEach((p, i) => {
    const containerId = 'player_' + i;
    try{
      if(!YTready) return;
      p.player = new YT.Player(containerId, {
        height: '0', width: '0', videoId: p.videoId,
        playerVars: { controls: 0, modestbranding: 1, rel: 0, disablekb: 1 },
        events: {
          onReady: ev => { try{ ev.target.setVolume(p.data.volume); }catch{} },
          onStateChange: ev => { if(ev.data === YT.PlayerState.ENDED && p.data.loop) ev.target.playVideo(); }
        }
      });
    }catch(e){ console.warn('YT init error', e); }
  });
}

// Apply group volume multipliers to players in that group
function applyGroupVolumes(groupId){
  players.forEach((p, idx) => {
    if(!p.player) return;
    const belongs = (tracks[idx].groups || []).includes(groupId);
    if(!belongs) return;
    const group = groups.find(g => g.id === groupId);
    const eff = Math.round((tracks[idx].volume * (group?.volume || 100)) / 100);
    try{ p.player.setVolume(eff); }catch{}
  });
}

// Group-level controls with fade
function controlGroup(groupId, action){
  players.forEach((p, idx) => {
    if(!(tracks[idx].groups || []).includes(groupId)) return;
    if(!p.player) return;
    const targetVol = Math.round((tracks[idx].volume * (groups.find(g=>g.id===groupId)?.volume||100)) / 100);
    if(action === 'play'){
      try{ p.player.setVolume(0); }catch{}
      p.player.playVideo && p.player.playVideo();
      fadeYTVolume(p.player, 0, targetVol, FADE_MS);
    } else if(action === 'pause'){
      fadeYTVolume(p.player, getCurrentYTVolumeSafe(p.player), 0, FADE_MS).then(()=>{ try{ p.player.pauseVideo && p.player.pauseVideo(); }catch{} });
    } else if(action === 'stop'){
      fadeYTVolume(p.player, getCurrentYTVolumeSafe(p.player), 0, FADE_MS).then(()=>{ try{ p.player.stopVideo && p.player.stopVideo(); }catch{} });
    }
  });
}

// Helpers for initial load
function initAll(){
  loadGroups(); loadTracks(); loadEnemies(); loadSavedImages();
  renderGroups(); renderTracksList(); initAllPlayers();
}
initAll();

// Enter shortcuts
[groupNameInput, ytUrlInput, ytNameInput].forEach(el=>{
  if(!el) return;
  el.addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); if(el === groupNameInput) createGroupBtn.click(); else addTrackBtn.click(); }
  });
});

// viewerReady message (if secondary viewer asks)
window.addEventListener('message', ev=>{
  const d = ev.data;
  if(d && d.type === 'viewerReady'){
    if(typeof window._dm_current === 'number' && images[window._dm_current]) sendViewer({ type:'showImage', index: window._dm_current, data: images[window._dm_current] });
  }
});


a