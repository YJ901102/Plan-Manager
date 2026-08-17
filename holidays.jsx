// holidays.jsx — calendar-only holiday chips + inline editor. Attaches to window.
// Holidays live outside the task boards: they show on the calendar, never in the
// task table, and stay fully editable (name, date, region) — plus deletable.
const { useRef: useHolRef } = React;

function HolidayEditor({ anchorRef, hol, onEdit, onDelete, onClose }) {
  const { useState: useHE } = React;
  const [name, setName] = useHE(hol.name);
  const [date, setDate] = useHE(hol.date);
  const [country, setCountry] = useHE(hol.country);

  const commit = () => {
    onEdit(hol.id, { name: (name.trim() || hol.name), date, country });
    onClose();
  };

  return (
    <PopMenu anchorRef={anchorRef} align="left" width={248} onClose={commit}>
      <div className="hol-edit">
        <div className="hol-edit-label">Holiday name</div>
        <input className="hol-edit-input" autoFocus value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />

        <div className="hol-edit-label">Date</div>
        <input className="hol-edit-input" type="date" value={date}
          onChange={(e) => setDate(e.target.value)} />

        <div className="hol-edit-label">Region</div>
        <div className="hol-edit-countries">
          {Object.values(HOLIDAY_COUNTRIES).map((c) => (
            <button key={c.id} className={`hol-edit-country ${country === c.id ? 'on' : ''}`}
              style={{ '--hc': c.color }} onClick={() => setCountry(c.id)}>
              <span className="hol-edit-dot" style={{ background: c.color }} />{c.label}
            </button>
          ))}
        </div>

        <div className="hol-edit-foot">
          <button className="hol-edit-del" onClick={() => { onDelete(hol.id); onClose(); }}>
            <Icon name="trash" size={14} /> Delete
          </button>
          <button className="hol-edit-done" onClick={commit}>Done</button>
        </div>
      </div>
    </PopMenu>
  );
}

function HolidayChip({ hol, open, onOpen, onClose, onEdit, onDelete }) {
  const ref = useHolRef(null);
  const c = HOLIDAY_COUNTRIES[hol.country] || HOLIDAY_COUNTRIES.DE;
  return (
    <>
      <div ref={ref} className="cal-hol" style={{ '--hc': c.color }}
        title={`${hol.name} · ${c.label} holiday`}
        onClick={(e) => { e.stopPropagation(); onOpen(); }}>
        <span className="cal-hol-badge" style={{ background: c.color }}>{c.short}</span>
        <span className="cal-hol-text">{hol.name}</span>
      </div>
      {open && (
        <HolidayEditor anchorRef={ref} hol={hol} onEdit={onEdit} onDelete={onDelete} onClose={onClose} />
      )}
    </>
  );
}

Object.assign(window, { HolidayChip, HolidayEditor });
