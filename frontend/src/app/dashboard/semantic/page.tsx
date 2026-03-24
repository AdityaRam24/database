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
            <div className="flex items-center gap-4 py-6 md:py-8 bg-transparent border-b border-gray-200 mb-8">
                <h1 className="m-0 text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600 flex items-center gap-3 drop-shadow-sm">
                    <BookOpen size={28} className="text-amber-500" /> Semantic Layer
                </h1>
                {saved && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 font-bold uppercase tracking-wider">
                        <CheckCircle size={14} /> Saved
                    </span>
                )}
            </div>

            <div className="w-full max-w-5xl mx-auto pb-12 px-4 md:px-8">
                {/* MCP Badge */}
                <div className="flex mb-8">
                    <div className="flex-1 p-6 bg-white border border-blue-200 rounded-2xl flex flex-col md:flex-row md:items-center gap-5 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-400 to-indigo-600"></div>
                        <Globe size={28} className="text-blue-500 shrink-0 ml-1" />
                        <div className="flex-1">
                            <p className="m-0 mb-1.5 text-base font-bold text-gray-900 flex items-center">
                                MCP Server
                                <span className="ml-3 text-[10px] px-2 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold tracking-wider">ONLINE</span>
                            </p>
                            <p className="m-0 text-sm text-gray-500 leading-relaxed max-w-2xl font-medium">
                                Your schema & business rules are exposed as an MCP manifest for AI agents.
                            </p>
                        </div>
                        <button onClick={copyMCPEndpoint} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl cursor-pointer text-blue-700 text-sm font-bold transition-all shadow-sm shrink-0">
                            {mcpCopied ? <CheckCircle size={16} /> : <Copy size={16} />} {mcpCopied ? 'Copied!' : 'Copy URL'}
                        </button>
                    </div>
                </div>

                {/* Explanation */}
                <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4 shadow-sm mb-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-100 blur-[80px] rounded-full pointer-events-none fade-in"></div>
                    <Lightbulb size={28} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="relative z-10">
                        <p className="m-0 mb-2 text-base font-bold text-amber-900">What is the Semantic Layer?</p>
                        <p className="m-0 text-sm text-amber-800 leading-relaxed max-w-3xl font-medium">
                            Define business terms so the AI understands your domain. When you ask <em className="text-amber-900 bg-amber-200/50 px-2 py-0.5 rounded-md not-italic font-bold border border-amber-300 mx-1">"show me active users"</em>, the AI will use your definition of "Active User" to write the correct SQL automatically. Rules are saved server-side and included in the MCP manifest.
                        </p>
                    </div>
                </div>

                {/* Add new rule */}
                <div className="p-6 bg-white border border-gray-200 rounded-2xl mb-12 shadow-sm transition-all">
                    <h2 className="m-0 mb-5 text-base font-bold text-violet-600 flex items-center">
                        <Plus size={18} className="mr-2" /> Add Business Rule
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-4">
                        <input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="Term name"
                            className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-medium placeholder-gray-400"
                        />
                        <input
                            value={newDef}
                            onChange={e => setNewDef(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            placeholder='Definition (e.g. "A user who logged in within 7 days")'
                            className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-medium placeholder-gray-400"
                        />
                        <Button
                            onClick={handleAdd}
                            disabled={!newName.trim() || !newDef.trim() || saving}
                            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 h-full transition-colors w-full md:w-auto shadow-sm"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                            Save
                        </Button>
                    </div>
                </div>

                {/* Current rules */}
                {loading ? (
                    <div className="text-center py-10">
                        <Loader2 size={32} className="text-violet-600 animate-spin mx-auto" />
                    </div>
                ) : rules.length > 0 ? (
                    <div className="mb-12">
                        <h2 className="m-0 mb-5 text-sm font-bold text-gray-500 uppercase tracking-widest">Your Rules ({rules.length})</h2>
                        <div className="flex flex-col gap-3">
                            {rules.map(rule => (
                                <div key={rule.id} className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-5 transition-shadow shadow-sm hover:shadow-md">
                                    <div className="flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                                        <span className="font-extrabold text-violet-700 text-[15px] whitespace-nowrap bg-violet-50 px-3 py-1 rounded-md border border-violet-100">{rule.name}</span>
                                        <span className="text-gray-300 text-sm hidden md:inline font-bold">=</span>
                                        <span className="text-gray-600 text-sm leading-relaxed font-medium">{rule.definition}</span>
                                    </div>
                                    <button onClick={() => handleDelete(rule.id)} className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors shrink-0 border border-transparent hover:border-red-200">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {/* Example rules */}
                <div>
                    <h2 className="m-0 mb-5 text-sm font-bold text-gray-500 uppercase tracking-widest">Example Rules</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {EXAMPLE_RULES.map(rule => {
                            const isAdded = rules.some(r => r.name === rule.name);
                            return (
                                <button
                                    key={rule.id}
                                    onClick={() => handleAddExample(rule)}
                                    disabled={isAdded}
                                    className={`text-left bg-white border rounded-xl p-5 transition-all shadow-sm ${isAdded ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' : 'cursor-pointer hover:border-violet-300 hover:shadow-md border-gray-200'}`}
                                >
                                    <p className="m-0 mb-2 font-bold text-violet-700 text-[15px] flex items-center justify-between">
                                        {rule.name}
                                        {isAdded && <CheckCircle size={16} className="text-emerald-600" />}
                                    </p>
                                    <p className="m-0 text-gray-500 text-[13px] leading-relaxed font-medium">{rule.definition}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
