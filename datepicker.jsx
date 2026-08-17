// datepicker.jsx — due-date popover: single date, range, and time. Attaches to window.
const { useState: useDpState, useRef: useDpRef, useEffect: useDpEffect, useLayoutEffect } = React;

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

// Build a display label for a task's date fields. Returns {text, tone} or null.
function dueLabel(item) {
  if (!item.due) return null;
  const s = fmtDue(item.due);
  let text = item.dueEnd ? `${s.base} – ${fmtDue(item.dueEnd).base}` : (s.rel || s.base);
  if (item.time) text += ` · ${fmtTime(item.time)}`;
  return { text, tone: s.tone };
}

function DatePopover({ item, anchorRect, anchorEl, onChange, onClose, noTime }) {
  const [start, setStart] = useDpState(item.due || null);
  const [end, setEnd] = useDpState(item.dueEnd || null);
  const [time, setTime] = useDpState(item.time || '');
  const init = start ? new Date(start + 'T00:00:00') : new Date(TODAY);
  const [vm, setVm] = useDpState({ y: init.getFullYear(), m: init.getMonth() });
  const ref = useDpRef(null);
  const [pos, setPos] = useDpState({ top: -9999, left: -9999 });

  // place relative to anchor, flipping above if needed
  useLayoutEffect(() => {
    const h = ref.current ? ref.current.offsetHeight : 340;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = Math.min(anchorRect.left, vw - 292);
    left = Math.max(12, left);
    let top = anchorRect.bottom + 6;
    if (top + h > vh - 8) top = Math.max(8, anchorRect.top - h - 6);
    setPos({ top, left });
  }, []);

  // outside click / escape
  useDpEffect(() => {
    const onDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (anchorEl && anchorEl.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  const emit = (s, e, t) => onChange(s, e, t || null);

  const pickDay = (iso) => {
    if (!start || (start && end)) { setStart(iso); setEnd(null); emit(iso, null, time); }
    else if (iso < start) { setStart(iso); setEnd(null); emit(iso, null, time); }
    else if (iso === start) { emit(iso, null, time); }
    else { setEnd(iso); emit(start, iso, time); }
  };
  const setT = (val) => { setTime(val); if (start) emit(start, end, val); };
  const clearAll = () => { setStart(null); setEnd(null); setTime(''); onChange(null, null, null); onClose(); };

  const first = new Date(vm.y, vm.m, 1);
  const startWd = first.getDay();
  const daysIn = new Date(vm.y, vm.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let day = 1; day <= daysIn; day++) cells.push(day);
  const iso = (day) => `${vm.y}-${String(vm.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const todayIso = isoToday();
  const prev = () => setVm((v) => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 });
  const next = () => setVm((v) => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 });

  return (
    <div className="dp" ref={ref} style={{ top: pos.top, left: pos.left }}>
      <div className="dp-head">
        <div className="dp-title">{MONTHS[vm.m]} {vm.y}</div>
        <div className="dp-nav">
          <button onClick={prev} aria-label="Previous"><Icon name="chevron" size={15} style={{ transform: 'rotate(180deg)' }} /></button>
          <button onClick={next} aria-label="Next"><Icon name="chevron" size={15} /></button>
        </div>
      </div>
      <div className="dp-grid">
        {WD.map((w) => <div key={w} className="dp-wd">{w[0]}</div>)}
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} />;
          const di = iso(day);
          const isStart = di === start, isEnd = di === end;
          const inRange = start && end && di > start && di < end;
          const cls = ['dp-day'];
          if (di === todayIso) cls.push('today');
          if (isStart || isEnd) cls.push('edge');
          if (inRange) cls.push('inrange');
          return <button key={idx} className={cls.join(' ')} onClick={() => pickDay(di)}>{day}</button>;
        })}
      </div>
      <div className="dp-hint">{start && !end ? 'Tap another day for a range' : end ? 'Range set' : 'Pick a due date'}</div>
      <div className="dp-foot">
        {!noTime && <label className="dp-time"><Icon name="clock" size={14} /><input type="time" value={time} onChange={(e) => setT(e.target.value)} /></label>}
        <button className="dp-clear" onClick={clearAll}>Clear</button>
        <button className="dp-done" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

Object.assign(window, { DatePopover, dueLabel, fmtTime });
