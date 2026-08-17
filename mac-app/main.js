// main.js — Electron main process for Plan Manager.
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const apple = require('./calendar/apple');
const google = require('./calendar/google');
const updater = require('./updater');

// FIX: durable workspace store. We persist the workspace JSON to a real file
// in the app's userData folder so it survives quitting regardless of the
// loopback origin / Chromium localStorage flush timing.
const STORE_FILE = path.join(app.getPath('userData'), 'workspace.json');
function readStore() {
  try { return fs.readFileSync(STORE_FILE, 'utf8'); } catch (e) { return ''; }
}
function writeStore(data) {
  try {
    if (!data) { try { fs.unlinkSync(STORE_FILE); } catch (e) {} return true; }
    fs.writeFileSync(STORE_FILE, data, 'utf8');
    return true;
  } catch (e) { return false; }
}

// Two places web files can live, checked in this order:
//   1. OVERLAY_WEB — files pulled from GitHub by updater.js (writable)
//   2. BUNDLED_WEB — the copy shipped inside the .app (or the project root in dev)
const BUNDLED_WEB = fs.existsSync(path.join(__dirname, 'web', 'Flow.html'))
  ? path.join(__dirname, 'web')
  : path.join(__dirname, '..');
const OVERLAY_WEB = updater.OVERLAY;

function resolveWeb(rel) {
  const safe = path.normalize(rel).replace(/^([.][.][/\\])+/, '');
  for (const base of [OVERLAY_WEB, BUNDLED_WEB]) {
    const fp = path.join(base, safe);
    if (fp.startsWith(base) && fs.existsSync(fp) && fs.statSync(fp).isFile()) return fp;
  }
  return null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.jsx':  'text/babel; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

// FIX: Use a FIXED port so localStorage origin is stable across restarts.
// localStorage is keyed by origin (http://127.0.0.1:<port>) — a random port
// means a fresh empty storage every launch.
const PREFERRED_PORTS = [47381, 47382, 47383, 47390];

function startServer() {
  const handler = (req, res) => {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel === '/' || rel === '') rel = '/Flow.html';
    const fp = resolveWeb(rel);
    if (!fp) { res.writeHead(404); return res.end('not found'); }
    fs.readFile(fp, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store', // always serve fresh files during dev
      });
      res.end(buf);
    });
  };
  return new Promise((resolve) => {
    const tryPort = (i) => {
      if (i >= PREFERRED_PORTS.length) {
        // last resort: OS-assigned port (data won't persist across restarts but app runs)
        const s = http.createServer(handler);
        s.listen(0, '127.0.0.1', () => resolve(s.address().port));
        return;
      }
      const port = PREFERRED_PORTS[i];
      const s = http.createServer(handler);
      s.once('error', () => tryPort(i + 1));
      s.listen(port, '127.0.0.1', () => resolve(port));
    };
    tryPort(0);
  });
}

let win;
async function createWindow() {
  const port = await startServer();
  win = new BrowserWindow({
    width: 1320, height: 880,
    minWidth: 940, minHeight: 600,
    // FIX: hiddenInset puts real traffic lights inside the window.
    // We position them to sit inside our custom .titlebar strip (38px tall).
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 11 },
    backgroundColor: '#f5f6f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(`http://127.0.0.1:${port}/Flow.html`);
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Plan Manager',
      submenu: [
        { role: 'about' },
        { label: 'Check for Updates\u2026', click: () => updater.check({ silent: false, parent: win }) },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ] },
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' },
    ] },
    { role: 'windowMenu' },
  ]));
}

app.whenReady().then(() => {
  updater.reconcileOverlay();
  buildMenu();
  createWindow();
  // Check GitHub shortly after launch, once the window is up.
  setTimeout(() => updater.check({ silent: true, parent: win }), 2500);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ---- Calendar bridge ----
ipcMain.handle('calendar:connect',    async (_e, p, opts) => {
  if (p === 'apple')  return apple.connect();
  if (p === 'google') return google.connect(opts || {});
  throw new Error('Unknown provider: ' + p);
});
ipcMain.handle('calendar:listEvents', async (_e, p, opts) => {
  if (p === 'apple')  return apple.listEvents();
  if (p === 'google') return google.listEvents(opts || {});
  throw new Error('Unknown provider: ' + p);
});

// ---- Durable workspace store ----
// Sync read so preload can seed localStorage BEFORE the app's scripts run
// (keeps loadWorkspace() synchronous in the renderer).
ipcMain.on('store:read-sync', (e) => { e.returnValue = readStore(); });
ipcMain.handle('store:write', (_e, data) => writeStore(data));

// ---- Updates ----
ipcMain.handle('updates:check',  () => updater.check({ silent: false, parent: win }));
ipcMain.handle('updates:status', () => updater.status());
