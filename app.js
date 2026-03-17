// ─── State ───────────────────────────────────────────────────────────────────

const docs = {};           // filename → { content, window el }
let cmdHistory = [];
let historyIndex = -1;
let zCounter = 100;

// ─── Terminal ─────────────────────────────────────────────────────────────────

const output   = document.getElementById('terminal-output');
const input    = document.getElementById('terminal-input');
const container = document.getElementById('windows-container');

function print(text, cls = 'info') {
  const line = document.createElement('div');
  line.className = `terminal-line ${cls}`;
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function printBanner() {
  print('╔════════════════════════════════════════╗', 'muted');
  print('║      Terminal Document Editor  v1.0    ║', 'success');
  print('╚════════════════════════════════════════╝', 'muted');
  print('Type  help  to see available commands.', 'info');
  print('', 'muted');
}

// ─── Command parsing ──────────────────────────────────────────────────────────

const COMMANDS = {
  help() {
    print('Available commands:', 'info');
    print('  create <filename>   — create a new document', 'muted');
    print('  new    <filename>   — alias for create', 'muted');
    print('  open   <filename>   — open / focus existing document', 'muted');
    print('  close  <filename>   — close a document window', 'muted');
    print('  list               — list all open documents', 'muted');
    print('  clear              — clear terminal output', 'muted');
    print('  help               — show this message', 'muted');
  },

  create(args) {
    const name = args.trim();
    if (!name) { print('Usage: create <filename>', 'error'); return; }
    if (docs[name] || fileExists(name)) {
      print(`Error: "${name}" already exists. Use  open ${name}  to open it.`, 'error');
      return;
    }
    openDocument(name);
    print(`Created document: ${name}`, 'success');
  },

  new(args) { COMMANDS.create(args); },

  open(args) {
    const name = args.trim();
    if (!name) { print('Usage: open <filename>', 'error'); return; }
    if (docs[name]) {
      focusWindow(docs[name].win);
      print(`Focused: ${name}`, 'success');
      return;
    }
    if (!fileExists(name)) {
      print(`Error: "${name}" does not exist. Use  create ${name}  to create it.`, 'error');
      return;
    }
    openDocument(name);
    print(`Opened: ${name}`, 'success');
  },

  close(args) {
    const name = args.trim();
    if (!name) { print('Usage: close <filename>', 'error'); return; }
    if (!docs[name]) { print(`"${name}" is not open.`, 'error'); return; }
    closeDocument(name);
    print(`Closed: ${name}`, 'success');
  },

  list() {
    const names = Object.keys(docs);
    if (names.length === 0) { print('No open documents.', 'muted'); return; }
    print(`Open documents (${names.length}):`, 'info');
    names.forEach(n => print(`  • ${n}`, 'muted'));
  },

  clear() {
    output.innerHTML = '';
  }
};

function runCommand(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return;

  print(`$ ${trimmed}`, 'cmd');
  cmdHistory.unshift(trimmed);
  historyIndex = -1;

  const spaceIdx = trimmed.indexOf(' ');
  const cmd  = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const args = spaceIdx === -1 ? ''      : trimmed.slice(spaceIdx + 1);

  if (COMMANDS[cmd]) {
    COMMANDS[cmd](args);
  } else {
    print(`Unknown command: "${cmd}". Type  help  for a list.`, 'error');
  }
}

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const val = input.value;
    input.value = '';
    runCommand(val);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIndex < cmdHistory.length - 1) {
      historyIndex++;
      input.value = cmdHistory[historyIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      input.value = cmdHistory[historyIndex];
    } else {
      historyIndex = -1;
      input.value = '';
    }
  }
});

// Keep input focused when clicking terminal panel
document.getElementById('terminal-panel').addEventListener('click', () => input.focus());

// ─── Document Windows ─────────────────────────────────────────────────────────

function openDocument(name) {
  const win = buildWindow(name);
  container.appendChild(win);
  docs[name] = { content: '', win };
  focusWindow(win);
  updateHint();
}

function closeDocument(name) {
  const win = docs[name].win;
  win.remove();
  delete docs[name];
  updateHint();
}

function focusWindow(win) {
  document.querySelectorAll('.doc-window').forEach(w => w.classList.remove('focused'));
  win.classList.add('focused');
  win.style.zIndex = ++zCounter;
  // Un-minimize if minimized
  if (win.classList.contains('minimized')) {
    win.classList.remove('minimized');
  }
}

function updateHint() {
  let hint = document.getElementById('desktop-hint');
  if (Object.keys(docs).length === 0) {
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'desktop-hint';
      hint.innerHTML = `<h2>No documents open</h2><p>Type <code>create my-doc.md</code> in the terminal below</p>`;
      container.appendChild(hint);
    }
  } else if (hint) {
    hint.remove();
  }
}

// ─── Window Builder ───────────────────────────────────────────────────────────

function buildWindow(name) {
  const win = document.createElement('div');
  win.className = 'doc-window';

  // Random initial position
  const maxX = Math.max(0, container.clientWidth - 600);
  const maxY = Math.max(0, container.clientHeight - 420);
  win.style.left = (60 + Math.random() * Math.min(maxX, 300)) + 'px';
  win.style.top  = (20 + Math.random() * Math.min(maxY, 200)) + 'px';
  win.style.width  = '620px';
  win.style.height = '440px';

  // ── Title bar ──
  const titlebar = document.createElement('div');
  titlebar.className = 'doc-titlebar';

  const lights = document.createElement('div');
  lights.className = 'doc-traffic-lights';

  const tlClose    = makeTL('tl-close');
  const tlMinimize = makeTL('tl-minimize');
  const tlMaximize = makeTL('tl-maximize');

  tlClose.title    = 'Close';
  tlMinimize.title = 'Minimize';
  tlMaximize.title = 'Maximize';

  tlClose.addEventListener('click', e => { e.stopPropagation(); closeDocument(name); print(`Closed: ${name}`, 'info'); });
  tlMinimize.addEventListener('click', e => { e.stopPropagation(); win.classList.toggle('minimized'); });
  tlMaximize.addEventListener('click', e => {
    e.stopPropagation();
    if (win.dataset.maximized) {
      Object.assign(win.style, JSON.parse(win.dataset.prevStyle));
      delete win.dataset.maximized;
    } else {
      win.dataset.prevStyle = JSON.stringify({ left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height });
      Object.assign(win.style, { left: '0', top: '0', width: '100%', height: '100%' });
      win.dataset.maximized = '1';
    }
  });

  lights.appendChild(tlClose);
  lights.appendChild(tlMinimize);
  lights.appendChild(tlMaximize);

  const titleEl = document.createElement('span');
  titleEl.className = 'doc-title';
  titleEl.textContent = name;

  titlebar.appendChild(lights);
  titlebar.appendChild(titleEl);

  // ── Toolbar ──
  const toolbar = document.createElement('div');
  toolbar.className = 'doc-toolbar';

  const btnEdit    = makeBtn('Edit',    'toolbar-btn active');
  const btnPreview = makeBtn('Preview', 'toolbar-btn');
  const divider    = document.createElement('div');
  divider.className = 'toolbar-divider';

  // Image upload button
  const uploadLabel = document.createElement('label');
  uploadLabel.className = 'toolbar-btn upload-btn';
  uploadLabel.title = 'Upload image';
  uploadLabel.innerHTML = '📎 Image';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  uploadLabel.appendChild(fileInput);

  const savedIndicator = document.createElement('span');
  savedIndicator.className = 'doc-saved';

  toolbar.appendChild(btnEdit);
  toolbar.appendChild(btnPreview);
  toolbar.appendChild(divider);
  toolbar.appendChild(uploadLabel);
  toolbar.appendChild(savedIndicator);

  // ── Content ──
  const content = document.createElement('div');
  content.className = 'doc-content';

  const editor = document.createElement('textarea');
  editor.className = 'doc-editor';
  editor.placeholder = 'Start typing… Markdown is supported.\n\n# Heading\n**bold** _italic_ `code`\n\n> blockquote\n\n- list item';
  editor.spellcheck = true;

  const preview = document.createElement('div');
  preview.className = 'doc-preview';

  content.appendChild(editor);
  content.appendChild(preview);

  // ── Resize handle ──
  const resize = document.createElement('div');
  resize.className = 'doc-resize';

  // ── Assemble ──
  win.appendChild(titlebar);
  win.appendChild(toolbar);
  win.appendChild(content);
  win.appendChild(resize);

  // ─── Logic ───

  // Mode toggle
  let mode = 'edit';

  function switchToEdit() {
    mode = 'edit';
    editor.style.display = 'block';
    preview.classList.remove('visible');
    btnEdit.classList.add('active');
    btnPreview.classList.remove('active');
    editor.focus();
  }

  function switchToPreview() {
    mode = 'preview';
    preview.innerHTML = marked.parse(editor.value || '*No content yet.*');
    editor.style.display = 'none';
    preview.classList.add('visible');
    btnPreview.classList.add('active');
    btnEdit.classList.remove('active');
  }

  btnEdit.addEventListener('click', switchToEdit);
  btnPreview.addEventListener('click', switchToPreview);

  // Auto-save indicator
  let saveTimer;
  editor.addEventListener('input', () => {
    docs[name].content = editor.value;
    savedIndicator.textContent = 'unsaved';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      savedIndicator.textContent = 'saved ✓';
      // Store in localStorage
      try { localStorage.setItem(`doc:${name}`, editor.value); } catch(_) {}
    }, 800);
  });

  // Load from localStorage if exists
  try {
    const saved = localStorage.getItem(`doc:${name}`);
    if (saved) {
      editor.value = saved;
      docs[name].content = saved;
      savedIndicator.textContent = 'restored ✓';
    }
  } catch(_) {}

  // Image upload
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      const md = `\n![${file.name}](${dataUrl})\n`;
      const pos = editor.selectionStart;
      editor.value = editor.value.slice(0, pos) + md + editor.value.slice(pos);
      editor.selectionStart = editor.selectionEnd = pos + md.length;
      docs[name].content = editor.value;
      if (mode === 'preview') switchToPreview();
      savedIndicator.textContent = 'unsaved';
      editor.dispatchEvent(new Event('input'));
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  });

  // Focus on click
  win.addEventListener('mousedown', () => focusWindow(win));

  // ── Drag ──
  makeDraggable(win, titlebar);

  // ── Resize ──
  makeResizable(win, resize);

  return win;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileExists(name) {
  try { return localStorage.getItem(`doc:${name}`) !== null; } catch(_) { return false; }
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

// ─── Init ─────────────────────────────────────────────────────────────────────

printBanner();
updateHint();
input.focus();
