// preload.js — bridges native APIs into the web app.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('FlowNative', {
  platform: process.platform,
  version: '1.0.0',
  calendar: {
    supports:   (p) => p === 'apple' || p === 'google',
    connect:    (p, opts) => ipcRenderer.invoke('calendar:connect',    p, opts),
    listEvents: (p, opts) => ipcRenderer.invoke('calendar:listEvents', p, opts),
  },
  store: {
    set: (data) => ipcRenderer.invoke('store:write', data),
  },
  updates: {
    check:  () => ipcRenderer.invoke('updates:check'),
    status: () => ipcRenderer.invoke('updates:status'),
  },
});

// FIX (persistence): seed localStorage from the durable file BEFORE the app's
// scripts run, so loadWorkspace() finds the saved workspace on every launch.
// preload shares the page's localStorage but runs before page scripts.
try {
  const FLOW_KEY = 'flow.workspace.v1';
  const saved = ipcRenderer.sendSync('store:read-sync');
  if (saved && typeof saved === 'string') {
    window.localStorage.setItem(FLOW_KEY, saved);
  }
} catch (e) { /* non-fatal — falls back to whatever localStorage has */ }

// FIX: Inject Electron-specific CSS once the DOM is ready.
//  • .titlebar  → real macOS drag region (move the window by dragging it)
//  • .traffic   → hide the decorative CSS dots; real traffic lights are
//                 rendered by macOS at trafficLightPosition from main.js
//  • *          → all children are no-drag so buttons/links stay clickable
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.id = 'electron-native';
  style.textContent = `
    /* Window drag handle — the custom title bar strip */
    .titlebar {
      -webkit-app-region: drag;
    }
    /* Interactive elements must opt out of dragging */
    .titlebar * {
      -webkit-app-region: no-drag;
    }
    /* Hide the decorative CSS traffic-light circles;
       the real macOS ones are painted by Electron on top */
    .traffic {
      visibility: hidden;
    }
  `;
  document.head.appendChild(style);
});
