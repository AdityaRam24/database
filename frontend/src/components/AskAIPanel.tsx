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
        <div className="mt-3 p-3 rounded-lg ai-code-block border-0">
            <div className="text-xs text-purple-500 dark:text-purple-400 font-bold mb-2 uppercase tracking-wider">
                <BarChart2 size={12} className="inline mr-1" /> Auto Chart
            </div>
            <div className="space-y-1.5">
                {rows.slice(0, 8).map((row, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-20 truncate">{String(row[labelCol])}</span>
                        <div className="flex-1 flex items-center gap-1">
                            <div
                                className="h-4 rounded"
                                style={{
                                    width: `${Math.max(4, (values[i] / max) * 100)}%`,
                                    background: 'linear-gradient(90deg, #7c3aed, #4f46e5)',
                                    minWidth: 4
                                }}
                            />
                            <span className="text-foreground">{row[valueCol]}</span>
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
        <div className="mt-3 overflow-x-auto rounded-lg ai-table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                    <tr className="ai-table-head">
                        {columns.map(col => (
                            <th key={col} className="text-violet-500 dark:text-violet-400 font-bold border-b border-border" style={{ padding: '6px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-b border-border/50">
                            {row.map((cell, j) => (
                                <td key={j} className="text-foreground" style={{ padding: '5px 10px', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {cell === null ? <span className="text-muted-foreground/50">NULL</span> : String(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length > 20 && <p className="text-muted-foreground/50" style={{ padding: '4px 10px', fontSize: 10 }}>… and {rows.length - 20} more rows</p>}
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
                className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-full text-white font-semibold transition-all hover:scale-105 active:scale-95 hover:shadow-[0_8px_32px_rgba(124,58,237,0.5)]"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 24px rgba(124,58,237,0.4)' }}
                aria-label="Open AI Assistant"
            >
                <Bot size={20} />
                Ask AI
            </button>

            {/* Panel */}
            {open && (
                <div className="fixed bottom-6 right-6 z-50 flex flex-col ai-panel" style={{
                    width: 420,
                    height: 600,
                    borderRadius: 18,
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div className="ai-panel-header" style={{ padding: '14px 18px' }}>
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
                    <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ flex: 1 }}>
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} max-w-[90%]`}>
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: msg.role === 'ai' ? '#7c3aed' : '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {msg.role === 'ai' ? <Bot size={13} color="white" /> : <User size={13} color="white" />}
                                    </div>
                                    <div className={msg.role === 'user' ? 'ai-bubble-user' : 'ai-bubble-ai'} style={{
                                        maxWidth: '100%',
                                        padding: '10px 14px',
                                        borderRadius: 12,
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                        whiteSpace: 'pre-wrap',
                                    }}>
                                        {msg.content}

                                        {/* Run Query button (shown for AI messages with data keywords) */}
                                        {msg.role === 'ai' && i > 0 && (
                                            <div className="mt-2 flex gap-2 flex-wrap">
                                                <button
                                                    onClick={() => handleRunQuery(i, messages[i - 1]?.content || msg.content)}
                                                    disabled={!!msg.loading_query}
                                                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-all hover:opacity-80"
                                                    style={{ background: 'rgba(79,70,229,0.2)', border: '1px solid rgba(79,70,229,0.4)', color: '#a5b4fc' }}
                                                >
                                                    {msg.loading_query
                                                        ? <><Loader2 size={10} className="animate-spin" /> Running…</>
                                                        : <><Play size={10} /> Run as Query</>
                                                    }
                                                </button>
                                            </div>
                                        )}

                                        {/* Query results */}
                                        {msg.query_result && (
                                            <div className="mt-2">
                                                {msg.query_result.error ? (
                                                    <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#1a0808', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
                                                        ❌ {msg.query_result.error}
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* SQL shown */}
                                                        <div className="mb-2 p-2 rounded text-xs font-mono ai-code-block border-0">
                                                            {msg.query_result.sql}
                                                        </div>
                                                        {msg.query_result.explanation && (
                                                            <div className="mb-2 flex items-start gap-1.5 text-xs" style={{ color: '#94a3b8' }}>
                                                                <Lightbulb size={11} className="mt-0.5 text-yellow-400 flex-shrink-0" />
                                                                {msg.query_result.explanation}
                                                            </div>
                                                        )}
                                                        {msg.query_result.attempts > 1 && (
                                                            <div className="text-xs mb-1" style={{ color: '#6b7280' }}>
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
                                                        <div className="text-xs mt-1" style={{ color: '#4b5563' }}>
                                                            {msg.query_result.rows.length} row{msg.query_result.rows.length !== 1 ? 's' : ''} · LIMIT 100 applied
                                                        </div>
                                                        {/* Query Price Tag */}
                                                        {msg.query_result.query_cost && (
                                                            <div className="mt-2 flex items-center gap-3 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                                                <span className="flex items-center gap-1 text-xs" style={{ color: '#fbbf24' }}>
                                                                    <DollarSign size={11} />
                                                                    {msg.query_result.query_cost.cost_estimate.dollar_cost_display}
                                                                </span>
                                                                <span className="flex items-center gap-1 text-xs" style={{ color: '#86efac' }}>
                                                                    <Leaf size={11} />
                                                                    {msg.query_result.query_cost.cost_estimate.co2_display}
                                                                </span>
                                                                <span className="text-xs" style={{
                                                                    color: msg.query_result.query_cost.rating === 'cheap' ? '#86efac' : msg.query_result.query_cost.rating === 'moderate' ? '#fdba74' : '#fca5a5',
                                                                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'
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
                                            <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(124,58,237,0.3)' }}>
                                                <div className="text-xs uppercase tracking-wider font-bold mb-2" style={{ color: '#a78bfa' }}>
                                                    Suggested Command
                                                </div>
                                                <code className="text-xs font-mono block mb-3" style={{ color: '#6ee7b7' }}>
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
                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Bot size={13} color="white" />
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs ai-typing-indicator">
                                    <Loader2 size={12} className="animate-spin" />
                                    Thinking...
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input area */}
                    <div className="ai-input-area" style={{ padding: '12px 16px' }}>
                        {/* Language picker */}
                        <div className="relative mb-2">
                            <button
                                onClick={() => setShowLangPicker(p => !p)}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-all hover:opacity-80"
                                style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }}
                            >
                                <Globe size={11} />
                                {selectedLang.label}
                                <ChevronDown size={11} />
                            </button>
                            {showLangPicker && (
                                <div className="absolute bottom-8 left-0 z-10 p-1 rounded-xl shadow-xl" style={{ background: '#1a1a2e', border: '1px solid #3b0764' }}>
                                    {LANGUAGES.map(lang => (
                                        <button
                                            key={lang.code}
                                            onClick={() => { setLanguage(lang.code); setShowLangPicker(false); }}
                                            className="block w-full text-left text-xs px-3 py-1.5 rounded-lg hover:bg-purple-900/30 text-gray-300 hover:text-white"
                                        >
                                            {lang.label} <span className="text-gray-500 ml-1">{lang.code}</span>
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
                                className="ai-input-field flex-1"
                            />
                            {loading ? (
                                <button
                                    onClick={handleStop}
                                    className="flex items-center justify-center rounded-xl transition-all hover:opacity-80"
                                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', padding: '0 16px', color: '#f87171' }}
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
