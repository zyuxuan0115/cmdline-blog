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
_auth.onAuthStateChanged((user) => {
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
