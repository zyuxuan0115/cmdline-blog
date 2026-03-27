// ─── Terminal Resize ──────────────────────────────────────────────────────────

(function () {
  const panel  = document.getElementById('terminal-panel');
  const handle = document.getElementById('terminal-resize-handle');

  handle.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startY      = e.clientY;
    const startHeight = panel.offsetHeight;
    handle.classList.add('dragging');

    function onMove(e) {
      const delta = startY - e.clientY;       // drag up → taller
      const min   = parseInt(getComputedStyle(panel).minHeight);
      const max   = parseInt(getComputedStyle(panel).maxHeight);
      panel.style.height = Math.min(max, Math.max(min, startHeight + delta)) + 'px';
    }

    function onUp() {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
})();
