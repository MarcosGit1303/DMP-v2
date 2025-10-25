/* app.js - Pantalla DM (imágenes recursivas + grupos musicales con volumen y fade) */

/* ---------- Config ---------- */
const FADE_MS = 800; // duración del fade en ms (ajusta si quieres más lento/rápido)

/* ---------- Selectores DOM ---------- */
const notesEl = document.getElementById('notes');
const saveNotesBtn = document.getElementById('saveNotes');
const clearNotesBtn = document.getElementById('clearNotes');

const imagesInput = document.getElementById('imagesInput');
const thumbs = document.getElementById('thumbs');
const openViewerBtn = document.getElementById('openViewer');
const clearImagesBtn = document.getElementById('clearImages');

const addTrackBtn = document.getElementById('addTrack');
const ytUrlInput = document.getElementById('ytUrl');
const ytNameInput = document.getElementById('ytName');
const tracksList = document.getElementById('tracksList');
const saveTracksBtn = document.getElementById('saveTracks');

const groupNameInput = document.getElementById('groupName');
const createGroupBtn = document.getElementById('createGroup');
const groupsListEl = document.getElementById('groupsList');

/* ---------- Storage keys ---------- */
const NOTES_KEY = 'dm_notes_v1';
const IMAGES_KEY = 'dm_images_v1';
const TRACKS_KEY = 'dm_tracks_v1';
const GROUPS_KEY = 'dm_groups_v1';

/* ---------- State ---------- */
let images = []; // {name, dataUrl, relativePath}
let groups = []; // {id, name, volume}
let players = []; // {id, videoId, player, container, data: {name, volume(0-100), loop, groups: [groupId] }}

/* ---------- YouTube API readiness ---------- */
let YTready = false;
window.onYouTubeIframeAPIReady = function(){ YTready = true; };

/* ---------- Notes ---------- */
function loadNotes(){ const t = localStorage.getItem(NOTES_KEY); if(t) notesEl.value = t; }
function saveNotes(){ localStorage.setItem(NOTES_KEY, notesEl.value); }
saveNotesBtn.addEventListener('click', saveNotes);
clearNotesBtn.addEventListener('click', ()=>{
  if(confirm('Borrar notas?')){ notesEl.value=''; saveNotes(); }
});
loadNotes();

/* ---------- Images: seleccionar carpeta recursiva y mantener orden ---------- */
imagesInput.addEventListener('change', async (e)=>{
  const fileList = Array.from(e.target.files || []);
  // filtrar imágenes y mantener webkitRelativePath orden
  const imgs = fileList
    .filter(f => f.type && f.type.startsWith('image/'))
    .map(f => ({ file: f, rel: f.webkitRelativePath || f.name }))
    .sort((a,b) => a.rel.localeCompare(b.rel, undefined, {numeric:true, sensitivity:'base'}));

  // leer cada imagen como dataURL (sin bloquear UI)
  const promises = imgs.map(async it => {
    const dataUrl = await fileToDataURL(it.file);
    return { name: it.file.name, dataUrl, relativePath: it.rel };
  });

  const results = await Promise.all(promises);
  images = images.concat(results); // se añaden manteniendo orden
  renderThumbs();
});

// utilidad File -> dataURL
function fileToDataURL(file){ return new Promise(res=>{
  const r = new FileReader();
  r.onload = ()=> res(r.result);
  r.readAsDataURL(file);
}); }

function renderThumbs(){
  thumbs.innerHTML = '';
  images.forEach((it, i)=>{
    const t = document.createElement('div');
    t.className = 'thumb';
    const img = document.createElement('img');
    img.src = it.dataUrl;
    img.style.width='100%';
    img.style.height='100%';
    img.style.objectFit='cover';
    const lbl = document.createElement('div'); lbl.className='label'; lbl.textContent = (i+1);
    t.appendChild(img); t.appendChild(lbl);
    t.title = it.relativePath || it.name;
    t.addEventListener('click', ()=> {
      sendViewer({type:'showImage', index:i, data:it});
      window._dm_current = i;
    });
    thumbs.appendChild(t);
  });

  // si hay muchas (más de 8) activar scroll vertical
  if(images.length > 8) thumbs.classList.add('scrollable');
  else thumbs.classList.remove('scrollable');
}

/* cargar imágenes guardadas en localStorage (si las guardaste antes) */
function loadSavedImages(){
  const raw = localStorage.getItem(IMAGES_KEY);
  if(!raw) return;
  try{
    const arr = JSON.parse(raw);
    if(Array.isArray(arr)){
      images = arr.map(x => ({ name: x.name||'img', dataUrl: x.dataUrl, relativePath: x.relativePath || x.name }));
      renderThumbs();
    }
  }catch(e){ console.warn('No se pudieron cargar imágenes guardadas.', e); }
}

/* open viewer window */
let viewerWindow = null;
openViewerBtn.addEventListener('click', ()=>{
  if(viewerWindow && !viewerWindow.closed){ viewerWindow.focus(); return; }
  viewerWindow = window.open('', 'dm_viewer', 'width=1200,height=700');
  viewerWindow.document.write(`
    <!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Pantalla Jugadores</title>
    <style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh}img{max-width:100%;max-height:100%}</style>
    </head><body><div id="stage"></div>
    <script>
      window.addEventListener('message', e=>{
        const d=e.data;
        if(!d) return;
        if(d.type==='showImage'){ const stage=document.getElementById('stage'); stage.innerHTML=''; const img=document.createElement('img'); img.src=d.data.dataUrl; stage.appendChild(img); }
        else if(d.type==='clear'){ document.getElementById('stage').innerHTML=''; }
      }, false);
      window.opener && window.opener.postMessage({type:'viewerReady'}, '*');
    <\/script></body></html>
  `);
});

/* send message to viewer */
function sendViewer(msg){
  if(!viewerWindow || viewerWindow.closed){ alert('Abre primero la pantalla de jugadores con "Abrir pantalla jugadores".'); return; }
  viewerWindow.postMessage(msg, '*');
}

/* clear images */
clearImagesBtn.addEventListener('click', ()=>{
  if(confirm('Limpiar todas las imágenes?')){
    images = []; thumbs.innerHTML=''; imagesInput.value='';
    sendViewer({type:'clear'});
    thumbs.classList.remove('scrollable');
    localStorage.removeItem(IMAGES_KEY); // si querías borrar caché de imágenes
  }
});

/* ---------- Groups & Tracks ---------- */
/* Estructura:
   groups = [{id, name, volume(0-100)}]
   players = [{id, videoId, player(YT obj), container, data:{name, volume(0-100), loop, groups:[]}}]
*/

function loadGroupsFromStorage(){
  const raw = localStorage.getItem(GROUPS_KEY);
  if(!raw) return;
  try{ const arr = JSON.parse(raw); if(Array.isArray(arr)) groups = arr; } catch(e){ console.warn(e); }
}
function saveGroupsToStorage(){ localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); }

function loadSavedTracks(){
  const raw = localStorage.getItem(TRACKS_KEY);
  if(!raw) return;
  try{
    const arr = JSON.parse(raw);
    if(Array.isArray(arr)){
      arr.forEach(item => {
        if(item && item.videoId){
          createTrack(item.videoId, { name: item.name || '', volume: item.volume != null ? item.volume : 80, loop: !!item.loop, groups: item.groups || [] });
        }
      });
      renderTracksList();
    }
  }catch(e){ console.warn(e); }
}

createGroupBtn.addEventListener('click', ()=>{
  const name = (groupNameInput.value||'').trim();
  if(!name){ alert('Pon un nombre al grupo.'); return; }
  const id = 'g'+Date.now();
  groups.push({id, name, volume: 100});
  groupNameInput.value='';
  renderGroups();
  saveGroupsToStorage();
  renderTracksList();
});

function renderGroups(){
  groupsListEl.innerHTML = '';
  groups.forEach(g=>{
    const pill = document.createElement('div');
    pill.className = 'group-pill';
    pill.dataset.id = g.id;
    pill.innerHTML = `<strong>${escapeHtml(g.name)}</strong>`;
    // group controls container
    const ctrls = document.createElement('div'); ctrls.className='group-controls';
    // group volume slider
    const vol = document.createElement('input'); vol.type='range'; vol.min=0; vol.max=100; vol.value = g.volume; vol.title='Volumen del grupo';
    vol.style.width='120px';
    const play = document.createElement('button'); play.textContent='Play';
    const pause = document.createElement('button'); pause.textContent='Pause';
    const stop = document.createElement('button'); stop.textContent='Stop';
    const del = document.createElement('button'); del.textContent='X'; del.className='secondary';
    ctrls.append(vol, play, pause, stop, del);
    pill.appendChild(ctrls);
    groupsListEl.appendChild(pill);

    // eventos
    vol.addEventListener('input', ()=> {
      g.volume = Number(vol.value);
      // aplicar el volumen efectivo a todas pistas del grupo
      players.forEach(p => {
        if((p.data.groups||[]).includes(g.id) && p.player){
          const eff = Math.round((p.data.volume * g.volume) / 100);
          try{ p.player.setVolume(eff); }catch(e){}
        }
      });
      saveGroupsToStorage();
    });

    play.addEventListener('click', ()=> controlGroup(g.id, 'play'));
    pause.addEventListener('click', ()=> controlGroup(g.id, 'pause'));
    stop.addEventListener('click', ()=> controlGroup(g.id, 'stop'));
    del.addEventListener('click', ()=>{
      if(confirm(`Eliminar grupo "${g.name}" ?`)){
        groups = groups.filter(x=>x.id!==g.id);
        players.forEach(p=>{ p.data.groups = (p.data.groups||[]).filter(id=>id!==g.id); });
        saveGroupsToStorage();
        renderGroups();
        renderTracksList();
      }
    });
  });
}

/* controlGroup con fade */
function controlGroup(groupId, action){
  // para cada player que pertenezca al grupo
  players.forEach(p=>{
    if(!(p.data.groups||[]).includes(groupId)) return;
    if(!p.player) return; // si no está inicializado, omitimos
    const targetVol = Math.round((p.data.volume * (groups.find(g=>g.id===groupId)?.volume||100)) / 100);
    if(action === 'play'){
      // empezar desde 0, play y fade a target
      try{ p.player.setVolume(0); }catch(e){}
      p.player.playVideo && p.player.playVideo();
      fadeYTVolume(p.player, 0, targetVol, FADE_MS);
    } else if(action === 'pause'){
      // fade a 0 y luego pause
      fadeYTVolume(p.player, getCurrentYTVolumeSafe(p.player), 0, FADE_MS).then(()=> {
        try{ p.player.pauseVideo && p.player.pauseVideo(); }catch(e){}
      });
    } else if(action === 'stop'){
      fadeYTVolume(p.player, getCurrentYTVolumeSafe(p.player), 0, FADE_MS).then(()=> {
        try{ p.player.stopVideo && p.player.stopVideo(); }catch(e){}
      });
    }
  });
}

/* Helpers para YT volume: no hay getter directo; mantenemos aproximación por intervalo.
   Implementamos helper que intenta leer volumen usando player.getVolume() en try/catch. */
function getCurrentYTVolumeSafe(player){
  try{ return player.getVolume(); }catch(e){ return 100; }
}

/* fade de volumen para player YT (0..100). Devuelve Promise que resuelve al terminar. */
function fadeYTVolume(player, from, to, duration){
  return new Promise(res=>{
    const steps = Math.max(6, Math.round(duration / 50));
    const delta = (to - from) / steps;
    let cur = from;
    let i=0;
    const id = setInterval(()=>{
      i++;
      cur = cur + delta;
      const v = Math.max(0, Math.min(100, Math.round(cur)));
      try{ player.setVolume(v); }catch(e){}
      if(i>=steps){
        clearInterval(id);
        try{ player.setVolume(to); }catch(e){}
        res();
      }
    }, Math.round(duration/steps));
  });
}

/* utilidad escape html */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, (m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* crear pista: ahora con chips de grupos en lugar de select */
function createTrack(videoId, opts = {}) {
  const trackId = 't' + Date.now();
  const block = document.createElement('div');
  block.className = 'track';
  block.id = trackId;

  const meta = document.createElement('div');
  meta.className = 'meta';

  // Título y nombre
  const titleRow = document.createElement('div');
  titleRow.style.display = 'flex';
  titleRow.style.gap = '8px';
  titleRow.style.alignItems = 'center';
  const nameInput = document.createElement('input');
  nameInput.value = opts.name || '';
  nameInput.placeholder = 'Nombre de canción';
  nameInput.style.padding = '6px';
  nameInput.style.borderRadius = '6px';
  nameInput.style.border = '1px solid #ddd';
  titleRow.append(nameInput);
  meta.appendChild(titleRow);

  // Contenedor del reproductor
  const playerDiv = document.createElement('div');
  playerDiv.id = trackId + '_player';
  playerDiv.className = 'yt-frame';
  meta.appendChild(playerDiv);

  // Contenedor de chips
  const groupChipsContainer = document.createElement('div');
  groupChipsContainer.className = 'group-chips';
  meta.appendChild(groupChipsContainer);

  // Controles de pista
  const controls = document.createElement('div');
  controls.className = 'controls';
  const row1 = document.createElement('div');
  row1.className = 'row';
  const playBtn = document.createElement('button');
  playBtn.textContent = 'Play';
  const pauseBtn = document.createElement('button');
  pauseBtn.textContent = 'Pause';
  const stopBtn = document.createElement('button');
  stopBtn.textContent = 'Stop';
  const rmBtn = document.createElement('button');
  rmBtn.textContent = 'Eliminar';
  rmBtn.className = 'secondary';
  row1.append(playBtn, pauseBtn, stopBtn, rmBtn);

  const row2 = document.createElement('div');
  row2.className = 'row';
  const volLabel = document.createElement('span');
  volLabel.textContent = 'Vol:';
  const volRange = document.createElement('input');
  volRange.type = 'range';
  volRange.min = 0;
  volRange.max = 100;
  volRange.value = opts.volume != null ? opts.volume : 80;
  const loopCheck = document.createElement('input');
  loopCheck.type = 'checkbox';
  loopCheck.checked = !!opts.loop;
  const loopLabel = document.createElement('label');
  loopLabel.appendChild(loopCheck);
  loopLabel.append(' Bucle');
  row2.append(volLabel, volRange, loopLabel);

  controls.append(row1, row2);
  block.append(meta, controls);
  tracksList.appendChild(block);

  const playerObj = {
    id: trackId,
    videoId,
    player: null,
    container: block,
    data: {
      name: opts.name || '',
      volume: Number(volRange.value),
      loop: !!loopCheck.checked,
      groups: Array.isArray(opts.groups) ? opts.groups.slice() : []
    }
  };

  // --- Inicializar el reproductor ---
  function initPlayer() {
    try {
      playerObj.player = new YT.Player(playerDiv.id, {
        width: '200',
        height: '112',
        videoId: videoId,
        playerVars: {
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          disablekb: 1
        },
        events: {
          onReady: (e) => {
            const eff = getEffectiveVolumeForPlayer(playerObj);
            try {
              e.target.setVolume(eff);
            } catch (e) {}
          },
          onStateChange: (ev) => {
            if (ev.data === YT.PlayerState.ENDED && playerObj.data.loop) {
              ev.target.playVideo();
            }
          }
        }
      });
    } catch (e) {
      console.warn('Error creando YT player', e);
    }
  }

  if (YTready) initPlayer();
  else {
    const wait = setInterval(() => {
      if (YTready) {
        clearInterval(wait);
        initPlayer();
      }
    }, 200);
  }

  // --- Crear chips dinámicos ---
  function renderGroupChips() {
    groupChipsContainer.innerHTML = '';
    const noneChip = document.createElement('div');
    noneChip.className = 'chip' + (playerObj.data.groups.length === 0 ? ' active' : '');
    noneChip.textContent = '🟡 Ninguno';
    noneChip.addEventListener('click', () => {
      playerObj.data.groups = [];
      renderGroupChips();
    });
    groupChipsContainer.appendChild(noneChip);

    groups.forEach((g) => {
      const chip = document.createElement('div');
      chip.className = 'chip' + (playerObj.data.groups.includes(g.id) ? ' active' : '');
      chip.textContent = g.name;
      chip.addEventListener('click', () => {
        const arr = playerObj.data.groups;
        if (arr.includes(g.id)) {
          playerObj.data.groups = arr.filter((x) => x !== g.id);
        } else {
          playerObj.data.groups.push(g.id);
        }
        renderGroupChips();
      });
      groupChipsContainer.appendChild(chip);
    });
  }

  renderGroupChips();

  // --- Controles ---
  playBtn.addEventListener('click', () => {
    if (playerObj.player) {
      try {
        playerObj.player.setVolume(0);
      } catch (e) {}
      playerObj.player.playVideo && playerObj.player.playVideo();
      const eff = getEffectiveVolumeForPlayer(playerObj);
      fadeYTVolume(playerObj.player, 0, eff, FADE_MS);
    }
  });
  pauseBtn.addEventListener('click', () => {
    if (playerObj.player) {
      fadeYTVolume(playerObj.player, getCurrentYTVolumeSafe(playerObj.player), 0, FADE_MS).then(() => {
        try {
          playerObj.player.pauseVideo && playerObj.player.pauseVideo();
        } catch (e) {}
      });
    }
  });
  stopBtn.addEventListener('click', () => {
    if (playerObj.player) {
      fadeYTVolume(playerObj.player, getCurrentYTVolumeSafe(playerObj.player), 0, FADE_MS).then(() => {
        try {
          playerObj.player.stopVideo && playerObj.player.stopVideo();
        } catch (e) {}
      });
    }
  });
  volRange.addEventListener('input', () => {
    playerObj.data.volume = Number(volRange.value);
    if (playerObj.player) {
      const eff = getEffectiveVolumeForPlayer(playerObj);
      try {
        playerObj.player.setVolume(eff);
      } catch (e) {}
    }
  });
  loopCheck.addEventListener('change', () => (playerObj.data.loop = !!loopCheck.checked));
  rmBtn.addEventListener('click', () => {
    if (confirm('Eliminar pista?')) {
      if (playerObj.player) try { playerObj.player.destroy(); } catch (e) {}
      block.remove();
      players = players.filter((p) => p.id !== playerObj.id);
    }
  });

  players.push(playerObj);
  return playerObj;
}


/* obtiene volumen efectivo (0-100) multiplicando por grupos si tiene alguno; si tiene varios grupos, tomar la media porcentual */
function getEffectiveVolumeForPlayer(playerObj){
  // volumen base
  const base = Math.max(0, Math.min(100, Number(playerObj.data.volume||0)));
  const memberGroups = (playerObj.data.groups||[]).map(gid => groups.find(g=>g.id===gid)).filter(Boolean);
  if(memberGroups.length === 0) return base;
  // si hay varios grupos, combinar: aplicaremos el producto de factores normalizados
  // método simple: multiplicar fracciones y volver a 0-100 -> more aggressive combination
  // pero para previsibilidad usamos media de porcentajes:
  const avgGroupPercent = Math.round(memberGroups.reduce((s,g)=> s + (g.volume||100), 0) / memberGroups.length);
  return Math.round(base * (avgGroupPercent / 100));
}

/* renderTracksList (actualiza selects después de crear/editar grupos) */
function renderTracksList(){
  players.forEach(p => {
    const sel = p.container.querySelector('select.group-select');
    if(sel){
      const prev = Array.from(sel.selectedOptions).map(o=>o.value);
      sel.innerHTML = '';
      groups.forEach(g=>{
        const opt = document.createElement('option'); opt.value = g.id; opt.textContent = g.name;
        if(p.data.groups && p.data.groups.includes(g.id)) opt.selected = true;
        sel.appendChild(opt);
      });
      // reapply previous selection where possible
      Array.from(sel.options).forEach(o => { if(prev.includes(o.value)) o.selected = true; });
    }
  });
}

/* Agregar pista desde UI */
addTrackBtn.addEventListener('click', ()=>{
  const url = ytUrlInput.value.trim();
  if(!url){ alert('Pega una URL de YouTube.'); return; }
  const id = extractYouTubeID(url);
  if(!id){ alert('No se pudo extraer ID de YouTube.'); return; }
  const name = (ytNameInput.value||'').trim();
  createTrack(id, { name, volume:80, loop:false, groups:[] });
  ytUrlInput.value=''; ytNameInput.value='';
});

/* Guardar pistas y grupos */
saveTracksBtn.addEventListener('click', ()=>{
  try{
    const toSave = players.map(p => ({
      videoId: p.videoId,
      name: p.data.name,
      volume: p.data.volume,
      loop: p.data.loop,
      groups: p.data.groups || []
    }));
    localStorage.setItem(TRACKS_KEY, JSON.stringify(toSave));
    saveGroupsToStorage();
    alert('Lista de pistas y grupos guardados.');
  }catch(e){
    alert('Error guardando pistas.');
    console.error(e);
  }
});

/* Borrar música y grupos guardados */
const clearTracksBtn = document.getElementById('clearTracks');
clearTracksBtn.addEventListener('click', ()=> {
  if(confirm('¿Seguro que quieres borrar todas las pistas y grupos guardados?')) {
    localStorage.removeItem(TRACKS_KEY);
    localStorage.removeItem(GROUPS_KEY);
    alert('Se eliminaron todas las pistas y grupos guardados.');
  }
});


/* cargar estado al inicio */
function loadSavedState(){
  loadSavedImages();
  loadGroupsFromStorage();
  renderGroups();
  loadSavedTracks();
  // after tracks loaded, ensure group selects are updated
  renderGroups();
  renderTracksList();
}
loadSavedState();

/* utilidad extractYouTubeID (robusta) */
function extractYouTubeID(url){
  try{
    const u = new URL(url.trim());
    if(u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if(u.searchParams.get('v')) return u.searchParams.get('v');
    const parts = u.pathname.split('/');
    return parts.pop() || parts.pop();
  }catch(e){
    const r = url.match(/(youtu\.be\/|v=|\/embed\/|\/v\/)([A-Za-z0-9_-]{6,})/);
    return r ? r[2] : null;
  }
}

/* helper: try to get current YT volume safely */
function getCurrentYTVolumeSafe(player){
  try{ return player.getVolume(); }catch(e){ return 100; }
}

/* fadeYTVolume implementada más arriba (re-usable) - ya definida */

/* ---------- Mensajes entre ventanas (viewer ready) ---------- */
window.addEventListener('message', (ev)=>{
  const d = ev.data;
  if(d && d.type==='viewerReady'){
    if(typeof window._dm_current === 'number' && images[window._dm_current]){
      sendViewer({type:'showImage', index: window._dm_current, data: images[window._dm_current]});
    }
  }
});

/* guardar imágenes en unload opcional (no automático) - dejamos la opción de no guardar por defecto */
/* Si quieres que las imágenes se guarden automáticamente en localStorage, dime y lo activo (recuerda límite). */

/* keyboard cycling para viewer */
document.addEventListener('keydown', (e)=>{
  if(!viewerWindow || viewerWindow.closed) return;
  if(images.length===0) return;
  if(e.key==='ArrowRight' || e.key==='ArrowLeft'){
    window._dm_current = window._dm_current || 0;
    if(e.key==='ArrowRight') window._dm_current = (window._dm_current+1) % images.length;
    else window._dm_current = (window._dm_current-1+images.length) % images.length;
    sendViewer({type:'showImage', index:window._dm_current, data:images[window._dm_current]});
  }
});

/* app.js - Pantalla DM con pestañas para música */

/* ---- pestañas ---- */
const tabGroups = document.getElementById("tabGroups");
const tabTracks = document.getElementById("tabTracks");
const groupsSection = document.getElementById("groupsSection");
const tracksSection = document.getElementById("tracksSection");

tabGroups.addEventListener("click", () => {
  tabGroups.classList.add("active");
  tabTracks.classList.remove("active");
  groupsSection.classList.add("active");
  tracksSection.classList.remove("active");
});

tabTracks.addEventListener("click", () => {
  tabTracks.classList.add("active");
  tabGroups.classList.remove("active");
  tracksSection.classList.add("active");
  groupsSection.classList.remove("active");
});

/* ---- resto del código original ---- */
// (Pega aquí tu app.js completo sin modificar excepto por este bloque al inicio)
