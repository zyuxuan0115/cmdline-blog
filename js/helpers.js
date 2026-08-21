// ─── UI Helpers ──────────────────────────────────────────────────────────────

function formatTimeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
  return new Date(dateStr).toLocaleDateString();
}

function makeTL(cls) {
  const el = document.createElement('div');
  el.className = `tl ${cls}`;
  return el;
}

function makeBtn(text, cls) {
  const btn = document.createElement('button');
  btn.className = cls;
  btn.textContent = text;
  return btn;
}

function makeDraggable(win, handle) {
  let startX, startY, startLeft, startTop;

  handle.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (win.dataset.maximized) return;
    e.preventDefault();
    startX    = e.clientX;
    startY    = e.clientY;
    startLeft = parseInt(win.style.left) || 0;
    startTop  = parseInt(win.style.top)  || 0;

    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      win.style.left = Math.max(0, startLeft + dx) + 'px';
      win.style.top  = Math.max(0, startTop  + dy) + 'px';
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function makeResizable(win, handle) {
  let startX, startY, startW, startH;

  handle.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    startX = e.clientX;
    startY = e.clientY;
    startW = win.offsetWidth;
    startH = win.offsetHeight;

    function onMove(e) {
      const w = Math.max(400, startW + (e.clientX - startX));
      const h = Math.max(280, startH + (e.clientY - startY));
      win.style.width  = w + 'px';
      win.style.height = h + 'px';
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// Copy text to the system clipboard. The async Clipboard API needs a secure
// context (https or localhost), so fall back to the old hidden-textarea trick
// when it isn't there. Returns whether the copy went through.
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) { /* denied or unavailable — try the fallback */ }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  const selection = document.getSelection();
  const previous = selection.rangeCount ? selection.getRangeAt(0) : null;
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
  ta.remove();
  if (previous) { selection.removeAllRanges(); selection.addRange(previous); }
  return ok;
}

// What to call the clipboard modifier when telling someone how to paste.
function modKeyName() {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'Cmd' : 'Ctrl';
}
