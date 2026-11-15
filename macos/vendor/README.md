# Bundled third-party dependencies

These files are checked into the repository so building and launching the UI
requires no CDN requests. `manifest.json` records exact download URLs and SHA-256
checksums. `prepare_web.py` validates every file before bundling it and rewrites
only the generated `index.html`; the browser version keeps its existing URLs.

- Firebase JavaScript SDK 10.12.2 — Apache-2.0 (`firebase-LICENSE`)
- CodeMirror 5.65.16 — MIT (`codemirror-LICENSE`)
- marked 15.0.12 — MIT (`marked-LICENSE`)

The app uses these libraries under their included licenses. Copyright notices
in the distributed files are preserved.
