'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, Trash2, BrainCircuit, Lightbulb, Save, CheckCircle, Loader2, Link2, Globe, Cpu, Database, Blocks, Binary, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardShell from '@/components/DashboardShell';
import { motion } from 'framer-motion';

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
    const [connectionString, setConnectionString] = useState<string | null>(null);

    const API = process.env.NEXT_PUBLIC_API_URL;

    useEffect(() => {
        const cs = localStorage.getItem('db_connection_string');
        setConnectionString(cs);
        setMounted(true);
        loadRules();

        const handler = (e: any) => {
            const newCs = e?.detail?.connStr || localStorage.getItem('db_connection_string');
            console.log('[Knowledge] project-changed fired, switching to:', newCs);
            setConnectionString(newCs);
            loadRules();
        };
        window.addEventListener('project-changed', handler);
        return () => window.removeEventListener('project-changed', handler);
    }, []);

    const loadRules = async () => {
        if (!connectionString) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/semantic/rules?connection_string=${encodeURIComponent(connectionString)}`);
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
                            body: JSON.stringify({ name: rule.name, definition: rule.definition, connection_string: connectionString }),
                        });
                    }
                    localStorage.removeItem('business_rules');
                    const res2 = await fetch(`${API}/semantic/rules?connection_string=${encodeURIComponent(connectionString)}`);
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

    // Re-load rules whenever connection string changes
    useEffect(() => {
        if (connectionString) {
            loadRules();
        }
    }, [connectionString]);

    const handleAdd = async () => {
        if (!newName.trim() || !newDef.trim() || !connectionString) return;
        setSaving(true);
        try {
            const res = await fetch(`${API}/semantic/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim(), definition: newDef.trim(), connection_string: connectionString }),
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
        if (!connectionString) return;
        try {
            await fetch(`${API}/semantic/rules/${id}?connection_string=${encodeURIComponent(connectionString)}`, { method: 'DELETE' });
            await loadRules();
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddExample = async (rule: BusinessRule) => {
        if (rules.some(r => r.name === rule.name) || !connectionString) return;
        setSaving(true);
        try {
            await fetch(`${API}/semantic/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: rule.name, definition: rule.definition, connection_string: connectionString }),
            });
            await loadRules();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    if (!mounted) return null;

    return (
        <DashboardShell>
            <div className="flex flex-col h-full w-full max-w-[1200px] mx-auto pb-16">
                
                {/* ── Page Header ── */}
                <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3 border-b border-gray-100 dark:border-white/[0.05] bg-white dark:bg-slate-900/80 shadow-sm z-10 relative overflow-hidden backdrop-blur-xl">
                    {/* 3D Knowledge Core Shape */}
                    <motion.div 
                        animate={{ rotateY: [0, 180, 360], scale: [1, 1.1, 1] }} 
                        transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                        className="absolute right-10 -top-10 w-48 h-48 border-4 border-violet-500/10 dark:border-violet-500/20 shadow-lg pointer-events-none" 
                        style={{ transformStyle: 'preserve-3d', transform: 'rotateX(50deg) rotateZ(-20deg)' }}
                    />
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center relative shadow-inner ring-1 ring-violet-200">
                            <BrainCircuit size={22} className="text-violet-600" />
                            <div className="absolute top-0 right-0 -mr-1 -mt-1 w-3 h-3 bg-violet-500 rounded-full animate-pulse border-2 border-white shadow-[0_0_8px_rgba(139,92,246,0.8)]"></div>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                Cognitive Lexicon Core
                            </h1>
                            <p className="text-[13px] text-slate-500 font-bold mt-0.5 uppercase tracking-widest flex items-center gap-1.5">
                                <Binary size={12}/> Inject Custom Operating Definitions
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 p-4 md:p-8 space-y-10 relative z-0">
                    
                    {/* ── Ingestion Protocol Banner ── */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-3xl p-8 shadow-sm">
                        <div className="absolute top-0 right-0 -mt-10 -mr-20 w-80 h-80 bg-amber-200/40 rounded-full blur-[80px] pointer-events-none"></div>
                        
                        <div className="flex items-start gap-5 relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-amber-100">
                                <Sparkles size={24} className="text-amber-500" />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-amber-900 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                    Semantic Ingestion Protocol Active
                                </h2>
                                <p className="text-[13px] text-amber-800/80 leading-relaxed max-w-4xl font-bold">
                                    Lexicon mapping natively alters the core agent's understanding algorithms. Program specific ground-truths for internal company jargon. 
                                    <br/><br/>
                                    If you encode <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300/50 rounded text-xs mx-1 font-mono uppercase shadow-sm">"Top Customer"</span> to mean <span className="inline-block px-2 py-0.5 bg-white text-slate-600 border border-amber-200 rounded text-xs mx-1 font-mono italic shadow-sm">"spent $1000 in 30 days"</span>, the agent will strictly append those mathematical constraints when reasoning safely over your environment.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ── Lexicon Vector Mapping Form ── */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden transition-all hover:shadow-md hover:border-violet-200">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-400 opacity-[0.02] rounded-full blur-3xl pointer-events-none"></div>

                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Plus size={14} className="text-violet-600" /> Construct Vector Mapping
                            </h2>
                            {saved && (
                                <span className="animate-in fade-in flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 font-black uppercase tracking-widest">
                                    <CheckCircle size={12} /> Node Ingested
                                </span>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_2fr_auto] gap-4 items-center">
                            
                            <div className="relative">
                                <div className="absolute -top-2.5 left-4 px-1.5 bg-white text-[9px] font-black uppercase tracking-widest text-violet-500 z-10">Lexicon Key Target</div>
                                <input
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder='e.g. "Stale Record"'
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-4 text-slate-800 text-[13px] font-bold outline-none focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10 transition-all placeholder-slate-300"
                                />
                            </div>

                            <div className="hidden lg:flex items-center justify-center">
                                <ArrowRight size={20} className="text-slate-300" />
                            </div>

                            <div className="relative">
                                <div className="absolute -top-2.5 left-4 px-1.5 bg-white text-[9px] font-black uppercase tracking-widest text-emerald-500 z-10">Engine Ground Truth</div>
                                <input
                                    value={newDef}
                                    onChange={e => setNewDef(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                    placeholder='e.g. "has not been updated in 3 months"'
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-4 text-slate-800 text-[13px] font-bold outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder-slate-300"
                                />
                            </div>

                            <Button
                                onClick={handleAdd}
                                disabled={!newName.trim() || !newDef.trim() || saving}
                                className="bg-violet-600 hover:bg-violet-700 text-white font-black uppercase tracking-wider text-[11px] h-full min-h-[52px] rounded-xl cursor-pointer shadow-[0_4px_14px_0_rgba(139,92,246,0.39)] transition-transform active:scale-95 disabled:shadow-none"
                            >
                                {saving ? <><Loader2 size={16} className="animate-spin mr-2" /> Encoding</> : <><Save size={16} className="mr-2" /> Ingest</>}
                            </Button>

                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                        {/* ── Encoded Semantic Nodes (List) ── */}
                        <div className="xl:col-span-2">
                            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Database size={14} className="text-slate-400"/> Encoded Semantic Nodes {rules.length > 0 && `(${rules.length})`}
                            </h2>
                            
                            {loading ? (
                                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                                    <Loader2 size={32} className="text-violet-400 animate-spin mb-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scanning Core Storage...</span>
                                </div>
                            ) : rules.length > 0 ? (
                                <div className="space-y-3">
                                    {rules.map(rule => (
                                        <div key={rule.id} className="group relative pr-12 xl:pr-16 bg-white border border-slate-200 rounded-[20px] p-5 shadow-sm hover:shadow-md hover:border-violet-200 transition-all">
                                            
                                            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5 relative z-10">
                                                {/* Lexicon Key */}
                                                <div className="flex-shrink-0 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                                                    <span className="font-mono text-violet-700 text-[12px] font-black bg-violet-50/80 px-3 py-1.5 rounded-lg border border-violet-100 shadow-inner">
                                                        "{rule.name}"
                                                    </span>
                                                </div>
                                                
                                                {/* Linking visual */}
                                                <div className="hidden md:flex flex-1 items-center px-2">
                                                    <div className="h-px w-full bg-slate-200 border-dashed border-t-2"></div>
                                                    <ArrowRight size={14} className="text-slate-300 ml-1 shrink-0" />
                                                </div>

                                                <div className="md:hidden flex h-4 w-px bg-slate-200 ml-6 -mt-1 mb-1"></div>

                                                {/* Ground Truth */}
                                                <div className="flex-grow max-w-full">
                                                    <p className="text-slate-600 text-[13px] leading-relaxed font-bold bg-slate-50/80 px-4 py-2 border border-slate-100 rounded-xl shadow-inner min-h-[40px] flex items-center">
                                                        {rule.definition}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Action Button */}
                                            <button 
                                                onClick={() => handleDelete(rule.id)} 
                                                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 p-2 rounded-xl transition-all cursor-pointer opacity-0 group-hover:opacity-100 hover:bg-rose-50"
                                                title="Delete Node"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                                    <Blocks size={32} className="text-slate-300 mb-4" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Lexicon Core Empty</span>
                                    <span className="text-xs font-bold text-slate-400">Mapping tables unavailable. Agent reasoning unaffected.</span>
                                </div>
                            )}
                        </div>

                        {/* ── Pre-Trained Classifications ── */}
                        <div>
                            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Cpu size={14} className="text-slate-400" /> Inject Pre-Trained Nodes
                            </h2>
                            <div className="flex flex-col gap-3">
                                {EXAMPLE_RULES.map(rule => {
                                    const isAdded = rules.some(r => r.name === rule.name);
                                    return (
                                        <button
                                            key={rule.id}
                                            onClick={() => handleAddExample(rule)}
                                            disabled={isAdded}
                                            className={`text-left border rounded-2xl p-4 transition-all relative overflow-hidden group 
                                                ${isAdded 
                                                    ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50/50' 
                                                    : 'cursor-pointer border-slate-200 bg-white hover:border-emerald-300 hover:shadow-[0_4px_20px_rgba(16,185,129,0.1)] hover:-translate-y-0.5'}`}
                                        >
                                            {/* Hover decoration */}
                                            {!isAdded && <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
                                            
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <span className="font-mono text-emerald-800 text-[11px] font-black bg-emerald-50 px-2 py-1 rounded inline-block border border-emerald-100/50">
                                                    {rule.name}
                                                </span>
                                                {isAdded && <CheckCircle size={14} className="text-emerald-500 shrink-0" />}
                                                {!isAdded && <Plus size={14} className="text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" />}
                                            </div>
                                            <p className="m-0 text-slate-500 text-[11px] leading-relaxed font-bold block">{rule.definition}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
