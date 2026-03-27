# Terminal Document Editor

A web-based markdown document editor with a retro terminal interface and animated space background. Built with vanilla JavaScript and Supabase for backend storage and authentication.

## Project Structure

```
├── index.html          Main HTML entry point
├── style.css           Styling
├── package.json        Project metadata
├── js/
│   ├── state.js        Supabase client, shared state, print(), updatePrompt()
│   ├── db.js           Database helpers (tags, visibility, file existence)
│   ├── helpers.js      UI utilities (makeTL, makeBtn, makeDraggable, makeResizable)
│   ├── auth.js         User registration, login, logout, unregister, whoami
│   ├── help.js         Help sidebar content and toggle
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
| `tag <filename> <tag>` | Add a tag |
| `untag <filename> <tag>` | Remove a tag |
| `tags [tag]` | List tags or files under a tag |
| `publish <filename>` | Make a document public |
| `unpublish <filename>` | Make a document private |
| `clear` | Clear terminal output |
| `help` | Open help sidebar |
| `help close` | Close help sidebar |

## Invitation Code

Registration requires the following invitation code:

```
bdde0748f2bef928dc39a7c956bea1f97a2f5998abde14033bfc30e932bffbd4
```
