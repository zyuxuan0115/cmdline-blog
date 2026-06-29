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
  // The admin's Firebase session is shared across this origin (e.g. the admin
  // console open in another tab). Don't sign it out — that would propagate to
  // every tab and kick the admin out of the dashboard. Just refuse to treat the
  // admin as a logged-in user of the app terminal, leaving the console intact.
  if (user && user.uid === ADMIN_UID) {
    currentUser = null;
    updatePrompt(null);
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
