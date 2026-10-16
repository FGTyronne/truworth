#!/usr/bin/env bash
set -euo pipefail

rm -rf dist-web
mkdir -p dist-web/.well-known

find . -maxdepth 1 -type f \
  \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.txt' -o -name '*.xml' -o -name '*.webmanifest' -o -name '*.svg' \) \
  -exec cp {} dist-web/ \;

cp -R assets dist-web/assets
cp .well-known/security.txt dist-web/.well-known/security.txt

# Flatten the theme cascade into one production stylesheet. Source app.css
# stays modular for development, while production avoids 18 render-blocking
# stylesheet requests.
mapfile -t theme_files < <(sed -nE "s#^[[:space:]]*@import[[:space:]]+url\\('([^?']+)(\\?[^']*)?'\\);#\\1#p" app.css)
if ((${#theme_files[@]})); then
  : > dist-web/app.css
  for stylesheet in "${theme_files[@]}"; do
    if [[ ! -f "$stylesheet" ]]; then
      echo "Missing stylesheet referenced by app.css: $stylesheet" >&2
      exit 1
    fi
    printf '\n/* %s */\n' "$stylesheet" >> dist-web/app.css
    cat "$stylesheet" >> dist-web/app.css
    printf '\n' >> dist-web/app.css
  done
fi

# Machine-readable deployment marker for production parity checks.
# Render exposes RENDER_GIT_COMMIT during builds; local/CI builds fall back to git.
release_commit="${RENDER_GIT_COMMIT:-$(git rev-parse HEAD)}"
printf '%s\n' "$release_commit" > dist-web/release.txt

# Every production release gets a unique app shell asset URL. This prevents a
# returning browser from keeping an old app.js/app.css loader after a deploy.
while IFS= read -r -d '' page; do
  sed -E -i \
    -e "s#app\\.js(\\?v=[^\"']*)?#app.js?v=${release_commit}#g" \
    -e "s#app\\.css(\\?v=[^\"']*)?#app.css?v=${release_commit}#g" \
    "$page"
done < <(find dist-web -maxdepth 1 -type f -name '*.html' -print0)
