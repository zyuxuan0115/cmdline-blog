# CmdLine Blog

A web-based markdown editor and blogging tool with a retro terminal interface and
an animated space background. You write in vim inside a terminal, then publish
what you like as a plain, readable blog page. Built with vanilla JavaScript and
Firebase (Firestore, Auth, Cloud Functions, Hosting).

## Project Structure

```
├── index.html          The terminal app — main entry point
├── blog.html           Blog reader for one user's posts (blog <username>)
├── register.html       Landing page after an email confirmation link
├── style.css           Styling for the terminal app
├── blog.css            Styling for the blog reader (normal, non-pixel type)
├── firebase.json       Hosting, Firestore and Functions configuration
├── firestore.rules     Access rules (ownership, friends, public documents)
├── firestore.indexes.json  Composite index definitions
├── package.json        Project metadata
├── admin/              Admin console (dashboard, user documents)
├── functions/          Cloud Functions used by the admin console
├── fonts/              Cubic 11 pixel font
├── pic/                Images used by the terminal app
├── js/
│   ├── firebase-config.js  Firebase project config, shared by every page
│   ├── state.js        Shared state, print(), updatePrompt()
│   ├── db.js           Database helpers (tags, visibility, file existence)
│   ├── helpers.js      UI utilities (windows, dragging, resizing, clipboard)
│   ├── auth.js         User registration, login, logout, unregister, whoami
│   ├── help.js         Sidebar content (commands, vim, hotkeys, list) and toggle
│   ├── vim-editor.js   CodeMirror + vim keymap adapter used by every editor
│   ├── documents.js    Document window management and buildWindow()
│   ├── messages.js     Friend requests, direct messages and the inbox sidebar
│   ├── terminal.js     Command definitions and terminal input handling
│   ├── resize.js       Terminal panel resize handle
│   ├── background.js   Space background canvas animation (nebulae, stars, shooting stars)
│   ├── init.js         Initialization and session restore
│   └── blog.js         Blog reader page logic
```

## Commands

### Documents

| Command | Description |
|---------|-------------|
| `create [--title '...'] [--public]` | Create a new document |
| `new [--title '...'] [--public]` | Alias for create |
| `open <index>` | Open / focus a document from the last list |
| `close [<index>]` | Close the current window, or a list index while the list is open |
| `list` | All public documents plus your own |
| `list public` | All public documents |
| `list mywork` | All your documents |
| `list private` | Your private documents only |
| `list shared` | Yours and your friends' shared documents |
| `list close` | Close the list sidebar |
| `hash <index>` | Print a document's hash and copy it to the clipboard |
| `blog <username>` | Read a user's published posts in a new tab |
| `blog` | Read your own published posts |
| `blog --name <title>` | Title your own blog (`--name ''` resets it to your username; `--name` alone prints the current title) |

### Tags

| Command | Description |
|---------|-------------|
| `tag -h <hash> <tag>` | Add a tag by hash |
| `tag -i <index> <tag>` | Add a tag by list index |
| `untag <hash> <tag>` | Remove a tag |
| `tags [tag]` | List tags, or the files under one tag |

### Visibility

| Command | Description |
|---------|-------------|
| `publish -h <hash>` / `publish -i <index>` | Make a document public |
| `share -h <hash>` / `share -i <index>` | Share a document with your friends |
| `unpublish -h <hash>` / `unpublish -i <index>` | Make a document private again |

### Account

| Command | Description |
|---------|-------------|
| `register <email> <password> <username>` | Create an account (requires an invitation code) |
| `login <email> <password>` | Sign in |
| `logout` | Sign out |
| `unregister` | Delete your account |
| `whoami` | Show the current user |

### Social

| Command | Description |
|---------|-------------|
| `friend <username>` | Send a friend request |
| `message <username> <text>` | Send a direct message (alias: `msg`) |
| `messages` | Open your inbox and friends list (alias: `inbox`) |
| `messages close` | Close the messages sidebar |

### Terminal

| Command | Description |
|---------|-------------|
| `clear` | Clear terminal output |
| `commands` / `commands close` | Open / close the commands sidebar |
| `hotkeys` / `hotkeys close` | Open / close the keyboard shortcuts sidebar |
| `vim commands` / `vim commands close` | Open / close the vim command reference |

### Hotkeys

| Keys | Description |
|------|-------------|
| ``Ctrl + ` `` | Toggle focus between the terminal and a document window |
| `Ctrl + 1` | Focus the next document window (editable ones open for editing) |
| `Ctrl + X` | Close the current window, or return to the terminal |
| `Ctrl + Z` | Toggle the sidebar |
| `↑` / `↓` | Browse command history |

## Editing (vim)

Every document window edits through CodeMirror running its vim keymap, so the
usual modal editing works: modes, counts, motions, operators, text objects,
registers, macros, marks, `/` search and `:` ex commands.

| Keys | Description |
|------|-------------|
| `i` `a` `o` | Insert before / after the cursor, or on a new line |
| `Esc` | Back to normal mode |
| `h j k l`, `w b`, `0 $`, `gg G` | Motions — prefix with a count, e.g. `3j` |
| `dd` `yy` `p` `x` | Delete line, yank line, paste, delete character |
| `dw` `ciw` `d$` | Operator + motion or text object |
| `v` `V` `Ctrl+V` | Visual, visual line, visual block |
| `u` `Ctrl+R` | Undo / redo |
| `/text` `n` `N` | Search, next / previous match |
| `:s/old/new/g` | Substitute on the current line |
| `:w` | Save now |
| `:q` | Close the window |
| `:wq` / `:x` | Save and close |
| `:pre[view]` | Switch the window to preview |

The current mode shows next to the toolbar's **VIM** button; that button turns
modal editing off (or back on) for every open window and remembers the choice.
Arriving at a window from elsewhere — ``Ctrl+` `` from the terminal, `Ctrl+1`
between windows, or the **Edit** tab — always lands in normal mode, whatever
mode the editor was left in.
`Ctrl+X` stays the app's "close window" hotkey, so vim's decrement is unmapped.
If the CodeMirror CDN is unreachable the window falls back to a plain textarea,
so documents stay editable either way.

`hash <index>` puts a document's hash on the system clipboard *and* in vim's
unnamed register, so it pastes with `Cmd/Ctrl+V` outside the editor and with `p`
inside one.

## The blog page

`blog.html` renders one author's posts as an ordinary web page — white paper,
serif type, no terminal chrome. It reads these URL parameters:

| Parameter | Meaning |
|-----------|---------|
| `?u=<username>` | Whose blog to show |
| `&p=<hash>` | A single post instead of the index |
| `&t=<tag>` | Only posts carrying that tag |
| `&q=<words>` | Only posts containing every word, in the title, body or tags |
| `&page=<n>` | Which page of the index |

The index shows the 15 most recent posts per page, with `next →` and
`← previous` links for the rest. Each post's tags link to that author's other
posts under the same tag, and the magnifying glass under the blog title expands
into a search box.

Public posts are listed for everyone, and a signed-in friend of the author also
sees their `shared` posts. Private posts are listed only on the author's own
index, while they're signed in — everyone else gets neither the entry nor the
post behind its link. Posts that aren't public are marked *private* or
*friends only* under the entry.

## Invitation Code

Registration requires one of the following invitation codes:

```
bdde0748f2bef928dc39a7c956bea1f97a2f5998abde14033bfc30e932bffbd4
d6c81c42107af620b5f6becd260eba464f4a880dadfb2d569fea3cfca3b76b3e
e35b098c9438d391c02b8adb9d977397a7f95cb177552ad3bf60e91a43a7882a
```
