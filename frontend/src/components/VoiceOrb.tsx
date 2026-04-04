'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, X, Loader2, Sparkles, BarChart2, Table2, Database, Send } from 'lucide-react';

interface QueryResult {
  sql: string;
  rows: any[][];
  columns: string[];
  error: string | null;
  chart_type: string | null;
  explanation: string | null;
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

export default function VoiceOrb() {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [volume, setVolume] = useState(0);
  const [connectionString, setConnectionString] = useState<string | null>(null);
  const [inlineConn, setInlineConn] = useState('');
  const [showConnInput, setShowConnInput] = useState(false);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const cs = localStorage.getItem('db_connection_string');
    if (cs) setConnectionString(cs);

    // Listen for project changes from sidebar
    const handler = () => {
      const cs2 = localStorage.getItem('db_connection_string');
      if (cs2) setConnectionString(cs2);
    };
    window.addEventListener('project-changed', handler);
    return () => window.removeEventListener('project-changed', handler);
  }, []);

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
    } catch {}
  }, []);

  const handleQuery = useCallback(async (text: string) => {
    if (!text.trim() || !activeConn) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_string: activeConn,
          question: text,
          conversation_history: [],
        }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setResult({ sql: '', rows: [], columns: [], error: data.detail || `Error ${res.status}`, chart_type: null, explanation: null });
        return;
      }

      // /analysis/query returns {sql, rows, columns, error, explanation, chart_type}
      setResult({
        sql: data.sql || '',
        rows: data.rows || [],
        columns: data.columns || [],
        error: data.error || null,
        chart_type: data.chart_type || null,
        explanation: data.explanation || null,
      });
    } catch {
      setResult({ sql: '', rows: [], columns: [], error: 'Could not reach backend. Is the server running?', chart_type: null, explanation: null });
    } finally {
      setLoading(false);
    }
  }, [activeConn]);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Web Speech API not supported in this browser. Try Chrome.'); return; }
    const r = new SR();
    r.continuous = true;       // Keep recording until user clicks Stop
    r.interimResults = true;
    r.lang = 'en-US';
    recognitionRef.current = r;

    r.onresult = (e: any) => {
      const t = Array.from(e.results).map((x: any) => x[0].transcript).join('');
      setTranscript(t);
    };

    // Auto-restart if browser cuts it off due to silence (only if still listening)
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
        // Browser stopped for silence — restart silently
        try { r.start(); } catch {}
        return;
      }
      setListening(false);
      stopMic();
    };

    r._shouldRestart = true;
    r.start();
    setListening(true);
    setTranscript('');
    setResult(null);
    setManualInput('');
    startVolumeMonitor();
  }, [stopMic, startVolumeMonitor, handleQuery]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current._shouldRestart = false; // prevent auto-restart
      recognitionRef.current.stop();
    }
    setListening(false);
    stopMic();
    // Auto-submit whatever was captured
    setTranscript(prev => {
      if (prev.trim()) setTimeout(() => handleQuery(prev), 100);
      return prev;
    });
  }, [stopMic, handleQuery]);

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
  };

  return (
    <>
      <style>{`
        @keyframes float-orb { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes pulse-orb-1 { 0%,100%{opacity:.4} 50%{opacity:.9} }
        @keyframes pulse-orb-2 { 0%,100%{opacity:.25} 50%{opacity:.7} }
        @keyframes pulse-orb-3 { 0%,100%{opacity:.15} 50%{opacity:.5} }
        .orb-float { animation: float-orb 3s ease-in-out infinite; }
      `}</style>

      {/* ── Slide-up panel ── */}
      {open && (
        <div
          className="fixed bottom-24 right-5 z-[9999] w-[360px] max-w-[calc(100vw-2.5rem)] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          style={{ background: 'rgba(8,8,18,0.97)', border: '1px solid rgba(139,92,246,0.35)', backdropFilter: 'blur(24px)', maxHeight: '70vh' }}
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
                title="Set database connection"
                className={`p-1 rounded-md transition-colors ${activeConn ? 'text-emerald-400 hover:text-emerald-300' : 'text-amber-400 hover:text-amber-300 animate-pulse'}`}
              >
                <Database size={13} />
              </button>
              <button onClick={() => { setOpen(false); stopListening(); }} className="text-slate-600 hover:text-slate-300 transition-colors">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Inline connection input */}
          {showConnInput && (
            <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">PostgreSQL Connection String</p>
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
                <p className="text-[10px] text-emerald-500 mt-1.5 font-bold">✓ Connected: {connectionString.split('@')[1] || 'active'}</p>
              )}
            </div>
          )}

          {/* Main body */}
          <div className="flex-1 overflow-y-auto">
            {/* Status / transcript */}
            <div className="px-5 py-4 min-h-[70px]">
              {!activeConn ? (
                <div className="flex flex-col gap-2">
                  <p className="text-amber-400 text-[12px] font-bold">⚠️ No database connected.</p>
                  <button
                    onClick={() => setShowConnInput(true)}
                    className="text-[10px] font-black uppercase tracking-widest text-violet-400 hover:text-violet-200 transition-colors text-left"
                  >
                    + Enter connection string →
                  </button>
                </div>
              ) : listening ? (
                <p className="text-white text-[14px] font-medium leading-relaxed animate-pulse min-h-[20px]">
                  {transcript || 'Listening… speak now'}
                </p>
              ) : loading ? (
                <div className="flex items-center gap-2 text-violet-300">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[12px] font-bold">Generating SQL…</span>
                </div>
              ) : transcript ? (
                <p className="text-slate-300 text-[13px] italic leading-relaxed">"{transcript}"</p>
              ) : (
                <p className="text-slate-600 text-[12px] font-medium leading-relaxed">
                  Click the mic or type below — ask anything about your database.
                </p>
              )}
            </div>

            {/* Results */}
            {result && (
              <div className="border-t border-white/[0.06] px-5 py-4 space-y-3">
                {result.error ? (
                  <div className="text-rose-400 text-[12px] font-bold bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{result.error}</div>
                ) : (
                  <>
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
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="border-b border-white/[0.05]">
                                {result.columns.map(col => (
                                  <th key={col} className="text-left px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {result.rows.slice(0, 6).map((row, i) => (
                                <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                                  {result.columns.map((col, j) => (
                                    <td key={col} className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap max-w-[120px] truncate">
                                      {String(Array.isArray(row) ? row[j] : (row as any)[col] ?? 'null')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {result.rows.length > 6 && (
                            <p className="text-center text-[10px] text-slate-700 font-black py-2">+{result.rows.length - 6} more</p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="px-4 py-3 border-t border-white/[0.06] shrink-0 flex flex-col gap-2">
            {/* Text input */}
            <div className="flex gap-2">
              <input
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                placeholder={activeConn ? 'Type a question...' : 'Connect DB first'}
                disabled={!activeConn || loading}
                className="flex-1 bg-slate-900/80 border border-slate-800 text-slate-200 text-[12px] rounded-xl px-3 py-2 outline-none focus:border-violet-500 placeholder-slate-700 disabled:opacity-40"
              />
              <button
                onClick={handleManualSubmit}
                disabled={!manualInput.trim() || !activeConn || loading}
                className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
            {/* Mic row */}
            <div className="flex items-center justify-between">
              <button
                onClick={listening ? stopListening : startListening}
                disabled={!activeConn || loading}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-violet-400 hover:text-violet-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Mic size={11} /> {listening ? 'Stop' : 'Speak'}
              </button>
              {(transcript || result) && !listening && (
                <button onClick={() => { setTranscript(''); setResult(null); setManualInput(''); }} className="text-[10px] font-black text-slate-700 hover:text-rose-400 uppercase tracking-widest transition-colors">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Orb ── */}
      <div className="fixed bottom-5 right-5 z-[9999]">
        <div className={`relative w-14 h-14 cursor-pointer ${!listening ? 'orb-float' : ''}`} onClick={() => { if (!open) setOpen(true); else if (listening) stopListening(); else startListening(); }}>
          <OrbRings listening={listening} volume={volume} />
          <Waveform listening={listening} volume={volume} />
          {!listening && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Mic size={18} className="text-white/90 drop-shadow-lg" />
            </div>
          )}
        </div>
        {!open && (
          <div className="absolute bottom-full right-0 mb-2 pointer-events-none">
            <div className="px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap" style={{ background: 'rgba(8,8,18,0.9)', border: '1px solid rgba(139,92,246,0.3)' }}>
              Ask your database anything
            </div>
          </div>
        )}
      </div>
    </>
  );
}
