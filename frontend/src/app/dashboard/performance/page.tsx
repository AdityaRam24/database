'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2, Zap, ArrowLeft, CheckCircle, AlertTriangle,
    TrendingUp, Trash2, Map, Database, Lightbulb, BookOpen,
    XCircle, Search, ShieldCheck, AlertCircle, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardShell from '@/components/DashboardShell';

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

interface ZombieIndex {
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
    high: { bg: '#fef2f2', text: '#dc2626', label: 'HIGH' },
    medium: { bg: '#fff7ed', text: '#ea580c', label: 'MEDIUM' },
    low: { bg: '#f0fdf4', text: '#16a34a', label: 'LOW' },
};

const STATUS_COLOR: Record<string, string> = {
    critical: '#ef4444',
    warning: '#f59e0b',
    healthy: '#22c55e',
};

// ── Tab header ───────────────────────────────────────────────────────────────

const TABS = [
    { id: 'map', label: 'Bottleneck Map', icon: Map },
    { id: 'zombies', label: 'Zombie Indexes', icon: Trash2 },
    { id: 'recs', label: 'SQL Recommendations', icon: Lightbulb },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function PerformancePage() {
    const router = useRouter();
    const [connectionString, setConnectionString] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'map' | 'zombies' | 'recs'>('map');
    const [withAI, setWithAI] = useState(false);

    // data
    const [bottleneckMap, setBottleneckMap] = useState<BottleneckColumn[]>([]);
    const [zombies, setZombies] = useState<ZombieIndex[]>([]);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

    // table filter for bottleneck map
    const [selectedTable, setSelectedTable] = useState<string>('');

    // simulation state
    const [simulating, setSimulating] = useState<number | null>(null);
    const [simResults, setSimResults] = useState<Record<number, SimResult>>({});

    // education panel
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
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const cs = localStorage.getItem('db_connection_string');
        if (!cs) { router.replace('/dashboard'); return; }
        setConnectionString(cs);
        setMounted(true);
        runAnalysis(cs, false);
    }, []);

    if (!mounted) return null;

    // ── API calls ────────────────────────────────────────────────────────────


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

    // ── Derived ──────────────────────────────────────────────────────────────
    const tableNames = [...new Set(bottleneckMap.map(c => c.table_name))];
    const filteredCols = selectedTable
        ? bottleneckMap.filter(c => c.table_name === selectedTable)
        : bottleneckMap;
    const criticalCount = bottleneckMap.filter(c => c.status === 'critical').length;
    const zombieSize = zombies.reduce((sum, z) => sum + (z.size_bytes || 0), 0);
    const zombieSizeMB = (zombieSize / 1024 / 1024).toFixed(1);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <DashboardShell>
            <div className="flex flex-col h-full w-full max-w-[1400px] mx-auto pb-10">

            {/* ── Top bar ── */}
            <div className="flex items-center justify-between p-6 px-4 md:px-8 bg-transparent border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <h1 className="m-0 text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Zap size={22} className="text-amber-500" /> Predictive Indexing
                    </h1>
                    <button onClick={() => router.push('/dashboard/data')} className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold cursor-pointer hover:bg-emerald-100 transition-colors shadow-sm">
                        <Database size={14} /> View Data
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowLearn(v => !v)} className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 cursor-pointer text-indigo-700 text-xs flex items-center gap-1.5 hover:bg-indigo-100 transition-colors shadow-sm">
                        <BookOpen size={14} /> How Indexing Works
                    </button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, color: '#4b5563', fontWeight: 500 }}>
                        <input type="checkbox" checked={withAI} onChange={e => setWithAI(e.target.checked)} className="accent-violet-600" />
                        AI insights
                    </label>
                    <Button size="sm" disabled={!connectionString || loading}
                        onClick={() => connectionString && runAnalysis(connectionString, withAI)}
                        className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm font-semibold">
                        {loading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Zap size={14} className="mr-1.5" />}
                        {loading ? 'Scanning…' : 'Re-scan'}
                    </Button>
                </div>
            </div>

            {/* ── Learn panel ──────────────────────────────────────────────── */}
            {showLearn && (
                <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '24px 28px' }}>
                    <div style={{ maxWidth: 860, margin: '0 auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <BookOpen size={18} /> Why Indexing Matters
                            </h2>
                            <button onClick={() => setShowLearn(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }} className="hover:text-gray-900 transition-colors"><XCircle size={18} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 13, lineHeight: 1.6 }}>
                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                                <p style={{ color: '#d97706', fontWeight: 700, margin: '0 0 8px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen size={14}/> The Library Analogy</p>
                                <p style={{ color: '#475569', margin: 0 }}><strong style={{ color: '#1e293b' }}>Without index:</strong> Read every page to find "Deep Learning". In databases = Full Table Scan across every row.</p>
                                <p style={{ color: '#475569', margin: '8px 0 0' }}><strong style={{ color: '#1e293b' }}>With index:</strong> Flip to the back, find page 452, jump there. Turns O(n) into O(log n).</p>
                            </div>
                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                                <p style={{ color: '#2563eb', fontWeight: 700, margin: '0 0 8px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>⚖️ Space vs Speed Trade-off</p>
                                <p style={{ color: '#475569', margin: 0 }}>Indexes <strong style={{ color: '#1e293b' }}>take up storage</strong> and slow down INSERT/UPDATE (the index must also be updated).</p>
                                <p style={{ color: '#475569', margin: '8px 0 0' }}><strong style={{ color: '#dc2626' }}>Zombie indexes</strong> — unused for 30+ days — waste space with zero benefit. Drop them.</p>
                            </div>
                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                                <p style={{ color: '#16a34a', fontWeight: 700, margin: '0 0 8px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>🔄 Index Lifecycle</p>
                                <ul style={{ color: '#475569', margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <li><strong style={{ color: '#1e293b' }}>Identify</strong> — Bottleneck Map shows hot unindexed columns</li>
                                    <li><strong style={{ color: '#1e293b' }}>Create</strong> — AI generates the exact SQL</li>
                                    <li><strong style={{ color: '#1e293b' }}>Simulate</strong> — Test on shadow DB before production</li>
                                    <li><strong style={{ color: '#1e293b' }}>Clean up</strong> — Remove zombie indexes</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Summary bar ── */}
            {!loading && (
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    {[
                        { label: 'Critical Columns', value: criticalCount, color: '#dc2626', sub: 'unindexed + high traffic' },
                        { label: 'Zombie Indexes', value: zombies.length, color: '#d97706', sub: `${zombieSizeMB} MB wasted` },
                        { label: 'Recommendations', value: recommendations.length, color: '#7c3aed', sub: 'CREATE INDEX suggestions' },
                        { label: 'Tables Scanned', value: tableNames.length, color: '#2563eb', sub: 'in public schema' },
                    ].map(s => (
                        <div key={s.label} style={{ flex: 1, padding: '16px 24px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
                            <p style={{ margin: '6px 0 2px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{s.label}</p>
                            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{s.sub}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Tab bar ── */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', background: '#ffffff', padding: '0 28px' }}>
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', color: active ? '#6d28d9' : '#64748b', fontWeight: active ? 700 : 500, fontSize: 14, borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent', transition: 'all 0.15s' }}
                            className="hover:text-gray-900 hover:bg-gray-50/50"
                        >
                            <Icon size={16} /> {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Content ── */}
            <div className="px-4 md:px-8 pt-6">

                {loading ? (
                    <div style={{ textAlign: 'center', marginTop: 80 }}>
                        <Loader2 size={36} style={{ color: '#7c3aed', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                        <p style={{ color: '#64748b', marginTop: 16, fontSize: 15, fontWeight: 500 }}>Scanning schema for index patterns…</p>
                    </div>
                ) : (
                    <>
                        {/* ─── Tab A: Bottleneck Map ─── */}
                        {activeTab === 'map' && (
                            <div>
                                <p style={{ color: '#475569', fontSize: 14, marginBottom: 20 }}>
                                    Columns highlighted in <span style={{ color: '#dc2626', fontWeight: 700 }}>red</span> are frequently scanned without an index — potential bottlenecks. <span style={{ color: '#d97706', fontWeight: 700 }}>Amber</span> = moderate risk. <span style={{ color: '#16a34a', fontWeight: 700 }}>Green</span> = healthy.
                                </p>

                                {/* Table selector */}
                                {tableNames.length > 1 && (
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                                        {tableNames.map(t => (
                                            <button key={t} onClick={() => setSelectedTable(t)}
                                                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid', borderColor: selectedTable === t ? '#7c3aed' : '#e2e8f0', background: selectedTable === t ? '#f5f3ff' : '#ffffff', color: selectedTable === t ? '#6d28d9' : '#475569', cursor: 'pointer', fontSize: 13, fontWeight: selectedTable === t ? 600 : 500, boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                                                className="hover:border-violet-400 transition-colors">
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {filteredCols.length === 0 ? (
                                    <div style={{ textAlign: 'center', marginTop: 60, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 40, borderRadius: 16 }}>
                                        <CheckCircle size={48} style={{ color: '#22c55e', margin: '0 auto 16px' }} />
                                        <p style={{ color: '#166534', fontSize: 16, fontWeight: 600, margin: 0 }}>No bottleneck columns detected.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                        {filteredCols.map((col, i) => (
                                            <div key={i} className={`bg-white relative overflow-hidden rounded-xl p-5 border shadow-sm hover:shadow-md transition-shadow`} style={{ borderColor: STATUS_COLOR[col.status] === '#ef4444' ? '#fecaca' : STATUS_COLOR[col.status] === '#f59e0b' ? '#fde68a' : '#bbf7d0' }}>
                                                {/* status accent bar */}
                                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: STATUS_COLOR[col.status] }} />
                                                <div className="flex items-center gap-3 mb-3">
                                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[col.status], flexShrink: 0 }} />
                                                    <span className="font-bold text-sm text-gray-900">{col.column_name}</span>
                                                    {col.is_indexed && (
                                                        <span className="ml-auto text-[10px] text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">indexed</span>
                                                    )}
                                                </div>
                                                <p className="m-0 text-xs text-gray-500 font-mono bg-gray-50 p-1.5 rounded border border-gray-100 inline-block">{col.data_type}</p>
                                                <div className="flex gap-4 mt-4 py-3 border-t border-b border-gray-100 text-xs text-gray-600 font-medium">
                                                    <span className="flex items-center gap-1.5"><Search size={14} className="text-gray-400"/> {col.seq_scan_count} scans</span>
                                                    <span className="flex items-center gap-1.5"><Database size={14} className="text-gray-400"/> {col.row_count.toLocaleString()} rows</span>
                                                </div>
                                                {col.status !== 'healthy' && (
                                                    <div className="mt-4 flex items-start gap-2">
                                                        <AlertCircle size={14} style={{ color: STATUS_COLOR[col.status], flexShrink: 0, marginTop: 2 }} />
                                                        <p style={{ color: STATUS_COLOR[col.status] === '#ef4444' ? '#991b1b' : '#92400e', margin: 0 }} className="text-xs leading-relaxed font-medium">{col.suggestion}</p>
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
                                <p style={{ color: '#475569', fontSize: 14, marginBottom: 20 }}>
                                    These indexes have <strong style={{ color: '#dc2626' }}>0 scans</strong> — they have never been used to answer a query. Each one wastes storage and slows down every INSERT/UPDATE on its table.
                                </p>
                                {zombies.length === 0 ? (
                                    <div style={{ textAlign: 'center', marginTop: 60, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 40, borderRadius: 16 }}>
                                        <CheckCircle size={48} style={{ color: '#22c55e', margin: '0 auto 16px' }} />
                                        <p style={{ color: '#166534', fontSize: 16, fontWeight: 600, margin: 0 }}>No zombie indexes found — your schema is lean!</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {/* Aggregate saving banner */}
                                        <div style={{ display: 'flex', gap: 16, padding: '16px 20px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, alignItems: 'center', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                                            <Trash2 size={24} style={{ color: '#d97706', flexShrink: 0 }} />
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 700, color: '#92400e', fontSize: 15 }}>Drop all {zombies.length} zombie indexes to reclaim {zombieSizeMB} MB</p>
                                                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#b45309' }}>Each dropped index also speeds up write operations (INSERT / UPDATE) on its table.</p>
                                            </div>
                                        </div>

                                        {zombies.map((z, i) => (
                                            <div key={i} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                                                            <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{z.index_name}</span>
                                                            <span style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', padding: '2px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>on {z.table_name}</span>
                                                        </div>
                                                        <code style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', display: 'block', marginBottom: 12, background: '#f1f5f9', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>{z.index_def}</code>
                                                        <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.6, display: 'flex', gap: 6 }}>
                                                            <Info size={16} /> {z.saving_note}
                                                        </p>
                                                    </div>
                                                    <div style={{ textAlign: 'right', flexShrink: 0, background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                                        <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#d97706' }}>{z.size_human}</p>
                                                        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>wasted</p>
                                                    </div>
                                                </div>
                                                <div style={{ marginTop: 20, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <code style={{ fontSize: 13, color: '#991b1b', fontFamily: 'monospace', fontWeight: 600 }}>{z.drop_sql}</code>
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(z.drop_sql)}
                                                        className="hover:bg-red-100 transition-colors"
                                                        style={{ background: 'white', border: '1px solid #fca5a5', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0, padding: '6px 12px', borderRadius: 6, boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                                                        Copy SQL
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ─── Tab C: SQL Recommendations ─── */}
                        {activeTab === 'recs' && (
                            <div>
                                <p style={{ color: '#475569', fontSize: 14, marginBottom: 20 }}>
                                    Ranked by estimated impact. Click <strong style={{ color: '#6d28d9' }}>Simulate on Shadow DB</strong> to measure before/after query time without touching production.
                                </p>
                                {recommendations.length === 0 ? (
                                    <div style={{ textAlign: 'center', marginTop: 60, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 40, borderRadius: 16 }}>
                                        <CheckCircle size={48} style={{ color: '#22c55e', margin: '0 auto 16px' }} />
                                        <p style={{ color: '#166534', fontSize: 16, fontWeight: 600, margin: 0 }}>No missing indexes detected.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {recommendations.map((rec, idx) => {
                                            const risk = RISK[rec.risk_level] ?? RISK.low;
                                            const sim = simResults[idx];
                                            return (
                                                <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>
                                                    {/* Header */}
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                                                                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: risk.bg, color: risk.text, border: `1px solid ${risk.text}30` }}>{risk.label}</span>
                                                                <span style={{ color: '#6d28d9', fontWeight: 700, fontSize: 16 }}>{rec.table_name}.{rec.column_names.join(', ')}</span>
                                                                {rec.query_frequency_pct > 0 && (
                                                                    <span style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', padding: '2px 8px', borderRadius: 6, border: '1px solid #fde68a' }}>~{rec.query_frequency_pct.toFixed(0)}% of queries affected</span>
                                                                )}
                                                            </div>
                                                            <p style={{ color: '#475569', fontSize: 14, margin: 0, lineHeight: 1.6 }}>{rec.ai_explanation}</p>
                                                        </div>
                                                        {/* Impact score */}
                                                        <div style={{ width: 80, textAlign: 'center', flexShrink: 0, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 8px' }}>
                                                            <p style={{ fontSize: 32, fontWeight: 800, color: rec.impact_score > 60 ? '#dc2626' : rec.impact_score > 30 ? '#d97706' : '#16a34a', margin: 0, lineHeight: 1 }}>{rec.impact_score}</p>
                                                            <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>impact</p>
                                                        </div>
                                                    </div>

                                                    {/* Impact bar */}
                                                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, marginBottom: 20, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${rec.impact_score}%`, background: rec.impact_score > 60 ? '#ef4444' : rec.impact_score > 30 ? '#f59e0b' : '#22c55e', borderRadius: 99, transition: 'width 0.6s ease' }} />
                                                    </div>

                                                    {/* Generated SQL */}
                                                    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                                        <code style={{ font: '13px/1.6 monospace', color: '#0f172a', wordBreak: 'break-all', flex: 1, fontWeight: 500 }}>
                                                            <span style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>-- Generated by DB-Lighthouse AI</span>
                                                            {rec.index_sql}
                                                        </code>
                                                        <button 
                                                            onClick={() => navigator.clipboard.writeText(rec.index_sql)} 
                                                            className="hover:bg-white hover:shadow-sm transition-all"
                                                            style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0, padding: '6px 12px', borderRadius: 6 }}>
                                                            Copy
                                                        </button>
                                                    </div>

                                                    {/* Simulation result */}
                                                    {sim && (
                                                        <div style={{ display: 'flex', gap: 20, marginBottom: 16, padding: '16px 20px', background: '#f0f9ff', borderRadius: 10, border: '1px solid #bae6fd' }}>
                                                            <div>
                                                                <p style={{ fontSize: 12, color: '#0369a1', margin: 0, fontWeight: 600 }}>Before</p>
                                                                <p style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', margin: '4px 0 0' }}>{sim.before_ms} <span style={{fontSize: 14, fontWeight: 600}}>ms</span></p>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', color: '#0284c7' }}><TrendingUp size={24} /></div>
                                                            <div>
                                                                <p style={{ fontSize: 12, color: '#0369a1', margin: 0, fontWeight: 600 }}>After</p>
                                                                <p style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', margin: '4px 0 0' }}>{sim.after_ms} <span style={{fontSize: 14, fontWeight: 600}}>ms</span></p>
                                                            </div>
                                                            {sim.improvement_pct > 0 && (
                                                                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                                                    <p style={{ fontSize: 12, color: '#0369a1', margin: 0, fontWeight: 600 }}>Improvement</p>
                                                                    <p style={{ fontSize: 24, fontWeight: 900, color: '#16a34a', margin: '2px 0 0' }}>↓ {sim.improvement_pct}%</p>
                                                                </div>
                                                            )}
                                                            {sim.error && <p style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, background: '#fef2f2', padding: '8px 12px', borderRadius: 6 }}>Error: {sim.error}</p>}
                                                        </div>
                                                    )}

                                                    <Button size="sm" disabled={simulating === idx}
                                                        onClick={() => handleSimulate(rec, idx)}
                                                        className="bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 font-semibold shadow-sm w-full md:w-auto mt-2"
                                                        style={{ fontSize: 13, padding: '18px 24px' }}>
                                                        {simulating === idx
                                                            ? <><Loader2 size={16} className="mr-2 animate-spin" /> Simulating on Shadow DB…</>
                                                            : <><Zap size={16} className="mr-2" /> Simulate on Shadow DB</>}
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
