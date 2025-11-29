// enemies.js
// Módulo autónomo para gestionar enemigos: crear, listar, ajustar HP y persistencia.
(function(){
  const ENEMIES_KEY = 'dm_enemies_v1';
  let enemies = [];

  const byId = id => enemies.find(e => String(e.id) === String(id));
  const saveEnemies = () => localStorage.setItem(ENEMIES_KEY, JSON.stringify(enemies));
  const loadEnemies = () => {
    const raw = localStorage.getItem(ENEMIES_KEY);
    if (!raw) return;
    try { enemies = JSON.parse(raw) || []; } catch { enemies = []; }
  };

  const validateEnemyInput = ({name, hp, ac, speed}) => {
    if (!name || !String(name).trim()) return { ok:false, msg: 'El nombre no puede estar vacío' };
    const nHP = Number(hp);
    if (!Number.isFinite(nHP) || nHP <= 0) return { ok:false, msg: 'HP debe ser un número entero mayor que 0' };
    const nAC = ac === '' || ac === undefined ? null : Number(ac);
    const nSpeed = speed === '' || speed === undefined ? null : Number(speed);
    if (nAC !== null && (!Number.isFinite(nAC) || nAC < 0)) return { ok:false, msg: 'AC debe ser un número >= 0' };
    if (nSpeed !== null && (!Number.isFinite(nSpeed) || nSpeed < 0)) return { ok:false, msg: 'Velocidad debe ser un número >= 0' };
    return { ok:true, hp: Math.floor(nHP), ac: nAC === null ? null : Math.floor(nAC), speed: nSpeed === null ? null : Math.floor(nSpeed) };
  };

  function createEnemy({name,hp,ac,speed}){
    const v = validateEnemyInput({name,hp,ac,speed});
    if (!v.ok) return { ok:false, msg: v.msg };
    const enemy = { id: Date.now() + Math.random().toString(16).slice(2), name: String(name).trim(), hp: v.hp, ac: v.ac, speed: v.speed, current: v.hp };
    enemies.push(enemy);
    saveEnemies();
    renderEnemies();
    return { ok:true, enemy };
  }

  function removeEnemy(id){
    enemies = enemies.filter(e => String(e.id) !== String(id));
    saveEnemies(); renderEnemies();
  }

  function setHP(id, value){
    const e = byId(id); if(!e) return { ok:false, msg:'enemigo no encontrado' };
    const v = Number(value);
    if (!Number.isFinite(v)) return { ok:false, msg:'valor no numérico' };
    e.current = Math.max(0, Math.min(e.hp, Math.floor(v)));
    saveEnemies(); renderEnemies();
    return { ok:true, current: e.current };
  }

  function updateHP(id, delta){
    const e = byId(id); if(!e) return { ok:false, msg:'enemigo no encontrado' };
    const d = Number(delta);
    if (!Number.isFinite(d)) return { ok:false, msg:'delta no numérico' };
    e.current = Math.max(0, Math.min(e.hp, e.current + Math.floor(d)));
    saveEnemies(); renderEnemies();
    return { ok:true, current: e.current };
  }

  // Renderiza la lista completa de enemigos en #enemyList
  function renderEnemies(){
    const list = document.getElementById('enemyList');
    const listForInit = document.getElementById('enemyListForInitiative');
    if(list) list.innerHTML = '';
    if(listForInit) listForInit.innerHTML = '';

    enemies.forEach(e => {
      const card = document.createElement('div');
      card.className = 'enemy-card';

      // Header row
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';

      const title = document.createElement('strong');
      title.textContent = e.name;

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '6px';
      actions.style.alignItems = 'center';

      const minus1 = document.createElement('button');
      minus1.className = 'small';
      minus1.textContent = '-1';
      minus1.addEventListener('click', () => updateHP(e.id, -1));

      const plus1 = document.createElement('button');
      plus1.className = 'small';
      plus1.textContent = '+1';
      plus1.addEventListener('click', () => updateHP(e.id, 1));

      const customInput = document.createElement('input');
      customInput.type = 'number';
      customInput.value = '1';
      customInput.style.width = '64px';
      customInput.className = 'small';

      const applyMinus = document.createElement('button');
      applyMinus.className = 'small';
      applyMinus.textContent = '-';
      applyMinus.addEventListener('click', () => {
        const n = Number(customInput.value);
        if (isNaN(n)) return alert('Introduce un número válido');
        updateHP(e.id, -Math.abs(Math.floor(n)));
      });

      const applyPlus = document.createElement('button');
      applyPlus.className = 'small';
      applyPlus.textContent = '+';
      applyPlus.addEventListener('click', () => {
        const n = Number(customInput.value);
        if (isNaN(n)) return alert('Introduce un número válido');
        updateHP(e.id, Math.abs(Math.floor(n)));
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'small secondary';
      removeBtn.textContent = 'Eliminar';
      removeBtn.addEventListener('click', () => {
        if (confirm('¿Eliminar ' + e.name + '?')) removeEnemy(e.id);
      });

      actions.appendChild(minus1);
      actions.appendChild(plus1);
      actions.appendChild(customInput);
      actions.appendChild(applyMinus);
      actions.appendChild(applyPlus);
      actions.appendChild(removeBtn);

      header.appendChild(title);
      header.appendChild(actions);

      // Meta row
      const meta = document.createElement('div');
      meta.style.fontSize = '0.9rem';
      meta.style.color = 'rgba(255,255,255,0.8)';
      meta.textContent = 'AC ' + (e.ac || '-') + '  •  Vel ' + (e.speed || '-');

      // HP bar
      const hpBar = document.createElement('div');
      hpBar.className = 'hp-bar';
      const hpFill = document.createElement('div');
      hpFill.className = 'hp-fill';
      const pct = e.hp > 0 ? Math.max(0, Math.min(100, (e.current / e.hp) * 100)) : 0;
      hpFill.style.width = pct + '%';
      hpBar.appendChild(hpFill);

      const hpText = document.createElement('div');
      hpText.setAttribute('aria-live', 'polite');
      hpText.textContent = e.current + '/' + e.hp + ' HP';

      // Compose card
      card.appendChild(header);
      card.appendChild(meta);
      card.appendChild(hpBar);
      card.appendChild(hpText);

      if(list) list.appendChild(card);

      // También crear una versión simplificada para la pestaña de iniciativa
      if(listForInit){
        const card2 = document.createElement('div');
        card2.className = 'enemy-card';
        const row = document.createElement('div');
        row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.alignItems = 'center';
        const left = document.createElement('div'); left.textContent = e.name + ' ' + e.current + '/' + e.hp + ' HP';
        const ctrls = document.createElement('div'); ctrls.style.display = 'flex'; ctrls.style.gap = '6px';
        const m1 = document.createElement('button'); m1.className='small'; m1.textContent='-1'; m1.addEventListener('click', ()=> updateHP(e.id, -1));
        const p1 = document.createElement('button'); p1.className='small'; p1.textContent='+1'; p1.addEventListener('click', ()=> updateHP(e.id, 1));
        const del1 = document.createElement('button'); del1.className='small secondary'; del1.textContent='Eliminar'; del1.addEventListener('click', ()=> { if(confirm('¿Eliminar ' + e.name + '?')) removeEnemy(e.id); });
        ctrls.appendChild(m1); ctrls.appendChild(p1); ctrls.appendChild(del1);
        row.appendChild(left); row.appendChild(ctrls);
        card2.appendChild(row);
        const hpBar2 = document.createElement('div'); hpBar2.className='hp-bar'; const hpFill2 = document.createElement('div'); hpFill2.className='hp-fill'; hpFill2.style.width = pct + '%'; hpBar2.appendChild(hpFill2);
        card2.appendChild(hpBar2);
        if(listForInit) listForInit.appendChild(card2);
      }

    });
  }

  // ------------------
  // Submódulo: Iniciativa (dmInitiative)
  // ------------------
  (function(){
    const INIT_KEY = 'dm_initiative_v1';
    let state = { participants: [] };

    function load(){
      const raw = localStorage.getItem(INIT_KEY);
      if(!raw) return;
      try{ state = JSON.parse(raw) || { participants: [] }; }catch{ state = { participants: [] }; }
      renderInitiativePanel(); renderFightParticipants(); updateInitiativeTabVisibility();
    }
    function save(){ localStorage.setItem(INIT_KEY, JSON.stringify(state)); }

    function getState(){ return JSON.parse(JSON.stringify(state)); }
    function importState(obj){ if(obj && Array.isArray(obj.participants)) { state.participants = obj.participants.slice(); save(); renderInitiativePanel(); renderFightParticipants(); updateInitiativeTabVisibility(); } }

    function addParticipant({ name, initiative, type, color }){
      const id = 'p' + Date.now() + Math.random().toString(16).slice(2);
      const p = { id, name: String(name||'').trim() || 'Sin nombre', initiative: Number(initiative) || 0, type: type || 'enemy', color: color || defaultColorFor(type) };
      state.participants.push(p); save(); renderInitiativePanel(); renderFightParticipants(); updateInitiativeTabVisibility();
      return p;
    }
    function removeParticipant(id){ state.participants = state.participants.filter(x=> String(x.id)!==String(id)); save(); renderInitiativePanel(); renderFightParticipants(); updateInitiativeTabVisibility(); }
    function updateParticipant(id, props){ const p = state.participants.find(x=> String(x.id)===String(id)); if(!p) return; Object.assign(p, props); save(); renderInitiativePanel(); renderFightParticipants(); }

    function clearAll(){ if(!confirm('¿Limpiar la cola de iniciativa?')) return; state.participants = []; save(); renderInitiativePanel(); renderFightParticipants(); updateInitiativeTabVisibility(); }

    function defaultColorFor(type){ if(type === 'pj') return '#3aa0ff'; if(type === 'ally') return '#3cb371'; return '#ff4d4d'; }

    function getSorted(desc = true){ return state.participants.slice().sort((a,b)=> desc ? (b.initiative - a.initiative) : (a.initiative - b.initiative)); }

    // Render en la pestaña initiativeList (header) y en initiativeTab
    function renderInitiativePanel(){
      const list = document.getElementById('initiativeList'); if(!list) return;
      list.innerHTML = '';
      const sorted = getSorted(true);
      sorted.forEach(p => {
        const card = document.createElement('div'); card.className = 'participant-card ' + (p.type ? ('type-' + p.type) : '');
        // aplicar color si existe
        if(p.color) card.style.borderLeftColor = p.color;
        const meta = document.createElement('div'); meta.className = 'participant-meta';
        const nameEl = document.createElement('div'); nameEl.className = 'participant-name'; nameEl.textContent = p.name;
        const initEl = document.createElement('div'); initEl.className = 'participant-init'; initEl.textContent = p.initiative;
        meta.appendChild(nameEl); meta.appendChild(initEl);
        const ctrls = document.createElement('div');
        const del = document.createElement('button'); del.className='small secondary'; del.textContent='Eliminar'; del.addEventListener('click', ()=> removeParticipant(p.id));
        const edit = document.createElement('button'); edit.className='small'; edit.textContent='Editar'; edit.addEventListener('click', ()=> openEditInModal(p.id));
        ctrls.appendChild(edit); ctrls.appendChild(del);
        card.appendChild(meta); card.appendChild(ctrls);
        // aplicar color de fondo ligero
        if(p.color) card.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.02), '+p.color+'22)';
        list.appendChild(card);
      });
    }

    // Render lista dentro de la modal (#fightParticipants)
    function renderFightParticipants(){
      const el = document.getElementById('fightParticipants'); if(!el) return; el.innerHTML = '';
      const sorted = getSorted(true);
      sorted.forEach(p => {
        const row = document.createElement('div'); row.className = 'participant-card ' + (p.type ? ('type-' + p.type) : '');
        if(p.color) row.style.borderLeftColor = p.color;
        const meta = document.createElement('div'); meta.className = 'participant-meta';
        const nameEl = document.createElement('div'); nameEl.className = 'participant-name'; nameEl.textContent = p.name;
        const initEl = document.createElement('div'); initEl.className = 'participant-init'; initEl.textContent = p.initiative;
        meta.appendChild(nameEl); meta.appendChild(initEl);
        const ctrls = document.createElement('div');
        const del = document.createElement('button'); del.className='small secondary'; del.textContent='Eliminar'; del.addEventListener('click', ()=> removeParticipant(p.id));
        const edit = document.createElement('button'); edit.className='small'; edit.textContent='Editar'; edit.addEventListener('click', ()=> openEditInModal(p.id));
        ctrls.appendChild(edit); ctrls.appendChild(del);
        row.appendChild(meta); row.appendChild(ctrls);
        if(p.color) row.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.02), '+p.color+'22)';
        el.appendChild(row);
      });
    }

    // Interacciones con la modal
    function openFightModal(){
      const m = document.getElementById('fightModal'); if(!m) return; m.style.display = 'flex'; m.setAttribute('aria-hidden','false');
      const name = document.getElementById('participantName'); if(name) name.focus();
      // Establecer color por defecto según el tipo seleccionado (PJ/Aliado/Enemigo)
      try{
        const typeEl = document.getElementById('participantType');
        const colorEl = document.getElementById('participantColor');
        if(typeEl && colorEl){
          colorEl.value = defaultColorFor(typeEl.value);
        }
      }catch(e){ /* noop */ }
      renderFightParticipants();
    }
    function closeFightModal(){ const m = document.getElementById('fightModal'); if(!m) return; m.style.display='none'; m.setAttribute('aria-hidden','true'); }

    function openEditInModal(id){ const p = state.participants.find(x=> String(x.id)===String(id)); if(!p) return; openFightModal();
      document.getElementById('participantName').value = p.name; document.getElementById('participantInit').value = p.initiative; document.getElementById('participantType').value = p.type; document.getElementById('participantColor').value = p.color || defaultColorFor(p.type);
      // store editing id temporarily
      document.getElementById('addParticipant').dataset.editing = id;
    }

    // Añadir desde modal y manejar edición
    function setupModalBindings(){
      const openBtn = document.getElementById('openFightModal'); if(openBtn) openBtn.addEventListener('click', openFightModal);
      const closeBtn = document.getElementById('closeFightModal'); if(closeBtn) closeBtn.addEventListener('click', closeFightModal);
      const addBtn = document.getElementById('addParticipant');
      // Listener: cuando el tipo cambia, fijar el color por defecto (el usuario puede modificarlo después)
      const typeEl = document.getElementById('participantType');
      const colorEl = document.getElementById('participantColor');
      if(typeEl && colorEl){
        typeEl.addEventListener('change', (e) => { try{ colorEl.value = defaultColorFor(e.target.value); }catch(err){} });
      }
      if(addBtn){
        addBtn.addEventListener('click', ()=>{
          const name = document.getElementById('participantName').value;
          const initiative = Number(document.getElementById('participantInit').value);
          const type = document.getElementById('participantType').value;
          const color = document.getElementById('participantColor').value;
          const editing = addBtn.dataset.editing;
          if(editing){ updateParticipant(editing, { name, initiative, type, color }); delete addBtn.dataset.editing; document.getElementById('participantName').value=''; document.getElementById('participantInit').value=''; }
          else addParticipant({ name, initiative, type, color });
          renderInitiativePanel(); renderFightParticipants(); updateInitiativeTabVisibility();
        });
      }

      const clearBtn = document.getElementById('clearInitiative'); if(clearBtn) clearBtn.addEventListener('click', clearAll);
      const addFromTab = document.getElementById('addFromInitiative'); if(addFromTab) addFromTab.addEventListener('click', openFightModal);
      // cerrar modal con ESC
      document.addEventListener('keydown', e => { if(e.key === 'Escape'){ const m = document.getElementById('fightModal'); if(m && m.style.display !== 'none') closeFightModal(); } });
    }

    function updateInitiativeTabVisibility(){
      const tabBtn = Array.from(document.querySelectorAll('.tab-button')).find(b=> b.dataset && b.dataset.tab === 'initiativeTab');
      const container = document.getElementById('initiativeTab');
      if(!container) return;
      if(state.participants.length === 0){ container.style.display = 'none'; if(tabBtn) tabBtn.style.display = 'none'; }
      else { container.style.display = ''; if(tabBtn) { tabBtn.style.display = ''; tabBtn.textContent = 'Iniciativa (' + state.participants.length + ')'; } }
    }

    // Exponer API y inicializar
    window.dmInitiative = { addParticipant, removeParticipant, updateParticipant, getState, importState, openFightModal, closeFightModal };
    load(); setupModalBindings();
  })();

  // Inicializador que conecta eventos del UI superior
  function init(){
    const addBtn = document.getElementById('addEnemy');
    const clearBtn = document.getElementById('clearEnemies');
    const nameIn = document.getElementById('enemyName');
    const hpIn = document.getElementById('enemyHP');
    const acIn = document.getElementById('enemyAC');
    const speedIn = document.getElementById('enemySpeed');

    // small visible badge to confirm init
    try{
      const mgr = document.querySelector('.enemy-manager');
      if (mgr) {
        const badge = document.createElement('div');
        badge.textContent = 'Enemigos listo';
        badge.style.fontSize = '12px';
        badge.style.color = 'var(--text)';
        badge.style.background = 'rgba(30,144,255,0.12)';
        badge.style.padding = '4px 8px';
        badge.style.borderRadius = '6px';
        badge.style.marginBottom = '8px';
        mgr.insertBefore(badge, mgr.firstChild);
      }
    }catch(e){ /* noop */ }

    if (!addBtn || !clearBtn) return;

    addBtn.addEventListener('click', () => {
      const res = createEnemy({ name: nameIn.value, hp: hpIn.value, ac: acIn.value, speed: speedIn.value });
      if (!res.ok) return alert(res.msg);
      [nameIn, hpIn, acIn, speedIn].forEach(i => i.value = '');
    });

    clearBtn.addEventListener('click', () => {
      if (!confirm('¿Eliminar todos los enemigos?')) return;
      enemies = []; saveEnemies(); renderEnemies();
    });

    loadEnemies();
    renderEnemies();

    // modo debug: si la URL incluye ?debugEnemies=1 y no hay enemigos, crear uno de ejemplo
    try{
      const params = new URLSearchParams(location.search);
      if (params.get('debugEnemies') === '1' && enemies.length === 0){
        createEnemy({ name: 'Goblin (demo)', hp: 7, ac: 15, speed: 30 });
      }
    }catch(e){ /* noop */ }

    console.log('dmEnemies initialized. Enemies loaded:', enemies.length);
  }

  // Exponer API mínima
  window.dmEnemies = { init, createEnemy, updateHP, setHP, removeEnemy, list: () => enemies };
})();
