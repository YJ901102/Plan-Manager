repo: YJ901102/Plan-Manager
branch: main

## Last sync
date: 2026-08-17T08:33:30Z
commit: 9c3016846e7a

### Updated in this project
- First push complete — all 36 project files are now on `main` (previously the repo held only a README).
- Added GitHub-driven auto-update to the macOS app: it checks `main` on launch and offers "Update and Restart".
- Updates download into a writable overlay in the app's data folder, so signed builds and Gatekeeper are unaffected.
- `setup.sh` now rebuilds `mac-app/web/` from the project root, since `web/` is gitignored and absent from fresh clones.

## Screen map
| Screen / area | Built from |
|---|---|
| All screens (Board, Today, Calendar, Overview, Meeting) | Authored in this project — root `Flow.html` + `*.jsx`; not derived from repo files |
| macOS app shell | `mac-app/main.js`, `mac-app/preload.js`, `mac-app/updater.js` |
| Calendar bridges | `mac-app/calendar/apple.js`, `mac-app/calendar/google.js` |

Note: this project is the SOURCE of the repository, not a recreation of it. The
repo is the distribution channel the installed app pulls updates from. A sync
here means pushing project files up (`push-to-github.sh`), not importing down.
