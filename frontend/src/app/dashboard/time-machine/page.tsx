'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import DashboardShell from "@/components/DashboardShell";
import SchemaGraph from "@/components/SchemaGraph";
import { History, Play, Pause, Clock, GitCommit, Database, Camera, RefreshCw, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Snapshot {
  id: number;
  captured_at: string;
  label: string;
  tag: string;
  accent: string;
  diff_summary: string;
}

export default function TimeMachinePage() {
  const [connectionString, setConnectionString] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [snapshotGraphData, setSnapshotGraphData] = useState<any>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);

  const currentEvent = snapshots[currentIndex] || null;

  // Load connection string
  useEffect(() => {
    const saved = localStorage.getItem("db_connection_string");
    if (saved) setConnectionString(saved);
  }, []);

  // Load snapshots list
  const loadSnapshots = useCallback(async () => {
    if (!connectionString) return;
    try {
      const res = await fetch(`${API}/snapshots/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_string: connectionString }),
      });
      const data = await res.json();
      if (data.snapshots) {
        setSnapshots(data.snapshots);
        // If we had no snapshots before, jump to the latest
        if (data.snapshots.length > 0) {
          setCurrentIndex(data.snapshots.length - 1);
        }
      }
    } catch (e) {
      console.error("Failed to load snapshots:", e);
    }
  }, [connectionString]);

  // Auto-capture on mount, then load list
  useEffect(() => {
    if (!connectionString) return;
    const init = async () => {
      // Capture current state first
      try {
        await fetch(`${API}/snapshots/capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connection_string: connectionString }),
        });
      } catch (e) {
        console.error("Auto-capture failed:", e);
      }
      // Then load all snapshots
      await loadSnapshots();
    };
    init();
  }, [connectionString, loadSnapshots]);

  // Load graph data for current snapshot
  useEffect(() => {
    if (!currentEvent) {
      setSnapshotGraphData(null);
      return;
    }
    const loadGraph = async () => {
      setIsLoadingSnapshot(true);
      try {
        const res = await fetch(`${API}/snapshots/get/${currentEvent.id}`);
        const data = await res.json();
        if (data.graph_data) {
          setSnapshotGraphData(data.graph_data);
        }
      } catch (e) {
        console.error("Failed to load snapshot graph:", e);
      }
      setIsLoadingSnapshot(false);
    };
    loadGraph();
  }, [currentEvent?.id]);

  // Playback
  useEffect(() => {
    let interval: any;
    if (isPlaying && snapshots.length > 1) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= snapshots.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, snapshots.length]);

  const handleStep = (index: number) => {
    if (index === currentIndex) return;
    setCurrentIndex(index);
  };

  const handleCapture = async () => {
    if (!connectionString || isCapturing) return;
    setIsCapturing(true);
    setCaptureMessage(null);
    try {
      const res = await fetch(`${API}/snapshots/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_string: connectionString }),
      });
      const data = await res.json();
      setCaptureMessage(data.message || "Captured!");
      await loadSnapshots();
      // Jump to latest
      setTimeout(() => setCaptureMessage(null), 4000);
    } catch (e) {
      setCaptureMessage("Capture failed");
      setTimeout(() => setCaptureMessage(null), 3000);
    }
    setIsCapturing(false);
  };

  const highlightNodeIds = useMemo(() => {
    if (!currentEvent?.diff_summary) return [];
    const ids: string[] = [];
    currentEvent.diff_summary.split("\n").forEach(line => {
      // Try to match "+Table: reviews" or "+Column: customer.fax" or "Added reviews" etc.
      if (line.includes("+Table: ")) {
        const match = line.match(/\+Table:\s*([^\s(]+)/);
        if (match) ids.push(match[1]);
      } else if (line.includes("+Column: ")) {
        const match = line.match(/\+Column:\s*([^.]+)/);
        if (match) ids.push(match[1]);
      }
    });
    return ids;
  }, [currentEvent]);

  const progressPct = snapshots.length > 1
    ? (currentIndex / (snapshots.length - 1)) * 100
    : 0;

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950">

      {/* ── Page Header ── */}
      <div className="px-6 py-3 flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] bg-white dark:bg-slate-900/80 backdrop-blur-xl z-10 relative overflow-hidden shrink-0">
        {/* Decorative animated ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
          className="absolute right-24 -top-8 w-32 h-32 rounded-full border-[3px] border-dashed border-fuchsia-500/10 dark:border-fuchsia-500/20 pointer-events-none"
        />

        <div className="relative z-10 flex items-center gap-3">
          <Link href="/dashboard" className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mr-2">
            <ChevronLeft size={20} />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-500/10 flex items-center justify-center ring-1 ring-fuchsia-200 dark:ring-fuchsia-500/20 shadow-inner">
            <History size={20} className="text-fuchsia-500 dark:text-fuchsia-400" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Schema Time Machine
            </h1>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Clock size={10} /> {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} captured
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          {/* Capture Snapshot Button */}
          <button
            onClick={handleCapture}
            disabled={isCapturing || !connectionString}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all
                bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-500/20
                hover:bg-fuchsia-100 dark:hover:bg-fuchsia-500/20 hover:shadow-md
                disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCapturing ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Camera size={14} />
            )}
            Capture Snapshot
          </button>

          {/* Active snapshot badge */}
          <AnimatePresence mode="wait">
            {currentEvent && (
              <motion.div
                key={currentEvent.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border dark:border-white/[0.07] bg-slate-50 dark:bg-white/[0.04] shadow-sm"
              >
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: currentEvent.accent }} />
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: currentEvent.accent }}>
                  {currentEvent.tag}
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                  {formatDate(currentEvent.captured_at)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Capture Message Toast ── */}
      <AnimatePresence>
        {captureMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-slate-900 text-white text-[12px] font-bold shadow-xl border border-white/10"
          >
            {captureMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Snapshot Info Card (top-left overlay) ── */}
      {currentEvent && (
        <div className="absolute top-[65px] left-5 z-10 pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentEvent.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="pointer-events-auto w-56 rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden"
            >
              {/* Accent top bar */}
              <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${currentEvent.accent}cc, ${currentEvent.accent}33)` }} />

              <div className="p-3 relative">
                {/* Glow orb */}
                <div
                  className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none"
                  style={{ backgroundColor: currentEvent.accent }}
                />

                <div className="relative z-10 flex items-center gap-2 mb-3">
                  <GitCommit size={14} style={{ color: currentEvent.accent }} />
                  <span
                    className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border"
                    style={{
                      color: currentEvent.accent,
                      borderColor: `${currentEvent.accent}40`,
                      backgroundColor: `${currentEvent.accent}15`,
                    }}
                  >
                    {currentEvent.tag}
                  </span>
                </div>

                <div className="relative z-10 space-y-1">
                  <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Viewing Snapshot
                  </div>
                  <div className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono">
                    {formatDate(currentEvent.captured_at)}
                  </div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {currentEvent.label}
                  </div>
                  {currentEvent.diff_summary && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug pt-1 font-mono whitespace-pre-line">
                      {currentEvent.diff_summary.split("\n").map((line, i) => (
                        <span key={i} className={line.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : line.startsWith("-") ? "text-rose-600 dark:text-rose-400" : ""}>
                          {line}
                          {i < currentEvent.diff_summary.split("\n").length - 1 && <br />}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Event index counter */}
                <div className="relative z-10 mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.05] flex items-center justify-between">
                  <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Snapshot
                  </span>
                  <span className="text-[11px] font-black font-mono text-slate-600 dark:text-slate-300">
                    {currentIndex + 1} <span className="text-slate-300 dark:text-slate-600">/ {snapshots.length}</span>
                  </span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* ── Graph Area (fills all remaining space) ── */}
      <div className="flex-1 overflow-hidden relative">
        {/* Dark grid overlay */}
        <div className="absolute inset-0 dark:bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] dark:bg-[size:32px_32px] pointer-events-none" />

        {isLoadingSnapshot ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <Database size={20} className="animate-pulse text-fuchsia-500" />
            <div className="text-sm font-bold text-slate-400">Loading snapshot...</div>
          </div>
        ) : connectionString && snapshotGraphData ? (
          <SchemaGraph
            key={`snapshot-${currentEvent?.id || 'live'}`}
            connectionString={connectionString}
            snapshotData={snapshotGraphData}
            highlightNodeIds={highlightNodeIds}
          />
        ) : connectionString ? (
          <SchemaGraph connectionString={connectionString} highlightNodeIds={highlightNodeIds} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07] flex items-center justify-center">
              <Database size={28} className="text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center">
              <p className="font-black text-slate-500 dark:text-slate-400 text-sm">No database connected</p>
              <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">Connect a database to view schema history</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Timeline Control Bar ── */}
      {snapshots.length > 0 && (
        <div className="shrink-0 z-20 border-t border-slate-200 dark:border-white/[0.07]">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_40px_rgba(0,0,0,0.5)] px-8 py-4">
            <div className="w-full max-w-5xl mx-auto flex items-center gap-6">

              {/* Play / Pause */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={snapshots.length <= 1}
                className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg disabled:opacity-40"
                style={{
                  background: isPlaying
                    ? `linear-gradient(135deg, #6366f1, #a855f7)`
                    : `linear-gradient(135deg, #1e293b, #0f172a)`,
                  boxShadow: isPlaying ? `0 0 20px #6366f155` : undefined,
                }}
              >
                {isPlaying
                  ? <Pause fill="white" size={16} className="text-white" />
                  : <Play fill="white" size={16} className="text-white ml-0.5" />
                }
              </button>

              {/* Timeline scrubber */}
              <div className="flex-1 relative flex items-center" style={{ height: 52 }}>

                {/* Track background */}
                <div className="absolute left-0 right-0 h-1 bg-slate-200 dark:bg-slate-700/60 rounded-full" />

                {/* Progress fill */}
                <motion.div
                  className="absolute left-0 h-1 rounded-full"
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{
                    background: currentEvent ? `linear-gradient(to right, #818cf8, ${currentEvent.accent})` : '#818cf8',
                    boxShadow: currentEvent ? `0 0 8px ${currentEvent.accent}88` : undefined,
                  }}
                />

                {/* Dots */}
                <div className="absolute inset-0 flex justify-between items-center">
                  {snapshots.map((ev, i) => {
                    const isActive = i === currentIndex;
                    const isPast = i < currentIndex;
                    return (
                      <div
                        key={ev.id}
                        className="relative group cursor-pointer flex items-center justify-center"
                        style={{ width: 24, height: 52 }}
                        onClick={() => handleStep(i)}
                      >
                        {/* Glow ring on active */}
                        {isActive && (
                          <motion.div
                            layoutId="activeGlow"
                            className="absolute w-7 h-7 rounded-full"
                            style={{
                              background: `radial-gradient(circle, ${ev.accent}40, transparent 70%)`,
                              boxShadow: `0 0 12px ${ev.accent}66`,
                            }}
                          />
                        )}

                        <motion.div
                          animate={{ scale: isActive ? 1.4 : 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className={`relative w-3.5 h-3.5 rounded-full border-2 transition-colors z-10 ${!isActive && !isPast ? 'bg-slate-300 dark:bg-slate-600 border-slate-300 dark:border-slate-600' : ''
                            }`}
                          style={isActive || isPast ? {
                            backgroundColor: isActive ? ev.accent : `${ev.accent}88`,
                            borderColor: isActive ? ev.accent : `${ev.accent}66`,
                          } : undefined}
                        />

                        {/* Label tooltip */}
                        <div className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 whitespace-nowrap flex flex-col items-center gap-0.5 pointer-events-none transition-opacity duration-150 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <span
                            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                            style={isActive ? {
                              color: ev.accent,
                              backgroundColor: `${ev.accent}18`,
                            } : {}}
                          >
                            {isActive ? ev.tag : ev.label}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                            {formatDate(ev.captured_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step counter */}
              <div className="shrink-0 flex flex-col items-end gap-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Snapshot
                </span>
                <span className="text-sm font-black font-mono text-slate-700 dark:text-slate-200">
                  {currentIndex + 1}
                  <span className="text-slate-300 dark:text-slate-600 font-bold">/{snapshots.length}</span>
                </span>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
