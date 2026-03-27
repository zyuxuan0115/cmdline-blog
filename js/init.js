// ─── Init ─────────────────────────────────────────────────────────────────────

printBanner();
updateHint();
input.focus();

// Restore existing session on page load
_supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    currentUser = session.user;
    updatePrompt(session.user.email);
    print(`Restored session: ${session.user.email}`, 'muted');
  }
});
