const notesEl = document.getElementById('notes');
const saveNotesBtn = document.getElementById('saveNotes');
const clearNotesBtn = document.getElementById('clearNotes');

const NOTES_KEY = 'dm_notes_v1';

const escapeHtml = s => String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": "&#39;"
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
            const el = document.getElementById(tab);
            if (el) el.classList.add('active');
        });
    });
});

const loadNotes = () => {
    if (!notesEl) return;
    const t = localStorage.getItem(NOTES_KEY);
    if (t) notesEl.value = t;
};
const saveNotes = () => {
    if (!notesEl) return;
    localStorage.setItem(NOTES_KEY, notesEl.value);
};
if (saveNotesBtn) saveNotesBtn.addEventListener('click', saveNotes);
if (clearNotesBtn) clearNotesBtn.addEventListener('click', () => {
    if (!notesEl) return;
    if (confirm('\u00BFBorrar notas?')) {
        notesEl.value = '';
        saveNotes();
    }
});
if (notesEl) loadNotes();

function updateTopOffset() {
    try {
        const header = document.querySelector('.title-row');
        const extra = 24;
        const h = header ? Math.ceil(header.getBoundingClientRect().height + extra) : 140;
        document.documentElement.style.setProperty('--top-offset', h + 'px');
    } catch (e) {
    }
}

window.addEventListener('resize', updateTopOffset);
updateTopOffset();

function initAll() {
    try {
        if (window.dmMusic && typeof window.dmMusic.init === 'function') window.dmMusic.init();
    } catch (e) {
    }
    try {
        if (window.dmImages && typeof window.dmImages.init === 'function') window.dmImages.init();
    } catch (e) {
    }
    try {
        if (window.dmEnemies && typeof window.dmEnemies.init === 'function') window.dmEnemies.init();
    } catch (e) {
    }
}

initAll();

(function () {
    const overlay = document.createElement('div');
    overlay.id = 'jsErrorOverlay';
    overlay.style.position = 'fixed';
    overlay.style.right = '12px';
    overlay.style.bottom = '12px';
    overlay.style.zIndex = 99999;
    overlay.style.maxWidth = '480px';
    overlay.style.maxHeight = '40vh';
    overlay.style.overflow = 'auto';
    overlay.style.background = 'rgba(0,0,0,0.8)';
    overlay.style.color = 'white';
    overlay.style.padding = '8px';
    overlay.style.borderRadius = '8px';
    overlay.style.fontSize = '13px';
    overlay.style.display = 'none';
    overlay.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';
    document.body.appendChild(overlay);

    function show(msg) {
        overlay.style.display = 'block';
        const p = document.createElement('div');
        p.style.marginBottom = '6px';
        p.textContent = (new Date()).toLocaleTimeString() + ' — ' + msg;
        overlay.appendChild(p);
        while (overlay.childNodes.length > 10) overlay.removeChild(overlay.firstChild);
    }

    window.addEventListener('error', function (ev) {
        try {
            show('Error: ' + (ev && ev.message ? ev.message : String(ev)));
        } catch (e) {
        }
    });
    window.addEventListener('unhandledrejection', function (ev) {
        try {
            show('Unhandled Rejection: ' + (ev && ev.reason ? ev.reason : String(ev)));
        } catch (e) {
        }
    });
})();
