// data.jsx — seed data + helpers. Attaches to window.
// "Today" anchor — kept in sync with the real system clock so Today/Overdue/
// calendar highlighting always match the date on this machine.
const TODAY = new Date();

const STATUS = {
  notStarted: { id: 'notStarted', label: 'Not started', color: '#c3c8d4' },
  working:    { id: 'working',    label: 'Working on it', color: '#f0a93e' },
  stuck:      { id: 'stuck',      label: 'Stuck',         color: '#e36b6b' },
  done:       { id: 'done',       label: 'Done',          color: '#3fae6b' },
};
const STATUS_ORDER = ['notStarted', 'working', 'stuck', 'done'];

// Distinct, harmonious palettes for auto-coloring spaces and sections.
const SPACE_PALETTE = ['#5b5bd6', '#1fb5a3', '#e8743a', '#e0524a', '#3a72d4', '#9333ea', '#0891b2', '#65a30d', '#d4499b', '#c79a3a'];
const GROUP_PALETTE = ['#5b5bd6', '#1fb5a3', '#e8743a', '#e0524a', '#3a72d4', '#9333ea', '#0891b2', '#65a30d', '#d4499b', '#c79a3a'];
// deterministic per-space color (stable regardless of object order) from its id
const spaceColorFor = (board, index) => {
  if (board && board.color) return board.color;
  return SPACE_PALETTE[(index || 0) % SPACE_PALETTE.length];
};
// next section color: continue around the palette from how many sections exist
const nextGroupColor = (groups) => GROUP_PALETTE[((groups || []).length) % GROUP_PALETTE.length];
// the four seed statuses can be recolored/renamed but not deleted
const DEFAULT_STATUS_IDS = ['notStarted', 'working', 'stuck', 'done'];
const DEFAULT_STATUSES = STATUS_ORDER.map((id) => ({ ...STATUS[id] }));
const newStatusId = () => 'st' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
// React context so deep components (table cell, task panel) can manage statuses
const StatusAdminContext = React.createContext(null);
const useStatusAdmin = () => React.useContext(StatusAdminContext) || {};

// Eisenhower matrix — quadrants in priority order (most → least actionable)
const MATRIX = {
  doNow:    { id: 'doNow',    label: 'Do it now', short: 'Important & urgent',      color: '#e0524a', urgent: true,  important: true  },
  schedule: { id: 'schedule', label: 'Schedule',  short: 'Important, not urgent',   color: '#3a72d4', urgent: false, important: true  },
  delegate: { id: 'delegate', label: 'Delegate',  short: 'Urgent, not important',   color: '#e09a3c', urgent: true,  important: false },
  dismiss:  { id: 'dismiss',  label: 'Dismiss',   short: 'Not urgent or important', color: '#8a93a5', urgent: false, important: false },
};
const MATRIX_ORDER = ['doNow', 'schedule', 'delegate', 'dismiss'];
const _MATRIX_ALIAS = { high: 'doNow', medium: 'schedule', low: 'delegate', none: 'dismiss' };

// ---- Public holidays (Germany + China) ----
// These live OUTSIDE the boards on purpose: they show on the calendar only,
// never in the task table, and stay fully editable.
const HOLIDAY_COUNTRIES = {
  DE: { id: 'DE', label: 'Germany', short: 'DE', color: '#c79a3a' },
  CN: { id: 'CN', label: 'China',   short: 'CN', color: '#cf3a3a' },
};
let _hid = 0;
const huid = () => `h${++_hid}`;
const _hol = (name, date, country) => ({ id: huid(), name, date, country });
const newHoliday = (date) => ({
  id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
  name: 'New holiday', date, country: 'DE',
});
const HOLIDAYS = [
  // Germany 2026 (nationwide)
  _hol('Neujahr', '2026-01-01', 'DE'),
  _hol('Karfreitag', '2026-04-03', 'DE'),
  _hol('Ostermontag', '2026-04-06', 'DE'),
  _hol('Tag der Arbeit', '2026-05-01', 'DE'),
  _hol('Christi Himmelfahrt', '2026-05-14', 'DE'),
  _hol('Pfingstmontag', '2026-05-25', 'DE'),
  _hol('Tag der Deutschen Einheit', '2026-10-03', 'DE'),
  _hol('1. Weihnachtstag', '2026-12-25', 'DE'),
  _hol('2. Weihnachtstag', '2026-12-26', 'DE'),
  // China 2026 (statutory)
  _hol('\u5143\u65e6 New Year', '2026-01-01', 'CN'),
  _hol('\u6625\u8282 Spring Festival', '2026-02-17', 'CN'),
  _hol('\u6e05\u660e\u8282 Qingming', '2026-04-05', 'CN'),
  _hol('\u52b3\u52a8\u8282 Labour Day', '2026-05-01', 'CN'),
  _hol('\u7aef\u5348\u8282 Dragon Boat', '2026-06-19', 'CN'),
  _hol('\u4e2d\u79cb\u8282 Mid-Autumn', '2026-09-25', 'CN'),
  _hol('\u56fd\u5e86\u8282 National Day', '2026-10-01', 'CN'),
];

const OWNERS = {
  you:  { id: 'you',  name: 'You',   initials: 'Y',  color: '#5b5bd6' },
};
// Default roster is just "You"; everyone else is added by the user, with a color.
const DEFAULT_OWNERS = [{ id: 'you', name: 'You', initials: 'Y', color: '#5b5bd6' }];
const ownerInitials = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
const newOwner = (name, color) => ({
  id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
  name: name || 'New person', initials: ownerInitials(name), color: color || '#1fb5a3',
});
const OwnerAdminContext = React.createContext(null);
const useOwnerAdmin = () => React.useContext(OwnerAdminContext) || {};

// helper to make a timezone-free ISO date string in 2026 (no UTC conversion)
const _pad = (n) => String(n).padStart(2, '0');
const d = (day) => `2026-06-${_pad(day)}`;
const dM = (mon, day) => `2026-${_pad(mon + 1)}-${_pad(day)}`;

let _id = 0;
// Counter + random suffix so a fresh id can never collide with one restored
// from localStorage (where the counter has reset but old ids like `t38` persist).
const uid = () => `t${++_id}_${Math.random().toString(36).slice(2, 6)}`;
const _seedUid = (n) => { if (typeof n === 'number' && n > _id) _id = n; };
const sub = (title, done = false) => ({ id: uid(), title, done });

// default table columns for every space (task is the pinned primary column)
const defaultColumns = () => ([
  { id: 'task',   type: 'task',   label: 'Task',       width: 260 },
  { id: 'owner',  type: 'owner',  label: 'Owner',      width: 112 },
  { id: 'status', type: 'status', label: 'Status',     width: 174 },
  { id: 'due',    type: 'due',    label: 'Start from', width: 172 },
  { id: 'matrix', type: 'matrix', label: 'Matrix',     width: 155 },
]);

function task(title, owner, status, due, priority, opts = {}) {
  return { id: uid(), title, owner, status, due, priority: _MATRIX_ALIAS[priority] || priority, done: status === 'done', subtasks: [], ...opts };
}

const BOARDS = {
  roadmap: {
    id: 'roadmap',
    name: 'Q3 Roadmap',
    icon: 'target',
    columns: defaultColumns(),
    groups: [
      {
        id: 'g-week', name: 'This week', color: '#5b5bd6',
        items: [
          task('Finalize onboarding flow', 'you', 'working', d(19), 'high', { desc: 'Polish the 3-step welcome flow. Empty states + skip option. Sync copy with Maya before Friday.', subtasks: [sub('Wireframe the 3 steps', true), sub('Design empty states', true), sub('Add skip option'), sub('Copy review with Maya')] }),
          task('Review design QA tickets', 'you', 'working', d(21), 'medium', { subtasks: [sub('Triage open tickets', true), sub('Re-test fixed items')] }),
          task('Ship calendar sync v1', 'you', 'stuck', d(22), 'high', { desc: 'Blocked on OAuth scopes for Google. Need read-only calendar access approved.', subtasks: [sub('Apple EventKit hook', true), sub('Google OAuth scopes'), sub('Conflict de-dupe logic'), sub('Background refresh')] }),
          task('Write release notes', 'you', 'notStarted', d(23), 'low'),
          task('Patch auth redirect bug', 'you', 'stuck', d(16), 'high', { desc: 'Users bounced to login after email verify. Overdue — prioritize.' }),
        ],
      },
      {
        id: 'g-next', name: 'Up next', color: '#1fb5a3',
        items: [
          task('Plan Q3 kickoff', 'you', 'notStarted', d(26), 'medium'),
          task('Audit notification settings', 'you', 'notStarted', d(29), 'dismiss'),
          task('Migrate task importer', 'you', 'working', dM(6, 2), 'high'),
        ],
      },
      {
        id: 'g-backlog', name: 'Backlog', color: '#9aa4b2',
        items: [
          task('Dark mode pass', 'you', 'notStarted', dM(6, 9), 'low'),
          task('Keyboard shortcuts', 'you', 'notStarted', dM(6, 14), 'medium'),
          task('Mobile companion', 'you', 'notStarted', null, 'dismiss'),
        ],
      },
    ],
  },
  personal: {
    id: 'personal',
    name: 'Personal',
    icon: 'leaf',
    columns: defaultColumns(),
    groups: [
      {
        id: 'p-now', name: 'Now', color: '#e8743a',
        items: [
          task('Renew passport', 'you', 'working', d(24), 'high'),
          task('Dentist appointment', 'you', 'notStarted', d(25), 'medium'),
          task('Reply to landlord', 'you', 'notStarted', d(17), 'medium'),
          task('Pay electricity bill', 'you', 'done', d(18), 'low'),
        ],
      },
      {
        id: 'p-soon', name: 'Soon', color: '#7c8cf8',
        items: [
          task('Plan weekend trip', 'you', 'notStarted', dM(6, 4), 'low', { subtasks: [sub('Book hotel'), sub('Rent car'), sub('Pack')] }),
          task('Car service', 'you', 'notStarted', dM(6, 12), 'medium'),
        ],
      },
    ],
  },
  content: {
    id: 'content',
    name: 'Content',
    icon: 'pen',
    columns: defaultColumns(),
    groups: [
      {
        id: 'c-draft', name: 'Drafting', color: '#5b5bd6',
        items: [
          task('Newsletter #14', 'you', 'working', d(23), 'high', { subtasks: [sub('Draft intro', true), sub('Curate 5 links'), sub('Schedule send')] }),
          task('Case study: Acme', 'you', 'notStarted', d(27), 'medium'),
        ],
      },
      {
        id: 'c-pub', name: 'Published', color: '#3fae6b',
        items: [
          task('Launch announcement', 'you', 'done', d(12), 'high'),
          task('Pricing page copy', 'you', 'done', d(9), 'medium'),
        ],
      },
    ],
  },
};

// Mock external calendar events for the import flow
const IMPORT_SOURCES = {
  apple: {
    id: 'apple', name: 'macOS Calendar', account: 'iCloud · you@icloud.com',
    events: [
      { id: 'a1', title: 'Team standup', date: d(19), time: '9:30 AM' },
      { id: 'a2', title: 'Design review with Maya', date: d(20), time: '2:00 PM' },
      { id: 'a3', title: '1:1 with manager', date: d(22), time: '11:00 AM' },
      { id: 'a4', title: 'Quarterly planning', date: d(24), time: 'All day' },
      { id: 'a5', title: 'Lunch with Leo', date: d(25), time: '12:30 PM' },
    ],
  },
  google: {
    id: 'google', name: 'Google Calendar', account: 'you@gmail.com',
    events: [
      { id: 'g1', title: 'Product sync', date: d(19), time: '4:00 PM' },
      { id: 'g2', title: 'Customer call — Northwind', date: d(21), time: '10:00 AM' },
      { id: 'g3', title: 'Gym session', date: d(23), time: '7:00 AM' },
      { id: 'g4', title: 'Dentist', date: d(25), time: '3:30 PM' },
      { id: 'g5', title: 'Flight to SF', date: dM(6, 1), time: '6:45 AM' },
    ],
  },
};

Object.assign(window, {
  TODAY, STATUS, STATUS_ORDER, MATRIX, MATRIX_ORDER, OWNERS,
  BOARDS, IMPORT_SOURCES, uid, task, sub, defaultColumns,
  HOLIDAY_COUNTRIES, HOLIDAYS, newHoliday,
  DEFAULT_STATUS_IDS, DEFAULT_STATUSES, newStatusId, StatusAdminContext, useStatusAdmin,
  DEFAULT_OWNERS, newOwner, ownerInitials, OwnerAdminContext, useOwnerAdmin,
  SPACE_PALETTE, GROUP_PALETTE, spaceColorFor, nextGroupColor,
  __seedUid: _seedUid,
});
