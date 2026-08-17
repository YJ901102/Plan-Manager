// quickadd.jsx — detailed "new task" modal (space, section, date/time, location, notes).
// Used from the all-spaces calendar's double-click-to-add flow. Attaches to window.

function QuickAddTaskModal({ boards, dateIso, onClose, onCreate }) {
  const { useState: useQAState, useRef: useQARef, useEffect: useQAEffect } = React;
  const boardList = Object.values(boards);

  const [boardId, setBoardId] = useQAState(boardList[0] ? boardList[0].id : '');
  const board = boards[boardId];
  const groupList = board ? board.groups : [];
  const [groupId, setGroupId] = useQAState(groupList[0] ? groupList[0].id : '');
  const [title, setTitle] = useQAState('');
  const [due, setDue] = useQAState(dateIso || null);
  const [dueEnd, setDueEnd] = useQAState(null);
  const [time, setTime] = useQAState(null);
  const [location, setLocation] = useQAState('');
  const [notes, setNotes] = useQAState('');
  const titleRef = useQARef(null);
  useQAEffect(() => { if (titleRef.current) titleRef.current.focus(); }, []);

  const changeBoard = (id) => {
    setBoardId(id);
    const nb = boards[id];
    setGroupId((nb && nb.groups[0] && nb.groups[0].id) || '');
  };

  const canSubmit = title.trim() && boardId && groupId;
  const submit = () => {
    if (!canSubmit) return;
    const it = task(title.trim(), 'you', 'notStarted', due || null, 'schedule', {
      ...(dueEnd ? { dueEnd } : {}),
      ...(time ? { time } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(notes.trim() ? { desc: notes.trim() } : {}),
    });
    onCreate(boardId, groupId, it);
    onClose();
  };

  const currentGroup = groupList.find((g) => g.id === groupId);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal qa-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2 className="modal-title">New task</h2>
            <p className="modal-sub">Add it to any space, with as much detail as you like.</p>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            <Icon name="plus" size={20} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </div>

        <div className="modal-body qa-body">
          <input ref={titleRef} className="qa-title-input" placeholder="Task name"
            value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }} />

          <div className="qa-row">
            <div className="qa-field">
              <div className="qa-field-label">Space</div>
              <select className="se-input qa-select" value={boardId} onChange={(e) => changeBoard(e.target.value)}>
                {boardList.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="qa-field">
              <div className="qa-field-label">Section</div>
              <select className="se-input qa-select" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                {groupList.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>

          <div className="tp-field">
            <div className="tp-field-label">Date</div>
            <div className="tp-field-ctl">
              <DueCell item={{ due, dueEnd, time }} onChange={(d, de, t) => { setDue(d); setDueEnd(de); setTime(t); }} />
            </div>
          </div>

          <div className="tp-field">
            <div className="tp-field-label">Location</div>
            <div className="tp-field-ctl tp-meta">
              <span className="tp-meta-icon"><Icon name="pin" size={16} /></span>
              <input className="tp-meta-input" placeholder="Add location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>

          <div className="tp-notes qa-notes">
            <div className="tp-field-label">Notes</div>
            <textarea className="tp-notes-area qa-notes-area" placeholder="Add details, links, context…" rows={3}
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="modal-foot">
          <span className="foot-count">{board ? board.name : ''}{currentGroup ? ' · ' + currentGroup.name : ''}</span>
          <div className="foot-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={!canSubmit} onClick={submit}>
              <span>Add task</span>
              <Icon name="arrowRight" size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { QuickAddTaskModal });
