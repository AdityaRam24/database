'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, X, Send, Bot, User } from 'lucide-react';

interface Message {
    role: 'user' | 'ai';
    content: string;
    suggested_action?: string;
}

interface AskAIPanelProps {
    connectionString: string;
}

const AskAIPanel: React.FC<AskAIPanelProps> = ({ connectionString }) => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: 'Hi! I\'ve read your database schema. Ask me anything — table structure, relationships, or even suggest changes!' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [executing, setExecuting] = useState<number | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const question = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: question }]);
        setLoading(true);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, question }),
            });
            const data = await res.json();
            setMessages(prev => [...prev, {
                role: 'ai',
                content: data.answer || 'Sorry, I got an empty response.',
                suggested_action: data.suggested_action
            }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I could not reach the AI service right now.' }]);
        } finally {
            setLoading(false);
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
                setMessages(prev => [...prev, { role: 'ai', content: '✅ Command executed successfully! Your schema has been updated.' }]);
                // Remove the action button after success
                setMessages(prev => {
                    const newMsgs = [...prev];
                    delete newMsgs[msgIndex].suggested_action;
                    return newMsgs;
                });
            } else {
                setMessages(prev => [...prev, { role: 'ai', content: `❌ Execution failed: ${data.error}` }]);
            }
        } catch (e) {
            setMessages(prev => [...prev, { role: 'ai', content: '❌ Failed to connect to server for execution.' }]);
        } finally {
            setExecuting(null);
        }
    };

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setOpen(true)}
                className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full text-white font-semibold shadow-xl transition-all hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 20px rgba(124,58,237,0.5)' }}
            >
                <Bot size={20} />
                Ask AI
            </button>

            {/* Panel */}
            {open && (
                <div className="fixed bottom-6 right-6 z-50 flex flex-col" style={{
                    width: 400,
                    height: 560,
                    background: '#0f0f1a',
                    border: '1px solid #3b0764',
                    borderRadius: 16,
                    boxShadow: '0 8px 40px rgba(124,58,237,0.3)',
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-white font-bold flex items-center gap-2"><Bot size={18} /> AI Assistant</span>
                        <button onClick={() => setOpen(false)} className="text-white opacity-70 hover:opacity-100"><X size={18} /></button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ flex: 1 }}>
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: msg.role === 'ai' ? '#7c3aed' : '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {msg.role === 'ai' ? <Bot size={14} color="white" /> : <User size={14} color="white" />}
                                    </div>
                                    <div style={{
                                        maxWidth: '85%',
                                        padding: '10px 14px',
                                        borderRadius: 12,
                                        background: msg.role === 'user' ? '#4f46e5' : '#1a1a2e',
                                        color: '#e2e8f0',
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                        whiteSpace: 'pre-wrap',
                                        border: msg.role === 'ai' ? '1px solid #2e2e4e' : 'none',
                                    }}>
                                        {msg.content}

                                        {msg.suggested_action && (
                                            <div className="mt-3 p-3 bg-black/40 rounded-lg border border-purple-500/30">
                                                <div className="text-[11px] uppercase tracking-wider text-purple-400 font-bold mb-2">Suggested Command:</div>
                                                <code className="text-xs text-green-400 font-mono block mb-3 break-all">{msg.suggested_action}</code>
                                                <Button
                                                    size="sm"
                                                    className="w-full bg-purple-600 hover:bg-purple-700 h-8 text-xs font-bold"
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
                            <div className="flex gap-2 justify-start">
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={14} color="white" /></div>
                                <div style={{ padding: '8px 12px', borderRadius: '12px 12px 12px 2px', background: '#1e1e2e', border: '1px solid #2e2e4e' }}>
                                    <Loader2 size={14} className="animate-spin text-purple-400" />
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div style={{ padding: '16px', borderTop: '1px solid #2e2e4e', background: '#0a0a14', display: 'flex', gap: 10 }}>
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder="Type a message or command..."
                            className="bg-zinc-900 border-zinc-800 focus:border-purple-500/50"
                            style={{ flex: 1, border: '1px solid #3b0764', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 13, outline: 'none' }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', borderRadius: 8, padding: '0 16px', cursor: 'pointer', opacity: loading || !input.trim() ? 0.5 : 1 }}
                        >
                            <Send size={18} color="white" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default AskAIPanel;
