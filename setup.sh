#!/usr/bin/env bash
# Install Old Growth Price Tracker into the user GNOME Shell extensions dir.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
UUID="price-tracker@oldgrowthcrypto.com"
DEST="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

if [[ "$ROOT" == "$DEST" ]]; then
  glib-compile-schemas "${DEST}/schemas/"
  echo "Already in install path: $DEST"
  echo "Schemas recompiled. Enable with: gnome-extensions enable ${UUID}"
  exit 0
fi

mkdir -p "$DEST"
rsync -a --delete \
  --exclude '.git' \
  --exclude '*.zip' \
  --exclude 'pack.sh' \
  --exclude 'setup.sh' \
  "$ROOT"/ "$DEST"/

# Keep helper scripts in the install tree too (handy for re-pack)
cp -f "$ROOT/pack.sh" "$DEST/pack.sh" 2>/dev/null || true
cp -f "$ROOT/setup.sh" "$DEST/setup.sh" 2>/dev/null || true
chmod +x "$DEST/pack.sh" "$DEST/setup.sh" 2>/dev/null || true

glib-compile-schemas "${DEST}/schemas/"

echo "Installed to: $DEST"
echo "Enable with:"
echo "  gnome-extensions enable ${UUID}"
echo "On Wayland, log out/in (or restart GNOME Shell) if the extension is not listed yet."
