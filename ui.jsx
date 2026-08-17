// ui.jsx — shared primitives: icons, avatars, pills, date utils. Attaches to window.

// ---- Icons (simple stroked, 20px default) ----
const Icon = ({ name, size = 18, stroke = 2, style }) => {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round',
    strokeLinejoin: 'round', style,
  };
  const paths = {
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
    leaf: <><path d="M5 19c0-7 5-12 14-12 0 9-5 14-12 14a8 8 0 0 1-2-2z" /><path d="M9 15c2-2 4-3 6-4" /></>,
    pen: <><path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" /><path d="M14 6l3 3" /></>,
    table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
    inbox: <><path d="M3 12h5l2 3h4l2-3h5" /><path d="M5 5h14l2 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    chevron: <><path d="M9 6l6 6-6 6" /></>,
    chevronDown: <><path d="M6 9l6 6 6-6" /></>,
    dots: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2l-.3-2.5H10.7l-.3 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.3 2.5h2.6l.3-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12z" /></>,
    check: <><path d="M5 12l5 5L20 6" /></>,
    apple: <><path d="M16 12c0-2 1.5-3 1.6-3-1-1.4-2.4-1.5-2.9-1.5-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7C7.8 7.5 6.4 8.4 5.7 9.8c-1.5 2.6-.4 6.4 1 8.5.7 1 1.5 2.2 2.6 2.1 1-.04 1.4-.7 2.7-.7 1.3 0 1.6.7 2.7.6 1.1-.02 1.8-1 2.5-2a9 9 0 0 0 1.1-2.4c-.03-.01-2.3-.9-2.3-3.5z" /><path d="M14 5.5c.6-.7 1-1.7.9-2.7-.9.04-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .08 2-.5 2.5-1.2z" /></>,
    google: <><path d="M21 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.1 2.7-7.1z" /><path d="M12 21c2.6 0 4.7-.9 6.3-2.3l-3.1-2.4c-.9.6-2 .9-3.2.9-2.5 0-4.6-1.7-5.3-3.9H3.5v2.5A9 9 0 0 0 12 21z" /><path d="M6.7 13.3a5.4 5.4 0 0 1 0-3.4V7.4H3.5a9 9 0 0 0 0 8.1z" /><path d="M12 6.6c1.4 0 2.6.5 3.6 1.4l2.7-2.7A9 9 0 0 0 3.5 7.4l3.2 2.5C7.4 8.3 9.5 6.6 12 6.6z" /></>,
    arrowRight: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    trash: <><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></>,
    flag: <><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
    subtask: <><path d="M6 4v8a3 3 0 0 0 3 3h9" /><path d="M14 11l4 4-4 4" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></>,
    tag: <><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.4" /></>,
    chat: <><path d="M21 12a8 8 0 0 1-11.3 7.3L4 21l1.7-5.7A8 8 0 1 1 21 12z" /></>,
    text: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
    grip: <><circle cx="9" cy="6" r="1.3" /><circle cx="15" cy="6" r="1.3" /><circle cx="9" cy="12" r="1.3" /><circle cx="15" cy="12" r="1.3" /><circle cx="9" cy="18" r="1.3" /><circle cx="15" cy="18" r="1.3" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    expand: <><path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 1 1-1v-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
    sort: <><path d="M4 6h16M6 12h12M9 18h6" /></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></>,
    cloud: <><path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.6 1.5A3.5 3.5 0 0 1 17.5 18z" /></>,
    cloudCheck: <><path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.6 1.5A3.5 3.5 0 0 1 17.5 18H14" /><path d="M8.5 16.5L10 18l3-3" /></>,
    link: <><path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 1 0-5.6-5.6L11 7" /><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 1 0 5.6 5.6L13 17" /></>,
    unlink: <><path d="M9 15l-1.5 1.5a4 4 0 0 1-5.6-5.6L4 9M15 9l1.5-1.5a4 4 0 0 1 5.6 5.6L20 15" /><path d="M3 3l18 18" /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    pin: <><path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
    video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></>,
    paperclip: <><path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 6" /></>,
    car: <><path d="M5 16l1.5-5A2 2 0 0 1 8.4 9.6h7.2a2 2 0 0 1 1.9 1.4L19 16" /><path d="M4 16h16v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><circle cx="7.5" cy="16.5" r="1" /><circle cx="16.5" cy="16.5" r="1" /></>,
    share: <><circle cx="6" cy="12" r="2.4" /><circle cx="17.5" cy="6" r="2.4" /><circle cx="17.5" cy="18" r="2.4" /><path d="M8.1 10.9l7.3-3.8M8.1 13.1l7.3 3.8" /></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3M8 21h8" /></>,
    sparkles: <><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" /><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" /></>,
    wave: <><path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4M21 12h-2" /></>,
    pause: <><rect x="7" y="5" width="3.5" height="14" rx="1" /><rect x="13.5" y="5" width="3.5" height="14" rx="1" /></>,
    stop: <><rect x="6" y="6" width="12" height="12" rx="2.5" /></>,
  };
  return <svg {...p}>{paths[name] || null}</svg>;
};

// ---- Avatar ----
const Avatar = ({ ownerId, size = 26 }) => {
  const o = OWNERS[ownerId];
  if (!o) return (
    <div style={{
      width: size, height: size, borderRadius: '50%', border: '1.5px dashed var(--border-strong)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)',
      fontSize: size * 0.5,
    }}>+</div>
  );
  return (
    <div title={o.name} style={{
      width: size, height: size, borderRadius: '50%', background: o.color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 600, letterSpacing: '.02em', flex: '0 0 auto',
      boxShadow: '0 1px 2px rgba(0,0,0,.12)',
    }}>{o.initials}</div>
  );
};

// ---- Status pill (click to cycle) ----
const StatusPill = ({ status, onCycle }) => {
  const s = STATUS[status];
  return (
    <button className="status-pill" onClick={onCycle} style={{ background: s.color }}>
      {s.label}
    </button>
  );
};

// ---- Matrix cell (Eisenhower quadrant) ----
const MatrixTag = ({ priority, onCycle }) => {
  const q = MATRIX[priority] || MATRIX.dismiss;
  return (
    <button className="prio-tag" onClick={onCycle} style={{ color: q.color }} title={q.short}>
      <span className="prio-dot" style={{ background: q.color }} />
      {q.label}
    </button>
  );
};

// ---- date utils ----
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtDue(iso) {
  if (!iso) return null;
  const dt = new Date(iso + 'T00:00:00');
  const today = new Date(TODAY); today.setHours(0,0,0,0);
  const diff = Math.round((dt - today) / 86400000);
  const base = `${MONTHS[dt.getMonth()].slice(0,3)} ${dt.getDate()}`;
  let rel = null, tone = 'normal';
  if (diff === 0) { rel = 'Today'; tone = 'today'; }
  else if (diff === 1) rel = 'Tomorrow';
  else if (diff === -1) { rel = 'Yesterday'; tone = 'past'; }
  else if (diff < 0) tone = 'past';
  return { base, rel, tone, diff };
}

function isoToday() {
  const t = new Date(TODAY);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

// ---- recurrence ----
// step the n-th occurrence from a start ISO date for a given cadence
function addToDate(iso, unit, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (unit === 'daily') dt.setDate(dt.getDate() + n);
  else if (unit === 'weekly') dt.setDate(dt.getDate() + 7 * n);
  else if (unit === 'monthly') dt.setMonth(dt.getMonth() + n);
  else if (unit === 'yearly') dt.setFullYear(dt.getFullYear() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// every occurrence date of a (possibly repeating) item that falls in [rangeStart, rangeEnd]
function repeatDatesInRange(item, rangeStart, rangeEnd) {
  if (!item.due) return [];
  if (!item.repeat) return (item.due >= rangeStart && item.due <= rangeEnd) ? [item.due] : [];
  const end = item.repeatEnd || { mode: 'never' };
  const maxCount = end.mode === 'count' ? Math.max(1, +end.count || 1) : Infinity;
  const endDate = end.mode === 'date' ? end.date : null;
  const out = [];
  for (let i = 0; i < 2000 && i < maxCount; i++) {
    const dt = addToDate(item.due, item.repeat, i);
    if (dt > rangeEnd) break;
    if (endDate && dt > endDate) break;
    if (dt >= rangeStart) out.push(dt);
  }
  return out;
}

Object.assign(window, { Icon, Avatar, StatusPill, MatrixTag, MONTHS, WD, fmtDue, isoToday, addToDate, repeatDatesInRange });
