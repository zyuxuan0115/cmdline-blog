# Suggested Commands

## Running the Project
There is no build step or dev server configured. To run locally, use any static file server:
```bash
# Using Python
python3 -m http.server 8000

# Using Node.js (npx)
npx serve .

# Using PHP
php -S localhost:8000
```
Then open `http://localhost:8000` in a browser.

## Testing / Linting / Formatting
- **No test framework** is configured (`npm test` just echoes an error)
- **No linter** (e.g., ESLint) is configured
- **No formatter** (e.g., Prettier) is configured

## Git
```bash
git status
git log --oneline -10
git diff
git add <file>
git commit -m "message"
git push
```

## System Utilities (macOS / Darwin)
```bash
ls -la          # list files
find . -name "*.js"
grep -rn "pattern" .
open index.html  # open in default browser
```
