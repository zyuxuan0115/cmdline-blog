# Terminal Document Editor

A web-based markdown document editor with a retro terminal interface and animated space background. Built with vanilla JavaScript and Supabase for backend storage and authentication.

## Project Structure

```
├── index.html          Main HTML entry point
├── blog.html           Plain blog reader for one user's posts (blog <username>)
├── style.css           Styling
├── blog.css            Styling for the blog reader (normal, non-pixel type)
├── package.json        Project metadata
├── js/
│   ├── firebase-config.js  Firebase project config, shared by both pages
│   ├── blog.js         Blog reader page logic
│   ├── state.js        Supabase client, shared state, print(), updatePrompt()
│   ├── db.js           Database helpers (tags, visibility, file existence)
│   ├── helpers.js      UI utilities (makeTL, makeBtn, makeDraggable, makeResizable)
│   ├── auth.js         User registration, login, logout, unregister, whoami
│   ├── help.js         Help sidebar content and toggle
│   ├── vim-editor.js   CodeMirror + vim keymap adapter used by every editor
│   ├── documents.js    Document window management and buildWindow()
│   ├── terminal.js     Command definitions and terminal input handling
│   ├── resize.js       Terminal panel resize handle
│   ├── background.js   Space background canvas animation (nebulae, stars, shooting stars)
│   └── init.js         Initialization and session restore
```

## Commands

| Command | Description |
|---------|-------------|
| `register <email> <password> <username>` | Create an account (requires invitation code) |
| `login <email> <password>` | Sign in |
| `logout` | Sign out |
| `unregister` | Delete your account |
| `whoami` | Show current user |
| `create <filename> [--public]` | Create a new document |
| `new <filename>` | Alias for create |
| `open <filename>` | Open / focus a document |
| `close <filename>` | Close a document window |
| `list` | List all your documents |
| `blog <username>` | Open that user's published posts as a normal blog page, in a new tab |
| `blog` | Open your own blog page |
| `blog --name <title>` | Title your own blog (`--name ''` resets it to your username; `--name` alone prints the current title) |
| `tag <hash> <tag>` | Add a tag |
| `untag <hash> <tag>` | Remove a tag |
| `tags [tag]` | List tags or files under a tag |
| `publish <hash>` | Make a document public |
| `unpublish <hash>` | Make a document private |
| `clear` | Clear terminal output |
| `help` | Open help sidebar |
| `help close` | Close help sidebar |

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

## Invitation Code

Registration requires one of the following invitation codes:

```
bdde0748f2bef928dc39a7c956bea1f97a2f5998abde14033bfc30e932bffbd4
d6c81c42107af620b5f6becd260eba464f4a880dadfb2d569fea3cfca3b76b3e
e35b098c9438d391c02b8adb9d977397a7f95cb177552ad3bf60e91a43a7882a
```
