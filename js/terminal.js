// ─── Terminal ─────────────────────────────────────────────────────────────────

function printBanner() {
  print('Type  help  to see available commands.', 'info');
  print('', 'muted');
}

// ─── Command parsing ──────────────────────────────────────────────────────────

const COMMANDS = {
  help(args) {
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

    const authorName = currentUser.user_metadata?.username || currentUser.email;
    const { error } = await _supabase.from('documents').insert({ user_id: currentUser.id, filename, content: '', visibility: vis, title, author_name: authorName });
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    openDocument(filename, '', vis, title, 'edit');
    const label = title || `${filename.slice(0, 8)}…`;
    print(`Created document: ${label} [${vis}]`, 'success');
  },

  new(args) { COMMANDS.create(args); },

  async open(args) {
    if (!requireLogin()) return;
    const arg = args.trim();
    if (!arg) { print('Usage: open <index|filename>', 'error'); return; }

    // Numeric → resolve via the most recent  list  output
    if (/^\d+$/.test(arg)) {
      const idx = parseInt(arg, 10);
      if (idx < 1 || idx > lastListedDocs.length) {
        print(`Error: index ${idx} not in last list. Run  list  first.`, 'error');
        return;
      }
      const entry = lastListedDocs[idx - 1];
      const isMine = entry.user_id === currentUser.id;
      const key = isMine ? entry.filename : `${entry.author_name || 'unknown'}/${entry.filename}`;
      if (docs[key]) {
        focusWindow(docs[key].win);
        print(`Focused: ${key}`, 'success');
        return;
      }
      let q = _supabase.from('documents').select('content, visibility, title, tags').eq('filename', entry.filename).eq('user_id', entry.user_id);
      if (!isMine) q = q.eq('visibility', 'public');
      const { data, error } = await q.maybeSingle();
      if (error) { print(`Error: ${error.message}`, 'error'); return; }
      if (!data) { print(`Error: document not found.`, 'error'); return; }
      openDocument(key, data.content, data.visibility, data.title || '', 'preview', !isMine, data.tags || []);
      print(`Opened: ${key}${isMine ? '' : ' (read-only)'}`, 'success');
      return;
    }

    // Filename → own docs only
    const name = arg;
    if (docs[name]) {
      focusWindow(docs[name].win);
      print(`Focused: ${name}`, 'success');
      return;
    }
    const { data, error } = await _supabase.from('documents').select('content, visibility, title').eq('user_id', currentUser.id).eq('filename', name).maybeSingle();
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    if (!data) { print(`Error: "${name}" does not exist. Use  create ${name}  to create it.`, 'error'); return; }
    openDocument(name, data.content, data.visibility, data.title || '', 'preview');
    print(`Opened: ${name}`, 'success');
  },

  close(args) {
    const name = args.trim();
    if (!name) { print('Usage: close <filename>', 'error'); return; }
    if (!docs[name]) { print(`"${name}" is not open.`, 'error'); return; }
    closeDocument(name);
    print(`Closed: ${name}`, 'success');
  },

  async list(args) {
    if (!requireLogin()) return;
    await openListSidebar(args.trim());
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

  register(args) { authRegister(args); },
  login(args) { authLogin(args); },
  logout() { authLogout(); },
  whoami() { authWhoami(); },
  unregister() { authUnregister(); },

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

// Keep input focused when clicking terminal panel
document.getElementById('terminal-panel').addEventListener('click', () => input.focus());
