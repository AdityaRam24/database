'use client';

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import {
    Database, Zap, Shield, BarChart3, MessageSquare,
    ArrowRight, CheckCircle2, Activity, BookOpen,
    ChevronDown, Sparkles, Terminal, Eye,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const HeroScene3D = dynamic(() => import("@/components/HeroScene3D"), {
    ssr: false,
    loading: () => <div className="w-full h-full" />,
});

// ─── Static Data ───────────────────────────────────────────────────────────────

const FEATURES = [
    {
        icon: MessageSquare,
        color: "#7c3aed",
        bg: "rgba(124,58,237,0.10)",
        border: "rgba(124,58,237,0.18)",
        title: "Ask in plain English",
        desc: "No SQL needed. Type 'Which customers haven't ordered in 3 months?' and get a clear, instant answer.",
        tag: "AI Core",
    },
    {
        icon: Zap,
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.10)",
        border: "rgba(245,158,11,0.18)",
        title: "Speed up your app",
        desc: "Find slow queries and missing indexes automatically. Get one-click fixes that make your app feel faster.",
        tag: "Performance",
    },
    {
        icon: Activity,
        color: "#ef4444",
        bg: "rgba(239,68,68,0.10)",
        border: "rgba(239,68,68,0.18)",
        title: "Catch problems early",
        desc: "AI monitors your database around the clock and alerts you to anomalies before they affect users.",
        tag: "Monitoring",
    },
    {
        icon: Shield,
        color: "#10b981",
        bg: "rgba(16,185,129,0.10)",
        border: "rgba(16,185,129,0.18)",
        title: "Stay protected",
        desc: "Spot security risks, detect PII exposure, and enforce access controls — all explained in plain English.",
        tag: "Security",
    },
    {
        icon: BarChart3,
        color: "#7c3aed",
        bg: "rgba(124,58,237,0.10)",
        border: "rgba(124,58,237,0.18)",
        title: "Visualize your data",
        desc: "See how all your tables connect with an interactive ER diagram. Understand your schema at a glance.",
        tag: "Visualization",
    },
    {
        icon: BookOpen,
        color: "#ec4899",
        bg: "rgba(236,72,153,0.10)",
        border: "rgba(236,72,153,0.18)",
        title: "Define business rules",
        desc: "Write rules in plain English. Prevent bad data, enforce limits, and keep your database healthy automatically.",
        tag: "Governance",
    },
];

const HOW_IT_WORKS = [
    {
        step: "01",
        icon: Database,
        title: "Connect your database",
        desc: "Connect securely with a simple connection string. No setup, no configuration — done in 30 seconds.",
        color: "#7c3aed",
    },
    {
        step: "02",
        icon: MessageSquare,
        title: "Ask anything",
        desc: "Type a question in plain English. No technical knowledge or SQL experience required.",
        color: "#8b5cf6",
    },
    {
        step: "03",
        icon: Sparkles,
        title: "Get instant insights",
        desc: "Receive clear answers, visual breakdowns, and one-click recommendations you can act on right away.",
        color: "#a855f7",
    },
];

const FAQ_ITEMS = [
    {
        question: "Is my production database safe?",
        answer: "100%. We clone your schema — not your data — into an isolated shadow database. Your production database is never modified or read beyond the initial connection check.",
    },
    {
        question: "Do I need to know SQL?",
        answer: "Not at all. You can ask questions in plain English and get clear, actionable answers. SQL is optional for power users who prefer it.",
    },
    {
        question: "Which databases are supported?",
        answer: "We support a wide range of databases including PostgreSQL, MySQL, SQLite, SQL Server, and Oracle, as well as NoSQL and Graph databases like MongoDB, Firebase, and Neo4j.",
    },
    {
        question: "How does the AI work?",
        answer: "DB-Lighthouse uses a local LLM (Jan AI or Ollama) by default, meaning your queries and schema never leave your infrastructure. Cloud AI (OpenAI) is also available as an optional fallback.",
    },
    {
        question: "Can I self-host?",
        answer: "Yes! DB-Lighthouse is fully open-source. You can run the entire platform on your own infrastructure using Docker Compose in under 5 minutes.",
    },
];

const STATS = [
    { value: "< 30s", label: "to connect a database", icon: Zap },
    { value: "100%", label: "schema stays private", icon: Shield },
    { value: "0", label: "SQL knowledge required", icon: Terminal },
    { value: "24/7", label: "AI monitoring active", icon: Eye },
];

const FADE_UP = {
    hidden: { opacity: 0, y: 28 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
    }),
};

const FADE_IN = {
    hidden: { opacity: 0 },
    visible: (i = 0) => ({
        opacity: 1,
        transition: { delay: i * 0.07, duration: 0.5, ease: 'easeOut' },
    }),
};

// ─── Sub-Components ────────────────────────────────────────────────────────────

function FeatureCardSpotlight({ feature, index }: { feature: any; index: number }) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

    return (
        <motion.div
            ref={cardRef}
            onMouseMove={(e) => {
                if (!cardRef.current) return;
                const rect = cardRef.current.getBoundingClientRect();
                setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onMouseLeave={() => setMousePos({ x: -1000, y: -1000 })}
            custom={index}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={FADE_UP}
            className="relative bg-card border border-border rounded-3xl p-7 hover:shadow-2xl hover:-translate-y-1 hover:border-white/20 transition-all duration-500 group overflow-hidden cursor-default"
        >
            {/* Spotlight */}
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-700 group-hover:opacity-100 mix-blend-screen"
                style={{ background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.03), transparent 50%)` }}
            />
            {/* Minimal Border Spotlight */}
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ border: `1px solid rgba(255,255,255,0.4)`, maskImage: `radial-gradient(250px circle at ${mousePos.x}px ${mousePos.y}px, black, transparent)` }}
            />

            {/* Tag */}
            <div className="relative z-10 flex items-center justify-between mb-6">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/[0.02] border border-white/5 group-hover:bg-white/[0.05] group-hover:scale-105 transition-all duration-300">
                    <feature.icon size={18} className="text-white/60 group-hover:text-white transition-colors" strokeWidth={1.5} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white/70 transition-colors">
                    {feature.tag}
                </span>
            </div>
            <h3 className="relative z-10 font-bold text-foreground mb-3 text-[17px] group-hover:text-white transition-colors">{feature.title}</h3>
            <p className="relative z-10 text-[14px] text-muted-foreground leading-relaxed">{feature.desc}</p>
        </motion.div>
    );
}

function MagneticCTAButton({ onClick, label }: { onClick: () => void; label: string }) {
    const btnRef = useRef<HTMLButtonElement>(null);
    const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

    return (
        <button
            ref={btnRef}
            onMouseMove={(e) => {
                if (!btnRef.current) return;
                const rect = btnRef.current.getBoundingClientRect();
                setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onMouseLeave={() => setMousePos({ x: -1000, y: -1000 })}
            onClick={onClick}
            className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-violet-600 border border-violet-500 hover:border-violet-400 text-white font-bold text-base transition-all duration-300 shadow-2xl shadow-violet-500/40 hover:shadow-violet-500/60 hover:-translate-y-1 overflow-hidden cursor-pointer"
        >
            <motion.div
                className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100 mix-blend-overlay"
                style={{ background: `radial-gradient(150px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.8), transparent 50%)` }}
            />
            {label}
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Home() {
    const { user, signInWithGoogle } = useAuth();
    const router = useRouter();
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    useEffect(() => {
        if (user) {
            router.push('/dashboard');
        }
    }, [user, router]);

    const ctaAction = user ? () => router.push('/dashboard') : signInWithGoogle;
    const ctaLabel = user ? 'Go to Dashboard' : 'Get Started Free';

    return (
        <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">

            {/* ── Layered ambient background ─────────────────────────────────── */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
                {/* Top center glow */}
                <div className="absolute -top-60 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] rounded-full bg-violet-500/5 blur-[180px]" />
                {/* Right accent */}
                <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-purple-600/4 blur-[140px]" />
                {/* Bottom left */}
                <div className="absolute bottom-0 -left-20 w-[500px] h-[500px] rounded-full bg-violet-400/3 blur-[120px]" />
                {/* Noise texture overlay */}
                <div className="absolute inset-0 opacity-[0.013] dark:opacity-[0.03]"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
            </div>

            {/* ── HEADER ──────────────────────────────────────────────────────── */}
            <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-2xl border-b border-border/60">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <Database size={15} className="text-white" strokeWidth={2.5} />
                        </div>
                        <span className="font-bold text-foreground text-[15px] tracking-tight">DB-Lighthouse</span>
                    </div>

                    <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
                        <a href="#how-it-works" className="hover:text-foreground transition-colors duration-150 cursor-pointer">How it works</a>
                        <a href="#features" className="hover:text-foreground transition-colors duration-150 cursor-pointer">Features</a>
                        <a href="#faq" className="hover:text-foreground transition-colors duration-150 cursor-pointer">FAQ</a>
                    </nav>

                    <div className="flex items-center gap-2.5">
                        <ThemeToggle />
                        <button
                            onClick={ctaAction}
                            className="px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all duration-200 shadow-md shadow-violet-500/25 hover:shadow-violet-500/40 cursor-pointer flex items-center gap-1.5"
                        >
                            {user ? <><span>Dashboard</span><ArrowRight size={12} /></> : 'Get Started'}
                        </button>
                    </div>
                </div>
            </header>

            {/* ── HERO ────────────────────────────────────────────────────────── */}
            <section className="pt-24 pb-8 px-4 sm:px-6 overflow-hidden">
                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-6 lg:gap-4 items-center">

                        {/* Left — text & CTAs */}
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={FADE_UP}
                            className="flex flex-col items-center lg:items-start text-center lg:text-left order-2 lg:order-1 py-8 lg:py-0"
                        >
                            {/* Pill badge */}
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.5 }}
                                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-600 dark:text-violet-400 text-xs font-bold mb-7 backdrop-blur-sm"
                            >
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500" />
                                </span>
                                AI-Powered Database Intelligence
                            </motion.div>

                            {/* Headline */}
                            <h1 className="text-4xl sm:text-5xl lg:text-[58px] xl:text-[66px] font-extrabold tracking-tight text-foreground leading-[1.06] mb-5">
                                Understand your<br />database
                                <br />
                                <span className="relative">
                                    <span className="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent">
                                        in plain English
                                    </span>
                                    {/* Underline glow */}
                                    <span className="absolute -bottom-1.5 left-0 right-0 h-px bg-gradient-to-r from-violet-500/60 via-purple-500/60 to-fuchsia-500/40 blur-[1px]" />
                                </span>
                            </h1>

                            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10 max-w-xl">
                                Ask questions, spot problems, and optimize performance —&nbsp;
                                without writing a single line of SQL.
                                Built for every member of your team.
                            </p>

                            {/* CTAs */}
                            <div className="flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3 mb-10 w-full">
                                <button
                                    onClick={ctaAction}
                                    className="group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-base transition-all duration-200 shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 cursor-pointer overflow-hidden"
                                >
                                    {/* Shimmer */}
                                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                    {ctaLabel}
                                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                                </button>
                                <a
                                    href="#how-it-works"
                                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-card border border-border text-foreground font-semibold text-base transition-all duration-200 hover:border-violet-500/40 hover:bg-muted/40 cursor-pointer"
                                >
                                    See how it works
                                </a>
                            </div>

                            {/* Trust strip */}
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-sm text-muted-foreground">
                                {["Universal SQL support", "No SQL required", "Privacy first", "Open source"].map((item) => (
                                    <span key={item} className="flex items-center gap-1.5">
                                        <CheckCircle2 size={13} className="text-violet-500 shrink-0" />
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </motion.div>

                        {/* Right — 3D scene */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.88 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                            className="relative order-1 lg:order-2 h-[340px] sm:h-[420px] lg:h-[600px]"
                        >
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-[12%] rounded-full bg-violet-600/16 blur-[80px]" />
                                <div className="absolute inset-[28%] rounded-full bg-purple-500/10 blur-[110px]" />
                            </div>
                            <HeroScene3D />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ── STATS STRIP ─────────────────────────────────────────────────── */}
            <section className="py-16 px-4 sm:px-6 border-y border-border">
                <div className="max-w-4xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {STATS.map(({ value, label, icon: Icon }, i) => (
                            <motion.div
                                key={label}
                                custom={i}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                variants={FADE_UP}
                                className="group text-center flex flex-col items-center gap-2"
                            >
                                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center mb-1 group-hover:bg-violet-500/15 transition-colors duration-200">
                                    <Icon size={16} className="text-violet-500" />
                                </div>
                                <p className="text-3xl font-extrabold text-foreground tracking-tight">{value}</p>
                                <p className="text-xs text-muted-foreground font-medium leading-snug">{label}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── SUPPORTED DATABASES LOGO TICKER ─────────────────────────────── */}
            <section className="border-y border-border/40 bg-gradient-to-b from-background to-muted/20 py-10 overflow-hidden relative">
                {/* Fade edges */}
                <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10" />
                <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10" />

                <div className="max-w-6xl mx-auto px-4 flex flex-col items-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-8">Works seamlessly with your stack</p>
                    <div className="flex gap-16 items-center flex-wrap justify-center opacity-70">
                        {[
                            { name: "PostgreSQL", icon: "🐘" },
                            { name: "MySQL", icon: "🐬" },
                            { name: "MongoDB", icon: "🍃" },
                            { name: "Neo4j", icon: "🕸️" },
                            { name: "SQLite", icon: "🪶" },
                            { name: "Firebase", icon: "🔥" }
                        ].map((db) => (
                            <div key={db.name} className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300 transform hover:scale-110 cursor-default">
                                <span className="text-2xl">{db.icon}</span>
                                <span className="text-lg font-bold text-foreground/80 tracking-tight">{db.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── DEEP ENGINE CAPABILITIES ────────────────────────────────────── */}
            <section className="py-32 px-4 sm:px-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-40 -mt-40 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
                            <p className="text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-widest mb-3">Neural Core</p>
                            <h2 className="text-3xl sm:text-5xl font-extrabold text-foreground tracking-tight mb-6 leading-[1.1]">
                                It doesn't just read data.<br />
                                <span className="text-muted-foreground">It understands architecture.</span>
                            </h2>
                            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                                Our bespoke AI incident engine constantly evaluates relationships, query patterns, and resource bottlenecks. It's like having a Senior DBA monitoring your systems 24/7.
                            </p>

                            <div className="flex flex-col gap-5">
                                {[
                                    { title: "Z-Score Anomaly Detection", desc: "Detects weird latency spikes before users complain." },
                                    { title: "Self-Healing Migrations", desc: "Automatically patches failing SQL syntax across dialects." },
                                    { title: "Zero-Knowledge Analysis", desc: "Process everything locally. Raw data never leaves your VPC." }
                                ].map((item) => (
                                    <div key={item.title} className="flex gap-4">
                                        <div className="mt-1 w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0 border border-violet-500/20">
                                            <Shield size={14} className="text-violet-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-foreground font-bold">{item.title}</h4>
                                            <p className="text-sm text-muted-foreground">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 40 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            viewport={{ once: true }}
                            className="relative"
                        >
                            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl blur opacity-20 animate-pulse" />
                            <div className="relative bg-black/90 dark:bg-[#0a0a0c] border border-border/80 rounded-2xl p-6 font-mono text-sm overflow-hidden shadow-2xl">
                                {/* Header */}
                                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
                                    <Activity size={14} className="text-violet-400 animate-pulse" />
                                    <span className="text-violet-400 font-bold uppercase tracking-wider text-[10px]">Neural Diagnostics Running</span>
                                </div>
                                <div className="space-y-3 opacity-90">
                                    <div className="flex items-start gap-3">
                                        <span className="text-emerald-400 shrink-0">→</span>
                                        <span className="text-zinc-300">Scanning cluster relationships... <span className="text-emerald-400">OK</span></span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-emerald-400 shrink-0">→</span>
                                        <span className="text-zinc-300">Computing index fragmentation vectors...</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-amber-400 shrink-0">⚠</span>
                                        <span className="text-amber-200/80">Anomaly detected: Table `user_sessions` exhibits high seq scans</span>
                                    </div>
                                    <div className="flex items-start gap-3 py-2">
                                        <span className="text-violet-400 shrink-0">⚛</span>
                                        <span className="text-violet-200 max-w-[90%] leading-relaxed">
                                            AI Synthesis: Add B-tree index on (user_id, last_active). Projected IOPS reduction: 74%.
                                        </span>
                                    </div>
                                </div>

                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ── PRODUCT DEMO ────────────────────────────────────────────────── */}
            <section className="py-28 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={FADE_UP}
                        className="text-center mb-14"
                    >
                        <p className="text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-widest mb-3">Live platform</p>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                            Your database,{" "}
                            <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">
                                illuminated
                            </span>
                        </h2>
                    </motion.div>

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={FADE_UP}
                        className="relative"
                    >
                        {/* Outer glow */}
                        <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-violet-500/20 via-purple-500/10 to-fuchsia-500/20 blur-[2px]" />

                        <div className="relative rounded-2xl border border-border bg-card shadow-2xl shadow-violet-500/8 overflow-hidden">
                            {/* Browser chrome */}
                            <div className="flex items-center gap-1.5 px-4 py-3 bg-muted/40 border-b border-border">
                                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                                <div className="w-3 h-3 rounded-full bg-green-400/80" />
                                <div className="ml-4 flex-1 max-w-xs bg-background/70 rounded-md px-3 py-1.5 text-xs text-muted-foreground border border-border flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                    app.db-lighthouse.ai/dashboard
                                </div>
                            </div>

                            {/* Dashboard body */}
                            <div className="p-5 sm:p-7 bg-gradient-to-br from-background via-background to-muted/10">
                                {/* KPI row */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                    {[
                                        { label: "Health Score", value: "87/100", color: "#7c3aed", trend: "+4" },
                                        { label: "Storage Used", value: "142 MB", color: "#3b82f6", trend: "+2.1MB" },
                                        { label: "Tables", value: "24", color: "#10b981", trend: null },
                                        { label: "Active Connections", value: "8", color: "#f59e0b", trend: "-3" },
                                    ].map(({ label, value, color, trend }) => (
                                        <div key={label} className="rounded-xl bg-card border border-border/80 p-3 sm:p-4 hover:border-violet-500/20 transition-colors relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-muted/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <p className="text-[10px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">{label}</p>
                                            <div className="flex items-end gap-1.5">
                                                <p className="text-lg sm:text-xl font-bold" style={{ color }}>{value}</p>
                                                {trend && <span className="text-[9px] mb-0.5 font-bold text-emerald-500">{trend}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Two-panel row */}
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {/* AI Recommendations panel */}
                                    <div className="rounded-xl bg-card border border-border/80 p-4">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                            <Zap size={10} className="text-amber-500" /> AI Recommendations
                                        </p>
                                        {[
                                            { fix: "Add index on orders.user_id", impact: "+40% query speed", status: "critical" },
                                            { fix: "Remove duplicate idx_email", impact: "Save 12 MB storage", status: "warning" },
                                            { fix: "Analyze slow query #4", impact: "3.2s → < 200ms", status: "info" },
                                        ].map(({ fix, impact, status }) => (
                                            <div key={fix} className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0 group">
                                                <div>
                                                    <p className="text-xs font-semibold text-foreground">{fix}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">{impact}</p>
                                                </div>
                                                <div className={`w-2 h-2 rounded-full shrink-0 ml-2 shadow-sm ${status === 'critical' ? 'bg-red-500 shadow-red-500/50' : status === 'warning' ? 'bg-amber-500 shadow-amber-500/50' : 'bg-violet-500 shadow-violet-500/50'}`} />
                                            </div>
                                        ))}
                                    </div>

                                    {/* AI Chat panel */}
                                    <div className="rounded-xl bg-card border border-border/80 p-4">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                            <MessageSquare size={10} className="text-violet-500" /> Ask AI
                                        </p>
                                        <div className="space-y-2.5">
                                            <div className="flex justify-end">
                                                <div className="bg-violet-600 text-white text-xs rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%] shadow-sm">
                                                    Which tables have the most rows?
                                                </div>
                                            </div>
                                            <div className="flex justify-start">
                                                <div className="bg-muted/80 text-foreground text-xs rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%] leading-relaxed border border-border/50">
                                                    The <strong>orders</strong> table has 1.2M rows, followed by <strong>events</strong> (890K) and <strong>users</strong> (142K).
                                                </div>
                                            </div>
                                            <div className="flex justify-end">
                                                <div className="bg-violet-600 text-white text-xs rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%] shadow-sm">
                                                    Any missing indexes?
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-3 py-2.5 bg-muted/60 rounded-xl rounded-tl-sm max-w-[45%] border border-border/50">
                                                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
            <section id="how-it-works" className="py-28 px-4 sm:px-6 border-y border-border bg-muted/20">
                <div className="max-w-5xl mx-auto">
                    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP} className="text-center mb-16">
                        <p className="text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-widest mb-3">Simple by design</p>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Three steps to clarity</h2>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-6 relative">
                        {/* Connector line */}
                        <div className="hidden md:block absolute top-[52px] left-[calc(16.666%+24px)] right-[calc(16.666%+24px)] h-px bg-gradient-to-r from-violet-500/0 via-violet-500/30 to-violet-500/0" />

                        {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc, color }, i) => (
                            <motion.div
                                key={step}
                                custom={i}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                variants={FADE_UP}
                                className="relative bg-card border border-border rounded-2xl p-7 hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-500/6 hover:-translate-y-1 transition-all duration-300 group cursor-default"
                            >
                                {/* Step number watermark */}
                                <span className="absolute top-5 right-6 text-6xl font-black text-border/50 leading-none select-none group-hover:text-violet-500/8 transition-colors duration-300">{step}</span>

                                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-6 transition-transform duration-200 group-hover:scale-105" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                                    <Icon size={19} style={{ color }} strokeWidth={2} />
                                </div>
                                <h3 className="text-base font-bold text-foreground mb-2">{title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FEATURES ────────────────────────────────────────────────────── */}
            <section id="features" className="py-28 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP} className="text-center mb-16">
                        <p className="text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-widest mb-3">Everything you need</p>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-4">
                            Built for every member of your team
                        </h2>
                        <p className="text-muted-foreground max-w-md mx-auto text-base">
                            Developers, PMs, and founders — DB-Lighthouse speaks your language.
                        </p>
                    </motion.div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {FEATURES.map(({ icon: Icon, color, bg, border, title, desc, tag }, i) => (
                            <motion.div
                                key={title}
                                custom={i}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                variants={FADE_UP}
                                className="relative bg-card border border-border rounded-2xl p-6 hover:shadow-xl hover:shadow-violet-500/6 hover:-translate-y-1 hover:border-violet-500/20 transition-all duration-300 group cursor-default overflow-hidden"
                            >
                                {/* Background gradient on hover */}
                                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-muted/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                {/* Tag */}
                                <div className="relative flex items-center justify-between mb-5">
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200" style={{ background: bg, border: `1px solid ${border}` }}>
                                        <Icon size={19} style={{ color }} strokeWidth={2} />
                                    </div>
                                    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border" style={{ color, background: bg, borderColor: border }}>
                                        {tag}
                                    </span>
                                </div>
                                <h3 className="relative font-bold text-foreground mb-2 text-[15px]">{title}</h3>
                                <p className="relative text-sm text-muted-foreground leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FAQ ─────────────────────────────────────────────────────────── */}
            <section id="faq" className="py-28 px-4 sm:px-6 border-t border-border bg-muted/20">
                <div className="max-w-2xl mx-auto">
                    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP} className="text-center mb-14">
                        <p className="text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-widest mb-3">FAQ</p>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">Common questions</h2>
                    </motion.div>

                    <div className="flex flex-col gap-3">
                        {FAQ_ITEMS.map(({ question, answer }, i) => (
                            <motion.div
                                key={question}
                                custom={i}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                variants={FADE_UP}
                                className="bg-card border border-border rounded-2xl overflow-hidden hover:border-violet-500/20 transition-colors duration-200"
                            >
                                <button
                                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                    className="w-full flex items-center justify-between px-6 py-4.5 py-4 text-left cursor-pointer hover:bg-muted/30 transition-colors duration-150 gap-4"
                                    aria-expanded={openFaq === i}
                                >
                                    <span className="font-semibold text-foreground text-sm">{question}</span>
                                    <ChevronDown
                                        size={16}
                                        className={`text-muted-foreground shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180 text-violet-500' : ''}`}
                                    />
                                </button>
                                <AnimatePresence initial={false}>
                                    {openFaq === i && (
                                        <motion.div
                                            key="content"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                            style={{ overflow: 'hidden' }}
                                        >
                                            <p className="px-6 pb-5 pt-3 text-sm text-muted-foreground leading-relaxed border-t border-border">
                                                {answer}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
            <section className="py-32 px-4 sm:px-6 border-t border-border relative overflow-hidden">
                {/* Radial glow behind CTA */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-violet-500/8 blur-[120px]" />
                </div>

                <div className="relative max-w-2xl mx-auto text-center">
                    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
                        {/* Icon */}
                        <div className="relative inline-flex items-center justify-center mb-8">
                            <div className="absolute inset-0 rounded-2xl bg-violet-500/20 blur-xl scale-125" />
                            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-2xl shadow-violet-500/40">
                                <Database size={28} className="text-white" strokeWidth={2} />
                            </div>
                        </div>

                        <h2 className="text-3xl sm:text-5xl font-extrabold text-foreground tracking-tight mb-5 leading-[1.1]">
                            Ready to illuminate<br />
                            <span className="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent">
                                your database?
                            </span>
                        </h2>
                        <p className="text-muted-foreground text-lg mb-10 leading-relaxed max-w-lg mx-auto">
                            Connect your PostgreSQL database for free. No credit card, no setup — just clarity.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <MagneticCTAButton onClick={ctaAction} label={ctaLabel} />
                            <a href="#how-it-works" className="mt-2 sm:mt-0 px-6 py-4 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-transparent hover:border-border rounded-xl">
                                See how it works →
                            </a>
                        </div>

                        <p className="mt-6 text-xs text-muted-foreground">
                            No credit card required · Universal database support · Self-hostable
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* ── FOOTER ──────────────────────────────────────────────────────── */}
            <footer className="py-8 px-4 sm:px-6 border-t border-border">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                            <Database size={9} className="text-white" />
                        </div>
                        <span className="font-semibold text-foreground">DB-Lighthouse</span>
                        <span>·</span>
                        <span>© 2026</span>
                    </div>
                    <div className="flex items-center gap-5">
                        {["Privacy", "Terms", "GitHub", "Docs"].map(link => (
                            <a key={link} href="#" className="hover:text-foreground transition-colors cursor-pointer">{link}</a>
                        ))}
                    </div>
                </div>
            </footer>

        </div>
    );
}
