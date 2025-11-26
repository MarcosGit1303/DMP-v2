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
    if(!list) return;
    list.innerHTML = '';

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

      list.appendChild(card);
    });
  }

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
