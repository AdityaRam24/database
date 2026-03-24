'use client';

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
    Database, Zap, Shield, BarChart3, MessageSquare,
    ArrowRight, CheckCircle2, Activity, BookOpen,
    Search, ShieldAlert, Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { toast } from "sonner";

const FEATURES = [
    {
        icon: MessageSquare,
        color: "#6366f1",
        bg: "rgba(99,102,241,0.10)",
        title: "Ask in plain English",
        desc: "No SQL needed. Type 'Which customers haven't ordered in 3 months?' and get an instant, clear answer.",
    },
    {
        icon: Zap,
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.10)",
        title: "Speed up your app",
        desc: "Automatically find slow queries and missing indexes. Get one-click fixes that make your app feel faster.",
    },
    {
        icon: Activity,
        color: "#ef4444",
        bg: "rgba(239,68,68,0.10)",
        title: "Catch problems early",
        desc: "AI monitors your database around the clock and alerts you to anomalies before they affect your users.",
    },
    {
        icon: Shield,
        color: "#10b981",
        bg: "rgba(16,185,129,0.10)",
        title: "Stay protected",
        desc: "Spot security risks, detect PII exposure, and enforce access controls — all explained in plain English.",
    },
    {
        icon: BarChart3,
        color: "#8b5cf6",
        bg: "rgba(139,92,246,0.10)",
        title: "Visualize your data",
        desc: "See how all your tables connect with an interactive map. Understand your database structure at a glance.",
    },
    {
        icon: BookOpen,
        color: "#ec4899",
        bg: "rgba(236,72,153,0.10)",
        title: "Define business rules",
        desc: "Write rules in plain English. Prevent bad data, enforce limits, and keep your database healthy automatically.",
    },
];

const HOW_IT_WORKS = [
    {
        step: "1",
        icon: Database,
        title: "Connect your database",
        desc: "Paste your PostgreSQL connection string. No setup, no configuration — done in 30 seconds.",
    },
    {
        step: "2",
        icon: MessageSquare,
        title: "Ask anything",
        desc: "Type a question in plain English. No technical knowledge or SQL experience required.",
    },
    {
        step: "3",
        icon: Sparkles,
        title: "Get instant insights",
        desc: "Receive clear answers, visual breakdowns, and one-click recommendations you can act on right away.",
    },
];

const EXAMPLE_PROMPTS = [
    "Which tables use the most storage?",
    "Show me my 5 slowest queries",
    "Are there any security risks?",
    "Find missing indexes",
    "How many users signed up this week?",
];

const FADE_UP = {
    hidden: { opacity: 0, y: 24 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
    }),
};

export default function Home() {
    const { user, signInWithGoogle } = useAuth();
    const router = useRouter();

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!prompt.trim()) return;
        setIsLoading(true);
        setTimeout(() => {
            toast.success("Great question!", {
                description: user
                    ? "Redirecting to your dashboard…"
                    : "Sign in to connect your database and get the answer.",
            });
            setIsLoading(false);
            if (!user) setTimeout(signInWithGoogle, 1200);
            else router.push("/connect");
        }, 800);
    };

    return (
        <div className="min-h-screen bg-background text-foreground font-sans">

            {/* ── Header ────────────────────────────────────────────────────── */}
            <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                            <Database size={15} className="text-white" strokeWidth={2.5} />
                        </div>
                        <span className="font-bold text-foreground text-[15px] tracking-tight">DB-Lighthouse</span>
                    </div>

                    <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
                        <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
                        <a href="#features" className="hover:text-foreground transition-colors">Features</a>
                    </nav>

                    <div className="flex items-center gap-2.5">
                        <ThemeToggle />
                        {user ? (
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
                            >
                                Dashboard <ArrowRight size={13} />
                            </button>
                        ) : (
                            <button
                                onClick={signInWithGoogle}
                                className="px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors shadow-md shadow-indigo-500/20"
                            >
                                Get Started
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Hero ──────────────────────────────────────────────────────── */}
            <section className="pt-36 pb-28 px-4 sm:px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <motion.div initial="hidden" animate="visible" variants={FADE_UP}>
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-7">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            AI-Powered PostgreSQL Intelligence
                        </div>

                        {/* Headline */}
                        <h1 className="text-5xl sm:text-6xl lg:text-[68px] font-extrabold tracking-tight text-foreground leading-[1.07] mb-6">
                            Understand your database<br />
                            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                                in plain English
                            </span>
                        </h1>

                        {/* Sub */}
                        <p className="text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
                            Ask questions, spot problems, and optimize performance — without writing a single line of SQL.
                            Built for everyone on your team, technical or not.
                        </p>

                        {/* Search / chat input */}
                        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-5">
                            <div className="flex items-center gap-3 p-3 bg-card border-2 border-border rounded-2xl shadow-sm hover:border-indigo-500/40 focus-within:border-indigo-500/60 focus-within:shadow-indigo-500/10 focus-within:shadow-lg transition-all duration-300">
                                <Search size={17} className="text-muted-foreground shrink-0 ml-1" />
                                <input
                                    type="text"
                                    value={prompt}
                                    onChange={e => setPrompt(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                    placeholder="Ask your database anything…"
                                    className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-base outline-none font-medium"
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading || !prompt.trim()}
                                    className="shrink-0 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold transition-all flex items-center gap-2"
                                >
                                    {isLoading
                                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <><span className="hidden sm:inline">Ask</span> <ArrowRight size={14} /></>
                                    }
                                </button>
                            </div>
                        </form>

                        {/* Example prompts */}
                        <div className="flex flex-wrap justify-center gap-2 mb-10">
                            {EXAMPLE_PROMPTS.map((q) => (
                                <button
                                    key={q}
                                    onClick={() => setPrompt(q)}
                                    className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all border border-border"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>

                        {/* Trust row */}
                        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                            {["PostgreSQL native", "No SQL required", "AI-powered", "Privacy first"].map((item) => (
                                <span key={item} className="flex items-center gap-1.5">
                                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                    {item}
                                </span>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── How It Works ──────────────────────────────────────────────── */}
            <section id="how-it-works" className="py-24 px-4 sm:px-6 border-y border-border bg-muted/40">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <p className="text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mb-3">Simple by design</p>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Three steps to clarity</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }, i) => (
                            <motion.div
                                key={step}
                                custom={i}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                variants={FADE_UP}
                                className="relative bg-card border border-border rounded-2xl p-7"
                            >
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                                        <Icon size={18} className="text-indigo-600 dark:text-indigo-400" strokeWidth={2} />
                                    </div>
                                    <span className="text-4xl font-black text-border leading-none">{step}</span>
                                </div>
                                <h3 className="text-base font-bold text-foreground mb-2">{title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                                {i < 2 && (
                                    <div className="hidden md:flex absolute top-1/2 -right-3 z-10 -translate-y-1/2">
                                        <ArrowRight size={14} className="text-muted-foreground/30" />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features ──────────────────────────────────────────────────── */}
            <section id="features" className="py-24 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <p className="text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-widest mb-3">Everything you need</p>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-4">
                            Built for every member of your team
                        </h2>
                        <p className="text-muted-foreground max-w-md mx-auto text-base">
                            Developers, PMs, and founders — DB-Lighthouse speaks your language.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {FEATURES.map(({ icon: Icon, color, bg, title, desc }, i) => (
                            <motion.div
                                key={title}
                                custom={i}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                variants={FADE_UP}
                                className="bg-card border border-border rounded-2xl p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
                            >
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105 duration-300" style={{ background: bg }}>
                                    <Icon size={19} style={{ color }} strokeWidth={2} />
                                </div>
                                <h3 className="font-bold text-foreground mb-2 text-[15px]">{title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Social proof / stats strip ────────────────────────────────── */}
            <section className="py-16 px-4 sm:px-6 border-y border-border bg-muted/40">
                <div className="max-w-4xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {[
                            { value: "< 30s", label: "to connect a database" },
                            { value: "99%", label: "questions answered in plain English" },
                            { value: "0", label: "SQL knowledge required" },
                            { value: "24 / 7", label: "AI monitoring" },
                        ].map(({ value, label }) => (
                            <div key={label}>
                                <p className="text-3xl font-extrabold text-foreground mb-1">{value}</p>
                                <p className="text-xs text-muted-foreground font-medium leading-snug">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ───────────────────────────────────────────────────────── */}
            <section className="py-28 px-4 sm:px-6">
                <div className="max-w-2xl mx-auto text-center">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={FADE_UP}
                    >
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 mb-6 shadow-xl shadow-indigo-500/25">
                            <ShieldAlert size={28} className="text-white" strokeWidth={2} />
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-4">
                            Ready to understand your database?
                        </h2>
                        <p className="text-muted-foreground text-lg mb-9 leading-relaxed">
                            Connect your PostgreSQL database for free. No credit card, no setup — just answers.
                        </p>
                        <button
                            onClick={user ? () => router.push('/dashboard') : signInWithGoogle}
                            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-colors shadow-xl shadow-indigo-500/20"
                        >
                            {user ? 'Go to Dashboard' : 'Get Started Free'}
                            <ArrowRight size={18} />
                        </button>
                        <p className="mt-4 text-xs text-muted-foreground">No credit card required · Free to start</p>
                    </motion.div>
                </div>
            </section>

            {/* ── Footer ────────────────────────────────────────────────────── */}
            <footer className="border-t border-border py-10 px-4 sm:px-6">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                            <Database size={12} className="text-white" strokeWidth={2.5} />
                        </div>
                        <span className="font-bold text-sm text-foreground">DB-Lighthouse AI</span>
                    </div>
                    <p className="text-xs text-muted-foreground">© 2025 DB-Lighthouse. AI-powered database intelligence.</p>
                    <div className="flex gap-5 text-xs text-muted-foreground">
                        <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
                        <a href="#" className="hover:text-foreground transition-colors">Terms</a>
                        <a href="#" className="hover:text-foreground transition-colors">GitHub</a>
                    </div>
                </div>
            </footer>

        </div>
    );
}
