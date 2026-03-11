'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2, Zap, ArrowLeft, CheckCircle, AlertTriangle,
    TrendingUp, Trash2, Map, Database, Lightbulb, BookOpen,
    XCircle, Search, ShieldCheck, AlertCircle, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    high: { bg: '#450a0a', text: '#fca5a5', label: 'HIGH' },
    medium: { bg: '#422006', text: '#fdba74', label: 'MEDIUM' },
    low: { bg: '#052e16', text: '#86efac', label: 'LOW' },
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
        <div style={{ minHeight: '100vh', background: '#08080f', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>

            {/* ── Top bar ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', borderBottom: '1px solid #1e1e2e', background: '#0f0f1a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ArrowLeft size={15} /> Dashboard
                    </button>
                    <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Zap size={19} style={{ color: '#f59e0b' }} /> Predictive Indexing
                    </h1>
                    <button onClick={() => router.push('/dashboard/data')} style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 6, cursor: 'pointer', color: '#34d399', fontSize: 11, fontWeight: 600 }}>
                        <Database size={12} /> View Data
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => setShowLearn(v => !v)} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', color: '#818cf8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <BookOpen size={12} /> How Indexing Works
                    </button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
                        <input type="checkbox" checked={withAI} onChange={e => setWithAI(e.target.checked)} style={{ accentColor: '#7c3aed' }} />
                        AI insights
                    </label>
                    <Button size="sm" disabled={!connectionString || loading}
                        onClick={() => connectionString && runAnalysis(connectionString, withAI)}
                        style={{ background: '#7c3aed', color: 'white', fontSize: 12 }}>
                        {loading ? <Loader2 size={13} className="animate-spin mr-1" /> : <Zap size={13} className="mr-1" />}
                        {loading ? 'Scanning…' : 'Re-scan'}
                    </Button>
                </div>
            </div>

            {/* ── Learn panel ──────────────────────────────────────────────── */}
            {showLearn && (
                <div style={{ background: '#0a0a1a', borderBottom: '1px solid #1e1e2e', padding: '20px 28px' }}>
                    <div style={{ maxWidth: 860, margin: '0 auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#a78bfa' }}>📚 Why Indexing Matters</h2>
                            <button onClick={() => setShowLearn(false)} style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer' }}><XCircle size={16} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, fontSize: 13, lineHeight: 1.6 }}>
                            <div style={{ background: '#0f0f1a', border: '1px solid #2e2e4e', borderRadius: 10, padding: '14px 16px' }}>
                                <p style={{ color: '#f59e0b', fontWeight: 700, margin: '0 0 6px', fontSize: 13 }}>📖 The Library Analogy</p>
                                <p style={{ color: '#9ca3af', margin: 0 }}><strong style={{ color: '#e2e8f0' }}>Without index:</strong> Read every page to find "Deep Learning". In databases = Full Table Scan across every row.</p>
                                <p style={{ color: '#9ca3af', margin: '8px 0 0' }}><strong style={{ color: '#e2e8f0' }}>With index:</strong> Flip to the back, find page 452, jump there. Turns O(n) into O(log n).</p>
                            </div>
                            <div style={{ background: '#0f0f1a', border: '1px solid #2e2e4e', borderRadius: 10, padding: '14px 16px' }}>
                                <p style={{ color: '#60a5fa', fontWeight: 700, margin: '0 0 6px', fontSize: 13 }}>⚖️ Space vs Speed Trade-off</p>
                                <p style={{ color: '#9ca3af', margin: 0 }}>Indexes <strong style={{ color: '#e2e8f0' }}>take up storage</strong> and slow down INSERT/UPDATE (the index must also be updated).</p>
                                <p style={{ color: '#9ca3af', margin: '8px 0 0' }}><strong style={{ color: '#ef4444' }}>Zombie indexes</strong> — unused for 30+ days — waste space with zero benefit. Drop them.</p>
                            </div>
                            <div style={{ background: '#0f0f1a', border: '1px solid #2e2e4e', borderRadius: 10, padding: '14px 16px' }}>
                                <p style={{ color: '#4ade80', fontWeight: 700, margin: '0 0 6px', fontSize: 13 }}>🔄 Index Lifecycle</p>
                                <ul style={{ color: '#9ca3af', margin: 0, paddingLeft: 16 }}>
                                    <li><strong style={{ color: '#e2e8f0' }}>Identify</strong> — Bottleneck Map shows hot unindexed columns</li>
                                    <li><strong style={{ color: '#e2e8f0' }}>Create</strong> — AI generates the exact SQL</li>
                                    <li><strong style={{ color: '#e2e8f0' }}>Simulate</strong> — Test on shadow DB before production</li>
                                    <li><strong style={{ color: '#e2e8f0' }}>Clean up</strong> — Remove zombie indexes</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Summary bar ── */}
            {!loading && (
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1e1e2e', background: '#0a0a14' }}>
                    {[
                        { label: 'Critical Columns', value: criticalCount, color: '#ef4444', sub: 'unindexed + high traffic' },
                        { label: 'Zombie Indexes', value: zombies.length, color: '#f59e0b', sub: `${zombieSizeMB} MB wasted` },
                        { label: 'Recommendations', value: recommendations.length, color: '#a78bfa', sub: 'CREATE INDEX suggestions' },
                        { label: 'Tables Scanned', value: tableNames.length, color: '#60a5fa', sub: 'in public schema' },
                    ].map(s => (
                        <div key={s.label} style={{ flex: 1, padding: '14px 20px', borderRight: '1px solid #1e1e2e', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
                            <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 600, color: '#d1d5db' }}>{s.label}</p>
                            <p style={{ margin: 0, fontSize: 10, color: '#4b5563' }}>{s.sub}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Tab bar ── */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1e1e2e', background: '#0f0f1a', padding: '0 28px' }}>
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer', color: active ? '#a78bfa' : '#4b5563', fontWeight: active ? 700 : 400, fontSize: 13, borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent', transition: 'all 0.15s' }}>
                            <Icon size={13} /> {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Content ── */}
            <div style={{ padding: '28px', maxWidth: 1000, margin: '0 auto' }}>

                {loading ? (
                    <div style={{ textAlign: 'center', marginTop: 80 }}>
                        <Loader2 size={32} style={{ color: '#7c3aed', animation: 'spin 1s linear infinite' }} />
                        <p style={{ color: '#6b7280', marginTop: 12 }}>Scanning schema for index patterns…</p>
                    </div>
                ) : (
                    <>
                        {/* ─── Tab A: Bottleneck Map ─── */}
                        {activeTab === 'map' && (
                            <div>
                                <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 18 }}>
                                    Columns highlighted in <span style={{ color: '#ef4444', fontWeight: 700 }}>red</span> are frequently scanned without an index — potential bottlenecks. <span style={{ color: '#f59e0b', fontWeight: 700 }}>Amber</span> = moderate risk. <span style={{ color: '#22c55e', fontWeight: 700 }}>Green</span> = healthy.
                                </p>

                                {/* Table selector */}
                                {tableNames.length > 1 && (
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                                        {tableNames.map(t => (
                                            <button key={t} onClick={() => setSelectedTable(t)}
                                                style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid', borderColor: selectedTable === t ? '#7c3aed' : '#2e2e4e', background: selectedTable === t ? 'rgba(124,58,237,0.15)' : 'transparent', color: selectedTable === t ? '#a78bfa' : '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: selectedTable === t ? 700 : 400 }}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {filteredCols.length === 0 ? (
                                    <div style={{ textAlign: 'center', marginTop: 60 }}>
                                        <CheckCircle size={36} style={{ color: '#22c55e', margin: '0 auto 10px' }} />
                                        <p style={{ color: '#86efac' }}>No bottleneck columns detected.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                                        {filteredCols.map((col, i) => (
                                            <div key={i} style={{ background: '#0f0f1a', border: `1px solid ${STATUS_COLOR[col.status]}40`, borderRadius: 10, padding: 14, position: 'relative', overflow: 'hidden' }}>
                                                {/* status accent bar */}
                                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: STATUS_COLOR[col.status] }} />
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[col.status], flexShrink: 0, boxShadow: `0 0 6px ${STATUS_COLOR[col.status]}` }} />
                                                    <span style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0' }}>{col.column_name}</span>
                                                    {col.is_indexed && (
                                                        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4ade80', background: '#052e16', padding: '1px 6px', borderRadius: 4 }}>indexed</span>
                                                    )}
                                                </div>
                                                <p style={{ margin: 0, fontSize: 11, color: '#4b5563', fontFamily: 'monospace' }}>{col.data_type}</p>
                                                <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                                                    <span>🔍 {col.seq_scan_count} scans</span>
                                                    <span>📦 {col.row_count.toLocaleString()} rows</span>
                                                </div>
                                                {col.status !== 'healthy' && (
                                                    <p style={{ margin: '8px 0 0', fontSize: 11, color: STATUS_COLOR[col.status], lineHeight: 1.4 }}>{col.suggestion}</p>
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
                                <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 18 }}>
                                    These indexes have <strong style={{ color: '#f87171' }}>0 scans</strong> — they have never been used to answer a query. Each one wastes storage and slows down every INSERT/UPDATE on its table.
                                </p>
                                {zombies.length === 0 ? (
                                    <div style={{ textAlign: 'center', marginTop: 60 }}>
                                        <CheckCircle size={36} style={{ color: '#22c55e', margin: '0 auto 10px' }} />
                                        <p style={{ color: '#86efac' }}>No zombie indexes found — your schema is lean!</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {/* Aggregate saving banner */}
                                        <div style={{ display: 'flex', gap: 16, padding: '14px 18px', background: '#1a0f00', border: '1px solid #92400e', borderRadius: 10, alignItems: 'center' }}>
                                            <Trash2 size={22} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 700, color: '#fbbf24' }}>Drop all {zombies.length} zombie indexes to reclaim {zombieSizeMB} MB</p>
                                                <p style={{ margin: 0, fontSize: 12, color: '#92400e' }}>Each dropped index also speeds up write operations (INSERT / UPDATE) on its table.</p>
                                            </div>
                                        </div>

                                        {zombies.map((z, i) => (
                                            <div key={i} style={{ background: '#0f0f1a', border: '1px solid #2e2e4e', borderRadius: 10, padding: '16px 18px' }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                                            <span style={{ fontWeight: 700, fontSize: 14, color: '#fbbf24' }}>{z.index_name}</span>
                                                            <span style={{ fontSize: 11, color: '#6b7280' }}>on {z.table_name}</span>
                                                        </div>
                                                        <code style={{ fontSize: 11, color: '#6ee7b7', fontFamily: 'monospace', display: 'block', marginBottom: 8 }}>{z.index_def}</code>
                                                        <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>{z.saving_note}</p>
                                                    </div>
                                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                        <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>{z.size_human}</p>
                                                        <p style={{ margin: 0, fontSize: 10, color: '#4b5563', textTransform: 'uppercase' }}>wasted</p>
                                                    </div>
                                                </div>
                                                <div style={{ marginTop: 12, background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <code style={{ fontSize: 12, color: '#f87171', fontFamily: 'monospace' }}>{z.drop_sql}</code>
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(z.drop_sql)}
                                                        style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>
                                                        Copy
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
                                <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 18 }}>
                                    Ranked by estimated impact. Click <strong style={{ color: '#a78bfa' }}>Simulate on Shadow DB</strong> to measure before/after query time without touching production.
                                </p>
                                {recommendations.length === 0 ? (
                                    <div style={{ textAlign: 'center', marginTop: 60 }}>
                                        <CheckCircle size={36} style={{ color: '#22c55e', margin: '0 auto 10px' }} />
                                        <p style={{ color: '#86efac' }}>No missing indexes detected.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {recommendations.map((rec, idx) => {
                                            const risk = RISK[rec.risk_level] ?? RISK.low;
                                            const sim = simResults[idx];
                                            return (
                                                <div key={idx} style={{ background: '#0f0f1a', border: '1px solid #2e2e4e', borderRadius: 12, padding: 20 }}>
                                                    {/* Header */}
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: risk.bg, color: risk.text }}>{risk.label}</span>
                                                                <span style={{ color: '#7c3aed', fontWeight: 600, fontSize: 13 }}>{rec.table_name}.{rec.column_names.join(', ')}</span>
                                                                {rec.query_frequency_pct > 0 && (
                                                                    <span style={{ fontSize: 11, color: '#f59e0b', marginLeft: 8 }}>~{rec.query_frequency_pct.toFixed(0)}% of queries affected</span>
                                                                )}
                                                            </div>
                                                            <p style={{ color: '#94a3b8', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{rec.ai_explanation}</p>
                                                        </div>
                                                        {/* Impact score */}
                                                        <div style={{ width: 58, textAlign: 'center', flexShrink: 0 }}>
                                                            <p style={{ fontSize: 22, fontWeight: 800, color: rec.impact_score > 60 ? '#f87171' : rec.impact_score > 30 ? '#fdba74' : '#86efac', margin: 0, lineHeight: 1 }}>{rec.impact_score}</p>
                                                            <p style={{ fontSize: 10, color: '#4b5563', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>impact</p>
                                                        </div>
                                                    </div>

                                                    {/* Impact bar */}
                                                    <div style={{ height: 4, background: '#1e1e2e', borderRadius: 99, marginBottom: 12, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${rec.impact_score}%`, background: rec.impact_score > 60 ? '#ef4444' : rec.impact_score > 30 ? '#f59e0b' : '#22c55e', borderRadius: 99, transition: 'width 0.6s ease' }} />
                                                    </div>

                                                    {/* Generated SQL */}
                                                    <div style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 6, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                        <code style={{ font: '11px/1.5 monospace', color: '#6ee7b7', wordBreak: 'break-all', flex: 1 }}>
                                                            {`-- Generated by DB-Lighthouse AI\n${rec.index_sql}`}
                                                        </code>
                                                        <button onClick={() => navigator.clipboard.writeText(rec.index_sql)} style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>Copy</button>
                                                    </div>

                                                    {/* Simulation result */}
                                                    {sim && (
                                                        <div style={{ display: 'flex', gap: 16, marginBottom: 12, padding: '10px 14px', background: '#0a1628', borderRadius: 8, border: '1px solid #1e3a5f' }}>
                                                            <div>
                                                                <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>Before</p>
                                                                <p style={{ fontSize: 16, fontWeight: 700, color: '#f87171', margin: 0 }}>{sim.before_ms} ms</p>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', color: '#3b82f6' }}><TrendingUp size={18} /></div>
                                                            <div>
                                                                <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>After</p>
                                                                <p style={{ fontSize: 16, fontWeight: 700, color: '#4ade80', margin: 0 }}>{sim.after_ms} ms</p>
                                                            </div>
                                                            {sim.improvement_pct > 0 && (
                                                                <div style={{ marginLeft: 'auto' }}>
                                                                    <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>Improvement</p>
                                                                    <p style={{ fontSize: 18, fontWeight: 800, color: '#4ade80', margin: 0 }}>↓ {sim.improvement_pct}%</p>
                                                                </div>
                                                            )}
                                                            {sim.error && <p style={{ color: '#f87171', fontSize: 12 }}>{sim.error}</p>}
                                                        </div>
                                                    )}

                                                    <Button size="sm" variant="outline" disabled={simulating === idx}
                                                        onClick={() => handleSimulate(rec, idx)}
                                                        style={{ borderColor: '#2e2e4e', color: '#a78bfa', fontSize: 12 }}>
                                                        {simulating === idx
                                                            ? <><Loader2 size={12} className="mr-1 animate-spin" /> Simulating…</>
                                                            : <><Zap size={12} className="mr-1" /> Simulate on Shadow DB</>}
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
    );
}
