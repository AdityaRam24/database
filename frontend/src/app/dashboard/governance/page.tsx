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
            <div className="flex items-center justify-between p-6 px-4 md:px-8 bg-transparent border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <h1 className="m-0 text-xl font-bold text-gray-900 flex items-center gap-2">
                        <GitMerge size={22} className="text-blue-600" /> Migration Safety Center
                    </h1>
                    <button onClick={() => router.push('/dashboard/data')} className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold cursor-pointer hover:bg-emerald-100 transition-colors shadow-sm">
                        <Database size={14} /> View Data
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowHistory(h => !h)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold cursor-pointer hover:bg-amber-100 transition-colors shadow-sm"
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 24, boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                            <CheckCircle size={18} style={{ color: '#16a34a' }} />
                            <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>Patch applied successfully to the shadow database.</p>
                        </div>
                    )}

                    {/* AI Patch Writer */}
                    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Wand2 size={18} className="text-violet-600" />
                            <h2 className="m-0 text-base font-bold text-violet-700">AI Patch Writer</h2>
                            <span className="text-xs text-gray-500 ml-2">Describe what to change in plain language</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                value={nlDescription}
                                onChange={e => setNlDescription(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleGeneratePatch()}
                                placeholder="e.g. 'add phone_number column to users' or 'create index on orders.created_at'"
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors placeholder-gray-400"
                            />
                            <Button
                                onClick={handleGeneratePatch}
                                disabled={!nlDescription.trim() || generatingPatch}
                                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 min-w-[120px] shadow-sm"
                            >
                                {generatingPatch ? <><Loader2 size={14} className="mr-2 animate-spin" /> Generating…</> : <><Wand2 size={14} className="mr-2" /> Generate</>}
                            </Button>
                        </div>
                    </div>

                    {/* Info box */}
                    <div className="bg-blue-50 rounded-lg border border-blue-100 p-4 mb-5 shadow-sm">
                        <p style={{ margin: 0, fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
                            <strong>How it works:</strong> Paste or generate a SQL patch. The system checks for broken FK constraints, dependent indexes, views, and functions — and blocks unsafe operations like <code style={{ color: '#dc2626', background: '#fee2e2', padding: '2px 4px', borderRadius: 4, fontSize: 12 }}>DROP DATABASE</code> or <code style={{ color: '#dc2626', background: '#fee2e2', padding: '2px 4px', borderRadius: 4, fontSize: 12 }}>TRUNCATE</code>. All changes apply only to the shadow DB.
                        </p>
                    </div>

                    {/* SQL Editor */}
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#6d28d9' }}>SQL Patch</label>
                            {sqlPatch && (
                                <button
                                    onClick={() => { setSqlPatch(''); setResult(null); setApplySuccess(false); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}
                                    className="hover:text-gray-900 transition-colors"
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
                                background: '#f8fafc', color: '#0f172a',
                                border: '1px solid #cbd5e1', borderRadius: 10,
                                padding: '14px 16px', fontSize: 13,
                                fontFamily: 'monospace', lineHeight: 1.7,
                                resize: 'vertical', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
                            }}
                            onFocus={e => { e.target.style.borderColor = '#8b5cf6'; e.target.style.boxShadow = '0 0 0 1px #8b5cf6'; }}
                            onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>

                    {/* Safety result inline preview */}
                    {result && !showModal && (
                        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: result.is_safe ? '#f0fdf4' : '#fef2f2', border: `1px solid ${result.is_safe ? '#bbf7d0' : '#fecaca'}`, boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {result.is_safe ? <ShieldCheck size={16} style={{ color: '#16a34a' }} /> : <ShieldAlert size={16} style={{ color: '#dc2626' }} />}
                                <span style={{ fontSize: 13, fontWeight: 600, color: result.is_safe ? '#166534' : '#991b1b' }}>
                                    {result.is_safe ? 'Safe to Apply' : 'Blocked'}: {result.warning_message}
                                </span>
                                <button onClick={() => setShowModal(true)} style={{ marginLeft: 'auto', fontSize: 12, color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }} className="hover:text-gray-900 transition-colors">View Details</button>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                        <Button
                            disabled={!sqlPatch.trim() || checking}
                            onClick={handleCheck}
                            className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-sm font-semibold"
                        >
                            {checking ? <><Loader2 size={14} className="mr-2 animate-spin" /> Analysing…</> : <><ShieldCheck size={14} className="mr-2" /> Check Safety</>}
                        </Button>
                        {result?.is_safe && (
                            <Button
                                disabled={applying}
                                onClick={handleApply}
                                className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm font-semibold"
                            >
                                {applying ? <><Loader2 size={14} className="mr-1 animate-spin" /> Applying…</> : <><CheckCircle size={14} className="mr-1" /> Apply to Shadow DB</>}
                            </Button>
                        )}
                    </div>

                    {/* Example patches */}
                    <div style={{ marginTop: 28 }}>
                        <button
                            onClick={() => setShowExamples(s => !s)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}
                            className="hover:text-gray-900 transition-colors"
                        >
                            {showExamples ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Example Patches
                        </button>
                        {showExamples && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {EXAMPLE_PATCHES.map(cat => (
                                    <div key={cat.category}>
                                        <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.category}</p>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                            {cat.items.map(ex => (
                                                <button
                                                    key={ex.label}
                                                    onClick={() => { setSqlPatch(ex.sql); setResult(null); setShowExamples(false); }}
                                                    style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)'; }}
                                                >
                                                    <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#6d28d9', fontSize: 13 }}>{ex.label}</p>
                                                    <code style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ex.sql}</code>
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
                    <div className="w-full lg:w-80 border-l border-gray-200 bg-gray-50 p-6 overflow-y-auto lg:rounded-l-2xl shadow-inner">
                        <div className="flex items-center justify-between mb-5">
                            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <Clock size={14} className="inline mr-1.5" /> Migration History
                            </h3>
                            {history.length > 0 && (
                                <button
                                    onClick={() => { setHistory([]); localStorage.removeItem('governance_history'); }}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                                    className="hover:text-red-600 transition-colors"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>
                        {history.length === 0 ? (
                            <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 40 }}>No migrations yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {history.map((item, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSqlPatch(item.sql)}
                                        style={{ textAlign: 'left', background: '#ffffff', border: `1px solid ${item.success ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: '12px', cursor: 'pointer', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', transition: 'transform 0.15s, box-shadow 0.15s' }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)'; }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                            {item.success ? <CheckCircle size={14} style={{ color: '#16a34a' }} /> : <XCircle size={14} style={{ color: '#dc2626' }} />}
                                            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{item.timestamp}</span>
                                        </div>
                                        <code style={{ fontSize: 11, color: '#334155', fontFamily: 'monospace', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
                    <div style={{ background: '#ffffff', border: `1px solid ${result.is_safe ? '#bbf7d0' : '#fecaca'}`, borderRadius: 18, padding: 32, maxWidth: 540, width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            {result.is_safe ? <ShieldCheck size={30} style={{ color: '#16a34a' }} /> : <ShieldAlert size={30} style={{ color: '#dc2626' }} />}
                            <div>
                                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: result.is_safe ? '#166534' : '#991b1b' }}>
                                    {result.is_safe ? '✅ Safe to Apply' : '⛔ Migration Blocked'}
                                </h2>
                                {result.parsed.operation !== 'UNKNOWN' && (
                                    <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                                        {result.parsed.operation}{result.parsed.table && ` on ${result.parsed.table}`}{result.parsed.column && `.${result.parsed.column}`}
                                    </p>
                                )}
                            </div>
                        </div>

                        <p style={{ fontSize: 14, color: '#374151', marginBottom: 24, lineHeight: 1.6, background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>{result.warning_message}</p>

                        {(result.broken_queries > 0 || result.dependent_indexes > 0 || result.dependent_views > 0 || result.dependent_functions > 0) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                                {[
                                    { label: 'FK Constraints', value: result.broken_queries, icon: '🔗' },
                                    { label: 'Indexes', value: result.dependent_indexes, icon: '⚡' },
                                    { label: 'Views', value: result.dependent_views, icon: '👁' },
                                    { label: 'Functions', value: result.dependent_functions, icon: '⚙️' },
                                ].map(dep => (
                                    <div key={dep.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ fontSize: 18 }}>{dep.icon}</span>
                                        <div>
                                            <p style={{ margin: 0, fontSize: 12, color: '#64748b', fontWeight: 500 }}>{dep.label}</p>
                                            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: dep.value > 0 ? '#ef4444' : '#10b981' }}>{dep.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {result.warnings.length > 0 && (
                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 24, maxHeight: 150, overflowY: 'auto' }}>
                                {result.warnings.map((w, i) => (
                                    <p key={i} style={{ margin: '0 0 6px', fontSize: 12, color: '#b91c1c', display: 'flex', gap: 8, lineHeight: 1.4 }}>
                                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {w}
                                    </p>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                            <Button variant="outline" size="sm" onClick={() => setShowModal(false)} style={{ borderColor: '#cbd5e1', color: '#4b5563' }} className="hover:bg-gray-50">
                                <XCircle size={14} className="mr-2" /> Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={!result.is_safe || applying}
                                onClick={handleApply}
                                style={{ background: result.is_safe ? '#16a34a' : '#ef4444', color: '#fff', opacity: result.is_safe ? 1 : 0.6 }}
                                className={result.is_safe ? 'hover:bg-green-700' : ''}
                            >
                                {applying ? <><Loader2 size={14} className="mr-2 animate-spin" /> Applying…</> : result.is_safe ? <><CheckCircle size={14} className="mr-2" /> Apply to Shadow DB</> : '⛔ Blocked'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
}
