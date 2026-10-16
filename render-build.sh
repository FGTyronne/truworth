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

# Every production release gets unique shell asset URLs. footer-v35 is also
# injected independently of app.js so a stale cached loader cannot resurrect
# one of the legacy footer rewrite layers.
while IFS= read -r -d '' page; do
  sed -E -i \
    -e "s#app\\.js(\\?v=[^\"']*)?#app.js?v=${release_commit}#g" \
    -e "s#app\\.css(\\?v=[^\"']*)?#app.css?v=${release_commit}#g" \
    "$page"

  if ! grep -F 'footer-v35.js' "$page" >/dev/null; then
    sed -i "s#</body>#  <script src=\"footer-v35.js?v=${release_commit}\"></script>\n</body>#" "$page"
  else
    sed -E -i "s#footer-v35\\.js(\\?v=[^\"']*)?#footer-v35.js?v=${release_commit}#g" "$page"
  fi
done < <(find dist-web -maxdepth 1 -type f -name '*.html' -print0)
