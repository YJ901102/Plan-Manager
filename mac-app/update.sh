#!/bin/bash
# update.sh — push the latest app code into an already-installed Plan Manager.app.
# Run this after you (or Claude) change any file in the project root.
# No npm, no internet, no re-download of Electron.
set -e

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║         Plan Manager — update installed app      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Refresh mac-app/web/ from the project root ────────────────────────────
mkdir -p web
COPIED=0
for f in ../*.html ../*.jsx ../*.js ../*.css ../*.png ../*.jpg ../*.jpeg ../*.svg ../*.gif ../*.webp ../*.woff ../*.woff2 ../*.ttf; do
  [ -f "$f" ] || continue
  cp "$f" web/
  COPIED=$((COPIED+1))
done
echo "  ✓  Synced $COPIED web file(s) from the project root into mac-app/web/"

# ── 2. Find the installed app ─────────────────────────────────────────────────
APP=""
for loc in "/Applications/Plan Manager.app" "$HOME/Applications/Plan Manager.app" "./Plan Manager.app" "$HOME/Desktop/Plan Manager.app"; do
  if [ -d "$loc" ]; then APP="$loc"; break; fi
done

if [ -z "$APP" ]; then
  echo ""
  echo "  ✗  Couldn't find Plan Manager.app."
  echo "     Run 'bash setup.sh' first to build it, then run this script."
  echo ""
  exit 1
fi
echo "  ✓  Found app: $APP"

# ── 3. Copy the new files in ──────────────────────────────────────────────────
RES="$APP/Contents/Resources/app"
if [ ! -d "$RES" ]; then
  echo "  ✗  $APP doesn't look like a Plan Manager build (no Resources/app)."
  exit 1
fi

# Quit it if it's running, so the new code loads on next launch
if pgrep -f "Plan Manager.app" >/dev/null 2>&1; then
  echo "  …  Quitting the running app…"
  osascript -e 'quit app "Plan Manager"' 2>/dev/null || true
  sleep 1
fi

mkdir -p "$RES/web" "$RES/calendar"
cp web/* "$RES/web/" 2>/dev/null || true
cp main.js preload.js "$RES/"
cp calendar/apple.js calendar/google.js "$RES/calendar/"

# Clear the quarantine flag so macOS doesn't re-gate the modified bundle
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true

echo "  ✓  Update installed."
echo ""
echo "  Your tasks, settings and calendar connections are untouched —"
echo "  they live in the app's local storage, not in these files."
echo ""

read -p "  Relaunch now? [Y/n] " yn
yn=${yn:-Y}
if [[ "$yn" =~ ^[Yy] ]]; then
  open "$APP"
fi
