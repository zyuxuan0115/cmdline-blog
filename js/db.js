// ─── Firestore Document Helpers ───────────────────────────────────────────────
// Documents are keyed by their `filename` (a 256-bit random hex id), so the
// filename doubles as the Firestore document id. We still store `user_id` on
// each doc for ownership checks and queries.

async function dbFileExists(name) {
  const snap = await _db.collection('documents').doc(name).get();
  return snap.exists && snap.data().user_id === currentUser.uid;
}

async function dbSetVisibility(name, vis) {
  await _db.collection('documents').doc(name).update({ visibility: vis });
  if (docs[name]) { docs[name].visibility = vis; docs[name].win._refreshVisBtn(); }
  updateListSidebarDoc(name, { visibility: vis });
}

// ─── Tag Helpers (Firestore) ──────────────────────────────────────────────────

async function getTags(filename) {
  const snap = await _db.collection('documents').doc(filename).get();
  return (snap.exists && snap.data().tags) || [];
}

async function addFileTag(filename, tag) {
  const tags = await getTags(filename);
  if (tags.includes(tag)) return false;
  const newTags = [...tags, tag];
  await _db.collection('documents').doc(filename).update({ tags: newTags });
  if (docs[filename]) docs[filename].win._refreshTagBar();
  updateListSidebarDoc(filename, { tags: newTags });
  return true;
}

async function removeFileTag(filename, tag) {
  const tags = await getTags(filename);
  if (!tags.includes(tag)) return false;
  const newTags = tags.filter(t => t !== tag);
  await _db.collection('documents').doc(filename).update({ tags: newTags });
  if (docs[filename]) docs[filename].win._refreshTagBar();
  updateListSidebarDoc(filename, { tags: newTags });
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
