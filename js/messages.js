// ─── Messages & Friends ───────────────────────────────────────────────────────
// Friend requests are just messages of type 'friend_request' that land in the
// recipient's inbox. Accepting one creates a shared `friendships` document and
// sends a 'friend_accept' message back to the original sender.

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Deterministic friendship document id for a pair of uids.
function friendshipId(a, b) {
  return [a, b].sort().join('_');
}

function myName() {
  return currentUser.displayName || currentUser.email;
}

// ─── DB actions ───────────────────────────────────────────────────────────────

// Resolve a username to { uid, username } via the public usernames mapping.
// Prints an error and returns null if the name is unknown.
async function resolveUsername(name) {
  const snap = await _db.collection('usernames').doc(name.toLowerCase()).get();
  if (!snap.exists) { print(`No user named "${name}".`, 'error'); return null; }
  const d = snap.data();
  return { uid: d.uid, username: d.username || name };
}

async function sendFriendRequest(username) {
  if (!requireLogin()) return;
  username = (username || '').trim();
  if (!username) { print('Usage: friend <username>', 'error'); return; }

  try {
    const target = await resolveUsername(username);
    if (!target) return;
    if (target.uid === currentUser.uid) { print("You can't friend yourself.", 'error'); return; }

    // Already friends?
    const fs = await _db.collection('friendships').doc(friendshipId(currentUser.uid, target.uid)).get();
    if (fs.exists) { print(`You are already friends with ${target.username}.`, 'muted'); return; }

    // Already have a pending request out to them? (query only our own sent messages)
    const sent = await _db.collection('messages').where('from_uid', '==', currentUser.uid).get();
    const dup = sent.docs.some(d => {
      const m = d.data();
      return m.to_uid === target.uid && m.type === 'friend_request' && m.status === 'pending';
    });
    if (dup) { print(`You already have a pending friend request to ${target.username}.`, 'muted'); return; }

    await _db.collection('messages').add({
      from_uid: currentUser.uid,
      from_name: myName(),
      to_uid: target.uid,
      type: 'friend_request',
      text: `${myName()} wants to be your friend.`,
      status: 'pending',
      read: false,
      created_at: new Date().toISOString(),
    });
    print(`Friend request sent to ${target.username}.`, 'success');
  } catch (e) {
    print(`Error: ${e.message}`, 'error');
  }
}

async function sendDirectMessage(username, text) {
  if (!requireLogin()) return;
  username = (username || '').trim();
  text = (text || '').trim();
  if (!username || !text) { print("Usage: message <username> <text>", 'error'); return; }

  try {
    const target = await resolveUsername(username);
    if (!target) return;
    if (target.uid === currentUser.uid) { print("You can't message yourself.", 'error'); return; }

    await _db.collection('messages').add({
      from_uid: currentUser.uid,
      from_name: myName(),
      to_uid: target.uid,
      to_name: target.username,
      type: 'text',
      text,
      status: 'none',
      read: false,
      created_at: new Date().toISOString(),
    });
    print(`Message sent to ${target.username}.`, 'success');
  } catch (e) {
    print(`Error: ${e.message}`, 'error');
  }
}

async function acceptFriend(msgId) {
  if (!requireLogin()) return;
  try {
    const ref = _db.collection('messages').doc(msgId);
    const snap = await ref.get();
    if (!snap.exists) { print('That request no longer exists.', 'error'); return; }
    const m = snap.data();
    if (m.to_uid !== currentUser.uid || m.type !== 'friend_request') { print('Not a friend request addressed to you.', 'error'); return; }
    if (m.status !== 'pending') { print('That request was already handled.', 'muted'); return; }

    // Mark the request accepted.
    await ref.update({ status: 'accepted', read: true });

    // Create the shared friendship document (contains both uids and names).
    // Skip if it already exists — e.g. both users sent each other a request —
    // since the rules treat a write to an existing friendship as a forbidden update.
    const fRef = _db.collection('friendships').doc(friendshipId(currentUser.uid, m.from_uid));
    if (!(await fRef.get()).exists) {
      await fRef.set({
        users: [currentUser.uid, m.from_uid],
        names: { [currentUser.uid]: myName(), [m.from_uid]: m.from_name || m.from_uid },
        created_at: new Date().toISOString(),
      });
    }

    // Notify the original sender in their inbox.
    await _db.collection('messages').add({
      from_uid: currentUser.uid,
      from_name: myName(),
      to_uid: m.from_uid,
      type: 'friend_accept',
      text: `${myName()} accepted your friend request.`,
      status: 'none',
      read: false,
      created_at: new Date().toISOString(),
    });

    print(`You are now friends with ${m.from_name || m.from_uid}.`, 'success');
    openMessagesSidebar();
  } catch (e) {
    print(`Error: ${e.message}`, 'error');
  }
}

async function ignoreFriend(msgId) {
  if (!requireLogin()) return;
  try {
    const ref = _db.collection('messages').doc(msgId);
    const snap = await ref.get();
    if (!snap.exists) { print('That request no longer exists.', 'error'); return; }
    const m = snap.data();
    if (m.to_uid !== currentUser.uid || m.type !== 'friend_request') { print('Not a friend request addressed to you.', 'error'); return; }

    await ref.update({ status: 'ignored', read: true });
    print('Friend request ignored.', 'muted');
    openMessagesSidebar();
  } catch (e) {
    print(`Error: ${e.message}`, 'error');
  }
}

// ─── Messages sidebar ─────────────────────────────────────────────────────────

async function openMessagesSidebar() {
  if (!requireLogin()) return;
  try {
    const inboxSnap = await _db.collection('messages').where('to_uid', '==', currentUser.uid).get();
    const inbox = inboxSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // Mark plain messages / notifications as read once viewed.
    const batch = _db.batch();
    let dirty = false;
    inbox.forEach(m => {
      if (!m.read && m.type !== 'friend_request') {
        batch.update(_db.collection('messages').doc(m.id), { read: true });
        dirty = true;
      }
    });
    if (dirty) await batch.commit();

    // Direct messages this user has sent (friend requests are excluded).
    const sentSnap = await _db.collection('messages').where('from_uid', '==', currentUser.uid).get();
    const sent = sentSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => m.type === 'text')
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const friendsSnap = await _db.collection('friendships').where('users', 'array-contains', currentUser.uid).get();
    const friends = friendsSnap.docs.map(d => {
      const f = d.data();
      const otherUid = (f.users || []).find(u => u !== currentUser.uid);
      const name = (f.names && f.names[otherUid]) || otherUid;
      return { uid: otherUid, name };
    });

    swapSidebarContent(buildMessagesHTML(inbox, sent, friends), 'messages', 'Messages');
    print('Messages opened on the right.', 'muted');
  } catch (e) {
    print(`Error: ${e.message}`, 'error');
  }
}

function buildMessagesHTML(inbox, sent, friends) {
  const requests = inbox.filter(m => m.type === 'friend_request' && m.status === 'pending');
  const others = inbox.filter(m => m.type === 'text' || m.type === 'friend_accept');

  const youSection = `
    <div class="help-section">
      <div class="help-section-title">You</div>
      <div class="help-entry"><code>${escapeHtml(currentUser.displayName || currentUser.email)}</code><br><span>— others can add you with  friend ${escapeHtml(currentUser.displayName || '')}</span></div>
    </div>`;

  const reqSection = `
    <div class="help-section">
      <div class="help-section-title">Friend Requests${requests.length ? ` (${requests.length})` : ''}</div>
      ${requests.length ? requests.map(m => `
        <div class="help-entry">
          <code>${escapeHtml(m.from_name)}</code><br>
          <span>${escapeHtml(m.text)}</span><br>
          <span style="color:#556677;font-size:0.85em">${formatTimeAgo(m.created_at)}</span><br>
          <button class="msg-btn accept" onclick="acceptFriend('${m.id}')">accept</button>
          <button class="msg-btn ignore" onclick="ignoreFriend('${m.id}')">ignore</button>
        </div>`).join('') : `<div class="help-entry"><span>No pending requests.</span></div>`}
    </div>`;

  const msgSection = `
    <div class="help-section">
      <div class="help-section-title">Inbox${others.length ? ` (${others.length})` : ''}</div>
      ${others.length ? others.map(m => {
        const tag = m.type === 'friend_accept'
          ? ' <span style="color:#88ff88">[friend]</span>'
          : '';
        return `
        <div class="help-entry">
          <code>${escapeHtml(m.from_name)}</code>${tag}<br>
          <span>${escapeHtml(m.text)}</span><br>
          <span style="color:#556677;font-size:0.85em">${formatTimeAgo(m.created_at)}</span>
        </div>`;
      }).join('') : `<div class="help-entry"><span>No messages.</span></div>`}
    </div>`;

  const sentSection = `
    <div class="help-section">
      <div class="help-section-title">Sent${sent.length ? ` (${sent.length})` : ''}</div>
      ${sent.length ? sent.map(m => `
        <div class="help-entry">
          <code>to ${escapeHtml(m.to_name || '(user)')}</code><br>
          <span>${escapeHtml(m.text)}</span><br>
          <span style="color:#556677;font-size:0.85em">${formatTimeAgo(m.created_at)}</span>
        </div>`).join('') : `<div class="help-entry"><span>No sent messages.</span></div>`}
    </div>`;

  const friendsSection = `
    <div class="help-section">
      <div class="help-section-title">Friends${friends.length ? ` (${friends.length})` : ''}</div>
      ${friends.length ? friends.map(f => `
        <div class="help-entry"><code>${escapeHtml(f.name)}</code></div>`).join('')
        : `<div class="help-entry"><span>No friends yet. Try  friend &lt;username&gt;</span></div>`}
    </div>`;

  return youSection + reqSection + msgSection + sentSection + friendsSection;
}
