// calendar.jsx — month grid with task chips + inline task creation. Attaches to window.
const { useState: useCalState, useRef: useCalRef, useEffect: useCalEffect } = React;

function CalendarView({ board, onAddTask, onOpenTask, holidays = [], onAddHoliday, onEditHoliday, onDeleteHoliday }) {
  // collect all dated items across groups, with their group color
  const items = [];
  board.groups.forEach((g) => g.items.forEach((i) => { if (i.due) items.push({ ...i, groupColor: g.color }); }));

  const [view, setView] = useCalState({ y: TODAY.getFullYear(), m: TODAY.getMonth() });
  const [adding, setAdding] = useCalState(null); // dateIso being added to
  const [draft, setDraft] = useCalState('');
  const [editHol, setEditHol] = useCalState(null);
  const inputRef = useCalRef(null);
  useCalEffect(() => { if (adding && inputRef.current) inputRef.current.focus(); }, [adding]);

  const first = new Date(view.y, view.m, 1);
  const startWd = first.getDay();
  const daysIn = new Date(view.y, view.m + 1, 0).getDate();
  const todayIso = isoToday();

  // build 6-week grid
  const cells = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let day = 1; day <= daysIn; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const byDate = {};
  const _pad2 = (n) => String(n).padStart(2, '0');
  const _mIso = (day) => `${view.y}-${_pad2(view.m + 1)}-${_pad2(day)}`;
  const monthStart = _mIso(1), monthEnd = _mIso(daysIn);
  items.forEach((i) => { repeatDatesInRange(i, monthStart, monthEnd).forEach((dt) => { (byDate[dt] = byDate[dt] || []).push(i); }); });
  const holsByDate = {};
  holidays.forEach((h) => { (holsByDate[h.date] = holsByDate[h.date] || []).push(h); });

  const prev = () => setView((v) => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 });
  const next = () => setView((v) => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 });

  const iso = (day) => `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const startAdd = (dayIso) => { setAdding(dayIso); setDraft(''); };
  const commitAdd = () => {
    if (draft.trim() && adding) onAddTask(adding, draft.trim());
    setDraft(''); setAdding(null);
  };

  return (
    <div className="cal-wrap">
      <div className="cal-top">
        <h2 className="cal-title">{MONTHS[view.m]} <span>{view.y}</span></h2>
        <div className="cal-nav">
          <button onClick={prev} aria-label="Previous month"><Icon name="chevron" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
          <button className="cal-today-btn" onClick={() => setView({ y: TODAY.getFullYear(), m: TODAY.getMonth() })}>Today</button>
          <button onClick={next} aria-label="Next month"><Icon name="chevron" size={18} /></button>
        </div>
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
          const isAdding = adding === dayIso;
          const cellClick = (e) => {
            if (e.target.closest('.cal-chip') || e.target.closest('.cal-add-input') || e.target.closest('.cal-more')) return;
            startAdd(dayIso);
          };
          return (
            <div key={idx} className={`cal-cell ${isToday ? 'today' : ''} ${isAdding ? 'adding' : ''}`} onClick={cellClick}>
              <div className="cal-date">
                <button className="cal-add" aria-label="Add task" onClick={(e) => { e.stopPropagation(); startAdd(dayIso); }}>
                  <Icon name="plus" size={14} />
                </button>
                <span className={isToday ? 'cal-date-num today' : 'cal-date-num'}>{day}</span>
              </div>
              <div className="cal-chips">
                {(holsByDate[dayIso] || []).map((h) => (
                  <HolidayChip key={h.id} hol={h} open={editHol === h.id}
                    onOpen={() => setEditHol(h.id)} onClose={() => setEditHol(null)}
                    onEdit={onEditHoliday} onDelete={(id) => { onDeleteHoliday(id); setEditHol(null); }} />
                ))}
                {dayItems.slice(0, isAdding ? 3 : 4).map((i) => (
                  <div key={i.id} className={`cal-chip ${i.done ? 'done' : ''}`} title={i.title}
                    onClick={(e) => { e.stopPropagation(); onOpenTask(i.id); }}>
                    <span className="cal-chip-dot" style={{ background: STATUS[i.status].color }} />
                    {i.time && <span className="cal-chip-time">{fmtTime(i.time)}</span>}
                    <span className="cal-chip-text">{i.title}</span>
                  </div>
                ))}
                {!isAdding && dayItems.length > 4 && <div className="cal-more">+{dayItems.length - 4} more</div>}
                {isAdding && (
                  <input ref={inputRef} className="cal-add-input" placeholder="New task\u2026" value={draft}
                    onChange={(e) => setDraft(e.target.value)} onBlur={commitAdd}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') { setDraft(''); setAdding(null); } }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { CalendarView });
