'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2, ArrowLeft, Activity, AlertTriangle, CheckCircle,
    RefreshCw, TrendingUp, Database, Wifi, Zap, BarChart3,
    Shield, Info, XCircle
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
    total_size: { label: 'Database Size', icon: Database, color: '#818cf8', format: (v) => `${(v / 1024 / 1024).toFixed(1)} MB` },
    connection_count: { label: 'Connections', icon: Wifi, color: '#34d399', format: (v) => `${v}` },
    total_seq_scans: { label: 'Sequential Scans', icon: Zap, color: '#f59e0b', format: (v) => `${v.toLocaleString()}` },
    cache_hit_ratio: { label: 'Cache Hit Ratio', icon: BarChart3, color: '#60a5fa', format: (v) => `${(v * 100).toFixed(1)}%` },
    active_queries: { label: 'Active Queries', icon: Activity, color: '#f472b6', format: (v) => `${v}` },
};

const SEVERITY_COLORS = {
    normal: { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
    critical: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
};

/* ── Mini chart ────────────────────────────────────────────────────── */

function MiniChart({ values, band, color }: { values: number[]; band: { mean: number; upper: number; lower: number }; color: string }) {
    if (values.length < 2) return <p style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', margin: '20px 0' }}>Need more data points…</p>;

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
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 120 }}>
            {/* Confidence band */}
            <path d={bandPath} fill={color} fillOpacity={0.08} stroke={color} strokeOpacity={0.2} strokeWidth={1} strokeDasharray="4 2" />
            {/* Mean line */}
            <line x1={pad} y1={toY(band.mean)} x2={w - pad} y2={toY(band.mean)} stroke={color} strokeOpacity={0.3} strokeWidth={1} strokeDasharray="6 3" />
            {/* Data line */}
            <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
            {/* Data points */}
            {values.map((v, i) => {
                const isAnomaly = v > band.upper || v < band.lower;
                return (
                    <circle
                        key={i} cx={toX(i)} cy={toY(v)} r={isAnomaly ? 5 : 3}
                        fill={isAnomaly ? '#ef4444' : color}
                        stroke={isAnomaly ? '#fca5a5' : 'none'}
                        strokeWidth={isAnomaly ? 2 : 0}
                    />
                );
            })}
            {/* Labels */}
            <text x={w - pad + 4} y={toY(band.upper) + 4} fill={color} fillOpacity={0.5} fontSize={9}>Upper</text>
            <text x={w - pad + 4} y={toY(band.lower) + 4} fill={color} fillOpacity={0.5} fontSize={9}>Lower</text>
            <text x={w - pad + 4} y={toY(band.mean) + 4} fill={color} fillOpacity={0.5} fontSize={9}>Mean</text>
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
        } catch (e: any) {
            setError(e.message);
        } finally {
            setCollecting(false);
        }
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
        } catch (e: any) {
            setError(e.message);
        } finally {
            setDetecting(false);
        }
    };

    if (!mounted) return null;

    const anomalyCount = anomalyResult?.anomalies?.length ?? 0;
    const isInsufficient = anomalyResult?.status === 'insufficient_data';

    return (
        <DashboardShell>

            {/* ── Top bar ── */}
            <div className="flex items-center justify-between p-6 px-4 md:px-8 bg-transparent">
                <div className="flex items-center gap-4">
                    <h1 className="m-0 text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Activity size={22} className="text-rose-500" /> Anomaly Detector
                    </h1>
                    {anomalyCount > 0 && (
                        <span className="px-3 py-1 text-xs font-bold rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                            {anomalyCount} anomal{anomalyCount === 1 ? 'y' : 'ies'}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <Button size="sm" disabled={!connectionString || collecting}
                        onClick={() => connectionString && doCollect(connectionString)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 font-semibold text-xs transition-colors">
                        {collecting ? <Loader2 size={14} className="animate-spin mr-2" /> : <RefreshCw size={14} className="mr-2" />}
                        {collecting ? 'Collecting…' : 'Collect Snapshot'}
                    </Button>
                    <Button size="sm" disabled={!connectionString || detecting}
                        onClick={() => connectionString && doDetect(connectionString)}
                        className="bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs transition-colors shadow-sm">
                        {detecting ? <Loader2 size={14} className="animate-spin mr-2" /> : <Activity size={14} className="mr-2" />}
                        {detecting ? 'Analyzing…' : 'Detect Anomalies'}
                    </Button>
                </div>
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-red-600 text-sm flex items-center gap-2">
                    <XCircle size={16} /> {error}
                </div>
            )}

            <div className="flex flex-col flex-1 w-full max-w-[1200px] mx-auto pb-10 px-4 md:px-8 mt-2">
            {isInsufficient && (
                <div className="bg-white rounded-xl p-6 mb-8 border border-blue-200 shadow-sm">
                    <div className="flex items-start gap-4">
                        <Info size={24} className="text-blue-500 flex-shrink-0 mt-1" />
                        <div>
                            <p className="m-0 mb-2 text-base font-bold text-blue-900">Building Baseline…</p>
                            <p className="m-0 text-sm text-gray-600 leading-relaxed">
                                {anomalyResult?.message} Click <strong className="text-emerald-600">Collect Snapshot</strong> multiple times (or set up a cron) to build the rolling 7-day baseline. Once you have 3+ snapshots, Z-Score anomaly detection will activate.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full">

                {detecting && !anomalyResult ? (
                    <div style={{ textAlign: 'center', marginTop: 80 }}>
                        <Loader2 size={32} style={{ color: '#8b5cf6', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                        <p style={{ color: '#64748b', marginTop: 12 }}>Running Z-Score analysis…</p>
                    </div>
                ) : (
                    <>
                        {/* ── Summary bar ── */}
                        {anomalyResult && anomalyResult.status === 'analyzed' && (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                                {Object.entries(anomalyResult.metrics_summary).map(([key, entry]) => {
                                    const cfg = METRIC_CONFIG[key];
                                    if (!cfg) return null;
                                    const Icon = cfg.icon;
                                    const sev = SEVERITY_COLORS[entry.severity];
                                    const isAnomalous = entry.severity !== 'normal';
                                    return (
                                        <div key={key} className="bg-white overflow-hidden relative rounded-xl p-4 border shadow-sm transition-all" style={{ borderColor: isAnomalous ? sev.border : '#e2e8f0', background: isAnomalous ? sev.bg : '' }}>
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: isAnomalous ? sev.border : 'transparent' }} />
                                            <div className="flex items-center gap-2 mb-2">
                                                <Icon size={14} style={{ color: cfg.color }} />
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{cfg.label}</span>
                                            </div>
                                            <p className="m-0 text-2xl font-extrabold" style={{ color: isAnomalous ? sev.text : '#111827' }}>{cfg.format(entry.current_value)}</p>
                                            <div className="flex gap-3 mt-2 text-xs text-gray-500 font-medium">
                                                <span>Z: <strong style={{ color: Math.abs(entry.z_score) >= 2 ? '#ef4444' : '#10b981' }}>{entry.z_score}</strong></span>
                                                <span>Δ {entry.deviation_pct}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── Anomaly alerts ── */}
                        {anomalyResult && anomalyResult.anomalies && anomalyResult.anomalies.length > 0 && (
                            <div className="mb-10">
                                <h2 className="m-0 mb-5 text-base font-bold text-rose-600 flex items-center gap-2">
                                    <AlertTriangle size={18} /> Anomalies Detected
                                </h2>
                                <div className="flex flex-col gap-4">
                                    {anomalyResult.anomalies.map((a, i) => {
                                        const sev = SEVERITY_COLORS[a.severity];
                                        return (
                                            <div key={i} className="bg-white shadow-sm rounded-xl p-5 relative overflow-hidden border transition-all" style={{ borderColor: sev.border }}>
                                                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, bottom: 0, background: sev.border }} />
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase border" style={{ background: sev.bg, color: sev.text, borderColor: sev.border }}>
                                                                {a.severity}
                                                            </span>
                                                            <span className="font-bold text-base text-gray-900">{a.label}</span>
                                                        </div>
                                                        {a.root_cause && (
                                                            <p className="m-0 mt-2 text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">{a.root_cause}</p>
                                                        )}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="m-0 text-2xl font-extrabold" style={{ color: sev.text }}>Z {a.z_score}</p>
                                                        <p className="m-0 text-xs text-gray-500 font-medium">{a.deviation_pct}% deviation</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── All clear ── */}
                        {anomalyResult && anomalyResult.status === 'analyzed' && anomalyResult.anomalies.length === 0 && (
                            <div className="text-center my-8 p-8 bg-white border border-emerald-200 shadow-sm rounded-2xl flex flex-col items-center justify-center">
                                <CheckCircle size={32} className="text-emerald-500 mb-4" />
                                <p className="text-emerald-700 m-0 font-bold text-lg">All metrics within normal range</p>
                                <p className="text-emerald-600/80 m-0 mt-2 text-sm">No anomalies detected in the current snapshot.</p>
                            </div>
                        )}

                        {/* ── Metric Charts ── */}
                        {history && history.snapshot_count >= 2 && (
                            <div>
                                <h2 className="m-0 mb-5 text-base font-bold text-violet-600 flex items-center gap-2">
                                    <TrendingUp size={18} /> Metric Trends & Confidence Bands
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(METRIC_CONFIG).map(([key, cfg]) => {
                                        const values = (history.series as any)[key] as number[];
                                        const band = history.confidence_bands[key] || { mean: 0, upper: 0, lower: 0 };
                                        if (!values || values.length === 0) return null;
                                        return (
                                            <div key={key} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <cfg.icon size={16} style={{ color: cfg.color }} />
                                                    <span className="font-bold text-sm text-gray-900">{cfg.label}</span>
                                                    <span className="ml-auto text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded border border-gray-100">{values.length} snapshots</span>
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
                            </div>
                        )}

                        {/* ── Info footer ── */}
                        {anomalyResult?.last_updated && (
                            <p className="mt-8 text-xs text-gray-500 text-center font-medium">
                                Last updated: {new Date(anomalyResult.last_updated).toLocaleString()} • {anomalyResult.snapshot_count} snapshots in baseline
                            </p>
                        )}
                    </>
                )}
            </div>
            </div>
        </DashboardShell>
    );
}
