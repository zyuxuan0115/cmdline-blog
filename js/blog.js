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

// Posts are written in a plain editor, where pressing Enter means "new line" —
// not markdown's "same paragraph". `breaks` keeps those single newlines.
if (typeof marked !== 'undefined') marked.setOptions({ gfm: true, breaks: true });

// Posts are written by other people and shown to anyone, so the rendered
// markdown is sanitised. If DOMPurify didn't load, fall back to plain text
// rather than injecting unchecked HTML.
function renderMarkdown(md) {
  const source = md || '*This post is empty.*';
  if (typeof DOMPurify === 'undefined') {
    return `<p style="white-space:pre-wrap">${escapeHtml(source)}</p>`;
  }
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

function tagsHtml(doc) {
  const tags = (doc.tags || []).map(t => `#${escapeHtml(t)}`).join(' ');
  const badge = doc.visibility === 'shared' ? '<span class="badge">friends only</span>' : '';
  if (!tags && !badge) return '';
  return `<div class="post-tags">${[tags, badge].filter(Boolean).join(' · ')}</div>`;
}

// The banner: the title its owner gave the blog, else their username.
function siteTitle(user) {
  return (user && (user.blogName || user.username)) || username || 'CmdLine Blog';
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
  return {
    uid: d.uid,
    username: d.username || name,
    blogName: (d.blog_name || '').trim(),   // set by `blog --name <title>`
  };
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

function renderIndex(user, posts) {
  const title = siteTitle(user);
  document.title = `${title} — CmdLine Blog`;
  authorEl.textContent = title;

  // A titled blog still names its author underneath — that name is what the
  // terminal's `blog <username>` and this page's URL use.
  const count = posts.length
    ? `${posts.length} post${posts.length === 1 ? '' : 's'}`
    : 'No posts yet';
  subEl.textContent = user.blogName ? `${count} · by ${user.username}` : count;

  if (!posts.length) {
    mainEl.innerHTML = `<p class="empty">${escapeHtml(user.username)} hasn't published anything yet.</p>`;
    return;
  }

  // Each entry shows its whole post, under the date it was written — the date
  // doubles as the permalink.
  mainEl.innerHTML = posts.map(doc => {
    const url = escapeHtml(postUrl(doc));
    const date = postDate(doc);
    return `
      <article class="post">
        ${date ? `<h2 class="post-date"><a href="${url}">${escapeHtml(date)}</a></h2>` : ''}
        ${doc.title ? `<h3 class="post-title"><a href="${url}">${escapeHtml(doc.title)}</a></h3>` : ''}
        <div class="post-body"></div>
        ${tagsHtml(doc)}
      </article>`;
  }).join('');

  mainEl.querySelectorAll('.post-body').forEach((body, i) => {
    body.innerHTML = renderMarkdown(posts[i].content);
    rewriteDocLinks(body);
  });
}

function renderPost(doc, site) {
  const author = doc.author_name || username || 'Unknown';
  const banner = site ? siteTitle(site) : author;
  const title = postTitle(doc);
  document.title = `${title} — ${banner}`;
  authorEl.textContent = banner;
  subEl.innerHTML = `<a href="?u=${encodeURIComponent(username || author)}">All posts</a>`;

  const date = postDate(doc);
  mainEl.innerHTML = `
    <article class="post">
      ${date ? `<h2 class="post-date">${escapeHtml(date)}</h2>` : ''}
      ${doc.title ? `<h3 class="post-title">${escapeHtml(title)}</h3>` : ''}
      <div class="post-body"></div>
      ${tagsHtml(doc)}
    </article>
    <nav class="post-nav">
      <a href="?u=${encodeURIComponent(username || author)}">← All posts by ${escapeHtml(author)}</a>
    </nav>`;

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
    // Best-effort: the author's mapping carries their blog title for the banner.
    let site = null;
    const owner = username || snap.data().author_name || '';
    if (owner) { try { site = await resolveUsername(owner); } catch (_) { /* banner falls back to the author's name */ } }
    renderPost(snap.data(), site);
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
    renderIndex(user, await fetchPosts(user.uid, viewer));
  } catch (e) {
    authorEl.textContent = siteTitle(user);
    showError(`Could not load posts: ${e.message}`);
  }
}

main();
