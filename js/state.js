// ─── Firebase ─────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "AIzaSyDxos4vkR1hDYyiBZ5W1qtpM4Z48bKDyh8",
  authDomain: "cmdline-blog.firebaseapp.com",
  projectId: "cmdline-blog",
  storageBucket: "cmdline-blog.firebasestorage.app",
  messagingSenderId: "785251107809",
  appId: "1:785251107809:web:d5d10194c7b0538a1688a0",
  measurementId: "G-3XTR15LEPT"
};

firebase.initializeApp(firebaseConfig);
const _auth = firebase.auth();
const _db = firebase.firestore();
const _functions = firebase.functions();

// ─── State ───────────────────────────────────────────────────────────────────

const docs = {};           // filename → { content, win }
let cmdHistory = [];
let historyIndex = -1;
let zCounter = 100;
let currentUser = null;   // currently logged-in Firebase user
let pendingAction = null; // callback for confirmation prompts (e.g. unregister)

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
