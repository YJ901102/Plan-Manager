// importmodal.jsx — import tasks from connected calendars.
// Pulls live events through CalendarSync (native / live Google / demo) with
// per-provider connect, loading, error + retry states. Attaches to window.
const { useState: useImpState, useEffect: useImpEffect } = React;

const MODE_NOTE = {
  native: 'Synced through the macOS app.',
  live: 'Live — your real Google Calendar.',
  demo: 'Demo — sample events, not a real account.',
};
const MODE_LABEL = { native: 'Native', live: 'Live', demo: 'Demo' };

function ImportModal({ onClose, onImport }) {
  const cal = useCalendarSync();
  const PROVIDERS = ['apple', 'google'];
  const [tab, setTab] = useImpState('apple');
  const [picked, setPicked] = useImpState({});
  // per-provider: { loading, error, events, connecting }
  const [data, setData] = useImpState({});
  const [sheet, setSheet] = useImpState(false);

  const src = IMPORT_SOURCES[tab];
  const st = cal.status(tab);
  const pd = data[tab] || {};

  const setPd = (provider, patch) =>
    setData((d) => ({ ...d, [provider]: { ...(d[provider] || {}), ...patch } }));

  const loadEvents = async (provider) => {
    setPd(provider, { loading: true, error: null });
    try {
      const events = await cal.listEvents(provider);
      setPd(provider, { loading: false, events, error: null });
      setPicked((p) => {
        const n = { ...p };
        events.forEach((e) => { if (!(e.id in n)) n[e.id] = true; });
        return n;
      });
    } catch (e) {
      setPd(provider, { loading: false, error: e.message || 'Could not load events.' });
    }
  };

  const connect = (provider) => setSheet(provider);
  const onConnected = (provider) => { setSheet(false); loadEvents(provider); };

  // Auto-load events for a connected provider the first time its tab is shown.
  useImpEffect(() => {
    const s = cal.status(tab);
    if (s.connected && !data[tab]) loadEvents(tab);
  }, [tab]);

  const toggle = (id) => setPicked((p) => ({ ...p, [id]: !p[id] }));

  // collect picked events across every connected+loaded provider
  const chosen = [];
  PROVIDERS.forEach((p) => {
    if (!cal.status(p).connected) return;
    (data[p] && data[p].events || []).forEach((e) => { if (picked[e.id]) chosen.push(e); });
  });
  const totalPicked = chosen.length;

  const fmtChipDate = (iso) => {
    const dt = new Date(iso + 'T00:00:00');
    if (isNaN(dt)) return iso;
    return `${WD[dt.getDay()]} ${MONTHS[dt.getMonth()].slice(0, 3)} ${dt.getDate()}`;
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2 className="modal-title">Import tasks</h2>
            <p className="modal-sub">Pull events from your calendars into a new group.</p>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            <Icon name="plus" size={20} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </div>

        <div className="src-tabs">
          {PROVIDERS.map((id) => {
            const s = cal.status(id);
            const evs = (data[id] && data[id].events) || [];
            const n = s.connected ? evs.filter((e) => picked[e.id]).length : 0;
            return (
              <button key={id} className={`src-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
                <Icon name={id === 'apple' ? 'apple' : 'google'} size={18} />
                <span className="src-tab-name">{IMPORT_SOURCES[id].name}</span>
                {n > 0 && <span className="src-tab-badge">{n}</span>}
              </button>
            );
          })}
        </div>

        <div className="modal-body">
          {!st.connected ? (
            <div className="connect-pane">
              <div className="connect-icon"><Icon name={tab === 'apple' ? 'apple' : 'google'} size={32} /></div>
              <p className="connect-text">Connect <b>{src.name}</b> to choose which events to import.</p>
              <button className="connect-btn" onClick={() => connect(tab)}>
                <Icon name={tab === 'apple' ? 'apple' : 'google'} size={16} /> Connect {src.name}
              </button>
              {pd.error
                ? <p className="connect-err"><Icon name="cloud" size={14} /> {pd.error}</p>
                : <p className="connect-note">{MODE_NOTE[st.mode]}</p>}
            </div>
          ) : (
            <>
              <div className="src-account">
                <span className="src-account-dot" /> Connected · {st.account}
                <span className={`mode-badge mode-${st.mode}`}>{MODE_LABEL[st.mode]}</span>
                <button className="src-refresh" onClick={() => loadEvents(tab)} disabled={pd.loading} title="Sync now">
                  <Icon name="refresh" size={14} />
                </button>
              </div>
              {pd.loading ? (
                <div className="import-state"><span className="spinner big" /> Syncing events…</div>
              ) : pd.error ? (
                <div className="import-state err">
                  <Icon name="cloud" size={20} />
                  <span>{pd.error}</span>
                  <button className="btn ghost" onClick={() => loadEvents(tab)}>Try again</button>
                </div>
              ) : (pd.events && pd.events.length) ? (
                <div className="event-list">
                  {pd.events.map((e) => (
                    <label key={e.id} className={`event-row ${picked[e.id] ? 'on' : ''}`}>
                      <span className={`ev-check ${picked[e.id] ? 'on' : ''}`} onClick={() => toggle(e.id)}>
                        {picked[e.id] && <Icon name="check" size={12} stroke={3} />}
                      </span>
                      <span className="ev-title">{e.title}</span>
                      <span className="ev-date">{fmtChipDate(e.date)}</span>
                      <span className="ev-time">{e.time}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="import-state">No upcoming events in this calendar.</div>
              )}
            </>
          )}
        </div>

        <div className="modal-foot">
          <span className="foot-count">{totalPicked} event{totalPicked === 1 ? '' : 's'} selected</span>
          <div className="foot-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={totalPicked === 0} onClick={() => onImport(chosen)}>
              <span>{totalPicked > 0 ? `Import ${totalPicked} ${totalPicked === 1 ? 'task' : 'tasks'}` : 'Import tasks'}</span>
              <Icon name="arrowRight" size={15} />
            </button>
          </div>
        </div>
      </div>
      {sheet && <ConnectSheet provider={sheet} onClose={() => setSheet(false)} onConnected={() => onConnected(sheet)} />}
    </div>
  );
}

Object.assign(window, { ImportModal });
