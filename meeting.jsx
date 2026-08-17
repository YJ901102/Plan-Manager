// meeting.jsx — live meeting recorder: mic transcription (EN/ZH/DE auto-detect),
// speaker labels, AI summary + decisions + action items, push to "Meetings" space.
// Attaches MeetingRecorder + helpers to window.
const { useState: useMtgState, useEffect: useMtgEffect, useRef: useMtgRef, useMemo: useMtgMemo } = React;

// ---- language model ----
const LANGS = {
  en: { code: 'en', rec: 'en-US', name: 'English', native: 'English' },
  zh: { code: 'zh', rec: 'zh-CN', name: 'Chinese', native: '中文' },
  de: { code: 'de', rec: 'de-DE', name: 'German', native: 'Deutsch' },
};
const DE_HINT = /\b(und|oder|nicht|wir|ich|ist|sind|wird|werden|für|mit|auf|ein|eine|einen|müssen|machen|nächste|woche|haben|sollten|über|aber|noch|schon|bitte|danke|projekt)\b/i;
function detectLang(text) {
  if (!text) return null;
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[äöüß]/i.test(text) || DE_HINT.test(text)) return 'de';
  if (/[a-z]/i.test(text)) return 'en';
  return null;
}

// ---- calendar auto-detect (matches IMPORT_SOURCES against the demo "today") ----
function mtgToMin(t) {
  if (!t || /all day/i.test(t)) return null;
  const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t);
  if (!m) return null;
  let h = (+m[1]) % 12; if (/pm/i.test(m[3])) h += 12;
  return h * 60 + (+m[2]);
}
function detectMeeting() {
  const today = window.TODAY || new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const src = window.IMPORT_SOURCES || {};
  const all = [];
  Object.values(src).forEach((s) => (s.events || []).forEach((e) => all.push({ ...e, source: s.name })));
  const todays = all.filter((e) => e.date === iso);
  const pool = todays.length ? todays : all;
  let best = null, bestD = 1e9;
  pool.forEach((e) => { const t = mtgToMin(e.time); const dd = t == null ? 720 : Math.abs(t - nowMin); if (dd < bestD) { bestD = dd; best = e; } });
  return { detected: best, list: pool, iso };
}

// ---- robust JSON extraction from a model reply ----
function parseLooseJSON(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/^```(json)?/i, '').replace(/```$/,'').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch (e) { return null; }
}

// ---- offline fallback so the flow always completes without the API ----
function localNotes(transcript, langCode) {
  const lines = transcript.map((s) => s.text).filter(Boolean);
  const joined = lines.join(' ');
  const sents = joined.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
  const summary = sents.slice(0, 2).join(' ') || joined.slice(0, 200);
  const decisions = [];
  const actionItems = [];
  const dec = /(decided|agree|agreed|we'll go with|let's go with|conclusion|beschlossen|einig|决定|同意)/i;
  const act = /(will|need to|should|let's|action|todo|to-do|follow up|by (monday|tuesday|wednesday|thursday|friday|next week)|müssen|sollte|erledigen|负责|跟进|下周)/i;
  transcript.forEach((s) => {
    if (dec.test(s.text) && decisions.length < 5) decisions.push(s.text.replace(/^[a-z]/, (c) => c.toUpperCase()));
    if (act.test(s.text) && actionItems.length < 8) {
      actionItems.push({ title: s.text.length > 90 ? s.text.slice(0, 87) + '…' : s.text, owner: s.name || '', due: '', priority: 'medium' });
    }
  });
  return { summary, decisions, actionItems };
}

async function generateMeetingNotes(transcript, langCode, dateIso) {
  const L = LANGS[langCode] || LANGS.en;
  const text = transcript.map((s) => `${s.name || ('Speaker ' + s.speaker)}: ${s.text}`).join('\n');
  const prompt = `You are a meeting-notes assistant. Today is ${dateIso}. Below is a meeting transcript in ${L.name}. Respond with ONLY valid JSON (no markdown, no commentary) in EXACTLY this shape:
{"summary":"2-3 sentence TL;DR","decisions":["decision 1","decision 2"],"actionItems":[{"title":"task","owner":"person name or empty string","due":"YYYY-MM-DD or empty string","priority":"high|medium|low"}]}
Write the summary, every decision, and every action-item title in ${L.name} — the same language as the meeting. Convert relative dates ("next week", "Friday", "下周", "nächste Woche") into absolute YYYY-MM-DD based on today. Only include real action items that were actually raised. Transcript:\n${text}`;
  let raw = null;
  try {
    if (window.claude && window.claude.complete) raw = await window.claude.complete(prompt);
  } catch (e) { raw = null; }
  let data = parseLooseJSON(raw);
  if (!data || (!data.summary && !data.actionItems)) data = localNotes(transcript, langCode);
  data.summary = data.summary || '';
  data.decisions = Array.isArray(data.decisions) ? data.decisions.filter(Boolean) : [];
  data.actionItems = (Array.isArray(data.actionItems) ? data.actionItems : []).map((a) => ({
    title: (a.title || '').trim(), owner: (a.owner || '').trim(),
    due: /^\d{4}-\d{2}-\d{2}$/.test(a.due || '') ? a.due : '',
    priority: ['high', 'medium', 'low'].includes(a.priority) ? a.priority : 'medium',
    include: true,
  })).filter((a) => a.title);
  return data;
}

// ---- sample meetings (used if the browser blocks the mic, so the flow is testable) ----
const SAMPLE_MEETINGS = {
  en: [
    { speaker: 1, text: "Alright, let's kick off the product sync. First thing — where are we on the calendar sync feature?" },
    { speaker: 2, text: "We're blocked on the Google OAuth scopes. I submitted the review request but it'll take a few days." },
    { speaker: 1, text: "Okay. Let's go with the Apple EventKit path first and ship that this week, then add Google once approval lands." },
    { speaker: 2, text: "Works for me. I'll have the EventKit hook ready by Thursday." },
    { speaker: 1, text: "Great. Maya, can you finish the onboarding copy review before Friday so we don't block the release?" },
    { speaker: 3, text: "Yes, I'll review the onboarding flow copy and send notes by Friday." },
    { speaker: 1, text: "Last thing — we decided to push the dark mode pass to next sprint. Everyone good with that? Okay, decided." },
  ],
  zh: [
    { speaker: 1, text: "我们开始产品同步会议吧。日历同步功能现在进展怎么样？" },
    { speaker: 2, text: "我们被谷歌的 OAuth 权限卡住了，审核请求已经提交，但还要几天。" },
    { speaker: 1, text: "好，那我们先做苹果 EventKit 这条路，这周先上线，谷歌等批准了再加。" },
    { speaker: 2, text: "可以，我周四之前把 EventKit 的接口做好。" },
    { speaker: 1, text: "玛雅，你能在周五之前完成新手引导文案的审核吗？别耽误发布。" },
    { speaker: 3, text: "可以，我会审核引导流程的文案，周五之前发给你。" },
    { speaker: 1, text: "最后一件事，我们决定把深色模式推迟到下个迭代。大家没问题吧？好，就这么定了。" },
  ],
  de: [
    { speaker: 1, text: "Gut, lass uns mit dem Produkt-Sync anfangen. Wie ist der Stand bei der Kalender-Synchronisierung?" },
    { speaker: 2, text: "Wir sind bei den Google OAuth-Berechtigungen blockiert. Die Freigabe dauert noch ein paar Tage." },
    { speaker: 1, text: "Okay, dann machen wir zuerst den Apple-EventKit-Weg und liefern das diese Woche, Google kommt nach der Freigabe." },
    { speaker: 2, text: "Passt. Ich habe die EventKit-Anbindung bis Donnerstag fertig." },
    { speaker: 1, text: "Maya, kannst du die Onboarding-Texte bis Freitag prüfen, damit wir das Release nicht aufhalten?" },
    { speaker: 3, text: "Ja, ich prüfe die Texte und schicke meine Notizen bis Freitag." },
    { speaker: 1, text: "Letzter Punkt — wir haben beschlossen, den Dark-Mode auf den nächsten Sprint zu verschieben. Einverstanden? Gut, beschlossen." },
  ],
};

// ---- mic level meter ----
function useMicLevel(active) {
  const [level, setLevel] = useMtgState(0);
  useMtgEffect(() => {
    if (!active || !navigator.mediaDevices) return;
    let ctx, raf, stream, dead = false;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
      if (dead) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      const src = ctx.createMediaStreamSource(s);
      const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteTimeDomainData(data);
        let sum = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 3.2));
        raf = requestAnimationFrame(tick);
      };
      tick();
    }).catch(() => {});
    return () => { dead = true; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); if (ctx && ctx.state !== 'closed') ctx.close(); };
  }, [active]);
  return level;
}

function LevelBars({ level, active }) {
  const N = 28;
  return (
    <div className="mtg-bars">
      {Array.from({ length: N }).map((_, i) => {
        const center = 1 - Math.abs(i - (N - 1) / 2) / ((N - 1) / 2);
        const h = active ? Math.max(0.08, level * (0.45 + center * 0.85) * (0.7 + Math.random() * 0.5)) : 0.08;
        return <span key={i} style={{ height: `${Math.min(100, h * 100)}%` }} />;
      })}
    </div>
  );
}

// ---- main recorder ----
function MeetingRecorder({ onClose, onMinimize, onUpdate, minimized = false, onSave, layout = 'stacked' }) {
  const initial = useMtgMemo(() => detectMeeting(), []);
  const [phase, setPhase] = useMtgState('record'); // record | generating | review
  const [title, setTitle] = useMtgState(initial.detected ? initial.detected.title : 'Untitled meeting');
  const [pickOpen, setPickOpen] = useMtgState(false);
  const [segments, setSegments] = useMtgState([]);
  const [interim, setInterim] = useMtgState('');
  const [recording, setRecording] = useMtgState(false);
  const [elapsed, setElapsed] = useMtgState(0);
  const [langMode, setLangMode] = useMtgState('auto'); // auto | en | zh | de
  const [detected, setDetected] = useMtgState('en');
  const [mode, setMode] = useMtgState(null); // 'live' | 'sample' | 'denied'
  const [notes, setNotes] = useMtgState(null);
  const [speakerNames, setSpeakerNames] = useMtgState({});
  const [editingSpk, setEditingSpk] = useMtgState(null);

  const recRef = useMtgRef(null);
  const wantRef = useMtgRef(false);
  const langRef = useMtgRef('en-US');
  const lastTsRef = useMtgRef(0);
  const speakerRef = useMtgRef(1);
  const switchedRef = useMtgRef(false);
  const allTextRef = useMtgRef('');
  const sampleRef = useMtgRef(null);
  const scrollRef = useMtgRef(null);

  const level = useMicLevel(mode === 'live' && recording);
  const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const activeLang = langMode === 'auto' ? detected : langMode;

  // ---- append a final utterance, assigning a speaker on pause + tracking language ----
  const pushFinal = (text) => {
    text = (text || '').trim();
    if (!text) return;
    const now = Date.now();
    setSegments((prev) => {
      const gap = lastTsRef.current ? now - lastTsRef.current : 0;
      let sp = speakerRef.current;
      if (prev.length && gap > 2400) { sp = sp === 1 ? 2 : 1; speakerRef.current = sp; }
      return [...prev, { id: now + '_' + prev.length, speaker: sp, text, ts: now }];
    });
    lastTsRef.current = now;
    allTextRef.current += ' ' + text;
    if (langMode === 'auto') {
      const d = detectLang(allTextRef.current.slice(-400));
      if (d) setDetected(d);
    }
  };

  // ---- speech recognition lifecycle ----
  const buildRec = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = langRef.current;
    r.onresult = (e) => {
      let intr = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) pushFinal(res[0].transcript); else intr += res[0].transcript;
      }
      setInterim(intr);
    };
    r.onend = () => { if (wantRef.current) { try { r.start(); } catch (e) {} } };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantRef.current = false; setRecording(false); setMode('denied');
      }
    };
    return r;
  };
  const startLive = () => {
    wantRef.current = true;
    if (!recRef.current) recRef.current = buildRec();
    if (recRef.current) { try { recRef.current.start(); } catch (e) {} setRecording(true); setMode('live'); }
    else setMode('denied');
  };
  // rebuild recognition from scratch (after a denial or stale object)
  const retryLive = () => {
    wantRef.current = false;
    if (recRef.current) { try { recRef.current.onend = null; recRef.current.stop(); } catch (e) {} }
    recRef.current = null;
    setMode(null); setRecording(false);
    setTimeout(() => {
      wantRef.current = true;
      recRef.current = buildRec();
      if (recRef.current) { try { recRef.current.start(); setRecording(true); setMode('live'); } catch (e) { setMode('denied'); } }
      else setMode('denied');
    }, 80);
  };
  const stopRec = () => {
    wantRef.current = false;
    if (recRef.current) { try { recRef.current.stop(); } catch (e) {} }
    if (sampleRef.current) { clearInterval(sampleRef.current); sampleRef.current = null; }
    setRecording(false); setInterim('');
  };

  // auto-start live capture on mount
  useMtgEffect(() => {
    if (supported) startLive(); else setMode('denied');
    return () => stopRec();
  }, []);

  // re-point recognition language when auto-detect settles on a new language (once)
  useMtgEffect(() => {
    if (mode !== 'live' || !recording) return;
    const want = LANGS[activeLang].rec;
    if (want !== langRef.current && (langMode !== 'auto' || !switchedRef.current)) {
      langRef.current = want;
      if (langMode === 'auto') switchedRef.current = true;
      if (recRef.current) {
        const r = recRef.current; recRef.current = null;
        try { r.onend = null; r.stop(); } catch (e) {}
        recRef.current = buildRec();
        try { recRef.current.start(); } catch (e) {}
      }
    }
  }, [activeLang, recording, mode, langMode]);

  // elapsed timer
  useMtgEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  // keep transcript scrolled to the newest line
  useMtgEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [segments, interim]);

  // notify parent of current status (for the minimized pill)
  useMtgEffect(() => {
    if (onUpdate) onUpdate({ elapsed, segCount: segments.length, recording, lang: activeLang, title, phase });
  }, [elapsed, segments.length, recording, activeLang, title, phase]);

  // inIframe never changes — compute once without a hook
  const inIframe = (() => { try { return window.self !== window.top; } catch(e){ return true; } })();

  // when minimized, keep all hooks alive but render nothing
  if (minimized) return null;

  // ---- sample playback (mic blocked / unsupported) ----
  const playSample = (lc) => {
    setMode('sample'); setRecording(true); setSegments([]); setInterim('');
    setLangMode('auto'); setDetected(lc); allTextRef.current = '';
    const script = SAMPLE_MEETINGS[lc] || SAMPLE_MEETINGS.en;
    let i = 0;
    if (sampleRef.current) clearInterval(sampleRef.current);
    sampleRef.current = setInterval(() => {
      if (i >= script.length) { clearInterval(sampleRef.current); sampleRef.current = null; setRecording(false); return; }
      const line = script[i++];
      speakerRef.current = line.speaker;
      setSegments((prev) => [...prev, { id: 'sm' + i, speaker: line.speaker, text: line.text, ts: Date.now() }]);
      allTextRef.current += ' ' + line.text;
      const d = detectLang(allTextRef.current.slice(-400)); if (d) setDetected(d);
    }, 1700);
  };
  const speakerName = (sp) => speakerNames[sp] || `Speaker ${sp}`;

  // ---- generate notes ----
  const doGenerate = async () => {
    stopRec();
    setPhase('generating');
    const named = segments.map((s) => ({ ...s, name: speakerName(s.speaker) }));
    const data = await generateMeetingNotes(named, activeLang, initial.iso);
    setNotes(data);
    setPhase('review');
  };

  const fmtClock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const includedCount = notes ? notes.actionItems.filter((a) => a.include).length : 0;

  // ---- review editing ----
  const setItem = (idx, patch) => setNotes((n) => ({ ...n, actionItems: n.actionItems.map((a, i) => i === idx ? { ...a, ...patch } : a) }));
  const PRIOS = ['high', 'medium', 'low'];
  const PRIO_C = { high: '#e0524a', medium: '#3a72d4', low: '#e09a3c' };

  const finish = () => {
    onSave({
      id: 'mtg' + Date.now(),
      title: title.trim() || 'Untitled meeting',
      date: initial.iso,
      language: activeLang,
      durationSec: elapsed,
      summary: notes.summary,
      decisions: notes.decisions,
      actionItems: notes.actionItems.filter((a) => a.include),
      transcript: segments.map((s) => ({ speaker: s.speaker, name: speakerName(s.speaker), text: s.text })),
    });
  };

  // ===== render =====
  const LangBadge = (
    <div className="mtg-lang">
      <Icon name="globe" size={14} />
      <select value={langMode} onChange={(e) => { setLangMode(e.target.value); switchedRef.current = false; }} className="mtg-lang-sel">
        <option value="auto">Auto · {LANGS[detected].native}</option>
        <option value="en">English</option>
        <option value="zh">中文</option>
        <option value="de">Deutsch</option>
      </select>
    </div>
  );

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && phase !== 'generating') onClose(); }}>
      <div className="mtg" onMouseDown={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="mtg-head">
          <div className="mtg-head-l">
            <span className={`mtg-rec-dot ${recording ? 'on' : ''}`} />
            <div className="mtg-titlewrap">
              <input className="mtg-title" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting title" onFocus={(e) => e.target.select()} />
              <button className="mtg-detected" onClick={() => setPickOpen((o) => !o)}>
                <Icon name="calendar" size={12} />
                {initial.detected ? <span>Auto-detected from calendar</span> : <span>No event found — pick one</span>}
                <Icon name="chevronDown" size={12} />
              </button>
              {pickOpen && (
                <>
                  <div className="sort-backdrop" onClick={() => setPickOpen(false)} />
                  <div className="mtg-pick">
                    <div className="mtg-pick-head">Today’s calendar</div>
                    {initial.list.map((e) => (
                      <button key={e.id} className={`mtg-pick-opt ${e.title === title ? 'on' : ''}`}
                        onClick={() => { setTitle(e.title); setPickOpen(false); }}>
                        <span className="mtg-pick-name">{e.title}</span>
                        <span className="mtg-pick-meta">{e.time} · {e.source}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="mtg-head-r">
            {phase === 'record' && LangBadge}
            {phase === 'record' && <span className="mtg-timer">{fmtClock(elapsed)}</span>}
            <button className="mtg-x" onClick={onMinimize || onClose} aria-label="Minimize"><Icon name="chevronDown" size={18} /></button>
          </div>
        </div>

        {/* body */}
        {phase === 'record' && (
          <>
            <div className="mtg-body">
              {mode === 'denied' && segments.length === 0 ? (
                <div className="mtg-fallback">
                  <div className="mtg-fallback-ic"><Icon name="mic" size={26} /></div>
                  <p className="mtg-fallback-title">Start a sample meeting</p>
                  <p className="mtg-fallback-sub">Pick a language to play a realistic sample — transcription, speaker labels, and AI summary all work live in the app.</p>
                  <div className="mtg-sample-btns">
                    <button className="mtg-sample-big" onClick={() => playSample('en')}><Icon name="mic" size={18} /><span><b>English</b><i>Product sync demo</i></span></button>
                    <button className="mtg-sample-big" onClick={() => playSample('zh')}><Icon name="mic" size={18} /><span><b>中文</b><i>产品同步示例</i></span></button>
                    <button className="mtg-sample-big" onClick={() => playSample('de')}><Icon name="mic" size={18} /><span><b>Deutsch</b><i>Produkt-Sync Demo</i></span></button>
                  </div>
                  {supported && !inIframe && <button className="mtg-live-btn" onClick={retryLive}><Icon name="mic" size={15} /> Use live microphone</button>}
                </div>
              ) : (
                <div className="mtg-transcript" ref={scrollRef}>
                  {segments.length === 0 && !interim && (
                    <div className="mtg-listening">
                      <span className="mtg-listening-pulse" />
                      Listening… start speaking and the transcript appears here.
                    </div>
                  )}
                  {segments.map((s) => (
                    <div key={s.id} className={`mtg-seg spk-${s.speaker}`}>
                      <button className="mtg-spk" onClick={() => setEditingSpk(s.speaker)}>
                        <span className="mtg-spk-dot" />
                        {editingSpk === s.speaker ? (
                          <input autoFocus className="mtg-spk-input" defaultValue={speakerName(s.speaker)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => { setSpeakerNames((m) => ({ ...m, [s.speaker]: e.target.value.trim() || `Speaker ${s.speaker}` })); setEditingSpk(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingSpk(null); }} />
                        ) : speakerName(s.speaker)}
                      </button>
                      <div className="mtg-seg-text">{s.text}</div>
                    </div>
                  ))}
                  {interim && <div className="mtg-seg interim"><div className="mtg-seg-text">{interim}</div></div>}
                </div>
              )}
            </div>
            <div className="mtg-foot">
              <div className="mtg-foot-l">
                <LevelBars level={level} active={recording} />
                <span className="mtg-foot-note">
                  {mode === 'sample' ? 'Playing sample' : recording ? 'Recording' : 'Paused'} · {segments.length} line{segments.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="mtg-foot-r">
                {mode !== 'sample' && (recording
                  ? <button className="mtg-ctl" onClick={stopRec}><Icon name="pause" size={16} /> Pause</button>
                  : (mode !== 'denied' && <button className="mtg-ctl" onClick={startLive}><Icon name="mic" size={16} /> Resume</button>))}
                <button className="mtg-ctl danger" onClick={onClose}>End</button>
                <button className="btn primary" disabled={segments.length === 0} onClick={doGenerate}>
                  <Icon name="sparkles" size={16} /> Stop & summarize
                </button>
              </div>
            </div>
          </>
        )}

        {phase === 'generating' && (
          <div className="mtg-generating">
            <div className="mtg-gen-orb"><Icon name="sparkles" size={26} /></div>
            <p className="mtg-gen-title">Summarizing the meeting…</p>
            <p className="mtg-gen-sub">Writing the recap, decisions and action items in {LANGS[activeLang].native}.</p>
          </div>
        )}

        {phase === 'review' && notes && (
          <>
            <div className={`mtg-review mtg-layout-${layout}`}>
              <div className="mtg-review-grid">
                <section className="mtg-card mtg-card-summary">
                  <h3 className="mtg-card-h"><Icon name="text" size={15} /> Summary</h3>
                  <p className="mtg-summary">{notes.summary || '—'}</p>
                </section>

                <section className="mtg-card mtg-card-decisions">
                  <h3 className="mtg-card-h"><Icon name="check" size={15} /> Decisions <span className="mtg-count">{notes.decisions.length}</span></h3>
                  {notes.decisions.length ? (
                    <ul className="mtg-decisions">
                      {notes.decisions.map((d, i) => <li key={i}><span className="mtg-dec-tick"><Icon name="check" size={12} stroke={3} /></span>{d}</li>)}
                    </ul>
                  ) : <p className="mtg-empty-sm">No explicit decisions detected.</p>}
                </section>

                <section className="mtg-card mtg-card-actions">
                  <h3 className="mtg-card-h"><Icon name="subtask" size={15} /> Action items <span className="mtg-count">{includedCount}/{notes.actionItems.length}</span></h3>
                  <div className="mtg-actions">
                    {notes.actionItems.length === 0 && <p className="mtg-empty-sm">No action items found.</p>}
                    {notes.actionItems.map((a, i) => (
                      <div key={i} className={`mtg-ai ${a.include ? '' : 'off'}`}>
                        <button className={`mtg-ai-check ${a.include ? 'on' : ''}`} onClick={() => setItem(i, { include: !a.include })}>
                          {a.include && <Icon name="check" size={13} stroke={3} />}
                        </button>
                        <div className="mtg-ai-main">
                          <input className="mtg-ai-title" value={a.title} onChange={(e) => setItem(i, { title: e.target.value })} />
                          <div className="mtg-ai-meta">
                            <button className="mtg-ai-prio" style={{ '--pc': PRIO_C[a.priority] }}
                              onClick={() => setItem(i, { priority: PRIOS[(PRIOS.indexOf(a.priority) + 1) % 3] })}>
                              <span className="mtg-ai-dot" />{a.priority}
                            </button>
                            {a.owner && <span className="mtg-ai-owner"><Icon name="user" size={12} /> {a.owner}</span>}
                            {a.due && <span className="mtg-ai-due"><Icon name="calendar" size={12} /> {a.due}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mtg-card mtg-card-transcript">
                  <h3 className="mtg-card-h"><Icon name="chat" size={15} /> Transcript <span className="mtg-count">{LANGS[activeLang].native}</span></h3>
                  <div className="mtg-tr-scroll">
                    {segments.map((s) => (
                      <div key={s.id} className={`mtg-seg spk-${s.speaker}`}>
                        <span className="mtg-spk static"><span className="mtg-spk-dot" />{speakerName(s.speaker)}</span>
                        <div className="mtg-seg-text">{s.text}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
            <div className="mtg-foot">
              <button className="mtg-ctl" onClick={() => setPhase('record')}><Icon name="chevron" size={15} style={{ transform: 'rotate(180deg)' }} /> Back to transcript</button>
              <button className="btn primary" disabled={includedCount === 0} onClick={finish}>
                <Icon name="arrowRight" size={16} /> Save to Meetings · {includedCount} task{includedCount === 1 ? '' : 's'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { MeetingRecorder, detectMeeting, generateMeetingNotes, LANGS });
