// ─── Authentication ───────────────────────────────────────────────────────────

// Translate Firebase error codes into clean, user-facing messages.
function authErrorMessage(e) {
  switch (e && e.code) {
    case 'auth/email-already-in-use': return 'That email is already registered.';
    case 'auth/invalid-email':        return 'That is not a valid email address.';
    case 'auth/weak-password':        return 'Password is too weak — use at least 6 characters.';
    case 'auth/missing-password':     return 'Please provide a password.';
    case 'auth/operation-not-allowed':return 'Email/password sign-up is currently disabled.';
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':   return 'Incorrect email or password.';
    case 'auth/too-many-requests':    return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':return 'Network error. Check your connection and try again.';
    case 'permission-denied':         return 'Permission denied.';
    default: return (e && e.message) || 'Something went wrong.';
  }
}

async function authRegister(args) {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 3 || !parts[2]) { print('Usage: register <email> <password> <username>', 'error'); return; }
  const [email, password, username] = parts;
  print('Please enter your invitation code:', 'info');
  pendingAction = async (code) => {
    if (!code.trim()) { print('Registration cancelled.', 'muted'); return; }
    const trimmedCode = code.trim();
    try {
      // Validate invitation code against Firestore (code is the document id)
      const codeSnap = await _db.collection('invitation_codes').doc(trimmedCode).get();
      if (!codeSnap.exists) { print('Error: invalid invitation code.', 'error'); return; }
      print(`Registering ${username}…`, 'muted');
      const cred = await _auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: username });
      // Mirror the account into a `users` collection so the admin dashboard can
      // list registered users (Firebase Auth's user list isn't readable client-side).
      await _db.collection('users').doc(cred.user.uid).set({
        uid: cred.user.uid, email, username, created_at: new Date().toISOString(),
      });
      // createUserWithEmailAndPassword auto-signs in, but onAuthStateChanged fired
      // before displayName was set — refresh currentUser and the prompt manually.
      currentUser = cred.user;
      updatePrompt(username);
      print(`Registered and logged in as ${username}.`, 'success');
    } catch (e) {
      print(`Error: ${authErrorMessage(e)}`, 'error');
    }
  };
}

async function authLogin(args) {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2 || !parts[1]) { print('Usage: login <email> <password>', 'error'); return; }
  const [email, password] = parts;
  print(`Signing in…`, 'muted');
  try {
    const cred = await _auth.signInWithEmailAndPassword(email, password);
    currentUser = cred.user;
    const username = currentUser.displayName || currentUser.email;
    updatePrompt(username);
    print(`Logged in as ${username}`, 'success');
  } catch (e) {
    print(`Error: ${authErrorMessage(e)}`, 'error');
  }
}

async function authLogout() {
  try {
    await _auth.signOut();
    currentUser = null;
    updatePrompt(null);
    // Close any open document windows belonging to the previous session.
    Object.keys(docs).forEach(closeDocument);
    // Close the sidebar (command help / file list) too.
    closeHelpSidebar();
    // Clear the terminal history from the previous session.
    output.innerHTML = '';
    print('Logged out.', 'success');
  } catch (e) {
    print(`Error: ${authErrorMessage(e)}`, 'error');
  }
}

async function authWhoami() {
  const user = _auth.currentUser;
  if (!user) { print('Not logged in.', 'muted'); return; }
  const username = user.displayName || user.email;
  print(`Logged in as: ${username} (${user.email})`, 'info');
}

function authUnregister() {
  if (!requireLogin()) return;
  const username = currentUser.displayName || currentUser.email;
  print(`Are you sure you want to unregister your account (${username})? Please type your password to confirm:`, 'error');
  input.type = 'password';
  pendingAction = async (password) => {
    input.type = 'text';
    if (!password.trim()) { print('Unregister cancelled.', 'muted'); return; }
    try {
      // Re-authenticate to verify password (and satisfy "recent login" requirement)
      const cred = firebase.auth.EmailAuthProvider.credential(currentUser.email, password.trim());
      await currentUser.reauthenticateWithCredential(cred);
    } catch (e) {
      print(`Error: incorrect password. Unregister cancelled.`, 'error'); return;
    }
    try {
      const uid = currentUser.uid;
      // Delete all of the user's own documents (rules permit owners to delete).
      const snap = await _db.collection('documents').where('user_id', '==', uid).get();
      const batch = _db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(_db.collection('users').doc(uid)); // remove the profile mirror too
      await batch.commit();
      // Delete the auth account itself (allowed for one's own, freshly-reauthed account).
      await currentUser.delete();
      currentUser = null;
      updatePrompt(null);
      // Tidy up the previous session's UI, like logout does.
      Object.keys(docs).forEach(closeDocument);
      closeHelpSidebar();
      output.innerHTML = '';
      print('Your account has been deleted. Goodbye.', 'success');
    } catch (e) {
      print(`Error: ${authErrorMessage(e)}`, 'error');
    }
  };
}
