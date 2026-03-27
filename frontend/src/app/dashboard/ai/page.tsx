'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Send, Bot, User, StopCircle, Globe, Play, BarChart2, Lightbulb, Shield, ChevronDown, Trash2, DollarSign, Leaf, Sparkles, Database, Table2, Hash, GitMerge, Zap, HardDrive, Tag, RefreshCw } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';

interface Message {
    role: 'user' | 'ai';
    content: string;
    suggested_action?: string;
    sql?: string;
    query_result?: {
        rows: any[][];
        columns: string[];
        error: string | null;
        chart_type: string | null;
        explanation: string | null;
        attempts: number;
        sql: string;
        firewall_blocked?: boolean;
        threat_type?: string;
        query_cost?: {
            rating: string;
            cost_estimate: { dollar_cost_display: string; co2_display: string };
            plan_summary: { estimated_rows: number; node_type: string };
        } | null;
    } | null;
    loading_query?: boolean;
}

const LANGUAGES = [
    { code: 'english', label: '🇺🇸 English' },
    { code: 'hindi',   label: '🇮🇳 Hindi'   },
    { code: 'spanish', label: '🇪🇸 Spanish'  },
    { code: 'french',  label: '🇫🇷 French'   },
    { code: 'arabic',  label: '🇸🇦 Arabic'   },
    { code: 'german',  label: '🇩🇪 German'   },
];

const SUGGESTIONS = [
    { icon: Table2,    text: 'Show top 10 rows from each table' },
    { icon: Hash,      text: 'Which table has the most records?' },
    { icon: GitMerge,  text: 'List all foreign key relationships' },
    { icon: Zap,       text: 'Find any tables missing indexes' },
    { icon: HardDrive, text: 'Total storage used per table?' },
    { icon: Tag,       text: 'Show column types for all tables' },
];

function MiniBarChart({ columns, rows }: { columns: string[]; rows: any[][] }) {
    if (rows.length === 0 || columns.length < 2) return null;
    const values = rows.map(r => Number(r[1]) || 0);
    const max = Math.max(...values, 1);
    return (
        <div className="mt-3 p-3 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50">
            <div className="text-xs text-violet-600 font-semibold mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 size={11} /> Auto Chart
            </div>
            <div className="space-y-2">
                {rows.slice(0, 8).map((row, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 w-24 truncate shrink-0 font-medium">{String(row[0])}</span>
                        <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{
                                    width: `${Math.max(4, (values[i] / max) * 100)}%`,
                                    background: `linear-gradient(90deg, hsl(${260 - i * 15}, 80%, 60%), hsl(${240 - i * 15}, 75%, 55%))`
                                }} />
                            </div>
                            <span className="text-gray-700 font-semibold w-10 text-right">{row[1]}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ResultTable({ columns, rows }: { columns: string[]; rows: any[][] }) {
    return (
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                    <tr style={{ background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)' }}>
                        {columns.map(col => (
                            <th key={col} className="text-violet-700 font-semibold text-left px-4 py-2.5 whitespace-nowrap border-b border-violet-100">{col}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.slice(0, 20).map((row, i) => (
                        <tr key={i} className={`border-b border-gray-50 transition-colors hover:bg-violet-50/40 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                            {row.map((cell, j) => (
                                <td key={j} className="text-gray-700 px-4 py-2 whitespace-nowrap" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {cell === null ? <span className="text-gray-300 italic text-xs">NULL</span> : String(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length > 20 && <p className="text-gray-400 text-xs px-4 py-2 bg-gray-50">… and {rows.length - 20} more rows</p>}
        </div>
    );
}

export default function AskAIPage() {
    const [connectionString, setConnectionString] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [language, setLanguage] = useState('english');
    const [showLangPicker, setShowLangPicker] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [executing, setExecuting] = useState<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const cs = localStorage.getItem('db_connection_string') || '';
        setConnectionString(cs);
        const handleChange = () => setConnectionString(localStorage.getItem('db_connection_string') || '');
        window.addEventListener('project-changed', handleChange);
        return () => window.removeEventListener('project-changed', handleChange);
    }, []);

    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, [messages, loading]);

    useEffect(() => {
        if (connectionString) {
            setMessages([{ role: 'ai', content: `✦ Connected to your database!\n\nAsk me anything — I can query your data, explain your schema, suggest optimizations, or help you make safe schema changes.\n\nType in any language you prefer! 🌍` }]);
        }
    }, [connectionString]);

    const getHistory = () => messages.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));

    const handleSend = async (text?: string) => {
        const question = (text ?? input).trim();
        if (!question || loading || !connectionString) return;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: question }]);
        setLoading(true);
        const ctrl = new AbortController();
        setAbortController(ctrl);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/ask`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, question, language, conversation_history: getHistory(), business_rules: '' }),
                signal: ctrl.signal,
            });
            const data = await res.json();
            setMessages(prev => [...prev, { role: 'ai', content: data.answer || 'Sorry, I got an empty response.', suggested_action: data.suggested_action }]);
        } catch (e: any) {
            if (e.name !== 'AbortError') setMessages(prev => [...prev, { role: 'ai', content: '❌ Could not reach the AI service. Please check your Ollama server.' }]);
        } finally { setLoading(false); setAbortController(null); }
    };

    const handleRunQuery = async (msgIndex: number, question: string) => {
        setMessages(prev => { const n = [...prev]; n[msgIndex] = { ...n[msgIndex], loading_query: true, query_result: null }; return n; });
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/query`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, question, language, conversation_history: getHistory(), business_rules: '' }),
            });
            const data = await res.json();
            let costData = null;
            if (data.sql && !data.error) {
                try { const cr = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/query-cost`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connection_string: connectionString, sql: data.sql }) }); costData = await cr.json(); } catch {}
            }
            setMessages(prev => { const n = [...prev]; n[msgIndex] = { ...n[msgIndex], loading_query: false, query_result: { ...data, query_cost: costData } }; return n; });
        } catch { setMessages(prev => { const n = [...prev]; n[msgIndex] = { ...n[msgIndex], loading_query: false, query_result: { rows: [], columns: [], error: 'Failed to run query.', chart_type: null, explanation: null, attempts: 0, sql: '' } }; return n; }); }
    };

    const handleExecuteAction = async (msgIndex: number, sql: string) => {
        setExecuting(msgIndex);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/optimization/apply`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, sql_command: sql, id: `chat-${Date.now()}` }),
            });
            const data = await res.json();
            if (data.success) { setMessages(prev => { const n = [...prev]; delete n[msgIndex].suggested_action; return [...n, { role: 'ai', content: '✅ Command executed successfully! Your schema has been updated.' }]; }); }
            else { setMessages(prev => [...prev, { role: 'ai', content: `❌ Execution failed: ${data.error || data.detail}` }]); }
        } catch { setMessages(prev => [...prev, { role: 'ai', content: '❌ Failed to connect to server.' }]); }
        finally { setExecuting(null); }
    };

    const selectedLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

    return (
        <DashboardShell>
            <div className="flex flex-col mx-4 sm:mx-6 mb-4 rounded-2xl overflow-hidden border border-gray-100 shadow-sm" style={{ height: 'calc(100vh - 110px)', background: 'linear-gradient(180deg, #fafafa 0%, #f5f3ff08 100%)' }}>

                {/* Top bar */}
                <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-100/80 bg-white/70 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-200" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                                <Bot size={17} color="white" />
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-gray-900">AI Database Assistant</h2>
                                <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
                                    <Sparkles size={8} /> Pro
                                </span>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-none mt-0.5">Qwen2.5-Coder · Ollama · Self-healing SQL</p>
                        </div>
                        <div className="hidden md:flex items-center gap-1.5 ml-3 pl-3 border-l border-gray-100">
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#f3e8ff', color: '#7c3aed' }}><Shield size={9} /> Guardrails ON</span>
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#15803d' }}><Shield size={9} /> Firewall Active</span>
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#dbeafe', color: '#1d4ed8' }}><RefreshCw size={9} /> Self-healing SQL</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button onClick={() => setShowLangPicker(p => !p)}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 font-medium text-gray-600 transition-colors shadow-sm">
                                <Globe size={11} className="text-violet-500" />
                                {selectedLang.label}
                                <ChevronDown size={10} className="text-gray-400" />
                            </button>
                            {showLangPicker && (
                                <div className="absolute top-10 right-0 z-30 p-1.5 rounded-2xl shadow-2xl border border-gray-100 bg-white min-w-[170px]">
                                    {LANGUAGES.map(lang => (
                                        <button key={lang.code} onClick={() => { setLanguage(lang.code); setShowLangPicker(false); }}
                                            className={`flex items-center w-full text-left text-xs px-3 py-2 rounded-xl transition-colors font-medium ${language === lang.code ? 'bg-violet-50 text-violet-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                                            {lang.label}
                                            {language === lang.code && <span className="ml-auto text-violet-500">✓</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setMessages(connectionString ? [{ role: 'ai', content: 'Chat cleared. Ask me anything!' }] : [])}
                            title="Clear chat" className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto py-6 px-4 sm:px-10 space-y-6">
                    {!connectionString ? (
                        <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
                            <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl shadow-violet-200" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                                <Database size={34} color="white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-1">No database connected</h3>
                                <p className="text-gray-500 text-sm max-w-sm">Connect a database from the sidebar to start asking questions about your data.</p>
                            </div>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-8">
                            <div>
                                <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl shadow-violet-200 mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                                    <Bot size={34} color="white" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-1 text-center">What do you want to know?</h3>
                                <p className="text-gray-500 text-sm text-center">Query data · Explore schema · Detect issues · Make safe changes</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 w-full max-w-2xl">
                                {SUGGESTIONS.map(s => (
                                    <button key={s.text} onClick={() => handleSend(s.text)}
                                        className="group text-left px-4 py-3.5 rounded-2xl border border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/60 hover:shadow-md text-sm text-gray-700 transition-all duration-200 flex items-start gap-2.5 cursor-pointer">
                                        <s.icon size={15} className="mt-0.5 shrink-0 text-violet-500 group-hover:text-violet-700 transition-colors" />
                                        <span className="font-medium group-hover:text-violet-800 transition-colors">{s.text}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <div key={i} className={`flex gap-3.5 max-w-3xl ${msg.role === 'user' ? 'flex-row-reverse ml-auto' : 'mr-auto'}`}>
                                {/* Avatar */}
                                <div className="shrink-0 w-8 h-8 rounded-2xl flex items-center justify-center shadow-md mt-1"
                                    style={{ background: msg.role === 'ai' ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : 'linear-gradient(135deg,#1e293b,#334155)' }}>
                                    {msg.role === 'ai' ? <Bot size={14} color="white" /> : <User size={14} color="white" />}
                                </div>
                                <div className="flex flex-col gap-2 min-w-0 flex-1">
                                    {/* Label */}
                                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${msg.role === 'user' ? 'text-right text-gray-400' : 'text-violet-500'}`}>
                                        {msg.role === 'ai' ? 'AI Assistant' : 'You'}
                                    </span>
                                    {/* Bubble */}
                                    <div className={`rounded-2xl px-4 py-3.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                                        msg.role === 'user'
                                            ? 'text-white rounded-tr-sm'
                                            : 'text-gray-800 bg-white border border-gray-100 rounded-tl-sm'
                                    }`}
                                    style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #1e293b, #334155)' } : {}}>
                                        {msg.content}
                                    </div>

                                    {/* Run Query */}
                                    {msg.role === 'ai' && i > 0 && (
                                        <button onClick={() => handleRunQuery(i, messages[i - 1]?.content || msg.content)}
                                            disabled={!!msg.loading_query}
                                            className="self-start flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full border border-violet-200 bg-white text-violet-700 font-semibold hover:bg-violet-50 hover:border-violet-300 transition-all shadow-sm disabled:opacity-60">
                                            {msg.loading_query ? <><Loader2 size={11} className="animate-spin" /> Running…</> : <><Play size={11} fill="currentColor" /> Run as Query</>}
                                        </button>
                                    )}

                                    {/* Query result */}
                                    {msg.query_result && (
                                        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                                            {msg.query_result.error ? (
                                                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">❌ {msg.query_result.error}</div>
                                            ) : (
                                                <>
                                                    <div className="mb-2.5 p-3 rounded-xl text-xs font-mono leading-relaxed" style={{ background: '#0f172a', color: '#4ade80' }}>{msg.query_result.sql}</div>
                                                    {msg.query_result.explanation && (
                                                        <div className="mb-2 flex items-start gap-1.5 text-xs text-gray-500 bg-amber-50 rounded-lg px-2.5 py-2 border border-amber-100">
                                                            <Lightbulb size={11} className="mt-0.5 text-amber-500 shrink-0" />{msg.query_result.explanation}
                                                        </div>
                                                    )}
                                                    {msg.query_result.attempts > 1 && (
                                                        <div className="text-[10px] font-bold text-blue-500 mb-1.5 flex items-center gap-1">🔄 Self-healed in {msg.query_result.attempts} attempts</div>
                                                    )}
                                                    {msg.query_result.chart_type && <MiniBarChart columns={msg.query_result.columns} rows={msg.query_result.rows} />}
                                                    {msg.query_result.rows.length > 0 && <ResultTable columns={msg.query_result.columns} rows={msg.query_result.rows} />}
                                                    <div className="text-xs text-gray-400 mt-2 flex items-center gap-1 font-medium">{msg.query_result.rows.length} row{msg.query_result.rows.length !== 1 ? 's' : ''} · LIMIT 100 applied</div>
                                                    {msg.query_result.query_cost && (
                                                        <div className="mt-2.5 flex items-center gap-3 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
                                                            <span className="flex items-center gap-1 text-xs font-bold text-amber-600"><DollarSign size={12} />{msg.query_result.query_cost.cost_estimate.dollar_cost_display}</span>
                                                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><Leaf size={12} />{msg.query_result.query_cost.cost_estimate.co2_display}</span>
                                                            <span className="ml-auto text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg bg-white border shadow-sm"
                                                                style={{ color: msg.query_result.query_cost.rating === 'cheap' ? '#16a34a' : msg.query_result.query_cost.rating === 'moderate' ? '#ea580c' : '#dc2626', borderColor: msg.query_result.query_cost.rating === 'cheap' ? '#bbf7d0' : msg.query_result.query_cost.rating === 'moderate' ? '#fed7aa' : '#fecaca' }}>
                                                                {msg.query_result.query_cost.rating}
                                                            </span>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Suggested action */}
                                    {msg.suggested_action && (
                                        <div className="bg-white border border-violet-100 rounded-2xl p-4 shadow-sm">
                                            <div className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                                                <Lightbulb size={11} className="text-amber-500" /> Suggested Command
                                            </div>
                                            <code className="text-xs font-mono block p-3 rounded-xl mb-3" style={{ background: '#0f172a', color: '#4ade80' }}>{msg.suggested_action}</code>
                                            <button onClick={() => handleExecuteAction(i, msg.suggested_action!)} disabled={executing !== null}
                                                className="w-full py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                                                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 2px 10px rgba(124,58,237,0.3)' }}>
                                                {executing === i ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                                Approve & Execute
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}

                    {/* Thinking */}
                    {loading && (
                        <div className="flex gap-3.5 max-w-3xl mr-auto">
                            <div className="shrink-0 w-8 h-8 rounded-2xl flex items-center justify-center shadow-md" style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}>
                                <Bot size={14} color="white" />
                            </div>
                            <div>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">AI Assistant</span>
                                <div className="mt-1 flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm text-sm text-gray-500">
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    Thinking…
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4 shrink-0" />
                </div>

                {/* Input */}
                <div className="shrink-0 px-4 sm:px-10 pb-5 pt-3 bg-white/80 backdrop-blur-md border-t border-gray-100">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex gap-3 items-center p-1.5 bg-white border border-gray-200 rounded-2xl shadow-lg shadow-gray-100/80 focus-within:border-violet-300 focus-within:shadow-violet-100/60 transition-all">
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                placeholder={connectionString ? "Ask anything about your database…" : "Connect a database first"}
                                disabled={!connectionString}
                                style={{ color: '#111827' }}
                                className="flex-1 px-4 py-2.5 text-sm bg-transparent border-none outline-none placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            />
                            {loading ? (
                                <button onClick={() => { abortController?.abort(); setLoading(false); }}
                                    className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all hover:bg-red-100"
                                    style={{ background: '#ffe4e6', color: '#e11d48' }}>
                                    <StopCircle size={18} />
                                </button>
                            ) : (
                                <button onClick={() => handleSend()} disabled={!input.trim() || !connectionString}
                                    className="flex items-center justify-center w-10 h-10 rounded-xl text-white shrink-0 transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                                    style={{ background: input.trim() ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : '#e2e8f0', color: input.trim() ? 'white' : '#94a3b8' }}>
                                    <Send size={16} />
                                </button>
                            )}
                        </div>
                        <p className="text-center text-[10px] text-gray-400 mt-2">AI can make mistakes. Always review SQL before approving execution.</p>
                    </div>
                </div>

            </div>
        </DashboardShell>
    );
}
