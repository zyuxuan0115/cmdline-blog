# Task Completion Checklist

Since there are no automated linting, formatting, or testing tools configured, the following manual checks should be done after completing a task:

1. **Verify no syntax errors** — Open `index.html` in a browser and check the browser console for errors
2. **Test affected commands** — If terminal commands were modified, test them manually in the browser terminal
3. **Check responsive behavior** — Window dragging, resizing, and terminal resize should still work
4. **Verify Supabase operations** — If DB-related code was changed, ensure create/open/save/list still work
5. **Cross-check help sidebar** — If commands were added/removed, update the `HELP_SECTIONS` array in `app.js`
6. **Visual check** — Ensure the space background, glassmorphism, and pink accent theme are intact
