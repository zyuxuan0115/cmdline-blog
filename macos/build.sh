#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

# Keep SwiftPM's caches inside this directory, including in restricted workspaces.
export CLANG_MODULE_CACHE_PATH="$PWD/.build/clang-cache"
export SWIFTPM_MODULECACHE_OVERRIDE="$PWD/.build/module-cache"
python3 prepare_web.py
swift build -c release --disable-sandbox --cache-path "$PWD/.build/cache" "$@"
bin_dir=$(swift build -c release --disable-sandbox --cache-path "$PWD/.build/cache" --show-bin-path "$@")
staging=$(mktemp -d "${TMPDIR:-/tmp}/cmdline-blog.XXXXXX")
trap 'rm -rf "$staging"' EXIT
app="$staging/CmdLine Blog.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$bin_dir/CmdLineBlog" "$app/Contents/MacOS/"
cp Info.plist "$app/Contents/Info.plist"
# The app resolves its SwiftPM resource bundle from Contents/Resources.
for bundle in "$bin_dir/"*.bundle; do
    [ -d "$bundle" ] || continue
    cp -R "$bundle" "$app/Contents/Resources/"
done
# Finder/iCloud may add metadata to generated bundles under Desktop.
xattr -cr "$app"
codesign --force --sign - "$app"
codesign --verify --deep --strict "$app"
mkdir -p dist
# The ZIP preserves the verified bundle even when Desktop/iCloud adds Finder
# metadata to the convenient unpacked copy after signing.
ditto -c -k --keepParent --norsrc "$app" "$PWD/dist/CmdLine Blog.zip"
ditto --norsrc "$app" "$PWD/dist/CmdLine Blog.app"
xattr -cr "$PWD/dist/CmdLine Blog.app"
printf 'Built %s\n' "$PWD/dist/CmdLine Blog.app"
printf 'Packaged %s\n' "$PWD/dist/CmdLine Blog.zip"
