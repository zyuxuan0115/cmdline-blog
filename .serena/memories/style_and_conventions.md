# Code Style and Conventions

## JavaScript (app.js)
- **No framework** — vanilla DOM manipulation throughout
- **ES6+ syntax:** `const`/`let`, arrow functions, template literals, async/await, destructuring
- **No modules:** Single `app.js` file loaded via `<script>` tag; relies on global scope
- **Naming:** camelCase for functions and variables (e.g., `openDocument`, `cmdHistory`, `currentUser`)
- **Constants:** UPPER_SNAKE_CASE for config-like values (e.g., `COMMANDS`, `HELP_SECTIONS`, `ROT_SPEED`, `NEBULAE`)
- **Private convention:** Leading underscore for Supabase client (`_supabase`)
- **No type hints, no JSDoc, no docstrings**
- **Section separators:** ASCII box-drawing comments (e.g., `// ─── Section Name ───`)
- **Inline HTML construction:** Uses `document.createElement` heavily; some `innerHTML` for simple cases
- **Error handling:** Minimal — checks Supabase `error` response, prints to terminal

## CSS (style.css)
- **No preprocessor** (plain CSS)
- **Naming:** kebab-case IDs and classes (e.g., `#terminal-panel`, `.doc-window`, `.tag-pill`)
- **BEM-like but not strict** (e.g., `.doc-titlebar`, `.doc-title-input`, `.tag-pill-remove`)
- **Design:** Dark theme with pink accent (#ffadd6), glassmorphism (backdrop-filter blur), macOS-inspired window chrome
- **Colors:** Dark background (#070b14), pink accents (#ffadd6), blue info (#88aaff), red errors (#ff4466)

## HTML (index.html)
- Minimal shell — most DOM is created dynamically in JS
- CDN-loaded dependencies (marked.js, supabase-js, Google Fonts)
