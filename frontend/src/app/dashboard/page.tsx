'use client';

import { useEffect, useState } from "react";
import SchemaGraph from "@/components/SchemaGraph";
import OptimizationReport from "@/components/OptimizationReport";
import { useRouter } from "next/navigation";
import {
  Database, Folder, Key, Zap, GitMerge, Activity,
  ShieldAlert, Shield, BookOpen, Plus, ArrowUpRight,
  RefreshCw, AlertCircle, PlugZap, Maximize2, X,
  Table2, TrendingUp, CheckCircle2, Sparkles,
  Heart, Lock, MessageSquare, ChevronRight, Bot, Terminal, FlaskConical, History
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";

/* ─── Quick Actions ────────────────────────────────────────── */
const QUICK_ACTIONS = [
  {
    label: "Speed Optimizer",
    desc: "Find slow queries and make them lightning fast",
    whatItDoes: "Makes your database faster",
    icon: Zap,
    emoji: "⚡",
    color: "#f59e0b",
    bg: "#fffbeb",
    border: "#fde68a",
    path: "/dashboard/performance",
  },
  {
    label: "Safe Schema Editor",
    desc: "Add or change tables without breaking anything",
    whatItDoes: "Modify structure safely",
    icon: GitMerge,
    emoji: "🔧",
    color: "#3b82f6",
    bg: "#eff6ff",
    border: "#bfdbfe",
    path: "/dashboard/governance",
  },
  {
    label: "Query Sandbox",
    desc: "Test SQL safely before production",
    whatItDoes: "Optimization Terminal",
    icon: Terminal,
    emoji: "💻",
    color: "#f43f5e",
    bg: "#fff1f2",
    border: "#fecdd3",
    path: "/dashboard/query-builder",
  },
  {
    label: "Simulation Lab",
    desc: "Predict structural change impact",
    whatItDoes: "Shadow DB Sandbox",
    icon: FlaskConical,
    emoji: "🧪",
    color: "#0ea5e9",
    bg: "#f0f9ff",
    border: "#bae6fd",
    path: "/dashboard/lab",
  },
  {
    label: "Schema Timeline",
    desc: "View your historical structure",
    whatItDoes: "Scrub through time",
    icon: History,
    emoji: "⏳",
    color: "#d946ef",
    bg: "#fdf4ff",
    border: "#f5d0fe",
    path: "/dashboard/time-machine",
  },
  {
    label: "Health Monitor",
    desc: "See if your database is running smoothly",
    whatItDoes: "Track live health stats",
    icon: Activity,
    emoji: "❤️",
    color: "#ef4444",
    bg: "#fef2f2",
    border: "#fecaca",
    path: "/dashboard/anomaly",
  },
  {
    label: "Alerts Center",
    desc: "View and fix any active issues or warnings",
    whatItDoes: "Stay on top of problems",
    icon: ShieldAlert,
    emoji: "🚨",
    color: "#f97316",
    bg: "#fff7ed",
    border: "#fed7aa",
    path: "/dashboard/incidents",
  },
  {
    label: "AI Knowledge Base",
    desc: "Teach the AI your business rules for smarter answers",
    whatItDoes: "Train the AI on your data",
    icon: BookOpen,
    emoji: "🧠",
    color: "#a78bfa",
    bg: "#faf5ff",
    border: "#e9d5ff",
    path: "/dashboard/semantic",
  },
];

/* ─── Helpers ──────────────────────────────────────────────── */
function SkeletonPulse({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />;
}

function getHealthLabel(score: number) {
  if (score >= 95) return { text: "Excellent", emoji: "🚀", color: "#064e3b", bg: "#34d399", border: "#10b981", shadow: "#059669" };
  if (score >= 80) return { text: "Good", emoji: "✅", color: "#1e3a8a", bg: "#60a5fa", border: "#3b82f6", shadow: "#2563eb" };
  if (score >= 60) return { text: "Fair", emoji: "⚠️", color: "#78350f", bg: "#fbbf24", border: "#f59e0b", shadow: "#d97706" };
  return { text: "Needs Attention", emoji: "🔴", color: "#7f1d1d", bg: "#f87171", border: "#ef4444", shadow: "#dc2626" };
}

/* ─── Stat Card ────────────────────────────────────────────── */
function StatCard({
  label, friendlyLabel, value, unit, icon: Icon,
  color, gradient, tip, index
}: {
  label: string; friendlyLabel: string; value: string | number;
  unit?: string; icon: any; color: string; gradient: string;
  tip: string; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20, delay: index * 0.05 }}
      className="relative rounded-3xl p-5 overflow-hidden group cursor-default"
      style={{ background: gradient, boxShadow: `0 10px 40px -10px ${color}80, inset 0 2px 0 rgba(255,255,255,0.2)` }}
    >
      {/* 3D Floating Isometric Cube Element */}
      <motion.div 
        animate={{ y: [0, -12, 0], rotateX: [30, 40, 30], rotateZ: [15, 25, 15] }} 
        transition={{ repeat: Infinity, duration: 4 + index * 0.5, ease: "easeInOut" }}
        className="absolute -right-4 -top-6 w-24 h-24 rounded-2xl opacity-20 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, white 0%, rgba(255,255,255,0) 100%)`,
          transform: 'perspective(500px)',
          boxShadow: '-15px 15px 25px rgba(0,0,0,0.3), inset 2px 2px 8px rgba(255,255,255,0.9)',
          backdropFilter: 'blur(4px)'
        }}
      />
      
      {/* Small 3D Floating Orb */}
      <motion.div 
        animate={{ y: [0, 10, 0], scale: [1, 1.1, 1] }} 
        transition={{ repeat: Infinity, duration: 5 + index * 0.3, ease: "easeInOut" }}
        className="absolute right-4 top-14 w-8 h-8 rounded-full opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 30% 30%, white, ${color})`,
          boxShadow: '-5px 5px 15px rgba(0,0,0,0.4), inset -2px -2px 6px rgba(0,0,0,0.3)'
        }}
      />

      <div className="relative z-10 flex items-center justify-between mb-3 group-hover:scale-105 transition-transform duration-300">
        <span className="text-[10px] font-black text-white/80 uppercase tracking-widest drop-shadow-sm">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/20 backdrop-blur-md shadow-[inset_0_1px_rgba(255,255,255,0.4)]">
          <Icon size={14} className="text-white drop-shadow-md" />
        </div>
      </div>

      <div className="relative z-10 flex items-end gap-1.5 mb-2 origin-left group-hover:scale-110 transition-transform duration-300">
        <span className="text-[2.6rem] font-black tracking-tight leading-none text-white drop-shadow-lg">{value}</span>
        {unit && <span className="text-base font-black text-white/70 mb-1">{unit}</span>}
      </div>

      {/* Friendly label */}
      <p className="relative z-10 text-[12px] font-bold text-white/90 drop-shadow-sm">{friendlyLabel}</p>

      {/* Tooltip on hover */}
      <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 opacity-0 group-hover:opacity-100 overflow-hidden transition-all duration-300 z-20">
        <div className="px-4 py-3 bg-black/40 backdrop-blur-md border-t border-white/10">
          <p className="text-[11px] text-white/90 font-black tracking-wide leading-relaxed">{tip}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Health Score Hero ─────────────────────────────────────── */
function HealthHero({ score }: { score: number }) {
  const health = getHealthLabel(score);
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.90, rotateX: 10 }}
      animate={{ opacity: 1, scale: 1, rotateX: 0 }}
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="relative rounded-3xl overflow-hidden p-6 row-span-1 group"
      style={{
        background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #a855f7 100%)",
        boxShadow: "0 12px 40px -10px rgba(124,58,237,0.6), inset 0 2px 0 rgba(255,255,255,0.2)",
      }}
    >
      {/* 3D Floating Torus / Rings */}
      <motion.div 
        animate={{ rotateZ: 360, rotateX: [20, 40, 20], rotateY: [10, -10, 10] }} 
        transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
        className="absolute -right-8 -top-8 w-44 h-44 rounded-full border-[12px] border-white/5 pointer-events-none"
        style={{ transformOrigin: 'center center', transformStyle: 'preserve-3d' }}
      />
      <motion.div 
        animate={{ y: [0, -15, 0], x: [0, 5, 0] }} 
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="absolute right-10 top-10 w-16 h-16 rounded-full opacity-40 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 30% 30%, #fff, #c084fc)`,
          boxShadow: '-8px 8px 15px rgba(0,0,0,0.3)',
          filter: 'blur(2px)'
        }}
      />

      <div className="relative z-10 flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-black text-white/80 uppercase tracking-widest mb-2 drop-shadow-sm">Overall Health</p>
          <div className="flex items-center gap-2">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: -2 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl shadow-lg cursor-default border"
              style={{ 
                background: `linear-gradient(to bottom, ${health.bg}, ${health.border})`, 
                color: health.color,
                borderColor: health.bg,
                boxShadow: `0 4px 0 ${health.shadow}, 0 10px 20px -5px ${health.shadow}80`,
                transform: "translateY(-4px)"
              }}
            >
              <span className="text-base drop-shadow-sm">{health.emoji}</span>
              <span className="text-sm font-black tracking-wide drop-shadow-sm">{health.text}</span>
            </motion.div>
          </div>
        </div>
        
        {/* 3D Looking Score Ring */}
        <div className="relative hover:scale-110 transition-transform duration-500 ease-out">
          <svg width="84" height="84" viewBox="0 0 84 84" className="drop-shadow-2xl z-10 relative">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Background Track with inner shadow illusion */}
            <circle cx="42" cy="42" r="36" fill="rgba(0,0,0,0.15)" />
            <circle cx="42" cy="42" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            
            <circle
              cx="42" cy="42" r="36" fill="none"
              stroke="#ffffff" strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 42 42)"
              filter="url(#glow)"
              style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
            />
            <text x="42" y="42" dominantBaseline="middle" textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="900" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>{score}</text>
            <text x="42" y="56" dominantBaseline="middle" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="9" fontWeight="800">/100</text>
          </svg>
        </div>
      </div>

      <p className="relative z-10 text-[13px] text-white/70 font-bold leading-snug">
        {score >= 95 ? "🚀 Your database is running perfectly! Everything looks great." :
         score >= 80 ? "✅ Good health. A few small improvements could make it even better." :
         score >= 60 ? "⚠️ Some issues detected. Check the AI recommendations below." :
         "🔴 Attention needed — AI has found things that need fixing soon."}
      </p>
    </motion.div>
  );
}

/* ─── Quick Action Card ─────────────────────────────────────── */
function ActionCard({ action, onClick, index }: { action: typeof QUICK_ACTIONS[0]; onClick: () => void; index: number }) {
  const { resolvedTheme } = useTheme();
  const Icon = action.icon;
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ 
        y: -6, 
        scale: 1.02,
        boxShadow: `0 16px 40px ${action.color}22`
      }}
      transition={{ 
        duration: 0.3,
        delay: 0.15 + index * 0.05,
      }}
      whileTap={{ scale: 0.96, y: 0, transition: { duration: 0.1 } }}
      onClick={onClick}
      className="group text-left rounded-2xl p-4 transition-all duration-300 ease-out cursor-pointer relative overflow-hidden flex flex-col h-full"
      style={{ 
        background: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.03)' : `${action.bg}99`, 
        borderTop: `1px solid ${resolvedTheme === 'dark' ? 'rgba(255,255,255,0.1)' : action.border}`,
        borderLeft: `1px solid ${resolvedTheme === 'dark' ? 'rgba(255,255,255,0.1)' : action.border}`,
        borderRight: `1px solid ${resolvedTheme === 'dark' ? 'rgba(255,255,255,0.1)' : action.border}`,
        borderBottom: `4px solid ${resolvedTheme === 'dark' ? 'rgba(255,255,255,0.15)' : action.border}`,
      }}
    >
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/40 dark:group-hover:bg-white/5 transition-colors duration-300 pointer-events-none" />
      
      <div className="relative z-10 flex items-start justify-between mb-3 w-full">
        <motion.div 
          whileHover={{ rotateZ: 5, rotateX: 15, scale: 1.1 }}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm transition-transform duration-300" style={{ background: `${action.color}20`, boxShadow: `inset 0 2px 4px rgba(255,255,255,0.5), 0 2px 4px ${action.color}30` }}>
          {action.emoji}
        </motion.div>
        <ChevronRight size={14} className="mt-1 transition-all duration-300 group-hover:translate-x-1" style={{ color: action.color }} />
      </div>
      <p className="relative z-10 text-[13px] font-black text-slate-900 dark:text-white leading-tight mb-1">{action.label}</p>
      <p className="relative z-10 text-[11px] font-bold leading-snug" style={{ color: `${action.color}cc` }}>{action.whatItDoes}</p>
      
      <div className="relative z-10 overflow-hidden transition-all duration-500 max-h-0 group-hover:max-h-20 opacity-0 group-hover:opacity-100 mt-0 group-hover:mt-2">
        <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic border-l-2 pl-2" style={{ borderColor: `${action.color}50` }}>
          {action.desc}
        </p>
      </div>
    </motion.button>
  );
}

/* ─── Empty State ───────────────────────────────────────────── */
function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-8 rounded-3xl border-2 border-dashed border-violet-200 dark:border-violet-500/20 bg-gradient-to-br from-violet-50 dark:from-violet-500/5 via-white dark:via-transparent to-indigo-50 dark:to-indigo-500/5 p-16 mt-4 text-center"
      style={{ boxShadow: "0 4px 32px rgba(124,58,237,0.06)" }}
    >
      {/* Animated icon */}
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 8px 32px rgba(124,58,237,0.35)" }}>
          <Database size={40} color="white" />
        </div>
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}
          className="absolute -right-1 -bottom-1 w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center shadow-lg">
          <span className="text-white font-black text-sm">!</span>
        </motion.div>
      </div>

      <div className="max-w-md">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">No Database Connected Yet</h2>
        <p className="text-slate-500 font-bold text-sm leading-relaxed mb-2">
          Think of this dashboard as your database's control room.
        </p>
        <p className="text-slate-400 text-sm leading-relaxed">
          Once you connect a database, you'll see its health score, how much storage it uses, all your tables, AI-powered suggestions to make it faster, and a visual map of how everything is connected.
        </p>
      </div>

      {/* Feature previews */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg">
        {[
          { emoji: "📊", label: "Health Score", desc: "Know if your DB is healthy" },
          { emoji: "🗺️", label: "Schema Map", desc: "See all tables visually" },
          { emoji: "🤖", label: "AI Suggestions", desc: "Auto-fix performance issues" },
          { emoji: "⚡", label: "Speed Analysis", desc: "Find slow queries instantly" },
          { emoji: "🛡️", label: "Security Check", desc: "Protect sensitive data" },
          { emoji: "🎤", label: "Ask AI Anything", desc: "Chat about your data" },
        ].map(f => (
          <div key={f.label} className="bg-white dark:bg-white/[0.03] rounded-2xl p-3 border border-slate-100 dark:border-white/10 text-left shadow-sm">
            <div className="text-xl mb-1">{f.emoji}</div>
            <p className="text-[12px] font-black text-slate-800 dark:text-slate-200">{f.label}</p>
            <p className="text-[10px] text-slate-400 font-medium">{f.desc}</p>
          </div>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.03, boxShadow: "0 8px 32px rgba(124,58,237,0.45)" }}
        whileTap={{ scale: 0.97 }}
        onClick={onConnect}
        className="flex items-center gap-2.5 px-8 py-4 rounded-2xl text-white font-black text-[15px] cursor-pointer"
        style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
      >
        <Plus size={18} /> Connect My Database
      </motion.button>
      <p className="text-[11px] text-slate-400 font-bold -mt-4">Supports PostgreSQL, MySQL, SQLite, MongoDB &amp; more</p>
    </motion.div>
  );
}

/* ─── Error State ──────────────────────────────────────────── */
function ErrorState({ message, onRetry, onConnect }: { message: string; onRetry: () => void; onConnect: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-5 rounded-3xl border border-rose-200 dark:border-rose-500/20 bg-gradient-to-br from-rose-50 dark:from-rose-500/5 to-white dark:to-transparent p-12 mt-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center" style={{ boxShadow: "0 4px 16px rgba(239,68,68,0.2)" }}>
        <AlertCircle size={28} className="text-rose-500" />
      </div>
      <div className="max-w-md">
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Connection Failed</h3>
        <p className="text-sm font-bold text-slate-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl px-4 py-2.5 mb-2">{message}</p>
        <p className="text-[12px] text-slate-400 font-medium">The database may be unavailable or the connection details may need updating.</p>
      </div>
      <div className="flex gap-3">
        <motion.button whileTap={{ scale: 0.97 }} onClick={onConnect}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white cursor-pointer"
          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
          <Plus size={14} /> New Connection
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all cursor-pointer">
          <RefreshCw size={14} /> Try Again
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ─── Loading Skeleton ─────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 mt-2 animate-in fade-in duration-300">
      <div className="p-4 rounded-2xl bg-violet-50 border border-violet-100 flex items-center gap-3">
        <div className="w-5 h-5 rounded-full bg-violet-200 animate-pulse" />
        <SkeletonPulse className="h-4 w-48" />
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <SkeletonPulse className="h-36 rounded-2xl" />
        {[...Array(4)].map((_, i) => <SkeletonPulse key={i} className="h-36 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => <SkeletonPulse key={i} className="h-28 rounded-2xl" />)}
      </div>
      <SkeletonPulse className="h-44 w-full rounded-2xl" />
      <SkeletonPulse className="h-96 w-full rounded-2xl" />
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionString, setConnectionString] = useState<string | null>(null);
  const [dbType, setDbType] = useState<string>("sql");
  const [graphKey, setGraphKey] = useState(0);
  const [isSchemaFullscreen, setIsSchemaFullscreen] = useState(false);
  const [dbName, setDbName] = useState<string>("");

  const handleFixApplied = () => { setGraphKey(k => k + 1); if (connectionString) fetchStats(connectionString); };

  const fetchStats = async (connStr: string) => {
    setStatsLoading(true); setStats(null); setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/dashboard`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_string: connStr }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to connect (Status: ${res.status}).`);
      }
      setStats(await res.json());
    } catch (e: any) {
      setError(e.message || "An error occurred while connecting.");
    } finally { setStatsLoading(false); }
  };

  useEffect(() => {
    const handler = (e: any) => {
      const { connStr, connectionType, projectName, name } = e.detail;
      setConnectionString(connStr);
      if (connectionType) setDbType(connectionType);
      const newName = name || projectName;
      if (newName) setDbName(newName);
      fetchStats(connStr);
    };
    window.addEventListener("project-changed", handler);
    const saved = localStorage.getItem("db_connection_string");
    const savedType = localStorage.getItem("db_type");
    const savedName = localStorage.getItem("db_project_name") || localStorage.getItem("project_name") || "";
    if (saved) {
      setConnectionString(saved);
      if (savedType) setDbType(savedType);
      if (savedName) setDbName(savedName);
      fetchStats(saved);
    } else { setStatsLoading(false); }
    return () => window.removeEventListener("project-changed", handler);
  }, []);

  const statTiles = stats ? [
    {
      label: "Storage Used", friendlyLabel: "How much disk space your DB uses",
      value: stats.total_size_mb || 0, unit: "MB",
      icon: Database, color: "#6366f1",
      gradient: "linear-gradient(135deg,#6366f1,#818cf8)",
      tip: "This is the total disk space consumed by all your data. Normal for most databases.",
    },
    {
      label: dbType === "mongodb" ? "Collections" : "Tables",
      friendlyLabel: dbType === "mongodb" ? "Places where your data lives" : "Individual data categories",
      value: stats.total_tables,
      icon: Folder, color: "#3b82f6",
      gradient: "linear-gradient(135deg,#3b82f6,#60a5fa)",
      tip: "Think of tables (or collections) like spreadsheet sheets — each one holds a different type of data.",
    },
    {
      label: dbType === "mongodb" ? "Indexes" : "Connections",
      friendlyLabel: dbType === "mongodb" ? "Fast lookup paths" : "How tables link together",
      value: dbType === "mongodb" ? (stats.total_indexes ?? "—") : (stats.total_fk_count ?? stats.total_foreign_keys ?? "—"),
      icon: GitMerge, color: "#10b981",
      gradient: "linear-gradient(135deg,#059669,#34d399)",
      tip: dbType === "mongodb"
        ? "Indexes are like a book's index — they help your database find data much faster."
        : "Foreign keys are like bridges between tables, linking related data safely.",
    },
    {
      label: dbType === "mongodb" ? "Documents" : "Primary Keys",
      friendlyLabel: dbType === "mongodb" ? "Individual data records" : "Unique IDs in your tables",
      value: dbType === "mongodb" ? (stats.total_documents ?? "—") : (stats.total_pk_count ?? "—"),
      icon: Key, color: "#f59e0b",
      gradient: "linear-gradient(135deg,#d97706,#fbbf24)",
      tip: dbType === "mongodb"
        ? "Each document is one record — like one row in a spreadsheet."
        : "Primary keys are unique IDs that identify each row, like a student ID number.",
    },
  ] : [];

  return (
    <DashboardShell>
      <div className="px-4 md:px-6 pb-8 w-full flex flex-col flex-1 min-h-0">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between py-4 md:py-5">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {dbName ? `${dbName}` : "Your Database Dashboard"}
            </h1>
            <p className="text-sm mt-0.5 font-bold text-slate-500 dark:text-slate-400">
              {stats
                ? "Everything your database is doing, at a glance"
                : connectionString
                ? "Loading your database health…"
                : "Connect a database to see its full picture"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/dashboard/ai")}
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-black text-white cursor-pointer"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}
            >
              <Bot size={14} /> Ask AI
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/connect")}
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-black text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.05] hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <Plus size={13} /> Connect Another
            </motion.button>
          </div>
        </div>

        {/* ── States ── */}
        {statsLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => connectionString && fetchStats(connectionString)} onConnect={() => router.push("/connect")} />
        ) : !connectionString && !stats ? (
          <EmptyState onConnect={() => router.push("/connect")} />
        ) : (
          <div className="flex flex-col flex-1 gap-6">

            {/* ── Status Banner ── */}
            {stats && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-center gap-3 px-5 py-3 rounded-2xl border dark:bg-opacity-10 dark:backdrop-blur-xl"
                style={{
                  background: stats.optimization_score >= 95 ? "#f0fdf4" : stats.optimization_score >= 80 ? "#eff6ff" : "#fefce8",
                  borderColor: stats.optimization_score >= 95 ? "#bbf7d0" : stats.optimization_score >= 80 ? "#bfdbfe" : "#fde68a",
                }}
              >
                <span className="text-lg">{stats.optimization_score >= 95 ? "🚀" : stats.optimization_score >= 80 ? "✅" : "⚠️"}</span>
                <div>
                  <p className="text-[13px] font-black text-slate-800 dark:text-slate-200">
                    {stats.optimization_score >= 95
                      ? "All systems running perfectly!"
                      : stats.optimization_score >= 80
                      ? "Database is healthy — minor improvements available below"
                      : "Some improvements recommended — check AI suggestions below"}
                  </p>
                  <p className="text-[11px] font-bold text-slate-500">
                    Database: <span className="font-black text-slate-700 dark:text-slate-300">{dbName || connectionString?.split("@")[1]?.split("/")[0] || "Connected"}</span>
                    {dbType && <span> · Type: <span className="font-black text-slate-700 dark:text-slate-300">{dbType.toUpperCase()}</span></span>}
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => connectionString && fetchStats(connectionString)}
                  className="ml-auto p-2 rounded-xl hover:bg-white/60 transition-all cursor-pointer text-slate-400 hover:text-slate-700"
                  title="Refresh stats"
                >
                  <RefreshCw size={14} />
                </motion.button>
              </motion.div>
            )}

            {/* ── Metrics Row ── */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
              {stats && <HealthHero score={stats.optimization_score} />}
              {statTiles.map((tile, i) => (
                <StatCard key={tile.label} {...tile} index={i} />
              ))}
            </div>

            {/* ── Quick Actions ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={13} className="text-violet-500" />
                <h2 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">What would you like to do?</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {QUICK_ACTIONS.map((action, i) => (
                  <ActionCard key={action.label} action={action} onClick={() => router.push(action.path)} index={i} />
                ))}
              </div>
            </section>

            {/* ── AI Recommendations ── */}
            {connectionString && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Bot size={13} className="text-violet-500" />
                  <h2 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">AI Recommendations</h2>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 uppercase tracking-widest">Auto-detected</span>
                </div>
                <OptimizationReport connectionString={connectionString} onApplied={handleFixApplied} />
              </section>
            )}

            {/* ── Schema Map ── */}
            <section className="flex flex-col flex-1 min-h-[440px]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Table2 size={13} className="text-violet-500" />
                  <h2 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Schema Map</h2>
                  <span className="text-[10px] font-bold text-slate-400">— a visual map of all your tables and how they connect</span>
                </div>
                <div className="flex gap-3 items-center text-[10px] text-slate-400 font-bold">
                  <div className="hidden sm:flex items-center gap-1.5">
                    <Key size={10} className="text-amber-400" /> Primary Key
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5">
                    <div className="w-3 h-0.5 rounded-full bg-violet-400" /> Foreign Key
                  </div>
                  <span className="hidden sm:inline text-slate-300">· Scroll to zoom · Drag to pan</span>
                  <motion.button whileTap={{ scale: 0.96 }}
                    onClick={() => setIsSchemaFullscreen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 font-black shadow-sm hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all cursor-pointer text-[11px]">
                    <Maximize2 size={12} /> Expand
                  </motion.button>
                </div>
              </div>

              {/* Fullscreen overlay */}
              <AnimatePresence>
                {isSchemaFullscreen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-slate-50 dark:bg-[#0B0A0F] flex flex-col p-5"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Database size={20} className="text-violet-500" /> Full Schema Map
                      </h2>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => setIsSchemaFullscreen(false)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 font-black shadow-sm hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all cursor-pointer text-sm">
                        <X size={15} /> Close
                      </motion.button>
                    </div>
                    <div className="flex-1 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-inner bg-white dark:bg-transparent">
                      {connectionString && <SchemaGraph key={graphKey} connectionString={connectionString} />}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Inline map */}
              <div className="flex-1 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden min-h-[420px] relative shadow-sm">
                {connectionString ? (
                  <SchemaGraph key={graphKey} connectionString={connectionString} />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                    <Table2 size={32} className="text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">Connect a database to see its schema map</p>
                  </div>
                )}
              </div>
            </section>

          </div>
        )}
      </div>
    </DashboardShell>
  );
}
