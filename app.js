// ─── Supabase ─────────────────────────────────────────────────────────────────

const _supabase = supabase.createClient(
  'https://emjhatsnkpvnszueetoi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtamhhdHNua3B2bnN6dWVldG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjQ5MzMsImV4cCI6MjA4OTMwMDkzM30.P2V9k6GNHwl3s01USbL4U11PIMjYR2A_OjGnral7qY8'
);

// ─── State ───────────────────────────────────────────────────────────────────

const docs = {};           // filename → { content, win }
let cmdHistory = [];
let historyIndex = -1;
let zCounter = 100;
let currentUser = null;   // currently logged-in Supabase user

function requireLogin() {
  if (!currentUser) { print('You must be logged in. Use  login <email> <password>', 'error'); return false; }
  return true;
}

// ─── Supabase Document Helpers ────────────────────────────────────────────────

async function dbFileExists(name) {
  const { data } = await _supabase.from('documents').select('filename').eq('user_id', currentUser.id).eq('filename', name).maybeSingle();
  return !!data;
}

async function dbSetVisibility(name, vis) {
  await _supabase.from('documents').update({ visibility: vis }).eq('user_id', currentUser.id).eq('filename', name);
  if (docs[name]) { docs[name].visibility = vis; docs[name].win._refreshVisBtn(); }
}

// ─── Tag Helpers (Supabase) ───────────────────────────────────────────────────

async function getTags(filename) {
  const { data } = await _supabase.from('documents').select('tags').eq('user_id', currentUser.id).eq('filename', filename).maybeSingle();
  return data?.tags || [];
}

async function addFileTag(filename, tag) {
  const tags = await getTags(filename);
  if (tags.includes(tag)) return false;
  await _supabase.from('documents').update({ tags: [...tags, tag] }).eq('user_id', currentUser.id).eq('filename', filename);
  if (docs[filename]) docs[filename].win._refreshTagBar();
  return true;
}

async function removeFileTag(filename, tag) {
  const tags = await getTags(filename);
  if (!tags.includes(tag)) return false;
  await _supabase.from('documents').update({ tags: tags.filter(t => t !== tag) }).eq('user_id', currentUser.id).eq('filename', filename);
  if (docs[filename]) docs[filename].win._refreshTagBar();
  return true;
}

async function getFilesWithTag(tag) {
  const { data } = await _supabase.from('documents').select('filename').eq('user_id', currentUser.id).contains('tags', [tag]);
  return (data || []).map(d => d.filename).sort();
}

async function getAllTags() {
  const { data } = await _supabase.from('documents').select('tags').eq('user_id', currentUser.id);
  const tagSet = new Set();
  (data || []).forEach(d => (d.tags || []).forEach(t => tagSet.add(t)));
  return [...tagSet].sort();
}

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
    print('  create   <filename>             — create a new document', 'muted');
    print('  new      <filename>             — alias for create', 'muted');
    print('  open     <filename>             — open / focus existing document', 'muted');
    print('  close    <filename>             — close a document window', 'muted');
    print('  list                           — list all open documents', 'muted');
    print('  tag      <filename> <tag>      — add a tag to a document', 'muted');
    print('  untag    <filename> <tag>      — remove a tag from a document', 'muted');
    print('  tags     [tag]                 — list tags or files under a tag', 'muted');
    print('  publish  <filename>            — make a document public', 'muted');
    print('  unpublish <filename>           — make a document private', 'muted');
    print('  register <email> <password>    — create a new account', 'muted');
    print('  login    <email> <password>    — sign in to your account', 'muted');
    print('  logout                         — sign out', 'muted');
    print('  whoami                         — show current logged-in user', 'muted');
    print('  clear                          — clear terminal output', 'muted');
    print('  help                           — show this message', 'muted');
  },

  async create(args) {
    if (!requireLogin()) return;
    const parts = args.trim().split(/\s+/);
    const name = parts[0];
    if (!name) { print('Usage: create <filename> [--public]', 'error'); return; }
    if (docs[name] || await dbFileExists(name)) {
      print(`Error: "${name}" already exists. Use  open ${name}  to open it.`, 'error');
      return;
    }
    const vis = parts.includes('--public') ? 'public' : 'private';
    const { error } = await _supabase.from('documents').insert({ user_id: currentUser.id, filename: name, content: '', visibility: vis });
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    openDocument(name, '', vis);
    print(`Created document: ${name} [${vis}]`, 'success');
  },

  new(args) { COMMANDS.create(args); },

  async open(args) {
    if (!requireLogin()) return;
    const name = args.trim();
    if (!name) { print('Usage: open <filename>', 'error'); return; }
    if (docs[name]) {
      focusWindow(docs[name].win);
      print(`Focused: ${name}`, 'success');
      return;
    }
    const { data, error } = await _supabase.from('documents').select('content, visibility').eq('user_id', currentUser.id).eq('filename', name).maybeSingle();
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    if (!data) { print(`Error: "${name}" does not exist. Use  create ${name}  to create it.`, 'error'); return; }
    openDocument(name, data.content, data.visibility);
    print(`Opened: ${name}`, 'success');
  },

  close(args) {
    const name = args.trim();
    if (!name) { print('Usage: close <filename>', 'error'); return; }
    if (!docs[name]) { print(`"${name}" is not open.`, 'error'); return; }
    closeDocument(name);
    print(`Closed: ${name}`, 'success');
  },

  async list() {
    if (!requireLogin()) return;
    const { data, error } = await _supabase.from('documents').select('filename, visibility, tags').eq('user_id', currentUser.id).order('filename');
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    if (data.length === 0) { print('No documents found.', 'muted'); return; }
    print(`All documents (${data.length}):`, 'info');
    data.forEach(({ filename, visibility, tags }) => {
      const open = docs[filename] ? ' [open]' : '';
      const vis = visibility === 'public' ? ' [public]' : ' [private]';
      const tagStr = tags && tags.length ? '  ' + tags.map(t => `#${t}`).join(' ') : '';
      print(`  • ${filename}${open}${vis}${tagStr}`, 'muted');
    });
  },

  async tag(args) {
    if (!requireLogin()) return;
    const parts = args.trim().split(/\s+/);
    if (parts.length < 2 || !parts[1]) { print('Usage: tag <filename> <tagname>', 'error'); return; }
    const [filename, tag] = parts;
    if (!docs[filename] && !await dbFileExists(filename)) {
      print(`Error: "${filename}" does not exist.`, 'error'); return;
    }
    if (await addFileTag(filename, tag)) {
      print(`Tagged "${filename}" with #${tag}`, 'success');
    } else {
      print(`"${filename}" already has tag #${tag}`, 'info');
    }
  },

  async untag(args) {
    if (!requireLogin()) return;
    const parts = args.trim().split(/\s+/);
    if (parts.length < 2 || !parts[1]) { print('Usage: untag <filename> <tagname>', 'error'); return; }
    const [filename, tag] = parts;
    if (await removeFileTag(filename, tag)) {
      print(`Removed #${tag} from "${filename}"`, 'success');
    } else {
      print(`"${filename}" does not have tag #${tag}`, 'error');
    }
  },

  async tags(args) {
    if (!requireLogin()) return;
    const tag = args.trim();
    if (!tag) {
      const allTags = await getAllTags();
      if (allTags.length === 0) { print('No tags found.', 'muted'); return; }
      print(`All tags (${allTags.length}):`, 'info');
      allTags.forEach(t => print(`  #${t}`, 'muted'));
      return;
    }
    const files = await getFilesWithTag(tag);
    if (files.length === 0) { print(`No files tagged with #${tag}`, 'muted'); return; }
    print(`Files tagged #${tag} (${files.length}):`, 'info');
    files.forEach(f => print(`  • ${f}`, 'muted'));
  },

  async publish(args) {
    if (!requireLogin()) return;
    const name = args.trim();
    if (!name) { print('Usage: publish <filename>', 'error'); return; }
    if (!docs[name] && !await dbFileExists(name)) { print(`Error: "${name}" does not exist.`, 'error'); return; }
    await dbSetVisibility(name, 'public');
    print(`"${name}" is now public.`, 'success');
  },

  async unpublish(args) {
    if (!requireLogin()) return;
    const name = args.trim();
    if (!name) { print('Usage: unpublish <filename>', 'error'); return; }
    if (!docs[name] && !await dbFileExists(name)) { print(`Error: "${name}" does not exist.`, 'error'); return; }
    await dbSetVisibility(name, 'private');
    print(`"${name}" is now private.`, 'success');
  },

  async register(args) {
    const parts = args.trim().split(/\s+/);
    if (parts.length < 2 || !parts[1]) { print('Usage: register <email> <password>', 'error'); return; }
    const [email, password] = parts;
    print(`Registering ${email}…`, 'muted');
    const { error } = await _supabase.auth.signUp({ email, password });
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    print(`Registered! Check your email (${email}) to confirm your account.`, 'success');
  },

  async login(args) {
    const parts = args.trim().split(/\s+/);
    if (parts.length < 2 || !parts[1]) { print('Usage: login <email> <password>', 'error'); return; }
    const [email, password] = parts;
    print(`Signing in…`, 'muted');
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    currentUser = data.user;
    updatePrompt(data.user.email);
    print(`Logged in as ${data.user.email}`, 'success');
  },

  async logout() {
    const { error } = await _supabase.auth.signOut();
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    currentUser = null;
    updatePrompt(null);
    print('Logged out.', 'success');
  },

  async whoami() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) { print('Not logged in.', 'muted'); return; }
    print(`Logged in as: ${user.email}`, 'info');
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

function openDocument(name, content = '', visibility = 'private') {
  const win = buildWindow(name, content, visibility);
  container.appendChild(win);
  docs[name] = { content, win, visibility };
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

function buildWindow(name, initialContent = '', initialVisibility = 'private') {
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

  const visBtn = document.createElement('button');
  visBtn.className = 'toolbar-btn vis-btn';

  function refreshVisBtn() {
    const v = docs[name] ? docs[name].visibility : initialVisibility;
    visBtn.textContent = v === 'public' ? '🌐 Public' : '🔒 Private';
    visBtn.title = v === 'public' ? 'Click to make private' : 'Click to make public';
  }
  refreshVisBtn();
  visBtn.addEventListener('click', async () => {
    const current = docs[name] ? docs[name].visibility : initialVisibility;
    const next = current === 'public' ? 'private' : 'public';
    await dbSetVisibility(name, next);
    print(`"${name}" is now ${next}.`, 'success');
  });
  win._refreshVisBtn = refreshVisBtn;

  const savedIndicator = document.createElement('span');
  savedIndicator.className = 'doc-saved';

  toolbar.appendChild(btnEdit);
  toolbar.appendChild(btnPreview);
  toolbar.appendChild(divider);
  toolbar.appendChild(uploadLabel);
  toolbar.appendChild(visBtn);
  toolbar.appendChild(savedIndicator);

  // ── Tag bar ──
  const tagbar = document.createElement('div');
  tagbar.className = 'doc-tagbar';

  const tagPillsEl = document.createElement('div');
  tagPillsEl.className = 'tag-pills';

  const tagAddInput = document.createElement('input');
  tagAddInput.className = 'tag-add-input';
  tagAddInput.placeholder = '+ add tag';
  tagAddInput.title = 'Type a tag name and press Enter';

  tagbar.appendChild(tagPillsEl);
  tagbar.appendChild(tagAddInput);

  async function refreshTagBar() {
    tagPillsEl.innerHTML = '';
    const tags = await getTags(name);
    tags.forEach(tag => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.innerHTML = `#${tag} <button class="tag-pill-remove" title="Remove tag">×</button>`;
      pill.querySelector('.tag-pill-remove').addEventListener('click', async e => {
        e.stopPropagation();
        await removeFileTag(name, tag);
      });
      tagPillsEl.appendChild(pill);
    });
  }

  tagAddInput.addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      const tag = tagAddInput.value.trim().replace(/\s+/g, '-').replace(/^#+/, '');
      tagAddInput.value = '';
      if (!tag) return;
      if (await addFileTag(name, tag)) {
        print(`Tagged "${name}" with #${tag}`, 'success');
      } else {
        print(`"${name}" already has tag #${tag}`, 'info');
      }
    }
  });

  // Expose refresh so tag commands can update an open window
  win._refreshTagBar = refreshTagBar;
  refreshTagBar();

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
  win.appendChild(tagbar);
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
      savedIndicator.textContent = 'saving…';
      _supabase.from('documents')
        .update({ content: editor.value, updated_at: new Date().toISOString() })
        .eq('user_id', currentUser.id).eq('filename', name)
        .then(({ error }) => {
          savedIndicator.textContent = error ? 'save failed ✗' : 'saved ✓';
        });
    }, 800);
  });

  // Load content passed in from Supabase
  if (initialContent) {
    editor.value = initialContent;
    savedIndicator.textContent = 'loaded ✓';
  }

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

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

const promptEl = document.getElementById('terminal-prompt');

function updatePrompt(email) {
  promptEl.textContent = email ? `${email} $ ` : '$ ';
}

// ─── Init ─────────────────────────────────────────────────────────────────────

printBanner();
updateHint();
input.focus();

// Restore existing session on page load
_supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    currentUser = session.user;
    updatePrompt(session.user.email);
    print(`Restored session: ${session.user.email}`, 'muted');
  }
});
