'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2, Zap, CheckCircle, AlertTriangle,
    TrendingUp, Trash2, Map, Database, Lightbulb, BookOpen,
    XCircle, Search, AlertCircle, Info, X, Scale, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardShell from '@/components/DashboardShell';
import { useZombieIndexes } from '@/hooks/useZombieIndexes';

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
    high:   { bg: '#fef2f2', text: '#dc2626', label: 'HIGH' },
    medium: { bg: '#fff7ed', text: '#ea580c', label: 'MEDIUM' },
    low:    { bg: '#f0fdf4', text: '#16a34a', label: 'LOW' },
};

const STATUS_COLOR: Record<string, string> = {
    critical: '#ef4444',
    warning:  '#f59e0b',
    healthy:  '#22c55e',
};

// ── Tab header ───────────────────────────────────────────────────────────────

const TABS = [
    { id: 'map',     label: 'Speed Bottlenecks', icon: Map      },
    { id: 'zombies', label: 'Wasted Storage',    icon: Trash2   },
    { id: 'recs',    label: 'AI Speed Fixes',    icon: Lightbulb},
];

// ── Component ────────────────────────────────────────────────────────────────

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
        const cs = localStorage.getItem('db_connection_string');
        if (!cs) { router.replace('/dashboard'); return; }
        setConnectionString(cs);
        setMounted(true);
        runAnalysis(cs, false);
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
        if (!window.confirm(`Are you absolutely sure you want to execute this SQL on your live connected database?\n\n${sql}`)) return;
        if (!window.confirm(`DOUBLE CONFIRMATION:\n\nThis will modify your database schema permanently. This action cannot be undone from the dashboard. Proceed?`)) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/optimization/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, sql_command: sql }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert('Successfully applied change to the database!');
                runAnalysis(connectionString, withAI);
            } else {
                alert(`Error executing SQL: ${data.message || data.detail || 'Unknown error'}`);
            }
        } catch (e: any) { alert(`Execution failed: ${e.message}`); }
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
                <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                            <Zap size={18} className="text-amber-500" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 leading-tight">Speed Optimization</h1>
                            <p className="text-xs text-gray-500 font-medium">Index analysis, wasted storage, and AI-powered fixes</p>
                        </div>
                        <button
                            onClick={() => router.push('/dashboard/data')}
                            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold cursor-pointer hover:bg-emerald-100 transition-colors"
                        >
                            <Database size={13} /> View Data
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowLearn(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold cursor-pointer hover:bg-violet-100 transition-colors"
                        >
                            <BookOpen size={13} /> How AI Speeds Up Your App
                        </button>
                        <label className="flex items-center gap-1.5 text-xs text-gray-600 font-medium cursor-pointer select-none">
                            <input type="checkbox" checked={withAI} onChange={e => setWithAI(e.target.checked)} className="accent-violet-600" />
                            AI insights
                        </label>
                        <Button
                            size="sm"
                            disabled={!connectionString || loading}
                            onClick={() => connectionString && runAnalysis(connectionString, withAI)}
                            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl cursor-pointer"
                        >
                            {loading ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Zap size={13} className="mr-1.5" />}
                            {loading ? 'Scanning…' : 'Re-scan'}
                        </Button>
                    </div>
                </div>

                {/* ── Learn panel ── */}
                {showLearn && (
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-5">
                        <div className="max-w-3xl mx-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold text-violet-700 flex items-center gap-2">
                                    <BookOpen size={16} /> How AI Speeds Up Your App
                                </h2>
                                <button onClick={() => setShowLearn(false)} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
                                    <XCircle size={17} />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                    <p className="text-amber-600 font-bold mb-2 flex items-center gap-1.5"><BookOpen size={13} /> The Phonebook Analogy</p>
                                    <p className="text-slate-500 leading-relaxed"><strong className="text-gray-800">Without fix:</strong> Your app reads every row to find one user — like reading a phonebook cover-to-cover.</p>
                                    <p className="text-slate-500 leading-relaxed mt-2"><strong className="text-gray-800">With fix:</strong> AI builds a smart lookup (an "Index"). Finding a user becomes instant.</p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                    <p className="text-blue-600 font-bold mb-2 flex items-center gap-1.5"><Scale size={13} /> Clearing Wasted Space</p>
                                    <p className="text-slate-500 leading-relaxed">Smart lookups take up disk space and slightly slow down writes.</p>
                                    <p className="text-slate-500 leading-relaxed mt-2"><strong className="text-red-600">Wasted Storage</strong> happens when old lookups are never used. We detect these so you can safely delete them.</p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                    <p className="text-green-600 font-bold mb-2 flex items-center gap-1.5"><RefreshCw size={13} /> The AI Workflow</p>
                                    <ul className="text-slate-500 space-y-1.5 leading-relaxed list-none p-0 m-0">
                                        <li><strong className="text-gray-800">Identify</strong> — See which parts of your app are slow</li>
                                        <li><strong className="text-gray-800">Simulate</strong> — AI tests the fix in a sandbox first</li>
                                        <li><strong className="text-gray-800">Apply</strong> — 1-click deployment to make it fast</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Summary bar ── */}
                {!loading && (
                    <div className="flex gap-8 px-6 md:px-8 py-5 border-b border-gray-100 flex-wrap">
                        {[
                            { label: 'Speed bottlenecks',    value: criticalCount,                     color: criticalCount > 0 ? 'text-red-500' : 'text-emerald-500', sub: '' },
                            { label: 'Unused indexes',       value: zombies.length - droppedZombies.size, color: 'text-amber-500', sub: `${zombieSizeMB} MB wasted` },
                            { label: 'AI speedups available',value: recommendations.length,             color: 'text-violet-600', sub: '' },
                            { label: 'Collections scanned',  value: tableNames.length,                 color: 'text-gray-900',   sub: '' },
                        ].map((s, i) => (
                            <div key={i} className="flex flex-col">
                                <span className={`text-4xl font-black tracking-tight leading-none mb-1 ${s.color}`}>{s.value}</span>
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{s.label}</span>
                                {s.sub && <span className="text-xs text-gray-400 font-semibold mt-0.5">{s.sub}</span>}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Tab bar ── */}
                <div className="flex gap-0 border-b border-gray-100 bg-white px-4 md:px-6">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap
                                    ${active ? 'text-violet-700 border-violet-600' : 'text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-50/60'}`}
                            >
                                <Icon size={15} /> {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* ── Content ── */}
                <div className="px-4 md:px-8 pt-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 size={32} className="text-violet-500 animate-spin" />
                            <p className="text-sm text-slate-500 font-medium">Scanning schema for index patterns…</p>
                        </div>
                    ) : (
                        <>
                            {/* ─── Tab A: Bottleneck Map ─── */}
                            {activeTab === 'map' && (
                                <div>
                                    <p className="text-sm text-slate-500 font-medium mb-5">
                                        Data points highlighted in <span className="text-red-600 font-bold">red</span> are causing your app to run slowly. The engine is doing hard work reading thousands of rows instead of using a smart lookup.
                                    </p>
                                    {tableNames.length > 1 && (
                                        <div className="flex gap-2 flex-wrap mb-5">
                                            {tableNames.map(t => (
                                                <button
                                                    key={t}
                                                    onClick={() => setSelectedTable(t)}
                                                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer
                                                        ${selectedTable === t ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-gray-900'}`}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {filteredCols.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-14 bg-green-50 border border-green-200 rounded-2xl gap-3">
                                            <CheckCircle size={36} className="text-emerald-500" />
                                            <p className="text-sm font-semibold text-green-700">No bottleneck columns detected.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {filteredCols.map((col, i) => (
                                                <div key={i} className="bg-white relative overflow-hidden rounded-2xl p-5 border shadow-sm hover:shadow-md transition-shadow" style={{ borderColor: STATUS_COLOR[col.status] === '#ef4444' ? '#fecaca' : STATUS_COLOR[col.status] === '#f59e0b' ? '#fde68a' : '#bbf7d0' }}>
                                                    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: STATUS_COLOR[col.status] }} />
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[col.status] }} />
                                                        <span className="font-bold text-sm text-gray-900">{col.column_name}</span>
                                                        {col.is_indexed && (
                                                            <span className="ml-auto text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">fast lookup</span>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-3 py-2.5 border-t border-b border-gray-100 text-xs text-gray-500 font-medium mb-3">
                                                        <span className="flex items-center gap-1"><Search size={12} className="text-gray-400" /> {col.seq_scan_count} slow reads</span>
                                                        <span className="flex items-center gap-1"><Database size={12} className="text-gray-400" /> {col.row_count.toLocaleString()}</span>
                                                    </div>
                                                    {col.status !== 'healthy' && (
                                                        <div className="flex items-start gap-1.5">
                                                            <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: STATUS_COLOR[col.status] }} />
                                                            <p className="text-xs leading-relaxed font-medium" style={{ color: STATUS_COLOR[col.status] === '#ef4444' ? '#991b1b' : '#92400e' }}>{col.suggestion}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─── Tab B: Zombie Indexes ─── */}
                            {activeTab === 'zombies' && (
                                <div>
                                    {zombies.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-14 bg-green-50 border border-green-200 rounded-2xl gap-3">
                                            <CheckCircle size={36} className="text-emerald-500" />
                                            <p className="text-sm font-semibold text-green-700">No zombie indexes found — your schema is lean!</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-4">
                                            {/* Hero CTA */}
                                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                                                <div>
                                                    <h3 className="text-amber-700 font-bold text-base mb-1">Reclaim {zombieSizeMB} MB of wasted storage</h3>
                                                    <p className="text-amber-700/70 text-sm font-medium mb-3">{zombies.length} unused indexes — each one slows down writes. Safe to drop.</p>
                                                    <div className="w-56 h-1.5 bg-amber-200 rounded-full overflow-hidden mb-1.5">
                                                        <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${(droppedZombies.size / zombies.length) * 100}%` }} />
                                                    </div>
                                                    <p className="text-xs text-amber-700/60 font-bold">{droppedZombies.size} of {zombies.length} dropped</p>
                                                </div>
                                                <button
                                                    onClick={handleDropAllZombies}
                                                    disabled={droppedZombies.size === zombies.length || droppingZombies.size > 0}
                                                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                                                >
                                                    Drop all unused indexes
                                                </button>
                                            </div>

                                            {zombies.map((z, i) => {
                                                const isDropped = droppedZombies.has(z.index_name);
                                                const isDropping = droppingZombies.has(z.index_name);
                                                return (
                                                    <div key={i} className={`bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${isDropped ? 'opacity-50 grayscale pointer-events-none bg-gray-50' : ''}`}>
                                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className="font-bold text-sm text-gray-900">{z.index_name}</span>
                                                                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">{z.table_name}</span>
                                                                    {['customer', 'user', 'users', 'account'].includes(z.table_name.toLowerCase()) ? (
                                                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">review first</span>
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">safe to drop</span>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-gray-500 font-medium mb-3 flex items-center gap-1.5">
                                                                    <Info size={14} className="shrink-0" /> {z.saving_note}
                                                                </p>
                                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                                    <code className="text-xs text-gray-600 font-mono bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 truncate flex-1 block">
                                                                        {z.index_def}
                                                                    </code>
                                                                    <button
                                                                        onClick={() => handleDropZombie(z)}
                                                                        disabled={isDropped || isDropping}
                                                                        className={`shrink-0 flex items-center justify-center gap-1.5 border cursor-pointer text-xs font-bold px-4 py-2 rounded-xl transition-colors min-w-[110px]
                                                                            ${isDropped ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'}`}
                                                                    >
                                                                        {isDropped ? <CheckCircle size={14} /> : <X size={14} className="text-gray-400" />}
                                                                        {isDropped ? 'Dropped' : isDropping ? 'Dropping...' : 'Drop index'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                                                                <p className="text-lg font-black text-amber-500 leading-none">{z.size_human}</p>
                                                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">wasted</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─── Tab C: SQL Recommendations ─── */}
                            {activeTab === 'recs' && (
                                <div>
                                    <p className="text-sm text-slate-500 font-medium mb-5">
                                        AI-powered suggestions to make your app lightning fast. Click <strong className="text-violet-700">Test in Sandbox</strong> to see proof of the speedup — entirely safely, without touching live production data.
                                    </p>
                                    {recommendations.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-14 bg-green-50 border border-green-200 rounded-2xl gap-3">
                                            <CheckCircle size={36} className="text-emerald-500" />
                                            <p className="text-sm font-semibold text-green-700">Your app is fully optimized!</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-5">
                                            {recommendations.map((rec, idx) => {
                                                const risk = RISK[rec.risk_level] ?? RISK.low;
                                                const sim = simResults[idx];
                                                return (
                                                    <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                                                        {/* Header */}
                                                        <div className="flex items-start justify-between gap-4 mb-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg border" style={{ background: risk.bg, color: risk.text, borderColor: `${risk.text}30` }}>{risk.label}</span>
                                                                    <span className="text-violet-700 font-bold text-sm">{rec.table_name}.{rec.column_names.join(', ')}</span>
                                                                    {rec.query_frequency_pct > 0 && (
                                                                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">~{rec.query_frequency_pct.toFixed(0)}% of queries affected</span>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-slate-500 leading-relaxed">{rec.ai_explanation}</p>
                                                            </div>
                                                            <div className="w-16 text-center shrink-0 bg-gray-50 border border-gray-200 rounded-xl py-3 px-2">
                                                                <p className="text-2xl font-black leading-none" style={{ color: rec.impact_score > 60 ? '#dc2626' : rec.impact_score > 30 ? '#d97706' : '#16a34a' }}>{rec.impact_score}</p>
                                                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">impact</p>
                                                            </div>
                                                        </div>

                                                        {/* Impact bar */}
                                                        <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${rec.impact_score}%`, background: rec.impact_score > 60 ? '#ef4444' : rec.impact_score > 30 ? '#f59e0b' : '#22c55e' }} />
                                                        </div>

                                                        {/* SQL */}
                                                        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
                                                            <code className="text-xs font-mono text-gray-800 break-all flex-1">
                                                                <span className="text-gray-400 block mb-1">-- Generated by DB-Lighthouse AI</span>
                                                                {rec.index_sql}
                                                            </code>
                                                            <button
                                                                onClick={() => handleExecuteSQL(rec.index_sql)}
                                                                className="shrink-0 bg-white border border-gray-200 text-gray-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-all text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                                                            >
                                                                Execute SQL
                                                            </button>
                                                        </div>

                                                        {/* Sim result */}
                                                        {sim && (
                                                            <div className="flex gap-5 mb-4 p-4 bg-sky-50 rounded-xl border border-sky-200">
                                                                <div>
                                                                    <p className="text-xs text-sky-700 font-semibold mb-1">Before</p>
                                                                    <p className="text-xl font-black text-red-600">{sim.before_ms} <span className="text-sm font-semibold">ms</span></p>
                                                                </div>
                                                                <div className="flex items-center text-sky-500"><TrendingUp size={20} /></div>
                                                                <div>
                                                                    <p className="text-xs text-sky-700 font-semibold mb-1">After</p>
                                                                    <p className="text-xl font-black text-green-600">{sim.after_ms} <span className="text-sm font-semibold">ms</span></p>
                                                                </div>
                                                                {sim.improvement_pct > 0 && (
                                                                    <div className="ml-auto text-right">
                                                                        <p className="text-xs text-sky-700 font-semibold mb-1">Improvement</p>
                                                                        <p className="text-2xl font-black text-green-600">↓ {sim.improvement_pct}%</p>
                                                                    </div>
                                                                )}
                                                                {sim.error && <p className="text-xs text-red-600 font-semibold bg-red-50 px-3 py-2 rounded-lg">Error: {sim.error}</p>}
                                                            </div>
                                                        )}

                                                        <Button
                                                            size="sm"
                                                            disabled={simulating === idx}
                                                            onClick={() => handleSimulate(rec, idx)}
                                                            className="bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 font-semibold rounded-xl cursor-pointer w-full md:w-auto"
                                                        >
                                                            {simulating === idx
                                                                ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Testing safely in sandbox…</>
                                                                : <><Zap size={14} className="mr-1.5" /> Test AI Fix in Sandbox</>
                                                            }
                                                        </Button>
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
