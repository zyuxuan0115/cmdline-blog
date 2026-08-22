// ─── Document Windows ─────────────────────────────────────────────────────────

// Documents are written in a plain editor, where pressing Enter means "new
// line" — not markdown's "same paragraph". `breaks` keeps those single
// newlines, in the preview and on the blog page alike.
if (typeof marked !== 'undefined') marked.setOptions({ gfm: true, breaks: true });

function openDocument(name, content = '', visibility = 'private', title = '', initialMode = 'edit', readOnly = false, staticTags = null) {
  const win = buildWindow(name, content, visibility, title, initialMode, readOnly, staticTags);
  container.appendChild(win);
  docs[name] = { content, win, visibility, readOnly };
  focusWindow(win);
  // CodeMirror measures itself, so it needs a nudge once the window is on-screen.
  if (win._editor) win._editor.refresh();
  updateHint();
  refreshOpenMarkers();
}

function closeDocument(name) {
  const win = docs[name].win;
  win.remove();
  delete docs[name];
  updateHint();
  refreshOpenMarkers();
}

// Someone else's document is keyed by author, so it can't collide with a
// document of your own that happens to have the same hash.
function docKeyFor(filename, authorName, isMine) {
  return isMine ? filename : `${authorName || 'unknown'}/${filename}`;
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

const HASH_RE = /^[a-f0-9]{64}$/;

// Rewrite ![alt](hash) and [text](hash) inside rendered preview so they
// open/focus the doc instead of trying to load as image / navigate away.
function rewriteDocLinks(root) {
  root.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (!HASH_RE.test(src)) return;
    const a = document.createElement('a');
    a.className = 'doc-link';
    a.dataset.hash = src;
    a.href = '#';
    a.textContent = img.getAttribute('alt') || src.slice(0, 8) + '…';
    img.replaceWith(a);
  });
  root.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!HASH_RE.test(href)) return;
    a.dataset.hash = href;
    a.classList.add('doc-link');
    a.setAttribute('href', '#');
  });
}

async function openByHash(hash) {
  if (docs[hash]) { focusWindow(docs[hash].win); return; }
  for (const k of Object.keys(docs)) {
    if (k.endsWith('/' + hash)) { focusWindow(docs[k].win); return; }
  }

  let snap;
  try {
    snap = await docRef(hash).get();
  } catch (e) { print(`Error: ${e.message}`, 'error'); return; }
  const d = snap.exists ? snap.data() : null;

  // Own doc — opens ready to edit (vim in normal mode); the Preview tab reads it.
  if (d && d.user_id === currentUser.uid) {
    openDocument(hash, d.content, d.visibility, d.title || '', 'edit', false, d.tags || []);
    print(`Opened: ${d.title || hash.slice(0, 8) + '…'}`, 'success');
    return;
  }

  // Foreign doc, read-only. The get() above already succeeded, so the rules
  // allowed it — public, or shared with us because we're friends.
  if (d && (d.visibility === 'public' || d.visibility === 'shared')) {
    const key = docKeyFor(hash, d.author_name, false);
    openDocument(key, d.content, d.visibility, d.title || '', 'preview', true, d.tags || []);
    print(`Opened: ${d.title || key} (read-only)`, 'success');
    return;
  }

  print(`Error: cannot view document ${hash.slice(0, 8)}… — it is private to another user, or does not exist.`, 'error');
}

function updateHint() {
  let hint = document.getElementById('desktop-hint');
  if (Object.keys(docs).length === 0) {
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'desktop-hint';
      hint.innerHTML = `<h2>No documents open</h2>
        <div class="desktop-about">
          <h3>About</h3>
          <p>A retro terminal-style blog for writing, tagging, and publishing markdown documents. Public posts are shared with everyone; private notes stay just for you. Type <code>commands</code> in the terminal below to get started.</p>
          <h3>Source Code</h3>
          <p class="desktop-about-repo"><a href="https://github.com/zyuxuan0115/cmdline-blog" target="_blank" rel="noopener">github.com/zyuxuan0115/cmdline-blog</a></p>
        </div>`;
      container.appendChild(hint);
    }
  } else if (hint) {
    hint.remove();
  }
}

// ─── Window Builder ───────────────────────────────────────────────────────────

function buildWindow(name, initialContent = '', initialVisibility = 'private', initialTitle = '', initialMode = 'edit', readOnly = false, staticTags = null) {
  if (readOnly) initialMode = 'preview';
  const win = document.createElement('div');
  win.className = 'doc-window';
  // Focusable so Ctrl+` can move DOM focus here even in preview mode
  // (where the editor textarea is hidden and nothing else is focusable).
  win.tabIndex = -1;

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
  titleEl.textContent = initialTitle || '<untitled>';

  const tabGroup = document.createElement('div');
  tabGroup.className = 'doc-tab-group';

  const btnEdit    = makeBtn('Edit',    'doc-tab active');
  const btnPreview = makeBtn('Preview', 'doc-tab');

  if (!readOnly) {
    tabGroup.appendChild(btnEdit);
    tabGroup.appendChild(btnPreview);
  }

  titlebar.appendChild(lights);
  titlebar.appendChild(titleEl);
  titlebar.appendChild(tabGroup);

  // ── Title input ──
  const titleBar = document.createElement('div');
  titleBar.className = 'doc-title-bar';

  const titleInput = document.createElement('input');
  titleInput.className = 'doc-title-input';
  titleInput.type = 'text';
  titleInput.placeholder = 'Untitled';
  titleInput.value = initialTitle;
  titleInput.readOnly = readOnly;
  titleBar.appendChild(titleInput);

  if (!readOnly) {
    let titleSaveTimer;
    titleInput.addEventListener('input', () => {
      titleEl.textContent = titleInput.value || '<untitled>';
      clearTimeout(titleSaveTimer);
      titleSaveTimer = setTimeout(() => {
        const newTitle = titleInput.value;
        docRef(name)
          .update({ title: newTitle })
          .then(() => {
            updateListSidebarDoc(name, { title: newTitle });
          });
      }, 800);
    });
  }

  // ── Toolbar ──
  const toolbar = document.createElement('div');
  toolbar.className = 'doc-toolbar';

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

  // Visibility cycles: private → shared (friends) → public → private.
  const VIS_LABEL = { private: '🔒 Private', shared: '👥 Shared', public: '🌐 Public' };
  const VIS_NEXT  = { private: 'shared', shared: 'public', public: 'private' };

  function refreshVisBtn() {
    const v = docs[name] ? docs[name].visibility : initialVisibility;
    visBtn.textContent = VIS_LABEL[v] || VIS_LABEL.private;
    visBtn.title = `Click to make ${VIS_NEXT[v] || 'shared'}`;
  }
  refreshVisBtn();
  visBtn.addEventListener('click', async () => {
    const current = docs[name] ? docs[name].visibility : initialVisibility;
    const next = VIS_NEXT[current] || 'shared';
    await dbSetVisibility(name, next);
    print(`"${name}" is now ${next}.`, 'success');
  });
  win._refreshVisBtn = refreshVisBtn;

  // Vim toggle + current mode. The toggle applies to every open window, so a
  // user who doesn't want modal editing turns it off once.
  const vimBtn = makeBtn('VIM', 'toolbar-btn vim-btn');
  vimBtn.title = 'Toggle vim keys in every editor';
  const vimBadge = document.createElement('span');
  vimBadge.className = 'vim-mode';

  function showVimMode(mode, subMode) {
    const off = mode === 'off';
    vimBtn.classList.toggle('active', !off);
    vimBadge.textContent = off ? '' : `-- ${(subMode || mode).toUpperCase()} --`;
  }

  vimBtn.addEventListener('click', () => setVimEverywhere(!vimEnabled()));

  const savedIndicator = document.createElement('span');
  savedIndicator.className = 'doc-saved';

  const tagPillsEl = document.createElement('div');
  tagPillsEl.className = 'tag-pills';

  const tagAddInput = document.createElement('input');
  tagAddInput.className = 'tag-add-input';
  tagAddInput.placeholder = '+ add tag';
  tagAddInput.title = 'Type a tag name and press Enter';

  if (!readOnly) {
    toolbar.appendChild(uploadLabel);
    toolbar.appendChild(visBtn);
    if (vimAvailable()) toolbar.appendChild(vimBtn);
  }
  toolbar.appendChild(tagPillsEl);
  if (!readOnly) {
    toolbar.appendChild(tagAddInput);
    toolbar.appendChild(vimBadge);
    toolbar.appendChild(savedIndicator);
  }

  async function refreshTagBar() {
    tagPillsEl.innerHTML = '';
    const tags = readOnly ? (staticTags || []) : await getTags(name);
    tags.forEach(tag => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.innerHTML = readOnly
        ? `#${tag}`
        : `#${tag} <button class="tag-pill-remove" title="Remove tag">×</button>`;
      if (!readOnly) {
        pill.querySelector('.tag-pill-remove').addEventListener('click', async e => {
          e.stopPropagation();
          await removeFileTag(name, tag);
        });
      }
      tagPillsEl.appendChild(pill);
    });
  }

  if (!readOnly) {
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
  }

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
  editor.readOnly = readOnly;

  const preview = document.createElement('div');
  preview.className = 'doc-preview';

  preview.addEventListener('click', e => {
    const a = e.target.closest('a.doc-link');
    if (!a) return;
    e.preventDefault();
    openByHash(a.dataset.hash);
  });

  content.appendChild(editor);
  content.appendChild(preview);

  // Read-only windows never leave preview, so they keep the bare textarea.
  const ed = readOnly
    ? plainDocEditor(editor, {})
    : createDocEditor(editor, {
        onChange: () => scheduleSave(),
        onSave: () => saveNow(),
        onQuit: () => { closeDocument(name); print(`Closed: ${name}`, 'success'); },
        onPreview: () => switchToPreview(),
        onModeChange: showVimMode,
      });
  win._editor = ed;
  win._setVim = on => ed.setVim(on);

  // ── Resize handle ──
  const resize = document.createElement('div');
  resize.className = 'doc-resize';

  // ── Assemble ──
  win.appendChild(titlebar);
  win.appendChild(titleBar);
  if (!readOnly || (staticTags && staticTags.length > 0)) win.appendChild(toolbar);
  win.appendChild(content);
  win.appendChild(resize);

  // ─── Logic ───

  // Mode toggle
  let mode = initialMode;

  // The controls that only make sense while editing; preview keeps just the
  // tags and the tabs.
  function showEditingTools(show) {
    [uploadLabel, visBtn, vimBtn, vimBadge].forEach(el => {
      el.style.display = show ? '' : 'none';
    });
    titleInput.readOnly = !show;
    win.classList.toggle('preview-mode', !show);
  }

  function switchToEdit() {
    mode = 'edit';
    ed.show();
    preview.classList.remove('visible');
    btnEdit.classList.add('active');
    btnPreview.classList.remove('active');
    showEditingTools(true);
    ed.focusNormal();
  }

  function switchToPreview() {
    mode = 'preview';
    preview.innerHTML = marked.parse(ed.getValue() || '*No content yet.*');
    rewriteDocLinks(preview);
    ed.hide();
    preview.classList.add('visible');
    btnPreview.classList.add('active');
    btnEdit.classList.remove('active');
    showEditingTools(false);
  }

  // Expose the edit switcher so Ctrl+` can flip an owned doc into edit mode,
  // plus the mode/focus helpers the terminal hotkeys need.
  if (!readOnly) win._switchToEdit = switchToEdit;
  win._isPreview = () => mode === 'preview';
  win._focusEditor = () => { if (mode === 'edit') ed.focusNormal(); };

  // Auto-save, debounced, with the toolbar indicator following along. `:w`
  // calls saveNow() directly.
  let saveTimer;

  function saveNow() {
    clearTimeout(saveTimer);
    savedIndicator.textContent = 'saving…';
    return docRef(name)
      .update({ content: ed.getValue(), updated_at: new Date().toISOString() })
      .then(() => { savedIndicator.textContent = 'saved ✓'; })
      .catch(() => { savedIndicator.textContent = 'save failed ✗'; });
  }

  function scheduleSave() {
    if (readOnly || !docs[name]) return;   // still being built, or not ours
    docs[name].content = ed.getValue();
    savedIndicator.textContent = 'unsaved';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 800);
  }

  if (!readOnly) {
    btnEdit.addEventListener('click', switchToEdit);
    btnPreview.addEventListener('click', switchToPreview);
  }

  // Load content then apply initial mode (order matters — preview reads the editor)
  if (initialContent) {
    ed.setValue(initialContent);
    savedIndicator.textContent = 'loaded ✓';
  }
  if (initialMode === 'preview') switchToPreview();
  else switchToEdit();

  // Image upload
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      const md = `\n![${file.name}](${dataUrl})\n`;
      ed.insertAtCursor(md);
      if (mode === 'preview') switchToPreview();
      scheduleSave();
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

  // Dragging the corner, maximizing, or un-minimizing all change the editor's
  // box; CodeMirror needs to re-measure afterwards.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => ed.refresh()).observe(content);
  }

  return win;
}
