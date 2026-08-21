// ─── Blog Reader Page ─────────────────────────────────────────────────────────
// Standalone public view of one user's posts, opened by the terminal's
// `blog <username>` command. Two views, chosen by the query string:
//
//   blog.html?u=<username>            → index of that user's posts
//   blog.html?u=<username>&t=<tag>    → that user's posts carrying one tag
//   blog.html?u=<username>&q=<words>  → that user's posts containing the words
//   blog.html?u=<username>&page=<n>   → a later page of that index
//   blog.html?u=<username>&p=<hash>   → a single post
//
// It reads Firestore directly with the same rules as the app: public posts are
// visible to everyone, and a signed-in friend of the author also sees their
// `shared` posts. Private posts never appear here.

const params   = new URLSearchParams(location.search);
const username = (params.get('u') || '').trim();
const postHash = (params.get('p') || '').trim();
const tagFilter = (params.get('t') || '').trim();   // set by clicking a tag
const query     = (params.get('q') || '').trim();   // set by the search box
const pageParam = Math.max(1, parseInt(params.get('page'), 10) || 1);

// A post matches when it contains every word searched for, anywhere.
const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

const HASH_RE = /^[a-f0-9]{64}$/;

// Posts are shown whole on the index, so only a screenful's worth per page —
// the rest are a `next` link away.
const PAGE_SIZE = 15;

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

// The index of one author's posts, optionally narrowed to a single tag and to
// one page of it. Page 1 is the bare URL, so links to a blog stay tidy.
function indexUrl(owner = username, tag = '', page = 1, words = '') {
  let url = `?u=${encodeURIComponent(owner)}`;
  if (tag)      url += `&t=${encodeURIComponent(tag)}`;
  if (words)    url += `&q=${encodeURIComponent(words)}`;
  if (page > 1) url += `&page=${page}`;
  return url;
}

// Search covers what a reader can see of a post: its title, its body and its
// tags. Everything is lowercased, so the search is case-insensitive.
function docMatches(doc) {
  if (!terms.length) return true;
  const haystack = [doc.title || '', doc.content || '', ...(doc.tags || [])]
    .join('\n').toLowerCase();
  return terms.every(term => haystack.includes(term));
}

// Tags stay as their author typed them, so matching ignores case.
function docHasTag(doc, tag) {
  const wanted = tag.toLowerCase();
  return (doc.tags || []).some(t => String(t).toLowerCase() === wanted);
}

// Every tag is a link to that author's posts carrying it.
function tagsHtml(doc, owner = username) {
  const tags = (doc.tags || []).map(t =>
    `<a class="tag" href="${escapeHtml(indexUrl(owner, t))}">#${escapeHtml(t)}</a>`).join(' ');
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

// The index of this author's posts, narrowed by the tag that was clicked and
// by whatever was searched for, fifteen posts at a time.
function renderIndex(user, posts) {
  const title = siteTitle(user);
  const shown = posts.filter(doc =>
    (!tagFilter || docHasTag(doc, tagFilter)) && docMatches(doc));

  const label = [tagFilter ? `#${tagFilter}` : '', query ? `“${query}”` : ''].filter(Boolean).join(' ');
  document.title = label ? `${label} — ${title}` : `${title} — CmdLine Blog`;
  authorEl.textContent = title;
  setupSearch(user.username);

  // A page number past the end (a stale link, a hand-typed URL) shows the last
  // page rather than an empty one.
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const page = Math.min(pageParam, pageCount);
  const onPage = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // A titled blog still names its author underneath — that name is what the
  // terminal's `blog <username>` and this page's URL use.
  const by = user.blogName ? ` · by ${user.username}` : '';
  const where = pageCount > 1 ? ` · page ${page} of ${pageCount}` : '';
  const count = shown.length ? `${shown.length} post${shown.length === 1 ? '' : 's'}` : 'No posts';

  if (tagFilter || query) {
    // The way back to the whole blog is the link under the last post, so the
    // header stays a plain description of what's being shown.
    const parts = [escapeHtml(count)];
    if (tagFilter) parts.push(`<span class="tag-current">#${escapeHtml(tagFilter)}</span>`);
    if (query) parts.push(`matching <span class="query-current">“${escapeHtml(query)}”</span>`);
    subEl.innerHTML = parts.join(' ') + escapeHtml(by + where);
  } else {
    subEl.textContent = (shown.length ? count : 'No posts yet') + by + where;
  }

  if (!shown.length) {
    let msg;
    if (query)          msg = `Nothing here matches “${escapeHtml(query)}”.`;
    else if (tagFilter) msg = `Nothing here is tagged #${escapeHtml(tagFilter)}.`;
    else                msg = `${escapeHtml(user.username)} hasn't published anything yet.`;
    mainEl.innerHTML = `<p class="empty">${msg}</p>`;
    mainEl.insertAdjacentHTML('beforeend', navHtml(user, page, pageCount));
    return;
  }

  // Each entry shows its whole post, under the date it was written — the date
  // doubles as the permalink.
  mainEl.innerHTML = onPage.map(doc => {
    const url = escapeHtml(postUrl(doc));
    const date = postDate(doc);
    return `
      <article class="post">
        ${date ? `<h2 class="post-date"><a href="${url}">${escapeHtml(date)}</a></h2>` : ''}
        ${doc.title ? `<h3 class="post-title"><a href="${url}">${escapeHtml(doc.title)}</a></h3>` : ''}
        <div class="post-body"></div>
        ${tagsHtml(doc, user.username)}
      </article>`;
  }).join('');

  mainEl.querySelectorAll('.post-body').forEach((body, i) => {
    body.innerHTML = renderMarkdown(onPage[i].content);
    rewriteDocLinks(body);
  });

  mainEl.insertAdjacentHTML('beforeend', navHtml(user, page, pageCount));
}

// The search box only makes sense once we know whose posts are being searched,
// so it stays hidden until the index renders. It shows as a magnifying glass
// that opens into a field, already open when a search is what's on screen.
// Submitting starts at page one, keeping any tag, so you can search inside a
// tag as well as across the blog.
function setupSearch(owner) {
  const form   = document.getElementById('blog-search');
  const input  = document.getElementById('blog-search-input');
  const toggle = document.getElementById('blog-search-toggle');
  if (!form || !input || !toggle) return;

  const setOpen = open => {
    form.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  form.hidden = false;
  input.value = query;
  setOpen(!!query);

  // Keep the focus where it is while the glass is clicked, so the blur below
  // can't collapse the field a moment before the click is handled.
  toggle.onmousedown = e => e.preventDefault();

  // The glass opens the field, then doubles as the search button; clicking it
  // with nothing typed closes the field again.
  toggle.onclick = () => {
    if (!form.classList.contains('open')) { setOpen(true); input.focus(); return; }
    if (input.value.trim()) { form.requestSubmit(); return; }
    setOpen(false);
  };

  // An empty field left behind collapses, so the header goes back to being a
  // line of text — unless a search is what's on screen, where the field belongs
  // open next to the results it produced.
  input.onblur = () => { if (!input.value.trim() && !query) setOpen(false); };
  input.onkeydown = e => {
    if (e.key !== 'Escape') return;
    input.value = '';
    setOpen(false);
  };

  form.onsubmit = e => {
    e.preventDefault();
    location.href = indexUrl(owner, tagFilter, 1, input.value.trim());
  };
}

// Under the last post: the way to the neighbouring pages, and — when a tag or a
// search is narrowing things — back to the whole blog. Empty when there is
// nowhere to go.
function navHtml(user, page, pageCount) {
  const link = (cls, to, text) =>
    `<a class="${cls}" href="${escapeHtml(indexUrl(user.username, tagFilter, to, query))}">${text}</a>`;

  const links = [];
  if (page > 1) links.push(link('prev', page - 1, '← previous'));
  if (tagFilter || query) {
    links.push(`<a class="all-posts" href="${escapeHtml(indexUrl(user.username))}">← All posts by ${escapeHtml(user.username)}</a>`);
  }
  if (page < pageCount) links.push(link('next', page + 1, 'next →'));

  return links.length ? `<nav class="post-nav pager">${links.join('')}</nav>` : '';
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
      ${tagsHtml(doc, username || author)}
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
