// taskpanel.jsx — slide-over task detail editor. Attaches to window.
const { useState: useTpState } = React;

function FieldRow({ label, children }) {
  return (
    <div className="tp-field">
      <div className="tp-field-label">{label}</div>
      <div className="tp-field-ctl">{children}</div>
    </div>
  );
}

const fmtSize = (b) => {
  if (b == null) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
};

function MetaField({ icon, label, value, placeholder, isLink, onCommit }) {
  const [v, setV] = useTpState(value || '');
  React.useEffect(() => { setV(value || ''); }, [value]);
  const commit = () => { if ((v || '').trim() !== (value || '')) onCommit(v.trim()); };
  const href = isLink && v ? (/^https?:\/\//i.test(v) ? v : 'https://' + v) : null;
  return (
    <div className="tp-field">
      <div className="tp-field-label">{label}</div>
      <div className="tp-field-ctl tp-meta">
        <span className="tp-meta-icon"><Icon name={icon} size={16} /></span>
        <input className="tp-meta-input" placeholder={placeholder} value={v}
          onChange={(e) => setV(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
        {href && <a className="tp-meta-open" href={href} target="_blank" rel="noreferrer">Open</a>}
      </div>
    </div>
  );
}

function MetaSelect({ icon, label, value, options, onChange }) {
  return (
    <label className={`tp-subopt ${value ? 'on' : ''}`}>
      <span className="tp-subopt-ic"><Icon name={icon} size={15} /></span>
      <span className="tp-subopt-lbl">{label}</span>
      <select className="tp-subopt-sel" value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
    </label>
  );
}

const ALERT_OPTS = [{ v: '', t: 'No alert' }, { v: 'at', t: 'At time of event' }, { v: '5m', t: '5 min before' }, { v: '15m', t: '15 min before' }, { v: '30m', t: '30 min before' }, { v: '1h', t: '1 hour before' }, { v: '1d', t: '1 day before' }];
const REPEAT_OPTS = [{ v: '', t: 'Never' }, { v: 'daily', t: 'Daily' }, { v: 'weekly', t: 'Weekly' }, { v: 'monthly', t: 'Monthly' }, { v: 'yearly', t: 'Yearly' }];
const TRAVEL_OPTS = [{ v: '', t: 'None' }, { v: '5m', t: '5 min' }, { v: '15m', t: '15 min' }, { v: '30m', t: '30 min' }, { v: '1h', t: '1 hour' }];

function SubtaskRow({ sub, onToggle, onRename, onDelete }) {
  const [editing, setEditing] = useTpState(false);
  const [val, setVal] = useTpState(sub.title);
  const commit = () => { setEditing(false); if (val.trim()) onRename(val.trim()); else setVal(sub.title); };
  return (
    <div className={`tp-sub ${sub.done ? 'done' : ''}`}>
      <button className={`tp-sub-check ${sub.done ? 'on' : ''}`} onClick={onToggle} aria-label="Toggle subtask">
        {sub.done && <Icon name="check" size={11} stroke={3} />}
      </button>
      {editing ? (
        <input className="tp-sub-input" autoFocus value={val}
          onChange={(e) => setVal(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(sub.title); setEditing(false); } }} />
      ) : (
        <span className="tp-sub-title" onClick={() => setEditing(true)}>{sub.title}</span>
      )}
      <button className="tp-sub-del" onClick={onDelete} aria-label="Delete subtask"><Icon name="trash" size={14} /></button>
    </div>
  );
}

function TaskPanel({ item, boardName, groupName, boards, currentBoardId, currentGroupId, onMove, onShare, dispatch, onClose }) {
  const [title, setTitle] = useTpState(item.title);
  const [desc, setDesc] = useTpState(item.desc || '');
  const titleRef = React.useRef(null);
  React.useEffect(() => {
    if (item.title === 'New task' && titleRef.current) { titleRef.current.focus(); titleRef.current.select(); }
  }, []);
  const [newSub, setNewSub] = useTpState('');
  const [addingStatus, setAddingStatus] = useTpState(false);
  const [editingStatus, setEditingStatus] = useTpState(null);
  const [addingOwner, setAddingOwner] = useTpState(false);
  const [editingOwner, setEditingOwner] = useTpState(null);
  const [linkDraft, setLinkDraft] = useTpState('');
  const [addingLink, setAddingLink] = useTpState(false);
  const { addStatus, updateStatus, removeStatus } = useStatusAdmin();
  const { addOwner, updateOwner, removeOwner } = useOwnerAdmin();
  const subs = item.subtasks || [];
  const subDone = subs.filter((s) => s.done).length;

  const set = (action) => dispatch(action);
  const commitTitle = () => { const v = title.trim(); if (v && v !== item.title) set({ type: 'rename', id: item.id, title: v }); else if (!v) setTitle(item.title); };
  const commitDesc = () => { if (desc !== (item.desc || '')) set({ type: 'setDesc', id: item.id, desc }); };
  const addSub = () => { if (newSub.trim()) set({ type: 'addSubtask', id: item.id, title: newSub.trim() }); setNewSub(''); };
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) set({ type: 'addAttachment', id: item.id, att: { id: 'att' + Date.now().toString(36), name: f.name, size: f.size, kind: 'file' } });
    e.target.value = '';
  };
  const addLink = () => {
    const u = linkDraft.trim(); if (!u) { setAddingLink(false); return; }
    const href = /^https?:\/\//i.test(u) ? u : 'https://' + u;
    let name = u; try { name = new URL(href).hostname.replace(/^www\./, '') + new URL(href).pathname.replace(/\/$/, ''); } catch (e) {}
    set({ type: 'addAttachment', id: item.id, att: { id: 'att' + Date.now().toString(36), name, url: href, kind: 'link' } });
    setLinkDraft(''); setAddingLink(false);
  };

  return (
    <div className="tp-scrim" onClick={onClose}>
      <aside className="tp" onClick={(e) => e.stopPropagation()}>
        <div className="tp-top">
          {boards && onMove ? (
            <div className="tp-crumb tp-crumb-edit">
              <div className="tp-crumb-pick">
                <Icon name={(boards[currentBoardId] || {}).icon || 'folder'} size={13} />
                <select className="tp-crumb-sel" value={currentBoardId}
                  onChange={(e) => { const tb = e.target.value; const g0 = (boards[tb].groups[0] || {}).id; onMove(item.id, currentBoardId, tb, g0); }}>
                  {Object.values(boards).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <Icon name="chevron" size={13} />
              <div className="tp-crumb-pick">
                <select className="tp-crumb-sel" value={currentGroupId}
                  onChange={(e) => onMove(item.id, currentBoardId, currentBoardId, e.target.value)}>
                  {(boards[currentBoardId] || { groups: [] }).groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="tp-crumb">
              <span>{boardName}</span>
              <Icon name="chevron" size={13} />
              <span style={{ color: groupName ? undefined : 'var(--muted-2)' }}>{groupName || '—'}</span>
            </div>
          )}
          <div className="tp-top-actions">
            {onShare && <button className="tp-icon" onClick={onShare} aria-label="Share task" title="Share task"><Icon name="share" size={16} /></button>}
            <button className="tp-icon" onClick={() => { set({ type: 'delete', id: item.id }); onClose(); }} aria-label="Delete"><Icon name="trash" size={17} /></button>
            <button className="tp-icon" onClick={onClose} aria-label="Close"><Icon name="plus" size={19} style={{ transform: 'rotate(45deg)' }} /></button>
          </div>
        </div>

        <div className="tp-body">
          <textarea className={`tp-title ${title === 'New task' ? 'is-placeholder' : ''}`} ref={titleRef} rows={1} value={title}
            onChange={(e) => setTitle(e.target.value)} onBlur={commitTitle}
            onFocus={(e) => { if (title === 'New task') e.target.select(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }} />

          <div className="tp-fields">
            <FieldRow label="Status">
              <div className="tp-pills">
                {STATUS_ORDER.map((s) => STATUS[s] && (
                  editingStatus === s ? (
                    <PaletteComposer key={s} initial={{ label: STATUS[s].label, color: STATUS[s].color }} submitLabel="Save"
                      onSubmit={(n, c) => { updateStatus(s, { label: n, color: c }); setEditingStatus(null); }}
                      onCancel={() => setEditingStatus(null)} />
                  ) : (
                    <span key={s} className="tp-status-wrap">
                      <button className={`tp-status ${item.status === s ? 'on' : ''}`}
                        style={item.status === s ? { background: STATUS[s].color } : { color: STATUS[s].color, boxShadow: `inset 0 0 0 1.5px ${STATUS[s].color}` }}
                        onClick={() => set({ type: 'setStatus', id: item.id, status: s })}>
                        {STATUS[s].label}
                      </button>
                      {addStatus && (
                        <span className="tp-status-actions">
                          <button className="tp-status-act" onClick={(e) => { e.stopPropagation(); setEditingStatus(s); }} title="Rename status"><Icon name="pen" size={12} /></button>
                          {!DEFAULT_STATUS_IDS.includes(s) && (
                            <button className="tp-status-act del" onClick={(e) => { e.stopPropagation(); removeStatus(s); }} title="Delete status"><Icon name="trash" size={12} /></button>
                          )}
                        </span>
                      )}
                    </span>
                  )
                ))}
                {addStatus && (
                  <button className="tp-status tp-pill-add" onClick={() => setAddingStatus((a) => !a)}>
                    <Icon name="plus" size={13} /> New
                  </button>
                )}
              </div>
              {addingStatus && (
                <PaletteComposer placeholder="Status name\u2026" submitLabel="Add status"
                  onSubmit={(n, c) => { const id = addStatus(n, c); set({ type: 'setStatus', id: item.id, status: id }); setAddingStatus(false); }}
                  onCancel={() => setAddingStatus(false)} />
              )}
            </FieldRow>

            <div className="tp-field tp-field-matrix">
              <div className="tp-field-label">Matrix</div>
              <div className="tp-field-ctl">
                <div className="tp-matrix">
                  <span className="tp-mx-axis tp-mx-top">Important</span>
                  <span className="tp-mx-axis tp-mx-bottom">Unimportant</span>
                  <span className="tp-mx-axis tp-mx-left">Can wait</span>
                  <span className="tp-mx-axis tp-mx-right">Urgent</span>
                  <div className="tp-matrix-grid">
                    {['schedule', 'doNow', 'dismiss', 'delegate'].map((q) => {
                      const m = MATRIX[q];
                      const on = item.priority === q;
                      return (
                        <button key={q} className={`tp-quad ${on ? 'on' : ''}`}
                          style={on ? { background: m.color, borderColor: m.color } : { '--qc': m.color }}
                          onClick={() => set({ type: 'setPriority', id: item.id, priority: q })}>
                          <span className="tp-quad-label">{m.label}</span>
                          <span className="tp-quad-short">{m.short}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <FieldRow label="Owner">
              <div className="tp-owners">
                {Object.values(OWNERS).map((o) => (
                  editingOwner === o.id ? (
                    <PaletteComposer key={o.id} initial={{ label: o.name, color: o.color }} submitLabel="Save" placeholder="Name\u2026"
                      onSubmit={(n, c) => { updateOwner(o.id, { name: n, color: c }); setEditingOwner(null); }}
                      onCancel={() => setEditingOwner(null)} />
                  ) : (
                    <span key={o.id} className="tp-status-wrap">
                      <button className={`tp-owner ${item.owner === o.id ? 'on' : ''}`}
                        onClick={() => set({ type: 'setOwner', id: item.id, owner: o.id })}>
                        <Avatar ownerId={o.id} size={24} /> {o.name}
                      </button>
                      {updateOwner && (
                        <span className="tp-status-actions">
                          <button className="tp-status-act" onClick={(e) => { e.stopPropagation(); setEditingOwner(o.id); }} title="Rename person"><Icon name="pen" size={12} /></button>
                          {o.id !== 'you' && (
                            <button className="tp-status-act del" onClick={(e) => { e.stopPropagation(); if (item.owner === o.id) set({ type: 'setOwner', id: item.id, owner: null }); removeOwner(o.id); }} title="Remove person"><Icon name="trash" size={12} /></button>
                          )}
                        </span>
                      )}
                    </span>
                  )
                ))}
                <button className={`tp-owner ${!item.owner ? 'on' : ''}`} onClick={() => set({ type: 'setOwner', id: item.id, owner: null })}>
                  <Avatar ownerId={null} size={24} /> Unassigned
                </button>
                {addOwner && (
                  <button className="tp-owner tp-owner-add" onClick={() => setAddingOwner((a) => !a)}>
                    <Icon name="plus" size={15} /> Add person
                  </button>
                )}
              </div>
              {addingOwner && (
                <PaletteComposer placeholder="Name\u2026" submitLabel="Add person"
                  onSubmit={(n, c) => { const id = addOwner(n, c); set({ type: 'setOwner', id: item.id, owner: id }); setAddingOwner(false); }}
                  onCancel={() => setAddingOwner(false)} />
              )}
            </FieldRow>

            <FieldRow label="Date">
              <DueCell item={item} onChange={(due, dueEnd, time) => set({ type: 'setDate', id: item.id, due, dueEnd, time })} />
              <div className="tp-subopts">
                <MetaSelect icon="refresh" label="Repeat" value={item.repeat} options={REPEAT_OPTS}
                  onChange={(v) => { set({ type: 'setMeta', id: item.id, key: 'repeat', value: v }); if (!v) set({ type: 'setMeta', id: item.id, key: 'repeatEnd', value: null }); }} />
                {item.repeat && (() => {
                  const re = item.repeatEnd || { mode: 'never' };
                  const setEnd = (val) => set({ type: 'setMeta', id: item.id, key: 'repeatEnd', value: val });
                  return (
                    <div className="tp-subopt tp-subopt-col on">
                      <div className="tp-subopt-row">
                        <span className="tp-subopt-ic"><Icon name="clock" size={15} /></span>
                        <span className="tp-subopt-lbl">End repeat</span>
                        <select className="tp-subopt-sel" value={re.mode}
                          onChange={(e) => {
                            const m = e.target.value;
                            if (m === 'never') setEnd(null);
                            else if (m === 'count') setEnd({ mode: 'count', count: re.count || 1 });
                            else setEnd({ mode: 'date', date: re.date || item.due || '' });
                          }}>
                          <option value="never">Never</option>
                          <option value="count">After…</option>
                          <option value="date">On date</option>
                        </select>
                      </div>
                      {re.mode === 'count' && (
                        <div className="tp-repeat-extra">
                          <input type="number" min="1" value={re.count || 1}
                            onChange={(e) => setEnd({ mode: 'count', count: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
                          <span>{(re.count || 1) === 1 ? 'time' : 'times'}</span>
                        </div>
                      )}
                      {re.mode === 'date' && (
                        <div className="tp-repeat-extra">
                          <input type="date" value={re.date || ''}
                            onChange={(e) => setEnd({ mode: 'date', date: e.target.value })} />
                        </div>
                      )}
                    </div>
                  );
                })()}
                <MetaSelect icon="car" label="Travel time" value={item.travel} options={TRAVEL_OPTS}
                  onChange={(v) => set({ type: 'setMeta', id: item.id, key: 'travel', value: v })} />
                <MetaSelect icon="bell" label="Alert" value={item.alert} options={ALERT_OPTS}
                  onChange={(v) => set({ type: 'setMeta', id: item.id, key: 'alert', value: v })} />
              </div>
            </FieldRow>

            <MetaField icon="pin" label="Location" value={item.location} placeholder="Add location"
              onCommit={(v) => set({ type: 'setMeta', id: item.id, key: 'location', value: v })} />
            <MetaField icon="video" label="Video call" value={item.video} placeholder="Add meeting link" isLink
              onCommit={(v) => set({ type: 'setMeta', id: item.id, key: 'video', value: v })} />
            <MetaField icon="link" label="URL" value={item.url} placeholder="Add a link" isLink
              onCommit={(v) => set({ type: 'setMeta', id: item.id, key: 'url', value: v })} />

            <div className="tp-field">
              <div className="tp-field-label">Files</div>
              <div className="tp-field-ctl">
                {(item.attachments || []).length > 0 && (
                  <div className="tp-attach-list">
                    {item.attachments.map((a) => (
                      <div key={a.id} className="tp-attach">
                        <span className="tp-attach-ic"><Icon name={a.kind === 'link' ? 'link' : 'paperclip'} size={14} /></span>
                        {a.url ? <a className="tp-attach-name" href={a.url} target="_blank" rel="noreferrer">{a.name}</a> : <span className="tp-attach-name">{a.name}</span>}
                        {a.size != null && <span className="tp-attach-size">{fmtSize(a.size)}</span>}
                        <button className="tp-attach-del" onClick={() => set({ type: 'removeAttachment', id: item.id, attId: a.id })} aria-label="Remove"><Icon name="trash" size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
                {addingLink ? (
                  <div className="tp-attach-linkadd">
                    <input autoFocus placeholder="Paste a link\u2026" value={linkDraft}
                      onChange={(e) => setLinkDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addLink(); if (e.key === 'Escape') { setLinkDraft(''); setAddingLink(false); } }} />
                    <button className="tp-attach-linkbtn" onClick={addLink} disabled={!linkDraft.trim()}>Add</button>
                  </div>
                ) : (
                  <div className="tp-attach-actions">
                    <label className="tp-attach-add"><Icon name="paperclip" size={14} /> Add file<input type="file" hidden onChange={onFile} /></label>
                    <button className="tp-attach-add" onClick={() => setAddingLink(true)}><Icon name="link" size={14} /> Add link</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="tp-subs">
            <div className="tp-subs-head">
              <div className="tp-field-label" style={{ padding: 0 }}>Subtasks</div>
              {subs.length > 0 && (
                <div className="tp-subs-prog">
                  <div className="tp-subs-bar"><span style={{ width: `${Math.round((subDone / subs.length) * 100)}%` }} /></div>
                  <span className="tp-subs-count">{subDone}/{subs.length}</span>
                </div>
              )}
            </div>
            <div className="tp-sub-list">
              {subs.map((s) => (
                <SubtaskRow key={s.id} sub={s}
                  onToggle={() => set({ type: 'toggleSubtask', id: item.id, subId: s.id })}
                  onRename={(v) => set({ type: 'renameSubtask', id: item.id, subId: s.id, title: v })}
                  onDelete={() => set({ type: 'deleteSubtask', id: item.id, subId: s.id })} />
              ))}
            </div>
            <div className="tp-sub-add">
              <Icon name="plus" size={15} />
              <input placeholder="Add a subtask…" value={newSub}
                onChange={(e) => setNewSub(e.target.value)} onBlur={addSub}
                onKeyDown={(e) => { if (e.key === 'Enter') addSub(); if (e.key === 'Escape') setNewSub(''); }} />
            </div>
          </div>

          <div className="tp-notes">
            <div className="tp-field-label">Notes</div>
            <textarea className="tp-notes-area" placeholder="Add details, links, context…" value={desc}
              onChange={(e) => setDesc(e.target.value)} onBlur={commitDesc} />
          </div>
        </div>
      </aside>
    </div>
  );
}

Object.assign(window, { TaskPanel });
