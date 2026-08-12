#!/usr/bin/env bash
# Pack a extensions.gnome.org / local install zip.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
UUID="price-tracker@oldgrowthcrypto.com"
OUT="${1:-${ROOT}/oldgrowth-price-tracker.shell-extension.zip}"

glib-compile-schemas "${ROOT}/schemas/"

# Required entry points — fail early if a critical file is missing
for f in metadata.json extension.js settings.js stylesheet.css \
  schemas/org.gnome.shell.extensions.oldgrowth-price-tracker.gschema.xml \
  schemas/gschemas.compiled; do
  if [[ ! -e "${ROOT}/${f}" ]]; then
    echo "Missing required file: ${f}" >&2
    exit 1
  fi
done

rm -f "$OUT"
(
  cd "$ROOT"
  zip -r "$OUT" . \
    -x '*.git*' \
    -x '.git/*' \
    -x '*~' \
    -x '*.zip' \
    -x 'pack.sh' \
    -x 'setup.sh' \
    -x '.gitignore' \
    -x 'HOWTO.txt' \
    -x 'README.md' \
    -x '**/.DS_Store'
)

echo "Packed: $OUT"
unzip -l "$OUT" | head -40
# Ensure settings.js made it into the archive
unzip -l "$OUT" | grep -q 'settings.js' || {
  echo "ERROR: settings.js missing from zip" >&2
  exit 1
}
