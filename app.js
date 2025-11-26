const FADE_MS = 2000;

const notesEl = document.getElementById('notes');
const saveNotesBtn = document.getElementById('saveNotes');
const clearNotesBtn = document.getElementById('clearNotes');

const addEnemyBtn = document.getElementById('addEnemy');
const clearEnemiesBtn = document.getElementById('clearEnemies');
const enemyList = document.getElementById('enemyList');
const enemyNameInput = document.getElementById('enemyName');
const enemyHPInput = document.getElementById('enemyHP');
const enemyACInput = document.getElementById('enemyAC');
const enemySpeedInput = document.getElementById('enemySpeed');

const NOTES_KEY = 'dm_notes_v1';
const ENEMIES_KEY = 'dm_enemies_v1';

let enemies = [];

const escapeHtml = s => String(s).replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

window.escapeHtml = escapeHtml;

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

const loadNotes = () => { const t = localStorage.getItem(NOTES_KEY); if (t) notesEl.value = t; };
const saveNotes = () => localStorage.setItem(NOTES_KEY, notesEl.value);
saveNotesBtn.addEventListener('click', saveNotes);
clearNotesBtn.addEventListener('click', () => {
  if (confirm('\u00BFBorrar notas?')) { notesEl.value = ''; saveNotes(); }
});
loadNotes();

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
  if (confirm('\u00BFEliminar todos los enemigos?')) {
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
          <button data-id="${e.id}" class="damage small">Da1o</button>
          <button data-id="${e.id}" class="heal small">Curar</button>
          <button data-id="${e.id}" class="remove small secondary">X</button>
        </div>
      </div>
      <div style="font-size:0.9rem;color:rgba(255,255,255,0.8)">AC ${e.ac || '-'}  Vel ${e.speed || '-'}</div>
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
  const val = prompt(mod > 0 ? '\u00BFCu\u00E1nto sana?' : '\u00BFCu\u00E1nto da\u00F1o recibe?');
  if (!val) return;
  const n = Number(val);
  if (isNaN(n)) return;
  e.current = mod > 0 ? Math.min(e.hp, e.current + n) : Math.max(0, e.current - n);
  saveEnemies();
  renderEnemies();
}
loadEnemies();

// ajustar variable CSS --top-offset según el header y espacio superior disponible
function updateTopOffset(){
  try{
    const header = document.querySelector('.title-row');
    const extra = 24; // margen extra para separación
    const h = header ? Math.ceil(header.getBoundingClientRect().height + extra) : 140;
    document.documentElement.style.setProperty('--top-offset', h + 'px');
  }catch(e){ /* noop */ }
}

window.addEventListener('resize', updateTopOffset);
// ejecutar inmediatamente para fijar el valor antes de la inicialización
updateTopOffset();

// INIT orchestration: delegar a módulos de música e imágenes
function initAll(){
  try{ if(window.dmMusic && typeof window.dmMusic.init === 'function') window.dmMusic.init(); }catch{}
  try{ if(window.dmImages && typeof window.dmImages.init === 'function') window.dmImages.init(); }catch{}
  loadEnemies();
}
initAll();
