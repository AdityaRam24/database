'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2, Activity, AlertTriangle, CheckCircle,
    RefreshCw, TrendingUp, Database, Wifi, Zap, BarChart3,
    Info, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardShell from '@/components/DashboardShell';

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
    total_size:       { label: 'Database Size',    icon: Database, color: '#818cf8', format: (v) => `${(v / 1024 / 1024).toFixed(1)} MB` },
    connection_count: { label: 'Active Users',     icon: Wifi,     color: '#34d399', format: (v) => `${v}` },
    total_seq_scans:  { label: 'Hard Reads',       icon: Zap,      color: '#f59e0b', format: (v) => `${v.toLocaleString()}` },
    cache_hit_ratio:  { label: 'Memory Efficiency',icon: BarChart3,color: '#60a5fa', format: (v) => `${(v * 100).toFixed(1)}%` },
    active_queries:   { label: 'Ongoing Work',     icon: Activity, color: '#f472b6', format: (v) => `${v}` },
};

const SEVERITY_COLORS = {
    normal:   { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-800',  bar: '#86efac' },
    warning:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  bar: '#fde68a' },
    critical: { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    bar: '#fecaca' },
};

/* ── Mini chart ────────────────────────────────────────────────────── */

function MiniChart({ values, band, color }: { values: number[]; band: { mean: number; upper: number; lower: number }; color: string }) {
    if (values.length < 2) return <p className="text-xs text-center text-gray-400 my-5">Need more data points…</p>;

    const w = 400, h = 120, pad = 20;
    const allVals = [...values, band.upper, band.lower].filter(v => v !== undefined);
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals) || 1;
    const range = maxV - minV || 1;

    const toX = (i: number) => pad + (i / (values.length - 1)) * (w - 2 * pad);
    const toY = (v: number) => h - pad - ((v - minV) / range) * (h - 2 * pad);

    const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
    const bandPath = `M${pad},${toY(band.upper)} L${w - pad},${toY(band.upper)} L${w - pad},${toY(band.lower)} L${pad},${toY(band.lower)} Z`;

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 120 }}>
            <path d={bandPath} fill={color} fillOpacity={0.08} stroke={color} strokeOpacity={0.2} strokeWidth={1} strokeDasharray="4 2" />
            <line x1={pad} y1={toY(band.mean)} x2={w - pad} y2={toY(band.mean)} stroke={color} strokeOpacity={0.3} strokeWidth={1} strokeDasharray="6 3" />
            <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
            {values.map((v, i) => {
                const isAnomaly = v > band.upper || v < band.lower;
                return (
                    <circle key={i} cx={toX(i)} cy={toY(v)} r={isAnomaly ? 5 : 3}
                        fill={isAnomaly ? '#ef4444' : color}
                        stroke={isAnomaly ? '#fca5a5' : 'none'}
                        strokeWidth={isAnomaly ? 2 : 0}
                    />
                );
            })}
            <text x={w - pad + 4} y={toY(band.upper) + 4} fill={color} fillOpacity={0.5} fontSize={9}>Upper</text>
            <text x={w - pad + 4} y={toY(band.lower) + 4} fill={color} fillOpacity={0.5} fontSize={9}>Lower</text>
            <text x={w - pad + 4} y={toY(band.mean) + 4}  fill={color} fillOpacity={0.5} fontSize={9}>Mean</text>
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

    const API = process.env.NEXT_PUBLIC_API_URL;

    useEffect(() => {
        const cs = localStorage.getItem('db_connection_string');
        if (!cs) { router.replace('/dashboard'); return; }
        setConnectionString(cs);
        setMounted(true);
        doDetect(cs);
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

    return (
        <DashboardShell>
            {/* ── Page header ── */}
            <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
                        <Activity size={18} className="text-rose-500" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 leading-tight flex items-center gap-2">
                            Vital Signs &amp; Heartbeat
                            {anomalyCount > 0 && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                                    {anomalyCount} unusual event{anomalyCount === 1 ? '' : 's'}
                                </span>
                            )}
                        </h1>
                        <p className="text-xs text-gray-500 font-medium">Real-time metrics compared to historical baselines</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        disabled={!connectionString || collecting}
                        onClick={() => connectionString && doCollect(connectionString)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs rounded-xl cursor-pointer"
                    >
                        {collecting ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <RefreshCw size={13} className="mr-1.5" />}
                        {collecting ? 'Taking...' : 'Take Vitals'}
                    </Button>
                    <Button
                        size="sm"
                        disabled={!connectionString || detecting}
                        onClick={() => connectionString && doDetect(connectionString)}
                        className="bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs rounded-xl cursor-pointer"
                    >
                        {detecting ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Activity size={13} className="mr-1.5" />}
                        {detecting ? 'Checking...' : 'Run Health Check'}
                    </Button>
                </div>
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div className="mx-4 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium flex items-center gap-2">
                    <XCircle size={15} className="shrink-0" /> {error}
                </div>
            )}

            <div className="flex flex-col w-full max-w-5xl mx-auto pb-10 px-4 md:px-8 mt-6 gap-6">

                {/* ── Insufficient data notice ── */}
                {isInsufficient && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-4">
                        <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-blue-900 mb-1">Learning Your App's Rhythm…</p>
                            <p className="text-xs text-blue-700 leading-relaxed font-medium">
                                {anomalyResult?.message} Click <strong className="text-emerald-600">Take Vitals</strong> a few times to help the AI learn what is "normal" for your database. Once it knows your rhythm, it will alert you to unusual spikes.
                            </p>
                        </div>
                    </div>
                )}

                {detecting && !anomalyResult ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 size={28} className="text-violet-500 animate-spin" />
                        <p className="text-sm text-slate-500 font-medium">Checking vitals against historical baselines…</p>
                    </div>
                ) : (
                    <>
                        {/* ── Summary metric cards ── */}
                        {anomalyResult?.status === 'analyzed' && (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {Object.entries(anomalyResult.metrics_summary).map(([key, entry]) => {
                                    const cfg = METRIC_CONFIG[key];
                                    if (!cfg) return null;
                                    const Icon = cfg.icon;
                                    const sev = SEVERITY_COLORS[entry.severity];
                                    const isAnomalous = entry.severity !== 'normal';
                                    return (
                                        <div key={key} className={`relative overflow-hidden rounded-2xl p-4 border shadow-sm transition-all ${isAnomalous ? `${sev.bg} ${sev.border}` : 'bg-white border-gray-200'}`}>
                                            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: isAnomalous ? sev.bar : 'transparent' }} />
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <Icon size={13} style={{ color: cfg.color }} />
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{cfg.label}</span>
                                            </div>
                                            <p className={`text-xl font-extrabold mb-1 ${isAnomalous ? sev.text : 'text-gray-900'}`}>
                                                {cfg.format(entry.current_value)}
                                            </p>
                                            <div className="flex gap-2 text-[10px] text-gray-500 font-semibold">
                                                <span>Z: <strong style={{ color: Math.abs(entry.z_score) >= 2 ? '#ef4444' : '#10b981' }}>{entry.z_score}</strong></span>
                                                <span>Δ {entry.deviation_pct}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── Anomaly alerts ── */}
                        {anomalyResult?.anomalies && anomalyResult.anomalies.length > 0 && (
                            <section>
                                <h2 className="text-sm font-bold text-rose-600 flex items-center gap-2 mb-4">
                                    <AlertTriangle size={16} /> Unusual Activity Detected
                                </h2>
                                <div className="flex flex-col gap-3">
                                    {anomalyResult.anomalies.map((a, i) => {
                                        const sev = SEVERITY_COLORS[a.severity];
                                        return (
                                            <div key={i} className={`relative overflow-hidden rounded-2xl p-5 border shadow-sm ${sev.bg} ${sev.border}`}>
                                                <div className="absolute top-0 left-0 w-1 bottom-0 rounded-l-2xl" style={{ background: sev.bar }} />
                                                <div className="flex items-start justify-between gap-4 pl-2">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2.5 mb-2">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${sev.bg} ${sev.text} ${sev.border}`}>
                                                                {a.severity}
                                                            </span>
                                                            <span className="font-bold text-sm text-gray-900">{a.label}</span>
                                                        </div>
                                                        {a.root_cause && (
                                                            <p className="text-xs text-gray-600 leading-relaxed bg-white/60 p-3 rounded-xl border border-white/80 font-medium">{a.root_cause}</p>
                                                        )}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className={`text-xl font-extrabold ${sev.text}`}>Z {a.z_score}</p>
                                                        <p className="text-xs text-gray-500 font-medium">{a.deviation_pct}% deviation</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* ── All clear ── */}
                        {anomalyResult?.status === 'analyzed' && anomalyResult.anomalies.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-10 bg-green-50 border border-green-200 rounded-2xl gap-3">
                                <CheckCircle size={28} className="text-emerald-500" />
                                <p className="text-sm font-bold text-emerald-700">Heartbeat is steady and healthy</p>
                                <p className="text-xs text-emerald-600/80 font-medium">No unusual activity detected in the current vitals.</p>
                            </div>
                        )}

                        {/* ── Metric trend charts ── */}
                        {history && history.snapshot_count >= 2 && (
                            <section>
                                <h2 className="text-sm font-bold text-violet-600 flex items-center gap-2 mb-4">
                                    <TrendingUp size={16} /> Vital Sign Trends &amp; Healthy Ranges
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(METRIC_CONFIG).map(([key, cfg]) => {
                                        const values = (history.series as any)[key] as number[];
                                        const band = history.confidence_bands[key] || { mean: 0, upper: 0, lower: 0 };
                                        if (!values || values.length === 0) return null;
                                        return (
                                            <div key={key} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <cfg.icon size={15} style={{ color: cfg.color }} />
                                                    <span className="font-bold text-sm text-gray-900">{cfg.label}</span>
                                                    <span className="ml-auto text-[10px] text-gray-500 font-semibold bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                                                        {values.length} snapshots
                                                    </span>
                                                </div>
                                                <MiniChart values={values} band={band} color={cfg.color} />
                                                <div className="flex justify-between mt-3 text-xs text-gray-500 font-medium">
                                                    <span>Normal: {cfg.format(band.lower)} — {cfg.format(band.upper)}</span>
                                                    <span>Latest: <strong style={{ color: cfg.color }}>{cfg.format(values[values.length - 1])}</strong></span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* ── Footer ── */}
                        {anomalyResult?.last_updated && (
                            <p className="text-xs text-gray-400 text-center font-medium pt-2">
                                Last updated: {new Date(anomalyResult.last_updated).toLocaleString()} &bull; {anomalyResult.snapshot_count} snapshots in baseline
                            </p>
                        )}
                    </>
                )}
            </div>
        </DashboardShell>
    );
}
