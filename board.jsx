// board.jsx — column-driven Table view: dynamic columns, drag reorder, add/remove. Attaches to window.
const { useState, useRef, useEffect, useLayoutEffect } = React;

// ---- right-click context menu, positioned at the cursor (flips to stay on-screen) ----
function RowContextMenu({ point, onClose, children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: point.y, left: point.x });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = Math.min(point.x, vw - w - 8);
    let top = Math.min(point.y, vh - h - 8);
    setPos({ top: Math.max(8, top), left: Math.max(8, left) });
  }, [point]);
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('contextmenu', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('contextmenu', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  return <div ref={ref} className="popmenu" style={{ top: pos.top, left: pos.left, minWidth: 200 }} onClick={(e) => e.stopPropagation()}>{children}</div>;
}

// ---- the panes shown inside a task row's right-click menu ----
function RowContextMenuContent({ item, boards, currentBoardId, onRename, onDelete, onShare, onMoveTo, dispatch, onClose }) {
  const [pane, setPane] = useState('root'); // root | color | move
  const otherBoards = Object.values(boards || {}).filter((b) => b.id !== currentBoardId);

  if (pane === 'color') {
    return (
      <>
        <button className="status-opt" onClick={() => setPane('root')}><Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} /> Back</button>
        <div className="menu-divider" />
        {MATRIX_ORDER.map((mid) => (
          <button key={mid} className={`status-opt ${item.priority === mid ? 'on' : ''}`}
            onClick={() => { dispatch({ type: 'setPriority', id: item.id, priority: mid }); onClose(); }}>
            <span className="status-opt-dot" style={{ background: MATRIX[mid].color }} />
            {MATRIX[mid].label}
            {item.priority === mid && <Icon name="check" size={14} stroke={3} style={{ marginLeft: 'auto' }} />}
          </button>
        ))}
      </>
    );
  }
  if (pane === 'move') {
    return (
      <>
        <button className="status-opt" onClick={() => setPane('root')}><Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} /> Back</button>
        <div className="menu-divider" />
        {otherBoards.length === 0 ? <div className="lab-empty" style={{ padding: '8px 9px' }}>No other spaces</div> : otherBoards.map((b) => (
          <button key={b.id} className="status-opt" onClick={() => { onMoveTo(item.id, currentBoardId, b.id, (b.groups[0] || {}).id); onClose(); }}>
            <Icon name={b.icon} size={14} /> {b.name}
          </button>
        ))}
      </>
    );
  }
  return (
    <>
      <button className="status-opt" onClick={() => { onRename(); onClose(); }}><Icon name="pen" size={14} /> Rename</button>
      <button className="status-opt" onClick={() => setPane('color')}>
        <Icon name="flag" size={14} /> Change color
        <Icon name="chevron" size={13} style={{ marginLeft: 'auto', opacity: .6 }} />
      </button>
      <button className="status-opt" onClick={() => setPane('move')}>
        <Icon name="grid" size={14} /> Move to…
        <Icon name="chevron" size={13} style={{ marginLeft: 'auto', opacity: .6 }} />
      </button>
      {onShare && <button className="status-opt" onClick={() => { onShare(item.id); onClose(); }}><Icon name="share" size={14} /> Share</button>}
      <div className="menu-divider" />
      <button className="status-opt danger" onClick={() => { onDelete(); onClose(); }}><Icon name="trash" size={14} /> Delete</button>
    </>
  );
}

function sortItems(items, sort) {
  if (!sort || sort === 'manual') {
    // default order: keep manual order, but auto-sink "stuck" tasks to the bottom
    const rest = items.filter((i) => i.status !== 'stuck');
    const stuck = items.filter((i) => i.status === 'stuck');
    return [...rest, ...stuck];
  }
  const arr = [...items];
  if (sort === 'status') {const r = { stuck: 0, working: 1, notStarted: 2, done: 3 };arr.sort((a, b) => r[a.status] - r[b.status]);} else
  if (sort === 'priority') {const r = { doNow: 0, schedule: 1, delegate: 2, dismiss: 3 };arr.sort((a, b) => (r[a.priority] ?? 9) - (r[b.priority] ?? 9));} else
  if (sort === 'date') {arr.sort((a, b) => {if (!a.due && !b.due) return 0;if (!a.due) return 1;if (!b.due) return -1;return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;});}
  return arr;
}

// ---- per-column header: drag handle, label, menu, resize ----
function ColumnHead({ col, index, columns, dispatch, onResize, drag }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(col.label);
  const menuRef = useRef(null);
  const pinned = col.type === 'task';
  const movableStart = 1; // index 0 (task) is pinned
  const last = columns.length - 1;

  const commitName = () => { setRenaming(false); const v = name.trim(); if (v && v !== col.label) dispatch({ type: 'renameColumn', colId: col.id, label: v }); else setName(col.label); };

  return (
    <div
      className={`cell muted-head col-head ${pinned ? 'pinned' : ''} ${drag.dragId === col.id ? 'dragging' : ''} ${drag.overId === col.id ? 'drop-' + drag.overSide : ''}`}
      data-coltype={col.type}
      draggable={!pinned && !renaming}
      onDragStart={(e) => { if (pinned) return; drag.onStart(col.id, index, e); }}
      onDragOver={(e) => drag.onOver(col.id, index, pinned, e)}
      onDrop={(e) => drag.onDrop(index, e)}
      onDragEnd={drag.onEnd}
    >
      {!pinned && <span className="col-grip"><Icon name="grip" size={13} /></span>}
      {renaming ? (
        <input className="col-rename-input" autoFocus value={name}
          onChange={(e) => setName(e.target.value)} onBlur={commitName}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setName(col.label); setRenaming(false); } }} />
      ) : (
        <span className="col-head-label" onDoubleClick={() => { if (!pinned) { setName(col.label); setRenaming(true); } }}>{col.label}</span>
      )}
      {!pinned && (
        <button ref={menuRef} className="col-menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Column options">
          <Icon name="chevronDown" size={13} />
        </button>
      )}
      {menuOpen && (
        <PopMenu anchorRef={menuRef} align="right" width={184} onClose={() => setMenuOpen(false)}>
          <button className="status-opt" disabled={index <= movableStart} onClick={() => { dispatch({ type: 'moveColumn', colId: col.id, to: index - 1 }); setMenuOpen(false); }}>
            <Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} /> Move left
          </button>
          <button className="status-opt" disabled={index >= last} onClick={() => { dispatch({ type: 'moveColumn', colId: col.id, to: index + 1 }); setMenuOpen(false); }}>
            <Icon name="chevron" size={14} /> Move right
          </button>
          <button className="status-opt" onClick={() => { setMenuOpen(false); setName(col.label); setRenaming(true); }}>
            <Icon name="pen" size={14} /> Rename
          </button>
          <div className="menu-divider" />
          <button className="status-opt danger" onClick={() => { dispatch({ type: 'removeColumn', colId: col.id }); setMenuOpen(false); }}>
            <Icon name="trash" size={14} /> Delete column
          </button>
        </PopMenu>
      )}
      <span className="col-resize" draggable={false} onMouseDown={(e) => onResize(col.id, e)} />
    </div>
  );
}

function AddColumnButton({ dispatch }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  return (
    <div className="col-add-cell">
      <button ref={btnRef} className="add-col-btn" onClick={() => setOpen((o) => !o)} title="Add column"><Icon name="plus" size={16} /></button>
      {open && (
        <PopMenu anchorRef={btnRef} align="right" width={232} onClose={() => setOpen(false)}>
          <div className="addcol-label">Add column</div>
          {COLUMN_TYPES.map((t) => (
            <button key={t.type} className="addcol-opt" onClick={() => { dispatch({ type: 'addColumn', colType: t.type, label: t.label }); setOpen(false); }}>
              <span className="addcol-icon"><Icon name={t.icon} size={16} /></span>
              <span className="addcol-text"><b>{t.label}</b><i>{t.desc}</i></span>
            </button>
          ))}
        </PopMenu>
      )}
    </div>
  );
}

function TableHead({ columns, dispatch, onResize }) {
  const [drag, setDrag] = useState({ dragId: null, fromIndex: -1, overId: null, overSide: 'before' });

  const onStart = (id, index, e) => {
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch (err) {}
    setDrag({ dragId: id, fromIndex: index, overId: null, overSide: 'before' });
  };
  const onOver = (id, index, pinned, e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const r = e.currentTarget.getBoundingClientRect();
    let side = (e.clientX - r.left) > r.width / 2 ? 'after' : 'before';
    if (pinned) side = 'after'; // can't drop before the pinned Task column
    setDrag((d) => (d.overId === id && d.overSide === side ? d : { ...d, overId: id, overSide: side }));
  };
  const onDrop = (index, e) => {
    e.preventDefault();
    setDrag((d) => {
      if (d.dragId == null) return d;
      let to = d.overSide === 'after' ? index + 1 : index;
      if (d.fromIndex < to) to -= 1;
      to = Math.max(1, to);
      if (to !== d.fromIndex) dispatch({ type: 'moveColumn', colId: d.dragId, to });
      return { dragId: null, fromIndex: -1, overId: null, overSide: 'before' };
    });
  };
  const onEnd = () => setDrag({ dragId: null, fromIndex: -1, overId: null, overSide: 'before' });

  return (
    <div className="row head-row">
      <span className="check-spacer" />
      {columns.map((col, i) => (
        <ColumnHead key={col.id} col={col} index={i} columns={columns} dispatch={dispatch} onResize={onResize}
          drag={{ ...drag, onStart, onOver, onDrop, onEnd }} />
      ))}
      <AddColumnButton dispatch={dispatch} />
    </div>
  );
}

function TaskRow({ item, columns, onToggleDone, onDelete, onRename, onSetDate, onOpen, dispatch, boards, currentBoardId, onShare, onMoveTo }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.title);
  const [expanded, setExpanded] = useState(false);
  const [newSub, setNewSub] = useState('');
  const [editSub, setEditSub] = useState(null);
  const [subVal, setSubVal] = useState('');
  const [ctxPoint, setCtxPoint] = useState(null);
  const inputRef = useRef(null);
  const addSubInputRef = useRef(null);
  useEffect(() => {if (editing && inputRef.current) inputRef.current.select();}, [editing]);

  const commit = () => {setEditing(false);if (val.trim()) onRename(val.trim());else setVal(item.title);};
  const commitSub = (sid) => { setEditSub(null); const v = subVal.trim(); if (v) dispatch({ type: 'renameSubtask', id: item.id, subId: sid, title: v }); };
  const subs = item.subtasks || [];
  const subDone = subs.filter((s) => s.done).length;
  const addSub = () => { if (newSub.trim()) dispatch({ type: 'addSubtask', id: item.id, title: newSub.trim() }); setNewSub(''); };
  const quickAddSub = (e) => {
    e.stopPropagation();
    setExpanded(true);
    requestAnimationFrame(() => addSubInputRef.current && addSubInputRef.current.focus());
  };

  const taskCell = (
    <div className="cell title-cell" key="task">
      {editing ?
        <input ref={inputRef} className="title-input" value={val}
          onChange={(e) => setVal(e.target.value)} onBlur={commit}
          onKeyDown={(e) => {if (e.key === 'Enter') commit();if (e.key === 'Escape') {setVal(item.title);setEditing(false);}}} /> :
        <>
          <span className={`title-text ${item.title === 'New task' ? 'is-placeholder' : ''}`} onClick={onOpen} onDoubleClick={() => setEditing(true)} title="Click to open · double-click to rename">{item.title}</span>
          {subs.length > 0 &&
            <button className={`sub-badge ${expanded ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }} title="Subtasks">
              <Icon name="subtask" size={12} /> {subDone}/{subs.length}
            </button>}
          <button className="sub-add-btn" onClick={quickAddSub} title="Add subtask" aria-label="Add subtask">
            <Icon name="plus" size={15} />
          </button>
        </>}
    </div>
  );

  const onContextMenu = (e) => {
    const tag = (e.target.tagName || '').toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return; // let native text menu through
    e.preventDefault();
    setCtxPoint({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div className={`row ${item.done ? 'is-done' : ''}`} onContextMenu={onContextMenu}>
        <button className={`check ${item.done ? 'on' : ''}`} onClick={onToggleDone} aria-label="Toggle done">
          {item.done && <Icon name="check" size={13} stroke={3} />}
        </button>
        {columns.map((col) => col.type === 'task' ? taskCell : (
          <div className="cell" data-coltype={col.type} key={col.id}>{renderCell(col, item, dispatch, onSetDate)}</div>
        ))}
        <button className="row-del" onClick={onDelete} aria-label="Delete"><Icon name="trash" size={15} /></button>
      </div>
      {ctxPoint && (
        <RowContextMenu point={ctxPoint} onClose={() => setCtxPoint(null)}>
          <RowContextMenuContent item={item} boards={boards} currentBoardId={currentBoardId}
            onRename={() => setEditing(true)} onDelete={onDelete} onShare={onShare} onMoveTo={onMoveTo}
            dispatch={dispatch} onClose={() => setCtxPoint(null)} />
        </RowContextMenu>
      )}
      {expanded &&
        <div className="subrow-wrap">
          {subs.map((s) =>
            <div key={s.id} className={`row subrow ${s.done ? 'done' : ''}`}>
              <button className={`check sub-check ${s.done ? 'on' : ''}`} onClick={() => dispatch({ type: 'toggleSubtask', id: item.id, subId: s.id })} aria-label="Toggle subtask">
                {s.done && <Icon name="check" size={11} stroke={3} />}
              </button>
              {columns.map((col) => {
                if (col.type === 'task') return (
                  <div className="cell title-cell subrow-title-cell" key={col.id}>
                    <span className="subrow-elbow" />
                    {editSub === s.id ? (
                      <input className="subrow-edit-input" autoFocus value={subVal}
                        onChange={(e) => setSubVal(e.target.value)} onBlur={() => commitSub(s.id)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitSub(s.id); if (e.key === 'Escape') setEditSub(null); }} />
                    ) : (
                      <span className="subrow-title" onDoubleClick={() => { setSubVal(s.title); setEditSub(s.id); }} title="Double-click to rename">{s.title}</span>
                    )}
                  </div>
                );
                if (col.type === 'status') return (
                  <div className="cell" key={col.id}><span className={`sub-state ${s.done ? 'done' : ''}`}>{s.done ? 'Done' : 'To do'}</span></div>
                );
                return <div className="cell" key={col.id} />;
              })}
              <button className="row-del" onClick={() => dispatch({ type: 'deleteSubtask', id: item.id, subId: s.id })} aria-label="Delete"><Icon name="trash" size={14} /></button>
            </div>
          )}
          <div className="row subrow add-subrow">
            <span className="check-spacer" />
            <div className="cell title-cell subrow-title-cell">
              <span className="subrow-elbow" />
              <Icon name="plus" size={13} style={{ color: 'var(--muted)', flex: '0 0 auto' }} />
              <input ref={addSubInputRef} className="subrow-add-input" placeholder="Add subtask…" value={newSub}
                onChange={(e) => setNewSub(e.target.value)} onBlur={addSub}
                onKeyDown={(e) => {if (e.key === 'Enter') addSub();if (e.key === 'Escape') setNewSub('');}} />
            </div>
          </div>
        </div>}
    </>
  );
}

function Group({ group, columns, dispatch, onOpenTask, onResize, boards, currentBoardId, onShare, onMoveTo }) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const menuRef = useRef(null);
  const addRef = useRef(null);
  useEffect(() => {if (adding && addRef.current) addRef.current.focus();}, [adding]);

  const counts = STATUS_ORDER.map((s) => ({ s, n: group.items.filter((i) => i.status === s).length })).filter((c) => c.n > 0);
  const total = group.items.length;

  const commitAdd = () => { if (newTitle.trim()) dispatch({ type: 'add', groupId: group.id, title: newTitle.trim() }); setNewTitle('');setAdding(false); };
  const commitName = () => { setRenaming(false); const v = name.trim(); if (v && v !== group.name) dispatch({ type: 'renameGroup', groupId: group.id, name: v }); else setName(group.name); };
  const addDetailed = () => {
    const it = task('New task', 'you', 'notStarted', null, 'schedule');
    dispatch({ type: 'addFull', groupId: group.id, item: it });
    onOpenTask(it.id);
  };

  return (
    <div className="group">
      <div className="group-head">
        <button className="group-toggle" onClick={() => setOpen(!open)} style={{ color: group.color }}>
          <Icon name="chevronDown" size={18} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
        </button>
        {renaming ? (
          <input className="group-name-input" autoFocus value={name} style={{ color: group.color }}
            onChange={(e) => setName(e.target.value)} onBlur={commitName}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setName(group.name); setRenaming(false); } }} />
        ) : (
          <span className="group-name" style={{ color: group.color }} onClick={() => setRenaming(true)} title="Rename section">{group.name}</span>
        )}
        <span className="group-count">{total} {total === 1 ? 'item' : 'items'}</span>
        <div className="group-bar">
          {counts.map((c) => <span key={c.s} style={{ flex: c.n, background: STATUS[c.s].color }} title={`${STATUS[c.s].label}: ${c.n}`} />)}
        </div>
        <button ref={menuRef} className="group-menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Section options">
          <Icon name="dots" size={16} />
        </button>
        {menuOpen && (
          <PopMenu anchorRef={menuRef} align="right" width={188} onClose={() => { setMenuOpen(false); setConfirmDel(false); }}>
            {!confirmDel ? (
              <>
                <button className="status-opt" onClick={() => { setMenuOpen(false); setName(group.name); setRenaming(true); }}>
                  <Icon name="pen" size={14} /> Rename section
                </button>
                <div className="menu-divider" />
                <button className="status-opt danger" onClick={() => setConfirmDel(true)}>
                  <Icon name="trash" size={14} /> Delete section
                </button>
              </>
            ) : (
              <div className="group-del-confirm">
                <div className="group-del-text">Delete “{group.name}”{total > 0 ? ` and its ${total} task${total === 1 ? '' : 's'}` : ''}?</div>
                <div className="group-del-actions">
                  <button className="group-del-cancel" onClick={() => setConfirmDel(false)}>Cancel</button>
                  <button className="group-del-yes" onClick={() => { dispatch({ type: 'deleteGroup', groupId: group.id }); }}>Delete</button>
                </div>
              </div>
            )}
          </PopMenu>
        )}
      </div>
      {open &&
        <div className="group-body" style={{ borderLeftColor: group.color, '--grid-cols': gridFor(columns) }}>
          <TableHead columns={columns} dispatch={dispatch} onResize={onResize} />
          {group.items.map((item) =>
            <TaskRow key={item.id} item={item} columns={columns}
              onToggleDone={() => dispatch({ type: 'toggleDone', id: item.id })}
              onDelete={() => dispatch({ type: 'delete', id: item.id })}
              onRename={(t) => dispatch({ type: 'rename', id: item.id, title: t })}
              onSetDate={(due, dueEnd, time) => dispatch({ type: 'setDate', id: item.id, due, dueEnd, time })}
              onOpen={() => onOpenTask(item.id)} dispatch={dispatch}
              boards={boards} currentBoardId={currentBoardId} onShare={onShare} onMoveTo={onMoveTo} />
          )}
          {adding ?
            <div className="row add-row">
              <span className="check-spacer" />
              <input ref={addRef} className="title-input" placeholder="Task name…" value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)} onBlur={commitAdd}
                onKeyDown={(e) => {if (e.key === 'Enter') commitAdd();if (e.key === 'Escape') {setNewTitle('');setAdding(false);}}} />
            </div> :
            <div className="add-task-row">
              <button className="add-task" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> Add task</button>
              <button className="add-task-detail" onClick={addDetailed} title="Add task with full details">
                <Icon name="expand" size={13} /> Detailed
              </button>
            </div>}
        </div>}
    </div>
  );
}

// gridFor is supplied by BoardView via a module-level setter so Group can read live widths
let _liveWidths = null;
function gridFor(columns) {
  const tracks = columns.map((c) => `${(_liveWidths && _liveWidths.id === c.id) ? _liveWidths.w : c.width}px`);
  return `30px ${tracks.join(' ')} minmax(46px,1fr)`;
}

function BoardView({ board, dispatch, search, onOpenTask, sort, boards, onShare, onMoveTo }) {
  const columns = board.columns || [];
  const [live, setLive] = useState(null);
  _liveWidths = live;

  const onResize = (colId, e) => {
    e.preventDefault(); e.stopPropagation();
    const col = columns.find((c) => c.id === colId);
    if (!col) return;
    const startX = e.clientX, startW = col.width;
    const min = colId === 'task' ? 150 : 72, max = 720;
    const calc = (ev) => Math.min(max, Math.max(min, startW + (ev.clientX - startX)));
    const move = (ev) => setLive({ id: colId, w: calc(ev) });
    const up = (ev) => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.classList.remove('col-resizing');
      const w = calc(ev);
      setLive(null);
      dispatch({ type: 'resizeColumn', colId, width: w });
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.body.classList.add('col-resizing');
  };

  const q = (search || '').trim().toLowerCase();
  let groups = q ?
    board.groups.map((g) => ({ ...g, items: g.items.filter((i) => i.title.toLowerCase().includes(q)) })).filter((g) => g.items.length > 0) :
    board.groups;
  groups = groups.map((g) => ({ ...g, items: sortItems(g.items, sort) }));

  return (
    <div className="board-scroll">
      {q && groups.length === 0 ?
        <div className="board-noresult"><Icon name="search" size={22} /><span>No tasks match “{search.trim()}”.</span></div> :
        groups.map((g) => <Group key={g.id} group={g} columns={columns} dispatch={dispatch} onOpenTask={onOpenTask} onResize={onResize}
          boards={boards} currentBoardId={board.id} onShare={onShare} onMoveTo={onMoveTo} />)}
      {!q &&
        <button className="add-section" onClick={() => dispatch({ type: 'addGroup' })}><Icon name="plus" size={15} /> Add section</button>}
    </div>
  );
}

Object.assign(window, { BoardView });
