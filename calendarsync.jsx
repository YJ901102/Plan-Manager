// calendarsync.jsx — real calendar sync engine for Flow.
//
// Resolves the best available transport per provider, automatically:
//   • native — running inside the packaged Mac app, which injects
//              window.FlowNative.calendar (macOS EventKit + the system
//              Google account live here). This is wired up in step 2.
//   • live   — Google Calendar over OAuth (Google Identity Services) + the
//              Calendar REST API. Real data, runs in any browser served from
//              an authorized origin once a Google OAuth client ID is set.
//   • demo   — sandbox / unconfigured fallback using the bundled sample
//              events, so the prototype is always usable.
//
// Connection state (which providers, account, last sync, client id) persists
// to localStorage. The OAuth access token is kept in memory only.

const CAL_KEY = 'flow.calendar.v1';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

function _loadCal() {
  try { return JSON.parse(localStorage.getItem(CAL_KEY)) || {}; } catch (e) { return {}; }
}
function _delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
function _timeLabel(dt) {
  if (!dt) return 'All day';
  const d = new Date(dt);
  if (isNaN(d)) return 'All day';
  let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

const CalendarSync = {
  state: null,
  subs: new Set(),
  _token: null,        // { access_token, expires } — Google live, in-memory only
  _gisPromise: null,

  init() {
    if (this.state) return;
    const saved = _loadCal();
    const prov = saved.providers || {};
    this.state = {
      googleClientId: saved.googleClientId || '',
      googleClientSecret: saved.googleClientSecret || '',
      providers: {
        apple:  prov.apple  || { connected: false, account: null, lastSync: null },
        google: prov.google || { connected: false, account: null, lastSync: null },
      },
    };
  },

  _persist() {
    try {
      localStorage.setItem(CAL_KEY, JSON.stringify({
        googleClientId: this.state.googleClientId,
        googleClientSecret: this.state.googleClientSecret,
        providers: this.state.providers,
      }));
    } catch (e) {}
  },
  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
  _emit() { this.subs.forEach((f) => { try { f(); } catch (e) {} }); },

  nativeAvailable(provider) {
    const c = window.FlowNative && window.FlowNative.calendar;
    if (!c) return false;
    if (provider && c.supports) { try { return !!c.supports(provider); } catch (e) { return true; } }
    return true;
  },

  // Which transport a provider will use right now.
  mode(provider) {
    if (this.nativeAvailable(provider)) return 'native';
    if (provider === 'google' && this.state.googleClientId) return 'live';
    return 'demo';
  },
  status(provider) {
    const p = this.state.providers[provider] || { connected: false, account: null, lastSync: null };
    return { ...p, mode: this.mode(provider) };
  },
  setGoogleClientId(id) {
    this.state.googleClientId = (id || '').trim();
    this._persist(); this._emit();
  },
  setGoogleClientSecret(s) {
    this.state.googleClientSecret = (s || '').trim();
    this._persist(); this._emit();
  },
  _nativeOpts() {
    return { clientId: this.state.googleClientId, clientSecret: this.state.googleClientSecret };
  },

  async connect(provider, account) {
    const mode = this.mode(provider);
    let acct;
    if (mode === 'native') {
      const r = await window.FlowNative.calendar.connect(provider, this._nativeOpts());
      acct = (r && r.account) || 'System account';
    } else if (mode === 'live' && provider === 'google') {
      acct = await this._googleConnect();
    } else {
      await _delay(650); // simulate the round-trip in demo mode
      acct = account || (IMPORT_SOURCES[provider] && IMPORT_SOURCES[provider].account) || 'Demo account';
    }
    this.state.providers[provider] = { connected: true, account: acct, lastSync: null };
    this._persist(); this._emit();
    return acct;
  },
  disconnect(provider) {
    if (provider === 'google') this._token = null;
    this.state.providers[provider] = { connected: false, account: null, lastSync: null };
    this._persist(); this._emit();
  },

  async listEvents(provider) {
    const mode = this.mode(provider);
    let events;
    if (mode === 'native') {
      events = await window.FlowNative.calendar.listEvents(provider, this._nativeOpts());
    } else if (mode === 'live' && provider === 'google') {
      events = await this._googleEvents();
    } else {
      await _delay(500);
      events = (IMPORT_SOURCES[provider] && IMPORT_SOURCES[provider].events || []).map((e) => ({ ...e }));
    }
    const norm = (events || []).map((e) => ({
      id: e.id, title: e.title || '(untitled event)',
      date: e.date, time: e.time || 'All day', source: provider,
    })).filter((e) => e.date);
    if (this.state.providers[provider] && this.state.providers[provider].connected) {
      this.state.providers[provider].lastSync = Date.now();
      this._persist(); this._emit();
    }
    return norm;
  },

  // ---- Google live transport (Google Identity Services + Calendar API) ----
  _ensureGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    if (this._gisPromise) return this._gisPromise;
    this._gisPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = GIS_SRC; s.async = true; s.defer = true;
      s.onload = () => res();
      s.onerror = () => { this._gisPromise = null; rej(new Error('Could not load Google sign-in (offline or blocked).')); };
      document.head.appendChild(s);
    });
    return this._gisPromise;
  },
  async _googleToken() {
    if (this._token && this._token.expires > Date.now() + 5000) return this._token.access_token;
    const clientId = this.state.googleClientId;
    if (!clientId) throw new Error('Add your Google OAuth client ID in Settings first.');
    await this._ensureGis();
    const resp = await new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_SCOPE,
        callback: (r) => { if (r && r.access_token) resolve(r); else reject(new Error(r && r.error_description || 'Google authorization was cancelled.')); },
        error_callback: (err) => reject(new Error(err && err.message || 'Google authorization failed. Check the client ID and authorized origins.')),
      });
      client.requestAccessToken({ prompt: '' });
    });
    this._token = { access_token: resp.access_token, expires: Date.now() + (resp.expires_in || 3600) * 1000 };
    return this._token.access_token;
  },
  async _googleConnect() {
    const tok = await this._googleToken();
    try {
      const r = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: 'Bearer ' + tok },
      });
      const j = await r.json();
      const primary = (j.items || []).find((c) => c.primary);
      return (primary && primary.id) || 'Google Calendar';
    } catch (e) { return 'Google Calendar'; }
  },
  async _googleEvents() {
    const tok = await this._googleToken();
    const timeMin = new Date(); timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(timeMin); timeMax.setDate(timeMax.getDate() + 60);
    const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
      + '?singleEvents=true&orderBy=startTime&maxResults=50'
      + '&timeMin=' + encodeURIComponent(timeMin.toISOString())
      + '&timeMax=' + encodeURIComponent(timeMax.toISOString());
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } });
    if (!r.ok) throw new Error('Google Calendar request failed (' + r.status + ').');
    const j = await r.json();
    return (j.items || []).map((ev) => {
      const start = ev.start || {};
      const allDay = !!start.date;
      const iso = (start.dateTime || start.date || '').slice(0, 10);
      return { id: ev.id, title: ev.summary || '(untitled event)', date: iso, time: allDay ? 'All day' : _timeLabel(start.dateTime) };
    });
  },
};

CalendarSync.init();

function useCalendarSync() {
  const [, force] = React.useState(0);
  React.useEffect(() => CalendarSync.subscribe(() => force((n) => n + 1)), []);
  return CalendarSync;
}

Object.assign(window, { CalendarSync, useCalendarSync });
