// app.jsx — shell, sidebar, routing, state. Mounts the app.
const { useState: useAppState, useMemo } = React;

function SortControl({ sort, setSort }) {
  const [open, setOpen] = useAppState(false);
  const OPTS = [['manual', 'Manual order'], ['status', 'Status'], ['priority', 'Matrix'], ['date', 'Due date']];
  const cur = OPTS.find((o) => o[0] === sort);
  return (
    <div className="sort-wrap">
      <button className={`sort-btn ${sort !== 'manual' ? 'active' : ''}`} onClick={() => setOpen((o) => !o)}>
        <Icon name="sort" size={16} /> {sort === 'manual' ? 'Sort' : cur[1]}
        <Icon name="chevronDown" size={13} />
      </button>
      {open && (
        <>
          <div className="sort-backdrop" onClick={() => setOpen(false)} />
          <div className="sort-menu">
            <div className="sort-menu-label">Sort tasks by</div>
            {OPTS.map(([id, label]) => (
              <button key={id} className={`sort-opt ${sort === id ? 'on' : ''}`} onClick={() => { setSort(id); setOpen(false); }}>
                {label}{sort === id && <Icon name="check" size={14} stroke={3} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NewMenu({ onNewTask, onImport, onRecord }) {
  const [open, setOpen] = useAppState(false);
  return (
    <div className="new-wrap">
      <button className="new-btn" onClick={() => { onNewTask(); }}><Icon name="plus" size={16} /> New task</button>
      <button className="new-caret" onClick={() => setOpen((o) => !o)} aria-label="More"><Icon name="chevronDown" size={14} /></button>
      {open && (
        <>
          <div className="sort-backdrop" onClick={() => setOpen(false)} />
          <div className="new-menu">
            <button className="new-opt" onClick={() => { setOpen(false); onNewTask(); }}><Icon name="plus" size={15} /> <span><b>New task</b><i>Create one yourself</i></span></button>
            <button className="new-opt" onClick={() => { setOpen(false); onRecord(); }}><Icon name="mic" size={15} /> <span><b>Record meeting</b><i>Transcribe &amp; summarize live</i></span></button>
            <button className="new-opt" onClick={() => { setOpen(false); onImport(); }}><Icon name="calendar" size={15} /> <span><b>Import from calendar</b><i>macOS &amp; Google</i></span></button>
          </div>
        </>
      )}
    </div>
  );
}

const SPACE_ICON_CHOICES = ['folder', 'target', 'leaf', 'pen', 'inbox', 'calendar', 'flag', 'settings'];

const BRAND_MARKS = ['◆', '●', '▲', '■', '✦', '◇', '❖', '✶', '⬢', '◈'];

function BrandEditor({ brand, onChange, onClose }) {
  const [name, setName] = useAppState(brand.name);
  const commit = () => { onChange({ name: name.trim() || brand.name }); onClose(); };
  return (
    <>
      <div className="sort-backdrop" onClick={commit} />
      <div className="brand-editor" onClick={(e) => e.stopPropagation()}>
        <div className="se-label">Workspace name</div>
        <input className="se-input" autoFocus value={name}
          onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onClose(); }} />
        <div className="se-label">Icon</div>
        <div className="brand-marks">
          {BRAND_MARKS.map((m) => (
            <button key={m} className={`brand-mark-opt ${brand.mark === m ? 'on' : ''}`} onClick={() => onChange({ mark: m })}>{m}</button>
          ))}
        </div>
        <button className="se-done" onClick={commit}>Done</button>
      </div>
    </>
  );
}

function SpaceEditor({ space, onRename, onIcon, onDelete, canDelete, onClose }) {
  const [name, setName] = useAppState(space.name);
  const [confirmDel, setConfirmDel] = useAppState(false);
  return (
    <>
      <div className="sort-backdrop" onClick={() => { onRename(name.trim()); onClose(); }} />
      <div className="space-editor" onClick={(e) => e.stopPropagation()}>
        <div className="se-label">Name</div>
        <input className="se-input" autoFocus value={name}
          onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()}
          onKeyDown={(e) => { if (e.key === 'Enter') { onRename(name.trim()); onClose(); } if (e.key === 'Escape') onClose(); }} />
        <div className="se-label">Icon</div>
        <div className="se-icons">
          {SPACE_ICON_CHOICES.map((ic) => (
            <button key={ic} className={`se-icon ${space.icon === ic ? 'on' : ''}`} onClick={() => onIcon(ic)} aria-label={ic}>
              <Icon name={ic} size={18} />
            </button>
          ))}
        </div>
        <button className="se-done" onClick={() => { onRename(name.trim()); onClose(); }}>Done</button>
        {canDelete && (confirmDel ? (
          <div className="se-del-confirm">
            <span>Delete “{space.name}” and all its tasks?</span>
            <div className="se-del-actions">
              <button className="se-del-cancel" onClick={() => setConfirmDel(false)}>Cancel</button>
              <button className="se-del-yes" onClick={() => { onDelete(); onClose(); }}>Delete space</button>
            </div>
          </div>
        ) : (
          <button className="se-delete" onClick={() => setConfirmDel(true)}><Icon name="trash" size={14} /> Delete space</button>
        ))}
      </div>
    </>
  );
}

const ACCENTS = {
  indigo: { name: 'Indigo', accent: '#5b5bd6', soft: '#ececfb' },
  forest: { name: 'Forest', accent: '#2f9e6f', soft: '#e6f4ec' },
  coral:  { name: 'Coral',  accent: '#e2614f', soft: '#fdebe7' },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "indigo",
  "sidebar": "light",
  "density": "comfortable",
  "meetingLayout": "stacked"
}/*EDITMODE-END*/;

// ---- state reducer over a board ----
function reduceBoard(board, action) {
  const b = structuredClone(board);
  const find = () => {
    for (const g of b.groups) { const it = g.items.find((i) => i.id === action.id); if (it) return it; }
    return null;
  };
  switch (action.type) {
    case 'cycleStatus': { const it = find(); if (it) { const n = (STATUS_ORDER.indexOf(it.status) + 1) % STATUS_ORDER.length; it.status = STATUS_ORDER[n]; it.done = it.status === 'done'; } break; }
    case 'cyclePriority': { const it = find(); if (it) { const n = (MATRIX_ORDER.indexOf(it.priority) + 1) % MATRIX_ORDER.length; it.priority = MATRIX_ORDER[n]; } break; }
    case 'toggleDone': { const it = find(); if (it) { it.done = !it.done; it.status = it.done ? 'done' : 'working'; } break; }
    case 'rename': { const it = find(); if (it) it.title = action.title; break; }
    case 'setDate': { const it = find(); if (it) { it.due = action.due; it.dueEnd = action.dueEnd; it.time = action.time; } break; }
    case 'setStatus': { const it = find(); if (it) { it.status = action.status; it.done = action.status === 'done'; } break; }
    case 'setPriority': { const it = find(); if (it) it.priority = action.priority; break; }
    case 'setOwner': { const it = find(); if (it) it.owner = action.owner; break; }
    case 'setDesc': { const it = find(); if (it) it.desc = action.desc; break; }
    case 'setMeta': { const it = find(); if (it) { if (action.value === null || action.value === undefined || action.value === '') delete it[action.key]; else it[action.key] = action.value; } break; }
    case 'addAttachment': { const it = find(); if (it) { it.attachments = it.attachments || []; it.attachments.push(action.att); } break; }
    case 'removeAttachment': { const it = find(); if (it) it.attachments = (it.attachments || []).filter((a) => a.id !== action.attId); break; }
    case 'addSubtask': { const it = find(); if (it) { it.subtasks = it.subtasks || []; it.subtasks.push({ id: uid(), title: action.title, done: false }); } break; }
    case 'toggleSubtask': { const it = find(); if (it && it.subtasks) { const s = it.subtasks.find((s) => s.id === action.subId); if (s) s.done = !s.done; } break; }
    case 'renameSubtask': { const it = find(); if (it && it.subtasks) { const s = it.subtasks.find((s) => s.id === action.subId); if (s) s.title = action.title; } break; }
    case 'deleteSubtask': { const it = find(); if (it) it.subtasks = (it.subtasks || []).filter((s) => s.id !== action.subId); break; }
    case 'renameGroup': { const g = b.groups.find((g) => g.id === action.groupId); if (g) g.name = action.name; break; }
    case 'addGroup': { b.groups.push({ id: 'g-' + Date.now(), name: action.name || 'New section', color: action.color || nextGroupColor(b.groups), items: [] }); break; }
    case 'deleteGroup': { b.groups = b.groups.filter((g) => g.id !== action.groupId); break; }
    case 'addColumn': {
      b.columns = b.columns || [];
      const w = (window.COLUMN_DEFAULT_WIDTH && window.COLUMN_DEFAULT_WIDTH[action.colType]) || 150;
      const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      b.columns.push({ id, type: action.colType, label: action.label || 'New column', width: w });
      break;
    }
    case 'removeColumn': { b.columns = (b.columns || []).filter((c) => c.id !== action.colId); break; }
    case 'renameColumn': { const c = (b.columns || []).find((c) => c.id === action.colId); if (c) c.label = action.label; break; }
    case 'resizeColumn': { const c = (b.columns || []).find((c) => c.id === action.colId); if (c) c.width = action.width; break; }
    case 'moveColumn': {
      const cols = b.columns || [];
      const from = cols.findIndex((c) => c.id === action.colId);
      if (from < 0) break;
      const [m] = cols.splice(from, 1);
      const to = Math.max(1, Math.min(action.to, cols.length));
      cols.splice(to, 0, m);
      break;
    }
    case 'setField': {
      const it = find();
      if (it) {
        it.fields = it.fields || {};
        if (action.value === null || action.value === undefined || action.value === '') delete it.fields[action.colId];
        else it.fields[action.colId] = action.value;
      }
      break;
    }
    case 'delete': { b.groups.forEach((g) => { g.items = g.items.filter((i) => i.id !== action.id); }); break; }
    case 'add': { const g = b.groups.find((g) => g.id === action.groupId); if (g) g.items.push(task(action.title, 'you', 'notStarted', null, 'schedule')); break; }
    case 'addFull': { const g = action.groupId ? (b.groups.find((g) => g.id === action.groupId) || b.groups[0]) : b.groups[0]; if (g) g.items.unshift(action.item); break; }
    case 'addOnDate': { const g = b.groups[0]; if (g) g.items.push(task(action.title, 'you', 'notStarted', action.date, 'medium')); break; }
    case 'import': {
      let g = b.groups.find((g) => g.id === 'imported');
      if (!g) { g = { id: 'imported', name: 'Imported from Calendar', color: '#e8743a', items: [] }; b.groups.unshift(g); }
      action.events.forEach((e) => g.items.push(task(e.title, 'you', 'notStarted', e.date, 'medium', { fromCal: e.source })));
      break;
    }
    default: break;
  }
  return b;
}

function MyWork({ boards, onOpen, onDelete }) {
  const all = [];
  Object.values(boards).forEach((b) => b.groups.forEach((g) => g.items.forEach((i) => {
    if (i.owner !== 'you') return;
    all.push({ ...i, board: b.name, groupColor: g.color });
  })));
  const today = isoToday();
  const buckets = { Overdue: [], Today: [], 'This week': [], Later: [], 'No date': [] };
  all.forEach((i) => {
    if (!i.due) return buckets['No date'].push(i);
    const f = fmtDue(i.due);
    if (i.done) return buckets[f.diff <= 7 ? 'This week' : 'Later'].push(i);
    if (f.diff < 0) buckets.Overdue.push(i);
    else if (f.diff === 0) buckets.Today.push(i);
    else if (f.diff <= 7) buckets['This week'].push(i);
    else buckets.Later.push(i);
  });
  const order = ['Today', 'This week', 'Later', 'No date', 'Overdue'];
  const Row = (i) => (
    <div key={i.id} className={`mw-row ${i.done ? 'is-done' : ''}`} onClick={() => onOpen(i.id)}>
      <span className="mw-status" style={{ background: STATUS[i.status].color }} />
      <span className="mw-title">{i.title}</span>
      <span className="mw-board">{i.board}</span>
      <span className="mw-due">{i.due ? fmtDue(i.due).base : ''}</span>
      {onDelete && (
        <button className="mw-delete" onClick={(e) => { e.stopPropagation(); onDelete(i.id); }} aria-label="Delete task" title="Delete task">
          <Icon name="trash" size={14} />
        </button>
      )}
    </div>
  );
  return (
    <div className="mywork">
      <div className="mywork-inner">
        {order.map((k) => buckets[k].length > 0 && (
          <div key={k} className="mw-bucket">
            <h3 className={`mw-h ${k === 'Overdue' ? 'over' : k === 'Today' ? 'today' : ''}`}>{k} <span>{buckets[k].length}</span></h3>
            {buckets[k].sort((a,b)=> (a.due||'')< (b.due||'')?-1:1).map(Row)}
          </div>
        ))}
      </div>
    </div>
  );
}

// One workspace bundles its own spaces (boards), active space, and brand identity.
const makeDefaultWorkspaces = () => ({
  'ws-main': { id: 'ws-main', name: 'Flow', mark: '◆', boards: structuredClone(BOARDS), activeId: 'roadmap' },
});

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const cal = useCalendarSync();
  // ---- restore persisted workspace (falls back to seed data) ----
  const restored = useMemo(() => (loadWorkspace() || {}).state || {}, []);
  // workspaces layer — migrates legacy single-workspace state (boards/activeId/brand) on load
  const initWorkspaces = useMemo(() => {
    if (restored.workspaces && Object.keys(restored.workspaces).length) return restored.workspaces;
    if (restored.boards) {
      const b = restored.boards;
      const aid = (restored.activeId && b[restored.activeId]) ? restored.activeId : Object.keys(b)[0];
      const br = restored.brand || { name: 'Flow', mark: '◆' };
      return { 'ws-main': { id: 'ws-main', name: br.name, mark: br.mark, boards: b, activeId: aid } };
    }
    return makeDefaultWorkspaces();
  }, []);
  const [workspaces, setWorkspaces] = useAppState(initWorkspaces);
  const [activeWsId, setActiveWsId] = useAppState(
    (restored.activeWsId && initWorkspaces[restored.activeWsId]) ? restored.activeWsId : Object.keys(initWorkspaces)[0]
  );
  const ws = workspaces[activeWsId] || Object.values(workspaces)[0];
  // derived current-workspace views + wrapper setters so the rest of App is unchanged
  const boards = ws.boards;
  const activeId = ws.activeId;
  const brand = { name: ws.name, mark: ws.mark };
  const setBoards = (updater) => setWorkspaces((all) => {
    const cur = all[activeWsId]; const nb = typeof updater === 'function' ? updater(cur.boards) : updater;
    return { ...all, [activeWsId]: { ...cur, boards: nb } };
  });
  const setActiveId = (idOrFn) => setWorkspaces((all) => {
    const cur = all[activeWsId]; const nv = typeof idOrFn === 'function' ? idOrFn(cur.activeId) : idOrFn;
    return { ...all, [activeWsId]: { ...cur, activeId: nv } };
  });
  const setBrand = (updater) => setWorkspaces((all) => {
    const cur = all[activeWsId]; const patch = typeof updater === 'function' ? updater({ name: cur.name, mark: cur.mark }) : updater;
    return { ...all, [activeWsId]: { ...cur, name: patch.name !== undefined ? patch.name : cur.name, mark: patch.mark !== undefined ? patch.mark : cur.mark } };
  });
  const [statuses, setStatuses] = useAppState(() => restored.statuses || structuredClone(DEFAULT_STATUSES));
  const [owners, setOwners] = useAppState(() => restored.owners || structuredClone(DEFAULT_OWNERS));
  const [holidays, setHolidays] = useAppState(() => restored.holidays || structuredClone(HOLIDAYS));
  const [shares, setShares] = useAppState(() => restored.shares || {});
  const [shareModal, setShareModal] = useAppState(null); // { scope, targetId } | null
  const updateShare = (key, rec) => setShares((s) => ({ ...s, [key]: rec }));
  const [view, setView] = useAppState(restored.view || 'board'); // board | mywork | today | overview | settings
  const [spaceViews, setSpaceViews] = useAppState(restored.spaceViews || {});
  const [prefs, setPrefs] = useAppState(restored.prefs || { rememberSpaceView: true });
  const spaceView = (prefs.rememberSpaceView ? spaceViews[activeId] : null) || spaceViews[activeId] || 'table';
  const setSpaceView = (v) => setSpaceViews((s) => ({ ...s, [activeId]: v }));
  const [importOpen, setImportOpen] = useAppState(false);
  const [meetingOpen, setMeetingOpen] = useAppState(false);
  const [meetingMinimized, setMeetingMinimized] = useAppState(false);
  const [meetingSnap, setMeetingSnap] = useAppState({ elapsed: 0, segCount: 0, recording: false, lang: 'en', title: '', phase: 'record' });
  const [toast, setToast] = useAppState(null);
  const [search, setSearch] = useAppState('');
  const [searchOpen, setSearchOpen] = useAppState(false);
  const [openTaskId, setOpenTask] = useAppState(null);
  const [sort, setSort] = useAppState(restored.sort || 'manual');
  const [statFilter, setStatFilter] = useAppState(null);
  const [ovTab, setOvTab] = useAppState('calendar');
  const [profile, setProfile] = useAppState(restored.profile || { name: 'You', email: 'you@icloud.com' });
  const [renamingSpace, setRenamingSpace] = useAppState(null);
  const [editingBrand, setEditingBrand] = useAppState(false);
  const [wsMenuOpen, setWsMenuOpen] = useAppState(false);

  // ---- keep the global STATUS map + order in sync with editable status state ----
  // (all views read the globals; App re-renders the whole tree on any state change)
  useMemo(() => {
    Object.keys(STATUS).forEach((k) => { delete STATUS[k]; });
    STATUS_ORDER.length = 0;
    statuses.forEach((s) => { STATUS[s.id] = s; STATUS_ORDER.push(s.id); });
  }, [statuses]);

  const addStatus = (label, color) => {
    const id = newStatusId();
    setStatuses((ss) => [...ss, { id, label: label || 'New status', color: color || '#5b5bd6' }]);
    return id;
  };
  const updateStatus = (id, patch) => setStatuses((ss) => ss.map((s) => s.id === id ? { ...s, ...patch } : s));
  const removeStatus = (id) => {
    if (DEFAULT_STATUS_IDS.includes(id)) return;
    const fallback = STATUS_ORDER.find((s) => s !== id) || 'notStarted';
    setBoards((bs) => {
      const next = {};
      for (const bid of Object.keys(bs)) {
        const b = structuredClone(bs[bid]);
        b.groups.forEach((g) => g.items.forEach((i) => { if (i.status === id) { i.status = fallback; i.done = fallback === 'done'; } }));
        next[bid] = b;
      }
      return next;
    });
    setStatuses((ss) => ss.filter((s) => s.id !== id));
  };
  const statusAdmin = { statuses, addStatus, updateStatus, removeStatus };

  // ---- keep the global OWNERS map in sync with the editable roster ----
  useMemo(() => {
    Object.keys(OWNERS).forEach((k) => { delete OWNERS[k]; });
    owners.forEach((o) => { OWNERS[o.id] = o; });
  }, [owners]);

  const addOwner = (name, color) => {
    const o = newOwner(name, color);
    setOwners((os) => [...os, o]);
    return o.id;
  };
  const updateOwner = (id, patch) => setOwners((os) => os.map((o) => {
    if (o.id !== id) return o;
    const next = { ...o, ...patch };
    if (patch.name !== undefined) next.initials = ownerInitials(patch.name);
    return next;
  }));
  const removeOwner = (id) => {
    if (id === 'you') return;
    setBoards((bs) => {
      const next = {};
      for (const bid of Object.keys(bs)) {
        const b = structuredClone(bs[bid]);
        b.groups.forEach((g) => g.items.forEach((i) => { if (i.owner === id) i.owner = null; }));
        next[bid] = b;
      }
      return next;
    });
    setOwners((os) => os.filter((o) => o.id !== id));
  };
  const ownerAdmin = { owners, addOwner, updateOwner, removeOwner };

  // ---- Holidays (calendar-only, editable, never in the task table) ----
  const addHoliday = (date) => { const h = newHoliday(date); setHolidays((hs) => [...hs, h]); return h.id; };
  const updateHoliday = (id, patch) => setHolidays((hs) => hs.map((h) => h.id === id ? { ...h, ...patch } : h));
  const removeHoliday = (id) => setHolidays((hs) => hs.filter((h) => h.id !== id));
  const holidayRegions = prefs.holidayRegions || { DE: true, CN: true };
  const visibleHolidays = holidays.filter((h) => holidayRegions[h.country] !== false);
  const holidayApi = { holidays: visibleHolidays, onAddHoliday: addHoliday, onEditHoliday: updateHoliday, onDeleteHoliday: removeHoliday };

  // ---- persist the workspace whenever it changes ----
  React.useEffect(() => {
    saveWorkspace({ workspaces, activeWsId, view, spaceViews, prefs, sort, profile, holidays, statuses, owners, shares });
  }, [workspaces, activeWsId, view, spaceViews, prefs, sort, profile, holidays, statuses, owners, shares]);

  // ---- workspace management ----
  const addWorkspace = () => {
    const id = 'ws' + Date.now().toString(36);
    const n = Object.keys(workspaces).length + 1;
    const firstSpace = 'sp' + Date.now().toString(36);
    setWorkspaces((all) => ({ ...all, [id]: {
      id, name: 'Workspace ' + n, mark: BRAND_MARKS[(n - 1) % BRAND_MARKS.length],
      boards: { [firstSpace]: { id: firstSpace, name: 'My space', icon: 'folder', color: '#5b5bd6', groups: [{ id: 'g-' + Date.now(), name: 'To do', color: '#7c8cf8', items: [] }], columns: defaultColumns() } },
      activeId: firstSpace,
    } }));
    setActiveWsId(id); setView('board'); setWsMenuOpen(false); setOpenTask(null);
  };
  const switchWorkspace = (id) => { setActiveWsId(id); setView('board'); setWsMenuOpen(false); setOpenTask(null); };
  const deleteWorkspace = (id) => {
    setWorkspaces((all) => {
      const ids = Object.keys(all);
      if (ids.length <= 1) return all; // keep at least one
      const next = { ...all }; delete next[id];
      if (activeWsId === id) { setActiveWsId(Object.keys(next)[0]); setView('board'); setOpenTask(null); }
      return next;
    });
    setToast('Workspace deleted'); setTimeout(() => setToast(null), 2200);
  };

  const resetWorkspace = () => {
    clearWorkspace();
    setWorkspaces(makeDefaultWorkspaces());
    setActiveWsId('ws-main');
    setView('board'); setSpaceViews({}); setSort('manual');
    setStatuses(structuredClone(DEFAULT_STATUSES));
    setOwners(structuredClone(DEFAULT_OWNERS));
    setHolidays(structuredClone(HOLIDAYS));
    setProfile({ name: 'You', email: 'you@icloud.com' });
    setOpenTask(null);
    setToast('Workspace reset to demo data');
    setTimeout(() => setToast(null), 2800);
  };

  const board = boards[activeId] || Object.values(boards)[0];
  // locate the open task across ALL boards (Today/Overview/My Work aggregate cross-board)
  let openItem = null, openGroup = null, openBoardId = null;
  if (openTaskId) {
    for (const bid of Object.keys(boards)) {
      for (const g of boards[bid].groups) {
        const it = g.items.find((i) => i.id === openTaskId);
        if (it) { openItem = it; openGroup = g; openBoardId = bid; break; }
      }
      if (openItem) break;
    }
  }
  const dispatch = (action) => setBoards((bs) => ({ ...bs, [activeId]: reduceBoard(bs[activeId], action) }));
  // dispatch targeting whichever board owns the open task (may differ from active board)
  const dispatchTo = (bid) => (action) => setBoards((bs) => ({ ...bs, [bid]: reduceBoard(bs[bid], action) }));

  // move a task to another space and/or section (works across boards)
  const moveTask = (itemId, fromBoardId, toBoardId, toGroupId) => {
    setBoards((bs) => {
      const next = structuredClone(bs);
      let moved = null;
      const fb = next[fromBoardId];
      if (fb) fb.groups.forEach((g) => { const idx = g.items.findIndex((i) => i.id === itemId); if (idx >= 0) moved = g.items.splice(idx, 1)[0]; });
      if (moved) {
        const tb = next[toBoardId]; if (!tb) return bs;
        const tg = tb.groups.find((g) => g.id === toGroupId) || tb.groups[0];
        if (tg) tg.items.push(moved); else return bs;
      }
      return next;
    });
  };

  // add a fully-detailed task straight to a board/section (used by calendar quick-add flows)
  const addTaskToBoard = (boardId, groupId, item) => setBoards((bs) => ({ ...bs, [boardId]: reduceBoard(bs[boardId], { type: 'addFull', groupId, item }) }));

  // toggle a task's done state no matter which board it lives in
  const toggleAnyDone = (id) => setBoards((bs) => {
    const next = { ...bs };
    for (const bid of Object.keys(next)) {
      if (next[bid].groups.some((g) => g.items.some((i) => i.id === id))) {
        next[bid] = reduceBoard(next[bid], { type: 'toggleDone', id });
        break;
      }
    }
    return next;
  });
  // delete a task no matter which board it lives in
  const deleteAnyTask = (id) => setBoards((bs) => {
    const next = { ...bs };
    for (const bid of Object.keys(next)) {
      if (next[bid].groups.some((g) => g.items.some((i) => i.id === id))) {
        next[bid] = reduceBoard(next[bid], { type: 'delete', id });
        break;
      }
    }
    return next;
  });
  const openBoard = (id) => {
    setActiveId(id);
    setView('board');
    if (!prefs.rememberSpaceView) setSpaceViews((s) => ({ ...s, [id]: 'table' }));
  };
  const boardActive = view === 'board';

  // ---- Spaces management ----
  const SPACE_ICONS = ['folder', 'target', 'leaf', 'pen', 'grid', 'flag'];
  const addSpace = () => {
    const id = 'space-' + Date.now();
    const n = Object.keys(boards).length;
    setBoards((bs) => ({ ...bs, [id]: {
      id, name: 'New Space', icon: SPACE_ICONS[n % SPACE_ICONS.length],
      columns: defaultColumns(),
      groups: [{ id: id + '-g1', name: 'To do', color: '#5b5bd6', items: [] }],
    } }));
    setActiveId(id); setView('board'); setRenamingSpace(id);
  };
  // FIX: don't fall back to the old name on every keystroke — that fallback
  // fired as soon as the field was cleared toward empty, snapping the value
  // (and the cursor, to the end) back to the original text mid-edit, which
  // made it look like the first character couldn't be deleted. Allow the
  // field to go empty while typing; only guard against a truly empty name
  // once editing is done (see onBlur below).
  const renameSpace = (id, name) => setBoards((bs) => ({ ...bs, [id]: { ...bs[id], name } }));
  const setSpaceIcon = (id, icon) => setBoards((bs) => ({ ...bs, [id]: { ...bs[id], icon } }));
  const deleteSpace = (id) => {
    setWorkspaces((all) => {
      const cur = all[activeWsId];
      const ids = Object.keys(cur.boards);
      if (ids.length <= 1) return all; // never delete the last space
      const nextBoards = { ...cur.boards }; delete nextBoards[id];
      const nextActive = cur.activeId === id ? Object.keys(nextBoards)[0] : cur.activeId;
      return { ...all, [activeWsId]: { ...cur, boards: nextBoards, activeId: nextActive } };
    });
    setView('board'); setOpenTask(null); setRenamingSpace(null);
    setToast('Space deleted');
    setTimeout(() => setToast(null), 2400);
  };

  const handleNewTask = () => {
    const it = task('New task', 'you', 'notStarted', null, 'schedule');
    setBoards((bs) => ({ ...bs, [activeId]: reduceBoard(bs[activeId], { type: 'addFull', item: it }) }));
    setView('board');
    setSpaceView('table');
    setOpenTask(it.id);
  };

  const handleImport = (events) => {
    setBoards((bs) => ({ ...bs, [activeId]: reduceBoard(bs[activeId], { type: 'import', events }) }));
    setImportOpen(false);
    setView('board');
    setToast(`Imported ${events.length} task${events.length === 1 ? '' : 's'} into “${board.name}”`);
    setTimeout(() => setToast(null), 3200);
  };

  // ---- Save a recorded meeting: notes + action items into a dedicated “Meetings” space ----
  const MEETINGS_SPACE_ID = 'meetings';
  const saveMeeting = (m) => {
    const L = (window.LANGS && window.LANGS[m.language]) || { native: m.language };
    const dateLabel = (() => { const d = new Date(m.date + 'T00:00:00'); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); })();
    // Build a readable note body stored on a parent “notes” task (viewable in the task panel).
    const noteLines = [];
    noteLines.push('TL;DR\n' + (m.summary || '—'));
    if (m.decisions.length) noteLines.push('\nDecisions\n' + m.decisions.map((d) => '• ' + d).join('\n'));
    if (m.actionItems.length) noteLines.push('\nAction items\n' + m.actionItems.map((a) => '• ' + a.title).join('\n'));
    noteLines.push('\nTranscript (' + L.native + ')\n' + m.transcript.map((s) => `${s.name}: ${s.text}`).join('\n'));
    const noteBody = noteLines.join('\n');

    const noteTask = task('🎙 ' + m.title + ' — notes', 'you', 'done', m.date, 'schedule', { desc: noteBody, meeting: true });
    const aiTasks = m.actionItems.map((a) => task(a.title, 'you', 'notStarted', a.due || m.date, a.priority || 'medium', a.owner ? { suggestedOwner: a.owner } : {}));
    const sectionName = `${m.title} · ${dateLabel}`;

    setBoards((bs) => {
      const next = structuredClone(bs);
      let mb = next[MEETINGS_SPACE_ID];
      if (!mb) mb = { id: MEETINGS_SPACE_ID, name: 'Meetings', icon: 'mic', columns: defaultColumns(), groups: [] };
      const section = { id: 'msec-' + Date.now(), name: sectionName, color: nextGroupColor(mb.groups), items: [noteTask, ...aiTasks] };
      mb = { ...mb, groups: [section, ...mb.groups] };
      next[MEETINGS_SPACE_ID] = mb;
      return next;
    });
    setMeetingOpen(false);
    setMeetingMinimized(false);
    setActiveId(MEETINGS_SPACE_ID);
    setView('board');
    setSpaceView('table');
    setToast(`Saved “${m.title}” · ${m.actionItems.length} task${m.actionItems.length === 1 ? '' : 's'} added`);
    setTimeout(() => setToast(null), 3400);
  };

  const ac = ACCENTS[t.accent] || ACCENTS.indigo;
  const rootStyle = {
    '--accent': ac.accent,
    '--accent-soft': ac.soft,
    '--row-h': t.density === 'compact' ? '40px' : '48px',
    '--cell-py': t.density === 'compact' ? '5px' : '9px',
  };

  const navItems = [
    { id: 'mywork', label: 'My Work', icon: 'inbox', kind: 'view' },
  ];

  const totalItems = (b) => b.groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <StatusAdminContext.Provider value={statusAdmin}>
    <OwnerAdminContext.Provider value={ownerAdmin}>
    <div className={`app sidebar-${t.sidebar}`} style={rootStyle} data-density={t.density}>
      {/* macOS title bar */}
      <div className="titlebar">
        <div className="traffic">
          <span className="tl red" /><span className="tl yellow" /><span className="tl green" />
        </div>
        <div className="tb-title">{brand.name} — {board.name}</div>
        <div className="tb-right" />
      </div>

      <div className="body">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="brand">
            <button className="brand-btn" onClick={() => setEditingBrand(true)} title="Rename workspace">
              <span className="brand-mark">{brand.mark}</span>
              <span className="brand-name">{brand.name}</span>
            </button>
            <button className="ws-switch-btn" onClick={() => setWsMenuOpen((o) => !o)} title="Switch workspace" aria-label="Switch workspace">
              <Icon name="chevronDown" size={16} />
            </button>
            {editingBrand && (
              <BrandEditor brand={brand}
                onChange={(patch) => setBrand((b) => ({ ...b, ...patch }))}
                onClose={() => setEditingBrand(false)} />
            )}
            {wsMenuOpen && (
              <>
                <div className="sort-backdrop" onClick={() => setWsMenuOpen(false)} />
                <div className="ws-menu">
                  <div className="ws-menu-head">Workspaces</div>
                  {Object.values(workspaces).map((w) => (
                    <div key={w.id} className={`ws-menu-row ${w.id === activeWsId ? 'on' : ''}`}>
                      <button className="ws-menu-pick" onClick={() => switchWorkspace(w.id)}>
                        <span className="ws-menu-mark">{w.mark}</span>
                        <span className="ws-menu-name">{w.name}</span>
                        {w.id === activeWsId && <Icon name="check" size={15} stroke={3} style={{ marginLeft: 'auto' }} />}
                      </button>
                      {Object.keys(workspaces).length > 1 && (
                        <button className="ws-menu-del" onClick={() => deleteWorkspace(w.id)} title="Delete workspace"><Icon name="trash" size={13} /></button>
                      )}
                    </div>
                  ))}
                  <div className="menu-divider" />
                  <button className="ws-menu-add" onClick={() => { setWsMenuOpen(false); setShareModal({ scope: 'workspace', targetId: 'ws' }); }}><Icon name="share" size={15} /> Share workspace</button>
                  <button className="ws-menu-add" onClick={addWorkspace}><Icon name="plus" size={15} /> New workspace</button>
                </div>
              </>
            )}
          </div>

          <button className="nav-item primary-action" onClick={handleNewTask}>
            <Icon name="plus" size={16} /> New task
          </button>

          <button className={`nav-item ${view === 'today' ? 'active' : ''}`} onClick={() => setView('today')}>
            <Icon name="sun" size={18} /> This Week
          </button>
          <button className={`nav-item ${view === 'overview' ? 'active' : ''}`} onClick={() => { setStatFilter(null); setView('overview'); }}>
            <Icon name="grid" size={18} /> Overview
          </button>
          <button className={`nav-item ${view === 'mywork' ? 'active' : ''}`} onClick={() => setView('mywork')}>
            <Icon name="inbox" size={18} /> My Work
          </button>

          <div className="nav-label">Spaces</div>
          <div className="board-list">
            {Object.values(boards).map((b) => (
              <div key={b.id} className="space-row-wrap">
                <button className={`nav-item board-item ${activeId === b.id && boardActive ? 'active' : ''}`}
                  onClick={() => openBoard(b.id)} onDoubleClick={() => setRenamingSpace(b.id)}>
                  <Icon name={b.icon} size={17} />
                  <span className="board-item-name">{b.name}</span>
                  <span className="board-item-count">{totalItems(b)}</span>
                  <span className="space-edit-btn" onClick={(e) => { e.stopPropagation(); setRenamingSpace(b.id); }} title="Edit space"><Icon name="dots" size={15} /></span>
                </button>
                {renamingSpace === b.id && (
                  <SpaceEditor space={b}
                    onRename={(name) => renameSpace(b.id, name)}
                    onIcon={(icon) => setSpaceIcon(b.id, icon)}
                    onDelete={() => deleteSpace(b.id)}
                    canDelete={Object.keys(boards).length > 1}
                    onClose={() => setRenamingSpace(null)} />
                )}
              </div>
            ))}
            <button className="nav-item add-space" onClick={addSpace}>
              <Icon name="plus" size={16} /> Add space
            </button>
          </div>

          <div className="sidebar-foot">
            <button className={`nav-item subtle ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}><Icon name="settings" size={17} /> Settings</button>
            <div className="user-chip"><Avatar ownerId="you" size={28} /><div className="user-meta"><b>{profile.name}</b><span>{profile.email}</span></div></div>
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          {view === 'today' ? (
            <>
              <header className="topbar">
                <div className="topbar-l"><h1 className="page-title"><Icon name="sun" size={22} /> This Week</h1></div>
              </header>
              <TodayView boards={boards} onToggle={toggleAnyDone} onOpen={setOpenTask} onAddTask={addTaskToBoard} onDelete={deleteAnyTask} />
            </>
          ) : view === 'overview' ? (
            <>
              <header className="topbar">
                <div className="topbar-l"><h1 className="page-title"><Icon name="grid" size={22} /> Overview</h1></div>
                <div className="view-switch">
                  <button className={ovTab === 'calendar' ? 'on' : ''} onClick={() => setOvTab('calendar')}><Icon name="calendar" size={16} /> Calendar</button>
                  <button className={ovTab === 'dashboard' ? 'on' : ''} onClick={() => { setStatFilter(null); setOvTab('dashboard'); }}><Icon name="table" size={16} /> Dashboard</button>
                </div>
              </header>
              {ovTab === 'calendar' ? (
                <AllSpacesCalendar boards={boards} onOpenTask={setOpenTask}
                  onAddTask={addTaskToBoard}
                  {...holidayApi} />
              ) : statFilter ? (
                <StatList boards={boards} filter={statFilter.key} label={statFilter.label}
                  onOpenTask={setOpenTask} onBack={() => setStatFilter(null)} />
              ) : (
                <OverviewView boards={boards} onOpenBoard={openBoard} onOpenTask={setOpenTask}
                  onStat={(key, label) => setStatFilter({ key, label })} />
              )}
            </>
          ) : view === 'mywork' ? (
            <>
              <header className="topbar">
                <div className="topbar-l"><h1 className="page-title"><Icon name="inbox" size={22} /> My Work</h1></div>
              </header>
              <MyWork boards={boards} onOpen={setOpenTask} onDelete={deleteAnyTask} />
            </>
          ) : view === 'settings' ? (
            <>
              <header className="topbar">
                <div className="topbar-l"><h1 className="page-title"><Icon name="settings" size={20} /> Settings</h1></div>
              </header>
              <SettingsView profile={profile} setProfile={setProfile}
                accentKey={t.accent} sidebar={t.sidebar} density={t.density} setTweak={setTweak} accents={ACCENTS}
                prefs={prefs} setPrefs={setPrefs} onReset={resetWorkspace} onToast={(m) => { setToast(m); setTimeout(() => setToast(null), 2800); }} />
            </>
          ) : (
            <>
              <header className="topbar">
                <div className="topbar-l">
                  <h1 className="page-title">
                    <Icon name={board.icon} size={20} />
                    <input className="page-title-input" value={board.name}
                      onChange={(e) => renameSpace(activeId, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => { if (!e.target.value.trim()) renameSpace(activeId, 'Untitled'); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
                      aria-label="Space name" />
                  </h1>
                </div>
                <div className="view-switch">
                  <button className={spaceView === 'table' ? 'on' : ''} onClick={() => setSpaceView('table')}><Icon name="table" size={16} /> Table</button>
                  <button className={spaceView === 'calendar' ? 'on' : ''} onClick={() => setSpaceView('calendar')}><Icon name="calendar" size={16} /> Calendar</button>
                </div>
                <div className="topbar-r">
                  {spaceView === 'table' && <SortControl sort={sort} setSort={setSort} />}
                  <button className={`share-btn ${meetingOpen ? 'share-btn-active' : ''}`} onClick={() => { if (meetingOpen) setMeetingMinimized(false); else setMeetingOpen(true); }} title="Meeting notes">
                    {meetingOpen && meetingMinimized ? <span className="mtg-rec-dot on" style={{marginRight:2}} /> : <Icon name="mic" size={16} />}
                    {' '}Meeting notes
                  </button>
                  <button className="share-btn" onClick={() => setShareModal({ scope: 'space', targetId: activeId })} title="Share this space">
                    <Icon name="share" size={16} /> Share
                  </button>
                  <div className={`search-box ${searchOpen || search ? 'open' : ''}`}>
                    <button className="icon-btn search-toggle" aria-label="Search"
                      onClick={() => setSearchOpen((o) => { const n = !o || !!search; if (o && !search) return false; return true; })}>
                      <Icon name="search" size={18} />
                    </button>
                    <input className="search-input" placeholder="Search tasks…" value={search}
                      onChange={(e) => setSearch(e.target.value)} onFocus={() => setSearchOpen(true)}
                      onBlur={() => { if (!search) setSearchOpen(false); }}
                      onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); setSearchOpen(false); e.target.blur(); } }} />
                    {search && (
                      <button className="search-clear" aria-label="Clear" onClick={() => { setSearch(''); setSearchOpen(false); }}>
                        <Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} />
                      </button>
                    )}
                  </div>
                  <NewMenu onNewTask={handleNewTask} onImport={() => setImportOpen(true)} onRecord={() => { if (meetingOpen) setMeetingMinimized(false); else setMeetingOpen(true); }} />
                </div>
              </header>
              {spaceView === 'table' ? <BoardView board={board} dispatch={dispatch} search={search} onOpenTask={setOpenTask} sort={sort}
                boards={boards} onShare={(id) => setShareModal({ scope: 'task', targetId: id })} onMoveTo={moveTask} /> : <CalendarView board={board} onAddTask={(date, title) => dispatch({ type: 'addOnDate', date, title })} onOpenTask={setOpenTask} {...holidayApi} />}
            </>
          )}
        </main>
      </div>

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImport={handleImport} />}
      {meetingOpen && <MeetingRecorder
        layout={t.meetingLayout}
        minimized={meetingMinimized}
        onMinimize={() => setMeetingMinimized(true)}
        onClose={() => { setMeetingOpen(false); setMeetingMinimized(false); }}
        onUpdate={(snap) => setMeetingSnap(snap)}
        onSave={saveMeeting}
      />}
      {meetingOpen && meetingMinimized && (
        <div className="mtg-pill" onClick={() => setMeetingMinimized(false)}>
          <span className={`mtg-pill-dot ${meetingSnap.recording ? 'on' : ''}`} />
          <span className="mtg-pill-title">{meetingSnap.title || 'Meeting'}</span>
          <span className="mtg-pill-timer">{String(Math.floor(meetingSnap.elapsed / 60)).padStart(2,'0')}:{String(meetingSnap.elapsed % 60).padStart(2,'0')}</span>
          <span className="mtg-pill-lang">{(window.LANGS && window.LANGS[meetingSnap.lang]) ? window.LANGS[meetingSnap.lang].native : ''}</span>
          <button className="mtg-pill-x" onClick={(e) => { e.stopPropagation(); setMeetingOpen(false); setMeetingMinimized(false); }} aria-label="End meeting"><Icon name="plus" size={14} style={{ transform: 'rotate(45deg)' }} /></button>
        </div>
      )}
      {shareModal && <ShareModal scope={shareModal.scope} targetId={shareModal.targetId}
        boards={boards} workspaceName={brand.name} shares={shares} onUpdateShare={updateShare}
        onClose={() => setShareModal(null)} />}
      {openItem && <TaskPanel key={openItem.id} item={openItem} boardName={boards[openBoardId].name} groupName={openGroup.name}
        boards={boards} currentBoardId={openBoardId} currentGroupId={openGroup.id} onMove={moveTask}
        onShare={() => setShareModal({ scope: 'task', targetId: openItem.id })}
        dispatch={dispatchTo(openBoardId)} onClose={() => setOpenTask(null)} />}
      {toast && <div className="toast"><Icon name="check" size={16} stroke={3} /> {toast}</div>}

      <TweaksPanel>
        <TweakSection label="Visual direction" />
        <TweakColor label="Accent" value={ac.accent}
          options={[ACCENTS.indigo.accent, ACCENTS.forest.accent, ACCENTS.coral.accent]}
          onChange={(hex) => {
            const key = Object.keys(ACCENTS).find((k) => ACCENTS[k].accent === hex) || 'indigo';
            setTweak('accent', key);
          }} />
        <TweakRadio label="Sidebar" value={t.sidebar} options={['light', 'dark']}
          onChange={(v) => setTweak('sidebar', v)} />
        <TweakRadio label="Density" value={t.density} options={['comfortable', 'compact']}
          onChange={(v) => setTweak('density', v)} />
        <TweakSection label="Meeting notes" />
        <TweakRadio label="Notes layout" value={t.meetingLayout} options={['stacked', 'columns', 'cards']}
          onChange={(v) => setTweak('meetingLayout', v)} />
      </TweaksPanel>
    </div>
    </OwnerAdminContext.Provider>
    </StatusAdminContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
