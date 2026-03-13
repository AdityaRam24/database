'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2, ShieldCheck, ShieldAlert, AlertTriangle,
    ArrowLeft, GitMerge, CheckCircle, XCircle, Shield,
    Database, Wand2, Clock, ChevronDown, ChevronRight, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardShell from '@/components/DashboardShell';

interface SafetyResult {
    is_safe: boolean;
    blocked_reason: string | null;
    warning_message: string;
    broken_queries: number;
    dependent_indexes: number;
    dependent_views: number;
    dependent_functions: number;
    warnings: string[];
    dependency_breakdown: {
        foreign_keys: string[];
        indexes: string[];
        views: string[];
        functions: string[];
    };
    parsed: { table: string | null; column: string | null; operation: string };
}

interface HistoryItem {
    sql: string;
    timestamp: string;
    success: boolean;
}

const EXAMPLE_PATCHES = [
    { category: 'Safe', items: [
        { label: 'Add column', sql: 'ALTER TABLE users ADD COLUMN last_login TIMESTAMP;' },
        { label: 'Create index', sql: 'CREATE INDEX idx_orders_user_id ON orders (user_id);' },
        { label: 'Add constraint', sql: 'ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id);' },
    ]},
    { category: 'Risky', items: [
        { label: 'Drop column', sql: 'ALTER TABLE users DROP COLUMN email;' },
        { label: 'Rename table', sql: 'ALTER TABLE users RENAME TO app_users;' },
    ]},
    { category: 'Blocked', items: [
        { label: 'Truncate', sql: 'TRUNCATE TABLE orders;' },
        { label: 'Drop DB', sql: 'DROP DATABASE mydb;' },
    ]},
];

export default function GovernancePage() {
    const router = useRouter();
    const [connectionString, setConnectionString] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [sqlPatch, setSqlPatch] = useState('');
    const [nlDescription, setNlDescription] = useState('');
    const [generatingPatch, setGeneratingPatch] = useState(false);
    const [checking, setChecking] = useState(false);
    const [applying, setApplying] = useState(false);
    const [result, setResult] = useState<SafetyResult | null>(null);
    const [applySuccess, setApplySuccess] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showExamples, setShowExamples] = useState(false);

    useEffect(() => {
        const cs = localStorage.getItem('db_connection_string');
        if (!cs) { router.replace('/dashboard'); return; }
        setConnectionString(cs);
        const saved = localStorage.getItem('governance_history');
        if (saved) setHistory(JSON.parse(saved));
        setMounted(true);
    }, []);

    const saveHistory = (item: HistoryItem) => {
        setHistory(prev => {
            const next = [item, ...prev].slice(0, 20);
            localStorage.setItem('governance_history', JSON.stringify(next));
            return next;
        });
    };

    const handleGeneratePatch = async () => {
        if (!nlDescription.trim() || !connectionString) return;
        setGeneratingPatch(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/governance/ai-generate-patch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, description: nlDescription }),
            });
            const data = await res.json();
            if (data.sql) {
                setSqlPatch(data.sql);
                setResult(null);
                setApplySuccess(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setGeneratingPatch(false);
        }
    };

    const handleCheck = async () => {
        if (!connectionString || !sqlPatch.trim()) return;
        setChecking(true);
        setResult(null);
        setApplySuccess(false);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/governance/simulate-migration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, sql_patch: sqlPatch }),
            });
            const data = await res.json();
            setResult(data);
            setShowModal(true);
        } catch (e) {
            console.error(e);
        } finally {
            setChecking(false);
        }
    };

    const handleApply = async () => {
        if (!connectionString || !result?.is_safe) return;
        setApplying(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/governance/apply-patch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, sql_patch: sqlPatch }),
            });
            if (res.ok) {
                setApplySuccess(true);
                setShowModal(false);
                saveHistory({ sql: sqlPatch, timestamp: new Date().toLocaleString(), success: true });
                setSqlPatch('');
                setResult(null);
            } else {
                const err = await res.json();
                saveHistory({ sql: sqlPatch, timestamp: new Date().toLocaleString(), success: false });
                alert(err.detail?.message || err.detail || 'Failed to apply patch');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setApplying(false);
        }
    };

    if (!mounted) return null;

    return (
        <DashboardShell>
            {/* Top bar */}
            <div className="flex items-center justify-between p-6 px-4 md:px-8 bg-transparent">
                <div className="flex items-center gap-4">
                    <h1 className="m-0 text-xl font-bold text-slate-100 flex items-center gap-2">
                        <GitMerge size={22} className="text-blue-500" /> Migration Safety Center
                    </h1>
                    <button onClick={() => router.push('/dashboard/data')} className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold cursor-pointer hover:bg-emerald-500/20 transition-colors">
                        <Database size={14} /> View Data
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowHistory(h => !h)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold cursor-pointer hover:bg-amber-500/20 transition-colors"
                    >
                        <Clock size={14} /> History {history.length > 0 && `(${history.length})`}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 flex-col lg:flex-row w-full max-w-[1400px] mx-auto pb-10">
                {/* Main content */}
                <div className="flex-1 p-4 md:p-8 max-w-[900px] mx-auto w-full">
                    {/* Success banner */}
                    {applySuccess && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: '#052e16', border: '1px solid #166534', borderRadius: 10, marginBottom: 24 }}>
                            <CheckCircle size={18} style={{ color: '#22c55e' }} />
                            <p style={{ margin: 0, color: '#86efac', fontWeight: 600 }}>Patch applied successfully to the shadow database.</p>
                        </div>
                    )}

                    {/* AI Patch Writer */}
                    <div className="glass glow-border rounded-xl p-5 mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Wand2 size={18} className="text-violet-500" />
                            <h2 className="m-0 text-base font-bold text-violet-300">AI Patch Writer</h2>
                            <span className="text-xs text-slate-400 ml-2">Describe what to change in plain language</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                value={nlDescription}
                                onChange={e => setNlDescription(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleGeneratePatch()}
                                placeholder="e.g. 'add phone_number column to users' or 'create index on orders.created_at'"
                                className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-slate-200 text-sm outline-none focus:border-violet-500/50 transition-colors"
                            />
                            <Button
                                onClick={handleGeneratePatch}
                                disabled={!nlDescription.trim() || generatingPatch}
                                className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-0 min-w-[120px] btn-glow shadow-[0_0_15px_rgba(124,58,237,0.3)]"
                            >
                                {generatingPatch ? <><Loader2 size={14} className="mr-2 animate-spin" /> Generating…</> : <><Wand2 size={14} className="mr-2" /> Generate</>}
                            </Button>
                        </div>
                    </div>

                    {/* Info box */}
                    <div className="glass rounded-lg border border-blue-500/20 p-4 mb-5">
                        <p style={{ margin: 0, fontSize: 12, color: '#60a5fa', lineHeight: 1.6 }}>
                            <strong>How it works:</strong> Paste or generate a SQL patch. The system checks for broken FK constraints, dependent indexes, views, and functions — and blocks unsafe operations like <code style={{ color: '#f87171' }}>DROP DATABASE</code> or <code style={{ color: '#f87171' }}>TRUNCATE</code>. All changes apply only to the shadow DB.
                        </p>
                    </div>

                    {/* SQL Editor */}
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>SQL Patch</label>
                            {sqlPatch && (
                                <button
                                    onClick={() => { setSqlPatch(''); setResult(null); setApplySuccess(false); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}
                                >
                                    <Trash2 size={12} /> Clear
                                </button>
                            )}
                        </div>
                        <textarea
                            value={sqlPatch}
                            onChange={e => { setSqlPatch(e.target.value); setResult(null); setApplySuccess(false); }}
                            placeholder={`ALTER TABLE users ADD COLUMN phone VARCHAR(20);`}
                            rows={7}
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                background: '#0d1117', color: '#6ee7b7',
                                border: '1px solid #2e2e4e', borderRadius: 10,
                                padding: '14px 16px', fontSize: 13,
                                fontFamily: 'monospace', lineHeight: 1.7,
                                resize: 'vertical', outline: 'none', transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.target.style.borderColor = '#3b82f6'}
                            onBlur={e => e.target.style.borderColor = '#2e2e4e'}
                        />
                    </div>

                    {/* Safety result inline preview */}
                    {result && !showModal && (
                        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: result.is_safe ? '#052e16' : '#1a0808', border: `1px solid ${result.is_safe ? '#166534' : '#7f1d1d'}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {result.is_safe ? <ShieldCheck size={16} style={{ color: '#22c55e' }} /> : <ShieldAlert size={16} style={{ color: '#ef4444' }} />}
                                <span style={{ fontSize: 13, fontWeight: 600, color: result.is_safe ? '#86efac' : '#fca5a5' }}>
                                    {result.is_safe ? 'Safe to Apply' : 'Blocked'}: {result.warning_message}
                                </span>
                                <button onClick={() => setShowModal(true)} style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>View Details</button>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                        <Button
                            disabled={!sqlPatch.trim() || checking}
                            onClick={handleCheck}
                            style={{ background: '#1e3a5f', color: '#60a5fa', border: '1px solid #2563eb', fontWeight: 600 }}
                        >
                            {checking ? <><Loader2 size={14} className="mr-2 animate-spin" /> Analysing…</> : <><ShieldCheck size={14} className="mr-2" /> Check Safety</>}
                        </Button>
                        {result?.is_safe && (
                            <Button
                                disabled={applying}
                                onClick={handleApply}
                                style={{ background: '#166534', color: '#86efac', fontWeight: 600 }}
                            >
                                {applying ? <><Loader2 size={14} className="mr-1 animate-spin" /> Applying…</> : <><CheckCircle size={14} className="mr-1" /> Apply to Shadow DB</>}
                            </Button>
                        )}
                    </div>

                    {/* Example patches */}
                    <div style={{ marginTop: 28 }}>
                        <button
                            onClick={() => setShowExamples(s => !s)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}
                        >
                            {showExamples ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Example Patches
                        </button>
                        {showExamples && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {EXAMPLE_PATCHES.map(cat => (
                                    <div key={cat.category}>
                                        <p style={{ fontSize: 11, color: '#374151', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>{cat.category}</p>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                                            {cat.items.map(ex => (
                                                <button
                                                    key={ex.label}
                                                    onClick={() => { setSqlPatch(ex.sql); setResult(null); setShowExamples(false); }}
                                                    style={{ background: '#0f0f1a', border: '1px solid #2e2e4e', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                                                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                                                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e2e4e')}
                                                >
                                                    <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#a78bfa', fontSize: 12 }}>{ex.label}</p>
                                                    <code style={{ fontFamily: 'monospace', fontSize: 10, color: '#4b5563' }}>{ex.sql}</code>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* History sidebar */}
                {showHistory && (
                    <div className="w-full lg:w-80 border-l border-white/5 bg-black/20 p-6 overflow-y-auto glass lg:rounded-l-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>
                                <Clock size={13} className="inline mr-1.5" /> Migration History
                            </h3>
                            {history.length > 0 && (
                                <button
                                    onClick={() => { setHistory([]); localStorage.removeItem('governance_history'); }}
                                    style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 11 }}
                                >
                                    Clear all
                                </button>
                            )}
                        </div>
                        {history.length === 0 ? (
                            <p style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', marginTop: 40 }}>No migrations yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {history.map((item, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSqlPatch(item.sql)}
                                        style={{ textAlign: 'left', background: '#0f0f1a', border: `1px solid ${item.success ? '#166534' : '#7f1d1d'}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                            {item.success ? <CheckCircle size={12} style={{ color: '#22c55e' }} /> : <XCircle size={12} style={{ color: '#ef4444' }} />}
                                            <span style={{ fontSize: 10, color: '#6b7280' }}>{item.timestamp}</span>
                                        </div>
                                        <code style={{ fontSize: 10, color: '#6ee7b7', fontFamily: 'monospace', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.sql}
                                        </code>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Safety Modal */}
            {showModal && result && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
                    <div style={{ background: '#0f0f1a', border: `2px solid ${result.is_safe ? '#166534' : '#991b1b'}`, borderRadius: 18, padding: 32, maxWidth: 540, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            {result.is_safe ? <ShieldCheck size={30} style={{ color: '#22c55e' }} /> : <ShieldAlert size={30} style={{ color: '#ef4444' }} />}
                            <div>
                                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: result.is_safe ? '#86efac' : '#fca5a5' }}>
                                    {result.is_safe ? '✅ Safe to Apply' : '⛔ Migration Blocked'}
                                </h2>
                                {result.parsed.operation !== 'UNKNOWN' && (
                                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                                        {result.parsed.operation}{result.parsed.table && ` on ${result.parsed.table}`}{result.parsed.column && `.${result.parsed.column}`}
                                    </p>
                                )}
                            </div>
                        </div>

                        <p style={{ fontSize: 14, color: '#d1d5db', marginBottom: 20, lineHeight: 1.6 }}>{result.warning_message}</p>

                        {(result.broken_queries > 0 || result.dependent_indexes > 0 || result.dependent_views > 0 || result.dependent_functions > 0) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                                {[
                                    { label: 'FK Constraints', value: result.broken_queries, icon: '🔗' },
                                    { label: 'Indexes', value: result.dependent_indexes, icon: '⚡' },
                                    { label: 'Views', value: result.dependent_views, icon: '👁' },
                                    { label: 'Functions', value: result.dependent_functions, icon: '⚙️' },
                                ].map(dep => (
                                    <div key={dep.label} style={{ background: '#1e1e2e', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 16 }}>{dep.icon}</span>
                                        <div>
                                            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{dep.label}</p>
                                            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: dep.value > 0 ? '#f87171' : '#4ade80' }}>{dep.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {result.warnings.length > 0 && (
                            <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', marginBottom: 20, maxHeight: 130, overflowY: 'auto' }}>
                                {result.warnings.map((w, i) => (
                                    <p key={i} style={{ margin: '0 0 4px', fontSize: 11, color: '#fca5a5', display: 'flex', gap: 6 }}>
                                        <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 2 }} /> {w}
                                    </p>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <Button variant="outline" size="sm" onClick={() => setShowModal(false)} style={{ borderColor: '#2e2e4e', color: '#6b7280' }}>
                                <XCircle size={14} className="mr-1" /> Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={!result.is_safe || applying}
                                onClick={handleApply}
                                style={{ background: result.is_safe ? '#166534' : '#450a0a', color: result.is_safe ? '#86efac' : '#fca5a5', opacity: result.is_safe ? 1 : 0.6 }}
                            >
                                {applying ? <><Loader2 size={14} className="mr-1 animate-spin" /> Applying…</> : result.is_safe ? <><CheckCircle size={14} className="mr-1" /> Apply to Shadow DB</> : '⛔ Blocked'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
}
