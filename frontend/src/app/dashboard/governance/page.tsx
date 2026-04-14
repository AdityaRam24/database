'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2, ShieldCheck, ShieldAlert, AlertTriangle,
    GitMerge, CheckCircle, XCircle, Shield,
    Database, Wand2, Clock, ChevronDown, ChevronRight, Trash2,
    Link2, Zap, Eye, Settings, Terminal, Bot, Cpu, CornerDownRight, PlaySquare, Github
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardShell from '@/components/DashboardShell';
import VisionUploader from '@/components/VisionUploader';
import { motion, AnimatePresence } from 'framer-motion';

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
    { category: 'Guaranteed Safe Operations', items: [
        { label: 'Append structural column',     sql: 'ALTER TABLE users ADD COLUMN last_login TIMESTAMP;' },
        { label: 'Deploy optimal lookup',   sql: 'CREATE INDEX idx_orders_user_id ON orders (user_id);' },
        { label: 'Establish relationship constraint', sql: 'ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id);' },
    ]},
    { category: 'High Privilege Structural Modifications', items: [
        { label: 'Prune existing data column',  sql: 'ALTER TABLE users DROP COLUMN email;' },
        { label: 'Execute entity rename', sql: 'ALTER TABLE users RENAME TO app_users;' },
    ]},
    { category: 'Prohibited Critical Actions', items: [
        { label: 'Force Table Truncation', sql: 'TRUNCATE TABLE orders;' },
        { label: 'Drop Entire Database',  sql: 'DROP DATABASE mydb;' },
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
    const [creatingPr, setCreatingPr] = useState(false);
    const [prInfo, setPrInfo] = useState<{url: string, branch: string} | null>(null);
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


    useEffect(() => {
        const s = sessionStorage.getItem("gov_sql"); if(s) setSqlPatch(s);
        const n = sessionStorage.getItem("gov_nl"); if(n) setNlDescription(n);
    }, []);
    useEffect(() => { sessionStorage.setItem("gov_sql", sqlPatch); }, [sqlPatch]);
    useEffect(() => { sessionStorage.setItem("gov_nl", nlDescription); }, [nlDescription]);

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
        setResult(null);
        setApplySuccess(false);
        setPrInfo(null);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/governance/ai-generate-patch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, description: nlDescription }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.detail || "Error communicating with AI service. Please make sure the local LLM is running.");
            } else if (data.sql) {
                setSqlPatch(data.sql);
            }
        } catch (e) { 
            console.error(e);
            alert("Network error: Could not reach the backend API.");
        }
        finally { setGeneratingPatch(false); }
    };

    const handleCheck = async () => {
        if (!connectionString || !sqlPatch.trim()) return;
        setChecking(true);
        setResult(null);
        setApplySuccess(false);
        setPrInfo(null);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/governance/simulate-migration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, sql_patch: sqlPatch }),
            });
            setResult(await res.json());
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
                saveHistory({ sql: sqlPatch, timestamp: new Date().toLocaleString(), success: true });
                setSqlPatch('');
                setResult(null);
            } else {
                const err = await res.json();
                saveHistory({ sql: sqlPatch, timestamp: new Date().toLocaleString(), success: false });
                alert(err.detail?.message || err.detail || 'Failed to successfully deploy policy');
            }
        } catch (e) { console.error(e); }
        finally { setApplying(false); }
    };

    const handleCreatePR = async () => {
        if (!sqlPatch.trim()) return;
        setCreatingPr(true);
        setPrInfo(null);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/github/create-pr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql_patch: sqlPatch, description: nlDescription || "AI-generated schema migration" }),
            });
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                alert(errData.detail || `Server error: ${res.status}`);
                return;
            }
            
            const data = await res.json();
            if (data.success) {
                setPrInfo({url: data.pr_url, branch: data.branch});
                setApplySuccess(true);
                saveHistory({ sql: sqlPatch, timestamp: new Date().toLocaleString(), success: true });
            } else {
                alert(data.detail || "Failed to create PR (Server responded but indicated failure).");
            }
        } catch (e: any) { 
            console.error(e); 
            alert(`Network Exception: ${e.message || 'Could not reach /github/create-pr API'}`);
        }
        finally { setCreatingPr(false); }
    };

    if (!mounted) return null;

    return (
        <DashboardShell>
            <div className="flex flex-col h-full w-full max-w-[1400px] mx-auto pb-10">
                {/* ── Page header ── */}
                <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3 border-b border-gray-100 dark:border-white/[0.05] bg-white dark:bg-slate-900/80 shadow-sm z-10 relative overflow-hidden backdrop-blur-xl">
                    {/* 3D Governance Structure */}
                    <motion.div 
                        animate={{ rotateX: [10, 40, 10], rotateZ: [-20, 20, -20], scale: [0.9, 1.1, 0.9] }} 
                        transition={{ repeat: Infinity, duration: 20, ease: "easeInOut" }}
                        className="absolute right-[25%] -top-10 w-48 h-48 border-[6px] border-violet-500/10 dark:border-violet-500/20 shadow-lg pointer-events-none rounded-[40px]" 
                        style={{ transformStyle: 'preserve-3d', transform: 'rotateX(50deg) rotateY(10deg)' }}
                    >
                        <div className="absolute inset-4 rounded-[30px] border-[4px] border-indigo-500/10 dark:border-indigo-500/20" style={{ transform: 'rotateZ(45deg)' }} />
                    </motion.div>
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center relative shadow-inner ring-1 ring-violet-200">
                            <GitMerge size={22} className="text-violet-600" />
                            <div className="absolute top-0 right-0 -mr-1 -mt-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse border-2 border-white shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight tracking-tight flex items-center gap-2">
                                Autonomous Schema Engineering
                            </h1>
                            <p className="text-[13px] text-gray-500 font-medium mt-0.5">AI-powered migration compilation and structural safety matrix validations</p>
                        </div>
                    </div>
                    
                    <div className="relative z-10 flex gap-2">
                        <button
                            onClick={() => router.push('/dashboard/data')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold transition-all hover:bg-emerald-100 shadow-sm"
                        >
                            <Database size={13} /> Target Telemetry
                        </button>
                        <button
                            onClick={() => setShowHistory(h => !h)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-sm ${showHistory ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                        >
                            <Clock size={13} /> Deployment Ledger {history.length > 0 && `(${history.length})`}
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 flex-col lg:flex-row w-full mx-auto relative h-full">
                    
                    {/* Main Interface */}
                    <motion.div 
                        className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto bg-slate-50/20"
                        initial="hidden"
                        animate="show"
                        variants={{
                            hidden: { opacity: 0 },
                            show: { opacity: 1, transition: { staggerChildren: 0.1 } }
                        }}
                    >

                        {/* Success Banner */}
                        {applySuccess && (
                            <div className="animate-in fade-in slide-in-from-top-2 flex flex-col gap-3 px-5 py-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm text-emerald-800 mb-4">
                                <div className="flex items-center gap-3 font-bold">
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-emerald-500 shadow-sm shrink-0"><CheckCircle size={18} /></div>
                                    <span>{prInfo ? 'Migration pushed successfully to GitHub repository timeline.' : 'Policy safely deployed to environmental target. Structural integrity maintained.'}</span>
                                </div>
                                {prInfo && (
                                    <div className="pl-11 mt-1">
                                        <a href={prInfo.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-white text-[11px] font-black uppercase tracking-widest text-slate-800 px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-all cursor-pointer">
                                           <Github size={14}/> View Live PR: {prInfo.branch}
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Vision Intelligence Layer */}
                        <motion.div 
                            className="mb-6"
                            variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
                        >
                            <VisionUploader />
                        </motion.div>

                        {/* AI Command Center */}
                        <motion.div 
                            variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
                            className="bg-white border border-gray-200 rounded-[24px] p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-400 opacity-[0.03] rounded-full blur-3xl -mr-20 -mt-20"></div>
                            
                            <div className="flex items-center gap-3 mb-5 relative z-10">
                                <Bot size={20} className="text-violet-600" />
                                <div>
                                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">AI Prompt Command Center</h2>
                                    <p className="text-[11px] text-gray-500 font-bold mt-0.5">Describe structural intent. Agent will formulate safe deployment code.</p>
                                </div>
                            </div>

                            <div className="relative group z-10">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Terminal size={18} className="text-violet-400 group-focus-within:text-violet-600 transition-colors" />
                                </div>
                                <input
                                    value={nlDescription}
                                    onChange={e => setNlDescription(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleGeneratePatch()}
                                    placeholder="e.g. 'Bind a phone_number identifier to the customer collection'..."
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-11 pr-32 py-4 text-slate-800 text-sm font-bold outline-none focus:border-violet-500/50 focus:bg-white focus:ring-4 focus:ring-violet-500/10 transition-all placeholder-slate-400 shadow-inner"
                                />
                                <div className="absolute inset-y-0 right-2 flex items-center">
                                    <Button
                                        onClick={handleGeneratePatch}
                                        disabled={!nlDescription.trim() || generatingPatch}
                                        className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-black uppercase tracking-wider text-[11px] rounded-xl cursor-pointer h-10 px-5 shadow-sm transition-transform active:scale-95"
                                    >
                                        {generatingPatch ? <><Loader2 size={14} className="mr-2 animate-spin" /> Compiling</> : <><Wand2 size={14} className="mr-2" /> Compile</>}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>

                        {/* Pre-compiled Instructions Loader */}
                        <motion.div 
                            className="px-2"
                            variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
                        >
                            <button
                                onClick={() => setShowExamples(s => !s)}
                                className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-violet-600 transition-colors cursor-pointer"
                            >
                                {showExamples ? <ChevronDown size={14} /> : <ChevronRight size={14} />} 
                                View Pre-compiled Agent Instructions
                            </button>
                            
                            {showExamples && (
                                <div className="mt-4 space-y-5 animate-in slide-in-from-top-2 px-2">
                                    {EXAMPLE_PATCHES.map(cat => (
                                        <div key={cat.category}>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-slate-300"></span>{cat.category}
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {cat.items.map(ex => (
                                                    <button
                                                        key={ex.label}
                                                        onClick={() => { setSqlPatch(ex.sql); setResult(null); setShowExamples(false); setNlDescription(''); }}
                                                        className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer text-left hover:border-violet-400 hover:shadow-md transition-all group relative overflow-hidden"
                                                    >
                                                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-violet-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                        <p className="text-xs font-black text-slate-800 mb-2 flex items-center gap-1.5"><CornerDownRight size={12} className="text-violet-400"/>{ex.label}</p>
                                                        <code className="text-[10px] text-violet-700 bg-violet-50 px-2 py-1 rounded inline-block font-mono line-clamp-1 border border-violet-100">{ex.sql}</code>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>

                        {/* SQL Target Editor */}
                        <motion.div 
                            variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
                            className="bg-slate-900 rounded-[24px] shadow-xl overflow-hidden border border-slate-800 flex flex-col mt-4"
                        >
                            <div className="bg-slate-950 px-5 py-3 flex items-center justify-between border-b border-slate-800 shadow-sm relative">
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1.5 mr-3">
                                        <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/50"></div>
                                        <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                                        <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
                                    </div>
                                    <Terminal size={14} className="text-emerald-400 opacity-70" />
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiled Target Migration Module</label>
                                </div>
                                {sqlPatch && !checking && (
                                    <button
                                        onClick={() => { setSqlPatch(''); setResult(null); setApplySuccess(false); }}
                                        className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1 bg-slate-800/50 px-2.5 py-1 rounded-md"
                                    >
                                        <Trash2 size={10} /> Clear Module
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <textarea
                                    value={sqlPatch}
                                    onChange={e => { setSqlPatch(e.target.value); setResult(null); setApplySuccess(false); }}
                                    placeholder="-- Agent waiting for structural parameters...&#10;-- Or paste explicit SQL payload here."
                                    rows={8}
                                    className="w-full bg-transparent text-[13px] font-mono text-emerald-400 resize-none outline-none p-6 leading-relaxed placeholder-slate-700 focus:bg-slate-800/20 transition-colors selection:bg-emerald-500/30"
                                    spellCheck={false}
                                />
                            </div>
                            
                            {/* Editor Action Bar */}
                            <div className="bg-slate-800/50 px-5 py-4 border-t border-slate-800 flex items-center justify-between backdrop-blur-sm">
                                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                                    <Cpu size={12}/> Ensure syntactic validity before verification.
                                </div>
                                <Button
                                    disabled={!sqlPatch.trim() || checking}
                                    onClick={handleCheck}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 border-none font-black uppercase tracking-widest text-[11px] rounded-xl cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all active:scale-95 px-6 h-10"
                                >
                                    {checking ? <><Loader2 size={14} className="mr-2 animate-spin text-slate-900" /> Computing Verification Matrix…</> : <><ShieldCheck size={14} className="mr-2" /> Verify Structural Safety</>}
                                </Button>
                            </div>
                        </motion.div>

                        {/* Safety Verification Matrix (Replaces Modal) */}
                        <AnimatePresence>
                            {result && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', damping: 25, stiffness: 200 } }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    className="mt-6"
                                >
                                <div className={`border-2 rounded-[24px] overflow-hidden shadow-xl ${result.is_safe ? 'border-emerald-500/40 bg-white' : 'border-rose-500/40 bg-white'}`}>
                                    {/* Matrix Header */}
                                    <div className={`px-6 py-5 border-b flex items-center justify-between ${result.is_safe ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-inner ${result.is_safe ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                {result.is_safe ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
                                            </div>
                                            <div>
                                                <h2 className={`text-lg font-black tracking-tight ${result.is_safe ? 'text-emerald-800' : 'text-rose-800'}`}>
                                                    {result.is_safe ? 'Network State Verified Safe' : 'CRITICAL FAULT PREVENTED'}
                                                </h2>
                                                <p className={`text-xs font-bold uppercase tracking-widest mt-0.5 ${result.is_safe ? 'text-emerald-600/70' : 'text-rose-600/70'}`}>
                                                    {result.parsed.operation !== 'UNKNOWN' ? `${result.parsed.operation} operation` : 'Unknown Operation'}
                                                </p>
                                            </div>
                                        </div>
                                        {result.is_safe && (
                                            <div className="flex items-center gap-3">
                                                 <Button
                                                    disabled={applying || creatingPr}
                                                    onClick={handleCreatePR}
                                                    className="bg-slate-800 hover:bg-slate-900 text-white font-black uppercase tracking-widest text-[11px] rounded-xl cursor-pointer shadow-lg transition-transform active:scale-95 px-5 border-none"
                                                >
                                                    {creatingPr ? <><Loader2 size={13} className="mr-2 animate-spin" /> Pushing to Remote…</> : <><Github size={13} className="mr-2" /> GitHub PR</>}
                                                </Button>
                                                 <Button
                                                    disabled={applying || creatingPr}
                                                    onClick={handleApply}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[11px] rounded-xl cursor-pointer shadow-lg transition-transform active:scale-95 px-5"
                                                >
                                                    {applying ? <><Loader2 size={13} className="mr-2 animate-spin" /> Deploying…</> : <><PlaySquare size={13} className="mr-2" /> Direct Deploy</>}
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Matrix Body */}
                                    <div className="p-6">
                                        <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 mb-6 shadow-inner">
                                            {result.warning_message}
                                        </p>

                                        {/* Dependency Breakdown */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                            {[
                                                { label: 'Active Socket Links',    value: result.broken_queries,      icon: Link2, desc: 'Query Connections'    },
                                                { label: 'Map Resolvers',        value: result.dependent_indexes,   icon: Zap,   desc: 'Indexes / Lookups'  },
                                                { label: 'Projection Matrices', value: result.dependent_views,     icon: Eye,   desc: 'Virtual Views'      },
                                                { label: 'Core Routines',      value: result.dependent_functions, icon: Settings, desc: 'Stored Procedures' },
                                            ].map(dep => (
                                                <div key={dep.label} className="bg-white border border-slate-200 rounded-xl px-4 py-4 shadow-sm flex flex-col justify-between">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <dep.icon size={18} className="text-violet-500 shrink-0" />
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${dep.value > 0 ? 'bg-rose-50 text-rose-500 border-rose-200' : 'bg-emerald-50 text-emerald-500 border-emerald-200'}`}>
                                                            {dep.value > 0 ? 'Conflict!' : 'Clear'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className={`text-2xl font-black mb-0.5 font-mono ${dep.value > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{dep.value}</p>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{dep.label}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Risk Warnings List */}
                                        {result.warnings.length > 0 && (
                                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 mb-2 shadow-inner">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-rose-800 flex items-center gap-1.5 mb-3">
                                                    <AlertTriangle size={12} /> Environmental Risks Identified
                                                </p>
                                                <div className="space-y-2">
                                                    {result.warnings.map((w, i) => (
                                                        <div key={i} className="text-xs text-rose-700 font-bold flex items-start gap-2 bg-white/60 p-2.5 rounded-lg border border-rose-100">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5"></div>
                                                            {w}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Deployment Ledger Sidebar */}
                    {showHistory && (
                        <div className="w-full lg:w-80 border-l border-slate-200 bg-white/80 backdrop-blur-md overflow-y-auto z-20 animate-in slide-in-from-right-4 shadow-2xl relative">
                            <div className="sticky top-0 bg-white/90 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between z-10">
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <Clock size={14} className="text-violet-600"/> Deployment Ledger
                                </h3>
                                {history.length > 0 && (
                                    <button
                                        onClick={() => { setHistory([]); localStorage.removeItem('governance_history'); }}
                                        className="text-[10px] uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors font-black cursor-pointer bg-rose-50 px-2 py-1 rounded"
                                    >
                                        Flush
                                    </button>
                                )}
                            </div>
                            <div className="p-4">
                                {history.length === 0 ? (
                                    <div className="text-center py-20 flex flex-col items-center">
                                        <Database size={24} className="text-slate-300 mb-3" />
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Target Unmodified.</p>
                                        <p className="text-[10px] text-slate-400 mt-1">Zero deployments executed.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-3.5 before:w-px before:bg-slate-200">
                                        {history.map((item, i) => (
                                            <div key={i} className="relative pl-8 shrink-0">
                                                <div className={`absolute left-2.5 -ml-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 ${item.success ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                                <button
                                                    onClick={() => {setSqlPatch(item.sql); setShowHistory(false); setResult(null); }}
                                                    className={`w-full text-left bg-white border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all group ${item.success ? 'border-slate-200 hover:border-emerald-300' : 'border-rose-100 hover:border-rose-300'}`}
                                                >
                                                    <div className="flex items-center justify-between gap-1.5 mb-2">
                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 ${item.success ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                            {item.success ? 'Success' : 'Failed'}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.timestamp}</span>
                                                    </div>
                                                    <code className="text-[10px] text-slate-600 font-mono block overflow-hidden display-block w-full line-clamp-3 leading-relaxed whitespace-pre-wrap">{item.sql}</code>
                                                    <div className="text-transparent group-hover:text-violet-500 text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-1 transition-colors">
                                                        <CornerDownRight size={10} /> Load Module to Editor
                                                    </div>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
