// overview.jsx — dashboard with Dashboard + All-spaces Calendar tabs. Attaches to window.

function AllSpacesCalendar({ boards, onOpenTask, onAddTask, holidays = [], onAddHoliday, onEditHoliday, onDeleteHoliday }) {
  const { useState: useOvCalState } = React;
  const [vm, setVm] = useOvCalState({ y: TODAY.getFullYear(), m: TODAY.getMonth() });
  const [editHol, setEditHol] = useOvCalState(null);
  const [quickAdd, setQuickAdd] = useOvCalState(null); // dateIso being added to, or null

  // aggregate all dated items across every space
  const items = [];
  const spaceColors = {};
  Object.values(boards).forEach((b, bi) => {
    // each space gets its own distinct color so chips are tellable apart
    spaceColors[b.id] = spaceColorFor(b, bi);
    b.groups.forEach((g) => g.items.forEach((i) => {
      if (i.due) items.push({ ...i, boardName: b.name, spaceColor: spaceColors[b.id] });
    }));
  });

  const first = new Date(vm.y, vm.m, 1);
  const startWd = first.getDay();
  const daysIn = new Date(vm.y, vm.m + 1, 0).getDate();
  const todayIso = isoToday();

  const cells = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let day = 1; day <= daysIn; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const iso = (day) => `${vm.y}-${String(vm.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const monthStart = iso(1), monthEnd = iso(daysIn);
  const byDate = {};
  items.forEach((i) => { repeatDatesInRange(i, monthStart, monthEnd).forEach((dt) => { (byDate[dt] = byDate[dt] || []).push(i); }); });
  const holsByDate = {};
  holidays.forEach((h) => { (holsByDate[h.date] = holsByDate[h.date] || []).push(h); });

  const prev = () => setVm((v) => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 });
  const next = () => setVm((v) => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 });

  // count total tasks in this month
  const monthCount = cells.filter(Boolean).reduce((n, day) => n + (byDate[iso(day)] || []).length, 0);

  return (
    <div className="cal-wrap ovcal">
      <div className="cal-top">
        <div>
          <h2 className="cal-title">{MONTHS[vm.m]} <span>{vm.y}</span></h2>
          <div className="ovcal-meta">{monthCount} task{monthCount !== 1 ? 's' : ''} across {Object.keys(boards).length} space{Object.keys(boards).length !== 1 ? 's' : ''}</div>
        </div>
        <div className="cal-nav">
          <button onClick={prev} aria-label="Previous month"><Icon name="chevron" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
          <button className="cal-today-btn" onClick={() => setVm({ y: TODAY.getFullYear(), m: TODAY.getMonth() })}>Today</button>
          <button onClick={next} aria-label="Next month"><Icon name="chevron" size={18} /></button>
        </div>
      </div>

      {/* space legend */}
      <div className="ovcal-legend">
        {Object.values(boards).map((b) => (
          <div key={b.id} className="ovcal-leg-item">
            <span className="ovcal-leg-dot" style={{ background: spaceColors[b.id] }} />
            <span>{b.name}</span>
          </div>
        ))}
      </div>

      {/* status legend */}
      <div className="ovcal-legend ovcal-status-legend">
        {STATUS_ORDER.map((sid) => (
          <div key={sid} className="ovcal-leg-item">
            <span className="ovcal-leg-dot" style={{ background: STATUS[sid].color }} />
            <span>{STATUS[sid].label}</span>
          </div>
        ))}
      </div>

      <div className="cal-grid cal-head-row">
        {WD.map((w) => <div key={w} className="cal-wd">{w}</div>)}
      </div>
      <div className="cal-grid cal-body">
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} className="cal-cell empty" />;
          const dayIso = iso(day);
          const dayItems = byDate[dayIso] || [];
          const isToday = dayIso === todayIso;
          const onCellDoubleClick = (e) => {
            if (!onAddTask) return;
            if (e.target.closest('.cal-chip') || e.target.closest('.cal-hol') || e.target.closest('.cal-more')) return;
            setQuickAdd(dayIso);
          };
          return (
            <div key={idx} className={`cal-cell ${isToday ? 'today' : ''}`} onDoubleClick={onCellDoubleClick} title={onAddTask ? 'Double-click to add a task' : undefined}>
              <div className="cal-date">
                <span className={isToday ? 'cal-date-num today' : 'cal-date-num'}>{day}</span>
              </div>
              <div className="cal-chips">
                {(holsByDate[dayIso] || []).map((h) => (
                  <HolidayChip key={h.id} hol={h} open={editHol === h.id}
                    onOpen={() => setEditHol(h.id)} onClose={() => setEditHol(null)}
                    onEdit={onEditHoliday} onDelete={(id) => { onDeleteHoliday(id); setEditHol(null); }} />
                ))}
                {dayItems.slice(0, 4).map((i) => (
                  <div key={i.id} className={`cal-chip ovcal-chip ${i.done ? 'done' : ''}`} title={`${i.title} · ${i.boardName} · ${STATUS[i.status].label}`}
                    onClick={() => onOpenTask(i.id)}>
                    <span className="cal-chip-dot" style={{ background: i.spaceColor }} />
                    {i.time && <span className="cal-chip-time">{fmtTime(i.time)}</span>}
                    <span className="cal-chip-text">{i.title}</span>
                    <span className="ovcal-status-sq" style={{ background: STATUS[i.status].color }} title={STATUS[i.status].label} />
                  </div>
                ))}
                {dayItems.length > 4 && <div className="cal-more">+{dayItems.length - 4} more</div>}
              </div>
            </div>
          );
        })}
      </div>

      {quickAdd && onAddTask && (
        <QuickAddTaskModal boards={boards} dateIso={quickAdd} onClose={() => setQuickAdd(null)}
          onCreate={(boardId, groupId, item) => onAddTask(boardId, groupId, item)} />
      )}
    </div>
  );
}

function OverviewView({ boards, onOpenBoard, onOpenTask, onStat }) {
  const all = [];
  Object.values(boards).forEach((b) =>
    b.groups.forEach((g) => g.items.forEach((i) => all.push({ ...i, boardId: b.id, boardName: b.name })))
  );
  const today = isoToday();

  const count = (s) => all.filter((i) => i.status === s).length;
  const total = all.length;
  const done = count('done');
  const overdue = all.filter((i) => i.due && !i.done && i.due < today).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const stats = [
    { num: total, label: 'All tasks', color: 'var(--accent)', filter: 'all' },
    { num: count('working'), label: 'In progress', color: '#f0a93e', filter: 'working' },
    { num: count('stuck'), label: 'Stuck', color: '#e36b6b', filter: 'stuck' },
    { num: overdue, label: 'Overdue', color: '#d2553f', filter: 'overdue' },
    { num: done, label: 'Done', color: '#3fae6b', filter: 'done' },
  ];

  const seg = STATUS_ORDER.map((s) => ({ s, n: count(s) })).filter((x) => x.n > 0);

  // due soon: undone with a date today or later, soonest first
  const dueSoon = all
    .filter((i) => i.due && !i.done && i.due >= today)
    .sort((a, b) => (a.due < b.due ? -1 : 1))
    .slice(0, 6);

  return (
    <div className="ov">
      <div className="ov-inner">
        <div className="ov-stats">
          {stats.map((s) => (
            <button key={s.label} className="ov-stat" onClick={() => onStat(s.filter, s.label)} title={`View ${s.label.toLowerCase()}`}>
              <span className="ov-stat-acc" style={{ background: s.color }} />
              <div className="ov-stat-num" style={{ color: s.color }}>{s.num}</div>
              <div className="ov-stat-label">{s.label} <span className="ov-stat-arrow">→</span></div>
            </button>
          ))}
        </div>

        <div className="ov-cols">
          <div className="ov-section">
            <div className="ov-sec-head">
              <h3 className="ov-sec-title">Status breakdown</h3>
              <span className="ov-sec-meta">{pct}% complete</span>
            </div>
            <div className="ov-statusbar">
              {seg.map((x) => (
                <span key={x.s} style={{ flex: x.n, background: STATUS[x.s].color }} title={`${STATUS[x.s].label}: ${x.n}`} />
              ))}
            </div>
            <div className="ov-legend">
              {STATUS_ORDER.map((s) => (
                <div key={s} className="ov-leg-item">
                  <span className="ov-leg-dot" style={{ background: STATUS[s].color }} />
                  <span className="ov-leg-label">{STATUS[s].label}</span>
                  <span className="ov-leg-num">{count(s)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ov-section">
            <div className="ov-sec-head"><h3 className="ov-sec-title">Due soon</h3></div>
            <div className="ov-due">
              {dueSoon.length === 0 && <div className="ov-empty">Nothing scheduled — you're all caught up.</div>}
              {dueSoon.map((i) => {
                const f = fmtDue(i.due);
                return (
                  <div key={i.id} className="ov-due-row" onClick={() => onOpenTask(i.id)}>
                    <span className="ov-due-dot" style={{ background: STATUS[i.status].color }} />
                    <span className="ov-due-title">{i.title}</span>
                    <span className="ov-due-board">{i.boardName}</span>
                    <span className={`ov-due-date ${f.tone}`}>{f.rel || f.base}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="ov-section">
          <div className="ov-sec-head"><h3 className="ov-sec-title">By board</h3></div>
          <div className="ov-boards">
            {Object.values(boards).map((b) => {
              const items = b.groups.flatMap((g) => g.items);
              const bd = items.filter((i) => i.done).length;
              const bt = items.length;
              const bp = bt ? Math.round((bd / bt) * 100) : 0;
              return (
                <button key={b.id} className="ov-board-card" onClick={() => onOpenBoard(b.id)}>
                  <div className="ov-board-top">
                    <Icon name={b.icon} size={18} />
                    <span className="ov-board-name">{b.name}</span>
                    <Icon name="arrowRight" size={15} style={{ marginLeft: 'auto', opacity: .4 }} />
                  </div>
                  <div className="ov-board-track"><span className="ov-board-fill" style={{ width: `${bp}%` }} /></div>
                  <div className="ov-board-meta">
                    <span>{bd} of {bt} done</span>
                    <span className="ov-board-pct">{bp}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatList({ boards, filter, label, onOpenTask, onBack }) {
  const today = isoToday();
  const all = [];
  Object.values(boards).forEach((b) =>
    b.groups.forEach((g) => g.items.forEach((i) => all.push({ ...i, boardName: b.name, groupName: g.name })))
  );
  const match = (i) => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return i.due && !i.done && i.due < today;
    if (filter === 'done') return i.done;
    return i.status === filter && !i.done;
  };
  const list = all.filter(match).sort((a, b) => {
    if (!a.due && !b.due) return 0; if (!a.due) return 1; if (!b.due) return -1;
    return a.due < b.due ? -1 : 1;
  });

  return (
    <div className="ov">
      <div className="ov-inner">
        <button className="statlist-back" onClick={onBack}>
          <Icon name="chevron" size={15} style={{ transform: 'rotate(180deg)' }} /> Overview
        </button>
        <div className="statlist-head">
          <h2 className="statlist-title">{label}</h2>
          <span className="statlist-count">{list.length} task{list.length === 1 ? '' : 's'}</span>
        </div>
        {list.length === 0 ? (
          <div className="ov-empty">No tasks here.</div>
        ) : (
          <div className="statlist">
            {list.map((i) => {
              const f = i.due ? fmtDue(i.due) : null;
              const subs = i.subtasks || [];
              const subDone = subs.filter((s) => s.done).length;
              return (
                <div key={i.id} className={`statlist-row ${i.done ? 'is-done' : ''}`} onClick={() => onOpenTask(i.id)}>
                  <span className="statlist-dot" style={{ background: STATUS[i.status].color }} title={STATUS[i.status].label} />
                  <span className="statlist-name">{i.title}</span>
                  <span className="statlist-sub">{subs.length > 0 && (<><Icon name="subtask" size={12} /> {subDone}/{subs.length}</>)}</span>
                  <span className="statlist-board">{i.boardName}</span>
                  <span className="statlist-status" style={{ color: STATUS[i.status].color }}>{STATUS[i.status].label}</span>
                  <span className={`statlist-due ${f ? f.tone : ''}`}>{f ? (f.rel || f.base) : '—'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { OverviewView, StatList, AllSpacesCalendar });
