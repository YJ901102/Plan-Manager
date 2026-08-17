// today.jsx — this week as a mini calendar strip, + overdue list below. Attaches to window.

function TodayRow({ item, onToggle, onOpen, dateLabel, onDelete }) {
  return (
    <div className={`td-row ${item.done ? 'done' : ''}`} onClick={() => onOpen(item.id)}>
      <button className={`td-check ${item.done ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); onToggle(item.id); }} aria-label="Toggle done">
        {item.done && <Icon name="check" size={13} stroke={3} />}
      </button>
      <span className="td-title">{item.title}</span>
      {dateLabel && <span className="td-when">{dateLabel}</span>}
      <span className="td-status" style={{ color: STATUS[item.status].color }}>
        <span className="td-status-dot" style={{ background: STATUS[item.status].color }} />
        {STATUS[item.status].label}
      </span>
      <span className="td-board">{item.boardName}</span>
      {onDelete && (
        <button className="td-delete" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} aria-label="Delete task" title="Delete task">
          <Icon name="trash" size={14} />
        </button>
      )}
    </div>
  );
}

function TodayView({ boards, onToggle, onOpen, onAddTask, onDelete }) {
  const { useState: useTwState } = React;
  const [quickAdd, setQuickAdd] = useTwState(null); // dateIso being added to, or null
  const today = isoToday();
  const all = [];
  Object.values(boards).forEach((b) =>
    b.groups.forEach((g) => g.items.forEach((i) => all.push({ ...i, boardName: b.name })))
  );

  const overdue = all.filter((i) => i.due && !i.done && i.due < today).sort((a, b) => (a.due < b.due ? -1 : 1));
  const done = all.filter((i) => i.done).sort((a, b) => ((a.due || '') < (b.due || '') ? 1 : -1));

  // build the 7 days of the current calendar week (Sun\u2013Sat)
  const dt = new Date(TODAY);
  const weekStartDt = new Date(dt); weekStartDt.setDate(dt.getDate() - dt.getDay());
  const _isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartDt); d.setDate(weekStartDt.getDate() + i);
    days.push({ date: d, iso: _isoOf(d) });
  }

  // items shown in the week grid: due within this week, and either today/future
  // or already done (past-due-but-incomplete items live only in Overdue below).
  const byDate = {};
  all.forEach((i) => {
    if (!i.due) return;
    if (i.due < days[0].iso || i.due > days[6].iso) return;
    if (i.due < today && !i.done) return;
    (byDate[i.due] = byDate[i.due] || []).push(i);
  });

  const weekItems = Object.values(byDate).flat();
  const weekDone = weekItems.filter((i) => i.done).length;

  const dateLabel = `${MONTHS[days[0].date.getMonth()].slice(0, 3)} ${days[0].date.getDate()} \u2013 ${MONTHS[days[6].date.getMonth()].slice(0, 3)} ${days[6].date.getDate()}`;

  return (
    <div className="today-view">
      <div className="today-inner">
        <div className="today-head">
          <div>
            <div className="today-kicker">This week</div>
            <h2 className="today-date">{dateLabel}</h2>
          </div>
          <div className="today-progress">
            <span className="today-progress-num">{weekDone}/{weekItems.length}</span>
            <span className="today-progress-label">done</span>
          </div>
        </div>

        <div className="tw-grid">
          {days.map((d) => {
            const isToday = d.iso === today;
            const items = byDate[d.iso] || [];
            return (
              <div key={d.iso} className={`tw-day ${isToday ? 'today' : ''}`}
                onDoubleClick={(e) => { if (!onAddTask) return; if (e.target.closest('.tw-chip')) return; setQuickAdd(d.iso); }}
                title={onAddTask ? 'Double-click to add a task' : undefined}>
                <div className="tw-day-head">
                  <span className="tw-day-wd">{WD[d.date.getDay()]}</span>
                  <span className={`tw-day-num ${isToday ? 'today' : ''}`}>{d.date.getDate()}</span>
                </div>
                <div className="tw-day-items">
                  {items.length === 0 ? <span className="tw-day-empty">{'\u2014'}</span> : items.map((i) => (
                    <div key={i.id} className={`tw-chip ${i.done ? 'done' : ''}`} onClick={() => onOpen(i.id)} title={`${i.title} \u00b7 ${i.boardName}`}>
                      <span className="tw-chip-dot" style={{ background: STATUS[i.status].color }} />
                      <span className="tw-chip-text">{i.title}</span>
                      {onDelete && (
                        <button className="tw-chip-delete" onClick={(e) => { e.stopPropagation(); onDelete(i.id); }} aria-label="Delete task" title="Delete task">
                          <Icon name="trash" size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {quickAdd && onAddTask && (
          <QuickAddTaskModal boards={boards} dateIso={quickAdd} onClose={() => setQuickAdd(null)}
            onCreate={(boardId, groupId, item) => onAddTask(boardId, groupId, item)} />
        )}

        <div className="td-section">
          <h3 className="td-sec-title over"><Icon name="flag" size={15} /> Overdue <span>{overdue.length}</span></h3>
          {overdue.length === 0 ? (
            <div className="td-empty td-empty-compact">Nothing overdue — you're all caught up.</div>
          ) : (
            <div className="td-list">
              {overdue.map((i) => <TodayRow key={i.id} item={i} onToggle={onToggle} onOpen={onOpen} onDelete={onDelete} />)}
            </div>
          )}
        </div>

        {done.length > 0 && (
          <div className="td-section">
            <h3 className="td-sec-title done"><Icon name="check" size={15} stroke={3} /> Done <span>{done.length}</span></h3>
            <div className="td-list">
              {done.map((i) => {
                const f = i.due ? fmtDue(i.due) : null;
                return <TodayRow key={i.id} item={i} onToggle={onToggle} onOpen={onOpen} onDelete={onDelete} dateLabel={f ? (f.rel || f.base) : null} />;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { TodayView });
