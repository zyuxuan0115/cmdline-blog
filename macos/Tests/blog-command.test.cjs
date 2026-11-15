const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function terminal({ desktop, user = null, popup = {} } = {}) {
  const output = [], opened = [], titles = [];
  const element = { addEventListener() {} };
  const context = vm.createContext({
    window: {
      cmdlineDesktop: desktop,
      open(url, target) { opened.push([url, target]); return popup; }
    },
    document: { addEventListener() {}, getElementById() { return element; } },
    input: element,
    currentUser: user,
    print(text, kind) { output.push([text, kind]); },
    requireLogin() { return !!user; },
    BLOG_NAME_MAX: 80,
    ensureUsernameMapping: async () => {},
    dbSetBlogName: async title => titles.push(title),
    dbGetBlogName: async () => 'My Blog'
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/terminal.js'), 'utf8'), context);
  return {
    blog: arg => vm.runInContext(`COMMANDS.blog(${JSON.stringify(arg)})`, context),
    output, opened, titles
  };
}

test('web uses a new tab and encodes usernames', async () => {
  const app = terminal();
  await app.blog('@some user&tag');
  assert.deepEqual(app.opened, [['blog.html?u=some%20user%26tag', '_blank']]);
  assert.equal(app.output[0][1], 'success');
});

test('macOS awaits the native default-browser result', async () => {
  const urls = [];
  const app = terminal({ desktop: { openBlog: async url => { urls.push(url); return true; } } });
  await app.blog('alice');
  assert.deepEqual(urls, ['blog.html?u=alice']);
  assert.equal(app.opened.length, 0);
  assert.match(app.output[0][0], /default browser/);
  assert.equal(app.output[0][1], 'success');
});

test('native failures are visible and never report success', async () => {
  for (const openBlog of [async () => false, async () => { throw new Error('Launch failed'); }]) {
    const app = terminal({ desktop: { openBlog } });
    await app.blog('alice');
    assert.equal(app.output.length, 1);
    assert.equal(app.output[0][1], 'error');
    assert.equal(app.opened.length, 0);
  }
});

test('blog defaults to the signed-in user', async () => {
  const app = terminal({ user: { displayName: 'alice' } });
  await app.blog('');
  assert.equal(app.opened[0][0], 'blog.html?u=alice');
  const loggedOut = terminal();
  await loggedOut.blog('');
  assert.equal(loggedOut.opened.length, 0);
  assert.match(loggedOut.output[0][0], /Usage/);
});

test('title commands never open a browser', async () => {
  const app = terminal({
    user: { displayName: 'alice' },
    desktop: { openBlog: async () => { throw new Error('Must not open'); } }
  });
  await app.blog('--name "A new title"');
  await app.blog('--name');
  await app.blog("--name ''");
  assert.deepEqual(app.titles, ['A new title', '']);
  assert.equal(app.opened.length, 0);
  assert.ok(app.output.every(([, kind]) => kind !== 'error'));
});

test('injected bridge resolves relative URLs and returns the native promise', async () => {
  const sent = [];
  const context = vm.createContext({
    URL,
    document: { baseURI: 'https://example.com/apps/blog/' },
    window: { webkit: { messageHandlers: { openBlog: {
      postMessage: async url => { sent.push(url); return true; }
    } } } }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../Sources/CmdLineBlog/Resources/desktop.js'), 'utf8'), context);
  assert.equal(await vm.runInContext("window.cmdlineDesktop.openBlog('blog.html?u=alice')", context), true);
  assert.deepEqual(sent, ['https://example.com/apps/blog/blog.html?u=alice']);
});
