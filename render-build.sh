#!/usr/bin/env bash
set -euo pipefail

rm -rf dist-web
mkdir -p dist-web/.well-known

find . -maxdepth 1 -type f \
  \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.txt' -o -name '*.xml' -o -name '*.webmanifest' \) \
  -exec cp {} dist-web/ \;

cp -R assets dist-web/assets
cp .well-known/security.txt dist-web/.well-known/security.txt
