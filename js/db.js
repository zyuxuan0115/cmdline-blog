// ─── Supabase Document Helpers ────────────────────────────────────────────────

async function dbFileExists(name) {
  const { data } = await _supabase.from('documents').select('filename').eq('user_id', currentUser.id).eq('filename', name).maybeSingle();
  return !!data;
}

async function dbSetVisibility(name, vis) {
  await _supabase.from('documents').update({ visibility: vis }).eq('user_id', currentUser.id).eq('filename', name);
  if (docs[name]) { docs[name].visibility = vis; docs[name].win._refreshVisBtn(); }
}

// ─── Tag Helpers (Supabase) ───────────────────────────────────────────────────

async function getTags(filename) {
  const { data } = await _supabase.from('documents').select('tags').eq('user_id', currentUser.id).eq('filename', filename).maybeSingle();
  return data?.tags || [];
}

async function addFileTag(filename, tag) {
  const tags = await getTags(filename);
  if (tags.includes(tag)) return false;
  const newTags = [...tags, tag];
  await _supabase.from('documents').update({ tags: newTags }).eq('user_id', currentUser.id).eq('filename', filename);
  if (docs[filename]) docs[filename].win._refreshTagBar();
  refreshListSidebarTags(filename, newTags);
  return true;
}

async function removeFileTag(filename, tag) {
  const tags = await getTags(filename);
  if (!tags.includes(tag)) return false;
  const newTags = tags.filter(t => t !== tag);
  await _supabase.from('documents').update({ tags: newTags }).eq('user_id', currentUser.id).eq('filename', filename);
  if (docs[filename]) docs[filename].win._refreshTagBar();
  refreshListSidebarTags(filename, newTags);
  return true;
}

async function getFilesWithTag(tag) {
  const { data } = await _supabase.from('documents').select('filename').eq('user_id', currentUser.id).contains('tags', [tag]);
  return (data || []).map(d => d.filename).sort();
}

async function getAllTags() {
  const { data } = await _supabase.from('documents').select('tags').eq('user_id', currentUser.id);
  const tagSet = new Set();
  (data || []).forEach(d => (d.tags || []).forEach(t => tagSet.add(t)));
  return [...tagSet].sort();
}
