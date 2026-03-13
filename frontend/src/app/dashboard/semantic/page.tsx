'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, BookOpen, Lightbulb, Save, CheckCircle, Loader2, Copy, Globe, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardShell from '@/components/DashboardShell';

interface BusinessRule {
    id: string;
    name: string;
    definition: string;
}

const EXAMPLE_RULES: BusinessRule[] = [
    { id: 'ex1', name: 'Active User', definition: 'A user who has logged in within the last 7 days' },
    { id: 'ex2', name: 'High Value Order', definition: 'An order with total_amount > 1000' },
    { id: 'ex3', name: 'Churned Customer', definition: 'A customer who has not placed an order in 90 days' },
    { id: 'ex4', name: 'Recent Signup', definition: 'A user created within the last 30 days' },
];

export default function SemanticLayerPage() {
    const router = useRouter();
    const [rules, setRules] = useState<BusinessRule[]>([]);
    const [newName, setNewName] = useState('');
    const [newDef, setNewDef] = useState('');
    const [saved, setSaved] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [mcpCopied, setMcpCopied] = useState(false);
    const [connectionString, setConnectionString] = useState<string | null>(null);

    const API = process.env.NEXT_PUBLIC_API_URL;

    useEffect(() => {
        const cs = localStorage.getItem('db_connection_string');
        setConnectionString(cs);
        setMounted(true);
        loadRules();
    }, []);

    const loadRules = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/semantic/rules`);
            const data = await res.json();
            setRules(data.rules || []);

            // Migrate from localStorage if server is empty
            if ((!data.rules || data.rules.length === 0)) {
                const stored = localStorage.getItem('business_rules');
                if (stored) {
                    const localRules = JSON.parse(stored);
                    for (const rule of localRules) {
                        await fetch(`${API}/semantic/rules`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: rule.name, definition: rule.definition }),
                        });
                    }
                    localStorage.removeItem('business_rules');
                    // Reload from server
                    const res2 = await fetch(`${API}/semantic/rules`);
                    const data2 = await res2.json();
                    setRules(data2.rules || []);
                }
            }
        } catch (e) {
            console.error('Failed to load rules, falling back to localStorage:', e);
            const stored = localStorage.getItem('business_rules');
            if (stored) setRules(JSON.parse(stored));
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newName.trim() || !newDef.trim()) return;
        setSaving(true);
        try {
            const res = await fetch(`${API}/semantic/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim(), definition: newDef.trim() }),
            });
            if (res.ok) {
                await loadRules();
                setNewName('');
                setNewDef('');
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await fetch(`${API}/semantic/rules/${id}`, { method: 'DELETE' });
            await loadRules();
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddExample = async (rule: BusinessRule) => {
        if (rules.some(r => r.name === rule.name)) return;
        setSaving(true);
        try {
            await fetch(`${API}/semantic/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: rule.name, definition: rule.definition }),
            });
            await loadRules();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const copyMCPEndpoint = () => {
        const url = `${API}/mcp/manifest`;
        navigator.clipboard.writeText(url);
        setMcpCopied(true);
        setTimeout(() => setMcpCopied(false), 2000);
    };

    if (!mounted) return null;

    return (
        <DashboardShell>
            {/* Top bar */}
            <div className="flex items-center gap-4 py-6 md:py-8 bg-transparent">
                <h1 className="m-0 text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-600 flex items-center gap-3 drop-shadow-sm">
                    <BookOpen size={28} className="text-amber-500" /> Semantic Layer
                </h1>
                {saved && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-500/30">
                        <CheckCircle size={14} /> Saved
                    </span>
                )}
            </div>

            <div className="w-full max-w-5xl mx-auto pb-12">
                {/* MCP Badge */}
                <div className="flex mb-8">
                    <div className="flex-1 p-6 glass border border-blue-500/30 rounded-2xl flex flex-col md:flex-row md:items-center gap-5 shadow-[0_8px_32px_rgba(59,130,246,0.1)] bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-400 to-indigo-600 shadow-[0_0_10px_rgba(59,130,246,0.6)]"></div>
                        <Globe size={28} className="text-blue-400 shrink-0 ml-1 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <div className="flex-1">
                            <p className="m-0 mb-1.5 text-base font-bold text-slate-100 flex items-center">
                                MCP Server
                                <span className="ml-3 text-[10px] px-2 py-0.5 rounded-md border border-emerald-500/40 bg-emerald-950/60 text-emerald-400 font-extrabold shadow-[0_0_10px_rgba(16,185,129,0.3)]">ONLINE</span>
                            </p>
                            <p className="m-0 text-sm text-slate-400 leading-relaxed max-w-2xl">
                                Your schema & business rules are exposed as an MCP manifest for AI agents.
                            </p>
                        </div>
                        <button onClick={copyMCPEndpoint} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/40 rounded-xl cursor-pointer text-blue-300 text-sm font-bold transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:shadow-[0_0_25px_rgba(59,130,246,0.3)] shrink-0">
                            {mcpCopied ? <CheckCircle size={16} /> : <Copy size={16} />} {mcpCopied ? 'Copied!' : 'Copy URL'}
                        </button>
                    </div>
                </div>

                {/* Explanation */}
                <div className="p-6 glass border border-amber-500/30 rounded-2xl flex items-start gap-4 shadow-[0_8px_32px_rgba(245,158,11,0.05)] bg-gradient-to-br from-amber-500/5 to-transparent mb-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[100px] rounded-full pointer-events-none fade-in"></div>
                    <Lightbulb size={28} className="text-amber-400 shrink-0 mt-0.5 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                    <div className="relative z-10">
                        <p className="m-0 mb-2 text-base font-bold text-amber-400 drop-shadow-sm">What is the Semantic Layer?</p>
                        <p className="m-0 text-sm text-slate-300 leading-relaxed max-w-3xl">
                            Define business terms so the AI understands your domain. When you ask <em className="text-white bg-white/5 px-2 py-0.5 rounded-md not-italic font-medium border border-white/10 mx-1">"show me active users"</em>, the AI will use your definition of "Active User" to write the correct SQL automatically. Rules are saved server-side and included in the MCP manifest.
                        </p>
                    </div>
                </div>

                {/* Add new rule */}
                <div className="p-6 glass border border-violet-500/30 rounded-2xl mb-12 bg-gradient-to-br from-violet-500/5 to-transparent relative overflow-hidden shadow-[0_8px_32px_rgba(139,92,246,0.05)] transition-all">
                    <h2 className="m-0 mb-5 text-base font-bold text-violet-400 flex items-center drop-shadow-[0_0_8px_rgba(139,92,246,0.3)]">
                        <Plus size={18} className="mr-2" /> Add Business Rule
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-4">
                        <input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="Term name"
                            className="bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-slate-200 text-sm outline-none focus:border-violet-500/50 transition-colors"
                        />
                        <input
                            value={newDef}
                            onChange={e => setNewDef(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            placeholder='Definition (e.g. "A user who logged in within 7 days")'
                            className="bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-slate-200 text-sm outline-none focus:border-violet-500/50 transition-colors"
                        />
                        <Button
                            onClick={handleAdd}
                            disabled={!newName.trim() || !newDef.trim() || saving}
                            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 h-full transition-colors w-full md:w-auto shadow-[0_0_15px_rgba(124,58,237,0.3)]"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                            Save
                        </Button>
                    </div>
                </div>

                {/* Current rules */}
                {loading ? (
                    <div className="text-center py-10">
                        <Loader2 size={32} className="text-violet-500 animate-spin mx-auto" />
                    </div>
                ) : rules.length > 0 ? (
                    <div className="mb-10">
                        <h2 className="m-0 mb-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Your Rules ({rules.length})</h2>
                        <div className="flex flex-col gap-3">
                            {rules.map(rule => (
                                <div key={rule.id} className="flex items-center gap-4 glass border border-white/5 bg-black/20 rounded-xl p-4 transition-colors hover:bg-white/5">
                                    <div className="flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                        <span className="font-bold text-violet-400 text-sm whitespace-nowrap">{rule.name}</span>
                                        <span className="text-slate-600 text-xs hidden md:inline">=</span>
                                        <span className="text-slate-300 text-sm leading-relaxed">{rule.definition}</span>
                                    </div>
                                    <button onClick={() => handleDelete(rule.id)} className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors shrink-0">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {/* Example rules */}
                <div>
                    <h2 className="m-0 mb-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Example Rules</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {EXAMPLE_RULES.map(rule => {
                            const isAdded = rules.some(r => r.name === rule.name);
                            return (
                                <button
                                    key={rule.id}
                                    onClick={() => handleAddExample(rule)}
                                    disabled={isAdded}
                                    className={`text-left glass border rounded-xl p-4 transition-all ${isAdded ? 'opacity-40 cursor-not-allowed border-white/5 bg-black/40' : 'cursor-pointer hover:border-violet-500/50 border-white/10 hover:bg-white/5'}`}
                                >
                                    <p className="m-0 mb-1.5 font-bold text-violet-400 text-sm flex items-center justify-between">
                                        {rule.name}
                                        {isAdded && <CheckCircle size={14} className="text-emerald-500" />}
                                    </p>
                                    <p className="m-0 text-slate-400 text-xs leading-relaxed">{rule.definition}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
