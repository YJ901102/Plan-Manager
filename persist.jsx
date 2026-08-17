// persist.jsx — real local persistence for Flow.
// Saves the whole workspace to localStorage so every change survives a reload
// (and survives quitting the packaged Mac app). Attaches helpers to window.

const FLOW_KEY = 'flow.workspace.v1';
const FLOW_VERSION = 1;

// State slices owned by App() that we round-trip to disk.
const PERSIST_KEYS = ['workspaces', 'activeWsId', 'boards', 'activeId', 'view', 'spaceViews', 'prefs', 'sort', 'profile', 'holidays', 'statuses', 'owners', 'brand', 'shares'];

function loadWorkspace() {
  let raw;
  try { raw = localStorage.getItem(FLOW_KEY); } catch (e) { return null; }
  if (!raw) return null;
  let data;
  try { data = JSON.parse(raw); } catch (e) { return null; }
  if (!data || data.v !== FLOW_VERSION || !data.state) return null;

  // Re-seed the task id counter past the highest restored id so brand-new
  // tasks created this session can never collide with persisted ones.
  try {
    let max = 0;
    Object.values((data.state.boards) || {}).forEach((b) =>
      (b.groups || []).forEach((g) =>
        (g.items || []).forEach((it) => {
          const m = /^t(\d+)$/.exec(it.id || ''); if (m) max = Math.max(max, +m[1]);
          (it.subtasks || []).forEach((s) => {
            const mm = /^t(\d+)$/.exec(s.id || ''); if (mm) max = Math.max(max, +mm[1]);
          });
        })));
    if (window.__seedUid) window.__seedUid(max);
  } catch (e) { /* non-fatal */ }

  return { state: data.state, savedAt: data.savedAt || null };
}

let _saveTimer = null;
function saveWorkspace(state) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      const slim = {};
      PERSIST_KEYS.forEach((k) => { if (k in state) slim[k] = state[k]; });
      const payload = JSON.stringify({ v: FLOW_VERSION, savedAt: Date.now(), state: slim });
      try { localStorage.setItem(FLOW_KEY, payload); } catch (e) {}
      // Durable mirror to a real file in the Mac app's data folder. This is the
      // source of truth across quits — localStorage on a loopback origin is not
      // reliably flushed, so we never depend on it alone in the packaged app.
      if (window.FlowNative && window.FlowNative.store) {
        try { window.FlowNative.store.set(payload); } catch (e) {}
      }
      window.dispatchEvent(new CustomEvent('flow:saved', { detail: { savedAt: Date.now() } }));
    } catch (e) { /* quota / private mode — ignore */ }
  }, 250);
}

function clearWorkspace() {
  try { localStorage.removeItem(FLOW_KEY); } catch (e) {}
  if (window.FlowNative && window.FlowNative.store) {
    try { window.FlowNative.store.set(''); } catch (e) {}
  }
}

function hasSavedWorkspace() {
  try { return !!localStorage.getItem(FLOW_KEY); } catch (e) { return false; }
}

function workspaceSavedAt() {
  try {
    const raw = localStorage.getItem(FLOW_KEY);
    if (!raw) return null;
    return JSON.parse(raw).savedAt || null;
  } catch (e) { return null; }
}

// Export the entire workspace as a downloadable JSON file (handy before the
// native build exists, and as a manual backup after).
function exportWorkspace() {
  try {
    const raw = localStorage.getItem(FLOW_KEY) || JSON.stringify({ v: FLOW_VERSION, state: {} });
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {}
}

Object.assign(window, {
  loadWorkspace, saveWorkspace, clearWorkspace, hasSavedWorkspace,
  workspaceSavedAt, exportWorkspace, FLOW_KEY,
});
