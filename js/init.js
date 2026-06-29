// ─── Init ─────────────────────────────────────────────────────────────────────

printBanner();
updateHint();
input.focus();

const girlBubble = document.getElementById('terminal-girl-bubble');
if (girlBubble) {
  input.addEventListener('input', () => {
    girlBubble.classList.add('hidden');
  }, { once: true });
}

// Restore existing session on page load
let _sessionRestored = false;
if (_auth) _auth.onAuthStateChanged((user) => {
  // A session left over from the admin console must not leak into the app
  // terminal — sign it out so the admin account is never treated as a user.
  if (user && user.uid === ADMIN_UID) {
    _auth.signOut();
    return;
  }
  currentUser = user;
  if (user) {
    const username = user.displayName || user.email;
    updatePrompt(username);
    if (!_sessionRestored) {
      print(`Restored session: ${username}`, 'muted');
      _sessionRestored = true;
    }
  } else {
    updatePrompt(null);
  }
});
