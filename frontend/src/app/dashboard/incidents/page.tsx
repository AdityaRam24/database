'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2, ArrowLeft, AlertTriangle, CheckCircle,
    RefreshCw, Zap, TrendingUp, XCircle, ShieldAlert,
    ThermometerSun, DatabaseZap, Clock, WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardShell from '@/components/DashboardShell';

/* ── Types ─────────────────────────────────────────────────────────── */

interface Incident {
    id: string;
    type: string;
    affected_table: string;
    detected_at: string;
    root_cause: string;
    severity_score: number;
    severity_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    metrics: {
        impact_score: number;
        frequency_score: number;
        latency_increase_score: number;
        z_score: number;
        deviation_pct: number;
    };
}

interface ScanResult {
    status: string;
    snapshot_count: number;
    summary: Record<string, number>;
    incidents: Incident[];
    message?: string;
}

interface HistoryResult {
    incidents: Incident[];
}

/* ── UI Config ─────────────────────────────────────────────────────── */

const SEVERITY_CONFIG = {
    CRITICAL: { color: '#ef4444', bg: '#450a0a', border: '#ef4444', label: 'Critical' },
    HIGH: { color: '#f97316', bg: '#431407', border: '#ea580c', label: 'High' },
    MEDIUM: { color: '#eab308', bg: '#422006', border: '#ca8a04', label: 'Medium' },
    LOW: { color: '#3b82f6', bg: '#172554', border: '#2563eb', label: 'Low' },
};

const getIncidentIcon = (type: string) => {
    if (type.includes('Latency') || type.includes('Slow')) return <Clock size={16} />;
    if (type.includes('Growth')) return <DatabaseZap size={16} />;
    if (type.includes('Scans')) return <Zap size={16} />;
    if (type.includes('Connection')) return <WifiOff size={16} />;
    if (type.includes('Error')) return <ShieldAlert size={16} />;
    return <AlertTriangle size={16} />;
};

/* ── Components ────────────────────────────────────────────────────── */

function ScoreGauge({ score, color }: { score: number, color: string }) {
    const r = 16;
    const circ = 2 * Math.PI * r;
    const strokeDasharray = `${(score / 100) * circ} ${circ}`;
    return (
        <div style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="20" cy="20" r={r} fill="none" stroke="#1e1e2e" strokeWidth="4" />
                <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={strokeDasharray} strokeLinecap="round" />
            </svg>
            <span style={{ position: 'absolute', fontSize: 11, fontWeight: 800, color: '#e2e8f0' }}>{score}</span>
        </div>
    );
}

/* ── Main Page ─────────────────────────────────────────────────────── */

export default function IncidentsPage() {
    const router = useRouter();
    const [connectionString, setConnectionString] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [history, setHistory] = useState<HistoryResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const API = process.env.NEXT_PUBLIC_API_URL;

    useEffect(() => {
        const cs = localStorage.getItem('db_connection_string');
        if (!cs) { router.replace('/dashboard'); return; }
        setConnectionString(cs);
        setMounted(true);
        doScan(cs);
    }, []);

    const doScan = async (cs: string) => {
        setScanning(true);
        setError(null);
        try {
            const [scanRes, histRes] = await Promise.all([
                fetch(`${API}/incidents/scan`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ connection_string: cs }),
                }),
                fetch(`${API}/incidents/history`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ connection_string: cs }),
                }),
            ]);
            
            if (!scanRes.ok) throw new Error(await scanRes.text());
            
            setScanResult(await scanRes.json());
            setHistory(await histRes.json());
        } catch (e: any) {
            setError(e.message || "Failed to scan incidents.");
        } finally {
            setScanning(false);
        }
    };

    if (!mounted) return null;

    const incidentCount = scanResult?.incidents?.length ?? 0;
    const isInsufficient = scanResult?.status === 'insufficient_data';
    const summary = scanResult?.summary || { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

    return (
        <DashboardShell>

            {/* ── Top bar ── */}
            <div className="flex items-center justify-between p-6 px-4 md:px-8 bg-transparent">
                <div className="flex items-center gap-4">
                    <h1 className="m-0 text-xl font-bold text-slate-100 flex items-center gap-2">
                        <ShieldAlert size={22} className="text-red-500" /> Incident Panel
                    </h1>
                    {incidentCount > 0 && (
                        <span className="animate-pulse ml-2 px-3 py-1 text-xs font-bold rounded-full bg-red-950/50 border border-red-500/50 text-red-400">
                            {incidentCount} active incident{incidentCount === 1 ? '' : 's'}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <Button size="sm" disabled={!connectionString || scanning}
                        onClick={() => connectionString && doScan(connectionString)}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors btn-glow shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                        {scanning ? <Loader2 size={14} className="animate-spin mr-2" /> : <RefreshCw size={14} className="mr-2" />}
                        {scanning ? 'Scanning…' : 'Scan Now'}
                    </Button>
                </div>
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div className="px-6 py-3 bg-red-950/50 border-b border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                    <XCircle size={16} /> {error}
                </div>
            )}

            <div className="flex flex-col flex-1 w-full max-w-[1200px] mx-auto pb-10 px-4 md:px-8 mt-2">

                {scanning && !scanResult ? (
                    <div style={{ textAlign: 'center', marginTop: 80 }}>
                        <ThermometerSun size={40} style={{ color: '#ef4444', animation: 'pulse 2s infinite', margin: '0 auto 16px' }} />
                        <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 18 }}>Scanning Database Telemetry...</h3>
                        <p style={{ color: '#6b7280', marginTop: 8 }}>Analyzing query latency, table growth, and connection pools.</p>
                    </div>
                ) : (
                    <>
                        {/* ── Insufficient data info ── */}
                        {isInsufficient && (
                            <div className="glass glow-border rounded-xl p-6 mb-8 border-blue-500/30">
                                <div className="flex items-start gap-4">
                                    <TrendingUp size={24} className="text-blue-400 flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="m-0 mb-2 text-base font-bold text-blue-300">Building Incident Baseline…</p>
                                        <p className="m-0 text-sm text-slate-400 leading-relaxed">
                                            {scanResult?.message} Click <strong className="text-rose-400">Scan Now</strong> a few times to build the baseline. Incidents require baseline telemetry to compare current performance against normal behavior.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Summary bar ── */}
                        {!isInsufficient && scanResult && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                {(Object.keys(SEVERITY_CONFIG) as Array<keyof typeof SEVERITY_CONFIG>).map((level) => {
                                    const cfg = SEVERITY_CONFIG[level];
                                    const count = summary[level] || 0;
                                    const isActive = count > 0;
                                    return (
                                        <div key={level} className={`glass overflow-hidden relative rounded-xl p-5 border ${isActive ? 'card-hover' : ''}`} style={{ borderColor: isActive ? cfg.border + '80' : 'rgba(255,255,255,0.05)', background: isActive ? cfg.bg + '80' : '' }}>
                                            {isActive && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: cfg.color }} />}
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p style={{ color: isActive ? cfg.color : '#6b7280' }} className="m-0 mb-1 text-xs font-bold uppercase tracking-wider">
                                                        {cfg.label}
                                                    </p>
                                                    <p className={`m-0 text-3xl font-extrabold ${isActive ? 'text-slate-100' : 'text-slate-600'}`}>
                                                        {count}
                                                    </p>
                                                </div>
                                                {isActive && (
                                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 12px ${cfg.color}` }} className="animate-pulse" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── All clear ── */}
                        {!isInsufficient && scanResult && incidentCount === 0 && (
                            <div className="text-center my-10 p-10 glass border-emerald-500/20 rounded-2xl flex flex-col items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-emerald-950/50 flex items-center justify-center mb-5 border border-emerald-500/20">
                                    <CheckCircle size={32} className="text-emerald-500" />
                                </div>
                                <h2 className="text-emerald-400 m-0 mb-3 text-xl font-bold">System Healthy</h2>
                                <p className="text-emerald-200/70 m-0 text-sm max-w-[400px]">No incidents detected. Database metrics are within normal baseline ranges.</p>
                            </div>
                        )}

                        {/* ── Active Incidents ── */}
                        {incidentCount > 0 && (
                            <div className="mb-10">
                                <h2 className="m-0 mb-5 text-lg font-bold text-slate-200">
                                    Live Incidents
                                </h2>
                                <div className="flex flex-col gap-4">
                                    {scanResult?.incidents.map((inc, i) => {
                                        const cfg = SEVERITY_CONFIG[inc.severity_level];
                                        return (
                                            <div key={i} className="glass rounded-xl overflow-hidden flex flex-col border transition-all" style={{ borderColor: cfg.border + '50' }}>
                                                {/* Header */}
                                                <div className="p-4 px-6 flex items-center justify-between border-b border-white/5" style={{ background: `linear-gradient(90deg, ${cfg.bg}80 0%, transparent 100%)` }}>
                                                    <div className="flex items-center gap-3">
                                                        <span style={{ color: cfg.color }}>{getIncidentIcon(inc.type)}</span>
                                                        <span className="font-bold text-base text-slate-100">{inc.type}</span>
                                                        <span className="text-xs px-2.5 py-1 bg-black/40 rounded text-slate-400 font-mono ml-2 border border-white/5">{inc.affected_table}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-xs text-slate-500 font-medium">
                                                            {new Date(inc.detected_at).toLocaleTimeString()}
                                                        </span>
                                                        <span className="text-xs font-bold px-3 py-1 rounded tracking-wide uppercase text-white shadow-sm" style={{ background: cfg.color }}>
                                                            {inc.severity_level}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Body */}
                                                <div className="p-6 flex flex-col md:flex-row gap-8 items-center md:items-start bg-black/10">
                                                    {/* Score */}
                                                    <div className="text-center min-w-[100px] flex flex-col items-center justify-center">
                                                        <ScoreGauge score={inc.severity_score} color={cfg.color} />
                                                        <p className="m-0 mt-3 text-xs text-slate-500 font-bold tracking-wider">SEVERITY</p>
                                                    </div>
                                                    
                                                    {/* Details */}
                                                    <div className="flex-1 md:border-l border-white/5 md:pl-8">
                                                        <p className="m-0 mb-5 text-sm text-slate-300 leading-relaxed whitespace-pre-line bg-black/20 p-4 rounded-lg border border-white/5">
                                                            {inc.root_cause}
                                                        </p>
                                                        <div className="flex flex-wrap gap-3">
                                                            <div className="glass border border-white/5 px-4 py-2.5 rounded-lg flex flex-col">
                                                                <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">Z-Score</span>
                                                                <span className={`text-sm font-bold ${inc.metrics.z_score > 3 ? 'text-red-400' : 'text-slate-200'}`}>{inc.metrics.z_score}</span>
                                                            </div>
                                                            <div className="glass border border-white/5 px-4 py-2.5 rounded-lg flex flex-col">
                                                                <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">Deviation</span>
                                                                <span className="text-sm font-bold text-slate-200">+{inc.metrics.deviation_pct}%</span>
                                                            </div>
                                                            <div className="glass border border-white/5 px-4 py-2.5 rounded-lg flex flex-col">
                                                                <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">Impact</span>
                                                                <span className="text-sm font-bold text-slate-200">{inc.metrics.impact_score}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── Historical Timeline ── */}
                        {history && history.incidents.length > 0 && (
                            <div>
                                <h2 className="m-0 mb-4 text-base font-bold text-slate-400 flex items-center gap-2">
                                    <Clock size={18} /> Recent Incident History
                                </h2>
                                <div className="glass rounded-xl p-6 border border-white/5">
                                    <div className="flex flex-col gap-0">
                                        {history.incidents.slice(0, 10).map((inc, i) => {
                                            const cfg = SEVERITY_CONFIG[inc.severity_level];
                                            return (
                                                <div key={i} className="flex gap-5 relative pb-6">
                                                    {i < Math.min(history.incidents.length, 10) - 1 && (
                                                        <div className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-white/10" />
                                                    )}
                                                    <div className="w-4 h-4 rounded-full mt-1 z-10 border-2 border-[#12121a] shadow-sm ml-[-1px]" style={{ background: cfg.color }} />
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <div>
                                                                <span className="font-bold text-sm text-slate-200 mr-2">{inc.type}</span>
                                                                <span className="text-xs text-slate-500 font-mono">on {inc.affected_table}</span>
                                                            </div>
                                                            <span className="text-xs text-slate-500 font-medium">{new Date(inc.detected_at).toLocaleString()}</span>
                                                        </div>
                                                        <p className="m-0 text-sm text-slate-400/80 leading-relaxed">
                                                            Severity Score: {inc.severity_score} <span style={{ color: cfg.color }} className="font-medium">({inc.severity_level})</span> — Deviation: <span className="text-slate-300">+{inc.metrics.deviation_pct}%</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </DashboardShell>
    );
}
