# Plan Manager — local macOS app

A native desktop build of Plan Manager that runs on your Mac and syncs with your **real** macOS Calendar and Google Calendar.

It wraps the existing web app (in the project root) with Electron and injects a native bridge, so the in-app sync engine automatically switches each calendar from **Demo** to **Native**:

- **macOS Calendar** — reads your on-device Calendar via the system (JXA/AppleScript). No browser can do this; the native app can. Reads stay on your Mac.
- **Google Calendar** — live sync via the standard desktop OAuth loopback flow (PKCE). Tokens are held in memory only.

Everything you do is already saved locally (Settings → Your data), so it persists across quits.

## Requirements
- macOS
- Node.js 18+ **only** for the `npm` routes below. The `setup.sh` / `update.sh` route needs neither Node nor npm.

## Build the app (no npm needed)
```bash
cd mac-app
bash setup.sh
```
It tells you which one Electron zip to download, then assembles **Plan Manager.app** in this folder. Drag it to `/Applications`.

## Adding a new feature later (via GitHub)

The app tracks **[YJ901102/Plan-Manager](https://github.com/YJ901102/Plan-Manager)** on `main`. On every launch it asks GitHub for the latest commit; if there's something new it offers **Update and Restart**. There's also **Plan Manager → Check for Updates…** in the menu bar.

The loop:

1. **Ask me for the feature** here ("add a Kanban swimlane view"). I edit the root files.
2. **Push it up** — from the project root:
   ```bash
   bash push-to-github.sh
   ```
   (First run also wires up the remote. After that it's just commit + push.)
3. **Open the app.** It notices the new commit and offers to update itself. Done — no rebuild, no reinstall.

### What auto-updates, and what doesn't

| Changes to… | How it reaches you |
|---|---|
| Root web files — `Flow.html`, `*.jsx`, `support.js` (the whole UI and all features) | **Automatic** on next launch |
| The Electron shell — `mac-app/main.js`, `preload.js`, `updater.js`, `calendar/*` | Needs `bash setup.sh` again (rare) |

Downloaded updates go into a writable folder in the app's data directory, and the app serves those first, falling back to the copy inside the bundle. That's why updating never touches — or needs permission to touch — the `.app` itself.

**Your data is safe across updates.** Tasks, columns, people, and calendar connections live in the app's own store, separate from the code.

### Offline / manual alternative
If you'd rather not go through GitHub, edit the root files locally and run `bash update.sh` in `mac-app/` — it pushes them straight into the installed app.

## Run it (development)
```bash
cd mac-app
npm install
npm start
```
This opens Plan Manager in a native window, loading the web files from the project root.

- **macOS Calendar:** Settings → Calendar connections → **Connect** on macOS Calendar. macOS shows a Calendar permission prompt the first time — click **Allow**. (If you miss it: System Settings → Privacy & Security → Calendars → enable Plan Manager.)
- **Google Calendar:** create an OAuth client (below), paste the Client ID/secret into Settings, then **Connect**. Your browser opens for consent and returns you to the app.

## Google setup (one time)
1. Go to the [Google Cloud Console](https://console.cloud.google.com) → APIs & Services.
2. Enable the **Google Calendar API**.
3. **Credentials → Create credentials → OAuth client ID → Application type: Desktop app.**
4. Copy the **Client ID** (and **Client secret**) into Plan Manager → **Settings → Google OAuth client ID / secret → Save**.
5. Add your Google account as a **Test user** on the OAuth consent screen (while the app is in "Testing").

## Build a distributable .app / .dmg
```bash
cd mac-app
npm run dist
```
This copies the web assets into `mac-app/web/` and runs electron-builder. Output lands in `mac-app/dist/` (a `.dmg` and `.zip`).

For Gatekeeper-clean distribution you'll want to sign & notarize with an Apple Developer ID (set `CSC_LINK`/`CSC_KEY_PASSWORD` and notarization env vars for electron-builder). Unsigned builds run locally fine — on first launch, right-click the app → **Open**.

## How it fits together
```
mac-app/
  main.js            Electron main: loopback static server + window + IPC
  preload.js         Exposes window.FlowNative to the web app
  updater.js         Checks GitHub on launch, downloads updates into userData
  calendar/apple.js  macOS Calendar reader (osascript / JXA)
  calendar/google.js Google Calendar (desktop OAuth loopback + PKCE + REST)
  copy-web.js        Bundles ../*.{html,jsx,js,...} into web/ for packaging
  setup.sh           Assembles Plan Manager.app without npm
  update.sh          Pushes local file changes into the installed app
  build/             entitlements (Calendar + network access)
```
The web app detects `window.FlowNative` and routes calendar connect/list calls through these adapters. Without it (a plain browser) it falls back to Demo data — so the same files work in both places.

## Notes
- Requires internet for the React/Babel runtime (loaded from a CDN). To run fully offline, vendor those libraries locally and pre-transpile the JSX.
- Your workspace and calendar connection settings are stored in the app's local storage and survive quitting.
