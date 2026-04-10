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

// ─── Sidebar Horizontal Resize ───────────────────────────────────────────────

(function () {
  const sidebar    = document.getElementById('help-sidebar');
  const handle     = document.getElementById('help-sidebar-drag-handle');
  const desktop    = document.getElementById('desktop');

  handle.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX     = e.clientX;
    const startWidth = sidebar.offsetWidth;
    sidebar.classList.add('dragging');

    function onMove(e) {
      const delta = startX - e.clientX; // drag left → wider
      const newWidth = Math.max(200, Math.min(window.innerWidth * 0.8, startWidth + delta));
      desktop.style.setProperty('--sidebar-w', newWidth + 'px');
    }

    function onUp() {
      sidebar.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
})();
