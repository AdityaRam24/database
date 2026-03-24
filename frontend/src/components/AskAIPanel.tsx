'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, X, Send, Bot, User, StopCircle, Globe, Play, BarChart2, Lightbulb, Shield, ChevronDown, Trash2, DollarSign, Leaf } from 'lucide-react';

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
            cost_estimate: {
                dollar_cost_display: string;
                co2_display: string;
            };
            plan_summary: {
                estimated_rows: number;
                node_type: string;
            };
        } | null;
    } | null;
    loading_query?: boolean;
}

interface AskAIPanelProps {
    connectionString: string;
    businessRules?: string;
}

const LANGUAGES = [
    { code: 'english', label: '🇺🇸 EN' },
    { code: 'hindi', label: '🇮🇳 HI' },
    { code: 'spanish', label: '🇪🇸 ES' },
    { code: 'french', label: '🇫🇷 FR' },
    { code: 'arabic', label: '🇸🇦 AR' },
    { code: 'german', label: '🇩🇪 DE' },
];

// Simple inline bar chart
function MiniBarChart({ columns, rows }: { columns: string[]; rows: any[][] }) {
    if (rows.length === 0 || columns.length < 2) return null;
    const labelCol = 0;
    const valueCol = 1;
    const values = rows.map(r => Number(r[valueCol]) || 0);
    const max = Math.max(...values, 1);
    return (
        <div className="mt-3 p-3 rounded-xl border border-gray-200" style={{ background: '#f8fafc' }}>
            <div className="text-xs text-violet-600 font-bold mb-2 uppercase tracking-wider">
                <BarChart2 size={12} className="inline mr-1" /> Auto Chart
            </div>
            <div className="space-y-1.5">
                {rows.slice(0, 8).map((row, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 font-medium w-20 truncate">{String(row[labelCol])}</span>
                        <div className="flex-1 flex items-center gap-1">
                            <div
                                className="h-4 rounded"
                                style={{
                                    width: `${Math.max(4, (values[i] / max) * 100)}%`,
                                    background: 'linear-gradient(90deg, #8b5cf6, #6366f1)',
                                    minWidth: 4
                                }}
                            />
                            <span className="text-gray-700 font-bold">{row[valueCol]}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Inline result table
function ResultTable({ columns, rows }: { columns: string[]; rows: any[][] }) {
    return (
        <div className="mt-3 overflow-x-auto rounded-xl shadow-sm" style={{ border: '1px solid #e2e8f0', maxHeight: 200 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                    <tr style={{ background: '#f8fafc' }}>
                        {columns.map(col => (
                            <th key={col} style={{ padding: '8px 10px', textAlign: 'left', color: '#4f46e5', fontWeight: 800, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.slice(0, 20).map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                            {row.map((cell, j) => (
                                <td key={j} style={{ padding: '6px 10px', color: '#334155', fontWeight: 500, whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {cell === null ? <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>NULL</span> : String(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length > 20 && <p style={{ padding: '6px 10px', color: '#64748b', fontSize: 10, background: '#f8fafc', fontWeight: 600, borderTop: '1px solid #e2e8f0', margin: 0 }}>… and {rows.length - 20} more rows</p>}
        </div>
    );
}

const AskAIPanel: React.FC<AskAIPanelProps> = ({ connectionString, businessRules = '' }) => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: 'Hi! I\'ve read your database schema.\n\n✦ Ask me anything about your tables\n✦ Request schema changes (I\'ll execute them safely)\n✦ Ask for data queries — I\'ll run them and show results\n✦ Type in any language!\n\nTry: *"show me the top 5 users"* or *"add email_verified column to users"*' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [executing, setExecuting] = useState<number | null>(null);
    const [language, setLanguage] = useState('english');
    const [showLangPicker, setShowLangPicker] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const getConversationHistory = () => {
        return messages.map(m => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.content
        }));
    };

    const handleStop = () => {
        abortController?.abort();
        setLoading(false);
        setMessages(prev => [...prev, { role: 'ai', content: '⏹️ Request cancelled.' }]);
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const question = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: question }]);
        setLoading(true);

        const ctrl = new AbortController();
        setAbortController(ctrl);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connection_string: connectionString,
                    question,
                    language,
                    conversation_history: getConversationHistory(),
                    business_rules: businessRules
                }),
                signal: ctrl.signal
            });
            const data = await res.json();
            setMessages(prev => [...prev, {
                role: 'ai',
                content: data.answer || 'Sorry, I got an empty response.',
                suggested_action: data.suggested_action
            }]);
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                setMessages(prev => [...prev, { role: 'ai', content: '❌ Could not reach the AI service. Please check your Ollama server.' }]);
            }
        } finally {
            setLoading(false);
            setAbortController(null);
        }
    };

    const handleRunQuery = async (msgIndex: number, question: string) => {
        setMessages(prev => {
            const n = [...prev];
            n[msgIndex] = { ...n[msgIndex], loading_query: true, query_result: null };
            return n;
        });
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connection_string: connectionString,
                    question,
                    language,
                    conversation_history: getConversationHistory(),
                    business_rules: businessRules
                }),
            });
            const data = await res.json();
            // Fetch query cost if SQL was generated
            let costData = null;
            if (data.sql && !data.error) {
                try {
                    const costRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/query-cost`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ connection_string: connectionString, sql: data.sql }),
                    });
                    costData = await costRes.json();
                } catch (e) { /* cost estimation is non-critical */ }
            }
            setMessages(prev => {
                const n = [...prev];
                n[msgIndex] = { ...n[msgIndex], loading_query: false, query_result: { ...data, query_cost: costData } };
                return n;
            });
        } catch (e) {
            setMessages(prev => {
                const n = [...prev];
                n[msgIndex] = { ...n[msgIndex], loading_query: false, query_result: { rows: [], columns: [], error: 'Failed to run query.', chart_type: null, explanation: null, attempts: 0, sql: '' } };
                return n;
            });
        }
    };

    const handleExecuteAction = async (msgIndex: number, sql: string) => {
        setExecuting(msgIndex);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/optimization/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connection_string: connectionString,
                    sql_command: sql,
                    id: `chat-action-${Date.now()}`
                }),
            });
            const data = await res.json();
            if (data.success) {
                setMessages(prev => {
                    const n = [...prev];
                    delete n[msgIndex].suggested_action;
                    return [...n, { role: 'ai', content: '✅ Command executed successfully! Your schema has been updated.' }];
                });
            } else {
                setMessages(prev => [...prev, { role: 'ai', content: `❌ Execution failed: ${data.error || data.detail}` }]);
            }
        } catch (e) {
            setMessages(prev => [...prev, { role: 'ai', content: '❌ Failed to connect to server for execution.' }]);
        } finally {
            setExecuting(null);
        }
    };

    const handleClearChat = () => {
        setMessages([{ role: 'ai', content: 'Chat cleared. Ask me anything about your database!' }]);
    };

    const selectedLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setOpen(true)}
                className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-full text-white font-semibold shadow-xl transition-all hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 24px rgba(124,58,237,0.5)' }}
            >
                <Bot size={20} />
                Ask AI
            </button>

            {/* Panel */}
            {open && (
                <div className="fixed bottom-6 right-6 z-50 flex flex-col" style={{
                    width: 420,
                    height: 600,
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 24,
                    boxShadow: '0 20px 40px -8px rgba(0,0,0,0.15), 0 0 2px 0 rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', padding: '14px 18px' }}>
                        <div className="flex items-center justify-between">
                            <span className="text-white font-bold flex items-center gap-2 text-sm">
                                <Bot size={18} /> AI Assistant
                                <span className="text-xs opacity-70 font-normal ml-1">Qwen2.5-Coder · Ollama</span>
                            </span>
                            <div className="flex items-center gap-2">
                                <button onClick={handleClearChat} title="Clear chat" className="text-white/60 hover:text-white transition-colors">
                                    <Trash2 size={15} />
                                </button>
                                <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        {/* Model / Security badges */}
                        <div className="flex items-center gap-2 mt-2">
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
                                <Shield size={10} /> Guardrails ON
                            </span>
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
                                🔄 Self-healing SQL
                            </span>
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.2)', color: 'rgba(134,239,172,0.9)' }}>
                                🛡️ Firewall Active
                            </span>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50" style={{ flex: 1 }}>
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} max-w-[90%]`}>
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: msg.role === 'ai' ? '#8b5cf6' : '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                        {msg.role === 'ai' ? <Bot size={13} color="white" /> : <User size={13} color="white" />}
                                    </div>
                                    <div style={{
                                        maxWidth: '100%',
                                        padding: '10px 14px',
                                        borderRadius: 16,
                                        borderTopLeftRadius: msg.role === 'ai' ? 4 : 16,
                                        borderTopRightRadius: msg.role === 'user' ? 4 : 16,
                                        background: msg.role === 'user' ? '#4f46e5' : '#ffffff',
                                        color: msg.role === 'user' ? '#ffffff' : '#111827',
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                        whiteSpace: 'pre-wrap',
                                        border: msg.role === 'ai' ? '1px solid #e2e8f0' : 'none',
                                        boxShadow: msg.role === 'ai' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                    }}>
                                        {msg.content}

                                        {/* Run Query button (shown for AI messages with data keywords) */}
                                        {msg.role === 'ai' && i > 0 && (
                                            <div className="mt-2 flex gap-2 flex-wrap">
                                                <button
                                                    onClick={() => handleRunQuery(i, messages[i - 1]?.content || msg.content)}
                                                    disabled={!!msg.loading_query}
                                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all hover:bg-violet-50 font-semibold mt-1"
                                                    style={{ border: '1px solid #c4b5fd', color: '#6d28d9', background: '#f5f3ff' }}
                                                >
                                                    {msg.loading_query
                                                        ? <><Loader2 size={12} className="animate-spin" /> Running…</>
                                                        : <><Play size={12} fill="currentColor" /> Run as Query</>
                                                    }
                                                </button>
                                            </div>
                                        )}

                                        {/* Query results */}
                                        {msg.query_result && (
                                            <div className="mt-2">
                                                {msg.query_result.error ? (
                                                    <div className="text-xs px-3 py-2 rounded-lg font-medium shadow-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                                                        ❌ {msg.query_result.error}
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* SQL shown */}
                                                        <div className="mb-2 p-2.5 rounded-lg text-xs font-mono shadow-inner font-semibold" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#059669' }}>
                                                            {msg.query_result.sql}
                                                        </div>
                                                        {msg.query_result.explanation && (
                                                            <div className="mb-2 flex items-start gap-1.5 text-xs font-medium" style={{ color: '#64748b' }}>
                                                                <Lightbulb size={12} className="mt-0.5 text-amber-500 flex-shrink-0" />
                                                                {msg.query_result.explanation}
                                                            </div>
                                                        )}
                                                        {msg.query_result.attempts > 1 && (
                                                            <div className="text-xs mb-1 font-bold" style={{ color: '#94a3b8' }}>
                                                                🔄 Self-healed in {msg.query_result.attempts} attempt{msg.query_result.attempts > 1 ? 's' : ''}
                                                            </div>
                                                        )}
                                                        {/* Chart */}
                                                        {msg.query_result.chart_type && (
                                                            <MiniBarChart columns={msg.query_result.columns} rows={msg.query_result.rows} />
                                                        )}
                                                        {/* Table */}
                                                        {msg.query_result.rows.length > 0 && (
                                                            <ResultTable columns={msg.query_result.columns} rows={msg.query_result.rows} />
                                                        )}
                                                        <div className="text-xs mt-2 font-bold" style={{ color: '#94a3b8' }}>
                                                            {msg.query_result.rows.length} row{msg.query_result.rows.length !== 1 ? 's' : ''} · LIMIT 100 applied
                                                        </div>
                                                        {/* Query Price Tag */}
                                                        {msg.query_result.query_cost && (
                                                            <div className="mt-2.5 flex items-center gap-3 px-3 py-2 rounded-lg shadow-sm" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                                                                <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#d97706' }}>
                                                                    <DollarSign size={13} />
                                                                    {msg.query_result.query_cost.cost_estimate.dollar_cost_display}
                                                                </span>
                                                                <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#059669' }}>
                                                                    <Leaf size={13} />
                                                                    {msg.query_result.query_cost.cost_estimate.co2_display}
                                                                </span>
                                                                <span className="text-[10px]" style={{
                                                                    color: msg.query_result.query_cost.rating === 'cheap' ? '#16a34a' : msg.query_result.query_cost.rating === 'moderate' ? '#ea580c' : '#dc2626',
                                                                    fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 6px', background: 'white', borderRadius: 4, border: '1px solid #fcd34d'
                                                                }}>
                                                                    {msg.query_result.query_cost.rating}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Suggested execute action */}
                                        {msg.suggested_action && (
                                            <div className="mt-3 p-3.5 rounded-xl shadow-sm" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                <div className="text-xs uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5" style={{ color: '#6d28d9' }}>
                                                    <Lightbulb size={12} /> Suggested Command
                                                </div>
                                                <code className="text-xs font-mono block mb-3 p-2.5 rounded-lg border bg-white border-gray-100" style={{ color: '#059669' }}>
                                                    {msg.suggested_action}
                                                </code>
                                                <Button
                                                    size="sm"
                                                    className="w-full h-8 text-xs font-bold"
                                                    style={{ background: '#7c3aed', color: 'white' }}
                                                    onClick={() => handleExecuteAction(i, msg.suggested_action!)}
                                                    disabled={executing !== null}
                                                >
                                                    {executing === i ? <Loader2 size={12} className="animate-spin mr-1" /> : <Send size={12} className="mr-1" />}
                                                    Approve & Execute
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex gap-2 items-center">
                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                    <Bot size={13} color="white" />
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-sm" style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#6d28d9', borderTopLeftRadius: 4 }}>
                                    <Loader2 size={12} className="animate-spin" />
                                    Thinking...
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input area */}
                    <div className="bg-white" style={{ padding: '16px', borderTop: '1px solid #f1f5f9' }}>
                        {/* Language picker */}
                        <div className="relative mb-3">
                            <button
                                onClick={() => setShowLangPicker(p => !p)}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all hover:bg-gray-50 font-bold shadow-sm"
                                style={{ border: '1px solid #e2e8f0', color: '#64748b', background: '#ffffff' }}
                            >
                                <Globe size={11} className="text-violet-500" />
                                {selectedLang.label}
                                <ChevronDown size={11} className="ml-0.5" />
                            </button>
                            {showLangPicker && (
                                <div className="absolute bottom-10 left-0 z-10 p-1.5 rounded-xl shadow-lg border border-gray-100 bg-white min-w-[140px]">
                                    {LANGUAGES.map(lang => (
                                        <button
                                            key={lang.code}
                                            onClick={() => { setLanguage(lang.code); setShowLangPicker(false); }}
                                            className="block w-full text-left font-bold text-xs px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors"
                                        >
                                            {lang.label} <span className="text-gray-400 font-medium ml-1 float-right">{lang.code}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                placeholder="Ask anything or describe a change..."
                                style={{
                                    flex: 1, border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px',
                                    color: '#111827', fontSize: 13, outline: 'none',
                                    background: '#f8fafc', transition: 'all 0.2s',
                                    fontWeight: 500,
                                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                                }}
                                onFocus={e => { e.target.style.borderColor = '#8b5cf6'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 4px rgba(139,92,246,0.1)'; }}
                                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.02)'; }}
                                className="placeholder:text-gray-400"
                            />
                            {loading ? (
                                <button
                                    onClick={handleStop}
                                    className="flex items-center justify-center rounded-xl transition-all hover:bg-rose-100 shadow-sm"
                                    style={{ background: '#ffe4e6', border: '1px solid #fecaca', padding: '0 16px', color: '#e11d48' }}
                                    title="Stop generation"
                                >
                                    <StopCircle size={18} />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim()}
                                    className="flex items-center justify-center rounded-xl transition-all hover:scale-105"
                                    style={{
                                        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                        border: 'none', padding: '0 18px',
                                        cursor: input.trim() ? 'pointer' : 'not-allowed',
                                        opacity: input.trim() ? 1 : 0.4
                                    }}
                                >
                                    <Send size={17} color="white" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AskAIPanel;
