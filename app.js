const FADE_MS = 2000;

// === Selectores generales ===
const notesEl = document.getElementById('notes');
const saveNotesBtn = document.getElementById('saveNotes');
const clearNotesBtn = document.getElementById('clearNotes');

const imagesInput = document.getElementById('imagesInput');
const thumbs = document.getElementById('thumbs');
const openViewerBtn = document.getElementById('openViewer');
const clearImagesBtn = document.getElementById('clearImages');

const ytUrlInput = document.getElementById('ytUrl');
const ytNameInput = document.getElementById('ytName');
const addTrackBtn = document.getElementById('addTrack');
const saveTracksBtn = document.getElementById('saveTracks');
const clearTracksBtn = document.getElementById('clearTracks');

const groupNameInput = document.getElementById('groupName');
const createGroupBtn = document.getElementById('createGroup');
const groupsListEl = document.getElementById('groupsList');
const tracksList = document.getElementById('tracksList');

// === Enemigos ===
const addEnemyBtn = document.getElementById('addEnemy');
const enemyList = document.getElementById('enemyList');
const enemyNameInput = document.getElementById('enemyName');
const enemyHPInput = document.getElementById('enemyHP');
const enemyACInput = document.getElementById('enemyAC');
const enemySpeedInput = document.getElementById('enemySpeed');

// === Storage Keys ===
const NOTES_KEY = 'dm_notes_v1';
const IMAGES_KEY = 'dm_images_v1';
const TRACKS_KEY = 'dm_tracks_v1';
const GROUPS_KEY = 'dm_groups_v1';
const ENEMIES_KEY = 'dm_enemies_v1';

// === Estado ===
let images = [];
let groups = [];
let players = [];
let enemies = [];
let viewerWindow = null;
let YTready = false;

// === Inicialización YouTube ===
window.onYouTubeIframeAPIReady = () => { YTready = true; };

// === Utilidades ===
const escapeHtml = s =>
  String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
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

const getCurrentYTVolumeSafe = player => {
  try { return player.getVolume(); } catch { return 100; }
};

const fadeYTVolume = (player, from, to, duration) =>
  new Promise(res => {
    const steps = Math.max(6, Math.round(duration / 50));
    const delta = (to - from) / steps;
    let cur = from, i = 0;
    const id = setInterval(() => {
      i++;
      cur += delta;
      const v = Math.max(0, Math.min(100, Math.round(cur)));
      try { player.setVolume(v); } catch {}
      if (i >= steps) {
        clearInterval(id);
        try { player.setVolume(to); } catch {}
        res();
      }
    }, Math.round(duration / steps));
  });

// === Tabs generales (izquierda y derecha) ===
document.querySelectorAll('.tab-button').forEach(btn => {
  btn.addEventListener('click', () => {
    const container = btn.closest('.left-col, .right-col');
    const tab = btn.dataset.tab;
    container.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    container.querySelectorAll('.music-section, .left-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(tab).classList.add('active');
  });
});

// === Notas ===
const loadNotes = () => {
  const t = localStorage.getItem(NOTES_KEY);
  if (t) notesEl.value = t;
};
const saveNotes = () => localStorage.setItem(NOTES_KEY, notesEl.value);
saveNotesBtn.addEventListener('click', saveNotes);
clearNotesBtn.addEventListener('click', () => {
  if (confirm('Borrar notas?')) {
    notesEl.value = '';
    saveNotes();
  }
});
loadNotes();

// === Imágenes ===
imagesInput.addEventListener('change', async e => {
  const fileList = Array.from(e.target.files || []);
  const imgs = fileList
    .filter(f => f.type && f.type.startsWith('image/'))
    .map(f => ({ file: f, rel: f.webkitRelativePath || f.name }))
    .sort((a, b) => a.rel.localeCompare(b.rel, undefined, { numeric: true, sensitivity: 'base' }));

  const results = await Promise.all(
    imgs.map(async it => ({
      name: it.file.name,
      dataUrl: await fileToDataURL(it.file),
      relativePath: it.rel
    }))
  );
  images = images.concat(results);
  renderThumbs();
});

const renderThumbs = () => {
  thumbs.innerHTML = '';
  images.forEach((it, i) => {
    const t = document.createElement('div');
    t.className = 'thumb';
    const img = document.createElement('img');
    img.src = it.dataUrl;
    const lbl = document.createElement('div');
    lbl.className = 'label';
    lbl.textContent = i + 1;
    t.append(img, lbl);
    t.title = it.relativePath || it.name;
    t.addEventListener('click', () => {
      sendViewer({ type: 'showImage', index: i, data: it });
      window._dm_current = i;
    });
    thumbs.appendChild(t);
  });
  thumbs.classList.toggle('scrollable', images.length > 8);
};

const loadSavedImages = () => {
  const raw = localStorage.getItem(IMAGES_KEY);
  if (!raw) return;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      images = arr.map(x => ({
        name: x.name || 'img',
        dataUrl: x.dataUrl,
        relativePath: x.relativePath || x.name
      }));
      renderThumbs();
    }
  } catch {}
};

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
        if(d.type==='showImage'){const s=document.getElementById('stage');s.innerHTML='';const i=document.createElement('img');i.src=d.data.dataUrl;s.appendChild(i);}
        else if(d.type==='clear'){document.getElementById('stage').innerHTML='';}
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
  if (confirm('Limpiar todas las imágenes?')) {
    images = [];
    thumbs.innerHTML = '';
    imagesInput.value = '';
    sendViewer({ type: 'clear' });
    thumbs.classList.remove('scrollable');
    localStorage.removeItem(IMAGES_KEY);
  }
});

// === Sistema de enemigos con guardado ===
addEnemyBtn?.addEventListener('click', () => {
  const name = enemyNameInput.value.trim();
  const hp = Number(enemyHPInput.value);
  const ac = Number(enemyACInput.value);
  const speed = Number(enemySpeedInput.value);
  if (!name || !hp) return alert('Introduce al menos nombre y HP.');
  const enemy = { id: Date.now(), name, hp, ac, speed, current: hp };
  enemies.push(enemy);
  renderEnemies();
  saveEnemies();
  [enemyNameInput, enemyHPInput, enemyACInput, enemySpeedInput].forEach(i => i.value = '');
});

function renderEnemies() {
  enemyList.innerHTML = '';
  enemies.forEach(e => {
    const div = document.createElement('div');
    div.className = 'enemy-card';
    div.innerHTML = `
      <strong>${e.name}</strong> (AC ${e.ac || '-'}, Vel ${e.speed || '-'})
      <div class="hp-bar"><div class="hp-fill" style="width:${(e.current / e.hp) * 100}%"></div></div>
      <div class="hp-controls">
        <button data-id="${e.id}" class="damage">Daño</button>
        <button data-id="${e.id}" class="heal">Curar</button>
        <span>${e.current}/${e.hp} HP</span>
      </div>`;
    enemyList.appendChild(div);
  });
  enemyList.querySelectorAll('.damage').forEach(b => b.onclick = () => adjustHP(b.dataset.id, -1));
  enemyList.querySelectorAll('.heal').forEach(b => b.onclick = () => adjustHP(b.dataset.id, 1));
}

function adjustHP(id, mod) {
  const enemy = enemies.find(e => e.id == id);
  const val = prompt(mod > 0 ? '¿Cuánto sana?' : '¿Cuánto daño recibe?');
  if (!val) return;
  const num = Number(val);
  if (mod > 0) enemy.current = Math.min(enemy.hp, enemy.current + num);
  else enemy.current = Math.max(0, enemy.current - num);
  renderEnemies();
  saveEnemies();
}

function saveEnemies() {
  localStorage.setItem(ENEMIES_KEY, JSON.stringify(enemies));
}

function loadEnemies() {
  const raw = localStorage.getItem(ENEMIES_KEY);
  if (!raw) return;
  try {
    enemies = JSON.parse(raw);
    if (!Array.isArray(enemies)) enemies = [];
    renderEnemies();
  } catch {
    enemies = [];
  }
}

loadEnemies();

// === Atajos con Enter ===
[groupNameInput, ytUrlInput, ytNameInput].forEach((el, i) => {
  if (!el) return;
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (el === groupNameInput) createGroupBtn.click();
      else addTrackBtn.click();
    }
  });
});
