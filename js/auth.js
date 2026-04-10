// ─── Authentication ───────────────────────────────────────────────────────────

async function authRegister(args) {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 3 || !parts[2]) { print('Usage: register <email> <password> <username>', 'error'); return; }
  const [email, password, username] = parts;
  print('Please enter your invitation code:', 'info');
  pendingAction = async (code) => {
    if (!code.trim()) { print('Registration cancelled.', 'muted'); return; }
    // Validate invitation code against Supabase
    const trimmedCode = code.trim();
    // Debug: fetch all codes to compare
    const { data: allCodes } = await _supabase.from('invitation_codes').select('code');
    print(`DEBUG: your input (${trimmedCode.length} chars): "${trimmedCode}"`, 'muted');
    if (allCodes && allCodes.length > 0) {
      const stored = allCodes[0].code;
      print(`DEBUG: stored code (${stored.length} chars): "${stored}"`, 'muted');
      print(`DEBUG: match = ${stored === trimmedCode}`, 'muted');
    } else {
      print(`DEBUG: no codes found in table (data: ${JSON.stringify(allCodes)})`, 'muted');
    }
    const { data: codeData, error: codeErr } = await _supabase.from('invitation_codes').select('code').eq('code', trimmedCode).maybeSingle();
    if (codeErr) { print(`Error: ${codeErr.message}`, 'error'); return; }
    if (!codeData) { print('Error: invalid invitation code.', 'error'); return; }
    print(`Registering ${username}…`, 'muted');
    const { error } = await _supabase.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: 'https://kate0115.net/apps/cmdline-blog/register.html' } });
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    print(`Registered! Check your email (${email}) to confirm your account.`, 'success');
  };
}

async function authLogin(args) {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2 || !parts[1]) { print('Usage: login <email> <password>', 'error'); return; }
  const [email, password] = parts;
  print(`Signing in…`, 'muted');
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) { print(`Error: ${error.message}`, 'error'); return; }
  currentUser = data.user;
  const username = data.user.user_metadata?.username || data.user.email;
  updatePrompt(username);
  print(`Logged in as ${username}`, 'success');
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
  const username = user.user_metadata?.username || user.email;
  print(`Logged in as: ${username} (${user.email})`, 'info');
}

function authUnregister() {
  if (!requireLogin()) return;
  const username = currentUser.user_metadata?.username || currentUser.email;
  print(`Are you sure you want to unregister your account (${username})? Please type your password to confirm:`, 'error');
  input.type = 'password';
  pendingAction = async (password) => {
    input.type = 'text';
    if (!password.trim()) { print('Unregister cancelled.', 'muted'); return; }
    // Re-authenticate to verify password
    const { error: loginErr } = await _supabase.auth.signInWithPassword({ email: currentUser.email, password: password.trim() });
    if (loginErr) { print(`Error: incorrect password. Unregister cancelled.`, 'error'); return; }
    // Delete the user account
    const { error } = await _supabase.rpc('delete_user');
    if (error) { print(`Error: ${error.message}`, 'error'); return; }
    currentUser = null;
    updatePrompt(null);
    print('Your account has been deleted. Goodbye.', 'success');
  };
}
