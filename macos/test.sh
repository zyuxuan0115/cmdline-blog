#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
export CLANG_MODULE_CACHE_PATH="$PWD/.build/clang-cache"
export SWIFTPM_MODULECACHE_OVERRIDE="$PWD/.build/module-cache"
mkdir -p .build
swiftc -swift-version 6 -default-isolation MainActor -parse-as-library Sources/CmdLineBlog/Site.swift Sources/CmdLineBlog/WebAssets.swift Sources/CmdLineBlog/LocalServer.swift Tests/CheckRoutes.swift -o .build/check-routes
.build/check-routes
node --test Tests/blog-command.test.cjs
python3 -m unittest discover -s Tests -p 'test_*.py'
