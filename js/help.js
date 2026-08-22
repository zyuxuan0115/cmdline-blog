// ─── Help Sidebar ─────────────────────────────────────────────────────────────

const HELP_SECTIONS = [
  {
    title: 'Documents',
    entries: [
      ['create [--title \'...\'] [--public]', 'create a new document'],
      ['new [--title \'...\'] [--public]',    'alias for create'],
      ['open &lt;index&gt;',               'open / focus a document from the last list'],
      ['close [&lt;index&gt;]',            'close current window (or list index if list is open)'],
      ['list',                           'all public + your private docs'],
      ['list public',                    'all public docs'],
      ['list mywork',                    'all your docs'],
      ['list private',                   'your private docs only'],
      ['list shared',                    'your + friends’ shared docs'],
      ['list close',                     'close the list sidebar'],
      ['hash &lt;index&gt;',                'print a document’s hash, and copy it to the clipboard'],
      ['blog &lt;username&gt;',            'read a user’s published posts in a new tab'],
      ['blog',                           'read your own published posts'],
      ['blog --name &lt;title&gt;',        'title your own blog (--name \'\' resets it)'],
    ]
  },
  {
    title: 'Tags',
    entries: [
      ['tag -h &lt;hash&gt; &lt;tag&gt;',   'add a tag by hash'],
      ['tag -i &lt;index&gt; &lt;tag&gt;',  'add a tag by list index'],
      ['untag &lt;hash&gt; &lt;tag&gt;', 'remove a tag'],
      ['tags [tag]',                     'list tags or files under a tag'],
    ]
  },
  {
    title: 'Visibility',
    entries: [
      ['publish -h &lt;hash&gt;',   'make a document public by hash'],
      ['publish -i &lt;index&gt;',  'make a document public by list index'],
      ['share -h &lt;hash&gt;',     'share with your friends by hash'],
      ['share -i &lt;index&gt;',    'share with your friends by list index'],
      ['unpublish -h &lt;hash&gt;',  'make a document private by hash'],
      ['unpublish -i &lt;index&gt;', 'make a document private by list index'],
    ]
  },
  {
    title: 'Account',
    entries: [
      ['register &lt;email&gt; &lt;password&gt; &lt;username&gt;', 'create an account'],
      ['login &lt;email&gt; &lt;password&gt;',    'sign in'],
      ['logout',                               'sign out'],
      ['unregister',                           'delete your account'],
      ['whoami',                               'show current user'],
    ]
  },
  {
    title: 'Social',
    entries: [
      ['friend &lt;username&gt;',        'send a friend request'],
      ['message &lt;username&gt; &lt;text&gt;', 'send a direct message'],
      ['messages',                       'open your inbox / friends'],
      ['messages close',                 'close the messages sidebar'],
    ]
  },
  {
    title: 'Terminal',
    entries: [
      ['clear',      'clear terminal output'],
      ['hotkeys',       'show keyboard shortcuts'],
      ['hotkeys close', 'close the hotkeys sidebar'],
      ['commands',       'open this sidebar'],
      ['commands close', 'close this sidebar'],
      ['vim commands',       'show the vim command reference'],
      ['vim commands close', 'close the vim commands sidebar'],
    ]
  }
];

// Vim commands for the document editors, shown in their own sidebar view by
// the  vim commands  command. Kept apart from HELP_SECTIONS so the Commands
// sidebar stays about the terminal.
const VIM_SECTIONS = [
  {
    title: 'Modes',
    entries: [
      ['i / a',                          'insert before / after the cursor'],
      ['I / A',                          'insert at start / end of the line'],
      ['o / O',                          'open a new line below / above'],
      ['Esc',                            'back to normal mode'],
      ['v · V · Ctrl+V',                 'visual, visual line, visual block'],
      ['VIM button',                     'turn modal editing on / off everywhere'],
    ]
  },
  {
    title: 'Motions',
    entries: [
      ['h j k l',                        'left, down, up, right'],
      ['w / b / e',                      'next word, previous word, end of word'],
      ['0 / ^ / $',                      'start of line, first non-blank, end of line'],
      ['gg / G',                         'top / bottom of the document'],
      ['{ / }',                          'previous / next paragraph'],
      ['f&lt;char&gt; / t&lt;char&gt;',      'jump to / just before a character'],
      ['3j',                             'any motion takes a count'],
    ]
  },
  {
    title: 'Editing',
    entries: [
      ['x / X',                          'delete the character under / before the cursor'],
      ['dd · yy · p · P',           'delete line, yank line, paste after / before'],
      ['dw · d$ · diw',                'operator + motion or text object'],
      ['cw · ciw · cc',                'change word / inner word / whole line'],
      ['r&lt;char&gt;',                    'replace a single character'],
      ['J',                              'join this line with the next'],
      ['&gt;&gt; / &lt;&lt;',                'indent / outdent the line'],
      ['u · Ctrl+R',                     'undo / redo'],
      ['. ',                             'repeat the last change'],
    ]
  },
  {
    title: 'Search & replace',
    entries: [
      ['/text · ?text',                 'search forwards / backwards'],
      ['n / N',                          'next / previous match'],
      ['*',                              'search for the word under the cursor'],
      [':s/old/new/g',                   'substitute on the current line'],
      [':%s/old/new/g',                  'substitute in the whole document'],
    ]
  },
  {
    title: 'Registers, marks & macros',
    entries: [
      ['"ayy · "ap',                    'yank into / paste from register a'],
      ['ma · \'a',                      'set mark a · jump to mark a'],
      ['qa · q · @a',                   'record macro a, stop, replay'],
    ]
  },
  {
    title: 'Ex commands',
    entries: [
      [':w',                             'save now'],
      [':q',                             'close the window'],
      [':wq · :x',                       'save and close'],
      [':pre',                           'switch this window to preview'],
    ]
  }
];

const HOTKEYS = [
  ['Ctrl + `', 'toggle focus between terminal and document window'],
  ['Ctrl + 1', 'focus the next document window (editable ones open for editing)'],
  ['Ctrl + X', 'close the current window (or return to terminal)'],
  ['Ctrl + Z', 'toggle (close / reopen) the sidebar'],
  ['↑ / ↓',    'browse command history'],
];

const helpSidebar = document.getElementById('help-sidebar');
const helpContent = document.getElementById('help-sidebar-content');
const sidebarTitle = document.getElementById('help-sidebar-title');
let currentSidebarView = null; // 'help', 'list', 'hotkeys', 'messages', or 'vim'
let lastListedDocs = []; // docs from the most recent  list  command, in display order
let lastListFilter = ''; // '', 'public', 'mywork', or 'private'
let lastSidebarView = null; // last view shown before it was closed, for Ctrl+Z reopen

// The commands, vim and hotkeys views are all the same thing: titled sections of
// `code` — description pairs.
function buildSectionsHTML(sections) {
  return sections.map(section => `
    <div class="help-section">
      <div class="help-section-title">${section.title}</div>
      ${section.entries.map(([cmd, desc]) =>
        `<div class="help-entry"><code>${cmd}</code><br><span>— ${desc}</span></div>`
      ).join('')}
    </div>
  `).join('');
}

function buildDocEntry(doc, isMine, index) {
  const { filename, title, visibility, tags, updated_at, author_name } = doc;
  const displayTitle = title ? `<code>${title}</code>` : `<code>&lt;untitled&gt;</code>`;
  const indexStr = index != null ? `<span style="color:#556677">${index}.</span> ` : '';
  // The marker is always rendered for your own documents, shown or hidden by
  // refreshOpenMarkers() as windows come and go.
  const open = isMine
    ? ` <span class="open-badge" data-filename="${filename}" style="color:#ffadd6"${docs[filename] ? '' : ' hidden'}>[open]</span>`
    : '';
  const vis = visibility === 'public' ? ' <span style="color:#88aaff">[public]</span>'
            : visibility === 'shared' ? ' <span style="color:#88ff88">[shared]</span>'
            : ' <span style="color:#556677">[private]</span>';
  const author = !isMine && author_name ? ' <span style="color:#ffadd6">by ' + author_name + '</span>' : '';
  const authorId = !isMine && author_name ? '<br><span style="color:#556677;font-size:0.85em">add: friend ' + author_name + '</span>' : '';
  const tagStr = tags && tags.length ? '<br><span>' + tags.map(t => `#${t}`).join(' ') + '</span>' : '';
  const timeStr = updated_at ? '<br><span style="color:#556677;font-size:0.85em">edited ' + formatTimeAgo(updated_at) + '</span>' : '';
  const clickAttr = index != null ? ` style="cursor:pointer" onclick="runCommand('open ${index}')"` : '';
  return `<div class="help-entry"${clickAttr}>${indexStr}${displayTitle}${open}${vis}${author}${tagStr}${timeStr}${authorId}</div>`;
}

// A window opening or closing makes the [open] markers stale. The sidebar is
// told about it rather than rebuilt, which would refetch and re-animate.
function refreshOpenMarkers() {
  helpContent.querySelectorAll('.open-badge').forEach(badge => {
    badge.hidden = !docs[badge.dataset.filename];
  });
}

// One section of documents. `ownership` is true or false for a list that is all
// yours or all other people's, and 'auto' for a mixed one, where each entry is
// checked on its own.
function buildListHTML(documents, sectionTitle, ownership, emptyText = 'No documents found.') {
  if (documents.length === 0) {
    return `<div class="help-section"><div class="help-section-title">${sectionTitle}</div><div class="help-entry"><span>${emptyText}</span></div></div>`;
  }
  const mine = doc => ownership === 'auto' ? doc.user_id === currentUser.uid : ownership;
  return `
    <div class="help-section">
      <div class="help-section-title">${sectionTitle} (${documents.length})</div>
      ${documents.map((doc, i) => buildDocEntry(doc, mine(doc), i + 1)).join('')}
    </div>
  `;
}

function swapSidebarContent(newHTML, newView, titleText) {
  // If sidebar is not open yet, just set content and open
  if (!helpSidebar.classList.contains('open')) {
    sidebarTitle.textContent = titleText;
    helpContent.innerHTML = newHTML;
    currentSidebarView = newView;
    helpSidebar.classList.add('open');
    return;
  }
  // Slide current content out to the right
  helpContent.classList.add('slide-out');
  setTimeout(() => {
    sidebarTitle.textContent = titleText;
    helpContent.innerHTML = newHTML;
    helpContent.classList.remove('slide-out');
    // Start off-screen from the left
    helpContent.classList.add('slide-in');
    // Force reflow so the browser registers the starting position
    helpContent.offsetWidth;
    // Slide in from the left
    helpContent.classList.remove('slide-in');
    currentSidebarView = newView;
  }, 200);
}

function openHotkeysSidebar() {
  swapSidebarContent(buildSectionsHTML([{ title: 'Keyboard Shortcuts', entries: HOTKEYS }]),
                     'hotkeys', 'Hotkeys');
  print('Hotkeys opened on the right.', 'muted');
}

function openVimSidebar() {
  swapSidebarContent(buildSectionsHTML(VIM_SECTIONS), 'vim', 'Vim Commands');
  print('Vim commands opened on the right.', 'muted');
}

function openHelpSidebar() {
  swapSidebarContent(buildSectionsHTML(HELP_SECTIONS), 'help', 'Commands');
  print('Help opened on the right.', 'muted');
}

function closeHelpSidebar() {
  if (currentSidebarView) lastSidebarView = currentSidebarView; // remember for Ctrl+Z reopen
  helpSidebar.classList.remove('open');
  currentSidebarView = null;
}

// Reopen the sidebar view that was last closed (used by Ctrl+Z).
function reopenSidebar() {
  if (lastSidebarView === 'help')    { openHelpSidebar();    return true; }
  if (lastSidebarView === 'hotkeys') { openHotkeysSidebar(); return true; }
  if (lastSidebarView === 'list')    { openListSidebar(lastListFilter); return true; }
  if (lastSidebarView === 'messages') { openMessagesSidebar(); return true; }
  if (lastSidebarView === 'vim')     { openVimSidebar();     return true; }
  return false;
}

// Shared documents owned by the current user's friends (chunked — `in` allows 10 uids).
// Resilient: on error it warns and returns [], so it can't break the whole list.
async function fetchFriendsSharedDocs() {
  try {
    const fsnap = await _db.collection('friendships').where('users', 'array-contains', currentUser.uid).get();
    const friendUids = fsnap.docs.map(d => (d.data().users || []).find(u => u !== currentUser.uid)).filter(Boolean);
    const out = [];
    for (let i = 0; i < friendUids.length; i += 10) {
      const chunk = friendUids.slice(i, i + 10);
      const snap = await _db.collection('documents').where('user_id', 'in', chunk).where('visibility', '==', 'shared').orderBy('updated_at', 'desc').get();
      out.push(...snap.docs.map(d => d.data()));
    }
    return out;
  } catch (e) {
    print(`Note: couldn't load friends' shared docs (${e.message}).`, 'muted');
    return [];
  }
}

// The list sidebar's five views. Each one says what to call it, how to fetch
// its documents, and whether the entries are the user's own — the rendering and
// the error handling are the same for all of them.
const LIST_VIEWS = {
  public: {
    title: 'Public Documents',
    ownership: false,
    load: () => byDocs(col => col.where('visibility', '==', 'public')),
  },
  mywork: {
    title: 'My Documents',
    ownership: true,
    load: () => byDocs(col => col.where('user_id', '==', currentUser.uid)),
  },
  private: {
    title: 'Private Documents',
    ownership: true,
    load: () => byDocs(col => col.where('user_id', '==', currentUser.uid)
                                 .where('visibility', '==', 'private')),
  },
  shared: {
    title: 'Shared Documents',
    ownership: 'auto',
    empty: 'No shared documents.',
    // Your shared docs plus your friends'.
    load: async () => newestFirst([
      ...await byDocs(col => col.where('user_id', '==', currentUser.uid)
                                .where('visibility', '==', 'shared')),
      ...await fetchFriendsSharedDocs(),
    ]),
  },
  // The default: everything the user can see — all their own docs whatever the
  // visibility, every public doc, and friends' shared docs. Own public docs come
  // back from two of those queries, so entries are de-duplicated by filename.
  '': {
    title: 'All Documents',
    ownership: 'auto',
    load: async () => {
      const mine        = await byDocs(col => col.where('user_id', '==', currentUser.uid));
      const allPublic   = await byDocs(col => col.where('visibility', '==', 'public'));
      const friendsShared = await fetchFriendsSharedDocs();
      const byName = new Map();
      [...mine, ...allPublic, ...friendsShared]
        .forEach(d => { if (d && d.filename) byName.set(d.filename, d); });
      return newestFirst([...byName.values()]);
    },
  },
};

// Every list query is the documents collection, narrowed, newest edit first.
function byDocs(narrow) {
  return narrow(_db.collection('documents'))
    .orderBy('updated_at', 'desc')
    .get()
    .then(snap => snap.docs.map(d => d.data()));
}

function newestFirst(documents) {
  return documents.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
}

async function openListSidebar(filter) {
  lastListFilter = filter;
  const view = LIST_VIEWS[filter] || LIST_VIEWS[''];

  let documents;
  try { documents = await view.load(); }
  catch (e) { print(`Error: ${e.message}`, 'error'); return; }

  lastListedDocs = documents;
  swapSidebarContent(buildListHTML(documents, view.title, view.ownership, view.empty),
                     'list', view.title);
  print('File list opened on the right.', 'muted');
}

// Re-render the list in place, after a document it shows has changed.
function renderListSidebar() {
  if (currentSidebarView !== 'list') return;
  helpContent.innerHTML = buildListHTML(lastListedDocs, sidebarTitle.textContent, 'auto');
}

function updateListSidebarDoc(filename, patch) {
  for (const doc of lastListedDocs) {
    if (doc.user_id === currentUser.uid && doc.filename === filename) {
      Object.assign(doc, patch);
      break;
    }
  }
  renderListSidebar();
}

function addDocToListSidebar(doc) {
  // Filter compatibility for own newly-created docs
  if (lastListFilter === 'public'  && doc.visibility !== 'public')  return;
  if (lastListFilter === 'private' && doc.visibility !== 'private') return;
  // 'mywork' and default ('') always include the user's own doc
  lastListedDocs.unshift(doc);
  renderListSidebar();
}

document.getElementById('help-sidebar-close').addEventListener('click', closeHelpSidebar);
