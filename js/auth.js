// ─── Authentication ───────────────────────────────────────────────────────────

async function authRegister(args) {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2 || !parts[1]) { print('Usage: register <email> <password>', 'error'); return; }
  const [email, password] = parts;
  print(`Registering ${email}…`, 'muted');
  const { error } = await _supabase.auth.signUp({ email, password });
  if (error) { print(`Error: ${error.message}`, 'error'); return; }
  print(`Registered! Check your email (${email}) to confirm your account.`, 'success');
}

async function authLogin(args) {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2 || !parts[1]) { print('Usage: login <email> <password>', 'error'); return; }
  const [email, password] = parts;
  print(`Signing in…`, 'muted');
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) { print(`Error: ${error.message}`, 'error'); return; }
  currentUser = data.user;
  updatePrompt(data.user.email);
  print(`Logged in as ${data.user.email}`, 'success');
}

async function authLogout() {
  const { error } = await _supabase.auth.signOut();
  if (error) { print(`Error: ${error.message}`, 'error'); return; }
  currentUser = null;
  updatePrompt(null);
  print('Logged out.', 'success');
}

async function authWhoami() {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) { print('Not logged in.', 'muted'); return; }
  print(`Logged in as: ${user.email}`, 'info');
}
