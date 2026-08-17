// sharemodal.jsx — share a workspace, a single space, or a single task.
// Prototype sharing: generates a link, lets you set general access + invite
// people by email with a role. Access lists persist via the `shares` store
// (keyed by scope+id) passed down from App. Attaches to window.
const { useState: useShState, useRef: useShRef } = React;

const ACCESS_ROLES = [
  { v: 'view', label: 'Can view', desc: 'See tasks and details' },
  { v: 'comment', label: 'Can comment', desc: 'View and leave comments' },
  { v: 'edit', label: 'Can edit', desc: 'Full edit access' },
];
const roleLabel = (v) => (ACCESS_ROLES.find((r) => r.v === v) || ACCESS_ROLES[0]).label;
const SCOPES = [
  { v: 'workspace', label: 'Workspace', icon: 'grid', sub: 'Everything in this workspace' },
  { v: 'space', label: 'Space', icon: 'folder', sub: 'A single space and its tasks' },
  { v: 'task', label: 'Task', icon: 'check', sub: 'Just one task' },
];

// stable slug for the share link
const slugify = (s) => (s || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 28) || 'item';

function RolePicker({ value, onChange, onRemove, compact }) {
  const [open, setOpen] = useShState(false);
  const ref = useShRef(null);
  return (
    <div className="sh-role" ref={ref}>
      <button className="sh-role-btn" onClick={() => setOpen((o) => !o)}>
        {roleLabel(value)} <Icon name="chevronDown" size={13} />
      </button>
      {open && (
        <PopMenu anchorRef={ref} align="right" width={208} onClose={() => setOpen(false)}>
          {ACCESS_ROLES.map((r) => (
            <button key={r.v} className={`sh-role-opt ${value === r.v ? 'on' : ''}`} onClick={() => { onChange(r.v); setOpen(false); }}>
              <span className="sh-role-opt-main"><b>{r.label}</b><i>{r.desc}</i></span>
              {value === r.v && <Icon name="check" size={15} stroke={3} />}
            </button>
          ))}
          {onRemove && (
            <>
              <div className="menu-divider" />
              <button className="sh-role-opt danger" onClick={() => { onRemove(); setOpen(false); }}>
                <Icon name="trash" size={14} /> Remove access
              </button>
            </>
          )}
        </PopMenu>
      )}
    </div>
  );
}

function ShareModal({ scope: initialScope, targetId: initialTarget, boards, workspaceName, shares, onUpdateShare, onClose }) {
  const [scope, setScope] = useShState(initialScope || 'space');
  const [target, setTarget] = useShState(initialTarget || Object.keys(boards)[0]);

  // resolve the thing being shared → a display name + flat task list per space
  const allTasks = [];
  const _seen = new Set();
  Object.values(boards).forEach((b) => b.groups.forEach((g) => g.items.forEach((i) => {
    if (_seen.has(i.id)) return; // guard against any legacy duplicate ids
    _seen.add(i.id);
    allTasks.push({ id: i.id, title: i.title, board: b.name });
  })));

  let targetName = workspaceName, targetIcon = 'grid';
  if (scope === 'space') { const b = boards[target] || Object.values(boards)[0]; targetName = b ? b.name : '—'; targetIcon = b ? (b.icon || 'folder') : 'folder'; }
  else if (scope === 'task') { const t = allTasks.find((x) => x.id === target); targetName = t ? t.title : '—'; targetIcon = 'check'; }
  else { targetName = workspaceName; targetIcon = 'grid'; }

  const shareKey = `${scope}:${scope === 'workspace' ? 'ws' : target}`;
  const rec = shares[shareKey] || { general: 'restricted', generalRole: 'view', people: [] };
  const patch = (p) => onUpdateShare(shareKey, { ...rec, ...p });

  const link = `https://flow.app/${scope === 'workspace' ? 'w' : scope === 'space' ? 's' : 't'}/${slugify(targetName)}-${(scope === 'workspace' ? 'ws' : target).slice(-4)}`;
  const [copied, setCopied] = useShState(false);
  const copyLink = () => {
    navigator.clipboard && navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  // invite
  const [email, setEmail] = useShState('');
  const [inviteRole, setInviteRole] = useShState('edit');
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const invite = () => {
    if (!valid) return;
    const e = email.trim().toLowerCase();
    if (rec.people.some((p) => p.email === e)) { setEmail(''); return; }
    patch({ people: [...rec.people, { email: e, role: inviteRole }] });
    setEmail('');
  };
  const setPersonRole = (e, role) => patch({ people: rec.people.map((p) => p.email === e ? { ...p, role } : p) });
  const removePerson = (e) => patch({ people: rec.people.filter((p) => p.email !== e) });

  // choose target when scope needs one
  const needsPicker = scope === 'space' || scope === 'task';
  const pickerOptions = scope === 'space'
    ? Object.values(boards).map((b) => ({ id: b.id, label: b.name }))
    : allTasks.map((t) => ({ id: t.id, label: `${t.title}` }));

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal sh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2 className="modal-title">Share</h2>
            <p className="modal-sub">Invite people or create a link. Choose exactly what to share.</p>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            <Icon name="plus" size={20} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </div>

        {/* scope chooser */}
        <div className="sh-scopes">
          {SCOPES.map((s) => (
            <button key={s.v} className={`sh-scope ${scope === s.v ? 'on' : ''}`} onClick={() => {
              setScope(s.v);
              if (s.v === 'space') setTarget(Object.keys(boards)[0]);
              if (s.v === 'task') setTarget((allTasks[0] || {}).id);
            }}>
              <span className="sh-scope-ic"><Icon name={s.icon} size={17} /></span>
              <span className="sh-scope-main"><b>{s.label}</b><i>{s.sub}</i></span>
              <span className="sh-scope-radio">{scope === s.v && <span className="sh-scope-dot" />}</span>
            </button>
          ))}
        </div>

        <div className="modal-body sh-body">
          {needsPicker && (
            <label className="sh-target">
              <span className="sh-target-ic"><Icon name={targetIcon} size={16} /></span>
              <select className="sh-target-sel" value={target} onChange={(e) => setTarget(e.target.value)}>
                {pickerOptions.map((o, i) => <option key={o.id + '-' + i} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          )}

          {/* invite row */}
          <div className="sh-invite">
            <input className="sh-invite-input" type="email" placeholder="Add people by email…" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') invite(); }} />
            <RolePicker value={inviteRole} onChange={setInviteRole} />
            <button className="btn primary sh-invite-btn" disabled={!valid} onClick={invite}>Invite</button>
          </div>

          {/* people with access */}
          <div className="sh-people">
            <div className="sh-people-row">
              <Avatar ownerId="you" size={32} />
              <div className="sh-person-main"><b>You</b><i>you@icloud.com</i></div>
              <span className="sh-person-owner">Owner</span>
            </div>
            {rec.people.map((p) => (
              <div key={p.email} className="sh-people-row">
                <span className="sh-person-av" style={{ background: '#1fb5a3' }}>{p.email[0].toUpperCase()}</span>
                <div className="sh-person-main"><b>{p.email.split('@')[0]}</b><i>{p.email}</i></div>
                <RolePicker value={p.role} onChange={(r) => setPersonRole(p.email, r)} onRemove={() => removePerson(p.email)} />
              </div>
            ))}
          </div>

          {/* general access */}
          <div className="sh-general">
            <div className="sh-general-head">General access</div>
            <div className="sh-general-row">
              <span className={`sh-gen-ic ${rec.general === 'link' ? 'open' : ''}`}>
                <Icon name={rec.general === 'link' ? 'link' : 'lock'} size={18} />
              </span>
              <div className="sh-gen-main">
                <select className="sh-gen-sel" value={rec.general} onChange={(e) => patch({ general: e.target.value })}>
                  <option value="restricted">Restricted</option>
                  <option value="link">Anyone with the link</option>
                </select>
                <span className="sh-gen-sub">
                  {rec.general === 'link' ? 'Anyone with the link can access this ' + scope : 'Only invited people can access'}
                </span>
              </div>
              {rec.general === 'link' && (
                <div className="sh-gen-role"><RolePicker value={rec.generalRole} onChange={(r) => patch({ generalRole: r })} /></div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-foot sh-foot">
          <button className={`sh-copy ${copied ? 'done' : ''}`} onClick={copyLink}>
            <Icon name={copied ? 'check' : 'link'} size={15} /> {copied ? 'Link copied' : 'Copy link'}
          </button>
          <div className="foot-actions">
            <span className="sh-foot-note">{rec.people.length > 0 ? `Shared with ${rec.people.length} ${rec.people.length === 1 ? 'person' : 'people'}` : 'Not shared yet'}</span>
            <button className="btn primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ShareModal });
