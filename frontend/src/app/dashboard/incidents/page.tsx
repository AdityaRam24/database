'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2, ArrowLeft, AlertTriangle, CheckCircle,
    RefreshCw, Zap, TrendingUp, XCircle, ShieldAlert,
    ThermometerSun, DatabaseZap, Clock, WifiOff, Activity, ShieldCheck, Crosshair
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardShell from '@/components/DashboardShell';
import { motion } from 'framer-motion';

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

const getIncidentIcon = (type: string) => {
    if (type.includes('Latency') || type.includes('Slow')) return <Clock size={16} />;
    if (type.includes('Growth')) return <DatabaseZap size={16} />;
    if (type.includes('Scans')) return <Zap size={16} />;
    if (type.includes('Connection')) return <WifiOff size={16} />;
    if (type.includes('Error')) return <ShieldAlert size={16} />;
    return <AlertTriangle size={16} />;
};

/* ── Sweeping Radar Animation ────────────────────────────────────────── */

function TriageScanner() {
    return (
        <div className="relative w-48 h-48 mx-auto -mb-6 flex items-center justify-center overflow-hidden rounded-full border-4 border-emerald-50 bg-emerald-50/50 shadow-inner">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(16,185,129,0.05)_100%)]"></div>
            
            {/* Grid Rings */}
            <div className="absolute inset-2 rounded-full border border-emerald-200/50"></div>
            <div className="absolute inset-8 rounded-full border border-emerald-200/30"></div>
            <div className="absolute inset-16 rounded-full border border-emerald-200/20"></div>
            
            <ShieldCheck size={48} className="text-emerald-400 relative z-10" />

            {/* Sweep */}
            <motion.div
                className="absolute inset-0 origin-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 4, ease: "linear", repeat: Infinity }}
            >
                <div className="w-1/2 h-full absolute right-0 bg-gradient-to-l from-emerald-400/20 to-transparent blur-md"></div>
                <div className="w-px h-1/2 absolute right-1/2 top-0 bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            </motion.div>
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

    const incidents = scanResult?.incidents || [];
    const criticalIncidents = incidents.filter(i => i.severity_level === 'CRITICAL' || i.severity_level === 'HIGH');
    const minorIncidents = incidents.filter(i => i.severity_level === 'MEDIUM' || i.severity_level === 'LOW');
    
    const isInsufficient = scanResult?.status === 'insufficient_data';
    const isCrisis = criticalIncidents.length > 0;

    return (
        <DashboardShell>
            <div className="flex flex-col h-full w-full max-w-[1400px] mx-auto pb-16">
                
                {/* ── Page Header ── */}
                <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 dark:border-white/[0.05] bg-white dark:bg-slate-900/80 shadow-sm z-10 relative overflow-hidden backdrop-blur-xl">
                    {/* 3D Alerts Core Shape */}
                    <motion.div 
                        animate={{ rotateZ: 360, rotateY: [0, 60, 0], scale: [0.9, 1.2, 0.9] }} 
                        transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
                        className="absolute right-[20%] -top-20 w-64 h-64 border-[4px] border-amber-500/10 dark:border-amber-500/20 shadow-lg pointer-events-none rounded-full" 
                        style={{ transformStyle: 'preserve-3d', transform: 'rotateX(70deg)' }}
                    >
                         <div className="absolute inset-8 rounded-full border-[8px] border-rose-500/5 dark:border-rose-500/10" />
                    </motion.div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center relative shadow-inner ring-1 ${isCrisis ? 'bg-rose-50 ring-rose-300' : 'bg-slate-50 ring-slate-200'}`}>
                            <Crosshair size={22} className={isCrisis ? 'text-rose-600' : 'text-slate-500'} />
                            {isCrisis && <div className="absolute top-0 right-0 -mr-1 -mt-1 w-3 h-3 bg-rose-500 rounded-full animate-ping border border-rose-300"></div>}
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                Active Alert Triage Engine
                                {isCrisis ? (
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-rose-100 text-rose-700 border border-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse ml-2 flex items-center gap-1.5">
                                        <AlertTriangle size={12} /> Priority Targeting Engaged
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 ml-2">
                                        Monitoring Active
                                    </span>
                                )}
                            </h1>
                            <p className="text-[13px] text-slate-500 font-bold mt-0.5 uppercase tracking-widest flex items-center gap-1.5">
                                <Activity size={12}/> Threat Intelligence Logs
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-3">
                        <Button
                            size="sm"
                            disabled={!connectionString || scanning}
                            onClick={() => connectionString && doScan(connectionString)}
                            className="bg-slate-900 hover:bg-slate-800 text-white shadow-[0_4px_14px_0_rgba(15,23,42,0.39)] font-black uppercase tracking-widest text-[10px] rounded-xl cursor-pointer h-9 px-6 transition-all"
                        >
                            {scanning ? <><Loader2 size={13} className="animate-spin mr-2" /> Engaging Sensor Suite...</> : <><RefreshCw size={13} className="mr-2 text-emerald-400" /> Execute Deep Threat Sweep</>}
                        </Button>
                    </div>
                </div>

                {/* ── Error banner ── */}
                {error && (
                    <div className="mx-6 mt-6 px-5 py-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-[13px] font-bold flex items-center gap-3 shadow-sm">
                        <XCircle size={18} className="shrink-0" /> {error}
                    </div>
                )}

                <div className="flex flex-col w-full mx-auto px-4 md:px-8 mt-8 gap-10">

                    {/* ── Visual Threat Level Matrix ── */}
                    {scanning && !scanResult ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-5 pointer-events-none">
                            <div className="w-24 h-24 rounded-full border-4 border-slate-100 border-t-rose-500 animate-spin flex items-center justify-center">
                                <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-b-rose-400 animate-[spin_1.5s_linear_infinite_reverse]"></div>
                            </div>
                            <h3 className="m-0 text-slate-900 text-base font-black uppercase tracking-widest">Scanning Operating Environment...</h3>
                            <p className="text-[13px] text-slate-500 font-bold max-w-md text-center bg-slate-50 border border-slate-100 px-4 py-2 rounded-lg">Running highly complex heuristic analysis on vector logs, latency signatures, and structural scaling behaviors.</p>
                        </div>
                    ) : isInsufficient ? (
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200/60 rounded-3xl p-6 flex flex-col md:flex-row items-center md:items-start gap-5 shadow-sm">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-indigo-100 flex items-center justify-center shrink-0">
                                <TrendingUp size={24} className="text-indigo-500" />
                            </div>
                            <div className="text-center md:text-left">
                                <h3 className="text-base font-black text-indigo-900 uppercase tracking-widest mb-1">Building Incident Baseline Matrix</h3>
                                <p className="text-[13px] text-indigo-800/80 leading-relaxed font-bold max-w-4xl">
                                    {scanResult?.message} Click <strong className="text-slate-800 bg-white px-1.5 py-0.5 rounded ml-1 uppercase shadow-sm">Execute Deep Threat Sweep</strong> a few more times. The Threat Engine requires a sufficient matrix of standard operations before it can definitively rank anomalous activity versus standard operations.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* ALL CLEAR RADAR */}
                            {!isCrisis && minorIncidents.length === 0 && (
                                <div className="mt-6 text-center bg-white border border-slate-200/60 shadow-sm rounded-3xl py-16 px-6 overflow-hidden relative">
                                    <TriageScanner />
                                    <div className="relative z-10 mt-10">
                                        <h2 className="text-emerald-700 m-0 mb-2 text-xl font-black uppercase tracking-tight">Perimeter Secure</h2>
                                        <p className="text-emerald-600/80 m-0 text-[13px] font-bold max-w-md mx-auto leading-relaxed">
                                            Deep threat sweep completed. No critical anomalies, scaling faults, or immediate structural vulnerabilities detected across standard operational limits.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ── PRIORITY TARGETS: CRITICAL/HIGH ── */}
                            {criticalIncidents.length > 0 && (
                                <section>
                                    <div className="flex items-center gap-3 mb-6 bg-rose-50 border border-rose-200 shadow-sm px-4 py-3 rounded-2xl">
                                        <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white shrink-0 animate-pulse">
                                            <ShieldAlert size={16} />
                                        </div>
                                        <div>
                                            <h2 className="text-[14px] font-black text-rose-800 uppercase tracking-widest m-0 leading-tight">Priority 1 Triage Dossiers</h2>
                                            <p className="text-[11px] font-bold text-rose-600/80 uppercase tracking-widest mt-0.5 m-0">Require immediate manual intervention!</p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                        {criticalIncidents.map((inc, i) => (
                                            <div key={i} className="bg-white rounded-3xl overflow-hidden flex flex-col border border-rose-200 shadow-[0_8px_30px_rgb(225,29,72,0.08)] transition-all hover:shadow-[0_8px_40px_rgb(225,29,72,0.15)] relative group">
                                                
                                                {/* Left structural bounding line */}
                                                <div className="absolute top-0 bottom-0 left-0 w-2 bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]"></div>

                                                <div className="p-6 pl-8 flex flex-col h-full relative z-10">
                                                    
                                                    {/* Header */}
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-5">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-[9px] font-black text-white bg-rose-600 px-2.5 py-1 rounded shadow-sm border border-rose-700 uppercase tracking-widest flex items-center gap-1.5">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-300 animate-ping"></div> {inc.severity_level} THREAT
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md mono uppercase shadow-inner">
                                                                    Vector: {inc.affected_table}
                                                                </span>
                                                            </div>
                                                            <h3 className="m-0 text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                                                                <span className="text-rose-600">{getIncidentIcon(inc.type)}</span> {inc.type}
                                                            </h3>
                                                        </div>
                                                        <div className="flex flex-col items-end shrink-0 hidden md:flex">
                                                             <div className="text-[32px] font-black text-rose-600 leading-none tracking-tighter">
                                                                {inc.severity_score}<span className="text-[12px] font-bold text-slate-400 tracking-wider inline-block ml-1">/100</span>
                                                             </div>
                                                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Severity Matrix Score</span>
                                                        </div>
                                                    </div>

                                                    {/* Root Cause Analysis Text area */}
                                                    <div className="flex-1 bg-rose-50/50 p-5 rounded-2xl border border-rose-100 mb-6">
                                                        <p className="m-0 text-[13px] text-slate-700 leading-relaxed font-bold">
                                                            {inc.root_cause}
                                                        </p>
                                                    </div>

                                                    {/* Metrics Data Payload Row */}
                                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                                        <div className="bg-white border border-slate-200 px-4 py-3 rounded-xl shadow-sm flex flex-col justify-center">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Deviation</span>
                                                            <span className="text-[14px] font-black text-slate-800 tracking-tight font-mono">+{inc.metrics.deviation_pct}%</span>
                                                        </div>
                                                        <div className="bg-white border border-slate-200 px-4 py-3 rounded-xl shadow-sm flex flex-col justify-center">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impact Mass</span>
                                                            <span className="text-[14px] font-black text-rose-600 tracking-tight font-mono group-hover:animate-pulse">Severe</span>
                                                        </div>
                                                        <div className="col-span-2 bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl shadow-inner flex flex-col justify-center">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex justify-between">Detected Time Signature <span className="opacity-0 group-hover:opacity-100 transition-opacity">Live Sync Active</span></span>
                                                            <span className="text-[12px] font-bold text-slate-600 font-mono tracking-tight">{new Date(inc.detected_at).toLocaleString()}</span>
                                                        </div>
                                                    </div>

                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* ── ROUTINE / LOW LEVEL ANOMALIES ── */}
                            {minorIncidents.length > 0 && (
                                <section className="mt-4">
                                    <div className="flex items-center gap-3 mb-6 bg-amber-50 border border-amber-200 shadow-sm px-4 py-3 rounded-2xl max-w-max mx-auto md:mx-0">
                                        <div className="w-8 h-8 rounded-full bg-amber-300 flex items-center justify-center text-amber-800 shrink-0">
                                            <Clock size={16} />
                                        </div>
                                        <div>
                                            <h2 className="text-[12px] font-black text-amber-800 uppercase tracking-widest m-0 leading-tight">Routine Warning Logs</h2>
                                            <p className="text-[10px] font-bold text-amber-600/80 uppercase tracking-widest mt-0.5 m-0">Non-fatal occurrences suppressed for visual clarity</p>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden text-left">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                                            {minorIncidents.map((inc, i) => (
                                                <div key={i} className="p-5 flex flex-col md:flex-row hover:bg-slate-50 transition-colors relative group">
                                                    
                                                    {/* Side structural tracker */}
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-300 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                    
                                                    <div className="flex-1 md:pr-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-[8px] font-black px-2 py-0.5 rounded border uppercase tracking-widest bg-amber-50 text-amber-700 border-amber-200 shadow-sm">
                                                                {inc.severity_level}
                                                            </span>
                                                            <span className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5"><span className="text-amber-500">{getIncidentIcon(inc.type)}</span> {inc.type}</span>
                                                        </div>
                                                        <p className="text-[11px] font-bold text-slate-500 leading-relaxed m-0 line-clamp-2 md:line-clamp-none pl-1">
                                                            {inc.root_cause}
                                                        </p>
                                                    </div>

                                                    <div className="mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-5 shrink-0 flex flex-row md:flex-col justify-between md:justify-center">
                                                         <div>
                                                             <div className="text-[18px] font-black text-amber-600 text-left md:text-right font-mono tracking-tighter">
                                                                {inc.severity_score}
                                                             </div>
                                                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left md:text-right block">Score</span>
                                                         </div>
                                                         <div className="text-right">
                                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded inline-block mt-2 font-mono uppercase border border-slate-100">{inc.affected_table}</span>
                                                         </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
