const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Shared admin secret. Set it in production with:
//   firebase functions:secrets:set ADMIN_KEY     (or an env var ADMIN_KEY)
// The admin pages must send the same value. This is the same (low) security
// level as the previous hard-coded admin login — replace with Firebase Auth
// custom claims if you want real protection.
const ADMIN_KEY = process.env.ADMIN_KEY || 'change-me-please';

function requireAdmin(data) {
  if (!data || data.adminKey !== ADMIN_KEY) {
    throw new functions.https.HttpsError('permission-denied', 'Invalid admin key.');
  }
}

// Delete every document owned by a user (chunked to respect the 500-op batch limit).
async function deleteUserDocs(uid) {
  const snap = await db.collection('documents').where('user_id', '==', uid).get();
  const refs = snap.docs.map(d => d.ref);
  for (let i = 0; i < refs.length; i += 450) {
    const batch = db.batch();
    refs.slice(i, i + 450).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const res = await admin.auth().listUsers(1000, pageToken);
    users.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);
  return users;
}

// ─── Self-service: the logged-in user deletes their own account ────────────────
exports.deleteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
  }
  const uid = context.auth.uid;
  await deleteUserDocs(uid);
  await admin.auth().deleteUser(uid);
  return { ok: true };
});

// ─── Admin: list users (replaces admin_list_users RPC) ─────────────────────────
exports.adminListUsers = functions.https.onCall(async (data, context) => {
  requireAdmin(data);
  const limit = data.limit || 50;
  const offset = data.offset || 0;
  const all = await listAllAuthUsers();
  all.sort((a, b) => new Date(b.metadata.creationTime) - new Date(a.metadata.creationTime));
  return all.slice(offset, offset + limit).map(u => ({
    id: u.uid,
    email: u.email,
    username: u.displayName || '',
    created_at: u.metadata.creationTime,
    email_confirmed_at: u.emailVerified ? u.metadata.creationTime : null,
  }));
});

// ─── Admin: delete a user + their documents (replaces admin_delete_user RPC) ────
exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
  requireAdmin(data);
  if (!data.userId) throw new functions.https.HttpsError('invalid-argument', 'userId required.');
  await deleteUserDocs(data.userId);
  await admin.auth().deleteUser(data.userId);
  return { ok: true };
});

// ─── Admin: list a user's documents (replaces admin_list_user_documents RPC) ────
exports.adminListUserDocuments = functions.https.onCall(async (data, context) => {
  requireAdmin(data);
  if (!data.userId) throw new functions.https.HttpsError('invalid-argument', 'userId required.');
  const snap = await db.collection('documents').where('user_id', '==', data.userId).get();
  const docs = snap.docs.map(d => d.data());
  docs.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  return docs.map(d => ({
    filename: d.filename,
    title: d.title || '',
    visibility: d.visibility,
    updated_at: d.updated_at,
  }));
});

// ─── Admin: delete one document (replaces admin_delete_document RPC) ────────────
exports.adminDeleteDocument = functions.https.onCall(async (data, context) => {
  requireAdmin(data);
  if (!data.filename) throw new functions.https.HttpsError('invalid-argument', 'filename required.');
  await db.collection('documents').doc(data.filename).delete();
  return { ok: true };
});
