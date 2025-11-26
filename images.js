(function(){
  const imagesInput = document.getElementById('imagesInput');
  const thumbs = document.getElementById('thumbs');
  const openViewerBtn = document.getElementById('openViewer');
  const clearImagesBtn = document.getElementById('clearImages');
  const foldersList = document.getElementById('foldersList');
  const imageSearch = document.getElementById('imageSearch');
  const clearSearch = document.getElementById('clearSearch');

  let images = [];
  let imageTree = { name: 'root', folders: {}, images: [] };
  let currentPath = [];
  let viewerWindow = null;
  let lastShownImage = null;

  const IMAGES_PAGE = 80;
  let currentThumbStart = 0;

  const fileToDataURL = file => new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(file);
  });

  imagesInput?.addEventListener('change', async e => {
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
    currentThumbStart = 0;
    // volver a raíz por defecto al añadir imágenes
    currentPath = [];
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
    if(!foldersList) return;
    foldersList.innerHTML = '';
    const renderNode = (node, path = []) => {
      const div = document.createElement('div');
      div.className = 'folder';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'folder-name';
      nameDiv.textContent = node.name === 'root' ? '\ud83d\udcc1 Ra\u00edz' : node.name;
      div.appendChild(nameDiv);

      nameDiv.addEventListener('click', () => {
        if (node.name !== 'root') div.classList.toggle('open');
        currentPath = path;
        currentThumbStart = 0;
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

    // Si hay subcarpetas, seleccionar por defecto la primera y mostrar sus imágenes
    const topFolders = Object.keys(imageTree.folders || {});
    if (topFolders.length > 0) {
      const first = topFolders[0];
      currentPath = [first];
      // marcar visualmente la carpeta activa
      const names = foldersList.querySelectorAll('.folder-name');
      names.forEach(nd => {
        if (nd.textContent && nd.textContent.trim() === first) {
          const parent = nd.closest('.folder');
          parent && parent.classList.add('active');
          // abrir el contenedor padre si existe
          const ancestor = parent && parent.parentElement && parent.parentElement.closest('.folder');
          if (ancestor) ancestor.classList.add('open');
        }
      });
      currentThumbStart = 0;
      renderThumbs();
      return;
    }

    if (Object.keys(imageTree.folders).length === 0) {
      foldersList.innerHTML = '<div class="folder active"><div class="folder-name">\ud83d\udcc1 Ra\u00edz (sin subcarpetas)</div></div>';
      currentPath = [];
      currentThumbStart = 0;
      renderThumbs();
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

  // eliminar función collectAllImages y usar sólo las imágenes del nodo seleccionado
  function renderThumbs() {
    if(!thumbs) return;
    thumbs.innerHTML = '';
    const node = getNodeAtPath(currentPath);
    // Mostrar solo las imágenes de la carpeta seleccionada (comportamiento original)
    const allImgs = node.images || [];

    const q = (imageSearch?.value || '').trim().toLowerCase();
    const imgs = q ? allImgs.filter(it => ((it.name || '') + ' ' + (it.relativePath || '')).toLowerCase().includes(q)) : allImgs;

    const end = Math.min(currentThumbStart + IMAGES_PAGE, imgs.length);

    for (let i = currentThumbStart; i < end; i++) {
      const it = imgs[i];
      const t = document.createElement('div');
      t.className = 'thumb';

      const img = document.createElement('img');
      img.src = it.dataUrl;
      img.loading = 'lazy';
      img.alt = it.name || '';

      t.appendChild(img);

      t.title = '';
      t.tabIndex = 0;
      t.addEventListener('click', () => {
        lastShownImage = it;
        sendViewer({ type: 'showImage', index: i, data: it });
        window._dm_current = i;
      });
      thumbs.appendChild(t);
    }

    if (end < imgs.length) {
      const more = document.createElement('div');
      more.style.display = 'flex';
      more.style.justifyContent = 'center';
      more.style.marginTop = '6px';
      const btn = document.createElement('button');
      btn.textContent = `Cargar más (${imgs.length - end})`;
      btn.className = 'small';
      btn.addEventListener('click', () => {
        currentThumbStart = end;
        renderThumbs();
        try{ thumbs.parentElement && thumbs.parentElement.scrollTo({ top: thumbs.scrollHeight, behavior: 'smooth' }); }catch{}
      });
      more.appendChild(btn);
      thumbs.appendChild(more);
    }

    if(imgs.length === 0){
      const empty = document.createElement('div');
      empty.style.opacity = '0.8';
      empty.textContent = q ? 'No se encontraron imágenes para "' + q + '"' : 'No hay imágenes en esta carpeta';
      thumbs.appendChild(empty);
    }
  }

  openViewerBtn?.addEventListener('click', () => {
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

  clearImagesBtn?.addEventListener('click', () => {
    if (confirm('\u00BFLimpiar todas las im\u00E1genes?')) {
      images = [];
      thumbs.innerHTML = '';
      foldersList.innerHTML = '';
      imagesInput.value = '';
      lastShownImage = null;
      sendViewer({ type: 'clear' });
    }
  });

  window.addEventListener('message', ev=>{
    const d = ev.data;
    if(d && d.type === 'viewerReady'){
      if(lastShownImage) sendViewer({ type:'showImage', data: lastShownImage });
    }
  });

  imageSearch?.addEventListener('input', () => {
    currentThumbStart = 0; renderThumbs();
  });
  clearSearch?.addEventListener('click', () => { if(imageSearch) imageSearch.value = ''; currentThumbStart = 0; renderThumbs(); });

  window.dmImages = {
    init(){ },
    buildImageTree,
    renderFolderTree,
    renderThumbs,
    get images(){ return images; }
  };
})();
