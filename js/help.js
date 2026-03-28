// ─── Help Sidebar ─────────────────────────────────────────────────────────────

const HELP_SECTIONS = [
  {
    title: 'Documents',
    entries: [
      ['create &lt;filename&gt; [--public]', 'create a new document'],
      ['new &lt;filename&gt;',              'alias for create'],
      ['open &lt;filename&gt;',            'open / focus a document'],
      ['close &lt;filename&gt;',           'close a document window'],
      ['list',                           'list all your documents'],
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

function openHelpSidebar() {
  helpContent.innerHTML = HELP_SECTIONS.map(section => `
    <div class="help-section">
      <div class="help-section-title">${section.title}</div>
      ${section.entries.map(([cmd, desc]) =>
        `<div class="help-entry"><code>${cmd}</code><br><span>— ${desc}</span></div>`
      ).join('')}
    </div>
  `).join('');
  helpSidebar.classList.add('open');
  print('Help opened on the right.', 'muted');
}

function closeHelpSidebar() {
  helpSidebar.classList.remove('open');
}

async function openListSidebar() {
  const { data, error } = await _supabase.from('documents').select('filename, visibility, tags').eq('user_id', currentUser.id).order('filename');
  if (error) { print(`Error: ${error.message}`, 'error'); return; }
  if (data.length === 0) {
    helpContent.innerHTML = '<div class="help-section"><div class="help-section-title">My Documents</div><div class="help-entry"><span>No documents found.</span></div></div>';
  } else {
    helpContent.innerHTML = `
      <div class="help-section">
        <div class="help-section-title">My Documents (${data.length})</div>
        ${data.map(({ filename, visibility, tags }) => {
          const open = docs[filename] ? ' <span style="color:#ffadd6">[open]</span>' : '';
          const vis = visibility === 'public' ? ' <span style="color:#88aaff">[public]</span>' : ' <span style="color:#556677">[private]</span>';
          const tagStr = tags && tags.length ? '<br><span>' + tags.map(t => `#${t}`).join(' ') + '</span>' : '';
          return `<div class="help-entry" style="cursor:pointer" onclick="runCommand('open ${filename}')"><code>${filename}</code>${open}${vis}${tagStr}</div>`;
        }).join('')}
      </div>
    `;
  }
  helpSidebar.classList.add('open');
  print('File list opened on the right.', 'muted');
}

document.getElementById('help-sidebar-close').addEventListener('click', closeHelpSidebar);
