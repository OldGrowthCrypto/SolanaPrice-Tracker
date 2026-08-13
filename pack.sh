#!/usr/bin/env bash
# Pack GNOME extension zip + optional full source release zip.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
UUID="price-tracker@oldgrowthcrypto.com"
EXT_OUT="${1:-${ROOT}/oldgrowth-price-tracker.shell-extension.zip}"
RELEASE_OUT="${ROOT}/SolanaPrice-Tracker-v2.0.zip"

glib-compile-schemas "${ROOT}/schemas/"

for f in metadata.json extension.js settings.js stylesheet.css prefs.js \
  schemas/org.gnome.shell.extensions.oldgrowth-price-tracker.gschema.xml \
  schemas/gschemas.compiled README.md HOWTO.txt LICENSE; do
  if [[ ! -e "${ROOT}/${f}" ]]; then
    echo "Missing required file: ${f}" >&2
    exit 1
  fi
done

# —— Extension install zip (for gnome-extensions install / e.g.o) ——
rm -f "$EXT_OUT"
(
  cd "$ROOT"
  zip -r "$EXT_OUT" . \
    -x '*.git*' \
    -x '.git/*' \
    -x '*~' \
    -x '*.zip' \
    -x 'pack.sh' \
    -x 'setup.sh' \
    -x '.gitignore' \
    -x '**/.DS_Store' \
    -x 'docs/screenshots/*.png'
)

echo "Extension zip: $EXT_OUT"
unzip -l "$EXT_OUT" | grep -E 'settings.js|metadata.json|extension.js|HOWTO|README' || true
unzip -l "$EXT_OUT" | grep -q 'settings.js' || {
  echo "ERROR: settings.js missing from zip" >&2
  exit 1
}

# —— Full source release zip (for GitHub upload) ——
rm -f "$RELEASE_OUT"
(
  cd "$ROOT"
  zip -r "$RELEASE_OUT" . \
    -x '*.git*' \
    -x '.git/*' \
    -x '*~' \
    -x '**/.DS_Store' \
    -x 'SolanaPrice-Tracker-v2.0.zip' \
    -x 'oldgrowth-price-tracker.shell-extension.zip'
  # re-add extension zip into release so users get both
)
# Add the extension zip into the release archive
(
  cd "$ROOT"
  zip -u "$RELEASE_OUT" "$(basename "$EXT_OUT")"
)

echo ""
echo "Release zip:  $RELEASE_OUT"
ls -lh "$EXT_OUT" "$RELEASE_OUT"
echo "UUID: $UUID"
echo "Done."
