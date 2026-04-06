'use client';

import { useState, useEffect } from "react";
import DashboardShell from "@/components/DashboardShell";
import SchemaGraph from "@/components/SchemaGraph";
import { History, Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const TIMELINE_EVENTS = [
  { id: 1, date: "2024-01-10", label: "Initial Schema", desc: "First 10 tables created.", color: "bg-slate-200" },
  { id: 2, date: "2024-03-15", label: "Added Stripe", desc: "Added payments and subscriptions tables.", color: "bg-violet-300" },
  { id: 3, date: "2024-06-22", label: "User Profiles", desc: "Added detailed profile lookups.", color: "bg-amber-300" },
  { id: 4, date: "2024-09-05", label: "Audit Logs", desc: "Major structural migration for compliance.", color: "bg-blue-300" },
  { id: 5, date: "2024-11-20", label: "Current", desc: "Live production state.", color: "bg-emerald-400" },
];

export default function TimeMachinePage() {
  const [connectionString, setConnectionString] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(TIMELINE_EVENTS.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Changing key forces SchemaGraph to re-mount and simulate a "loading" state
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

  return (
    <DashboardShell>
      <div className="flex flex-col h-full bg-slate-50 min-h-0 relative">
        <div className="absolute top-4 left-6 z-10 pointers-event-none">
          <div className="bg-white/90 backdrop-blur border border-slate-200 p-4 rounded-2xl shadow-lg pointers-event-auto max-w-sm">
             <div className="flex items-center gap-2 mb-2">
                 <History className="text-violet-500" size={18} />
                 <h2 className="text-lg font-black text-slate-800">Schema Time Machine</h2>
             </div>
             <p className="text-xs font-bold text-slate-500 mb-3 leading-snug">
                 Scrub through history to see how your database structure evolved over time.
             </p>
             <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1 block">Viewing Snapshot:</span>
                <div className="text-lg font-black text-indigo-900">{currentEvent.date}</div>
                <div className="text-sm font-bold text-slate-700 mt-1">{currentEvent.label}</div>
                <div className="text-xs text-slate-500 mt-1">{currentEvent.desc}</div>
             </div>
          </div>
        </div>

        {/* Graph Area */}
        <div className="flex-1 overflow-hidden relative bg-white pb-32">
          {connectionString ? (
             <SchemaGraph key={graphKey} connectionString={connectionString} />
          ) : (
             <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
               <History size={48} className="mb-4 opacity-50" />
               <p className="font-bold">Connect a database to view timeline</p>
             </div>
          )}
        </div>

        {/* Bottom Timeline Control Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20 flex flex-col items-center justify-center px-10">
           
           <div className="w-full max-w-5xl flex items-center gap-6">
              
              <button onClick={() => setIsPlaying(!isPlaying)} className="w-12 h-12 shrink-0 rounded-full bg-slate-900 text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
                 {isPlaying ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} className="ml-1" />}
              </button>

              <div className="flex-1 relative flex items-center h-12">
                 <div className="absolute left-0 right-0 h-1.5 bg-slate-100 rounded-full" />
                 <div 
                    className="absolute left-0 h-1.5 rounded-full" 
                    style={{ 
                        width: `${(currentIndex / (TIMELINE_EVENTS.length - 1)) * 100}%`,
                        background: "linear-gradient(to right, #818cf8, #6366f1)",
                        transition: "width 0.5s ease"
                    }} 
                 />

                 <div className="absolute inset-0 flex justify-between items-center -mx-2">
                    {TIMELINE_EVENTS.map((ev, i) => {
                       const isActive = i === currentIndex;
                       const isPast = i < currentIndex;
                       return (
                         <div key={ev.id} className="relative group cursor-pointer" onClick={() => handleStep(i)}>
                            <motion.div 
                              animate={{ scale: isActive ? 1.5 : 1 }}
                              className={`w-4 h-4 rounded-full border-2 border-white shadow-sm transition-colors ${isActive ? 'bg-indigo-600' : isPast ? 'bg-indigo-400' : 'bg-slate-300'}`}
                            />
                            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap flex flex-col items-center ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                               <span className={`text-[10px] font-black ${isActive ? 'text-indigo-600' : 'text-slate-500'}`}>{ev.date}</span>
                               <span className="text-[9px] font-bold text-slate-400">{ev.label}</span>
                            </div>
                         </div>
                       )
                    })}
                 </div>
              </div>
           </div>

        </div>
      </div>
    </DashboardShell>
  );
}
