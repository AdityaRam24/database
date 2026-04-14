'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2, Activity, AlertTriangle, CheckCircle,
    RefreshCw, TrendingUp, Database, Wifi, Zap, BarChart3,
    Info, XCircle, HeartPulse, ActivitySquare, ServerCrash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardShell from '@/components/DashboardShell';
import { motion } from 'framer-motion';

/* ── Types ─────────────────────────────────────────────────────────── */

interface MetricEntry {
    metric: string;
    label: string;
    unit: string;
    current_value: number;
    mean: number;
    std: number;
    z_score: number;
    severity: 'normal' | 'warning' | 'critical';
    upper_bound: number;
    lower_bound: number;
    deviation_pct: number;
    root_cause?: string;
}

interface AnomalyResult {
    status: string;
    snapshot_count: number;
    anomalies: MetricEntry[];
    metrics_summary: Record<string, MetricEntry>;
    last_updated?: string;
    message?: string;
}

interface HistoryData {
    series: {
        timestamps: string[];
        total_size: number[];
        connection_count: number[];
        total_seq_scans: number[];
        cache_hit_ratio: number[];
        active_queries: number[];
    };
    confidence_bands: Record<string, { mean: number; upper: number; lower: number }>;
    snapshot_count: number;
}

/* ── Metric config ─────────────────────────────────────────────────── */

const METRIC_CONFIG: Record<string, { label: string; icon: any; color: string; format: (v: number) => string }> = {
    total_size: { label: 'Database Storage Size', icon: Database, color: '#8b5cf6', format: (v) => `${(v / 1024 / 1024).toFixed(1)} MB` },
    connection_count: { label: 'Active User Sockets', icon: Wifi, color: '#10b981', format: (v) => `${v}` },
    total_seq_scans: { label: 'Intensive Disk Reads', icon: Zap, color: '#f59e0b', format: (v) => `${v.toLocaleString()}` },
    cache_hit_ratio: { label: 'Memory Retention', icon: BarChart3, color: '#3b82f6', format: (v) => `${(v * 100).toFixed(1)}%` },
    active_queries: { label: 'Ongoing Core Routines', icon: ActivitySquare, color: '#ec4899', format: (v) => `${v}` },
};

/* ── Animated ECG Heartbeat ────────────────────────────────────────── */

function ECGHeartbeat({ severity = 'normal' }: { severity?: 'normal' | 'warning' | 'critical' }) {
    const pulseColors = {
        normal: { stroke: "#10b981", shadow: "#10b981", bg: "bg-emerald-500", text: "text-emerald-500" },
        warning: { stroke: "#f59e0b", shadow: "#f59e0b", bg: "bg-amber-500", text: "text-amber-500" },
        critical: { stroke: "#ef4444", shadow: "#ef4444", bg: "bg-rose-500", text: "text-rose-500" }
    };

    const config = pulseColors[severity];
    const duration = severity === 'critical' ? 0.6 : severity === 'warning' ? 1.2 : 2.5;

    return (
        <div className="w-full max-w-sm mx-auto my-8 relative flex items-center justify-center h-24 overflow-hidden rounded-xl bg-slate-900 border border-slate-800 shadow-inner group">
            <div className="absolute inset-0 bg-[size:16px_16px] bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]"></div>

            <svg viewBox="0 0 400 100" className="w-full h-full relative z-10" preserveAspectRatio="none">
                <path d="M0,50 L400,50" stroke={config.stroke} strokeWidth="1" strokeOpacity="0.2" fill="none" />

                <motion.path
                    d="M-50,50 L50,50 L65,50 L75,20 L85,80 L100,25 L115,50 L250,50 L265,50 L275,20 L285,80 L300,25 L315,50 L450,50"
                    stroke={config.stroke}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    initial={{ pathLength: 0, pathOffset: 1 }}
                    animate={{ pathLength: 1, pathOffset: 0 }}
                    transition={{
                        duration,
                        ease: "linear",
                        repeat: Infinity,
                    }}
                    style={{ filter: `drop-shadow(0 0 6px ${config.shadow})` }}
                />
            </svg>
            <div className="absolute top-2 left-3 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${config.bg} animate-pulse`}></div>
                <span className={`text-[9px] font-black uppercase tracking-widest ${config.text} font-mono`}>
                    {severity === 'normal' ? 'Standard Rhythm' : severity === 'warning' ? 'Tachycardia / Elevated' : 'Critical Arrhythmia'}
                </span>
            </div>
        </div>
    );
}

/* ── Mini chart ────────────────────────────────────────────────────── */

function MiniChart({ values, band, color }: { values: number[]; band: { mean: number; upper: number; lower: number }; color: string }) {
    if (values.length < 2) return <p className="text-[10px] uppercase font-black tracking-widest text-center text-slate-400 my-8">Awaiting Telemetry Sync...</p>;

    const w = 400, h = 140, pad = 24;
    const allVals = [...values, band.upper, band.lower].filter(v => v !== undefined);
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals) || 1;
    let range = maxV - minV;
    if (range === 0) range = 1;

    const toX = (i: number) => pad + (i / (values.length - 1)) * (w - 2 * pad);
    const toY = (v: number) => h - pad - ((v - minV) / range) * (h - 2 * pad);

    const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
    // Add slightly more breathing room for the band bounds visually so lines aren't exactly overlapping margins
    const visualUpperY = toY(maxV) - 5;
    const visualLowerY = toY(minV) + 5;

    // Draw polygon for the safe threshold band
    const bandPath = `M${pad},${toY(band.upper)} L${w - pad},${toY(band.upper)} L${w - pad},${toY(band.lower)} L${pad},${toY(band.lower)} Z`;

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 140 }}>
            {/* Safe Zone Background */}
            <path d={bandPath} fill={color} fillOpacity={0.06} className="transition-all" />

            {/* Threshold Lines */}
            <line x1={pad} y1={toY(band.upper)} x2={w - pad} y2={toY(band.upper)} stroke={color} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="4 4" />
            <line x1={pad} y1={toY(band.lower)} x2={w - pad} y2={toY(band.lower)} stroke={color} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="4 4" />

            {/* Baseline */}
            <line x1={pad} y1={toY(band.mean)} x2={w - pad} y2={toY(band.mean)} stroke={color} strokeOpacity={0.15} strokeWidth={1} />

            {/* Data Line */}
            <polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />

            {/* Data points */}
            {values.map((v, i) => {
                const isAnomaly = v > band.upper || v < band.lower;
                return (
                    <circle key={i} cx={toX(i)} cy={toY(v)} r={isAnomaly ? 5 : 3.5}
                        fill={isAnomaly ? '#ef4444' : '#ffffff'}
                        stroke={isAnomaly ? '#fca5a5' : color}
                        strokeWidth={2}
                    />
                );
            })}

            {/* Legends */}
            <text x={w - pad + 6} y={toY(band.upper) + 3} fill={color} fillOpacity={0.7} fontSize={9} fontWeight="bold">Max Tolerance</text>
            <text x={w - pad + 6} y={toY(band.lower) + 3} fill={color} fillOpacity={0.7} fontSize={9} fontWeight="bold">Min Tolerance</text>
            <text x={w - pad + 6} y={toY(band.mean) + 3} fill={color} fillOpacity={0.5} fontSize={9} fontWeight="bold">Usual Baseline</text>
        </svg>
    );
}

/* ── Main Page ─────────────────────────────────────────────────────── */

export default function AnomalyPage() {
    const router = useRouter();
    const [connectionString, setConnectionString] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [collecting, setCollecting] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [anomalyResult, setAnomalyResult] = useState<AnomalyResult | null>(null);
    const [history, setHistory] = useState<HistoryData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [guideMode, setGuideMode] = useState(false);

    const API = process.env.NEXT_PUBLIC_API_URL;

    useEffect(() => {
        const init = (cs: string) => {
            setConnectionString(cs);
            setMounted(true);
            setAnomalyResult(null);
            setHistory(null);
            doDetect(cs);
        };

        const cs = localStorage.getItem('db_connection_string');
        if (!cs) { router.replace('/dashboard'); return; }
        init(cs);

        const handler = (e: any) => {
            const newCs = e?.detail?.connStr || localStorage.getItem('db_connection_string');
            console.log('[Vitals] project-changed fired, switching to:', newCs);
            if (newCs) init(newCs);
        };
        window.addEventListener('project-changed', handler);
        return () => window.removeEventListener('project-changed', handler);
    }, []);

    const doCollect = async (cs: string) => {
        setCollecting(true);
        setError(null);
        try {
            await fetch(`${API}/anomaly/collect`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: cs }),
            });
            await doDetect(cs);
        } catch (e: any) { setError(e.message); }
        finally { setCollecting(false); }
    };

    const doDetect = async (cs: string) => {
        setDetecting(true);
        setError(null);
        try {
            const [anomRes, histRes] = await Promise.all([
                fetch(`${API}/anomaly/detect`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ connection_string: cs }),
                }),
                fetch(`${API}/anomaly/history`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ connection_string: cs }),
                }),
            ]);
            setAnomalyResult(await anomRes.json());
            setHistory(await histRes.json());
        } catch (e: any) { setError(e.message); }
        finally { setDetecting(false); }
    };

    if (!mounted) return null;

    const anomalyCount = anomalyResult?.anomalies?.length ?? 0;
    const isInsufficient = anomalyResult?.status === 'insufficient_data';

    const getHumanReadableStatus = (z: number) => {
        const absZ = Math.abs(z);
        if (absZ >= 3) return { label: 'CRITICAL SPIKE', cls: 'bg-rose-100 text-rose-700 border-rose-200' };
        if (absZ >= 1.5) return { label: 'ELEVATED STRESS', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
        return { label: 'NORMAL RHYTHM', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm' };
    };

    return (
        <DashboardShell>
            <div className="flex flex-col h-full w-full max-w-[1400px] mx-auto pb-16">

                {/* ── Page Header ── */}
                <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3 border-b border-gray-100 bg-white shadow-sm z-10 relative">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center relative shadow-inner ring-1 ring-rose-200">
                            <HeartPulse size={22} className="text-rose-500" />
                            {anomalyCount > 0 && <div className="absolute top-0 right-0 -mr-1 -mt-1 w-3 h-3 bg-rose-500 rounded-full animate-ping"></div>}
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                Autonomous Health Monitor
                                {anomalyCount > 0 && (
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1.5 ml-2">
                                        <AlertTriangle size={12} /> {anomalyCount} Fault{anomalyCount === 1 ? '' : 's'} Detected
                                    </span>
                                )}
                            </h1>
                            <p className="text-[13px] text-slate-500 font-bold mt-0.5 uppercase tracking-widest flex items-center gap-1.5">
                                <Activity size={12} /> Active Engine Diagnostics
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            size="sm"
                            disabled={!connectionString || collecting || detecting}
                            onClick={() => connectionString && doCollect(connectionString)}
                            className="bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200 shadow-sm font-black uppercase tracking-widest text-[10px] rounded-xl cursor-pointer h-9 px-4 transition-all"
                        >
                            {collecting ? <><Loader2 size={13} className="animate-spin mr-2" /> Syncing</> : <><RefreshCw size={13} className="mr-2" /> Capture Current Vitals</>}
                        </Button>
                        <Button
                            size="sm"
                            disabled={!connectionString || detecting || collecting}
                            onClick={() => connectionString && doDetect(connectionString)}
                            className="bg-slate-900 hover:bg-slate-800 text-white shadow-[0_4px_14px_0_rgba(15,23,42,0.39)] font-black uppercase tracking-widest text-[10px] rounded-xl cursor-pointer h-9 px-4 transition-all"
                        >
                            {detecting ? <><Loader2 size={13} className="animate-spin mr-2 text-white" /> Computing Matrix</> : <><Activity size={13} className="mr-2 text-emerald-400" /> Run AI Diagnosis</>}
                        </Button>
                    </div>
                </div>

                {/* ── Error banner ── */}
                {error && (
                    <div className="mx-6 mt-6 px-5 py-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-[13px] font-bold flex items-center gap-3 shadow-sm">
                        <ServerCrash size={18} className="shrink-0" /> {error}
                    </div>
                )}

                <div className="flex flex-col w-full mx-auto px-4 md:px-8 mt-8 gap-8">

                    {/* ── Insufficient data notice ── */}
                    {isInsufficient && (
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200/60 rounded-3xl p-6 flex flex-col md:flex-row items-center md:items-start gap-5 shadow-sm">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-indigo-100 flex items-center justify-center shrink-0">
                                <Info size={24} className="text-indigo-500" />
                            </div>
                            <div className="text-center md:text-left">
                                <h3 className="text-base font-black text-indigo-900 uppercase tracking-widest mb-1">Calibrating Diagnostic Engine</h3>
                                <p className="text-[13px] text-indigo-800/80 leading-relaxed font-bold max-w-4xl">
                                    {anomalyResult?.message} Click <strong className="text-emerald-700 bg-emerald-100/50 px-1.5 py-0.5 rounded ml-1">Capture Current Vitals</strong> a few consecutive times to feed the AI baseline data. Once it establishes what "Standard Capability" looks like for your system, it will aggressively flag erratic behaviors.
                                </p>
                            </div>
                        </div>
                    )}

                    {detecting && !anomalyResult ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20 rounded-full"></div>
                                <Loader2 size={36} className="relative text-emerald-600 animate-spin" />
                            </div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600/80 animate-pulse">Running advanced diagnostic protocols…</p>
                        </div>
                    ) : (
                        <>
                            {/* ── Vital Status Pillars ── */}
                            {anomalyResult?.status === 'analyzed' && (
                                <>
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100"><Info size={16} /></div>
                                        <p className="text-[12px] text-slate-500 font-medium">
                                            The <strong>Autonomous Health Monitor</strong> evaluates real-time telemetry against historical baselines.
                                            {guideMode ? (
                                                <span className="block mt-1 text-slate-700 italic border-l-2 border-amber-300 pl-3 py-1 bg-amber-50/50 rounded-r-lg">
                                                    "It checks if your database is behaving like it usually does. If it sees something 'weird' or 'erratic' compared to yesterday, it flags it here."
                                                </span>
                                            ) : (
                                                <> Status is determined by <span className="text-indigo-600 font-bold">Z-Scores</span>: a statistical measure of how many "steps" a metric has strayed from its usual path.</>
                                            )}
                                        </p>
                                    </div>
                                    <motion.div 
                                        className="grid grid-cols-2 lg:grid-cols-5 gap-4"
                                        initial="hidden"
                                        animate="show"
                                        variants={{
                                            hidden: { opacity: 0 },
                                            show: { opacity: 1, transition: { staggerChildren: 0.1 } }
                                        }}
                                    >
                                        {Object.entries(anomalyResult.metrics_summary).map(([key, entry]) => {
                                            const cfg = METRIC_CONFIG[key];
                                            if (!cfg) return null;
                                            const Icon = cfg.icon;
                                            const isAnomalous = entry.severity !== 'normal';
                                            const status = getHumanReadableStatus(entry.z_score);

                                            return (
                                                <motion.div 
                                                    key={key} 
                                                    title={`Z-Score: ${entry.z_score.toFixed(2)} SD from mean`} 
                                                    variants={{
                                                        hidden: { opacity: 0, y: 20 },
                                                        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 25 } }
                                                    }}
                                                    whileHover={{ scale: 1.02, y: -2 }}
                                                    className={`relative flex flex-col justify-between overflow-hidden rounded-[20px] p-5 shadow-sm transition-all border group
                                                    ${isAnomalous ? 'bg-white border-rose-200 ring-4 ring-rose-50' : 'bg-white border-slate-200 hover:border-slate-300'}`}>

                                                    <div className="flex items-center gap-2 mb-4 shrink-0">
                                                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                                                            <Icon size={14} style={{ color: cfg.color }} />
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest line-clamp-1">{cfg.label}</span>
                                                    </div>

                                                    <div className="flex-1">
                                                        <p className={`text-2xl font-black mb-3 truncate font-mono ${isAnomalous ? 'text-rose-600' : 'text-slate-800'}`}>
                                                            {cfg.format(entry.current_value)}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center justify-between mt-auto">
                                                        <div className={`inline-flex w-max items-center px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${status.cls}`}>
                                                            {status.label}
                                                        </div>
                                                        <span className="text-[9px] text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {guideMode ? 'Anomaly Strength' : 'Z-Score'}: {entry.z_score.toFixed(1)}
                                                        </span>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </motion.div>

                                    {guideMode && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 animate-in slide-in-from-top-4 duration-500">
                                            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                                                <p className="text-[10px] font-black text-amber-600 uppercase mb-2">Steady Rhythm</p>
                                                <p className="text-xs text-amber-800 font-medium font-mono leading-relaxed">The database pulse is normal. Green telemetry means zero deviations from history.</p>
                                            </div>
                                            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                                                <p className="text-[10px] font-black text-amber-600 uppercase mb-2">Z-Score (Weirdness)</p>
                                                <p className="text-xs text-amber-800 font-medium font-mono leading-relaxed">A high Z-score means a metric has strayed far from its normal path (like a heart rate spike).</p>
                                            </div>
                                            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                                                <p className="text-[10px] font-black text-amber-600 uppercase mb-2">Telemetry Streams</p>
                                                <p className="text-xs text-amber-800 font-medium font-mono leading-relaxed">Continuous sensor data mapped against your database baseline snapshots.</p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── Anomaly Alerts / Diagnoses ── */}
                            {anomalyResult?.anomalies && anomalyResult.anomalies.length > 0 && (
                                <section className="mt-4">
                                    <h2 className="text-[11px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2 mb-4 bg-rose-50 w-max px-3 py-1.5 rounded-lg border border-rose-100">
                                        <AlertTriangle size={14} /> Attention: System Irregularities Detected
                                    </h2>
                                    <div className="flex flex-col gap-4">
                                        {anomalyResult.anomalies.map((a, i) => {
                                            const cfg = METRIC_CONFIG[a.metric];
                                            return (
                                                <div key={i} className={`relative overflow-hidden rounded-2xl bg-white border shadow-md border-rose-200`}>
                                                    <div className="absolute top-0 left-0 bottom-0 w-2 bg-rose-500" />

                                                    <div className="p-6 pl-8 flex flex-col md:flex-row md:items-center justify-between gap-6">

                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-widest bg-rose-100 text-rose-700 border-rose-300 shadow-sm`}>
                                                                    DIAGNOSIS
                                                                </span>
                                                                <span className="font-bold text-sm text-slate-800">{cfg ? cfg.label : a.label} is Spiking</span>
                                                            </div>
                                                            <p className="text-[13px] text-slate-600 leading-relaxed font-medium max-w-3xl mt-2">
                                                                The engine observed that your <strong className="text-rose-600 bg-rose-50 px-1 rounded">{a.label}</strong> reading is currently <strong className="font-black">{a.deviation_pct}%</strong> off its normal historical pathway.
                                                                {a.root_cause && <span className="block mt-2 font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100"><Info size={14} className="inline mr-1 text-slate-400 -mt-0.5" /> {a.root_cause}</span>}
                                                            </p>
                                                        </div>

                                                        <div className="flex flex-col gap-2 shrink-0 bg-slate-50 p-4 rounded-xl border border-slate-100 min-w-[140px]">
                                                            <div>
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Standard Limit</p>
                                                                <p className="text-xs font-bold text-slate-600 font-mono">{(a.upper_bound).toLocaleString()}</p>
                                                            </div>
                                                            <div className="w-full h-px bg-slate-200"></div>
                                                            <div>
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-rose-400 mb-1">Current State</p>
                                                                <p className="text-sm font-black text-rose-600 font-mono">{(a.current_value).toLocaleString()}</p>
                                                            </div>
                                                        </div>

                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* ── All clear (Heartbeat) ── */}
                            {anomalyResult?.status === 'analyzed' && (
                                <div className="mt-4 mb-8">
                                    <ECGHeartbeat severity={anomalyCount > 0 ? (anomalyResult.anomalies.some(a => a.severity === 'critical') ? 'critical' : 'warning') : 'normal'} />
                                    <div className="text-center">
                                        {anomalyCount === 0 ? (
                                            <>
                                                <p className="text-sm font-black text-emerald-700 mb-1 uppercase tracking-widest flex items-center justify-center gap-2">
                                                    <CheckCircle size={16} /> Engine Metrics Stable
                                                </p>
                                                <p className="text-xs font-bold text-slate-500">System operating well within historical tolerance limits.</p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-sm font-black text-rose-700 mb-1 uppercase tracking-widest flex items-center justify-center gap-2">
                                                    <AlertTriangle size={16} /> Abnormal Pulse Detected
                                                </p>
                                                <p className="text-xs font-bold text-slate-500">Telemetry streams show erratic activity signatures. Manual audit required.</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Historical Pulse Monitors ── */}
                            {history && history.snapshot_count >= 2 && (
                                <section className="mt-8 border-t border-slate-200/60 pt-8">
                                    <h2 className="text-[11px] font-black text-violet-600 uppercase tracking-widest flex items-center gap-2 mb-6">
                                        <TrendingUp size={14} /> Historical Pulse Monitors
                                    </h2>
                                    <motion.div 
                                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                                        initial="hidden"
                                        animate="show"
                                        variants={{
                                            hidden: { opacity: 0 },
                                            show: { opacity: 1, transition: { staggerChildren: 0.15 } }
                                        }}
                                    >
                                        {Object.entries(METRIC_CONFIG).map(([key, cfg]) => {
                                            const values = (history.series as any)[key] as number[];
                                            const band = history.confidence_bands[key] || { mean: 0, upper: 0, lower: 0 };
                                            if (!values || values.length === 0) return null;
                                            return (
                                                <motion.div 
                                                    key={key} 
                                                    variants={{
                                                        hidden: { opacity: 0, scale: 0.95 },
                                                        show: { opacity: 1, scale: 1, transition: { type: 'spring', damping: 25, stiffness: 200 } }
                                                    }}
                                                    whileHover={{ scale: 1.01 }}
                                                    className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm transition-shadow hover:shadow-md"
                                                >
                                                    <div className="flex items-center gap-3 mb-6">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                                                            <cfg.icon size={16} style={{ color: cfg.color }} />
                                                        </div>
                                                        <span className="font-black text-[13px] text-slate-800 uppercase tracking-tight">{cfg.label}</span>
                                                    </div>

                                                    <div className="relative">
                                                        <MiniChart values={values} band={band} color={cfg.color} />
                                                    </div>

                                                    <div className="flex items-center justify-between mt-4 bg-slate-50 pt-3 pb-3 px-4 rounded-xl border border-slate-100">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Known Tolerance bounds</span>
                                                            <span className="text-[11px] font-bold text-slate-800 font-mono mt-0.5">{cfg.format(band.lower)} <span className="text-slate-300 mx-1">—</span> {cfg.format(band.upper)}</span>
                                                        </div>
                                                        <div className="w-px h-6 bg-slate-200"></div>
                                                        <div className="flex flex-col text-right">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Current Vector</span>
                                                            <span className="text-[11px] font-black font-mono mt-0.5" style={{ color: cfg.color }}>{cfg.format(values[values.length - 1])}</span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </motion.div>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
