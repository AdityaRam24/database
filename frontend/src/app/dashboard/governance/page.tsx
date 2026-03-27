'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2, ShieldCheck, ShieldAlert, AlertTriangle,
    GitMerge, CheckCircle, XCircle, Shield,
    Database, Wand2, Clock, ChevronDown, ChevronRight, Trash2,
    Link2, Zap, Eye, Settings
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
        { label: 'Add column',     sql: 'ALTER TABLE users ADD COLUMN last_login TIMESTAMP;' },
        { label: 'Create index',   sql: 'CREATE INDEX idx_orders_user_id ON orders (user_id);' },
        { label: 'Add constraint', sql: 'ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id);' },
    ]},
    { category: 'Risky', items: [
        { label: 'Drop column',  sql: 'ALTER TABLE users DROP COLUMN email;' },
        { label: 'Rename table', sql: 'ALTER TABLE users RENAME TO app_users;' },
    ]},
    { category: 'Blocked', items: [
        { label: 'Truncate', sql: 'TRUNCATE TABLE orders;' },
        { label: 'Drop DB',  sql: 'DROP DATABASE mydb;' },
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
        } catch (e) { console.error(e); }
        finally { setGeneratingPatch(false); }
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
            setResult(await res.json());
            setShowModal(true);
        } catch (e) { console.error(e); }
        finally { setChecking(false); }
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
        } catch (e) { console.error(e); }
        finally { setApplying(false); }
    };

    if (!mounted) return null;

    return (
        <DashboardShell>
            {/* ── Page header ── */}
            <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                        <GitMerge size={18} className="text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 leading-tight">Safe Changes</h1>
                        <p className="text-xs text-gray-500 font-medium">AI-powered migration safety checks and schema patch assistant</p>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard/data')}
                        className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold cursor-pointer hover:bg-emerald-100 transition-colors"
                    >
                        <Database size={13} /> View Data
                    </button>
                </div>
                <button
                    onClick={() => setShowHistory(h => !h)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold cursor-pointer hover:bg-amber-100 transition-colors"
                >
                    <Clock size={13} /> History {history.length > 0 && `(${history.length})`}
                </button>
            </div>

            <div className="flex flex-1 flex-col lg:flex-row w-full max-w-[1400px] mx-auto pb-10">
                {/* Main content */}
                <div className="flex-1 p-4 md:p-8 max-w-[900px] mx-auto w-full space-y-5">

                    {/* Success banner */}
                    {applySuccess && (
                        <div className="flex items-center gap-2.5 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-semibold">
                            <CheckCircle size={16} className="shrink-0" />
                            Patch applied successfully to the shadow database.
                        </div>
                    )}

                    {/* AI Patch Writer */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <Wand2 size={16} className="text-violet-600" />
                            <h2 className="text-sm font-bold text-violet-700">Tell AI what to change</h2>
                            <span className="text-xs text-gray-400 ml-1">We will make sure it doesn't break your app</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                value={nlDescription}
                                onChange={e => setNlDescription(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleGeneratePatch()}
                                placeholder="e.g. 'add a phone number to customers' or 'delete the test_users table'"
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors placeholder-gray-400 font-medium"
                            />
                            <Button
                                onClick={handleGeneratePatch}
                                disabled={!nlDescription.trim() || generatingPatch}
                                className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl cursor-pointer min-w-[120px]"
                            >
                                {generatingPatch ? <><Loader2 size={13} className="mr-1.5 animate-spin" /> Generating…</> : <><Wand2 size={13} className="mr-1.5" /> Generate</>}
                            </Button>
                        </div>
                    </div>

                    {/* Info box */}
                    <div className="bg-blue-50 rounded-xl border border-blue-100 px-4 py-3">
                        <p className="text-xs text-blue-700 leading-relaxed font-medium">
                            <strong>How it works:</strong> Tell AI what you want to change. We translate it to code and simulate the change in a secure sandbox. The AI verifies that your changes won't break existing data connections, active lookups, or app logic before allowing you to apply it.
                        </p>
                    </div>

                    {/* SQL Editor */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-violet-700 uppercase tracking-wider">AI Generated Plan</label>
                            {sqlPatch && (
                                <button
                                    onClick={() => { setSqlPatch(''); setResult(null); setApplySuccess(false); }}
                                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors cursor-pointer font-medium"
                                >
                                    <Trash2 size={11} /> Clear
                                </button>
                            )}
                        </div>
                        <textarea
                            value={sqlPatch}
                            onChange={e => { setSqlPatch(e.target.value); setResult(null); setApplySuccess(false); }}
                            placeholder={`ALTER TABLE users ADD COLUMN phone VARCHAR(20);`}
                            rows={7}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-gray-900 resize-vertical outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all leading-relaxed"
                        />
                    </div>

                    {/* Inline safety preview */}
                    {result && !showModal && (
                        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold ${result.is_safe ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {result.is_safe ? <ShieldCheck size={15} className="shrink-0" /> : <ShieldAlert size={15} className="shrink-0" />}
                            <span>{result.is_safe ? 'Safe to Apply' : 'Dangerous Change Blocked'}: {result.warning_message}</span>
                            <button onClick={() => setShowModal(true)} className="ml-auto text-xs text-gray-500 hover:text-gray-900 transition-colors font-medium cursor-pointer">View Details</button>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 flex-wrap">
                        <Button
                            disabled={!sqlPatch.trim() || checking}
                            onClick={handleCheck}
                            className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-semibold rounded-xl cursor-pointer"
                        >
                            {checking ? <><Loader2 size={13} className="mr-1.5 animate-spin" /> Verifying…</> : <><ShieldCheck size={13} className="mr-1.5" /> Simulate in Sandbox</>}
                        </Button>
                        {result?.is_safe && (
                            <Button
                                disabled={applying}
                                onClick={handleApply}
                                className="bg-emerald-600 text-white hover:bg-emerald-700 font-semibold rounded-xl cursor-pointer"
                            >
                                {applying ? <><Loader2 size={13} className="mr-1.5 animate-spin" /> Deploying…</> : <><CheckCircle size={13} className="mr-1.5" /> Deploy Change Safely</>}
                            </Button>
                        )}
                    </div>

                    {/* Example patches */}
                    <div className="pt-2">
                        <button
                            onClick={() => setShowExamples(s => !s)}
                            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 hover:text-gray-900 transition-colors cursor-pointer"
                        >
                            {showExamples ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Example Patches
                        </button>
                        {showExamples && (
                            <div className="space-y-4">
                                {EXAMPLE_PATCHES.map(cat => (
                                    <div key={cat.category}>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">{cat.category}</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                            {cat.items.map(ex => (
                                                <button
                                                    key={ex.label}
                                                    onClick={() => { setSqlPatch(ex.sql); setResult(null); setShowExamples(false); }}
                                                    className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer text-left hover:border-violet-300 hover:shadow-sm transition-all"
                                                >
                                                    <p className="text-xs font-bold text-violet-700 mb-1">{ex.label}</p>
                                                    <code className="text-[10px] text-gray-500 font-mono line-clamp-2">{ex.sql}</code>
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
                    <div className="w-full lg:w-72 border-l border-gray-100 bg-gray-50/60 p-5 overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                <Clock size={13} /> Migration History
                            </h3>
                            {history.length > 0 && (
                                <button
                                    onClick={() => { setHistory([]); localStorage.removeItem('governance_history'); }}
                                    className="text-xs text-red-500 hover:text-red-600 transition-colors font-medium cursor-pointer"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>
                        {history.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center mt-10 font-medium">No migrations yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {history.map((item, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSqlPatch(item.sql)}
                                        className={`w-full text-left bg-white border rounded-xl p-3 cursor-pointer hover:shadow-sm transition-all ${item.success ? 'border-green-200' : 'border-red-200'}`}
                                    >
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            {item.success
                                                ? <CheckCircle size={12} className="text-green-600 shrink-0" />
                                                : <XCircle size={12} className="text-red-500 shrink-0" />
                                            }
                                            <span className="text-[10px] text-gray-400 font-medium">{item.timestamp}</span>
                                        </div>
                                        <code className="text-[10px] text-gray-600 font-mono block truncate">{item.sql}</code>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Safety Modal ── */}
            {showModal && result && (
                <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                    <div className={`bg-white border rounded-2xl p-8 max-w-lg w-full shadow-2xl ${result.is_safe ? 'border-green-200' : 'border-red-200'}`}>
                        {/* Modal header */}
                        <div className="flex items-center gap-3 mb-5">
                            {result.is_safe
                                ? <ShieldCheck size={28} className="text-green-600 shrink-0" />
                                : <ShieldAlert size={28} className="text-red-600 shrink-0" />
                            }
                            <div>
                                <h2 className={`text-lg font-bold ${result.is_safe ? 'text-green-700' : 'text-red-700'}`}>
                                    {result.is_safe ? 'Safe to Apply' : 'Dangerous Change Blocked'}
                                </h2>
                                {result.parsed.operation !== 'UNKNOWN' && (
                                    <p className="text-xs text-gray-500 font-medium">
                                        {result.parsed.operation}{result.parsed.table && ` on ${result.parsed.table}`}{result.parsed.column && `.${result.parsed.column}`}
                                    </p>
                                )}
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-5 font-medium">
                            {result.warning_message}
                        </p>

                        {(result.broken_queries > 0 || result.dependent_indexes > 0 || result.dependent_views > 0 || result.dependent_functions > 0) && (
                            <div className="grid grid-cols-2 gap-3 mb-5">
                                {[
                                    { label: 'Connections',    value: result.broken_queries,      icon: Link2    },
                                    { label: 'Lookups',        value: result.dependent_indexes,   icon: Zap      },
                                    { label: 'Virtual Tables', value: result.dependent_views,     icon: Eye      },
                                    { label: 'App Logic',      value: result.dependent_functions, icon: Settings },
                                ].map(dep => (
                                    <div key={dep.label} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                                        <dep.icon size={16} className="text-violet-600 shrink-0" />
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">{dep.label}</p>
                                            <p className={`text-xl font-black ${dep.value > 0 ? 'text-red-500' : 'text-green-600'}`}>{dep.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {result.warnings.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 max-h-36 overflow-y-auto space-y-1.5">
                                {result.warnings.map((w, i) => (
                                    <p key={i} className="text-xs text-red-700 font-medium flex items-start gap-2">
                                        <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {w}
                                    </p>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-3 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setShowModal(false)} className="rounded-xl cursor-pointer">
                                <XCircle size={13} className="mr-1.5" /> Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={!result.is_safe || applying}
                                onClick={handleApply}
                                className={`rounded-xl cursor-pointer font-semibold ${result.is_safe ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-100 text-red-400 cursor-not-allowed'}`}
                            >
                                {applying
                                    ? <><Loader2 size={13} className="mr-1.5 animate-spin" /> Deploying…</>
                                    : result.is_safe
                                        ? <><CheckCircle size={13} className="mr-1.5" /> Deploy Change Safely</>
                                        : <><Shield size={13} className="mr-1.5" /> Blocked</>
                                }
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
}
