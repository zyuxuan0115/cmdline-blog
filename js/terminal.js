// ─── Terminal ─────────────────────────────────────────────────────────────────

function printBanner() {
  print('Type  commands  to see available commands.', 'info');
  print('', 'muted');
}

// ─── Command parsing ──────────────────────────────────────────────────────────

// Resolve a `-h <hash>` or `-i <index>` reference to a filename.
// Returns the filename, or null after printing an error.
function resolveDocRef(flag, value) {
  if (flag === '-i') {
    if (!/^\d+$/.test(value)) { print('Error: index must be a number.', 'error'); return null; }
    if (currentSidebarView !== 'list') {
      print('Error: list sidebar is not open. Run  list  first.', 'error'); return null;
    }
    const idx = parseInt(value, 10);
    if (idx < 1 || idx > lastListedDocs.length) {
      print(`Error: index ${idx} not in last list.`, 'error'); return null;
    }
    return lastListedDocs[idx - 1].filename;
  }
  return value; // -h <hash>
}

const COMMANDS = {
  commands(args) {
    if (args.trim() === 'close') {
      closeHelpSidebar();
      return;
    }
    openHelpSidebar();
  },

  async create(args) {
    if (!requireLogin()) return;
    const argsStr = args.trim();
    const titleMatch = argsStr.match(/--title\s+'([^']*)'/);
    const title = titleMatch ? titleMatch[1] : '';
    const remaining = argsStr.replace(/--title\s+'[^']*'/, '');
    const isPublic = /(?:^|\s)--public(?:\s|$)/.test(remaining);
    const vis = isPublic ? 'public' : 'private';

    // 32-byte (256-bit) random id, hex-encoded → 64 chars
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const filename = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

    const authorName = currentUser.displayName || currentUser.email;
    const nowIso = new Date().toISOString();
    try {
      await _db.collection('documents').doc(filename).set({
        user_id: currentUser.uid, filename, content: '', visibility: vis, title,
        author_name: authorName, updated_at: nowIso, created_at: nowIso,
      });
    } catch (e) { print(`Error: ${e.message}`, 'error'); return; }
    openDocument(filename, '', vis, title, 'edit');
    addDocToListSidebar({
      filename, title, visibility: vis, tags: [],
      updated_at: nowIso,
      author_name: authorName,
      user_id: currentUser.uid,
    });
    const label = title || `${filename.slice(0, 8)}…`;
    print(`Created document: ${label} [${vis}]`, 'success');
  },

  new(args) { COMMANDS.create(args); },

  async open(args) {
    if (!requireLogin()) return;
    const arg = args.trim();
    if (!/^\d+$/.test(arg)) { print('Usage: open <index>', 'error'); return; }
    if (currentSidebarView !== 'list') {
      print('Error: list sidebar is not open. Run  list  first.', 'error');
      return;
    }
    const idx = parseInt(arg, 10);
    if (idx < 1 || idx > lastListedDocs.length) {
      print(`Error: index ${idx} not in last list.`, 'error');
      return;
    }
    const entry = lastListedDocs[idx - 1];
    const isMine = entry.user_id === currentUser.uid;
    const key = isMine ? entry.filename : `${entry.author_name || 'unknown'}/${entry.filename}`;
    if (docs[key]) {
      focusWindow(docs[key].win);
      print(`Focused: ${key}`, 'success');
      return;
    }
    let data;
    try {
      const snap = await _db.collection('documents').doc(entry.filename).get();
      data = snap.exists ? snap.data() : null;
    } catch (e) { print(`Error: ${e.message}`, 'error'); return; }
    // Foreign docs are viewable only when public or shared-with-us; the get()
    // above is the real gate (rules deny a shared doc unless we're friends).
    if (!data || data.user_id !== entry.user_id
        || (!isMine && data.visibility !== 'public' && data.visibility !== 'shared')) {
      print(`Error: document not found.`, 'error'); return;
    }
    openDocument(key, data.content, data.visibility, data.title || '', 'preview', !isMine, data.tags || []);
    print(`Opened: ${key}${isMine ? '' : ' (read-only)'}`, 'success');
  },

  close(args) {
    const arg = args.trim();

    // No arg → close the currently focused window
    if (!arg) {
      const focused = document.querySelector('.doc-window.focused');
      const key = focused && Object.keys(docs).find(k => docs[k].win === focused);
      if (!key) { print('No document is focused.', 'error'); return; }
      closeDocument(key);
      print(`Closed: ${key}`, 'success');
      return;
    }

    // Numeric → only valid while the list sidebar is showing
    if (!/^\d+$/.test(arg)) { print('Usage: close [<index>]', 'error'); return; }
    if (currentSidebarView !== 'list') {
      print('Error: list sidebar is not open. Run  list  first.', 'error');
      return;
    }
    const idx = parseInt(arg, 10);
    if (idx < 1 || idx > lastListedDocs.length) {
      print(`Error: index ${idx} not in last list.`, 'error');
      return;
    }
    const entry = lastListedDocs[idx - 1];
    const isMine = entry.user_id === currentUser.uid;
    const key = isMine ? entry.filename : `${entry.author_name || 'unknown'}/${entry.filename}`;
    if (!docs[key]) { print(`"${key}" is not open.`, 'error'); return; }
    closeDocument(key);
    print(`Closed: ${key}`, 'success');
  },

  async list(args) {
    if (!requireLogin()) return;
    if (args.trim() === 'close') {
      closeHelpSidebar();
      return;
    }
    await openListSidebar(args.trim());
  },

  hash(args) {
    if (!requireLogin()) return;
    const arg = args.trim();
    if (!/^\d+$/.test(arg)) { print('Usage: hash <index>', 'error'); return; }
    if (currentSidebarView !== 'list') {
      print('Error: list sidebar is not open. Run  list  first.', 'error');
      return;
    }
    const idx = parseInt(arg, 10);
    if (idx < 1 || idx > lastListedDocs.length) {
      print(`Error: index ${idx} not in last list.`, 'error');
      return;
    }
    print(lastListedDocs[idx - 1].filename, 'info');
  },

  async tag(args) {
    if (!requireLogin()) return;
    const parts = args.trim().split(/\s+/);
    const flag = parts[0];
    if ((flag !== '-h' && flag !== '-i') || parts.length < 3 || !parts[2]) {
      print('Usage: tag -h <hash> <tag>  |  tag -i <index> <tag>', 'error'); return;
    }
    const [, target, tag] = parts;

    const filename = resolveDocRef(flag, target);
    if (!filename) return;

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
    if (parts.length < 2 || !parts[1]) { print('Usage: untag <hash> <tagname>', 'error'); return; }
    const [filename, tag] = parts;
    if (!docs[filename] && !await dbFileExists(filename)) {
      print(`Error: "${filename}" does not exist.`, 'error'); return;
    }
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
    const parts = args.trim().split(/\s+/);
    const flag = parts[0];
    if ((flag !== '-h' && flag !== '-i') || !parts[1]) {
      print('Usage: publish -h <hash>  |  publish -i <index>', 'error'); return;
    }
    const name = resolveDocRef(flag, parts[1]);
    if (!name) return;
    if (!docs[name] && !await dbFileExists(name)) { print(`Error: "${name}" does not exist.`, 'error'); return; }
    await dbSetVisibility(name, 'public');
    print(`"${name}" is now public.`, 'success');
  },

  async share(args) {
    if (!requireLogin()) return;
    const parts = args.trim().split(/\s+/);
    const flag = parts[0];
    if ((flag !== '-h' && flag !== '-i') || !parts[1]) {
      print('Usage: share -h <hash>  |  share -i <index>', 'error'); return;
    }
    const name = resolveDocRef(flag, parts[1]);
    if (!name) return;
    if (!docs[name] && !await dbFileExists(name)) { print(`Error: "${name}" does not exist.`, 'error'); return; }
    await dbSetVisibility(name, 'shared');
    print(`"${name}" is now shared with your friends.`, 'success');
  },

  async unpublish(args) {
    if (!requireLogin()) return;
    const parts = args.trim().split(/\s+/);
    const flag = parts[0];
    if ((flag !== '-h' && flag !== '-i') || !parts[1]) {
      print('Usage: unpublish -h <hash>  |  unpublish -i <index>', 'error'); return;
    }
    const name = resolveDocRef(flag, parts[1]);
    if (!name) return;
    if (!docs[name] && !await dbFileExists(name)) { print(`Error: "${name}" does not exist.`, 'error'); return; }
    await dbSetVisibility(name, 'private');
    print(`"${name}" is now private.`, 'success');
  },

  register(args) { authRegister(args); },
  login(args) { authLogin(args); },
  logout() { authLogout(); },
  whoami() { authWhoami(); },
  unregister() { authUnregister(); },

  friend(args) { sendFriendRequest(args); },

  message(args) {
    const trimmed = args.trim();
    const sp = trimmed.indexOf(' ');
    if (sp === -1) { print('Usage: message <username> <text>', 'error'); return; }
    sendDirectMessage(trimmed.slice(0, sp), trimmed.slice(sp + 1));
  },
  msg(args) { COMMANDS.message(args); },

  messages(args) {
    if (args.trim() === 'close') { closeHelpSidebar(); return; }
    openMessagesSidebar();
  },
  inbox(args) { COMMANDS.messages(args); },

  hotkeys(args) {
    if (args.trim() === 'close') {
      closeHelpSidebar();
      return;
    }
    openHotkeysSidebar();
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
    print(`Unknown command: "${cmd}". Type  commands  for a list.`, 'error');
  }
}

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const val = input.value;
    input.value = '';
    if (pendingAction) {
      const action = pendingAction;
      pendingAction = null;
      action(val);
    } else {
      runCommand(val);
    }
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

// Move focus into a document window; switch owned preview docs to edit mode.
function focusIntoWindow(win) {
  focusWindow(win);
  const editor = win.querySelector('textarea.doc-editor');
  const inPreview = !editor || editor.style.display === 'none';
  if (inPreview && win._switchToEdit) {
    win._switchToEdit();       // owned doc in preview → edit (focuses the editor)
  } else if (editor && editor.style.display !== 'none') {
    editor.focus();            // already in edit mode
  } else {
    win.focus();               // read-only doc → keep preview, focus the window
  }
}

// Return the top-most (highest z-index) document window, or null if none.
function topmostWindow() {
  let top = null, maxZ = -Infinity;
  document.querySelectorAll('.doc-window').forEach(w => {
    const z = parseInt(w.style.zIndex) || 0;
    if (z >= maxZ) { maxZ = z; top = w; }
  });
  return top;
}

// Ctrl+` toggle focus between terminal and last focused document window.
// When it moves focus into an owned document that's in preview mode, it flips
// that document to edit mode; read-only documents stay in preview.
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey && (e.key === '`' || e.code === 'Backquote' || e.keyCode === 192))) return;
  e.preventDefault();
  e.stopPropagation();

  const active = document.activeElement;
  const inTerminal = active === input || (active && active.closest('#terminal-panel'));

  if (inTerminal) {
    // From the terminal: go to the focused (or top-most) document window.
    const targetWin = document.querySelector('.doc-window.focused') || topmostWindow();
    if (targetWin) focusIntoWindow(targetWin);
  } else {
    // Focus is in a document window. If it's an owned doc still in preview,
    // flip it to edit mode; otherwise toggle back to the terminal.
    const win = (active && active.closest('.doc-window'))
      || document.querySelector('.doc-window.focused');
    const editor = win && win.querySelector('textarea.doc-editor');
    if (win && win._switchToEdit && editor && editor.style.display === 'none') {
      win._switchToEdit();
    } else {
      input.focus();
    }
  }
});

// Ctrl+X close the current document window. If another window remains, make it
// the current window; otherwise move focus back to the terminal.
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey && (e.key === 'x' || e.key === 'X' || e.code === 'KeyX'))) return;

  const active = document.activeElement;
  const win = (active && active.closest('.doc-window'))
    || document.querySelector('.doc-window.focused');
  if (!win) return;   // nothing to close — let the default Ctrl+X (cut) proceed

  e.preventDefault();
  e.stopPropagation();

  const key = Object.keys(docs).find(k => docs[k].win === win);
  if (!key) return;
  closeDocument(key);
  print(`Closed: ${key}`, 'success');

  const next = topmostWindow();
  if (next) focusIntoWindow(next);
  else input.focus();
});

// Ctrl+Z toggle the list / commands / shortcuts sidebar: close it if open,
// otherwise reopen the view that was last closed.
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ'))) return;
  if (helpSidebar.classList.contains('open')) {
    e.preventDefault();
    e.stopPropagation();
    closeHelpSidebar();
  } else if (reopenSidebar()) {   // reopened a previously closed sidebar
    e.preventDefault();
    e.stopPropagation();
  }
  // else: nothing to toggle → let the default undo proceed
});

// Ctrl+1 cycle focus to the next document window
document.addEventListener('keydown', e => {
  if (e.ctrlKey && (e.key === '1' || e.code === 'Digit1')) {
    e.preventDefault();
    e.stopPropagation();

    const wins = Array.from(document.querySelectorAll('.doc-window'));
    if (wins.length === 0) return;

    const current = document.querySelector('.doc-window.focused');
    const idx = current ? wins.indexOf(current) : -1;
    const next = wins[(idx + 1) % wins.length];

    focusWindow(next);
    const editor = next.querySelector('textarea.doc-editor');
    if (editor && editor.style.display !== 'none') {
      editor.focus();
    }
  }
});

// Keep input focused when clicking terminal panel
document.getElementById('terminal-panel').addEventListener('click', () => input.focus());
