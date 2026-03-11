'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, ShieldAlert, AlertTriangle, ArrowLeft, GitMerge, CheckCircle, XCircle, Shield, Clock, ExternalLink, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

export default function GovernancePage() {
    const router = useRouter();
    const [connectionString, setConnectionString] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [sqlPatch, setSqlPatch] = useState('');
    const [checking, setChecking] = useState(false);
    const [applying, setApplying] = useState(false);
    const [result, setResult] = useState<SafetyResult | null>(null);
    const [applySuccess, setApplySuccess] = useState(false);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        const cs = localStorage.getItem('db_connection_string');
        if (!cs) {
            router.replace('/dashboard');
            return;
        }
        setConnectionString(cs);
        setMounted(true);
    }, []);

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
                setSqlPatch('');
                setResult(null);
            } else {
                const err = await res.json();
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
        <div style={{ minHeight: '100vh', background: '#08080f', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px', borderBottom: '1px solid #1e1e2e', background: '#0f0f1a' }}>
                <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ArrowLeft size={16} /> Dashboard
                </button>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GitMerge size={20} style={{ color: '#3b82f6' }} /> Migration Safety Analysis
                </h1>
                <button onClick={() => router.push('/dashboard/data')} style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, cursor: 'pointer', color: '#34d399', fontSize: 12, fontWeight: 600 }}>
                    <Database size={13} /> View Data
                </button>
            </div>

            <div style={{ padding: '32px', maxWidth: 800, margin: '0 auto' }}>

                {applySuccess && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: '#052e16', border: '1px solid #166534', borderRadius: 10, marginBottom: 24 }}>
                        <CheckCircle size={18} style={{ color: '#22c55e' }} />
                        <p style={{ margin: 0, color: '#86efac', fontWeight: 600 }}>Patch applied successfully to the shadow database.</p>
                    </div>
                )}

                <>
                    {/* Intro */}
                    <div style={{ background: '#0f0f1a', border: '1px solid #1e3a5f', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
                        <p style={{ margin: 0, fontSize: 13, color: '#60a5fa', lineHeight: 1.6 }}>
                            <strong>How it works:</strong> Paste any SQL patch below. Before applying, the system checks for broken FK constraints, dependent indexes, views, and functions — and blocks unsafe operations like <code style={{ color: '#f87171', fontFamily: 'monospace' }}>DROP DATABASE</code> or <code style={{ color: '#f87171', fontFamily: 'monospace' }}>TRUNCATE</code>. All changes apply only to the shadow DB.
                        </p>
                    </div>

                    {/* SQL Editor */}
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>SQL Patch</label>
                    <textarea
                        value={sqlPatch}
                        onChange={e => { setSqlPatch(e.target.value); setResult(null); setApplySuccess(false); }}
                        placeholder={`ALTER TABLE users DROP COLUMN email;\n-- or --\nCREATE INDEX idx_orders_user_id ON orders (user_id);`}
                        rows={8}
                        style={{
                            width: '100%', boxSizing: 'border-box',
                            background: '#0d1117', color: '#6ee7b7',
                            border: '1px solid #2e2e4e', borderRadius: 8,
                            padding: '12px 14px', fontSize: 13,
                            fontFamily: 'monospace', lineHeight: 1.6,
                            resize: 'vertical', outline: 'none',
                        }}
                    />

                    <Button
                        className="mt-3"
                        disabled={!sqlPatch.trim() || checking}
                        onClick={handleCheck}
                        style={{ background: '#1e3a5f', color: '#60a5fa', border: '1px solid #2563eb', fontWeight: 600 }}
                    >
                        {checking
                            ? <><Loader2 size={14} className="mr-2 animate-spin" /> Analysing…</>
                            : <><ShieldCheck size={14} className="mr-2" /> Check Safety</>
                        }
                    </Button>

                    {/* Reference examples */}
                    <div style={{ marginTop: 32 }}>
                        <p style={{ fontSize: 12, color: '#374151', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Example patches</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[
                                { label: '✅ Add index (safe)', sql: 'CREATE INDEX idx_orders_user_id ON orders (user_id);' },
                                { label: '✅ Add column (safe)', sql: 'ALTER TABLE users ADD COLUMN last_login TIMESTAMP;' },
                                { label: '⚠️ Drop column (may break)', sql: 'ALTER TABLE users DROP COLUMN email;' },
                                { label: '🚫 Truncate (blocked)', sql: 'TRUNCATE TABLE orders;' },
                            ].map(ex => (
                                <button key={ex.label} onClick={() => { setSqlPatch(ex.sql); setResult(null); }} style={{
                                    background: '#0f0f1a', border: '1px solid #2e2e4e', borderRadius: 8,
                                    padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                                    color: '#6b7280', fontSize: 11, transition: 'border-color 0.15s'
                                }}
                                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#2e2e4e')}
                                >
                                    <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#a78bfa' }}>{ex.label}</p>
                                    <code style={{ fontFamily: 'monospace', fontSize: 10, color: '#4b5563' }}>{ex.sql}</code>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            </div>

            {/* ── Safety Modal ── */}
            {showModal && result && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: 24,
                }}>
                    <div style={{ background: '#0f0f1a', border: `2px solid ${result.is_safe ? '#166534' : '#991b1b'}`, borderRadius: 16, padding: 32, maxWidth: 520, width: '100%' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            {result.is_safe
                                ? <ShieldCheck size={28} style={{ color: '#22c55e' }} />
                                : <ShieldAlert size={28} style={{ color: '#ef4444' }} />
                            }
                            <div>
                                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: result.is_safe ? '#86efac' : '#fca5a5' }}>
                                    {result.is_safe ? 'Safe to Apply' : 'Unsafe — Migration Blocked'}
                                </h2>
                                {result.parsed.operation !== 'UNKNOWN' && (
                                    <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>
                                        Operation: {result.parsed.operation}
                                        {result.parsed.table && ` on ${result.parsed.table}`}
                                        {result.parsed.column && `.${result.parsed.column}`}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Warning message */}
                        <p style={{ fontSize: 14, color: '#d1d5db', marginBottom: 20, lineHeight: 1.55 }}>
                            {result.warning_message}
                        </p>

                        {/* Dependency breakdown */}
                        {(result.broken_queries > 0 || result.dependent_indexes > 0 || result.dependent_views > 0 || result.dependent_functions > 0) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                                {[
                                    { label: 'FK Constraints', value: result.broken_queries, icon: '🔗' },
                                    { label: 'Indexes', value: result.dependent_indexes, icon: '⚡' },
                                    { label: 'Views', value: result.dependent_views, icon: '👁' },
                                    { label: 'Functions', value: result.dependent_functions, icon: '⚙️' },
                                ].map(dep => (
                                    <div key={dep.label} style={{ background: '#1e1e2e', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 18 }}>{dep.icon}</span>
                                        <div>
                                            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{dep.label}</p>
                                            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: dep.value > 0 ? '#f87171' : '#4ade80' }}>{dep.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Detailed warnings */}
                        {result.warnings.length > 0 && (
                            <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', marginBottom: 20, maxHeight: 140, overflowY: 'auto' }}>
                                {result.warnings.map((w, i) => (
                                    <p key={i} style={{ margin: '0 0 4px', fontSize: 11, color: '#fca5a5', display: 'flex', gap: 6 }}>
                                        <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} /> {w}
                                    </p>
                                ))}
                            </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <Button variant="outline" size="sm" onClick={() => setShowModal(false)} style={{ borderColor: '#2e2e4e', color: '#6b7280' }}>
                                <XCircle size={14} className="mr-1" /> Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={!result.is_safe || applying}
                                onClick={handleApply}
                                style={{
                                    background: result.is_safe ? '#166534' : '#450a0a',
                                    color: result.is_safe ? '#86efac' : '#fca5a5',
                                    cursor: result.is_safe ? 'pointer' : 'not-allowed',
                                    opacity: result.is_safe ? 1 : 0.6,
                                }}
                            >
                                {applying
                                    ? <><Loader2 size={14} className="mr-1 animate-spin" /> Applying…</>
                                    : result.is_safe
                                        ? <><CheckCircle size={14} className="mr-1" /> Apply to Shadow DB</>
                                        : '⛔ Blocked'
                                }
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
