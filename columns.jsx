// columns.jsx — column registry + per-type cell editors + shared popmenu/selects. Attaches to window.
const { useState: useColState, useRef: useColRef, useEffect: useColEffect, useLayoutEffect: useColLayout } = React;

const LABEL_COLORS = ['#5b5bd6', '#1fb5a3', '#e8743a', '#e0524a', '#3a72d4', '#9333ea', '#0891b2', '#65a30d'];

// columns available to add, in the order requested
const COLUMN_TYPES = [
  { type: 'comments', label: 'Comments', icon: 'chat', desc: 'Threaded notes' },
  { type: 'date',     label: 'Date',     icon: 'calendar', desc: 'A single date' },
  { type: 'website',  label: 'Website',  icon: 'globe', desc: 'A clickable link' },
  { type: 'labels',   label: 'Labels',   icon: 'tag', desc: 'Colored tags' },
  { type: 'text',     label: 'Custom text', icon: 'text', desc: 'Free editing field' },
];
const COLUMN_DEFAULT_WIDTH = { task: 260, owner: 112, status: 174, due: 172, matrix: 155, comments: 130, date: 152, website: 192, labels: 200, text: 180 };

// ---- shared fixed-position popmenu (escapes table clipping, flips up near edges) ----
function PopMenu({ anchorRef, align, width, onClose, children }) {
  const ref = useColRef(null);
  const [pos, setPos] = useColState({ top: -9999, left: -9999 });
  useColLayout(() => {
    if (!anchorRef.current) return;
    const a = anchorRef.current.getBoundingClientRect();
    const h = ref.current ? ref.current.offsetHeight : 200;
    const w = ref.current ? ref.current.offsetWidth : (width || 200);
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = align === 'right' ? a.right - w : a.left;
    left = Math.max(8, Math.min(left, vw - w - 8));
    let top = a.bottom + 5;
    if (top + h > vh - 8) top = Math.max(8, a.top - h - 5);
    top = Math.max(8, Math.min(top, vh - h - 8));
    setPos({ top, left });
  }, []);
  useColEffect(() => {
    const onDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (anchorRef.current && anchorRef.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);
  return <div ref={ref} className="popmenu" style={{ top: pos.top, left: pos.left, minWidth: width }}>{children}</div>;
}

// ---- built-in cell editors ----
// ---- shared name + color composer (used for statuses and owners) ----
function PaletteComposer({ placeholder, initial, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useColState(initial ? initial.label : '');
  const [color, setColor] = useColState(initial ? initial.color : LABEL_COLORS[0]);
  const go = () => { const v = name.trim(); if (!v) return; onSubmit(v, color); };
  return (
    <div className="pal-composer" onClick={(e) => e.stopPropagation()}>
      <input className="pal-comp-input" autoFocus placeholder={placeholder || 'Name\u2026'} value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape' && onCancel) onCancel(); }} />
      <div className="pal-comp-swatches">
        {LABEL_COLORS.map((c) => (
          <button key={c} className={`pal-comp-sw ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c}>
            {color === c && <Icon name="check" size={11} stroke={3} />}
          </button>
        ))}
      </div>
      <div className="pal-comp-actions">
        {onCancel && <button className="pal-comp-cancel" onClick={onCancel}>Cancel</button>}
        <button className="pal-comp-add" disabled={!name.trim()} onClick={go}>{submitLabel || 'Add'}</button>
      </div>
    </div>
  );
}

function StatusSelect({ status, onSelect }) {
  const [open, setOpen] = useColState(false);
  const [editId, setEditId] = useColState(null);
  const [adding, setAdding] = useColState(false);
  const btnRef = useColRef(null);
  const { addStatus, updateStatus, removeStatus } = useStatusAdmin();
  const s = STATUS[status] || STATUS[STATUS_ORDER[0]] || { label: '\u2014', color: '#c3c8d4' };
  return (
    <div className="status-select">
      <button ref={btnRef} className="status-pill" onClick={() => setOpen((o) => !o)} style={{ background: s.color }}>
        {s.label}
        <Icon name="chevronDown" size={13} style={{ marginLeft: 'auto', opacity: .85 }} />
      </button>
      {open && (
        <PopMenu anchorRef={btnRef} align="left" width={208} onClose={() => { setOpen(false); setEditId(null); setAdding(false); }}>
          {STATUS_ORDER.map((sid) => {
            const st = STATUS[sid]; if (!st) return null;
            const custom = !DEFAULT_STATUS_IDS.includes(sid);
            if (editId === sid) return (
              <PaletteComposer key={sid} initial={{ label: st.label, color: st.color }} submitLabel="Save"
                onSubmit={(n, c) => { updateStatus(sid, { label: n, color: c }); setEditId(null); }} onCancel={() => setEditId(null)} />
            );
            return (
              <div key={sid} className="status-opt-row">
                <button className={`status-opt ${status === sid ? 'on' : ''}`} onClick={() => { onSelect(sid); setOpen(false); }}>
                  <span className="status-opt-dot" style={{ background: st.color }} />
                  {st.label}
                  {status === sid && <Icon name="check" size={14} stroke={3} style={{ marginLeft: 'auto' }} />}
                </button>
                {addStatus && (
                  <span className="status-opt-actions">
                    <button className="status-opt-act" onClick={() => setEditId(sid)} title="Edit status"><Icon name="pen" size={12} /></button>
                    {custom && <button className="status-opt-act del" onClick={() => removeStatus(sid)} title="Delete status"><Icon name="trash" size={12} /></button>}
                  </span>
                )}
              </div>
            );
          })}
          {addStatus && <div className="menu-divider" />}
          {addStatus && (adding ? (
            <PaletteComposer placeholder="Status name\u2026" submitLabel="Add status"
              onSubmit={(n, c) => { const id = addStatus(n, c); onSelect(id); setAdding(false); setOpen(false); }} onCancel={() => setAdding(false)} />
          ) : (
            <button className="status-opt addnew" onClick={() => setAdding(true)}><Icon name="plus" size={14} /> New status</button>
          ))}
        </PopMenu>
      )}
    </div>
  );
}

function MatrixSelect({ priority, onSelect }) {
  const [open, setOpen] = useColState(false);
  const btnRef = useColRef(null);
  const q = MATRIX[priority] || MATRIX.dismiss;
  return (
    <div className="status-select">
      <button ref={btnRef} className="prio-tag" onClick={() => setOpen((o) => !o)} style={{ color: q.color }} title={q.short}>
        <span className="prio-dot" style={{ background: q.color }} />
        {q.label}
        <Icon name="chevronDown" size={13} style={{ marginLeft: 'auto', opacity: .7 }} />
      </button>
      {open && (
        <PopMenu anchorRef={btnRef} align="right" width={228} onClose={() => setOpen(false)}>
          {MATRIX_ORDER.map((mid) => (
            <button key={mid} className={`status-opt ${priority === mid ? 'on' : ''}`} onClick={() => { onSelect(mid); setOpen(false); }}>
              <span className="status-opt-dot" style={{ background: MATRIX[mid].color }} />
              <span className="matrix-opt-text"><b>{MATRIX[mid].label}</b><i>{MATRIX[mid].short}</i></span>
              {priority === mid && <Icon name="check" size={14} stroke={3} style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </PopMenu>
      )}
    </div>
  );
}

function OwnerSelect({ ownerId, onSelect }) {
  const [open, setOpen] = useColState(false);
  const [editId, setEditId] = useColState(null);
  const [adding, setAdding] = useColState(false);
  const btnRef = useColRef(null);
  const { addOwner, updateOwner, removeOwner } = useOwnerAdmin();
  return (
    <div className="status-select owner-select">
      <button ref={btnRef} className="owner-btn" onClick={() => setOpen((o) => !o)}>
        <Avatar ownerId={ownerId} size={26} />
      </button>
      {open && (
        <PopMenu anchorRef={btnRef} align="left" width={208} onClose={() => { setOpen(false); setEditId(null); setAdding(false); }}>
          {Object.values(OWNERS).map((o) => {
            if (editId === o.id) return (
              <PaletteComposer key={o.id} initial={{ label: o.name, color: o.color }} submitLabel="Save" placeholder="Name\u2026"
                onSubmit={(n, c) => { updateOwner(o.id, { name: n, color: c }); setEditId(null); }} onCancel={() => setEditId(null)} />
            );
            const custom = o.id !== 'you';
            return (
              <div key={o.id} className="status-opt-row">
                <button className={`status-opt ${ownerId === o.id ? 'on' : ''}`} onClick={() => { onSelect(o.id); setOpen(false); }}>
                  <Avatar ownerId={o.id} size={22} /> {o.name}
                  {ownerId === o.id && <Icon name="check" size={14} stroke={3} style={{ marginLeft: 'auto' }} />}
                </button>
                {addOwner && (
                  <span className="status-opt-actions">
                    <button className="status-opt-act" onClick={() => setEditId(o.id)} title="Edit person"><Icon name="pen" size={12} /></button>
                    {custom && <button className="status-opt-act del" onClick={() => removeOwner(o.id)} title="Remove person"><Icon name="trash" size={12} /></button>}
                  </span>
                )}
              </div>
            );
          })}
          <button className={`status-opt ${!ownerId ? 'on' : ''}`} onClick={() => { onSelect(null); setOpen(false); }}>
            <Avatar ownerId={null} size={22} /> Unassigned
          </button>
          {addOwner && <div className="menu-divider" />}
          {addOwner && (adding ? (
            <PaletteComposer placeholder="Name\u2026" submitLabel="Add person"
              onSubmit={(n, c) => { const id = addOwner(n, c); onSelect(id); setAdding(false); setOpen(false); }} onCancel={() => setAdding(false)} />
          ) : (
            <button className="status-opt addnew" onClick={() => setAdding(true)}><Icon name="plus" size={14} /> Add person</button>
          ))}
        </PopMenu>
      )}
    </div>
  );
}

function DueCell({ item, onChange }) {
  const [open, setOpen] = useColState(false);
  const [rect, setRect] = useColState(null);
  const btnRef = useColRef(null);
  const label = dueLabel(item);
  const toggle = () => {
    if (open) { setOpen(false); return; }
    setRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  };
  return (
    <>
      <button ref={btnRef} className={`due ${label ? label.tone : 'empty'}`} onClick={toggle}>
        <Icon name="calendar" size={13} stroke={2} />
        {label ? label.text : <span className="due-add">Set date</span>}
      </button>
      {open && rect &&
        <DatePopover item={item} anchorRect={rect} anchorEl={btnRef.current} onChange={onChange} onClose={() => setOpen(false)} />}
    </>
  );
}

// ---- custom field cell editors (values stored in item.fields[colId]) ----
function DateFieldCell({ value, onChange }) {
  const [open, setOpen] = useColState(false);
  const [rect, setRect] = useColState(null);
  const btnRef = useColRef(null);
  // value is { due, dueEnd, time } or null
  const v = value || {};
  const fakeItem = { due: v.due || null, dueEnd: v.dueEnd || null, time: v.time || null };
  const label = dueLabel(fakeItem);
  const toggle = () => {
    if (open) { setOpen(false); return; }
    setRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  };
  return (
    <>
      <button ref={btnRef} className={`due ${label ? label.tone : 'empty'}`} onClick={toggle}>
        <Icon name="calendar" size={13} stroke={2} />
        {label ? label.text : <span className="due-add">Set date</span>}
      </button>
      {open && rect &&
        <DatePopover item={fakeItem} anchorRect={rect} anchorEl={btnRef.current}
          onChange={(due, dueEnd, time) => onChange(due ? { due, dueEnd, time } : null)}
          onClose={() => setOpen(false)} />}
    </>
  );
}

function WebsiteCell({ value, onChange }) {
  const [editing, setEditing] = useColState(false);
  const [v, setV] = useColState(value || '');
  const commit = () => { setEditing(false); onChange(v.trim() || null); };
  if (editing) {
    return (
      <input className="fld-input" autoFocus placeholder="example.com" value={v}
        onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setV(value || ''); setEditing(false); } }}
        onClick={(e) => e.stopPropagation()} />
    );
  }
  if (value) {
    const host = value.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const href = /^https?:/.test(value) ? value : 'https://' + value;
    return (
      <span className="fld-web-wrap">
        <a className="fld-web" href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          <Icon name="globe" size={13} /> {host}
        </a>
        <button className="fld-edit" onClick={(e) => { e.stopPropagation(); setV(value); setEditing(true); }} aria-label="Edit"><Icon name="pen" size={12} /></button>
      </span>
    );
  }
  return <button className="fld-add" onClick={() => { setV(''); setEditing(true); }}><Icon name="globe" size={13} /> Add link</button>;
}

function TextCell({ value, onChange }) {
  const [editing, setEditing] = useColState(false);
  const [v, setV] = useColState(value || '');
  const commit = () => { setEditing(false); onChange(v.trim() || null); };
  if (editing) {
    return (
      <input className="fld-input" autoFocus value={v}
        onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setV(value || ''); setEditing(false); } }}
        onClick={(e) => e.stopPropagation()} />
    );
  }
  return <span className={`fld-text ${value ? '' : 'empty'}`} onClick={() => { setV(value || ''); setEditing(true); }}>{value || <span className="fld-empty">Empty</span>}</span>;
}

function LabelsCell({ value, onChange }) {
  const labels = value || [];
  const [open, setOpen] = useColState(false);
  const [txt, setTxt] = useColState('');
  const btnRef = useColRef(null);
  const add = () => { if (!txt.trim()) return; onChange([...labels, { text: txt.trim(), color: LABEL_COLORS[labels.length % LABEL_COLORS.length] }]); setTxt(''); };
  const remove = (idx) => onChange(labels.filter((_, i) => i !== idx).length ? labels.filter((_, i) => i !== idx) : null);
  return (
    <div className="status-select fld-labels-wrap">
      <button ref={btnRef} className="fld-labels" onClick={() => setOpen((o) => !o)}>
        {labels.length === 0 ? <span className="fld-add"><Icon name="tag" size={13} /> Add</span> :
          labels.map((l, i) => <span key={i} className="lab-chip" style={{ background: l.color }}>{l.text}</span>)}
      </button>
      {open && (
        <PopMenu anchorRef={btnRef} align="left" width={210} onClose={() => setOpen(false)}>
          <div className="lab-list">
            {labels.map((l, i) => (
              <span key={i} className="lab-chip removable" style={{ background: l.color }}>
                {l.text}
                <button onClick={() => remove(i)} aria-label="Remove"><Icon name="plus" size={11} style={{ transform: 'rotate(45deg)' }} /></button>
              </span>
            ))}
            {labels.length === 0 && <span className="lab-empty">No labels yet</span>}
          </div>
          <div className="lab-add">
            <input autoFocus placeholder="New label…" value={txt}
              onChange={(e) => setTxt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setOpen(false); }} />
            <button onClick={add} disabled={!txt.trim()}><Icon name="plus" size={15} /></button>
          </div>
        </PopMenu>
      )}
    </div>
  );
}

function CommentsCell({ value, onChange }) {
  const list = value || [];
  const [open, setOpen] = useColState(false);
  const [txt, setTxt] = useColState('');
  const btnRef = useColRef(null);
  const add = () => { if (!txt.trim()) return; onChange([...list, { text: txt.trim(), ts: Date.now() }]); setTxt(''); };
  return (
    <div className="status-select">
      <button ref={btnRef} className={`fld-comments ${list.length ? 'has' : ''}`} onClick={() => setOpen((o) => !o)}>
        <Icon name="chat" size={14} /> {list.length > 0 ? list.length : <span className="fld-empty">Add</span>}
      </button>
      {open && (
        <PopMenu anchorRef={btnRef} align="left" width={260} onClose={() => setOpen(false)}>
          <div className="cmt-list">
            {list.length === 0 && <div className="cmt-empty">No comments yet</div>}
            {list.map((c, i) => (
              <div key={i} className="cmt-item"><Avatar ownerId="you" size={22} /><div className="cmt-body">{c.text}</div></div>
            ))}
          </div>
          <div className="cmt-add">
            <input autoFocus placeholder="Write a comment…" value={txt}
              onChange={(e) => setTxt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setOpen(false); }} />
            <button onClick={add} disabled={!txt.trim()}><Icon name="arrowRight" size={15} /></button>
          </div>
        </PopMenu>
      )}
    </div>
  );
}

// ---- dispatcher: render the right editor for a column type ----
function renderCell(col, item, dispatch, onSetDate) {
  const f = item.fields || {};
  const setField = (value) => dispatch({ type: 'setField', id: item.id, colId: col.id, value });
  switch (col.type) {
    case 'owner':   return <OwnerSelect ownerId={item.owner} onSelect={(o) => dispatch({ type: 'setOwner', id: item.id, owner: o })} />;
    case 'status':  return <StatusSelect status={item.status} onSelect={(s) => dispatch({ type: 'setStatus', id: item.id, status: s })} />;
    case 'due':     return <DueCell item={item} onChange={onSetDate} />;
    case 'matrix':  return <MatrixSelect priority={item.priority} onSelect={(p) => dispatch({ type: 'setPriority', id: item.id, priority: p })} />;
    case 'date':    return <DateFieldCell value={f[col.id]} onChange={setField} />;
    case 'website': return <WebsiteCell value={f[col.id]} onChange={setField} />;
    case 'labels':  return <LabelsCell value={f[col.id]} onChange={setField} />;
    case 'text':    return <TextCell value={f[col.id]} onChange={setField} />;
    case 'comments':return <CommentsCell value={f[col.id]} onChange={setField} />;
    default: return null;
  }
}

Object.assign(window, {
  PopMenu, PaletteComposer, StatusSelect, MatrixSelect, OwnerSelect, DueCell,
  DateFieldCell, WebsiteCell, LabelsCell, TextCell, CommentsCell,
  renderCell, COLUMN_TYPES, COLUMN_DEFAULT_WIDTH, LABEL_COLORS,
});
