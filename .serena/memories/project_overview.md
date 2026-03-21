# Project Overview

**Name:** cmdline-blog (Terminal Document Editor)

**Purpose:** A browser-based terminal-style document editor that lets users create, edit, and manage Markdown documents through a command-line interface. Documents are stored in Supabase with user authentication, tagging, and public/private visibility.

## Tech Stack
- **Frontend:** Vanilla HTML + CSS + JavaScript (no framework, no build tools)
- **Backend:** Supabase (authentication + PostgreSQL database)
- **Markdown rendering:** marked.js (loaded via CDN)
- **Supabase client:** @supabase/supabase-js v2 (loaded via CDN)
- **Font:** Noto Serif SC (Google Fonts) + Courier New for terminal/monospace

## File Structure
- `index.html` — Main HTML shell (terminal panel, windows container, help sidebar)
- `style.css` — All styles (terminal, document windows, help sidebar, space background)
- `app.js` — All application logic (~985 lines): Supabase client, terminal commands, document window management, drag/resize, animated space background
- `package.json` — Minimal, just metadata (no dependencies installed, no build scripts)
- `.gitignore` — Standard Node.js gitignore

## Key Features
- Terminal command interface (create, open, close, list, tag, untag, publish, unpublish, etc.)
- Draggable/resizable document windows with macOS-style traffic lights
- Markdown edit/preview toggle
- Image upload (base64 inline)
- Auto-save to Supabase with debounce (800ms)
- User auth (register, login, logout, whoami)
- Document tagging system
- Public/private visibility toggle
- Animated space background with rotating starfield and shooting stars
- Resizable terminal panel
- Help sidebar
