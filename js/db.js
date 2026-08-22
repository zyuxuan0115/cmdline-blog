// ─── Firestore Document Helpers ───────────────────────────────────────────────
// Documents are keyed by their `filename` (a 256-bit random hex id), so the
// filename doubles as the Firestore document id. We still store `user_id` on
// each doc for ownership checks and queries.

// Every document read and write goes through here, so the collection name and
// the filename-as-id convention are stated once.
function docRef(filename) {
  return _db.collection('documents').doc(filename);
}

async function dbFileExists(name) {
  const snap = await docRef(name).get();
  return snap.exists && snap.data().user_id === currentUser.uid;
}

async function dbSetVisibility(name, vis) {
  await docRef(name).update({ visibility: vis });
  if (docs[name]) { docs[name].visibility = vis; docs[name].win._refreshVisBtn(); }
  updateListSidebarDoc(name, { visibility: vis });
}

// ─── Blog Name (Firestore) ────────────────────────────────────────────────────
// A user's blog title lives on their usernames/<lowercase> mapping — the one
// document about a user that anyone is allowed to read, so blog.html can show
// the title to visitors who aren't signed in. An unset name means the blog is
// simply titled with the username.

const BLOG_NAME_MAX = 60;

function blogNameRef() {
  return _db.collection('usernames').doc(currentUser.displayName.toLowerCase());
}

async function dbGetBlogName() {
  const snap = await blogNameRef().get();
  return (snap.exists && snap.data().blog_name) || '';
}

// An empty name removes the field, restoring the username as the title.
async function dbSetBlogName(name) {
  await blogNameRef().update({
    blog_name: name || firebase.firestore.FieldValue.delete(),
  });
}

// ─── Tag Helpers (Firestore) ──────────────────────────────────────────────────

async function getTags(filename) {
  const snap = await docRef(filename).get();
  return (snap.exists && snap.data().tags) || [];
}

// Both tag edits end the same way: store the new list, then refresh wherever it
// is on show — the document's own toolbar and the list sidebar.
async function saveTags(filename, tags) {
  await docRef(filename).update({ tags });
  if (docs[filename]) docs[filename].win._refreshTagBar();
  updateListSidebarDoc(filename, { tags });
}

async function addFileTag(filename, tag) {
  const tags = await getTags(filename);
  if (tags.includes(tag)) return false;
  await saveTags(filename, [...tags, tag]);
  return true;
}

async function removeFileTag(filename, tag) {
  const tags = await getTags(filename);
  if (!tags.includes(tag)) return false;
  await saveTags(filename, tags.filter(t => t !== tag));
  return true;
}

async function getFilesWithTag(tag) {
  const snap = await _db.collection('documents')
    .where('user_id', '==', currentUser.uid)
    .where('tags', 'array-contains', tag)
    .get();
  return snap.docs.map(d => d.data().filename).sort();
}

async function getAllTags() {
  const snap = await _db.collection('documents')
    .where('user_id', '==', currentUser.uid)
    .get();
  const tagSet = new Set();
  snap.docs.forEach(d => (d.data().tags || []).forEach(t => tagSet.add(t)));
  return [...tagSet].sort();
}
