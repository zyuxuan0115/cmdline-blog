// ─── Init ─────────────────────────────────────────────────────────────────────

printBanner();
updateHint();
input.focus();

// Restore existing session on page load
_supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    currentUser = session.user;
    const username = session.user.user_metadata?.username || session.user.email;
    updatePrompt(username);
    print(`Restored session: ${username}`, 'muted');
  }
});
