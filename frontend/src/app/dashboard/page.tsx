'use client';

// ─────────────────────────────────────────────────────────────
//  FILE: frontend/src/app/dashboard/page.tsx
//  REDESIGNED: Full UI/UX overhaul — seamless metrics bar,
//  elevated hero CTA, decluttered cards, rich micro-interactions
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import SchemaGraph from "@/components/SchemaGraph";
import OptimizationReport from "@/components/OptimizationReport";
import { useRouter } from "next/navigation";
import {
  Database, Folder, Key, Zap, GitMerge, Activity,
  ShieldAlert, Shield, BookOpen, Plus, ArrowUpRight,
  RefreshCw, AlertCircle, PlugZap,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";

// ── Quick action tiles ─────────────────────────────────────
const QUICK_ACTIONS = [
  { label: "Speed Optimization", desc: "Make queries faster", icon: Zap, color: "#f59e0b", path: "/dashboard/performance" },
  { label: "Safe Changes", desc: "Modify schema safely", icon: GitMerge, color: "#3b82f6", path: "/dashboard/governance" },
  { label: "Vital Signs", desc: "Monitor traffic & health", icon: Activity, color: "#ef4444", path: "/dashboard/anomaly" },
  { label: "Alerts", desc: "View incident logs", icon: ShieldAlert, color: "#f97316", path: "/dashboard/incidents" },
  { label: "Privacy & Security", desc: "Manage PII & access", icon: Shield, color: "#818cf8", path: "/dashboard/security" },
  { label: "Company Knowledge", desc: "Teach the AI rules", icon: BookOpen, color: "#a78bfa", path: "/dashboard/semantic" },
];

// ── Skeleton card ──────────────────────────────────────────
function SkeletonPulse({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800 ${className}`}
    />
  );
}

// ── Stat metric tile ───────────────────────────────────────
interface StatTileProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  color: string;
  gradient: string;
  sub: string;
  delay?: number;
}
function StatTile({ label, value, unit, icon: Icon, color, gradient, sub, delay = 0 }: StatTileProps) {
  return (
    <div
      className="group relative flex flex-col gap-2 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 overflow-hidden"
      style={{ background: gradient, animationDelay: `${delay}ms` }}
    >
      {/* Decorative circle */}
      <div className="pointer-events-none absolute -right-4 -top-4 w-20 h-20 rounded-full border border-white/10 transition-opacity duration-300 group-hover:opacity-60" />

      <div className="flex items-center justify-between relative z-10">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
          {label}
        </span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/15 backdrop-blur-sm">
          <Icon size={13} className="text-white/80" />
        </div>
      </div>

      <div className="flex items-end gap-1.5 relative z-10">
        <span className="text-[2.25rem] font-extrabold tracking-tight leading-none text-white">
          {value}
        </span>
        {unit && (
          <span className="text-base font-semibold text-white/50 mb-0.5">
            {unit}
          </span>
        )}
      </div>

      {/* Color bar */}
      <div className="relative z-10 w-full h-1 rounded-full bg-white/15 overflow-hidden">
        <div className="h-full w-3/4 rounded-full bg-white/40" />
      </div>

      <p className="text-[12px] text-white/65 font-medium relative z-10">{sub}</p>
    </div>
  );
}

// ── Health score card (featured) ───────────────────────────
function HealthScoreCard({ score }: { score: number }) {
  const isGreat = score === 100;
  const isGood = score > 80;
  const label = isGreat
    ? "Perfect health — your DB is flying."
    : isGood
      ? "Good health — minor improvements available."
      : "Attention needed — let AI assist.";
  const ring = isGreat ? "#10b981" : isGood ? "#6366f1" : "#f59e0b";

  return (
    <div className="group relative col-span-full sm:col-span-1 flex flex-col gap-3 rounded-2xl overflow-hidden p-5 transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5"
      style={{ background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 60%,#9333ea 100%)" }}
    >
      {/* Orbit decoration */}
      <div className="pointer-events-none absolute -right-10 -top-10 w-48 h-48 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-4 -top-4 w-28 h-28 rounded-full border border-white/10" />

      <div className="flex items-center justify-between relative z-10">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
          Overall Health
        </span>
        <Activity size={13} className="text-white/40" />
      </div>

      <div className="relative z-10 flex items-end gap-2">
        <span className="text-[3.5rem] font-black tracking-tight leading-none text-white">
          {score}
        </span>
        <span className="text-xl font-bold text-white/40 mb-1">/ 100</span>
      </div>

      {/* Mini progress bar */}
      <div className="relative z-10 w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${score}%`, background: ring }}
        />
      </div>

      <p className="relative z-10 text-[12px] text-white/75 font-medium leading-relaxed">
        {label}
      </p>
    </div>
  );
}

// ── Empty / no-connection state ────────────────────────────
function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-white/[0.02] backdrop-blur p-16 mt-8 text-center">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shadow-inner">
          <PlugZap size={32} className="text-violet-400" />
        </div>
        <div className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow-sm">
          <span className="text-white font-black text-[10px]">!</span>
        </div>
      </div>

      <div className="max-w-xs">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          No database connected
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Connect a PostgreSQL database to unlock schema visualization, AI-powered optimizations, and real-time insights.
        </p>
      </div>

      <button
        onClick={onConnect}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 active:translate-y-0"
      >
        <Plus size={14} />
        Connect a Database
      </button>
    </div>
  );
}

// ── Error state ────────────────────────────────────────────
function ErrorState({
  message,
  onRetry,
  onConnect,
}: {
  message: string;
  onRetry: () => void;
  onConnect: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-3xl border border-red-200/60 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 backdrop-blur p-12 mt-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center ring-4 ring-red-100 dark:ring-red-500/10">
        <AlertCircle size={28} className="text-red-400" />
      </div>

      <div className="max-w-md">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
          Connection failed
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-1">
          {message}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
          The database may have been removed or the connection string is invalid. Try reconnecting or select another project from the sidebar.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onConnect}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-md shadow-violet-500/20"
        >
          <Plus size={14} /> Connect New Database
        </button>
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all"
        >
          <RefreshCw size={14} /> Retry Connection
        </button>
      </div>
    </div>
  );
}

// ── Loading skeleton grid ──────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 mt-2">
      {/* Metric bar skeletons */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <SkeletonPulse className="h-3 w-24" />
              <SkeletonPulse className="h-7 w-7 rounded-lg" />
            </div>
            <SkeletonPulse className="h-10 w-20" />
            <SkeletonPulse className="h-3 w-32" />
          </div>
        ))}
      </div>
      {/* Optimization report skeleton */}
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] p-6 flex flex-col gap-4">
        <SkeletonPulse className="h-4 w-40" />
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonPulse key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      {/* Schema skeleton */}
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] p-6 h-80">
        <SkeletonPulse className="h-4 w-48 mb-4" />
        <SkeletonPulse className="h-full w-full rounded-xl" />
      </div>
    </div>
  );
}

// ── Quick-action tile ──────────────────────────────────────
function QuickActionTile({
  action,
  onClick,
  index,
}: {
  action: (typeof QUICK_ACTIONS)[0];
  onClick: () => void;
  index: number;
}) {
  const Icon = action.icon;
  return (
    <button
      onClick={onClick}
      className="group relative flex items-center gap-3 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] p-3.5 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Icon */}
      <div
        className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
        style={{ background: `${action.color}16` }}
      >
        <Icon size={16} style={{ color: action.color }} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">
          {action.label}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
          {action.desc}
        </p>
      </div>

      {/* Arrow */}
      <ArrowUpRight
        size={14}
        className="shrink-0 text-slate-300 dark:text-slate-600 transition-all duration-200 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionString, setConnectionString] = useState<string | null>(null);
  const [graphKey, setGraphKey] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleFixApplied = () => {
    setGraphKey((k) => k + 1);
    if (connectionString) fetchStats(connectionString);
  };

  const fetchStats = async (connStr: string) => {
    setStatsLoading(true);
    setStats(null);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/analysis/dashboard`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connection_string: connStr }),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.detail || `Failed to connect (Status: ${res.status}).`
        );
      }
      setStats(await res.json());
    } catch (e: any) {
      setError(e.message || "An error occurred while connecting.");
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e: any) => {
      const { connStr } = e.detail;
      setConnectionString(connStr);
      fetchStats(connStr);
    };
    window.addEventListener("project-changed", handler);

    const saved = localStorage.getItem("db_connection_string");
    if (saved) {
      setConnectionString(saved);
      fetchStats(saved);
    } else {
      setStatsLoading(false);
    }

    return () => window.removeEventListener("project-changed", handler);
  }, []);

  const statTiles: StatTileProps[] = stats
    ? [
      {
        label: "Storage Used",
        value: stats.total_size_mb,
        unit: "MB",
        icon: Database,
        color: "#6366f1",
        gradient: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
        sub: "Total disk space consumed",
        delay: 0,
      },
      {
        label: "Data Collections",
        value: stats.total_tables,
        icon: Folder,
        color: "#3b82f6",
        gradient: "linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)",
        sub: "Active database tables",
        delay: 60,
      },
      {
        label: "Safe Connections",
        value: stats.total_fk_count ?? stats.total_foreign_keys ?? "—",
        icon: GitMerge,
        color: "#10b981",
        gradient: "linear-gradient(135deg, #059669 0%, #34d399 100%)",
        sub: "Data relationships verified",
        delay: 120,
      },
      {
        label: "Primary Keys",
        value: stats.total_pk_count ?? "—",
        icon: Key,
        color: "#f59e0b",
        gradient: "linear-gradient(135deg, #d97706 0%, #fbbf24 100%)",
        sub: "Unique row identifiers",
        delay: 180,
      },
    ]
    : [];

  return (
    <DashboardShell>
      <div className="px-4 md:px-6 pb-8 w-full flex flex-col flex-1 min-h-0">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between py-4 md:py-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'hsl(255 40% 15%)' }}>
              Overview
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'hsl(255 20% 38%)' }}>
              High-level metrics for your selected database
            </p>
          </div>

          <button
            onClick={() => router.push("/connect")}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-all"
          >
            <Plus size={13} /> Connect Another
          </button>
        </div>

        {/* ── States ── */}
        {statsLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => connectionString && fetchStats(connectionString)}
            onConnect={() => router.push("/connect")}
          />
        ) : !connectionString && !stats ? (
          <EmptyState onConnect={() => router.push("/connect")} />
        ) : (
          <div className="flex flex-col flex-1 gap-6 animate-in fade-in slide-in-from-bottom-3 duration-500">

            {/* ── Metrics bar ── */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {/* Health score — spans 1 col on mobile, 1 on lg */}
              {stats && (
                <HealthScoreCard score={stats.optimization_score} />
              )}

              {/* Stat tiles */}
              {statTiles.map((tile) => (
                <StatTile key={tile.label} {...tile} />
              ))}
            </div>

            {/* ── Quick actions ── */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 px-0.5">
                Quick actions
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {QUICK_ACTIONS.map((action, i) => (
                  <QuickActionTile
                    key={action.label}
                    action={action}
                    onClick={() => router.push(action.path)}
                    index={i}
                  />
                ))}
              </div>
            </section>

            {/* ── Optimization report ── */}
            {connectionString && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 px-0.5">
                  AI recommendations
                </h3>
                <OptimizationReport
                  connectionString={connectionString}
                  onApplied={handleFixApplied}
                />
              </section>
            )}

            {/* ── Schema visualization ── */}
            <section className="flex flex-col flex-1 min-h-[440px]">
              <div className="flex items-center justify-between mb-3 px-0.5">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Schema visualization
                </h3>
                <div className="flex gap-4 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Key size={11} className="text-amber-400" /> Primary key
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 rounded-full bg-violet-400" /> Foreign key
                  </div>
                  <span className="hidden sm:inline text-slate-300 dark:text-slate-600">
                    Scroll to zoom · Drag to pan
                  </span>
                </div>
              </div>

              <div className="flex-1 rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] overflow-hidden min-h-[420px] relative">
                {connectionString ? (
                  <SchemaGraph key={graphKey} connectionString={connectionString} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                    Connect a database to visualize the schema
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
