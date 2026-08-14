// ─── Blog Reader Page ─────────────────────────────────────────────────────────
// Standalone public view of one user's posts, opened by the terminal's
// `blog <username>` command. Two views, chosen by the query string:
//
//   blog.html?u=<username>            → index of that user's posts
//   blog.html?u=<username>&p=<hash>   → a single post
//
// It reads Firestore directly with the same rules as the app: public posts are
// visible to everyone, and a signed-in friend of the author also sees their
// `shared` posts. Private posts never appear here.

const params   = new URLSearchParams(location.search);
const username = (params.get('u') || '').trim();
const postHash = (params.get('p') || '').trim();

const HASH_RE = /^[a-f0-9]{64}$/;

const authorEl = document.getElementById('blog-author');
const subEl    = document.getElementById('blog-sub');
const mainEl   = document.getElementById('blog-main');

// ─── Firebase ─────────────────────────────────────────────────────────────────

let _db, _auth;
try {
  if (typeof firebase === 'undefined') throw new Error('Firebase SDK failed to load.');
  firebase.initializeApp(firebaseConfig);
  _db = firebase.firestore();
  _auth = firebase.auth();
} catch (e) {
  showError(`Could not connect: ${e.message}`);
}

// Firebase restores a persisted session asynchronously; wait for the first
// auth-state callback so friends' `shared` posts aren't missed on a cold load.
function currentUserOnce() {
  return new Promise(resolve => {
    if (!_auth) { resolve(null); return; }
    const unsub = _auth.onAuthStateChanged(user => { unsub(); resolve(user); });
  });
}

// ─── Rendering helpers ────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Posts are written by other people and shown to anyone, so the rendered
// markdown is sanitised. If DOMPurify didn't load, fall back to plain text
// rather than injecting unchecked HTML.
function renderMarkdown(md) {
  const source = md || '*This post is empty.*';
  if (typeof DOMPurify === 'undefined') return `<p>${escapeHtml(source)}</p>`;
  return DOMPurify.sanitize(marked.parse(source));
}

function formatDate(iso) {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function postDate(doc) {
  return formatDate(doc.created_at || doc.updated_at);
}

function postTitle(doc) {
  return doc.title || 'Untitled';
}

function postUrl(doc) {
  return `?u=${encodeURIComponent(username || doc.author_name || '')}&p=${encodeURIComponent(doc.filename)}`;
}

// A rough plain-text lead-in for the index page.
function excerptOf(content) {
  const text = String(content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}[#>]+\s*/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 240 ? text.slice(0, 240).trimEnd() + '…' : text;
}

function tagsHtml(tags) {
  if (!tags || !tags.length) return '';
  return `<span class="dot">·</span><span class="tag">${tags.map(t => `#${escapeHtml(t)}`).join(' ')}</span>`;
}

function sharedBadge(doc) {
  return doc.visibility === 'shared' ? ' <span class="badge">friends only</span>' : '';
}

function showError(msg) {
  if (mainEl) mainEl.innerHTML = `<p class="error">${escapeHtml(msg)}</p>`;
}

// In-document links written as [text](<hash>) point at other posts, not URLs.
// Turn them into links to this page; images with a hash source get the same
// treatment, since a hash is not a loadable image.
function rewriteDocLinks(root) {
  root.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (!HASH_RE.test(src)) return;
    const a = document.createElement('a');
    a.href = `?u=${encodeURIComponent(username)}&p=${src}`;
    a.textContent = img.getAttribute('alt') || src.slice(0, 8) + '…';
    img.replaceWith(a);
  });
  root.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!HASH_RE.test(href)) return;
    a.setAttribute('href', `?u=${encodeURIComponent(username)}&p=${href}`);
  });
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function resolveUsername(name) {
  const snap = await _db.collection('usernames').doc(name.toLowerCase()).get();
  if (!snap.exists) return null;
  const d = snap.data();
  return { uid: d.uid, username: d.username || name };
}

// Public posts always; `shared` ones too when the viewer is allowed to see them
// (the author themselves, or one of their friends). The shared query is
// best-effort — a stranger's read is denied by the rules, which is not an error.
async function fetchPosts(uid, viewer) {
  const col = _db.collection('documents');
  const byVisibility = vis => col
    .where('user_id', '==', uid)
    .where('visibility', '==', vis)
    .orderBy('updated_at', 'desc')
    .get()
    .then(s => s.docs.map(d => d.data()));

  const posts = await byVisibility('public');
  if (viewer) {
    try { posts.push(...await byVisibility('shared')); } catch (_) { /* not a friend */ }
  }
  return posts.sort((a, b) =>
    new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0));
}

// ─── Views ────────────────────────────────────────────────────────────────────

function renderIndex(author, posts) {
  document.title = `${author} — CmdLine Blog`;
  authorEl.textContent = author;
  subEl.textContent = posts.length
    ? `${posts.length} post${posts.length === 1 ? '' : 's'}`
    : 'No posts yet';

  if (!posts.length) {
    mainEl.innerHTML = `<p class="empty">${escapeHtml(author)} hasn't published anything yet.</p>`;
    return;
  }

  mainEl.innerHTML = posts.map(doc => {
    const excerpt = excerptOf(doc.content);
    return `
      <article class="post-card">
        <h2><a href="${escapeHtml(postUrl(doc))}">${escapeHtml(postTitle(doc))}</a></h2>
        <div class="post-meta">${escapeHtml(postDate(doc))}${tagsHtml(doc.tags)}${sharedBadge(doc)}</div>
        ${excerpt ? `<p class="post-excerpt">${escapeHtml(excerpt)}</p>` : ''}
        <a class="read-more" href="${escapeHtml(postUrl(doc))}">Read more →</a>
      </article>`;
  }).join('');
}

function renderPost(doc) {
  const author = doc.author_name || username || 'Unknown';
  const title = postTitle(doc);
  document.title = `${title} — ${author}`;
  authorEl.textContent = author;
  subEl.innerHTML = `<a href="?u=${encodeURIComponent(username || author)}">All posts</a>`;

  mainEl.innerHTML = `
    <article>
      <header class="post-header">
        <h1>${escapeHtml(title)}</h1>
        <div class="post-meta">${escapeHtml(postDate(doc))}${tagsHtml(doc.tags)}${sharedBadge(doc)}</div>
      </header>
      <div class="post-body"></div>
      <nav class="post-nav">
        <a href="?u=${encodeURIComponent(username || author)}">← All posts by ${escapeHtml(author)}</a>
      </nav>
    </article>`;

  const body = mainEl.querySelector('.post-body');
  body.innerHTML = renderMarkdown(doc.content);
  rewriteDocLinks(body);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  if (!_db) return;                    // init already reported the failure

  if (!username && !postHash) {
    authorEl.textContent = 'CmdLine Blog';
    mainEl.innerHTML = `<p class="empty">No author given. Open a blog from the terminal with
      <code>blog &lt;username&gt;</code>.</p>`;
    return;
  }

  const viewer = await currentUserOnce();

  // Single post — fetched by hash, so it works even for a post by someone
  // other than the user named in the URL (e.g. a cross-link between posts).
  if (postHash) {
    if (!HASH_RE.test(postHash)) { showError('That post link is malformed.'); return; }
    let snap;
    try {
      snap = await _db.collection('documents').doc(postHash).get();
    } catch (_) {
      authorEl.textContent = username || 'CmdLine Blog';
      showError('That post is private.');
      return;
    }
    if (!snap.exists || snap.data().visibility === 'private') {
      authorEl.textContent = username || 'CmdLine Blog';
      showError('That post does not exist, or is not published.');
      return;
    }
    renderPost(snap.data());
    return;
  }

  // Index of one author's posts.
  let user;
  try {
    user = await resolveUsername(username);
  } catch (e) {
    showError(`Could not look up "${username}": ${e.message}`);
    return;
  }
  if (!user) {
    authorEl.textContent = username;
    mainEl.innerHTML = `<p class="empty">No user named "${escapeHtml(username)}".</p>`;
    return;
  }

  try {
    renderIndex(user.username, await fetchPosts(user.uid, viewer));
  } catch (e) {
    authorEl.textContent = user.username;
    showError(`Could not load posts: ${e.message}`);
  }
}

main();
