#!/usr/bin/env bash
set -euo pipefail

rm -rf dist-web
mkdir -p dist-web/.well-known

find . -maxdepth 1 -type f \
  \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.txt' -o -name '*.xml' -o -name '*.webmanifest' -o -name '*.svg' \) \
  -exec cp {} dist-web/ \;

cp -R assets dist-web/assets
cp .well-known/security.txt dist-web/.well-known/security.txt

# Machine-readable deployment marker for production parity checks.
# Render exposes RENDER_GIT_COMMIT during builds; local/CI builds fall back to git.
release_commit="${RENDER_GIT_COMMIT:-$(git rev-parse HEAD)}"
printf '%s\n' "$release_commit" > dist-web/release.txt
