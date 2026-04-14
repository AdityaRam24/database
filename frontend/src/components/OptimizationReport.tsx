'use client';

// ─────────────────────────────────────────────────────────────
//  FILE: frontend/src/components/OptimizationReport.tsx
//  REDESIGNED: Clean cards, green success states, no red SQL
//  boxes, better micro-interactions
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Loader2, CheckCircle, RefreshCcw, ShieldCheck,
  Database, GitMerge, Table, AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ── Types ──────────────────────────────────────────────────
interface Recommendation {
  type: string;
  table: string;
  column?: string;
  description: string;
  sql_command: string;
  impact: 'High' | 'Medium' | 'Low';
}

interface OptimizationReportProps {
  connectionString: string;
  onApplied?: () => void;
}

interface SchemaStats {
  tables: number;
  rels: number;
  heaviest: { name: string; rows: number } | null;
}

// ── Impact badge ───────────────────────────────────────────
const IMPACT_STYLES: Record<string, string> = {
  High: 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400',
  Medium: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  Low: 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400',
};

function ImpactBadge({ impact }: { impact: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${IMPACT_STYLES[impact] ?? IMPACT_STYLES.Low}`}>
      {impact}
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────
function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] p-5 flex flex-col gap-3">
          <div className="flex gap-2 items-center">
            <div className="h-4 w-12 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="h-3 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-8 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

// ── Empty / all-good state ─────────────────────────────────
function AllGoodState({ schemaStats, onRescan }: { schemaStats: SchemaStats | null; onRescan: () => void }) {
  return (
    <div className="relative rounded-2xl border border-emerald-200/70 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 overflow-hidden group">
      
      {/* 3D Floating Elements inside AllGoodState */}
      <motion.div 
        animate={{ y: [0, -10, 0], rotate: [0, 5, 0], scale: [1, 1.05, 1] }} 
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
        className="absolute right-0 top-0 w-48 h-48 rounded-full border-[10px] border-emerald-500/10 pointer-events-none"
        style={{ transformOrigin: 'center center', transformStyle: 'preserve-3d', transform: 'rotateX(60deg) rotateY(-20deg)' }}
      />
      <motion.div 
        animate={{ y: [0, 10, 0], x: [0, -5, 0] }} 
        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
        className="absolute right-32 top-8 w-12 h-12 rounded bg-emerald-400/20 pointer-events-none blur-sm"
        style={{ transform: 'rotate(45deg)' }}
      />
      
      {/* Top accent line */}
      <div className="relative z-10 h-0.5 w-full bg-gradient-to-r from-emerald-400 to-teal-400" />

      <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle size={20} className="text-emerald-500" />
          </div>
          <div>
            <h4 className="text-[14px] font-bold text-emerald-800 dark:text-emerald-300">
              Schema is fully optimized
            </h4>
            <p className="text-[12px] text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">
              No obvious optimizations found. Your schema is healthy.
            </p>
          </div>
        </div>

        {schemaStats && (
          <div className="flex items-center gap-6 px-5 py-3 rounded-xl bg-white/60 dark:bg-white/5 border border-emerald-100 dark:border-emerald-500/10 shrink-0">
            <div className="text-center">
              <div className="flex items-center gap-1 text-[18px] font-extrabold text-slate-700 dark:text-slate-200 justify-center">
                <Database size={13} className="text-blue-400" />
                {schemaStats.tables}
              </div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mt-0.5">Tables</div>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <div className="flex items-center gap-1 text-[18px] font-extrabold text-slate-700 dark:text-slate-200 justify-center">
                <GitMerge size={13} className="text-teal-400" />
                {schemaStats.rels}
              </div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mt-0.5">Relations</div>
            </div>
            {schemaStats.heaviest && (
              <>
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                <div className="text-center hidden sm:block">
                  <div className="flex items-center gap-1 text-[14px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[100px]">
                    <Table size={11} className="text-amber-400 shrink-0" />
                    {schemaStats.heaviest.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mt-0.5">
                    Heaviest ({schemaStats.heaviest.rows.toLocaleString()})
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 px-6 pb-5">
        <Button
          variant="outline"
          size="sm"
          onClick={onRescan}
          className="bg-white dark:bg-white/5 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-xs font-bold rounded-lg shadow-sm group-hover:shadow-md transition-shadow"
        >
          <RefreshCcw size={12} className="mr-1.5" /> Run deep scan
        </Button>
      </div>
    </div>
  );
}

// ── Individual recommendation card ────────────────────────
interface RecCardProps {
  rec: Recommendation;
  idx: number;
  applied: boolean;
  applying: boolean;
  onApply: () => void;
}
function RecCard({ rec, idx, applied, applying, onApply }: RecCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-300 overflow-hidden ${
        applied
          ? 'border-emerald-200/70 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/5 opacity-60'
          : 'border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] hover:border-violet-200 dark:hover:border-violet-500/30 hover:shadow-md'
      }`}
    >
      {/* Left accent line */}
      {!applied && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-0.5 ${
            rec.impact === 'High' ? 'bg-red-400' : rec.impact === 'Medium' ? 'bg-amber-400' : 'bg-indigo-400'
          }`}
        />
      )}

      <div className="px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Left content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <ImpactBadge impact={rec.impact || 'Low'} />
            <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 truncate">
              {rec.table}{rec.column ? `.${rec.column}` : ''}
            </span>
          </div>

          {/* Description */}
          <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mb-2 leading-relaxed">
            {rec.description}
          </p>

          {/* SQL toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-semibold text-violet-500 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
          >
            {expanded ? 'Hide SQL ↑' : 'View SQL ↓'}
          </button>

          {expanded && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 overflow-x-auto">
              <code className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono break-all whitespace-pre-wrap">
                {rec.sql_command}
              </code>
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="shrink-0 sm:ml-4">
          {applied ? (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[12px] font-semibold">
              <CheckCircle size={14} /> Applied
            </div>
          ) : (
            <Button
              size="sm"
              onClick={onApply}
              disabled={applying}
              className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold min-w-[90px] shadow-sm shadow-violet-500/20 transition-all"
            >
              {applying ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Applying</>
              ) : (
                'Apply fix'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
const OptimizationReport: React.FC<OptimizationReportProps> = ({
  connectionString,
  onApplied,
}) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<number | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [schemaStats, setSchemaStats] = useState<SchemaStats | null>(null);

  const getRelativeTime = (date: Date) => {
    const secs = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins === 1) return '1 minute ago';
    if (mins < 60) return `${mins} minutes ago`;
    const hrs = Math.floor(mins / 60);
    return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`;
  };

  const fetchRecommendations = async () => {
    if (!connectionString) return;
    setLoading(true);
    setApplied(new Set());
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/optimization/scan`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection_string: connectionString }),
        }
      );
      const data = await res.json();
      setRecommendations(data.recommendations || []);
      setLastChecked(new Date());

      if (!data.recommendations?.length) {
        const graphRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/analysis/graph`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connection_string: connectionString }),
          }
        );
        const graphData = await graphRes.json();
        const nodes = graphData.nodes || [];
        const sorted = [...nodes].sort(
          (a: any, b: any) => (b.data?.rows || 0) - (a.data?.rows || 0)
        );
        setSchemaStats({
          tables: nodes.length,
          rels: (graphData.edges || []).length,
          heaviest: sorted[0]
            ? { name: sorted[0].data.label, rows: sorted[0].data.rows }
            : null,
        });
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (rec: Recommendation, idx: number) => {
    setApplying(idx);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/optimization/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection_string: connectionString,
            sql_command: rec.sql_command,
          }),
        }
      );
      if (res.ok) {
        setApplied((prev) => new Set(prev).add(idx));
        onApplied?.();
      } else {
        const err = await res.json();
        alert(`Failed to apply: ${err.detail}`);
      }
    } catch {
      alert('Failed to apply optimization due to network or server error.');
    } finally {
      setApplying(null);
    }
  };

  useEffect(() => { fetchRecommendations(); }, [connectionString]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // ── Header ─────────────────────────────────────────────
  const Header = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
          <ShieldCheck size={14} className="text-violet-500" />
        </div>
        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
          Optimization report
        </span>
      </div>
      <div className="flex items-center gap-2">
        {lastChecked && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            Checked {getRelativeTime(lastChecked)}
          </span>
        )}
        <button
          onClick={fetchRecommendations}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
          title="Re-scan"
        >
          <RefreshCcw size={12} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] p-6">
        {Header}
        <ReportSkeleton />
      </div>
    );
  }

  if (!recommendations.length) {
    return (
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] p-6">
        {Header}
        <AllGoodState schemaStats={schemaStats} onRescan={fetchRecommendations} />
      </div>
    );
  }

  const pendingCount = recommendations.length - applied.size;

  return (
    <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] p-6">
      {Header}

      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-0.5">
        <p className="text-[12px] text-slate-400 dark:text-slate-500 font-medium">
          <span className="font-bold text-slate-600 dark:text-slate-300">{recommendations.length}</span> improvements found
          {applied.size > 0 && (
            <span className="text-emerald-500 ml-1.5">· {applied.size} applied</span>
          )}
        </p>
        {pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => recommendations.forEach((rec, i) => {
              if (!applied.has(i)) {
                setTimeout(() => handleApply(rec, i), i * 300);
              }
            })}
            className="text-xs font-semibold border-slate-200 dark:border-slate-700 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:border-violet-200 dark:hover:border-violet-500/30 hover:text-violet-600 dark:hover:text-violet-400 transition-all"
          >
            Apply all ({pendingCount})
          </Button>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5">
        {recommendations.map((rec, idx) => (
          <RecCard
            key={`${rec.table}-${rec.type}-${idx}`}
            rec={rec}
            idx={idx}
            applied={applied.has(idx)}
            applying={applying === idx}
            onApply={() => handleApply(rec, idx)}
          />
        ))}
      </div>
    </div>
  );
};

export default OptimizationReport;
