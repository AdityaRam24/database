'use client';

import { useState, useEffect } from "react";
import DashboardShell from "@/components/DashboardShell";
import SchemaGraph from "@/components/SchemaGraph";
import { History, Play, Pause, Clock, GitCommit, Database } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TIMELINE_EVENTS = [
  { id: 1, date: "2024-01-10", label: "Initial Schema", desc: "First 10 tables created.", accent: "#6366f1", tag: "INIT" },
  { id: 2, date: "2024-03-15", label: "Added Stripe", desc: "Added payments and subscriptions tables.", accent: "#a855f7", tag: "MIGRATION" },
  { id: 3, date: "2024-06-22", label: "User Profiles", desc: "Added detailed profile lookups.", accent: "#f59e0b", tag: "FEATURE" },
  { id: 4, date: "2024-09-05", label: "Audit Logs", desc: "Major structural migration for compliance.", accent: "#3b82f6", tag: "COMPLIANCE" },
  { id: 5, date: "2024-11-20", label: "Current", desc: "Live production state.", accent: "#10b981", tag: "LIVE" },
];

export default function TimeMachinePage() {
  const [connectionString, setConnectionString] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(TIMELINE_EVENTS.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [graphKey, setGraphKey] = useState(0);
  const currentEvent = TIMELINE_EVENTS[currentIndex];

  useEffect(() => {
    const saved = localStorage.getItem("db_connection_string");
    if (saved) setConnectionString(saved);
  }, []);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= TIMELINE_EVENTS.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          setGraphKey(k => k + 1);
          return prev + 1;
        });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleStep = (index: number) => {
    if (index === currentIndex) return;
    setCurrentIndex(index);
    setGraphKey(k => k + 1);
  };

  const progressPct = (currentIndex / (TIMELINE_EVENTS.length - 1)) * 100;

  return (
    <DashboardShell>
      <div className="flex flex-col h-full min-h-0 relative bg-white dark:bg-slate-950">

        {/* ── Page Header ── */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] bg-white dark:bg-slate-900/80 backdrop-blur-xl z-10 relative overflow-hidden">
          {/* Decorative animated ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
            className="absolute right-24 -top-8 w-32 h-32 rounded-full border-[3px] border-dashed border-fuchsia-500/10 dark:border-fuchsia-500/20 pointer-events-none"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 14, ease: "linear" }}
            className="absolute right-28 -top-4 w-20 h-20 rounded-full border-[2px] border-dashed border-indigo-500/10 dark:border-indigo-400/20 pointer-events-none"
          />

          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-500/10 flex items-center justify-center ring-1 ring-fuchsia-200 dark:ring-fuchsia-500/20 shadow-inner">
              <History size={20} className="text-fuchsia-500 dark:text-fuchsia-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Schema Time Machine
              </h1>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                <Clock size={10} /> Scrub through schema evolution history
              </p>
            </div>
          </div>

          {/* Active snapshot badge */}
          <div className="relative z-10 flex items-center gap-2">
            <AnimatePresence mode="wait">
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
                  {currentEvent.date}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Snapshot Info Card (top-left overlay) ── */}
        <div className="absolute top-[73px] left-5 z-10 pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentEvent.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="pointer-events-auto w-64 rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden"
            >
              {/* Accent top bar */}
              <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${currentEvent.accent}cc, ${currentEvent.accent}33)` }} />

              <div className="p-4 relative">
                {/* Glow orb */}
                <div
                  className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none"
                  style={{ backgroundColor: currentEvent.accent }}
                />

                {/* 3D rotating sphere */}
                <motion.div
                  animate={{ rotateZ: 360, rotateX: [20, 60, 20], scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                  className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full pointer-events-none border-[8px] border-indigo-500/10 dark:border-indigo-400/25 shadow-lg"
                  style={{ transformStyle: 'preserve-3d', transform: 'rotateX(50deg) rotateY(10deg)' }}
                >
                  <div
                    className="absolute inset-4 rounded-full border-[2px] border-violet-500/10 dark:border-violet-400/20"
                    style={{ transform: 'rotateY(90deg)' }}
                  />
                </motion.div>

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
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Viewing Snapshot
                  </div>
                  <div className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
                    {currentEvent.date}
                  </div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {currentEvent.label}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug pt-0.5">
                    {currentEvent.desc}
                  </div>
                </div>

                {/* Event index counter */}
                <div className="relative z-10 mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.05] flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Snapshot
                  </span>
                  <span className="text-[11px] font-black font-mono text-slate-600 dark:text-slate-300">
                    {currentIndex + 1} <span className="text-slate-300 dark:text-slate-600">/ {TIMELINE_EVENTS.length}</span>
                  </span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Graph Area ── */}
        <div className="flex-1 overflow-hidden relative pb-28">
          {/* Dark grid overlay for dark mode */}
          <div className="absolute inset-0 dark:bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] dark:bg-[size:32px_32px] pointer-events-none" />

          {connectionString ? (
            <SchemaGraph key={graphKey} connectionString={connectionString} />
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
        <div className="absolute bottom-0 left-0 right-0 z-20">
          {/* Gradient fade into bar */}
          <div className="h-8 bg-gradient-to-t from-white dark:from-slate-950 to-transparent pointer-events-none" />

          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/[0.07] shadow-[0_-8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_40px_rgba(0,0,0,0.5)] px-8 pt-4 pb-5">
            <div className="w-full max-w-5xl mx-auto flex items-center gap-6">

              {/* Play / Pause */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg"
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
                    background: `linear-gradient(to right, #818cf8, ${currentEvent.accent})`,
                    boxShadow: `0 0 8px ${currentEvent.accent}88`,
                  }}
                />

                {/* Dots */}
                <div className="absolute inset-0 flex justify-between items-center">
                  {TIMELINE_EVENTS.map((ev, i) => {
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
                          className="relative w-3.5 h-3.5 rounded-full border-2 transition-colors z-10"
                          style={{
                            backgroundColor: isActive ? ev.accent : isPast ? `${ev.accent}88` : undefined,
                            borderColor: isActive ? ev.accent : isPast ? `${ev.accent}66` : undefined,
                          }}
                          // Fallback for future dots
                          {...(!isActive && !isPast ? {
                            className: "relative w-3.5 h-3.5 rounded-full border-2 transition-colors z-10 bg-slate-300 dark:bg-slate-600 border-slate-300 dark:border-slate-600"
                          } : {})}
                        />

                        {/* Label tooltip — always visible for active, hover for others */}
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
                            {ev.date}
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
                  <span className="text-slate-300 dark:text-slate-600 font-bold">/{TIMELINE_EVENTS.length}</span>
                </span>
              </div>

            </div>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
