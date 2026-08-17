// calendar/google.js — live Google Calendar via the desktop OAuth loopback
// flow with PKCE. Opens the system browser for consent, captures the code on a
// localhost redirect, exchanges it for a token, and calls the Calendar REST
// API. Tokens are kept in memory only (re-auth after relaunch).
//
// Setup: in Google Cloud Console create an OAuth client of type "Desktop app".
// Paste its Client ID (and Client secret) into Plan Manager → Settings.
const http = require('http');
const crypto = require('crypto');
const { shell } = require('electron');

let cache = null; // { access_token, expires, refresh_token, clientId }

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function authorize(clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    if (!clientId) return reject(new Error('Add your Google OAuth client ID in Settings (Desktop app type).'));
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const server = http.createServer();
    server.on('error', (e) => reject(new Error('Could not start the sign-in listener: ' + e.message)));
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirect = `http://127.0.0.1:${port}`;
      const params = new URLSearchParams({
        client_id: clientId, redirect_uri: redirect, response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        code_challenge: challenge, code_challenge_method: 'S256',
        access_type: 'offline', prompt: 'consent',
      });
      shell.openExternal('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
      const timer = setTimeout(() => { try { server.close(); } catch (e) {} reject(new Error('Google sign-in timed out.')); }, 180000);
      server.on('request', async (req, res) => {
        const u = new URL(req.url, redirect);
        const code = u.searchParams.get('code');
        const error = u.searchParams.get('error');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<!doctype html><meta charset="utf-8"><body style="font-family:-apple-system,sans-serif;padding:48px;text-align:center"><h2>Plan Manager is connected.</h2><p>You can close this tab and return to the app.</p><script>window.close()</script></body>');
        clearTimeout(timer);
        try { server.close(); } catch (e) {}
        if (error || !code) return reject(new Error('Google sign-in was cancelled.'));
        try {
          const body = new URLSearchParams({
            client_id: clientId, code, code_verifier: verifier,
            grant_type: 'authorization_code', redirect_uri: redirect,
          });
          if (clientSecret) body.set('client_secret', clientSecret);
          const r = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
          });
          const tok = await r.json();
          if (tok.error) return reject(new Error(tok.error_description || tok.error));
          cache = {
            access_token: tok.access_token,
            expires: Date.now() + (tok.expires_in || 3600) * 1000,
            refresh_token: tok.refresh_token, clientId,
          };
          resolve(cache);
        } catch (e) { reject(e); }
      });
    });
  });
}

async function token(opts) {
  const { clientId, clientSecret } = opts;
  if (cache && cache.clientId === clientId && cache.access_token && cache.expires > Date.now() + 5000) return cache.access_token;
  if (cache && cache.refresh_token && cache.clientId === clientId) {
    try {
      const body = new URLSearchParams({ client_id: clientId, refresh_token: cache.refresh_token, grant_type: 'refresh_token' });
      if (clientSecret) body.set('client_secret', clientSecret);
      const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      const tok = await r.json();
      if (tok.access_token) { cache.access_token = tok.access_token; cache.expires = Date.now() + (tok.expires_in || 3600) * 1000; return cache.access_token; }
    } catch (e) { /* fall through to re-auth */ }
  }
  const c = await authorize(clientId, clientSecret);
  return c.access_token;
}

async function connect(opts) {
  const at = await token(opts);
  try {
    const r = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', { headers: { Authorization: 'Bearer ' + at } });
    const j = await r.json();
    const primary = (j.items || []).find((c) => c.primary);
    return { account: (primary && primary.id) || 'Google Calendar' };
  } catch (e) { return { account: 'Google Calendar' }; }
}

async function listEvents(opts) {
  const at = await token(opts);
  const timeMin = new Date(); timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(timeMin); timeMax.setDate(timeMax.getDate() + 60);
  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
    + '?singleEvents=true&orderBy=startTime&maxResults=50'
    + '&timeMin=' + encodeURIComponent(timeMin.toISOString())
    + '&timeMax=' + encodeURIComponent(timeMax.toISOString());
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + at } });
  if (!r.ok) throw new Error('Google Calendar request failed (' + r.status + ').');
  const j = await r.json();
  return (j.items || []).map((ev) => {
    const s = ev.start || {};
    const allDay = !!s.date;
    const iso = (s.dateTime || s.date || '').slice(0, 10);
    let time = 'All day';
    if (!allDay && s.dateTime) {
      const d = new Date(s.dateTime); let h = d.getHours(); const m = d.getMinutes();
      const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
      time = h + ':' + ('0' + m).slice(-2) + ' ' + ap;
    }
    return { id: ev.id, title: ev.summary || '(untitled event)', date: iso, time };
  }).filter((e) => e.date);
}

module.exports = { connect, listEvents };
