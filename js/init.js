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
_supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    currentUser = session.user;
    const username = session.user.user_metadata?.username || session.user.email;
    updatePrompt(username);
    print(`Restored session: ${username}`, 'muted');
  }
});
