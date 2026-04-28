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
    ]
  },
  {
    title: 'Tags',
    entries: [
      ['tag &lt;filename&gt; &lt;tag&gt;',   'add a tag'],
      ['untag &lt;filename&gt; &lt;tag&gt;', 'remove a tag'],
      ['tags [tag]',                     'list tags or files under a tag'],
    ]
  },
  {
    title: 'Visibility',
    entries: [
      ['publish &lt;filename&gt;',   'make a document public'],
      ['unpublish &lt;filename&gt;', 'make a document private'],
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
    title: 'Terminal',
    entries: [
      ['clear',      'clear terminal output'],
      ['help',       'open this sidebar'],
      ['help close', 'close this sidebar'],
    ]
  }
];

const helpSidebar = document.getElementById('help-sidebar');
const helpContent = document.getElementById('help-sidebar-content');
const sidebarTitle = document.getElementById('help-sidebar-title');
let currentSidebarView = null; // 'help' or 'list'
let lastListedDocs = []; // docs from the most recent  list  command, in display order

function buildHelpHTML() {
  return HELP_SECTIONS.map(section => `
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
  const open = isMine && docs[filename] ? ' <span style="color:#ffadd6">[open]</span>' : '';
  const vis = visibility === 'public' ? ' <span style="color:#88aaff">[public]</span>' : ' <span style="color:#556677">[private]</span>';
  const author = !isMine && author_name ? ' <span style="color:#ffadd6">by ' + author_name + '</span>' : '';
  const tagStr = tags && tags.length ? '<br><span>' + tags.map(t => `#${t}`).join(' ') + '</span>' : '';
  const timeStr = updated_at ? '<br><span style="color:#556677;font-size:0.85em">edited ' + formatTimeAgo(updated_at) + '</span>' : '';
  const clickAttr = index != null ? ` style="cursor:pointer" onclick="runCommand('open ${index}')"` : '';
  return `<div class="help-entry"${clickAttr}>${indexStr}${displayTitle}${open}${vis}${author}${tagStr}${timeStr}</div>`;
}

function buildListHTML(documents, sectionTitle, isMine) {
  if (documents.length === 0) {
    return `<div class="help-section"><div class="help-section-title">${sectionTitle}</div><div class="help-entry"><span>No documents found.</span></div></div>`;
  }
  return `
    <div class="help-section">
      <div class="help-section-title">${sectionTitle} (${documents.length})</div>
      ${documents.map((doc, i) => buildDocEntry(doc, isMine, i + 1)).join('')}
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

function openHelpSidebar() {
  swapSidebarContent(buildHelpHTML(), 'help', 'Commands');
  print('Help opened on the right.', 'muted');
}

function closeHelpSidebar() {
  helpSidebar.classList.remove('open');
  currentSidebarView = null;
}

async function openListSidebar(filter) {
  const fields = 'filename, title, visibility, tags, updated_at, author_name, user_id';
  let html = '';
  let title = 'All Documents';

  if (filter === 'public') {
    // All public posts from everyone
    const { data, error } = await _supabase.from('documents').select(fields).eq('visibility', 'public').order('updated_at', { ascending: false });
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    title = 'Public Documents';
    lastListedDocs = data || [];
    html = buildListHTML(lastListedDocs, title, false);
  } else if (filter === 'mywork') {
    // All of current user's posts (public + private)
    const { data, error } = await _supabase.from('documents').select(fields).eq('user_id', currentUser.id).order('updated_at', { ascending: false });
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    title = 'My Documents';
    lastListedDocs = data || [];
    html = buildListHTML(lastListedDocs, title, true);
  } else if (filter === 'private') {
    // Current user's private posts only
    const { data, error } = await _supabase.from('documents').select(fields).eq('user_id', currentUser.id).eq('visibility', 'private').order('updated_at', { ascending: false });
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    title = 'Private Documents';
    lastListedDocs = data || [];
    html = buildListHTML(lastListedDocs, title, true);
  } else {
    // Default: all public + current user's private, sorted newest first
    const { data: myPrivate, error: myErr } = await _supabase.from('documents').select(fields).eq('user_id', currentUser.id).eq('visibility', 'private').order('updated_at', { ascending: false });
    if (myErr) { print(`Error: ${myErr.message}`, 'error'); return; }
    const { data: allPublic, error: pubErr } = await _supabase.from('documents').select(fields).eq('visibility', 'public').order('updated_at', { ascending: false });
    if (pubErr) { print(`Error: ${pubErr.message}`, 'error'); return; }
    // Merge and sort by updated_at descending
    const all = [...myPrivate, ...allPublic].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    title = 'All Documents';
    lastListedDocs = all;
    html = buildListHTML(all, title, false).replace(
      // For own docs, re-render entries to make them clickable
      new RegExp('', ''), ''
    );
    // Re-build with per-entry ownership check
    if (all.length === 0) {
      html = `<div class="help-section"><div class="help-section-title">${title}</div><div class="help-entry"><span>No documents found.</span></div></div>`;
    } else {
      html = `
        <div class="help-section">
          <div class="help-section-title">${title} (${all.length})</div>
          ${all.map((doc, i) => buildDocEntry(doc, doc.user_id === currentUser.id, i + 1)).join('')}
        </div>
      `;
    }
  }

  swapSidebarContent(html, 'list', title);
  print('File list opened on the right.', 'muted');
}

function updateListSidebarDoc(filename, patch) {
  // Update cached array so subsequent reads (e.g. open) see fresh data
  for (const doc of lastListedDocs) {
    if (doc.user_id === currentUser.id && doc.filename === filename) {
      Object.assign(doc, patch);
      break;
    }
  }
  // Live re-render only when the list view is the one showing
  if (currentSidebarView !== 'list') return;
  const sectionTitle = sidebarTitle.textContent;
  helpContent.innerHTML = lastListedDocs.length === 0
    ? `<div class="help-section"><div class="help-section-title">${sectionTitle}</div><div class="help-entry"><span>No documents found.</span></div></div>`
    : `<div class="help-section">
         <div class="help-section-title">${sectionTitle}</div>
         ${lastListedDocs.map((doc, i) => buildDocEntry(doc, doc.user_id === currentUser.id, i + 1)).join('')}
       </div>`;
}

document.getElementById('help-sidebar-close').addEventListener('click', closeHelpSidebar);
