// ─── Terminal ─────────────────────────────────────────────────────────────────

function printBanner() {
  print('╔════════════════════════════════════════╗', 'muted');
  print('║      Terminal Document Editor  v1.0    ║', 'success');
  print('╚════════════════════════════════════════╝', 'muted');
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
    const parts = args.trim().split(/\s+/);
    const name = parts[0];
    if (!name) { print('Usage: create <filename> [--public]', 'error'); return; }
    if (docs[name] || await dbFileExists(name)) {
      print(`Error: "${name}" already exists. Use  open ${name}  to open it.`, 'error');
      return;
    }
    const vis = parts.includes('--public') ? 'public' : 'private';
    const { error } = await _supabase.from('documents').insert({ user_id: currentUser.id, filename: name, content: '', visibility: vis, title: '' });
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    openDocument(name, '', vis, '', 'edit');
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

  register(args) { authRegister(args); },
  login(args) { authLogin(args); },
  logout() { authLogout(); },
  whoami() { authWhoami(); },

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
