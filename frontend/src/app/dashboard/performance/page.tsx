'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2, Zap, CheckCircle, AlertTriangle,
    TrendingUp, Trash2, Map, Database, Lightbulb, BookOpen,
    XCircle, Search, AlertCircle, Info, X, Scale, RefreshCw,
    Cpu, Activity, Bot, Radio, Radar, PlaySquare, Code
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardShell from '@/components/DashboardShell';
import { useZombieIndexes } from '@/hooks/useZombieIndexes';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ────────────────────────────────────────────────────────────────────

interface BottleneckColumn {
    table_name: string;
    column_name: string;
    data_type: string;
    is_indexed: boolean;
    seq_scan_count: number;
    row_count: number;
    status: 'critical' | 'warning' | 'healthy';
    suggestion: string;
}

export interface ZombieIndex {
    index_name: string;
    table_name: string;
    index_def: string;
    idx_scan: number;
    size_bytes: number;
    size_human: string;
    drop_sql: string;
    saving_note: string;
}

interface Recommendation {
    table_name: string;
    column_names: string[];
    index_sql: string;
    reason: string;
    impact_score: number;
    risk_level: 'low' | 'medium' | 'high';
    ai_explanation: string;
    query_frequency_pct: number;
}

interface SimResult {
    before_ms: number;
    after_ms: number;
    improvement_pct: number;
    error?: string;
}

// ── Colour maps ──────────────────────────────────────────────────────────────

const RISK = {
    high:   { bg: '#fef2f2', text: '#dc2626', label: 'HIGH RISK' },
    medium: { bg: '#fff7ed', text: '#ea580c', label: 'MEDIUM RISK' },
    low:    { bg: '#f0fdf4', text: '#16a34a', label: 'SAFE DEPLOY' },
};

const STATUS_COLOR: Record<string, string> = {
    critical: '#ef4444',
    warning:  '#f59e0b',
    healthy:  '#10b981',
};

// ── Tab header ───────────────────────────────────────────────────────────────

const TABS = [
    { id: 'map',     label: 'Environment State', icon: Activity },
    { id: 'zombies', label: 'Space Pruning',     icon: Trash2 },
    { id: 'recs',    label: 'Optimal Policy Actions', icon: Cpu },
];

export default function PerformancePage() {
    const router = useRouter();
    const [connectionString, setConnectionString] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'map' | 'zombies' | 'recs'>('map');
    const [withAI, setWithAI] = useState(false);

    const [bottleneckMap, setBottleneckMap] = useState<BottleneckColumn[]>([]);
    const [zombies, setZombies] = useState<ZombieIndex[]>([]);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

    const { droppedZombies, droppingZombies, handleDropZombie, handleDropAllZombies } = useZombieIndexes(zombies, connectionString);

    const [selectedTable, setSelectedTable] = useState<string>('');
    const [simulating, setSimulating] = useState<number | null>(null);
    const [simResults, setSimResults] = useState<Record<number, SimResult>>({});
    const [showLearn, setShowLearn] = useState(false);
    const [guideMode, setGuideMode] = useState(false);

    const runAnalysis = async (cs: string, ai: boolean) => {
        setLoading(true);
        setBottleneckMap([]); setZombies([]); setRecommendations([]); setSimResults({});
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/performance/run-performance-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: cs, with_ai: ai }),
            });
            const data = await res.json();
            setBottleneckMap(data.bottleneck_map || []);
            setZombies(data.zombie_indexes || []);
            setRecommendations(data.recommendations || []);
            const tables = [...new Set((data.bottleneck_map || []).map((c: BottleneckColumn) => c.table_name))];
            if (tables.length) setSelectedTable(tables[0] as string);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        const init = (cs?: string) => {
            const connStr = cs || localStorage.getItem('db_connection_string');
            if (!connStr) { router.replace('/dashboard'); return; }
            setConnectionString(connStr);
            setMounted(true);
            runAnalysis(connStr, false);
        };

        init();

        const handler = (e: any) => {
            const cs = e?.detail?.connStr || localStorage.getItem('db_connection_string');
            console.log('[Performance] project-changed fired, switching to:', cs);
            if (cs) init(cs);
        };
        window.addEventListener('project-changed', handler);
        return () => window.removeEventListener('project-changed', handler);
    }, []);

    if (!mounted) return null;

    const handleSimulate = async (rec: Recommendation, idx: number) => {
        if (!connectionString) return;
        setSimulating(idx);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/performance/simulate-index`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, index_sql: rec.index_sql }),
            });
            const data = await res.json();
            setSimResults(prev => ({ ...prev, [idx]: data }));
        } catch (e) { console.error(e); }
        finally { setSimulating(null); }
    };

    const handleExecuteSQL = async (sql: string) => {
        if (!connectionString) return;
        if (!window.confirm(`Are you absolutely sure you want to deploy this Policy Action to your live connected environment?\n\n${sql}`)) return;
        if (!window.confirm(`DOUBLE CONFIRMATION:\n\nThis alters production state permanently. Proceed?`)) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/optimization/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, sql_command: sql }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert('Successfully deployed policy to the environment!');
                runAnalysis(connectionString, withAI);
            } else {
                alert(`Error executing Policy: ${data.message || data.detail || 'Unknown error'}`);
            }
        } catch (e: any) { alert(`Deployment failed: ${e.message}`); }
    };

    const tableNames = [...new Set(bottleneckMap.map(c => c.table_name))];
    const filteredCols = selectedTable ? bottleneckMap.filter(c => c.table_name === selectedTable) : bottleneckMap;
    const criticalCount = bottleneckMap.filter(c => c.status === 'critical').length;
    const zombieSize = zombies.reduce((sum, z) => sum + (z.size_bytes || 0), 0);
    const zombieSizeMB = (zombieSize / 1024 / 1024).toFixed(1);

    return (
        <DashboardShell>
            <div className="flex flex-col h-full w-full max-w-[1400px] mx-auto pb-10">

                {/* ── Page header ── */}
                <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3 border-b border-gray-100 dark:border-white/[0.05] bg-white dark:bg-slate-900/80 shadow-sm z-10 relative overflow-hidden backdrop-blur-xl">
                    {/* 3D Telemetry Grid Background */}
                    <motion.div 
                        animate={{ rotate: 360, scale: [1, 1.1, 1] }} 
                        transition={{ repeat: Infinity, duration: 60, ease: "linear" }}
                        className="absolute -right-20 -top-20 w-80 h-80 border-[8px] border-dashed border-rose-500/10 dark:border-rose-500/20 rounded-full pointer-events-none" 
                        style={{ transformStyle: 'preserve-3d', transform: 'rotateX(70deg) rotateY(-10deg)' }}
                    />
                    <motion.div 
                        animate={{ x: [0, -20, 0] }} 
                        transition={{ repeat: Infinity, duration: 15, ease: "easeInOut" }}
                        className="absolute right-[15%] top-10 w-40 h-40 bg-indigo-400/10 dark:bg-indigo-600/20 rounded-full blur-[50px] pointer-events-none" 
                    />
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center relative shadow-inner ring-1 ring-violet-200">
                            <Bot size={22} className="text-violet-600" />
                            <div className="absolute top-0 right-0 -mr-1 -mt-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse border-2 border-white shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight tracking-tight flex items-center gap-2">
                                Autonomous Indexing Agent
                            </h1>
                            <p className="text-[13px] text-gray-500 font-medium mt-0.5">Live state telemetry, sequence scan penalties, and Q-Value policy models</p>
                        </div>
                    </div>
                    
                    <div className="relative z-10 flex items-center gap-2.5">
                        <button
                            onClick={() => setShowLearn(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold transition-all hover:bg-indigo-100 shadow-sm"
                        >
                            <Radar size={13} /> Architecture Overview
                        </button>
                        <button
                            onClick={() => setGuideMode(v => !v)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-sm ${guideMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        >
                            <Info size={13} /> {guideMode ? 'Exit Guide Mode' : 'Explain this Page'}
                        </button>
                        <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 font-bold cursor-pointer select-none px-2">
                            <input type="checkbox" checked={withAI} onChange={e => setWithAI(e.target.checked)} className="accent-violet-600 w-3.5 h-3.5" />
                            LLM Deep Reasoning
                        </label>
                        <Button
                            size="sm"
                            disabled={!connectionString || loading}
                            onClick={() => connectionString && runAnalysis(connectionString, withAI)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-transform active:scale-95"
                        >
                            {loading ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <PlaySquare size={13} className="mr-1.5" />}
                            {loading ? 'Observing Matrix…' : 'Run Operations'}
                        </Button>
                    </div>
                </div>

                {/* ── Architecture Modal ── */}
                {showLearn && (
                    <div className="bg-slate-50 border-b border-gray-200 px-6 py-6 shadow-inner">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <Bot size={16} className="text-violet-600"/> Agent Optimization Loop
                                </h2>
                                <button onClick={() => setShowLearn(false)} className="text-slate-400 hover:text-slate-900 transition-colors cursor-pointer bg-white rounded-full p-1 border shadow-sm">
                                    <X size={14} strokeWidth={3} />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
                                <div className="bg-white border-t-2 border-t-rose-500 border-x border-b border-gray-200 rounded-xl p-5 shadow-sm">
                                    <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2"><Activity size={15} className="text-rose-500"/> Identify Penalties</h3>
                                    <p className="text-slate-500 text-xs leading-relaxed">
                                        The agent observes the environment and identifies <strong>Negative Reward Nodes</strong> — tables where queries are penalized mechanically by sequential scans because targeted indices are missing.
                                    </p>
                                </div>
                                <div className="bg-white border-t-2 border-t-amber-500 border-x border-b border-gray-200 rounded-xl p-5 shadow-sm">
                                    <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2"><Trash2 size={15} className="text-amber-500"/> State Space Pruning</h3>
                                    <p className="text-slate-500 text-xs leading-relaxed">
                                        Active models build cruft. The agent detects structural indices returning <strong>zero net reward</strong> to your workload, allowing you to drop them securely without performance loss.
                                    </p>
                                </div>
                                <div className="bg-white border-t-2 border-t-violet-500 border-x border-b border-gray-200 rounded-xl p-5 shadow-sm">
                                    <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2"><Cpu size={15} className="text-violet-500"/> Formulate Policy</h3>
                                    <p className="text-slate-500 text-xs leading-relaxed">
                                        The agent structures <strong>Optimal Actions</strong> (SQL migrations) and scores them with an Expected Q-Value. Actions can be simulated safely in a sandbox before final deployment.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Agent Telemetry Summary ── */}
                {!loading && (
                    <div className="px-6 md:px-8 py-6 border-b border-gray-100 bg-white">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4">
                            <Radio size={12} className="animate-pulse text-violet-500" /> Active Telemetry Model
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[
                                { label: 'Sub-Optimal Penalty Nodes', value: criticalCount,  color: criticalCount > 0 ? 'text-rose-600' : 'text-emerald-500', sub: 'High sequential scan lag', guide: 'Speed Bumps' },
                                { label: 'State Space Prunings',      value: zombies.length - droppedZombies.size, color: 'text-amber-500', sub: `${zombieSizeMB} MB of reclaimable space`, guide: 'Cleanup Targets' },
                                { label: 'Optimal Policy Actions',    value: recommendations.length, color: 'text-violet-700', sub: 'Actions ready for deployment', guide: 'Fixes Available' },
                                { label: 'Collections Observed',      value: tableNames.length, color: 'text-slate-900',   sub: 'Nodes evaluated in current state', guide: 'Tables Monitored' },
                            ].map((s, i) => (
                                <div key={i} className="flex flex-col relative before:absolute before:left-0 before:-ml-3 before:top-1 before:bottom-1 before:w-[1px] before:bg-gray-100 first:before:hidden">
                                    <span className={`text-[32px] font-black tracking-tighter leading-none mb-1.5 drop-shadow-sm ${s.color}`}>{s.value}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">{s.label}</span>
                                        {guideMode && <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200 animate-in fade-in zoom-in">{s.guide}</span>}
                                    </div>
                                    {s.sub && <span className="text-[10px] text-gray-400 font-semibold mt-1">{s.sub}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Tab Layout ── */}
                <div className="border-b border-gray-200 bg-slate-50/50 px-4 md:px-8 flex mt-2">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-wider border-b-[3px] transition-all cursor-pointer whitespace-nowrap
                                    ${active ? 'text-violet-700 border-violet-600 bg-white' : 'text-slate-400 border-transparent hover:text-slate-700 hover:bg-slate-100/50'}`}
                            >
                                <Icon size={14} className={active ? 'text-violet-600' : ''} /> {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* ── Main Dashboard Content ── */}
                <div className="px-4 md:px-8 py-8 bg-slate-50/20 flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="relative flex items-center justify-center w-16 h-16">
                                <div className="absolute inset-0 rounded-full border-2 border-violet-100 animate-ping"></div>
                                <Radar size={28} className="text-violet-600 animate-spin" />
                            </div>
                            <p className="text-sm text-slate-500 font-bold tracking-wide uppercase mt-2">Agent Observing Matrix Patterns…</p>
                        </div>
                    ) : (
                        <>
                            {/* ─── Tab A: Environment State ─── */}
                            {activeTab === 'map' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                                        <div className="flex-1">
                                            <p className="text-[13px] text-slate-700 leading-relaxed font-bold">
                                                Nodes marked with <span className="text-rose-600 font-black px-1.5 py-0.5 rounded bg-rose-50 border border-rose-100 uppercase tracking-tighter">Penalty Nodes</span> represent environment bottlenecks. 
                                                The agent detects <span className="text-rose-600 underline decoration-rose-200 underline-offset-2">Sequential Scans</span>: a state where the database reads every single row on disk to satisfy a query, causing mechanical lag and high latency.
                                            </p>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Pressure Sensing</span>
                                        </div>
                                    </div>

                                    {tableNames.length > 1 && (
                                        <div className="flex flex-wrap items-center gap-2 mb-6">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mr-2">Filter State:</span>
                                            {tableNames.map(t => (
                                                <button
                                                    key={t}
                                                    onClick={() => setSelectedTable(t)}
                                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer backdrop-blur-sm
                                                        ${selectedTable === t ? 'border-violet-300 bg-violet-100 text-violet-800 shadow-inner' : 'border-gray-200 bg-white/70 text-gray-500 hover:border-violet-300 hover:text-gray-900 hover:bg-white'}`}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                            <button 
                                                onClick={() => setSelectedTable('')} 
                                                className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${!selectedTable ? 'bg-slate-200 text-slate-700 pointer-events-none' : 'text-slate-500 hover:bg-slate-100'}`}
                                            >
                                                Clear Filter
                                            </button>
                                        </div>
                                    )}

                                    {filteredCols.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-3xl gap-4 shadow-sm relative overflow-hidden group">
                                            {/* 3D Ideal State Orb */}
                                            <motion.div 
                                                animate={{ rotateX: [10, 40, 10], rotateY: [-20, -50, -20], scale: [1, 1.1, 1] }} 
                                                transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
                                                className="absolute right-20 bottom-0 w-32 h-32 rounded-full border-4 border-emerald-500/20 pointer-events-none group-hover:border-emerald-500/30 transition-colors"
                                                style={{ transformStyle: 'preserve-3d' }}
                                            />
                                            <div className="w-16 h-16 bg-white dark:bg-white/[0.05] rounded-2xl flex items-center justify-center shadow-lg text-emerald-500 dark:text-emerald-400 relative z-10 hover:-translate-y-1 transition-transform">
                                                <CheckCircle size={32} />
                                            </div>
                                            <p className="text-[15px] font-black text-emerald-800 dark:text-emerald-300 relative z-10">State Matrix Optimal: Zero Penalty Nodes Detected</p>
                                        </div>
                                    ) : (
                                        <motion.div 
                                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                                            initial="hidden"
                                            animate="show"
                                            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
                                        >
                                            {filteredCols.map((col, i) => (
                                                <motion.div 
                                                    key={i} 
                                                    variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 25 } } }}
                                                    whileHover={{ scale: 1.02 }}
                                                    className="bg-white relative overflow-hidden rounded-2xl p-5 border border-gray-100 shadow-sm group flex flex-col"
                                                >
                                                    <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: STATUS_COLOR[col.status] }} />
                                                    
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <span className="relative flex h-3 w-3 shrink-0">
                                                          {col.status === 'critical' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>}
                                                          <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: STATUS_COLOR[col.status] }}></span>
                                                        </span>
                                                        <span className="font-bold text-[15px] text-slate-800 truncate">{col.column_name}</span>
                                                        
                                                        {col.seq_scan_count > 1000 && (
                                                            <span className="ml-auto text-[9px] text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-black uppercase tracking-widest animate-pulse">Critical Load</span>
                                                        )}
                                                        {col.is_indexed && !col.seq_scan_count && (
                                                            <span className="ml-auto text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-black uppercase tracking-widest"><Zap size={10} className="inline mr-0.5 mb-0.5"/> Optimal</span>
                                                        )}
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className="mb-4 bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                            <div className="flex justify-between items-center mb-1.5">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">Scan Penalty</span>
                                                                <span className="text-xs font-black font-mono" style={{ color: STATUS_COLOR[col.status] }}>{col.seq_scan_count.toLocaleString()}</span>
                                                            </div>
                                                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (col.seq_scan_count / 500) * 100)}%`, background: STATUS_COLOR[col.status] }}></div>
                                                            </div>
                                                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200 text-[11px] font-bold text-slate-500">
                                                                <span>Dataset Gravity:</span>
                                                                <span className="text-slate-800">{col.row_count.toLocaleString()} rows</span>
                                                            </div>
                                                        </div>

                                                        {col.status !== 'healthy' && (
                                                            <div className="flex items-start gap-2 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/50">
                                                                <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: STATUS_COLOR[col.status] }} />
                                                                <p className="text-[11px] leading-relaxed font-bold" style={{ color: STATUS_COLOR[col.status] === '#ef4444' ? '#9f1239' : '#b45309' }}>
                                                                    {col.suggestion}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </motion.div>
                                    )}
                                </div>
                            )}

                            {/* ─── Tab B: Space Pruning ─── */}
                            {activeTab === 'zombies' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                     {zombies.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-3xl gap-4 shadow-sm relative overflow-hidden group">
                                            <motion.div 
                                                animate={{ rotateX: [10, 40, 10], rotateY: [-20, -50, -20], scale: [1, 1.1, 1] }} 
                                                transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
                                                className="absolute right-20 bottom-0 w-32 h-32 rounded-full border-4 border-emerald-500/20 pointer-events-none group-hover:border-emerald-500/30 transition-colors"
                                                style={{ transformStyle: 'preserve-3d' }}
                                            />
                                            <div className="w-16 h-16 bg-white dark:bg-white/[0.05] rounded-2xl flex items-center justify-center shadow-lg text-emerald-500 dark:text-emerald-400 relative z-10 hover:-translate-y-1 transition-transform">
                                                <CheckCircle size={32} />
                                            </div>
                                            <p className="text-[15px] font-black text-emerald-800 dark:text-emerald-300 relative z-10">State Matrix Optimal: Zero Wasted Indexes Detected</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-5">
                                            {/* Action Banner */}
                                            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm relative overflow-hidden">
                                                <div className="absolute -right-10 -top-10 opacity-10"><Trash2 size={150} /></div>
                                                <div className="relative z-10">
                                                    <h3 className="text-amber-800 font-black text-lg mb-1 tracking-tight">Pruning Sub-optimal State Space</h3>
                                                    <p className="text-amber-700/80 text-[13px] font-bold mb-4">Agent reveals {zombies.length} indices receiving <span className="underline decoration-amber-300 decoration-2 underline-offset-2">0 reward responses</span>. Immediate pruning recovers {zombieSizeMB} MB.</p>
                                                    <div className="w-72 h-2 bg-amber-200/60 rounded-full overflow-hidden mb-1.5 border border-amber-200">
                                                        <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-700 ease-out" style={{ width: `${(droppedZombies.size / zombies.length) * 100}%` }} />
                                                    </div>
                                                    <p className="text-[11px] text-amber-800/60 font-black uppercase tracking-widest">{droppedZombies.size} of {zombies.length} States Pruned</p>
                                                </div>
                                                <button
                                                    onClick={handleDropAllZombies}
                                                    disabled={droppedZombies.size === zombies.length || droppingZombies.size > 0}
                                                    className="relative z-10 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl transition-all hover:shadow-lg cursor-pointer whitespace-nowrap shadow-md"
                                                >
                                                    Prune Entire State Network
                                                </button>
                                            </div>

                                            <motion.div 
                                                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                                                initial="hidden"
                                                animate="show"
                                                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
                                            >
                                                {zombies.map((z, i) => {
                                                    const isDropped = droppedZombies.has(z.index_name);
                                                    const isDropping = droppingZombies.has(z.index_name);
                                                    return (
                                                        <motion.div 
                                                            key={i} 
                                                            variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', damping: 25, stiffness: 200 } } }}
                                                            whileHover={{ scale: 1.01 }}
                                                            className={`bg-white border border-gray-200 rounded-2xl p-5 transition-all duration-300 ${isDropped ? 'opacity-50 grayscale pointer-events-none bg-slate-50' : 'shadow-sm hover:shadow-lg'}`}>
                                                            <div className="flex justify-between items-start mb-4">
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1.5">
                                                                        <span className="font-black text-[15px] text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{z.index_name}</span>
                                                                        {['customer', 'user', 'users', 'account'].includes(z.table_name.toLowerCase()) ? (
                                                                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200">Manual Review Rec.</span>
                                                                        ) : (
                                                                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 border border-emerald-200">100% Agent Confirm</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Database size={10}/> Table target: <span className="text-violet-600 bg-violet-50 px-1.5 rounded">{z.table_name}</span></div>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className="text-xl font-black text-rose-500 leading-none">{z.size_human}</p>
                                                                    <p className="text-[9px] text-rose-400 font-black uppercase tracking-widest mt-1">Bloat Detected</p>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 mb-4 h-16 overflow-y-auto">
                                                                <code className="text-[11px] font-mono text-slate-700 break-all leading-relaxed">
                                                                    <span className="text-slate-400 font-bold block mb-1">{"// Agent generated drop command"}</span>
                                                                    {z.drop_sql}
                                                                </code>
                                                            </div>

                                                            <div className="flex items-center justify-between gap-4">
                                                                <p className="text-[11px] text-slate-500 font-medium leading-tight flex-1">
                                                                    <Info size={14} className="inline mr-1 text-sky-500 mb-0.5" />
                                                                    {z.saving_note}
                                                                </p>
                                                                <button
                                                                    onClick={() => handleDropZombie(z)}
                                                                    disabled={isDropped || isDropping}
                                                                    className={`shrink-0 flex items-center justify-center gap-1.5 border-2 cursor-pointer text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all
                                                                        ${isDropped ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white border-transparent shadow-md hover:shadow-lg'}`}
                                                                >
                                                                    {isDropped ? <CheckCircle size={15} /> : <Trash2 size={15} />}
                                                                    {isDropped ? 'Pruned' : isDropping ? 'Pruning...' : 'Prune Policy'}
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </motion.div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─── Tab C: Artificial Policy Actions ─── */}
                            {activeTab === 'recs' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                                        <div className="absolute bg-gradient-to-r from-violet-500/10 to-transparent inset-0 z-0 pointer-events-none"></div>
                                        <div className="relative z-10 flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Cpu size={16} className="text-violet-600"/>
                                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Agent Policy Engine</h3>
                                            </div>
                                            <p className="text-[13px] text-slate-700 leading-relaxed font-bold">
                                                The agent constructs <strong>Optimal Policy Actions</strong> (SQL resolutions) to neutralize environment anomalies. 
                                                Each action is scored with an <span className="text-violet-600 underline decoration-violet-200 underline-offset-2">Expected Q-Value</span>: a measure of the predicted performance reward this policy will yield.
                                                Higher Q-Values indicate <strong>Critical High-Impact</strong> resolutions that should be prioritized.
                                            </p>
                                        </div>
                                    </div>

                                    {recommendations.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-3xl gap-4 shadow-sm relative overflow-hidden group">
                                            <motion.div 
                                                animate={{ rotateX: [10, 40, 10], rotateY: [-20, -50, -20], scale: [1, 1.1, 1] }} 
                                                transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
                                                className="absolute right-20 bottom-0 w-32 h-32 rounded-full border-4 border-emerald-500/20 pointer-events-none group-hover:border-emerald-500/30 transition-colors"
                                                style={{ transformStyle: 'preserve-3d' }}
                                            />
                                            <div className="w-16 h-16 bg-white dark:bg-white/[0.05] rounded-2xl flex items-center justify-center shadow-lg text-emerald-500 dark:text-emerald-400 relative z-10 hover:-translate-y-1 transition-transform">
                                                <CheckCircle size={32} />
                                            </div>
                                            <p className="text-[15px] font-black text-emerald-800 dark:text-emerald-300 relative z-10">State Matrix Optimal: No Agent Actions Formulated</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-6">
                                            {recommendations.map((rec, idx) => {
                                                const risk = RISK[rec.risk_level] ?? RISK.low;
                                                const sim = simResults[idx];
                                                // Dynamic Q-Value Coloring
                                                const qColor = rec.impact_score > 60 ? '#ef4444' : rec.impact_score > 30 ? '#f59e0b' : '#10b981';
                                                
                                                return (
                                                    <div key={idx} className="bg-white border text-left border-gray-200 rounded-3xl p-1 shadow-sm hover:shadow-md transition-shadow">
                                                        <div className="bg-slate-50 border-b border-gray-100 rounded-t-[22px] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center border-2 border-white shadow-sm"><Code size={14}/></div>
                                                                <span className="text-[15px] font-black text-slate-800 tracking-tight">{rec.table_name}.<span className="text-violet-600">{rec.column_names.join(', ')}</span></span>
                                                                <span className="text-[10px] font-black tracking-widest px-2.5 py-1 rounded-md border shadow-sm uppercase ml-2" 
                                                                    style={{ background: risk.bg, color: risk.text, borderColor: `${risk.text}40` }}>{risk.label}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className="text-right flex flex-col items-center">
                                                                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Exp. Q-Value</p>
                                                                     <div className="flex items-center gap-2">
                                                                        <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                                                                             <div className="h-full rounded-full" style={{ width: `${rec.impact_score}%`, backgroundColor: qColor }} />
                                                                        </div>
                                                                        <span className="text-sm font-black w-8 text-left" style={{ color: qColor }}>{rec.impact_score}</span>
                                                                     </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="px-6 py-6">
                                                            <div className="flex flex-col lg:flex-row gap-6 mb-6">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <Bot size={16} className="text-sky-600" />
                                                                        <span className="text-xs font-black uppercase tracking-widest text-sky-800">Agent Reasoning Output</span>
                                                                    </div>
                                                                    <p className="text-[13px] text-slate-600 leading-relaxed font-medium bg-sky-50/50 p-4 rounded-xl border border-sky-100 shadow-inner">
                                                                        {rec.ai_explanation}
                                                                    </p>
                                                                </div>
                                                                {rec.query_frequency_pct > 0 && (
                                                                    <div className="w-full lg:w-48 shrink-0 bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col justify-center items-center text-center">
                                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 shadow-sm px-2 py-1 bg-white rounded border border-slate-100">Load Map</p>
                                                                        <p className="text-2xl font-black text-slate-800">~{rec.query_frequency_pct.toFixed(0)}%</p>
                                                                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Of System Queries Affected</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="bg-slate-900 rounded-xl px-5 py-4 border border-slate-800 shadow-inner flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                                                                <code className="text-xs font-mono tracking-tight text-emerald-400 break-all flex-1">
                                                                    <span className="text-slate-500 font-bold block mb-1">{"// Auto-generated indexing policy"}</span>
                                                                    {rec.index_sql}
                                                                </code>
                                                                <button
                                                                    onClick={() => handleExecuteSQL(rec.index_sql)}
                                                                    className="shrink-0 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border-2 border-emerald-100 transition-all text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer shadow-sm hover:shadow-md"
                                                                >
                                                                    Deploy Policy to Target
                                                                </button>
                                                            </div>

                                                            <div className="flex flex-col md:flex-row gap-4 items-stretch">
                                                                <Button
                                                                    size="lg"
                                                                    disabled={simulating === idx}
                                                                    onClick={() => handleSimulate(rec, idx)}
                                                                    className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all font-black uppercase tracking-widest text-xs h-auto py-4 rounded-xl cursor-pointer basis-1/3 shadow-sm hover:shadow-md"
                                                                >
                                                                    {simulating === idx
                                                                        ? <><Loader2 size={16} className="mr-2 animate-spin" /> Virtualizing Sandbox…</>
                                                                        : <><PlaySquare size={16} className="mr-2" /> Simulate Action Path</>
                                                                    }
                                                                </Button>
                                                                
                                                                <div className="flex-1 min-h-[50px] relative rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden h-[54px] shadow-inner">
                                                                    {!sim ? (
                                                                        simulating === idx 
                                                                            ? <div className="text-xs font-bold text-slate-400 animate-pulse tracking-widest uppercase">Waiting for virtual agent response...</div> 
                                                                            : <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-4 text-center">Run simulation to evaluate state latency impact</div>
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-stretch">
                                                                            <div className="flex-1 flex flex-col justify-center px-6 border-r border-slate-200 bg-white">
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Before</span>
                                                                                    <span className="text-sm font-black text-rose-500 font-mono">{sim.before_ms}ms</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="w-12 bg-slate-100 flex items-center justify-center text-slate-300 border-r border-slate-200"><TrendingUp size={16} /></div>
                                                                            <div className="flex-1 flex flex-col justify-center px-6 bg-white border-r border-slate-200">
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">After Strategy</span>
                                                                                    {sim.error ? <span className="text-xs font-black text-rose-500">FAILED</span> : <span className="text-sm font-black text-emerald-500 font-mono">{sim.after_ms}ms</span>}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex-1 flex flex-col justify-center px-6 bg-emerald-50 relative overflow-hidden">
                                                                                {sim.improvement_pct > 0 && <div className="absolute inset-0 bg-emerald-100/30 animate-pulse"></div>}
                                                                                <div className="relative z-10 flex items-center justify-between">
                                                                                    <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Reward / Gain</span>
                                                                                    <span className="text-base font-black text-emerald-600 font-mono">↓ {sim.improvement_pct}%</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {sim?.error && <div className="mt-3 text-xs text-rose-600 font-bold bg-rose-50 px-4 py-3 rounded-xl border border-rose-100">Virtual Simulation Failure: {sim.error}</div>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
