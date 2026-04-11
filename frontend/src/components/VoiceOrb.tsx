'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, X, Loader2, Sparkles, BarChart2, Table2, Database, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface QueryResult {
  sql: string;
  rows: any[][];
  columns: string[];
  error: string | null;
  chart_type: string | null;
  explanation: string | null;
  council_transcript?: { agent: string; message: string }[];
}

function OrbRings({ listening, volume }: { listening: boolean; volume: number }) {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-full"
          style={{
            border: `${2 / i}px solid rgba(139,92,246,${listening ? 0.6 / i : 0.2 / i})`,
            transform: `scale(${1 + i * 0.28 + (listening ? volume * 0.25 : 0)})`,
            transition: 'transform 0.1s ease-out',
            animation: listening ? `pulse-orb-${i} ${1 + i * 0.3}s ease-in-out infinite` : 'none',
          }}
        />
      ))}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: listening
            ? 'radial-gradient(circle at 40% 35%, rgba(196,167,251,0.9), rgba(139,92,246,0.95) 50%, rgba(88,28,220,1))'
            : 'radial-gradient(circle at 40% 35%, rgba(165,148,255,0.7), rgba(109,40,217,0.9) 60%, rgba(67,20,180,1))',
          transform: `scale(${listening ? 1 + volume * 0.5 : 1})`,
          transition: 'transform 0.1s ease-out, background 0.5s ease',
          boxShadow: listening
            ? '0 0 40px rgba(139,92,246,0.8), 0 0 80px rgba(139,92,246,0.4)'
            : '0 0 20px rgba(139,92,246,0.45), 0 0 40px rgba(139,92,246,0.15)',
        }}
      />
    </>
  );
}

function Waveform({ listening, volume }: { listening: boolean; volume: number }) {
  const bars = 7;
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-[2.5px]">
      {Array.from({ length: bars }).map((_, i) => {
        const center = Math.floor(bars / 2);
        const dist = Math.abs(i - center);
        const h = listening ? Math.max(4, 10 - dist * 2 + volume * 16 * (1 - dist / bars)) : Math.max(3, 7 - dist * 2);
        return (
          <div key={i} className="rounded-full bg-white/90" style={{ width: 3, height: `${h}px`, transition: 'height 0.08s ease' }} />
        );
      })}
    </div>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

export default function VoiceOrb() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [volume, setVolume] = useState(0);
  const [connectionString, setConnectionString] = useState<string | null>(null);
  const [inlineConn, setInlineConn] = useState('');
  const [showConnInput, setShowConnInput] = useState(false);
  const [councilMode, setCouncilMode] = useState(false);
  const councilModeRef = useRef(councilMode);       // ← fixes stale closure
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Keep ref in sync so handleQuery always reads the latest value
  useEffect(() => { councilModeRef.current = councilMode; }, [councilMode]);

  // Jarvis Voice Engine
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const jarvisVoice = voices.find(v =>
      v.name.includes('UK') || v.name.includes('David') || v.name.includes('Arthur') || v.name.includes('Google UK English Male')
    );
    if (jarvisVoice) utterance.voice = jarvisVoice;
    utterance.rate = 1.05;
    utterance.pitch = 0.85;
    window.speechSynthesis.speak(utterance);
  }, []);

  // Audio Effects
  const playSound = useCallback((type: 'start' | 'stop') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'start') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      } else {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      }
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch { /* audio context errors are non-critical */ }
  }, []);

  /* ── Drag-to-reposition ─────────────────────────────────────────── */
  const ORB_SIZE = 56;
  const STORAGE_KEY = 'voiceorb_position';

  const loadPos = (): { x: number; y: number } => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        return {
          x: Math.min(Math.max(0, p.x), window.innerWidth  - ORB_SIZE),
          y: Math.min(Math.max(0, p.y), window.innerHeight - ORB_SIZE),
        };
      }
    } catch {}
    return { x: window.innerWidth - ORB_SIZE - 20, y: window.innerHeight - ORB_SIZE - 20 };
  };

  const [pos, setPos] = useState<{ x: number; y: number }>({ x: -999, y: -999 });
  const posRef  = useRef(pos);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0, moved: false });

  useEffect(() => { setPos(loadPos()); }, []); // eslint-disable-line
  useEffect(() => { posRef.current = pos; }, [pos]);

  const savePos = (p: { x: number; y: number }) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
  };

  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: posRef.current.x, origY: posRef.current.y, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (!dragRef.current.moved && Math.hypot(dx, dy) > 4) dragRef.current.moved = true;
    if (!dragRef.current.moved) return;
    const p = { x: clamp(dragRef.current.origX + dx, 0, window.innerWidth - ORB_SIZE), y: clamp(dragRef.current.origY + dy, 0, window.innerHeight - ORB_SIZE) };
    setPos(p);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    if (dragRef.current.moved) { savePos(posRef.current); e.stopPropagation(); }
  };

  // ── Read the active connection from localStorage and listen for changes ──
  useEffect(() => {
    const readConn = () => {
      const cs = localStorage.getItem('db_connection_string');
      setConnectionString(cs || null);
    };
    readConn();

    // Ensure voices are loaded
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
      }
    }

    // Global Hotkey: Ctrl + J
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'j') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // FIX: listen for BOTH event names the sidebar can dispatch
    // sidebar-component.tsx dispatches 'projects-updated' AND 'project-changed'
    window.addEventListener('project-changed',  readConn);
    window.addEventListener('projects-updated', readConn);

    // Also poll every 2 s as a final safety net (catches programmatic localStorage writes)
    const poll = setInterval(readConn, 2000);

    return () => {
      window.removeEventListener('project-changed',  readConn);
      window.removeEventListener('projects-updated', readConn);
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(poll);
    };
  }, []);

  // Jarvis Welcome
  useEffect(() => {
    if (open && !hasGreeted && user) {
      const firstName = user.displayName?.split(' ')[0] || 'Sir';
      speak(`Jarvis online. Glad to see you again, ${firstName}. How can I assist with your database today?`);
      setHasGreeted(true);
    }
  }, [open, hasGreeted, user, speak]);

  const activeConn = connectionString || inlineConn;

  const stopMic = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setVolume(0);
  }, []);

  const startVolumeMonitor = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        setVolume(buf.reduce((a, b) => a + b, 0) / buf.length / 128);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* microphone permission denied — silently ignore */ }
  }, []);

  // ── Core query handler ───────────────────────────────────────────────────
  const handleQuery = useCallback(async (text: string, connOverride?: string) => {
    const conn = connOverride ?? activeConn;
    if (!text.trim() || !conn) return;

    const isCouncil = councilModeRef.current;   // read from ref — never stale

    setLoading(true);
    setResult(null);
    speak(isCouncil ? 'Convening the AI council, please wait.' : 'Analyzing data, please stand by.');

    try {
      if (isCouncil) {
        // ── Council mode: deliberate → then execute the final SQL ────────
        const councilRes = await fetch(`${API_BASE}/council/deliberate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection_string: conn, request: text }),
        });
        const councilData = await councilRes.json();

        if (!councilRes.ok) {
          setResult({ sql: '', rows: [], columns: [], error: councilData.detail || `Error ${councilRes.status}`, chart_type: null, explanation: null });
          speak('The Council encountered an error.');
          return;
        }

        const finalSql: string = councilData.final_sql || '';
        const transcript: { agent: string; message: string }[] = councilData.transcript || [];

        // Now execute the final SQL the council agreed on
        let rows: any[][] = [];
        let columns: string[] = [];
        let execError: string | null = null;

        if (finalSql.trim()) {
          try {
            const execRes = await fetch(`${API_BASE}/voice/query`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ connection_string: conn, question: text, sql_override: finalSql }),
            });
            const execData = await execRes.json();
            rows    = execData.rows    ?? [];
            columns = execData.columns ?? [];
            execError = execData.error ?? null;
          } catch (e: any) {
            execError = `SQL execution failed: ${e?.message}`;
          }
        }

        setResult({ sql: finalSql, rows, columns, error: execError, chart_type: columns.length === 2 && rows.length <= 20 ? 'bar' : null, explanation: null, council_transcript: transcript });
        speak('The Council has reached a consensus on your request.');
      } else {
        // ── Standard voice query ─────────────────────────────────────────
        const res = await fetch(`${API_BASE}/voice/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection_string: conn, question: text }),
        });
        const data = await res.json();

        if (!res.ok) {
          setResult({ sql: '', rows: [], columns: [], error: data.detail || `Error ${res.status}`, chart_type: null, explanation: null });
          speak('I encountered an error accessing the database core.');
          return;
        }

        setResult({
          sql: data.sql || '',
          rows: data.rows || [],
          columns: data.columns || [],
          error: data.error || null,
          chart_type: data.chart_type || null,
          explanation: data.explanation || null,
        });

        if (data.explanation) {
          speak(data.explanation);
        } else if (data.rows && data.rows.length > 0) {
          speak(`Query complete. I've retrieved ${data.rows.length} relevant entries.`);
        } else {
          speak('The query returned no results.');
        }
      }
    } catch {
      setResult({ sql: '', rows: [], columns: [], error: 'Could not reach Jarvis backend. Is the server running?', chart_type: null, explanation: null });
      speak('Backend systems are unresponsive, Sir.');
    } finally {
      setLoading(false);
    }
  }, [activeConn, speak]);   // councilMode intentionally excluded — read via ref

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Web Speech API not supported in this browser. Try Chrome.'); return; }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    recognitionRef.current = r;

    r.onresult = (e: any) => {
      const t = Array.from(e.results).map((x: any) => x[0].transcript).join('');
      setTranscript(t);
    };

    r.onend = () => {
      if (recognitionRef.current?._shouldRestart) {
        try { r.start(); } catch {}
        return;
      }
      setListening(false);
      stopMic();
    };

    r.onerror = (e: any) => {
      if (e.error === 'no-speech') {
        try { r.start(); } catch {}
        return;
      }
      setListening(false);
      stopMic();
    };

    r._shouldRestart = true;
    r.start();
    setListening(true);
    playSound('start');
    setTranscript('');
    setResult(null);
    setManualInput('');
    startVolumeMonitor();
  }, [stopMic, startVolumeMonitor, playSound]);

  const stopListening = useCallback((shouldSubmit: boolean = true) => {
    if (recognitionRef.current) {
      recognitionRef.current._shouldRestart = false;
      recognitionRef.current.stop();
    }
    setListening(false);
    playSound('stop');
    stopMic();
    setTranscript(prev => {
      // Don't auto-submit if user is just cancelling/closing the orb
      if (shouldSubmit && prev.trim()) setTimeout(() => handleQuery(prev), 100);
      return shouldSubmit ? prev : '';
    });
  }, [stopMic, handleQuery, playSound]);

  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    setTranscript(manualInput);
    handleQuery(manualInput);
    setManualInput('');
  };

  const handleSaveConn = () => {
    if (!inlineConn.trim()) return;
    localStorage.setItem('db_connection_string', inlineConn);
    setConnectionString(inlineConn);
    setShowConnInput(false);
    window.dispatchEvent(new CustomEvent('project-changed'));
  };

  // ── Status label shown inside the orb panel ─────────────────────────────
  const connLabel = activeConn
    ? (activeConn.includes('@') ? activeConn.split('@')[1] : activeConn.slice(0, 28) + '…')
    : null;

  return (
    <>
      <style>{`
        @keyframes float-orb { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes pulse-orb-1 { 0%,100%{opacity:.4} 50%{opacity:.9} }
        @keyframes pulse-orb-2 { 0%,100%{opacity:.25} 50%{opacity:.7} }
        @keyframes pulse-orb-3 { 0%,100%{opacity:.15} 50%{opacity:.5} }
        .orb-float { animation: float-orb 3s ease-in-out infinite; }
        .jarvis-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .jarvis-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .jarvis-scrollbar::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 10px; }
        .jarvis-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.5); }
      `}</style>

      {/* ── Slide-up panel — positioned relative to orb ── */}
      {open && pos.x > -100 && (() => {
        const PANEL_W = 440;
        const PANEL_H = 500;
        const GAP = 12;
        const openAbove = pos.y > PANEL_H + GAP;
        const panelLeft = Math.min(Math.max(8, pos.x + ORB_SIZE / 2 - PANEL_W / 2), window.innerWidth - PANEL_W - 8);
        const panelTop  = openAbove ? pos.y - PANEL_H - GAP : pos.y + ORB_SIZE + GAP;
        return (
          <div
            className="fixed z-[9999] w-[440px] max-w-[calc(100vw-2.5rem)] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            style={{
              left: panelLeft, top: panelTop,
              background: 'rgba(8,8,18,0.98)',
              border: '1px solid rgba(139,92,246,0.3)',
              backdropFilter: 'blur(30px)',
              maxHeight: '82vh',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 20px rgba(139,92,246,0.1)'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-violet-300">Jarvis · Voice SQL</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConnInput(s => !s)}
                  title={activeConn ? `Connected: ${connLabel}` : 'No database connected — click to set connection'}
                  className={`p-1 rounded-md transition-colors ${activeConn ? 'text-emerald-400 hover:text-emerald-300' : 'text-amber-400 hover:text-amber-300 animate-pulse'}`}
                >
                  <Database size={13} />
                </button>
                <button onClick={() => { setOpen(false); stopListening(false); }} className="text-slate-600 hover:text-slate-300 transition-colors">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Active connection badge */}
            {activeConn && !showConnInput && (
              <div className="px-5 py-1.5 border-b border-white/[0.04] bg-emerald-500/5 flex items-center gap-2 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-mono text-emerald-400 truncate">{connLabel}</span>
              </div>
            )}

            {/* Inline connection input */}
            {showConnInput && (
              <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                  Connection String&nbsp;
                  <span className="normal-case text-slate-600">(or select a project in the sidebar)</span>
                </p>
                <div className="flex gap-2">
                  <input
                    value={inlineConn}
                    onChange={e => setInlineConn(e.target.value)}
                    placeholder="postgresql://user:pass@host/db"
                    className="flex-1 bg-slate-900 border border-slate-800 text-slate-200 text-[11px] font-mono rounded-lg px-3 py-2 outline-none focus:border-violet-500 placeholder-slate-700"
                    onKeyDown={e => e.key === 'Enter' && handleSaveConn()}
                  />
                  <button onClick={handleSaveConn} className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black rounded-lg transition-colors">
                    Set
                  </button>
                </div>
                {connectionString && (
                  <p className="text-[10px] text-emerald-500 mt-1.5 font-bold">✓ Connected: {connLabel}</p>
                )}
              </div>
            )}

            {/* Main body */}
            <div className="flex-1 overflow-y-auto jarvis-scrollbar min-h-0 relative">
              {/* Status / transcript */}
              <div className="px-5 py-4 min-h-[70px]">
                {!activeConn ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-amber-400 text-[12px] font-bold">⚠️ No database connected.</p>
                    <p className="text-slate-500 text-[11px]">Click a project in the sidebar, or tap the <span className="text-amber-400">⬛</span> database icon above to enter a connection string.</p>
                  </div>
                ) : listening ? (
                  <p className="text-white text-[14px] font-medium leading-relaxed animate-pulse min-h-[20px]">{transcript || 'Listening… speak now'}</p>
                ) : loading ? (
                  <div className="flex items-center gap-2 text-violet-300"><Loader2 size={14} className="animate-spin" /><span className="text-[12px] font-bold">Generating SQL…</span></div>
                ) : transcript ? (
                  <p className="text-slate-300 text-[13px] italic leading-relaxed">"{transcript}"</p>
                ) : (
                  <p className="text-slate-600 text-[12px] font-medium leading-relaxed">Click the mic or type below — ask anything about your database.</p>
                )}
              </div>

              {result && (
                <div className="border-t border-white/[0.06] px-5 py-4 space-y-3">
                  {result.error ? (
                    <div className="text-rose-400 text-[12px] font-bold bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{result.error}</div>
                  ) : (
                    <>
                      {result.council_transcript && result.council_transcript.length > 0 && (
                        <div className="space-y-2 mb-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/[0.05] pb-1 mb-2 flex items-center gap-2"><Sparkles size={11} className="text-amber-400" /> Council Deliberation</p>
                          {result.council_transcript.map((t, idx) => (
                             <div key={idx} className={`p-3 rounded-xl border flex flex-col gap-1.5 ${t.agent === 'Architect' ? 'bg-blue-500/10 border-blue-500/20 text-blue-200' : t.agent === 'Guardian' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' : 'bg-violet-500/10 border-violet-500/30 text-violet-200'}`}>
                               <span className="text-[9px] uppercase tracking-widest font-black opacity-80">The {t.agent}</span>
                               <span className="text-[12px] leading-relaxed">"{t.message}"</span>
                             </div>
                          ))}
                        </div>
                      )}
                      {result.explanation && (
                        <div className="flex items-start gap-2 bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
                          <Sparkles size={11} className="text-violet-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-violet-200 leading-relaxed">{result.explanation}</p>
                        </div>
                      )}
                      {result.sql && (
                        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1.5 flex items-center gap-1"><Table2 size={9} />SQL</p>
                          <code className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap break-all leading-relaxed">{result.sql}</code>
                        </div>
                      )}
                      {result.columns.length > 0 && (
                        <div className="rounded-xl overflow-hidden border border-white/[0.07]">
                          <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border-b border-white/[0.06]">
                            <BarChart2 size={11} className="text-violet-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{result.rows.length} rows</span>
                          </div>
                          <div className="overflow-x-auto jarvis-scrollbar pb-2">
                            <table className="w-full text-[11px] border-collapse">
                              <thead>
                                <tr className="border-b border-white/[0.1]">
                                  {result.columns.map(col => <th key={col} className="text-left px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap bg-white/[0.02]">{col}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {result.rows.map((row, i) => (
                                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                                    {result.columns.map((col, j) => <td key={col} className="px-3 py-2 text-slate-300 font-mono whitespace-nowrap">{String(Array.isArray(row) ? row[j] : (row as any)[col] ?? 'null')}</td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Bottom action bar */}
            <div className="px-4 py-3 border-t border-white/[0.06] shrink-0 flex flex-col gap-2 relative">
              <div className="flex justify-end mb-1">
                <button onClick={() => setCouncilMode(!councilMode)} className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md transition-colors flex items-center gap-1.5 ${councilMode ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-500 hover:text-slate-300'}`}><Sparkles size={10} /> {councilMode ? 'Council Active' : 'Enable Council'}</button>
              </div>
              <div className="flex gap-2">
                <input
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                  placeholder={activeConn ? 'Type a question about your database…' : 'Connect a DB first (see sidebar or DB icon above)'}
                  disabled={!activeConn || loading}
                  className="flex-1 bg-slate-900/80 border border-slate-800 text-slate-200 text-[12px] rounded-xl px-3 py-2 outline-none focus:border-violet-500 placeholder-slate-700 disabled:opacity-40"
                />
                <button onClick={handleManualSubmit} disabled={!manualInput.trim() || !activeConn || loading} className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"><Send size={14} className="text-white" /></button>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={listening ? () => stopListening(true) : startListening} disabled={!activeConn || loading} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-violet-400 hover:text-violet-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><Mic size={11} /> {listening ? 'Stop' : 'Speak'}</button>
                {(transcript || result) && !listening && <button onClick={() => { setTranscript(''); setResult(null); setManualInput(''); }} className="text-[10px] font-black text-slate-700 hover:text-rose-400 uppercase tracking-widest transition-colors">Clear</button>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Floating Orb — draggable ── */}
      {pos.x > -100 && (
        <div
          className="fixed z-[9999] touch-none group"
          style={{ left: pos.x, top: pos.y, width: ORB_SIZE, height: ORB_SIZE }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* Label tooltip */}
          {!open && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="px-3 py-2 rounded-xl flex flex-col items-center gap-1 shadow-xl" style={{ background: 'rgba(8,8,18,0.95)', border: '1px solid rgba(139,92,246,0.4)', backdropFilter: 'blur(10px)' }}>
                <span className="text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap">
                  {activeConn ? 'Ask your database anything' : 'Connect a database first'}
                </span>
                <span className="text-[9px] font-bold text-violet-400 whitespace-nowrap uppercase tracking-wider">
                  Press Ctrl + J to open
                </span>
              </div>
            </div>
          )}

          <div
            className={`relative w-14 h-14 ${!listening && !dragRef.current.moved ? 'orb-float' : ''}`}
            style={{ cursor: dragRef.current.dragging ? 'grabbing' : 'grab' }}
            onClick={() => {
              if (dragRef.current.moved) return;
              if (!open) setOpen(true);
              else if (listening) stopListening();
              else startListening();
            }}
          >
            <OrbRings listening={listening} volume={volume} />
            <Waveform listening={listening} volume={volume} />
            {!listening && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Mic size={18} className="text-white/90 drop-shadow-lg" />
              </div>
            )}
            {/* Red dot when no connection */}
            {!activeConn && (
              <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400 border border-slate-900" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
