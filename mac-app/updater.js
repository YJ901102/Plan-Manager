// updater.js — GitHub-driven self-update for Plan Manager.
//
// How it works: on launch (and from the menu) we ask GitHub for the latest
// commit on the tracked branch. If it differs from the commit we last
// installed, we download the changed root-level web files and write them into
// a WRITABLE overlay folder in userData — never into the .app bundle, so this
// keeps working on signed/notarized builds and survives macOS Gatekeeper.
// main.js serves the overlay first and falls back to the bundled copy.
const https = require('https');
const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');

const REPO = 'YJ901102/Plan-Manager';
const BRANCH = 'main';

// Only root-level web assets — same set copy-web.js bundles. Anything inside
// mac-app/ (the shell itself) is deliberately NOT hot-updated: changing
// Electron main-process code needs a real reinstall.
const ASSET_RE = /\.(html|jsx|js|css|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|json)$/i;
const SKIP = new Set(['package.json', 'package-lock.json', 'github.md']);

const OVERLAY = path.join(app.getPath('userData'), 'web-update');
const STATE_FILE = path.join(app.getPath('userData'), 'update-state.json');

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) { return {}; }
}
function writeState(s) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8'); } catch (e) {}
}

// A freshly installed .app may be NEWER than a stale overlay from an older
// version. If the bundle version changed, drop the overlay and start clean.
function reconcileOverlay() {
  const st = readState();
  if (st.appVersion && st.appVersion !== app.getVersion()) {
    try { fs.rmSync(OVERLAY, { recursive: true, force: true }); } catch (e) {}
    writeState({ appVersion: app.getVersion() });
  } else if (!st.appVersion) {
    writeState({ ...st, appVersion: app.getVersion() });
  }
}

function get(url, { json = false } = {}, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('Too many redirects'));
    const req = https.get(url, {
      headers: {
        // GitHub's API rejects requests without a User-Agent.
        'User-Agent': 'PlanManager-Updater',
        'Accept': json ? 'application/vnd.github+json' : '*/*',
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return get(res.headers.location, { json }, depth + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (!json) return resolve(buf);
        try { resolve(JSON.parse(buf.toString('utf8'))); }
        catch (e) { reject(new Error('Bad JSON from ' + url)); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
  });
}

// Returns { commit, message, date, files: [paths] } or null when up to date.
async function fetchLatest() {
  const head = await get(
    `https://api.github.com/repos/${REPO}/commits/${BRANCH}`, { json: true });
  const commit = head.sha;
  const installed = readState().commit;
  if (installed && installed === commit) return null;

  const tree = await get(
    `https://api.github.com/repos/${REPO}/git/trees/${commit}?recursive=1`, { json: true });
  const files = (tree.tree || [])
    .filter((n) => n.type === 'blob')
    .map((n) => n.path)
    .filter((p) => !p.includes('/') && ASSET_RE.test(p) && !SKIP.has(p.toLowerCase()));

  if (!files.length) return null;
  return {
    commit,
    message: (head.commit && head.commit.message || '').split('\n')[0],
    date: head.commit && head.commit.author && head.commit.author.date,
    files,
  };
}

async function download(update) {
  fs.mkdirSync(OVERLAY, { recursive: true });
  // Stage into a temp dir first so a failed download can't leave the app
  // running a half-updated mix of old and new files.
  const stage = OVERLAY + '.staging';
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });

  for (const f of update.files) {
    const buf = await get(
      `https://raw.githubusercontent.com/${REPO}/${update.commit}/${encodeURIComponent(f)}`);
    fs.writeFileSync(path.join(stage, f), buf);
  }
  // Swap staging into place.
  for (const f of fs.readdirSync(stage)) {
    fs.copyFileSync(path.join(stage, f), path.join(OVERLAY, f));
  }
  fs.rmSync(stage, { recursive: true, force: true });
  writeState({ commit: update.commit, appVersion: app.getVersion(), installedAt: new Date().toISOString() });
}

// silent: skip the "you're up to date" / error dialogs (used on launch).
async function check({ silent = true, parent = null } = {}) {
  try {
    const update = await fetchLatest();
    if (!update) {
      if (!silent) {
        await dialog.showMessageBox(parent, {
          type: 'info', message: 'Plan Manager is up to date.',
          detail: `Tracking ${REPO} (${BRANCH}).`, buttons: ['OK'],
        });
      }
      return { updated: false, upToDate: true };
    }

    const { response } = await dialog.showMessageBox(parent, {
      type: 'question',
      message: 'An update is available',
      detail: [
        update.message ? `Latest change: ${update.message}` : null,
        `${update.files.length} file(s) will be updated.`,
        '',
        'Your tasks, people and calendar connections are not affected.',
      ].filter(Boolean).join('\n'),
      buttons: ['Update and Restart', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response !== 0) return { updated: false, deferred: true };

    await download(update);
    app.relaunch();
    app.exit(0);
    return { updated: true };
  } catch (e) {
    if (!silent) {
      await dialog.showMessageBox(parent, {
        type: 'error', message: 'Could not check for updates',
        detail: String(e.message || e), buttons: ['OK'],
      });
    }
    return { updated: false, error: String(e.message || e) };
  }
}

function status() {
  const st = readState();
  return {
    repo: REPO, branch: BRANCH,
    commit: st.commit || null,
    installedAt: st.installedAt || null,
    usingOverlay: fs.existsSync(path.join(OVERLAY, 'Flow.html')),
  };
}

module.exports = { check, status, reconcileOverlay, OVERLAY, REPO, BRANCH };
