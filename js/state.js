// ─── Supabase ─────────────────────────────────────────────────────────────────

const _supabase = supabase.createClient(
  'https://emjhatsnkpvnszueetoi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtamhhdHNua3B2bnN6dWVldG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjQ5MzMsImV4cCI6MjA4OTMwMDkzM30.P2V9k6GNHwl3s01USbL4U11PIMjYR2A_OjGnral7qY8'
);

// ─── State ───────────────────────────────────────────────────────────────────

const docs = {};           // filename → { content, win }
let cmdHistory = [];
let historyIndex = -1;
let zCounter = 100;
let currentUser = null;   // currently logged-in Supabase user

// ─── Shared DOM refs ─────────────────────────────────────────────────────────

const output   = document.getElementById('terminal-output');
const input    = document.getElementById('terminal-input');
const container = document.getElementById('windows-container');
const promptEl = document.getElementById('terminal-prompt');

// ─── Shared helpers ──────────────────────────────────────────────────────────

function requireLogin() {
  if (!currentUser) { print('You must be logged in. Use  login <email> <password>', 'error'); return false; }
  return true;
}

function print(text, cls = 'info') {
  const line = document.createElement('div');
  line.className = `terminal-line ${cls}`;
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function updatePrompt(email) {
  promptEl.textContent = email ? `${email} $ ` : '$ ';
}
