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
  if (score >= 95) return { text: "Excellent", emoji: "🚀", color: "#10b981", bg: "#d1fae5", border: "#6ee7b7" };
  if (score >= 80) return { text: "Good", emoji: "✅", color: "#3b82f6", bg: "#dbeafe", border: "#93c5fd" };
  if (score >= 60) return { text: "Fair", emoji: "⚠️", color: "#f59e0b", bg: "#fef3c7", border: "#fcd34d" };
  return { text: "Needs Attention", emoji: "🔴", color: "#ef4444", bg: "#fee2e2", border: "#fca5a5" };
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
      className="relative rounded-2xl p-5 overflow-hidden group cursor-default"
      style={{ background: gradient, boxShadow: `0 4px 24px ${color}22` }}
    >
      {/* Decorative rings */}
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full border border-white/10 pointer-events-none" />
      <div className="absolute -right-2 -top-2 w-14 h-14 rounded-full border border-white/10 pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between mb-3">
        <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/15">
          <Icon size={14} className="text-white" />
        </div>
      </div>

      <div className="relative z-10 flex items-end gap-1.5 mb-2">
        <span className="text-[2.6rem] font-black tracking-tight leading-none text-white">{value}</span>
        {unit && <span className="text-base font-bold text-white/50 mb-1">{unit}</span>}
      </div>

      {/* Friendly label */}
      <p className="relative z-10 text-[12px] font-bold text-white/75">{friendlyLabel}</p>

      {/* Tooltip on hover */}
      <div className="absolute inset-x-0 bottom-0 h-0 group-hover:h-auto overflow-hidden transition-all duration-300">
        <div className="px-4 py-2 bg-black/30 backdrop-blur-sm">
          <p className="text-[11px] text-white/80 font-medium">{tip}</p>
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative rounded-2xl overflow-hidden p-6 row-span-1"
      style={{
        background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #9333ea 100%)",
        boxShadow: "0 8px 32px rgba(124,58,237,0.35)",
      }}
    >
      {/* Decoration */}
      <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full border border-white/10 pointer-events-none" />
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full border border-white/10 pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Overall Health</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black px-2.5 py-0.5 rounded-full" style={{ background: health.bg, color: health.color }}>
              {health.emoji} {health.text}
            </span>
          </div>
        </div>
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r="36" fill="none"
            stroke="white" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 40 40)"
            style={{ transition: "stroke-dashoffset 1.2s ease" }}
          />
          <text x="40" y="40" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="18" fontWeight="900">{score}</text>
          <text x="40" y="54" dominantBaseline="middle" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="700">/100</text>
        </svg>
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
  const Icon = action.icon;
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ 
        y: -10, 
        scale: 1.02,
        boxShadow: `0 16px 40px ${action.color}22`
      }}
      transition={{ 
        duration: 0.35, 
        delay: 0.15 + index * 0.05,
        y: { type: "tween", duration: 0.8, ease: "easeInOut" },
        scale: { type: "tween", duration: 0.8, ease: "easeInOut" },
        boxShadow: { duration: 0.8, ease: "easeInOut" }
      }}
      whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
      onClick={onClick}
      className="group text-left rounded-2xl p-4 border transition-all duration-700 ease-in-out cursor-pointer relative overflow-hidden"
      style={{ background: action.bg, borderColor: action.border }}
    >
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-colors duration-1000" />
      
      <div className="relative z-10 flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm transition-transform duration-1000 group-hover:scale-110" style={{ background: `${action.color}18` }}>
          {action.emoji}
        </div>
        <ChevronRight size={14} className="mt-1 transition-all duration-700 group-hover:translate-x-1" style={{ color: action.color }} />
      </div>
      <p className="relative z-10 text-[13px] font-black text-slate-900 leading-tight mb-1 transition-all duration-700">{action.label}</p>
      <p className="relative z-10 text-[11px] font-bold leading-snug transition-all duration-700" style={{ color: `${action.color}cc` }}>{action.whatItDoes}</p>
      
      <div className="relative z-10 overflow-hidden transition-all duration-1000 max-h-0 group-hover:max-h-20 opacity-0 group-hover:opacity-100 mt-0 group-hover:mt-2">
        <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic border-l-2 pl-2" style={{ borderColor: `${action.color}33` }}>
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
      className="flex flex-col items-center justify-center gap-8 rounded-3xl border-2 border-dashed border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-16 mt-4 text-center"
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
        <h2 className="text-2xl font-black text-slate-900 mb-3">No Database Connected Yet</h2>
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
          <div key={f.label} className="bg-white rounded-2xl p-3 border border-slate-100 text-left shadow-sm">
            <div className="text-xl mb-1">{f.emoji}</div>
            <p className="text-[12px] font-black text-slate-800">{f.label}</p>
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
      className="flex flex-col items-center justify-center gap-5 rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-12 mt-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center" style={{ boxShadow: "0 4px 16px rgba(239,68,68,0.2)" }}>
        <AlertCircle size={28} className="text-rose-500" />
      </div>
      <div className="max-w-md">
        <h3 className="text-lg font-black text-slate-900 mb-2">Connection Failed</h3>
        <p className="text-sm font-bold text-slate-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-2.5 mb-2">{message}</p>
        <p className="text-[12px] text-slate-400 font-medium">The database may be unavailable or the connection details may need updating.</p>
      </div>
      <div className="flex gap-3">
        <motion.button whileTap={{ scale: 0.97 }} onClick={onConnect}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white cursor-pointer"
          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
          <Plus size={14} /> New Connection
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer">
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
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              {dbName ? `${dbName}` : "Your Database Dashboard"}
            </h1>
            <p className="text-sm mt-0.5 font-bold text-slate-500">
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
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-black text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer"
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
                className="flex items-center gap-3 px-5 py-3 rounded-2xl border"
                style={{
                  background: stats.optimization_score >= 95 ? "#f0fdf4" : stats.optimization_score >= 80 ? "#eff6ff" : "#fefce8",
                  borderColor: stats.optimization_score >= 95 ? "#bbf7d0" : stats.optimization_score >= 80 ? "#bfdbfe" : "#fde68a",
                }}
              >
                <span className="text-lg">{stats.optimization_score >= 95 ? "🚀" : stats.optimization_score >= 80 ? "✅" : "⚠️"}</span>
                <div>
                  <p className="text-[13px] font-black text-slate-800">
                    {stats.optimization_score >= 95
                      ? "All systems running perfectly!"
                      : stats.optimization_score >= 80
                      ? "Database is healthy — minor improvements available below"
                      : "Some improvements recommended — check AI suggestions below"}
                  </p>
                  <p className="text-[11px] font-bold text-slate-500">
                    Database: <span className="font-black text-slate-700">{dbName || connectionString?.split("@")[1]?.split("/")[0] || "Connected"}</span>
                    {dbType && <span> · Type: <span className="font-black text-slate-700">{dbType.toUpperCase()}</span></span>}
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
                <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">What would you like to do?</h2>
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
                  <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">AI Recommendations</h2>
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
                  <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Schema Map</h2>
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
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-black shadow-sm hover:bg-slate-50 transition-all cursor-pointer text-[11px]">
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
                    className="fixed inset-0 z-[100] bg-slate-50 flex flex-col p-5"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <Database size={20} className="text-violet-500" /> Full Schema Map
                      </h2>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => setIsSchemaFullscreen(false)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-black shadow-sm hover:bg-slate-50 transition-all cursor-pointer text-sm">
                        <X size={15} /> Close
                      </motion.button>
                    </div>
                    <div className="flex-1 relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-white">
                      {connectionString && <SchemaGraph key={graphKey} connectionString={connectionString} />}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Inline map */}
              <div className="flex-1 rounded-2xl border border-slate-200 bg-white overflow-hidden min-h-[420px] relative shadow-sm">
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
