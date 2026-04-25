// ─── Document Windows ─────────────────────────────────────────────────────────

function openDocument(name, content = '', visibility = 'private', title = '', initialMode = 'edit', readOnly = false, staticTags = null) {
  const win = buildWindow(name, content, visibility, title, initialMode, readOnly, staticTags);
  container.appendChild(win);
  docs[name] = { content, win, visibility, readOnly };
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

function buildWindow(name, initialContent = '', initialVisibility = 'private', initialTitle = '', initialMode = 'edit', readOnly = false, staticTags = null) {
  if (readOnly) initialMode = 'preview';
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
      clearTimeout(titleSaveTimer);
      titleSaveTimer = setTimeout(() => {
        _supabase.from('documents')
          .update({ title: titleInput.value })
          .eq('user_id', currentUser.id).eq('filename', name)
          .then(() => {});
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

  const tagAddInput = document.createElement('input');
  tagAddInput.className = 'tag-add-input';
  tagAddInput.placeholder = '+ add tag';
  tagAddInput.title = 'Type a tag name and press Enter';

  toolbar.appendChild(uploadLabel);
  toolbar.appendChild(visBtn);
  toolbar.appendChild(tagAddInput);
  toolbar.appendChild(savedIndicator);

  // ── Tag bar ──
  const tagbar = document.createElement('div');
  tagbar.className = 'doc-tagbar';

  const tagPillsEl = document.createElement('div');
  tagPillsEl.className = 'tag-pills';

  tagbar.appendChild(tagPillsEl);

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

  content.appendChild(editor);
  content.appendChild(preview);

  // ── Resize handle ──
  const resize = document.createElement('div');
  resize.className = 'doc-resize';

  // ── Assemble ──
  win.appendChild(titlebar);
  win.appendChild(titleBar);
  if (!readOnly) win.appendChild(toolbar);
  win.appendChild(tagbar);
  win.appendChild(content);
  win.appendChild(resize);

  // ─── Logic ───

  // Mode toggle
  let mode = initialMode;

  function switchToEdit() {
    mode = 'edit';
    editor.style.display = 'block';
    preview.classList.remove('visible');
    btnEdit.classList.add('active');
    btnPreview.classList.remove('active');
    uploadLabel.style.display = '';
    visBtn.style.display = '';
    editor.focus();
  }

  function switchToPreview() {
    mode = 'preview';
    preview.innerHTML = marked.parse(editor.value || '*No content yet.*');
    editor.style.display = 'none';
    preview.classList.add('visible');
    btnPreview.classList.add('active');
    btnEdit.classList.remove('active');
    uploadLabel.style.display = 'none';
    visBtn.style.display = 'none';
  }

  if (!readOnly) {
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
  }

  // Load content then apply initial mode (order matters — preview reads editor.value)
  if (initialContent) {
    editor.value = initialContent;
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
