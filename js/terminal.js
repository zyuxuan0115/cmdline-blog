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
    if (!data || data.user_id !== entry.user_id || (!isMine && data.visibility !== 'public')) {
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

// Ctrl+` toggle focus between terminal and last focused document window
document.addEventListener('keydown', e => {
  if (e.ctrlKey && (e.key === '`' || e.code === 'Backquote' || e.keyCode === 192)) {
    e.preventDefault();
    e.stopPropagation();

    const isTerminalFocused = document.activeElement === input
      || document.activeElement.closest('#terminal-panel');

    if (isTerminalFocused) {
      let targetWin = document.querySelector('.doc-window.focused');
      if (!targetWin) {
        let maxZ = -1;
        document.querySelectorAll('.doc-window').forEach(w => {
          const z = parseInt(w.style.zIndex) || 0;
          if (z > maxZ) { maxZ = z; targetWin = w; }
        });
      }
      if (targetWin) {
        focusWindow(targetWin);
        const editor = targetWin.querySelector('textarea.doc-editor');
        if (editor && editor.style.display !== 'none') {
          editor.focus();
        }
      }
    } else {
      input.focus();
    }
  }
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
