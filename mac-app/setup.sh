#!/bin/bash
# setup.sh — assembles Plan Manager.app from the Electron binary + our files.
# No npm, no internet required after you download the one Electron zip below.
set -e

ARCH=$(uname -m)
VERSION="30.0.9"

if [ "$ARCH" = "arm64" ]; then
  ZIP_NAME="electron-v${VERSION}-darwin-arm64.zip"
  DOWNLOAD_URL="https://github.com/electron/electron/releases/download/v${VERSION}/electron-v${VERSION}-darwin-arm64.zip"
else
  ZIP_NAME="electron-v${VERSION}-darwin-x64.zip"
  DOWNLOAD_URL="https://github.com/electron/electron/releases/download/v${VERSION}/electron-v${VERSION}-darwin-x64.zip"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║         Plan Manager — macOS setup               ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Architecture: $ARCH"
echo "Looking for:  $ZIP_NAME"
echo ""

# ── Find the Electron zip ────────────────────────────────────────────────────
ZIP_PATH=""
SEARCH_PATHS=("./$ZIP_NAME" "$HOME/Downloads/$ZIP_NAME" "../$ZIP_NAME")
for loc in "${SEARCH_PATHS[@]}"; do
  if [ -f "$loc" ]; then
    ZIP_PATH="$loc"
    break
  fi
done

if [ -z "$ZIP_PATH" ]; then
  echo "  ✗  Electron binary not found."
  echo ""
  echo "  1. Open this URL in your browser and download the file:"
  echo ""
  echo "     $DOWNLOAD_URL"
  echo ""
  echo "  2. Save it to this folder OR your Downloads folder."
  echo ""
  echo "  3. Run this script again:"
  echo "     bash setup.sh"
  echo ""
  exit 1
fi

echo "  ✓  Found Electron zip: $ZIP_PATH"

# ── Extract ───────────────────────────────────────────────────────────────────
TMP=$(mktemp -d)
echo "  …  Extracting…"
unzip -q "$ZIP_PATH" -d "$TMP"

ELECTRON_APP=$(find "$TMP" -name "Electron.app" -maxdepth 3 | head -1)
if [ -z "$ELECTRON_APP" ]; then
  echo "  ✗  Could not find Electron.app inside the zip. Is it the right file?"
  rm -rf "$TMP"
  exit 1
fi

# ── Assemble the app bundle ───────────────────────────────────────────────────
APP_RES="$ELECTRON_APP/Contents/Resources"
mkdir -p "$APP_RES/app/calendar"
mkdir -p "$APP_RES/app/web"

echo "  ...  Copying app files..."
cp main.js preload.js updater.js "$APP_RES/app/"

# Minimal package.json — just enough for Electron to find main.js
cat > "$APP_RES/app/package.json" << 'EOF'
{ "name": "plan-manager", "version": "1.0.0", "main": "main.js" }
EOF

cp calendar/apple.js calendar/google.js "$APP_RES/app/calendar/"

# Sync the web files from the project root into web/ first. web/ is gitignored,
# so a fresh clone has none - always rebuild it from the root, which is the
# single source of truth for the UI.
mkdir -p web
for f in ../*.html ../*.jsx ../*.js ../*.css ../*.png ../*.jpg ../*.jpeg ../*.svg ../*.gif ../*.webp ../*.woff ../*.woff2 ../*.ttf; do
  [ -f "$f" ] && cp "$f" web/
done

cp web/* "$APP_RES/app/web/" 2>/dev/null || true
if [ ! -f "$APP_RES/app/web/Flow.html" ]; then
  echo "  x  No Flow.html found. Run this from mac-app/ inside the project."
  rm -rf "$TMP"
  exit 1
fi

# ── Set app name & icon ────────────────────────────────────────────────────────
APP_NAME="Plan Manager"
DEST_APP="./${APP_NAME}.app"

# Rename inside the bundle (what macOS shows in menus / About)
PLIST="$ELECTRON_APP/Contents/Info.plist"
if command -v /usr/libexec/PlistBuddy &>/dev/null; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleName '$APP_NAME'"         "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName '$APP_NAME'"  "$PLIST" 2>/dev/null || true
fi

cp -r "$ELECTRON_APP" "$DEST_APP"
rm -rf "$TMP"

# ---- Make macOS willing to run it -------------------------------------------
# Two separate problems, both fatal on Apple Silicon:
#  1. The zip came from a browser, so every file carries com.apple.quarantine.
#  2. We modified the bundle's contents, which invalidates Electron's original
#     code signature. macOS reports invalid signatures as "app is damaged".
# Stripping quarantine and re-signing ad-hoc (--sign -) fixes both.
echo "  ...  Clearing quarantine flag..."
xattr -cr "$DEST_APP" 2>/dev/null || true

echo "  ...  Re-signing (ad-hoc)..."
if codesign --force --deep --sign - "$DEST_APP" 2>/dev/null; then
  echo "  ok  Signed"
else
  echo "  !  Ad-hoc signing failed. If the app won't open, install the Xcode"
  echo "     command line tools and re-run:  xcode-select --install"
fi

echo ""
echo "  ok  ${APP_NAME}.app is ready in this folder."
echo ""
echo "  To open it:"
echo "     open '${DEST_APP}'"
echo ""
echo "  If macOS still says the app is damaged or blocked, run:"
echo "     xattr -cr '${DEST_APP}'"
echo "     codesign --force --deep --sign - '${DEST_APP}'"
echo ""
echo "  To install permanently, drag it to /Applications:"
echo "     mv '${DEST_APP}' /Applications/"
echo ""

read -p "  Launch now? [Y/n] " yn
yn=${yn:-Y}
if [[ "$yn" =~ ^[Yy] ]]; then
  open "$DEST_APP"
fi
