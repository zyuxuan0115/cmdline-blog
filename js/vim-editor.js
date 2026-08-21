// ─── Editor with vim keybindings ──────────────────────────────────────────────
// Each document window edits through CodeMirror running its vim keymap, so the
// usual modal editing works: modes, counts, motions, operators, text objects,
// registers, macros, marks, `/` search and `:` ex commands.
//
// Ex commands wired to the app:
//   :w   save now      :q   close the window      :wq / :x  save and close
//   :pre[view]  switch the window to preview mode
//
// Windows talk to the editor through the small adapter returned by
// createDocEditor(), never to CodeMirror directly. If the CodeMirror CDN is
// unreachable the adapter falls back to the plain <textarea> the window was
// built with, so documents stay editable either way.

const VIM_PREF_KEY = 'cmdline-blog:vim';

function vimAvailable() {
  return typeof CodeMirror !== 'undefined' && !!CodeMirror.Vim;
}

// Vim is on unless the user turned it off (the toolbar VIM button).
function vimEnabled() {
  try { return localStorage.getItem(VIM_PREF_KEY) !== 'off'; } catch (_) { return true; }
}

function setVimEnabled(on) {
  try { localStorage.setItem(VIM_PREF_KEY, on ? 'on' : 'off'); } catch (_) { /* private mode */ }
}

// Ex commands are global to CodeMirror, so they're defined once and dispatch to
// the window whose editor is running them via the handlers stashed on the
// instance.
if (vimAvailable()) {
  const Vim = CodeMirror.Vim;
  const run = (cm, action) => {
    const handlers = cm._docHandlers || {};
    if (handlers[action]) handlers[action]();
  };
  Vim.defineEx('write',   'w',   cm => run(cm, 'onSave'));
  Vim.defineEx('quit',    'q',   cm => run(cm, 'onQuit'));
  Vim.defineEx('wq',      'wq',  cm => { run(cm, 'onSave'); run(cm, 'onQuit'); });
  Vim.defineEx('xit',     'x',   cm => { run(cm, 'onSave'); run(cm, 'onQuit'); });
  Vim.defineEx('preview', 'pre', cm => run(cm, 'onPreview'));
  // Ctrl-X is the app's "close window" hotkey; don't let vim's decrement
  // command fire on the way there.
  try { Vim.unmap('<C-x>', 'normal'); } catch (_) { /* older keymap build */ }
}

// ─── Plain <textarea> fallback ────────────────────────────────────────────────

function plainDocEditor(textarea, handlers) {
  const onChange = handlers.onChange;
  if (onChange) textarea.addEventListener('input', onChange);
  return {
    vim: false,
    getValue: () => textarea.value,
    setValue: v => { textarea.value = v; },
    focus: () => textarea.focus(),
    focusNormal: () => textarea.focus(),
    show: () => { textarea.style.display = 'block'; },
    hide: () => { textarea.style.display = 'none'; },
    insertAtCursor: text => {
      const pos = textarea.selectionStart;
      textarea.value = textarea.value.slice(0, pos) + text + textarea.value.slice(pos);
      textarea.selectionStart = textarea.selectionEnd = pos + text.length;
      if (onChange) onChange();
    },
    refresh: () => {},
    setVim: () => {},
  };
}

// ─── CodeMirror editor ────────────────────────────────────────────────────────

// handlers: { onChange, onSave, onQuit, onPreview, onModeChange }
function createDocEditor(textarea, handlers = {}) {
  if (!vimAvailable()) return plainDocEditor(textarea, handlers);

  const cm = CodeMirror.fromTextArea(textarea, {
    keyMap: vimEnabled() ? 'vim' : 'default',
    lineWrapping: true,
    lineNumbers: false,
    matchBrackets: true,
    tabSize: 2,
    indentWithTabs: false,
    showCursorWhenSelecting: true,
  });
  cm._docHandlers = handlers;

  if (handlers.onChange) cm.on('change', handlers.onChange);
  if (handlers.onModeChange) {
    cm.on('vim-mode-change', e => handlers.onModeChange(e.mode, e.subMode));
    handlers.onModeChange(vimEnabled() ? 'normal' : 'off');
  }

  const wrapper = cm.getWrapperElement();

  return {
    vim: true,
    cm,
    getValue: () => cm.getValue(),
    setValue: v => { cm.setValue(v); cm.clearHistory(); },
    focus: () => cm.focus(),
    // Arriving at a window from somewhere else (Ctrl+`, Ctrl+1, Edit tab)
    // starts in normal mode rather than wherever the editor was last left, so
    // the first keys you press are always commands.
    focusNormal: () => {
      cm.focus();
      const vim = cm.state.vim;
      // The keymap is 'vim' in normal mode but 'vim-insert' / 'vim-replace'
      // while typing, so match the family rather than the exact name.
      if (!vim || !String(cm.getOption('keyMap') || '').startsWith('vim')) return;
      // Insert mode is left through its own exit path; Esc only reaches the
      // keymap in the modes handleKey serves.
      if (vim.insertMode) CodeMirror.Vim.exitInsertMode(cm);
      if (vim.visualMode) CodeMirror.Vim.handleKey(cm, '<Esc>');
    },
    show: () => { wrapper.style.display = ''; cm.refresh(); },
    hide: () => { wrapper.style.display = 'none'; },
    insertAtCursor: text => { cm.replaceSelection(text); cm.focus(); },
    refresh: () => cm.refresh(),
    setVim: on => {
      cm.setOption('keyMap', on ? 'vim' : 'default');
      if (handlers.onModeChange) handlers.onModeChange(on ? 'normal' : 'off');
    },
  };
}

// Flip vim on/off for every open window and remember the choice.
function setVimEverywhere(on) {
  setVimEnabled(on);
  Object.values(docs).forEach(d => d.win._setVim && d.win._setVim(on));
}

// Load text into vim's unnamed register so `p` pastes it in any open editor.
// `+` gets a copy too, for people who reach for the system-clipboard register.
function setVimRegister(text) {
  if (!vimAvailable()) return false;
  try {
    const registers = CodeMirror.Vim.getRegisterController();
    registers.pushText('"', 'yank', text, false, false);
    registers.pushText('+', 'yank', text, false, false);
    return true;
  } catch (_) {
    return false;
  }
}
