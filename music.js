(function () {
    const FADE_MS = 2000;

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

    const TRACKS_KEY = 'dm_tracks_v1';
    const GROUPS_KEY = 'dm_groups_v1';

    let groups = [];
    let tracks = [];
    let players = [];
    let YTready = false;

    const pageProtocol = window.location.protocol || '';
    const pageOrigin = (window.location && window.location.origin) ? window.location.origin : '';
    const playerOrigin = (pageProtocol === 'file:' || !pageOrigin) ? 'http://localhost' : pageOrigin;

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

    const getCurrentYTVolumeSafe = p => {
        try {
            return p.getVolume();
        } catch {
            return 100;
        }
    };

    const fadeYTVolume = (p, from, to, dur) => new Promise(res => {
        const steps = Math.max(6, Math.round(dur / 50));
        const delta = (to - from) / steps;
        let cur = from, i = 0;
        const id = setInterval(() => {
            i++;
            cur += delta;
            const v = Math.max(0, Math.min(100, Math.round(cur)));
            try {
                p.setVolume(v);
            } catch {
            }
            if (i >= steps) {
                clearInterval(id);
                try {
                    p.setVolume(to);
                } catch {
                }
                res();
            }
        }, Math.round(dur / steps));
    });

    const loadGroups = () => {
        const raw = localStorage.getItem(GROUPS_KEY);
        if (!raw) return;
        try {
            groups = JSON.parse(raw) || [];
        } catch {
            groups = [];
        }
        renderGroups();
    };
    const saveGroups = () => localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));

    const loadTracks = () => {
        const raw = localStorage.getItem(TRACKS_KEY);
        if (!raw) return;
        try {
            tracks = JSON.parse(raw) || [];
        } catch {
            tracks = [];
        }
        renderTracksList();
        initAllPlayers();
    };
    const saveTracks = () => localStorage.setItem(TRACKS_KEY, JSON.stringify(tracks));

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function exportData(options = {includeInitiative: false}) {
        const payload = {tracks: tracks, groups: groups};
        try {
            if (options.includeInitiative && window.dmInitiative && window.dmInitiative.getState) payload.initiative = window.dmInitiative.getState();
        } catch {
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
        downloadBlob(blob, 'dm_export_' + Date.now() + '.json');
    }

    function importDataFromFile(file) {
        if (!file) return Promise.reject(new Error('No file'));
        return new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const obj = JSON.parse(String(e.target.result));
                    if (obj.tracks && Array.isArray(obj.tracks)) {
                        tracks = obj.tracks;
                        saveTracks();
                        renderTracksList();
                        initAllPlayers();
                    }
                    if (obj.groups && Array.isArray(obj.groups)) {
                        groups = obj.groups;
                        saveGroups();
                        renderGroups();
                        renderTracksList();
                    }
                    if (obj.initiative && window.dmInitiative && typeof window.dmInitiative.importState === 'function') {
                        try {
                            window.dmInitiative.importState(obj.initiative);
                        } catch (e) {
                            console.warn('import iniciativa error', e);
                        }
                    }
                    res(obj);
                } catch (err) {
                    rej(err);
                }
            };
            reader.onerror = () => rej(new Error('file read error'));
            reader.readAsText(file);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('btnImportExport');
        const tabBtn = document.querySelector('.tab-button[data-tab="importTab"]');

        const importModal = document.getElementById('importModal');
        const modalExportBtn = document.getElementById('modalExportBtn');
        const modalInput = document.getElementById('importFileInput');
        const modalIncludeChk = document.getElementById('modalIncludeInitiative');
        const modalStatus = document.getElementById('importModalStatus');
        const closeImportModal = document.getElementById('closeImportModal');

        const exportBtn = document.getElementById('exportBtn');
        const includeChk = document.getElementById('includeInitiative');
        const statusEl = document.getElementById('importExportStatus');

        const setStatus = (el, msg, isError = false) => {
            if (el) {
                el.textContent = msg;
                el.style.color = isError ? '#ffb4b4' : 'var(--muted)';
            }
        };

        const openModal = (m) => {
            if (!m) return;
            m.style.display = 'flex';
            m.setAttribute('aria-hidden', 'false');
        };
        const closeModal = (m) => {
            if (!m) return;
            m.style.display = 'none';
            m.setAttribute('aria-hidden', 'true');
        };

        const openImportModal = () => {
            if (importModal) {
                openModal(importModal);
                if (modalExportBtn) modalExportBtn.focus();
            }
        };
        const closeImportModalFn = () => {
            if (importModal) closeModal(importModal);
        };

        if (btn) {
            btn.addEventListener('click', () => {
                if (importModal) {
                    openImportModal();
                    return;
                }
                if (tabBtn) {
                    tabBtn.click();
                    const focus = exportBtn;
                    if (focus) focus.focus();
                    return;
                }
                const choice = confirm('Presiona Aceptar para exportar (incluir iniciativa si existe). Cancelar para importar.');
                if (choice) exportData({includeInitiative: true});
                else if (modalInput) modalInput.click();
            });
        }

        if (closeImportModal) {
            closeImportModal.addEventListener('click', closeImportModalFn);
        }

        if (modalExportBtn) {
            modalExportBtn.addEventListener('click', () => {
                const include = !!(modalIncludeChk && modalIncludeChk.checked);
                try {
                    setStatus(modalStatus, 'Preparando exportación...');
                    exportData({includeInitiative: include});
                    setStatus(modalStatus, 'Exportación completada (descarga iniciada)');
                    setTimeout(() => setStatus(modalStatus, ''), 2500);
                } catch (e) {
                    setStatus(modalStatus, 'Error exportando: ' + (e && e.message ? e.message : String(e)), true);
                }
            });
        }

        if (modalInput) {
            modalInput.addEventListener('change', (e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                setStatus(modalStatus, 'Importando...');
                importDataFromFile(f).then(() => {
                    setStatus(modalStatus, 'Importación completada');
                    setTimeout(() => setStatus(modalStatus, ''), 2400);
                })
                    .catch(err => {
                        setStatus(modalStatus, 'Error importando: ' + (err && err.message ? err.message : String(err)), true);
                    });
                modalInput.value = '';
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const include = !!(includeChk && includeChk.checked);
                try {
                    setStatus(statusEl, 'Preparando exportación...');
                    exportData({includeInitiative: include});
                    setStatus(statusEl, 'Exportación completada (descarga iniciada)');
                    setTimeout(() => setStatus(statusEl, ''), 2500);
                } catch (e) {
                    setStatus(statusEl, 'Error exportando: ' + (e && e.message ? e.message : String(e)), true);
                }
            });
        }

        if (includeChk && modalIncludeChk) {
            includeChk.addEventListener('change', () => {
                if (modalIncludeChk) modalIncludeChk.checked = includeChk.checked;
            });
            modalIncludeChk.addEventListener('change', () => {
                if (includeChk) includeChk.checked = modalIncludeChk.checked;
            });
        }

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if (importModal && importModal.style.display !== 'none') closeImportModalFn();
            }
        });

        window.dmMusic = Object.assign(window.dmMusic || {}, {openImportModal, closeImportModal: closeImportModalFn});

    });

    function renderGroups() {
        if (!groupsListEl) return;
        groupsListEl.innerHTML = '';
        groups.forEach(g => {
            const pill = document.createElement('div');
            pill.className = 'group-pill';
            pill.innerHTML = `<strong>${(window.escapeHtml ? window.escapeHtml(g.name) : g.name)}</strong>`;
            const ctrls = document.createElement('div');
            ctrls.className = 'group-controls';
            const vol = document.createElement('input');
            vol.type = 'range';
            vol.min = 0;
            vol.max = 100;
            vol.value = g.volume;
            const play = document.createElement('button');
            play.textContent = 'Play';
            const pause = document.createElement('button');
            pause.textContent = 'Pause';
            const stop = document.createElement('button');
            stop.textContent = 'Stop';
            const del = document.createElement('button');
            del.textContent = 'Eliminar';
            del.className = 'secondary';
            ctrls.append(vol, play, pause, stop, del);
            pill.appendChild(ctrls);
            groupsListEl.appendChild(pill);

            vol.addEventListener('input', () => {
                g.volume = Number(vol.value);
                saveGroups();
                applyGroupVolumes(g.id);
            });
            play.addEventListener('click', () => controlGroup(g.id, 'play'));
            pause.addEventListener('click', () => controlGroup(g.id, 'pause'));
            stop.addEventListener('click', () => controlGroup(g.id, 'stop'));
            del.addEventListener('click', () => {
                if (confirm(`Eliminar grupo "${g.name}" ?`)) {
                    groups = groups.filter(x => x.id !== g.id);
                    players.forEach(p => p.data.groups = (p.data.groups || []).filter(id => id !== g.id));
                    saveGroups();
                    renderGroups();
                    renderTracksList();
                }
            });
        });
    }

    function renderChipsForTrack(index) {
        const container = document.getElementById('chips_' + index);
        if (!container) return;
        container.innerHTML = '';
        const noneChip = document.createElement('div');
        noneChip.className = 'chip ' + (tracks[index].groups.length === 0 ? 'active' : '');
        noneChip.textContent = '\uD83D\uDFE1 Ninguno';
        noneChip.addEventListener('click', () => {
            tracks[index].groups = [];
            saveTracks();
            renderChipsForTrack(index);
        });
        container.appendChild(noneChip);

        groups.forEach(g => {
            const chip = document.createElement('div');
            chip.className = 'chip' + (tracks[index].groups && tracks[index].groups.includes(g.id) ? ' active' : '');
            chip.textContent = g.name;
            chip.addEventListener('click', () => {
                const arr = tracks[index].groups || [];
                if (arr.includes(g.id)) tracks[index].groups = arr.filter(x => x !== g.id);
                else tracks[index].groups = [...arr, g.id];
                saveTracks();
                renderChipsForTrack(index);
            });
            container.appendChild(chip);
        });
    }

    function renderTracksList() {
        if (!tracksList) return;
        tracksList.innerHTML = '';
        players = [];
        tracks.forEach((t, index) => {
            const block = document.createElement('div');
            block.className = 'track';
            block.id = 'track_' + index;
            block.innerHTML = `
        <div class=\"meta\"><div><strong>${(window.escapeHtml ? window.escapeHtml(t.name) : t.name)}</strong></div></div>
        <div id=\"player_${index}\" class=\"yt-frame\"></div>
        <div class=\"group-chips\" id=\"chips_${index}\"></div>
        <div class=\"controls\">
          <div class=\"row\">\n            <button data-i=\"${index}\" class=\"play\">Play</button>
            <button data-i=\"${index}\" class=\"pause\">Pause</button>
            <button data-i=\"${index}\" class=\"stop secondary\">Stop</button>
            <button data-i=\"${index}\" class=\"rm secondary\">Eliminar</button>
          </div>
          <div class=\"row\">
            <label>Vol <input type=\"range\" min=\"0\" max=\"100\" value=\"${t.volume}\" data-i=\"${index}\" class=\"vol\"></label>
            <label><input type=\"checkbox\" data-i=\"${index}\" class=\"loop\" ${t.loop ? 'checked' : ''} /> Bucle</label>
          </div>
        </div>
      `;
            tracksList.appendChild(block);
            renderChipsForTrack(index);
        });

        tracksList.querySelectorAll('.play').forEach(b => b.onclick = async e => {
            const i = Number(e.target.dataset.i);
            const p = players[i]?.player;
            if (!p) return;
            try {
                p.setVolume(0);
                p.playVideo();
                await fadeYTVolume(p, 0, tracks[i].volume, FADE_MS);
            } catch {
            }
        });
        tracksList.querySelectorAll('.pause').forEach(b => b.onclick = async e => {
            const i = Number(e.target.dataset.i);
            const p = players[i]?.player;
            if (!p) return;
            try {
                await fadeYTVolume(p, getCurrentYTVolumeSafe(p), 0, FADE_MS);
                p.pauseVideo();
            } catch {
            }
        });
        tracksList.querySelectorAll('.stop').forEach(b => b.onclick = async e => {
            const i = Number(e.target.dataset.i);
            const p = players[i]?.player;
            if (!p) return;
            try {
                await fadeYTVolume(p, getCurrentYTVolumeSafe(p), 0, FADE_MS);
                p.stopVideo();
            } catch {
            }
        });
        tracksList.querySelectorAll('.rm').forEach(b => b.onclick = e => {
            const i = Number(e.target.dataset.i);
            if (confirm('Eliminar pista?')) {
                if (players[i]?.player) try {
                    players[i].player.destroy();
                } catch {
                }
                tracks.splice(i, 1);
                saveTracks();
                renderTracksList();
                initAllPlayers();
            }
        });

        tracksList.querySelectorAll('.vol').forEach(r => r.addEventListener('input', e => {
            const i = Number(e.target.dataset.i);
            const v = Number(e.target.value);
            tracks[i].volume = v;
            const p = players[i]?.player;
            if (p) try {
                p.setVolume(v);
            } catch {
            }
            saveTracks();
        }));
        tracksList.querySelectorAll('.loop').forEach(chk => chk.addEventListener('change', e => {
            const i = Number(e.target.dataset.i);
            tracks[i].loop = e.target.checked;
            saveTracks();
        }));
    }

    function initAllPlayers() {
        players = tracks.map((t, i) => ({
            id: 'player_' + i,
            videoId: t.videoId,
            player: null,
            data: {
                name: t.name,
                volume: t.volume,
                loop: !!t.loop,
                groups: Array.isArray(t.groups) ? t.groups.slice() : []
            }
        }));

        players.forEach((p, i) => {
            const containerId = 'player_' + i;
            try {
                if (!YTready) return;
                p.player = new YT.Player(containerId, {
                    height: '0', width: '0', videoId: p.videoId,
                    playerVars: {controls: 0, modestbranding: 1, rel: 0, disablekb: 1, origin: playerOrigin},
                    events: {
                        onReady: ev => {
                            try {
                                ev.target.setVolume(p.data.volume);
                            } catch {
                            }
                        },
                        onStateChange: ev => {
                            if (ev.data === YT.PlayerState.ENDED && p.data.loop) ev.target.playVideo();
                        },
                        onError: ev => {
                            console.warn('YouTube player error', ev.data);
                            const code = Number(ev.data);
                            if ([100, 101, 150, 153].includes(code)) {
                                const msg = 'Error de reproducción de YouTube (' + code + '). Si estás abriendo el archivo con file://, usa un servidor local (por ejemplo: "python -m http.server 8000") y accede mediante http://localhost:8000. También verifica que el vídeo permite reproducción embebida.';
                                try {
                                    alert(msg);
                                } catch {
                                }
                                ;
                            }
                        }
                    }
                });
            } catch (e) {
                console.warn('YT init error', e);
            }
        });
    }

    function applyGroupVolumes(groupId) {
        players.forEach((p, idx) => {
            if (!p.player) return;
            const belongs = (tracks[idx].groups || []).includes(groupId);
            if (!belongs) return;
            const group = groups.find(g => g.id === groupId);
            const eff = Math.round((tracks[idx].volume * (group?.volume || 100)) / 100);
            try {
                p.player.setVolume(eff);
            } catch {
            }
        });
    }

    function controlGroup(groupId, action) {
        players.forEach((p, idx) => {
            if (!(tracks[idx].groups || []).includes(groupId)) return;
            if (!p.player) return;
            const targetVol = Math.round((tracks[idx].volume * (groups.find(g => g.id === groupId)?.volume || 100)) / 100);
            if (action === 'play') {
                try {
                    p.player.setVolume(0);
                } catch {
                }
                p.player.playVideo && p.player.playVideo();
                fadeYTVolume(p.player, 0, targetVol, FADE_MS);
            } else if (action === 'pause') {
                fadeYTVolume(p.player, getCurrentYTVolumeSafe(p.player), 0, FADE_MS).then(() => {
                    try {
                        p.player.pauseVideo && p.player.pauseVideo();
                    } catch {
                    }
                });
            } else if (action === 'stop') {
                fadeYTVolume(p.player, getCurrentYTVolumeSafe(p.player), 0, FADE_MS).then(() => {
                    try {
                        p.player.stopVideo && p.player.stopVideo();
                    } catch {
                    }
                });
            }
        });
    }

    createGroupBtn?.addEventListener('click', () => {
        const name = (groupNameInput.value || '').trim();
        if (!name) return alert('Pon un nombre al grupo.');
        const id = 'g' + Date.now();
        groups.push({id, name, volume: 100});
        groupNameInput.value = '';
        renderGroups();
        saveGroups();
        renderTracksList();
    });
    saveGroupsBtn?.addEventListener('click', () => {
        saveGroups();
        alert('Grupos guardados.');
    });

    addTrackBtn?.addEventListener('click', () => {
        const url = (ytUrlInput.value || '').trim();
        if (!url) return alert('Pega una URL de YouTube.');
        const id = extractYouTubeID(url);
        if (!id) return alert('No se pudo extraer ID de YouTube.');
        const name = (ytNameInput.value || '').trim() || ('Pista ' + (tracks.length + 1));
        tracks.push({videoId: id, name, volume: 80, loop: false, groups: []});
        ytUrlInput.value = '';
        ytNameInput.value = '';
        renderTracksList();
        saveTracks();
        initAllPlayers();
    });
    saveTracksBtn?.addEventListener('click', () => {
        saveTracks();
        saveGroups();
        alert('Pistas y grupos guardados.');
    });
    clearTracksBtn?.addEventListener('click', () => {
        if (confirm('\u00BFBorrar todas las pistas?')) {
            tracks = [];
            players.forEach(p => {
                try {
                    p.player.destroy();
                } catch {
                }
            });
            players = [];
            saveTracks();
            renderTracksList();
        }
    });

    [groupNameInput, ytUrlInput, ytNameInput].forEach(el => {
        if (!el) return;
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (el === groupNameInput) createGroupBtn.click(); else addTrackBtn.click();
            }
        });
    });

    window.dmMusic = Object.assign(window.dmMusic || {}, {
        init() {
            loadGroups();
            loadTracks();
            renderGroups();
            renderTracksList();
            initAllPlayers();
        },
        initAllPlayers,
        get tracks() {
            return tracks;
        },
        get groups() {
            return groups;
        },
        get players() {
            return players;
        },
        applyGroupVolumes,
        controlGroup,
        exportData,
        importDataFromFile
    });

    window.onYouTubeIframeAPIReady = () => {
        YTready = true;
        try {
            window.dmMusic && window.dmMusic.initAllPlayers();
        } catch {
        }
    };

})();
