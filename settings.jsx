// settings.jsx — profile, appearance, calendar connections, data, notifications.
// Connections are wired to the real CalendarSync engine. Attaches to window.
const { useState: useSetState } = React;

function Toggle({ on, onClick }) {
  return <button className={`sw ${on ? 'on' : ''}`} onClick={onClick} role="switch" aria-checked={on}><span className="sw-knob" /></button>;
}

const SET_MODE_LABEL = { native: 'Native', live: 'Live', demo: 'Demo' };
const SET_MODE_HINT = {
  apple: { native: 'Reads macOS Calendar directly.', live: '', demo: 'Sample events — connects live in the Mac app.' },
  google: { native: 'Uses the system Google account.', live: 'Real Google Calendar over OAuth.', demo: 'Sample events — add a client ID to go live.' },
};

function relTime(ts) {
  if (!ts) return null;
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 90) return 'a minute ago';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' hr ago';
  return Math.round(s / 86400) + ' d ago';
}

// Account sign-in sheet — picks/enters an iCloud or Google account, or runs
// real Google OAuth when a client ID is configured (live mode).
const CONNECT_META = {
  apple:  { name: 'iCloud Calendar', icon: 'apple',  kind: 'Apple ID',       accounts: ['you@icloud.com'] },
  google: { name: 'Google Calendar', icon: 'google', kind: 'Google Account', accounts: ['you@gmail.com'] },
};

function ConnectSheet({ provider, onClose, onConnected }) {
  const cal = useCalendarSync();
  const meta = CONNECT_META[provider];
  const mode = cal.mode(provider);
  const live = mode === 'live' && provider === 'google';
  const [adding, setAdding] = useSetState(false);
  const [email, setEmail] = useSetState('');
  const [busy, setBusy] = useSetState(false);
  const [err, setErr] = useSetState(null);

  const go = async (acct) => {
    setBusy(true); setErr(null);
    try {
      const account = await cal.connect(provider, live ? undefined : acct);
      onConnected && onConnected(account);
      onClose();
    } catch (e) { setErr(e.message || 'Could not connect.'); setBusy(false); }
  };

  return (
    <div className="modal-scrim" onClick={(e) => { if (busy) return; e.stopPropagation(); onClose(); }}>
      <div className="connect-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x cs-x" onClick={onClose} aria-label="Close"><Icon name="plus" size={18} style={{ transform: 'rotate(45deg)' }} /></button>
        <div className="cs-brand"><Icon name={meta.icon} size={30} /></div>
        <h2 className="cs-title">Sign in to {meta.name}</h2>
        <p className="cs-sub">{live ? 'Authorize Flow to read your Google Calendar.' : `Choose the ${meta.kind} to connect.`}</p>

        {live ? (
          <button className="cs-google" disabled={busy} onClick={() => go()}>
            {busy ? <span className="spinner dark" /> : <Icon name="google" size={18} />} Continue with Google
          </button>
        ) : (
          <div className="cs-accounts">
            {meta.accounts.map((a) => (
              <button key={a} className="cs-account" disabled={busy} onClick={() => go(a)}>
                <span className="cs-avatar" style={{ background: provider === 'apple' ? '#1f2330' : '#5b5bd6' }}>{a[0].toUpperCase()}</span>
                <span className="cs-acc-text"><b>{a.split('@')[0]}</b><i>{a}</i></span>
                {busy ? <span className="spinner big" /> : <Icon name="chevron" size={15} />}
              </button>
            ))}
            {adding ? (
              <div className="cs-add">
                <input autoFocus type="email" value={email} placeholder={`name@${provider === 'apple' ? 'icloud.com' : 'gmail.com'}`}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && email.trim()) go(email.trim()); }} />
                <button className="cs-continue" disabled={busy || !email.trim()} onClick={() => go(email.trim())}>{busy ? 'Connecting…' : 'Continue'}</button>
              </div>
            ) : (
              <button className="cs-other" onClick={() => setAdding(true)}>Use another account…</button>
            )}
          </div>
        )}

        {err && <p className="cs-err"><Icon name="cloud" size={14} /> {err}</p>}
        <p className="cs-note"><Icon name="lock" size={12} /> {live ? 'Read-only access · tokens stay on this Mac.' : mode === 'native' ? 'Connects through macOS.' : 'Demo connection — no real account is accessed.'}</p>
      </div>
    </div>
  );
}

function ConnectionRow({ cal, provider, onToast }) {
  const meta = { apple: { name: 'macOS Calendar', icon: 'apple' }, google: { name: 'Google Calendar', icon: 'google' } }[provider];
  const st = cal.status(provider);
  const [busy, setBusy] = useSetState(false);
  const [err, setErr] = useSetState(null);
  const [sheet, setSheet] = useSetState(false);

  const doSync = async () => {
    setBusy(true); setErr(null);
    try { const evs = await cal.listEvents(provider); onToast && onToast(`Synced ${evs.length} event${evs.length === 1 ? '' : 's'} from ${meta.name}`); }
    catch (e) { setErr(e.message || 'Sync failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="set-row set-conn-row">
      <div className="set-conn">
        <span className="set-conn-icon"><Icon name={meta.icon} size={20} /></span>
        <div className="set-row-text">
          <b>{meta.name} <span className={`mode-badge mode-${st.mode}`}>{SET_MODE_LABEL[st.mode]}</span></b>
          <span>
            {st.connected
              ? <>Connected · {st.account}{st.lastSync ? ` · synced ${relTime(st.lastSync)}` : ''}</>
              : (SET_MODE_HINT[provider][st.mode] || 'Not connected')}
          </span>
          {err && <span className="set-conn-err">{err}</span>}
        </div>
      </div>
      <div className="set-conn-actions">
        {st.connected && (
          <button className="set-conn-icon-btn" onClick={doSync} disabled={busy} title="Sync now">
            <Icon name="refresh" size={16} />
          </button>
        )}
        <button className={`set-conn-btn ${st.connected ? 'on' : ''}`} disabled={busy}
          onClick={() => { if (st.connected) { cal.disconnect(provider); onToast && onToast(`Disconnected ${meta.name}`); } else setSheet(true); }}>
          {busy ? 'Working…' : st.connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
      {sheet && <ConnectSheet provider={provider} onClose={() => setSheet(false)}
        onConnected={(acct) => onToast && onToast(`Connected ${meta.name} · ${acct}`)} />}
    </div>
  );
}

function SettingsView({ profile, setProfile, accentKey, sidebar, density, setTweak, accents, prefs, setPrefs, onReset, onToast }) {
  const cal = useCalendarSync();
  const [notif, setNotif] = useSetState({ due: true, daily: true, mentions: false, weekly: false });
  const [clientId, setClientId] = useSetState(cal.state.googleClientId || '');
  const [clientSecret, setClientSecret] = useSetState(cal.state.googleClientSecret || '');
  const [savedAt, setSavedAt] = useSetState(workspaceSavedAt());
  const native = cal.nativeAvailable && cal.nativeAvailable('google');
  const holidayRegions = prefs.holidayRegions || { DE: true, CN: true };
  const toggleRegion = (k) => setPrefs((p) => {
    const cur = p.holidayRegions || { DE: true, CN: true };
    return { ...p, holidayRegions: { ...cur, [k]: !(cur[k] !== false) } };
  });

  React.useEffect(() => {
    const h = (e) => setSavedAt((e.detail && e.detail.savedAt) || Date.now());
    window.addEventListener('flow:saved', h);
    return () => window.removeEventListener('flow:saved', h);
  }, []);

  const NOTIFS = [
    { id: 'due', label: 'Due-date reminders', sub: 'Ping me when a task is due today' },
    { id: 'daily', label: 'Daily summary', sub: 'A morning digest of what\u2019s on deck' },
    { id: 'mentions', label: 'Mentions', sub: 'When someone assigns me a task' },
    { id: 'weekly', label: 'Weekly review', sub: 'Sunday recap of the week ahead' },
  ];

  return (
    <div className="settings">
      <div className="settings-inner">
        {/* Profile */}
        <section className="set-section">
          <div className="set-sec-head"><Icon name="user" size={17} /><h3>Profile</h3></div>
          <div className="set-card">
            <div className="set-profile">
              <Avatar ownerId="you" size={52} />
              <div className="set-profile-fields">
                <label className="set-input-wrap"><span>Name</span>
                  <input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} /></label>
                <label className="set-input-wrap"><span>Email</span>
                  <input value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} /></label>
              </div>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="set-section">
          <div className="set-sec-head"><Icon name="settings" size={17} /><h3>Appearance</h3></div>
          <div className="set-card">
            <div className="set-row">
              <div className="set-row-text"><b>Accent color</b><span>Used across highlights and buttons</span></div>
              <div className="set-swatches">
                {Object.keys(accents).map((k) => (
                  <button key={k} className={`set-swatch ${accentKey === k ? 'on' : ''}`} style={{ background: accents[k].accent }}
                    onClick={() => setTweak('accent', k)} aria-label={accents[k].name}>
                    {accentKey === k && <Icon name="check" size={14} stroke={3} />}
                  </button>
                ))}
              </div>
            </div>
            <div className="set-row">
              <div className="set-row-text"><b>Sidebar</b><span>Light or dark navigation</span></div>
              <div className="set-seg">
                {['light', 'dark'].map((v) => (
                  <button key={v} className={sidebar === v ? 'on' : ''} onClick={() => setTweak('sidebar', v)}>{v[0].toUpperCase() + v.slice(1)}</button>
                ))}
              </div>
            </div>
            <div className="set-row">
              <div className="set-row-text"><b>Density</b><span>Row height in tables</span></div>
              <div className="set-seg">
                {['comfortable', 'compact'].map((v) => (
                  <button key={v} className={density === v ? 'on' : ''} onClick={() => setTweak('density', v)}>{v[0].toUpperCase() + v.slice(1)}</button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Calendar holidays */}
        <section className="set-section">
          <div className="set-sec-head"><Icon name="flag" size={17} /><h3>Calendar holidays</h3></div>
          <div className="set-card">
            {Object.values(HOLIDAY_COUNTRIES).map((c) => (
              <div key={c.id} className="set-row">
                <div className="set-conn">
                  <span className="set-conn-icon" style={{ color: c.color }}><Icon name="flag" size={18} /></span>
                  <div className="set-row-text"><b>{c.label} holidays</b><span>Show {c.label} public holidays on the calendar</span></div>
                </div>
                <Toggle on={holidayRegions[c.id] !== false} onClick={() => toggleRegion(c.id)} />
              </div>
            ))}
          </div>
          <p className="set-conn-foot"><Icon name="calendar" size={13} /> Holidays appear on the calendar only — never in your task table — and stay fully editable.</p>
        </section>

        {/* Calendar connections */}
        <section className="set-section">
          <div className="set-sec-head"><Icon name="calendar" size={17} /><h3>Calendar connections</h3></div>
          <div className="set-card">
            <ConnectionRow cal={cal} provider="apple" onToast={onToast} />
            <ConnectionRow cal={cal} provider="google" onToast={onToast} />
            <div className="set-row set-google-cfg">
              <div className="set-row-text">
                <b>Google OAuth client</b>
                <span>{native
                  ? 'Create an OAuth client of type “Desktop app” in Google Cloud Console and paste its ID (and secret) here to enable live Google sync.'
                  : 'Required for live Google sync in the browser build. Create an OAuth client (type “Web”) and add this page’s origin to authorized origins.'}</span>
              </div>
              <div className="set-clientid">
                <input value={clientId} placeholder="xxxx.apps.googleusercontent.com"
                  onChange={(e) => setClientId(e.target.value)}
                  onBlur={() => { cal.setGoogleClientId(clientId); }} />
                {native && (
                  <input value={clientSecret} placeholder="client secret (optional)" type="password"
                    onChange={(e) => setClientSecret(e.target.value)}
                    onBlur={() => { cal.setGoogleClientSecret(clientSecret); }} />
                )}
                <button className="set-conn-btn" onClick={() => { cal.setGoogleClientId(clientId); if (native) cal.setGoogleClientSecret(clientSecret); onToast && onToast(clientId.trim() ? 'Google client saved' : 'Google client cleared'); }}>Save</button>
              </div>
            </div>
          </div>
          <p className="set-conn-foot"><Icon name="lock" size={13} /> {native
            ? 'macOS Calendar reads on-device; Google tokens stay in this app on your Mac.'
            : 'macOS Calendar reads on-device; tokens never leave this Mac.'}</p>
        </section>

        {/* Your data */}
        <section className="set-section">
          <div className="set-sec-head"><Icon name="cloudCheck" size={17} /><h3>Your data</h3></div>
          <div className="set-card">
            <div className="set-row">
              <div className="set-row-text">
                <b>Saved on this Mac</b>
                <span>{savedAt ? `Every change is stored locally · last saved ${relTime(savedAt)}` : 'Changes are stored locally as you work.'}</span>
              </div>
              <button className="set-conn-btn" onClick={exportWorkspace}>Export backup</button>
            </div>
            <div className="set-row">
              <div className="set-row-text">
                <b>Reset to demo data</b>
                <span>Clears your saved workspace and restores the original sample spaces. Can’t be undone.</span>
              </div>
              <button className="set-conn-btn danger" onClick={() => { if (confirm('Reset everything to the demo data? This clears your saved workspace.')) onReset(); }}>Reset</button>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="set-section">
          <div className="set-sec-head"><Icon name="bell" size={17} /><h3>Notifications</h3></div>
          <div className="set-card">
            {NOTIFS.map((n) => (
              <div key={n.id} className="set-row">
                <div className="set-row-text"><b>{n.label}</b><span>{n.sub}</span></div>
                <Toggle on={notif[n.id]} onClick={() => setNotif((p) => ({ ...p, [n.id]: !p[n.id] }))} />
              </div>
            ))}
          </div>
        </section>

        <div className="set-about">Flow · your workspace is saved on this device.</div>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsView, ConnectSheet });
