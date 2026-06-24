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

// ─── Firebase ─────────────────────────────────────────────────────────────────
// Initialised after the terminal essentials above, and guarded, so that a
// Firebase/CDN failure can't take the whole terminal down — it surfaces as a
// visible error instead of a dead input box.

const firebaseConfig = {
  apiKey: "AIzaSyDxos4vkR1hDYyiBZ5W1qtpM4Z48bKDyh8",
  authDomain: "cmdline-blog.firebaseapp.com",
  projectId: "cmdline-blog",
  storageBucket: "cmdline-blog.firebasestorage.app",
  messagingSenderId: "785251107809",
  appId: "1:785251107809:web:d5d10194c7b0538a1688a0",
  measurementId: "G-3XTR15LEPT"
};

let _auth, _db, _functions;
try {
  if (typeof firebase === 'undefined') {
    throw new Error('Firebase SDK failed to load (check your network / script tags).');
  }
  firebase.initializeApp(firebaseConfig);
  _auth = firebase.auth();
  _db = firebase.firestore();
  _functions = firebase.functions();
} catch (e) {
  print(`Firebase init failed: ${e.message}`, 'error');
}
