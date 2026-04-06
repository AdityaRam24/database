'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Loader2, Send, Bot, User, StopCircle, Globe,
    Play, BarChart2, Lightbulb, Shield, ChevronDown, Trash2,
    DollarSign, Leaf, Sparkles, Database, Table2, Hash, GitMerge,
    Zap, HardDrive, Tag, RefreshCw, Mic, MicOff, Volume2, VolumeX,
    MessageCircle, CheckCircle2, AlertCircle, Wand2, Stars, Info
} from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Types ─────────────────────────────────────────────────────── */
interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
    suggested_action?: string;
    query_result?: {
        rows: any[][];
        columns: string[];
        error: string | null;
        chart_type: string | null;
        explanation: string | null;
        attempts: number;
        sql: string;
        firewall_blocked?: boolean;
        query_cost?: {
            rating: string;
            cost_estimate: { dollar_cost_display: string; co2_display: string };
        } | null;
    } | null;
    loading_query?: boolean;
}

/* ─── Constants ──────────────────────────────────────────────────── */
const LANGUAGES = [
    { code: 'english', label: '🇺🇸 English' },
    { code: 'hindi',   label: '🇮🇳 Hindi'   },
    { code: 'spanish', label: '🇪🇸 Spanish'  },
    { code: 'french',  label: '🇫🇷 French'   },
    { code: 'arabic',  label: '🇸🇦 Arabic'   },
    { code: 'german',  label: '🇩🇪 German'   },
];

const FRIENDLY_TUTOR_RULES = `
CRITICAL COMMUNICATION RULES you MUST always follow:
1. Always explain as if talking to a curious 10-year-old — smart but no tech background.
2. Replace ALL jargon with everyday analogies in parentheses.
   Example: "INDEX (like a book's table of contents that helps you find pages fast)"
3. Keep paragraphs SHORT. Use bullet points for lists.
4. Use 1-2 emojis per response to feel warm — never overdo it.
5. Always end with "In short: [one simple sentence summary]."
6. Be encouraging and friendly. Never be cold or robotic.
7. For query results: describe what it means in human terms BEFORE showing data.
`;

const STARTERS = [
    { text: 'What tables are in my database?', emoji: '📋', color: '#7c3aed' },
    { text: 'Which table has the most records?', emoji: '📊', color: '#0891b2' },
    { text: 'How are my tables connected?', emoji: '🔗', color: '#059669' },
    { text: 'Is my database running fast?', emoji: '⚡', color: '#d97706' },
    { text: 'How much storage am I using?', emoji: '💾', color: '#dc2626' },
    { text: 'What type of data do I store?', emoji: '🏷️', color: '#7c3aed' },
];

/* ─── Utility: simple text formatter (bold + line-breaks) ─────────── */
function FormattedText({ text }: { text: string }) {
    const lines = text.split('\n');
    return (
        <div className="flex flex-col gap-1.5">
            {lines.map((line, i) => {
                if (!line.trim()) return <div key={i} className="h-1" />;
                const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-') || /^\d+\./.test(line.trim());
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                const rendered = parts.map((part, j) =>
                    part.startsWith('**') && part.endsWith('**')
                        ? <strong key={j} className="font-black text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>
                        : <span key={j}>{part}</span>
                );
                return (
                    <div key={i} className={isBullet ? 'flex gap-2 items-start' : ''}>
                        {isBullet && <span className="text-violet-400 mt-0.5 shrink-0">›</span>}
                        <span className="leading-relaxed">{rendered}</span>
                    </div>
                );
            })}
        </div>
    );
}

/* ─── Subcomponents ──────────────────────────────────────────────── */
function TypingWave() {
    return (
        <div className="flex items-end gap-1 h-5">
            {[0, 0.15, 0.30].map((d, i) => (
                <motion.div
                    key={i}
                    className="w-1.5 rounded-full bg-violet-400"
                    animate={{ height: ['6px', '14px', '6px'] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: d, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

function MiniBarChart({ columns, rows }: { columns: string[]; rows: any[][] }) {
    if (!rows.length || columns.length < 2) return null;
    const values = rows.map(r => Number(r[1]) || 0);
    const max = Math.max(...values, 1);
    return (
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-violet-50 via-indigo-50 to-white dark:from-violet-500/10 dark:via-indigo-500/10 dark:to-white/[0.02] border border-violet-100 dark:border-violet-500/20">
            <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <BarChart2 size={11}/> Visual Breakdown
            </p>
            <div className="space-y-2.5">
                {rows.slice(0, 8).map((row, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                        <span className="w-24 text-slate-600 font-bold truncate shrink-0">{String(row[0])}</span>
                        <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 h-2.5 bg-white dark:bg-white/[0.06] rounded-full overflow-hidden shadow-inner border border-violet-100 dark:border-violet-500/20">
                                <motion.div className="h-full rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.max(4, (values[i] / max) * 100)}%` }}
                                    transition={{ duration: 0.9, delay: i * 0.06, ease: 'easeOut' }}
                                    style={{ background: `linear-gradient(90deg, hsl(${255 - i*14},80%,65%), hsl(${238 - i*14},70%,58%))` }}
                                />
                            </div>
                            <span className="text-slate-800 font-black w-10 text-right tabular-nums">{row[1]}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DataTable({ columns, rows }: { columns: string[]; rows: any[][] }) {
    const [limit, setLimit] = useState(8);
    return (
        <div className="mt-4 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.07] shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                    <thead>
                        <tr style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)' }} className="dark:!bg-violet-500/10">
                            {columns.map(c => (
                                <th key={c} className="text-violet-700 dark:text-violet-300 font-black text-left px-4 py-2.5 whitespace-nowrap text-[10px] uppercase tracking-widest border-b border-violet-100 dark:border-violet-500/20">{c}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.slice(0, limit).map((row, i) => (
                            <tr key={i} className={`border-b border-slate-50 dark:border-white/[0.04] hover:bg-violet-50/30 dark:hover:bg-violet-500/5 transition-colors ${i % 2 === 0 ? 'bg-white dark:bg-white/[0.02]' : 'bg-slate-50/50 dark:bg-white/[0.01]'}`}>
                                {row.map((cell, j) => (
                                    <td key={j} className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {cell === null ? <span className="italic text-slate-300">empty</span> : String(cell)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {rows.length > limit ? (
                <button onClick={() => setLimit(rows.length)} className="w-full text-center text-[11px] font-black text-violet-600 py-3 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors border-t border-violet-100 dark:border-violet-500/20 uppercase tracking-widest">
                    Show all {rows.length} rows ↓
                </button>
            ) : rows.length > 8 && (
                <button onClick={() => setLimit(8)} className="w-full text-center text-[11px] font-black text-slate-400 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors border-t border-slate-100 uppercase tracking-widest">
                    Show less ↑
                </button>
            )}
        </div>
    );
}

/* ─── Main Page ────────────────────────────────────────────────────── */
export default function AskAIPage() {
    const [connectionString, setConnectionString] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [language, setLanguage] = useState('english');
    const [showLangPicker, setShowLangPicker] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [executing, setExecuting] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const activeRecogRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const [useWhisperFallback, setUseWhisperFallback] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);

    const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const addMessage = (msg: Omit<Message, 'id'>) =>
        setMessages(prev => [...prev, { ...msg, id: genId() }]);

    /* Scroll to bottom */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    /* Init connection */
    useEffect(() => {
        const cs = localStorage.getItem('db_connection_string') || '';
        setConnectionString(cs);
        const handler = () => setConnectionString(localStorage.getItem('db_connection_string') || '');
        window.addEventListener('project-changed', handler);
        return () => window.removeEventListener('project-changed', handler);
    }, []);

    /* Check browser speech support + detect if we should use Whisper fallback */
    useEffect(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        // Always show the mic button — we'll try SpeechRecognition first and fall back to Whisper
        setSpeechSupported(true);
        // If not on HTTPS and not a secure context, pre-select Whisper mode
        if (!window.isSecureContext) {
            setUseWhisperFallback(true);
        }
    }, []);

    /* Welcome message */
    useEffect(() => {
        if (connectionString) {
            setMessages([{
                id: 'welcome',
                role: 'ai',
                content: `👋 Hey there! I'm **Lumina**, your friendly database guide!\n\nI'm connected to your database and ready to help. Think of me as a super-smart friend who can look inside your data and explain everything in everyday language — no tech skills needed!\n\nYou can:\n• Type your question in the box below\n• 🎤 Tap the microphone and just speak to me\n• 🔊 Enable my voice so I can talk back to you\n\nIn short: I make databases easy and fun to understand! 🚀`,
                query_result: null,
            }]);
        }
    }, [connectionString]);

    /* ── MediaRecorder → local Whisper fallback ─────────────────────────
       Works on HTTP localhost without Google's servers.
       Records audio, POSTs to /api/voice/transcribe (faster-whisper).
    ─────────────────────────────────────────────────────────────────── */
    const startWhisperRecording = useCallback(async () => {
        setVoiceError(null);
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setMicPermission('granted');
        } catch {
            setMicPermission('denied');
            setVoiceError('🚫 Microphone access blocked. Click the 🔒 in your address bar and allow the microphone.');
            return;
        }

        audioChunksRef.current = [];
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            setIsListening(false);
            setIsTranscribing(true);
            setInput('');

            const blob = new Blob(audioChunksRef.current, { type: mimeType });
            const form = new FormData();
            form.append('audio', blob, `speech.${mimeType.split('/')[1]}`);

            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/voice/transcribe`, {
                    method: 'POST',
                    body: form,
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.detail || `HTTP ${res.status}`);
                }
                const data = await res.json();
                if (data.transcript) {
                    setInput(data.transcript);
                } else {
                    setVoiceError('🤫 Couldn\'t hear what you said. Please try again!');
                }
            } catch (e: any) {
                if (e.message?.includes('faster-whisper')) {
                    setVoiceError('⚙️ Local transcription not set up yet. Run: pip install faster-whisper  (in your backend)');
                } else {
                    setVoiceError(`Transcription error: ${e.message}`);
                }
            } finally {
                setIsTranscribing(false);
            }
        };

        recorder.start();
        setIsListening(true);
    }, []);

    /* ── Browser SpeechRecognition (HTTPS / secure context) ──────────── */
    const startBrowserSpeech = useCallback(async () => {
        setVoiceError(null);
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) { setUseWhisperFallback(true); startWhisperRecording(); return; }

        try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: true });
            s.getTracks().forEach(t => t.stop());
            setMicPermission('granted');
        } catch {
            setMicPermission('denied');
            setVoiceError('🚫 Microphone blocked. Allow it in your browser settings.');
            return;
        }

        const recognition = new SR();
        recognition.lang = language === 'hindi' ? 'hi-IN' : language === 'spanish' ? 'es-ES' : language === 'french' ? 'fr-FR' : language === 'arabic' ? 'ar-SA' : language === 'german' ? 'de-DE' : 'en-US';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        let finalTranscript = '';

        recognition.onstart = () => { setIsListening(true); setInput(''); };

        recognition.onresult = (e: any) => {
            let interim = '';
            finalTranscript = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript;
                if (e.results[i].isFinal) finalTranscript += t;
                else interim += t;
            }
            setInput(finalTranscript || interim);
        };

        recognition.onerror = (e: any) => {
            setIsListening(false);
            activeRecogRef.current = null;

            if (e.error === 'network' || e.error === 'service-not-allowed') {
                // Auto-switch to Whisper fallback instead of showing an error
                setUseWhisperFallback(true);
                setVoiceError('🔄 Switching to local voice mode (works offline). Tap the mic again!');
            } else if (e.error === 'no-speech') {
                setVoiceError('🤫 Didn\'t catch that — try speaking a bit closer to the mic!');
            } else if (e.error === 'not-allowed' || e.error === 'permission-denied') {
                setMicPermission('denied');
                setVoiceError('🚫 Mic blocked. Click the 🔒 in your address bar to allow it.');
            } else if (e.error !== 'aborted') {
                setVoiceError(`Voice error: "${e.error}". Try tapping the mic again.`);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            activeRecogRef.current = null;
            if (finalTranscript.trim()) setInput(finalTranscript.trim());
        };

        try {
            recognition.start();
            activeRecogRef.current = recognition;
        } catch {
            setVoiceError('Could not start voice. Tap the mic again.');
            setIsListening(false);
        }
    }, [language, startWhisperRecording]);

    const startListening = useCallback(() => {
        if (useWhisperFallback) {
            startWhisperRecording();
        } else {
            startBrowserSpeech();
        }
    }, [useWhisperFallback, startWhisperRecording, startBrowserSpeech]);

    const stopListening = useCallback(() => {
        if (activeRecogRef.current) {
            try { activeRecogRef.current.stop(); } catch {}
            activeRecogRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }
        setIsListening(false);
    }, []);

    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    /* TTS */
    const speak = useCallback((text: string) => {
        if (!ttsEnabled || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const clean = text.replace(/\*\*/g, '').replace(/[#`]/g, '').replace(/\n/g, ' ').slice(0, 600);
        const utter = new SpeechSynthesisUtterance(clean);
        utter.rate = 0.95;
        utter.pitch = 1.05;
        window.speechSynthesis.speak(utter);
    }, [ttsEnabled]);

    const getHistory = () => messages.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));

    const handleSend = async (text?: string) => {
        const q = (text ?? input).trim();
        if (!q || loading || !connectionString) return;
        setInput('');
        setVoiceError(null);
        if (isListening) stopListening();

        addMessage({ role: 'user', content: q, query_result: null });
        setLoading(true);
        const ctrl = new AbortController();
        setAbortController(ctrl);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, question: q, language, conversation_history: getHistory(), business_rules: FRIENDLY_TUTOR_RULES }),
                signal: ctrl.signal,
            });
            const data = await res.json();
            const reply = data.answer || 'Hmm, I got an empty response. Could you try rephrasing?';
            addMessage({ role: 'ai', content: reply, suggested_action: data.suggested_action, query_result: null });
            speak(reply);
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                addMessage({ role: 'ai', content: "😕 I couldn't reach the AI server. Please make sure your Ollama server is running!", query_result: null });
            }
        } finally {
            setLoading(false);
            setAbortController(null);
        }
    };

    const handleRunQuery = async (msgId: string, question: string) => {
        setMessages(p => p.map(m => m.id === msgId ? { ...m, loading_query: true, query_result: null } : m));
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/query`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, question, language, conversation_history: getHistory(), business_rules: FRIENDLY_TUTOR_RULES }),
            });
            const data = await res.json();
            let costData = null;
            if (data.sql && !data.error) {
                try {
                    const cr = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/query-cost`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ connection_string: connectionString, sql: data.sql }),
                    });
                    costData = await cr.json();
                } catch {}
            }
            setMessages(p => p.map(m => m.id === msgId ? { ...m, loading_query: false, query_result: { ...data, query_cost: costData } } : m));
        } catch {
            setMessages(p => p.map(m => m.id === msgId ? { ...m, loading_query: false, query_result: { rows: [], columns: [], error: 'Failed to run query.', chart_type: null, explanation: null, attempts: 0, sql: '' } } : m));
        }
    };

    const handleExecute = async (msgId: string, sql: string) => {
        setExecuting(msgId);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/optimization/apply`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, sql_command: sql, id: `chat-${Date.now()}` }),
            });
            const data = await res.json();
            if (data.success) {
                setMessages(p => p.map(m => m.id === msgId ? { ...m, suggested_action: undefined } : m));
                addMessage({ role: 'ai', content: '✅ Done! The change was applied successfully. Your database is now updated!', query_result: null });
            } else {
                addMessage({ role: 'ai', content: `😕 Something went wrong: ${data.error || data.detail}. Your database was NOT changed — don't worry!`, query_result: null });
            }
        } catch {
            addMessage({ role: 'ai', content: "😕 Couldn't connect to the server. Please try again!", query_result: null });
        } finally { setExecuting(null); }
    };

    const selectedLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];
    const clearChat = () => setMessages(connectionString ? [{ id: genId(), role: 'ai', content: '🧹 Chat cleared! What would you like to explore next?', query_result: null }] : []);

    /* ─────────────────────────── RENDER ─────────────────────────────── */
    return (
        <DashboardShell>
            <div
                className="flex flex-col mx-3 sm:mx-5 mb-4 rounded-3xl overflow-hidden bg-gradient-to-br from-[#fdfcff] to-[#f8f5ff] dark:bg-none dark:bg-white/[0.03] border border-[#ede9fe] dark:border-white/[0.06]"
                style={{
                    height: 'calc(100vh - 108px)',
                    boxShadow: '0 8px 48px rgba(124,58,237,0.07), 0 2px 8px rgba(0,0,0,0.04)',
                }}
            >

                {/* ────────── Header ────────── */}
                <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-violet-100/80 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="relative">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg"
                                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 16px rgba(124,58,237,0.35)' }}>
                                <Wand2 size={18} color="white" />
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" />
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-[15px] font-black text-slate-900 dark:text-slate-100 tracking-tight">Lumina</h1>
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"
                                    style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', color: '#6d28d9' }}>
                                    AI Guide
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Your friendly database companion</p>
                        </div>

                        <div className="hidden lg:flex items-center gap-1.5 ml-4 pl-4 border-l border-slate-100 dark:border-white/[0.06]">
                            {[
                                { icon: Shield, label: 'Safe Mode', bg: '#f3e8ff', fg: '#7c3aed' },
                                { icon: CheckCircle2, label: 'Firewall On', bg: '#dcfce7', fg: '#15803d' },
                                { icon: RefreshCw, label: 'Self-Healing', bg: '#dbeafe', fg: '#1d4ed8' },
                            ].map(({ icon: Icon, label, bg, fg }) => (
                                <span key={label} className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-bold" style={{ background: bg, color: fg }}>
                                    <Icon size={9}/> {label}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* TTS toggle */}
                        <button onClick={() => { setTtsEnabled(t => !t); if (ttsEnabled) window.speechSynthesis?.cancel(); }}
                            title={ttsEnabled ? 'Disable voice' : 'Enable AI voice'}
                            className={`p-2.5 rounded-xl transition-all ${ttsEnabled ? 'bg-violet-100 text-violet-700 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}>
                            {ttsEnabled ? <Volume2 size={15}/> : <VolumeX size={15}/>}
                        </button>

                        {/* Language */}
                        <div className="relative">
                            <button onClick={() => setShowLangPicker(p => !p)}
                                className="flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.05] hover:bg-slate-50 dark:hover:bg-white/[0.08] font-bold text-slate-600 dark:text-slate-300 shadow-sm transition-all">
                                <Globe size={11} className="text-violet-500"/>
                                {selectedLang.label}
                                <ChevronDown size={10} className="text-slate-400"/>
                            </button>
                            <AnimatePresence>
                                {showLangPicker && (
                                    <motion.div initial={{ opacity: 0, scale: 0.93, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: -6 }}
                                        className="absolute top-11 right-0 z-50 p-1.5 rounded-2xl shadow-2xl border border-slate-100 dark:border-white/[0.08] bg-white dark:bg-slate-900/95 min-w-[180px]">
                                        {LANGUAGES.map(lang => (
                                            <button key={lang.code} onClick={() => { setLanguage(lang.code); setShowLangPicker(false); }}
                                                className={`flex items-center w-full text-left text-[12px] px-3 py-2.5 rounded-xl transition-colors font-bold ${language === lang.code ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]'}`}>
                                                {lang.label}
                                                {language === lang.code && <CheckCircle2 size={13} className="ml-auto text-violet-500"/>}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Clear */}
                        <button onClick={clearChat} title="Clear chat"
                            className="p-2.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all">
                            <Trash2 size={15}/>
                        </button>
                    </div>
                </div>

                {/* ────────── Messages ────────── */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
                    <div className="py-6 px-4 sm:px-8 space-y-6 min-h-full">

                        {/* No DB connected */}
                        {!connectionString && (
                            <div className="flex flex-col items-center justify-center h-full py-24 gap-6 text-center">
                                <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
                                    style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 8px 32px rgba(124,58,237,0.3)' }}>
                                    <Database size={38} color="white"/>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 mb-2">No Database Connected</h2>
                                    <p className="text-slate-500 text-sm font-bold max-w-xs">Connect a database from the sidebar to start chatting with Lumina!</p>
                                </div>
                            </div>
                        )}

                        {/* Empty state with starters */}
                        {connectionString && messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 gap-8">
                                <div className="text-center">
                                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
                                        style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 8px 32px rgba(124,58,237,0.3)' }}>
                                        <MessageCircle size={34} color="white"/>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900">Hey, I'm Lumina! 👋</h2>
                                    <p className="text-slate-500 font-bold text-sm mt-2">Ask me anything — in plain English!</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl">
                                    {STARTERS.map(s => (
                                        <motion.button key={s.text} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                            onClick={() => handleSend(s.text)}
                                            className="text-left px-4 py-4 rounded-2xl border border-slate-200 bg-white hover:border-violet-300 hover:shadow-md transition-all cursor-pointer group">
                                            <span className="text-2xl mb-3 block">{s.emoji}</span>
                                            <span className="text-[13px] font-bold text-slate-700 group-hover:text-violet-700 transition-colors leading-snug">{s.text}</span>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Conversation */}
                        <AnimatePresence initial={false}>
                            {messages.map((msg, i) => (
                                <motion.div key={msg.id}
                                    initial={{ opacity: 0, y: 20, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse ml-auto max-w-[78%]' : 'mr-auto max-w-[88%]'} w-full`}
                                >
                                    {/* Avatar */}
                                    <div className="shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center shadow mt-1"
                                        style={{ background: msg.role === 'ai' ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : 'linear-gradient(135deg,#1e293b,#334155)' }}>
                                        {msg.role === 'ai' ? <Wand2 size={14} color="white"/> : <User size={14} color="white"/>}
                                    </div>

                                    <div className="flex flex-col gap-2 min-w-0 flex-1">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-right text-slate-400' : 'text-violet-500'}`}>
                                            {msg.role === 'ai' ? '✦ Lumina' : 'You'}
                                        </span>

                                        {/* Bubble */}
                                        <div className={`rounded-2xl px-5 py-4 text-[14px] shadow-sm font-medium ${
                                            msg.role === 'user'
                                                ? 'text-white rounded-tr-sm'
                                                : 'text-slate-800 dark:text-slate-100 bg-white dark:bg-white/[0.05] border border-slate-100/80 dark:border-white/[0.07] rounded-tl-sm shadow-[0_2px_12px_rgba(0,0,0,0.04)]'
                                        }`}
                                            style={msg.role === 'user' ? { background: 'linear-gradient(135deg,#1e293b,#334155)', boxShadow: '0 4px 16px rgba(30,41,59,0.25)' } : {}}>
                                            <FormattedText text={msg.content} />
                                        </div>

                                        {/* Show Data button */}
                                        {msg.role === 'ai' && i > 0 && (
                                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                                onClick={() => handleRunQuery(msg.id, messages[i - 1]?.content || msg.content)}
                                                disabled={!!msg.loading_query}
                                                className="self-start flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full border border-violet-200 bg-white text-violet-600 hover:bg-violet-50 hover:border-violet-300 transition-all shadow-sm disabled:opacity-60 cursor-pointer">
                                                {msg.loading_query
                                                    ? <><Loader2 size={11} className="animate-spin"/> Fetching your data…</>
                                                    : <><Play size={11} fill="currentColor"/> Show me the data</>}
                                            </motion.button>
                                        )}

                                        {/* Query result */}
                                        {msg.query_result && (
                                            <div className="bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] rounded-2xl p-4 shadow-sm">
                                                {msg.query_result.firewall_blocked ? (
                                                    <div className="flex items-center gap-2.5 text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 font-bold">
                                                        <Shield size={16}/> 🛡️ Blocked by Safety Firewall — this action looked risky!
                                                    </div>
                                                ) : msg.query_result.error ? (
                                                    <div className="flex items-start gap-2.5 text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                                                        <AlertCircle size={16} className="shrink-0 mt-0.5"/>
                                                        <div>
                                                            <p className="font-black text-[10px] uppercase tracking-widest mb-1">Something went wrong</p>
                                                            <p className="font-bold">{msg.query_result.error}</p>
                                                        </div>
                                                    </div>
                                                ) : (<>
                                                    <div className="p-3.5 rounded-xl text-[12px] font-mono leading-relaxed overflow-x-auto mb-3"
                                                        style={{ background: '#0f172a', color: '#4ade80' }}>
                                                        {msg.query_result.sql}
                                                    </div>
                                                    {msg.query_result.explanation && (
                                                        <div className="flex items-start gap-2 text-[13px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3 font-bold">
                                                            <Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5"/>
                                                            {msg.query_result.explanation}
                                                        </div>
                                                    )}
                                                    {msg.query_result.attempts > 1 && (
                                                        <p className="text-[10px] font-black text-blue-500 mb-3 flex items-center gap-1 uppercase tracking-widest">
                                                            <RefreshCw size={10}/> Auto-fixed in {msg.query_result.attempts} tries 🔧
                                                        </p>
                                                    )}
                                                    {msg.query_result.chart_type && <MiniBarChart columns={msg.query_result.columns} rows={msg.query_result.rows}/>}
                                                    {msg.query_result.rows.length > 0 && <DataTable columns={msg.query_result.columns} rows={msg.query_result.rows}/>}
                                                    <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1.5 font-black uppercase tracking-widest">
                                                        <CheckCircle2 size={10} className="text-emerald-500"/>
                                                        {msg.query_result.rows.length} result{msg.query_result.rows.length !== 1 ? 's' : ''} · max 100 rows applied
                                                    </p>
                                                    {msg.query_result.query_cost && (
                                                        <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
                                                            <span className="flex items-center gap-1 text-[11px] font-black text-amber-600"><DollarSign size={11}/>{msg.query_result.query_cost.cost_estimate.dollar_cost_display}</span>
                                                            <span className="flex items-center gap-1 text-[11px] font-black text-emerald-600"><Leaf size={11}/>{msg.query_result.query_cost.cost_estimate.co2_display}</span>
                                                            <span className="ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-white border shadow-sm"
                                                                style={{ color: msg.query_result.query_cost.rating === 'cheap' ? '#16a34a' : '#ea580c' }}>
                                                                {msg.query_result.query_cost.rating}
                                                            </span>
                                                        </div>
                                                    )}
                                                </>)}
                                            </div>
                                        )}

                                        {/* Suggested action */}
                                        {msg.suggested_action && (
                                            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-500/10 dark:to-indigo-500/10 border border-violet-200 dark:border-violet-500/20 rounded-2xl p-5 shadow-sm">
                                                <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                    <Lightbulb size={11} className="text-amber-500"/> Suggested Change
                                                </p>
                                                <code className="text-[12px] font-mono block p-4 rounded-xl mb-4"
                                                    style={{ background: '#0f172a', color: '#4ade80' }}>
                                                    {msg.suggested_action}
                                                </code>
                                                <p className="text-[12px] text-slate-600 dark:text-slate-300 font-bold mb-4 bg-white/70 dark:bg-white/[0.04] p-3 rounded-xl border border-violet-100 dark:border-violet-500/20">
                                                    ⚠️ Review the command above — once approved, it will modify your database!
                                                </p>
                                                <motion.button whileTap={{ scale: 0.97 }}
                                                    onClick={() => handleExecute(msg.id, msg.suggested_action!)}
                                                    disabled={executing !== null}
                                                    className="w-full py-3.5 rounded-2xl text-[12px] font-black text-white uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                                                    style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 4px 20px rgba(124,58,237,0.35)' }}>
                                                    {executing === msg.id ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
                                                    Yes, Apply This Change
                                                </motion.button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Thinking */}
                        {loading && (
                            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                                className="flex gap-3 max-w-[80%] mr-auto">
                                <div className="shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center shadow"
                                    style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}>
                                    <Wand2 size={14} color="white"/>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-violet-500">✦ Lumina</span>
                                    <div className="mt-1 flex items-center gap-3 px-5 py-3.5 bg-white dark:bg-white/[0.05] border border-slate-100 dark:border-white/[0.06] rounded-2xl rounded-tl-sm shadow-sm">
                                        <TypingWave/>
                                        <span className="text-[13px] font-bold text-slate-400">Thinking…</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        <div ref={messagesEndRef} className="h-2"/>
                    </div>
                </div>

                {/* ────────── Input Bar ────────── */}
                <div className="shrink-0 px-4 sm:px-8 pb-5 pt-3 border-t border-violet-100/60 dark:border-white/[0.06] bg-white/75 dark:bg-white/[0.03] backdrop-blur-xl">
                    <div className="max-w-3xl mx-auto space-y-2">

                        {/* Voice error/tip */}
                        <AnimatePresence>
                            {voiceError && (
                                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-2xl">
                                    <Info size={13} className="text-rose-500 shrink-0"/>
                                    <span className="text-[12px] font-bold text-rose-700">{voiceError}</span>
                                    <button onClick={() => setVoiceError(null)} className="ml-auto text-rose-400 hover:text-rose-600 font-black text-xs">✕</button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Listening / Transcribing pill */}
                        <AnimatePresence>
                            {isTranscribing && (
                                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="flex items-center gap-2.5 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-2xl">
                                    <Loader2 size={14} className="text-violet-500 animate-spin shrink-0"/>
                                    <span className="text-[12px] font-black text-violet-700 uppercase tracking-widest">⚙️ Transcribing your voice…</span>
                                </motion.div>
                            )}
                            {isListening && !isTranscribing && (
                                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="flex items-center gap-2.5 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-2xl">
                                    <motion.div className="w-2.5 h-2.5 rounded-full bg-rose-500"
                                        animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                                        transition={{ duration: 1, repeat: Infinity }}/>
                                    <span className="text-[12px] font-black text-rose-700 uppercase tracking-widest">
                                        🎤 {useWhisperFallback ? 'Recording locally… tap Stop when done' : 'Listening… speak now!'}
                                    </span>
                                    <button onClick={stopListening} className="ml-auto text-[11px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest px-2 py-1 rounded-lg hover:bg-rose-100 transition-all">Stop</button>
                                </motion.div>
                            )}
                        </AnimatePresence>


                        {/* Input row */}
                        <div className={`flex gap-2 items-center px-2 py-2 rounded-2xl border bg-white dark:bg-white/[0.05] transition-all ${isListening ? 'border-rose-300 shadow-[0_0_0_4px_rgba(244,63,94,0.08)]' : 'border-slate-200 dark:border-white/[0.08] focus-within:border-violet-400 focus-within:shadow-[0_0_0_4px_rgba(124,58,237,0.08)]'}`}
                            style={{ boxShadow: '0 4px 24px rgba(124,58,237,0.06)' }}>

                            <input ref={inputRef} value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                placeholder={!connectionString ? 'Connect a database first' : isListening ? 'Listening…' : 'Ask Lumina anything about your database…'}
                                disabled={!connectionString}
                                className="flex-1 px-4 py-2.5 text-[14px] bg-transparent border-none outline-none placeholder-slate-400 dark:placeholder-slate-500 disabled:opacity-50 font-bold text-slate-800 dark:text-slate-100"
                            />

                            {/* Mic button */}
                            <motion.button whileTap={{ scale: 0.92 }}
                                onClick={toggleListening}
                                disabled={!connectionString || isTranscribing}
                                title={isListening ? 'Stop listening' : useWhisperFallback ? 'Record voice (local mode)' : 'Speak to me'}
                                className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all disabled:opacity-40 cursor-pointer ${
                                    isListening
                                        ? 'bg-rose-500 text-white shadow-[0_0_24px_rgba(239,68,68,0.5)]'
                                        : isTranscribing
                                        ? 'bg-violet-100 text-violet-400'
                                        : useWhisperFallback
                                        ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                                        : 'bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-600 hover:shadow-md'
                                }`}>
                                {isListening ? <MicOff size={16}/> : isTranscribing ? <Loader2 size={16} className="animate-spin"/> : <Mic size={16}/>}
                            </motion.button>

                            {/* Send / Stop */}
                            <AnimatePresence mode="wait">
                                {loading ? (
                                    <motion.button key="stop" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                                        onClick={() => { abortController?.abort(); setLoading(false); }}
                                        className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 cursor-pointer"
                                        style={{ background: '#ffe4e6', color: '#e11d48' }}>
                                        <StopCircle size={18}/>
                                    </motion.button>
                                ) : (
                                    <motion.button key="send" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                                        whileTap={{ scale: 0.92 }}
                                        onClick={() => handleSend()}
                                        disabled={!input.trim() || !connectionString}
                                        className="flex items-center justify-center w-10 h-10 rounded-xl text-white shrink-0 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                        style={{
                                            background: input.trim() ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : '#e2e8f0',
                                            color: input.trim() ? 'white' : '#94a3b8',
                                            boxShadow: input.trim() ? '0 4px 16px rgba(124,58,237,0.45)' : 'none',
                                        }}>
                                        <Send size={15}/>
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>

                        <p className="text-center text-[10px] text-slate-400 font-bold">
                            {speechSupported
                                ? '🎤 Voice-to-text ready  ·  Always review changes before approving  ·  Powered by Ollama'
                                : 'Always review database changes before approving  ·  Powered by Ollama'}
                        </p>
                    </div>
                </div>

            </div>
        </DashboardShell>
    );
}
