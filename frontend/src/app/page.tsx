'use client';

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import {
    Database, Zap, Shield, BarChart3, MessageSquare,
    ArrowRight, CheckCircle2, Activity, BookOpen,
    Search, Sparkles, ChevronDown, Check, X, Star,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { toast } from "sonner";

const HeroScene3D = dynamic(() => import("@/components/HeroScene3D"), {
    ssr: false,
    loading: () => <div className="w-full h-full" />,
});

// ─── Static Data ──────────────────────────────────────────────────────────────

const FEATURES = [
    {
        icon: MessageSquare,
        color: "#7c3aed",
        bg: "rgba(124,58,237,0.08)",
        title: "Ask in plain English",
        desc: "No SQL needed. Type 'Which customers haven't ordered in 3 months?' and get an instant, clear answer.",
    },
    {
        icon: Zap,
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.08)",
        title: "Speed up your app",
        desc: "Automatically find slow queries and missing indexes. Get one-click fixes that make your app feel faster.",
    },
    {
        icon: Activity,
        color: "#ef4444",
        bg: "rgba(239,68,68,0.08)",
        title: "Catch problems early",
        desc: "AI monitors your database around the clock and alerts you to anomalies before they affect your users.",
    },
    {
        icon: Shield,
        color: "#10b981",
        bg: "rgba(16,185,129,0.08)",
        title: "Stay protected",
        desc: "Spot security risks, detect PII exposure, and enforce access controls — all explained in plain English.",
    },
    {
        icon: BarChart3,
        color: "#7c3aed",
        bg: "rgba(124,58,237,0.08)",
        title: "Visualize your data",
        desc: "See how all your tables connect with an interactive map. Understand your database structure at a glance.",
    },
    {
        icon: BookOpen,
        color: "#ec4899",
        bg: "rgba(236,72,153,0.08)",
        title: "Define business rules",
        desc: "Write rules in plain English. Prevent bad data, enforce limits, and keep your database healthy automatically.",
    },
];

const HOW_IT_WORKS = [
    {
        step: "01",
        icon: Database,
        title: "Connect your database",
        desc: "Paste your PostgreSQL connection string. No setup, no configuration — done in 30 seconds.",
    },
    {
        step: "02",
        icon: MessageSquare,
        title: "Ask anything",
        desc: "Type a question in plain English. No technical knowledge or SQL experience required.",
    },
    {
        step: "03",
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

const TESTIMONIALS = [
    {
        quote: "DB-Lighthouse caught a missing index slowing our checkout by 3×. One click to fix it. Incredible.",
        name: "Alex Chen",
        role: "Senior Backend Engineer",
        company: "FinTech Co.",
        initials: "AC",
        color: "#7c3aed",
    },
    {
        quote: "Our PM can finally answer 'how many users signed up last week?' without pinging me. Absolute game changer.",
        name: "Sarah Torres",
        role: "CTO",
        company: "SaaS Startup",
        initials: "ST",
        color: "#8b5cf6",
    },
    {
        quote: "The PII detection alone saved us from a compliance nightmare. This is essential tooling for any team.",
        name: "Marcus Reid",
        role: "Platform Lead",
        company: "HealthTech Ltd.",
        initials: "MR",
        color: "#6d28d9",
    },
];

const PRICING = [
    {
        name: "Starter",
        price: "$0",
        period: "forever",
        description: "Perfect for solo developers exploring their database.",
        features: [
            "1 database connection",
            "50 AI queries per day",
            "Schema visualization",
            "Basic optimization hints",
        ],
        unavailable: ["Anomaly detection", "Security scanning", "Team access"],
        cta: "Get Started Free",
        highlighted: false,
        badge: undefined as string | undefined,
    },
    {
        name: "Pro",
        price: "$29",
        period: "per month",
        description: "For growing teams who need the full AI power.",
        features: [
            "Unlimited database connections",
            "Unlimited AI queries",
            "Real-time anomaly detection",
            "Security & PII scanning",
            "Incident logging",
            "Schema governance workflows",
            "Team access (up to 5)",
        ],
        unavailable: [] as string[],
        cta: "Start Free Trial",
        highlighted: true,
        badge: "Most Popular" as string | undefined,
    },
    {
        name: "Enterprise",
        price: "Custom",
        period: "",
        description: "For large teams with advanced compliance requirements.",
        features: [
            "Everything in Pro",
            "SSO & RBAC",
            "On-premise deployment",
            "SLA guarantee",
            "Dedicated support",
            "Custom integrations",
            "Unlimited team members",
        ],
        unavailable: [] as string[],
        cta: "Contact Sales",
        highlighted: false,
        badge: undefined as string | undefined,
    },
];

const FAQ_ITEMS = [
    {
        question: "Is my production database safe?",
        answer: "100%. We clone your schema — not your data — into an isolated shadow database. Your production database is never modified or read beyond the initial connection check. All analysis and optimization runs in a sandboxed environment.",
    },
    {
        question: "Do I need to know SQL?",
        answer: "Not at all. You can ask questions in plain English and get clear, actionable answers. SQL is optional for power users who prefer it.",
    },
    {
        question: "Which databases are supported?",
        answer: "PostgreSQL is fully supported today. MySQL and SQLite support are actively in development and coming soon.",
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
    { value: "< 30s", label: "to connect a database" },
    { value: "100%", label: "schema stays private" },
    { value: "0", label: "SQL knowledge required" },
    { value: "24/7", label: "AI monitoring" },
];

const FADE_UP = {
    hidden: { opacity: 0, y: 24 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
    }),
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
    const { user, signInWithGoogle } = useAuth();
    const router = useRouter();
    const [prompt, setPrompt] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);

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

            {/* Ambient background glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
                <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1100px] h-[700px] rounded-full bg-violet-500/6 blur-[160px]" />
                <div className="absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full bg-purple-600/4 blur-[120px]" />
            </div>

            {/* ── HEADER ─────────────────────────────────────────────────────── */}
            <header className="fixed top-0 w-full z-50 bg-background/85 backdrop-blur-xl border-b border-border">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-md shadow-violet-500/25">
                            <Database size={15} className="text-white" strokeWidth={2.5} />
                        </div>
                        <span className="font-bold text-foreground text-[15px] tracking-tight">DB-Lighthouse</span>
                    </div>

                    <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
                        <a href="#how-it-works" className="hover:text-foreground transition-colors duration-150 cursor-pointer">How it works</a>
                        <a href="#features" className="hover:text-foreground transition-colors duration-150 cursor-pointer">Features</a>
                        <a href="#pricing" className="hover:text-foreground transition-colors duration-150 cursor-pointer">Pricing</a>
                    </nav>

                    <div className="flex items-center gap-2.5">
                        <ThemeToggle />
                        {user ? (
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-md shadow-violet-500/25 cursor-pointer"
                            >
                                Dashboard <ArrowRight size={13} />
                            </button>
                        ) : (
                            <button
                                onClick={signInWithGoogle}
                                className="px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors shadow-md shadow-violet-500/25 cursor-pointer"
                            >
                                Get Started
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* ── HERO ───────────────────────────────────────────────────────── */}
            <section className="pt-24 pb-8 px-4 sm:px-6 overflow-hidden">
                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-6 lg:gap-4 items-center">

                        {/* Left — text, CTAs, search */}
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={FADE_UP}
                            className="flex flex-col items-center lg:items-start text-center lg:text-left order-2 lg:order-1 py-8 lg:py-0"
                        >
                            {/* Badge */}
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 text-xs font-semibold mb-7">
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                                AI-Powered PostgreSQL Intelligence
                            </div>

                            {/* Headline */}
                            <h1 className="text-4xl sm:text-5xl lg:text-[58px] xl:text-[64px] font-extrabold tracking-tight text-foreground leading-[1.07] mb-5">
                                Understand your database
                                <br />
                                <span className="bg-gradient-to-r from-violet-500 via-purple-500 to-violet-700 bg-clip-text text-transparent">
                                    in plain English
                                </span>
                            </h1>

                            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-8 max-w-xl">
                                Ask questions, spot problems, and optimize performance — without writing a single line of SQL.
                                Built for every member of your team.
                            </p>

                            {/* Dual CTA */}
                            <div className="flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3 mb-8 w-full">
                                <button
                                    onClick={user ? () => router.push('/dashboard') : signInWithGoogle}
                                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-base transition-all duration-200 shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 cursor-pointer"
                                >
                                    {user ? 'Go to Dashboard' : 'Get Started Free'}
                                    <ArrowRight size={16} />
                                </button>
                                <a
                                    href="#how-it-works"
                                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-card border border-border text-foreground font-semibold text-base transition-all duration-200 hover:border-violet-500/40 hover:bg-muted/40 cursor-pointer"
                                >
                                    See how it works
                                </a>
                            </div>

                            {/* Search demo input */}
                            <form onSubmit={handleSubmit} className="w-full max-w-lg mb-4">
                                <div className="flex items-center gap-3 p-3 bg-card border-2 border-border rounded-2xl shadow-sm hover:border-violet-500/40 focus-within:border-violet-500/60 focus-within:shadow-violet-500/10 focus-within:shadow-lg transition-all duration-300">
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
                                        className="shrink-0 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-bold transition-all flex items-center gap-2 cursor-pointer"
                                    >
                                        {isLoading
                                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            : <><span className="hidden sm:inline">Ask</span> <ArrowRight size={14} /></>
                                        }
                                    </button>
                                </div>
                            </form>

                            {/* Example prompts */}
                            <div className="flex flex-wrap justify-center lg:justify-start gap-2 mb-7 max-w-lg">
                                {EXAMPLE_PROMPTS.map((q) => (
                                    <button
                                        key={q}
                                        onClick={() => setPrompt(q)}
                                        className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all border border-border cursor-pointer"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>

                            {/* Trust strip */}
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-sm text-muted-foreground">
                                {["PostgreSQL native", "No SQL required", "Privacy first", "Open source"].map((item) => (
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
                            transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.15 }}
                            className="relative order-1 lg:order-2 h-[340px] sm:h-[420px] lg:h-[600px]"
                        >
                            {/* Multi-layer glow behind the orb */}
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-[15%] rounded-full bg-violet-600/18 blur-[70px]" />
                                <div className="absolute inset-[25%] rounded-full bg-purple-500/12 blur-[100px]" />
                            </div>
                            <HeroScene3D />
                        </motion.div>

                    </div>
                </div>
            </section>

            {/* ── STATS STRIP ────────────────────────────────────────────────── */}
            <section className="py-14 px-4 sm:px-6 border-y border-border bg-muted/30">
                <div className="max-w-4xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {STATS.map(({ value, label }, i) => (
                            <motion.div key={label} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
                                <p className="text-3xl font-extrabold text-foreground mb-1">{value}</p>
                                <p className="text-xs text-muted-foreground font-medium leading-snug">{label}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── PRODUCT DEMO PREVIEW ───────────────────────────────────────── */}
            <section className="py-24 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <p className="text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-widest mb-3">Live platform</p>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                            Your database, illuminated
                        </h2>
                    </div>

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={FADE_UP}
                        className="rounded-2xl border border-border bg-card shadow-2xl shadow-violet-500/8 overflow-hidden"
                    >
                        {/* Browser chrome */}
                        <div className="flex items-center gap-1.5 px-4 py-3 bg-muted/50 border-b border-border">
                            <div className="w-3 h-3 rounded-full bg-red-400/70" />
                            <div className="w-3 h-3 rounded-full bg-amber-400/70" />
                            <div className="w-3 h-3 rounded-full bg-green-400/70" />
                            <div className="ml-4 flex-1 max-w-xs bg-background/60 rounded-md px-3 py-1 text-xs text-muted-foreground border border-border">
                                app.db-lighthouse.ai/dashboard
                            </div>
                        </div>

                        {/* Dashboard body */}
                        <div className="p-5 sm:p-6 bg-gradient-to-br from-background to-muted/20">
                            {/* KPI row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                {[
                                    { label: "Health Score", value: "87/100", color: "#7c3aed" },
                                    { label: "Storage Used", value: "142 MB", color: "#3b82f6" },
                                    { label: "Tables", value: "24", color: "#10b981" },
                                    { label: "Relationships", value: "18", color: "#f59e0b" },
                                ].map(({ label, value, color }) => (
                                    <div key={label} className="rounded-xl bg-card border border-border p-3 sm:p-4">
                                        <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">{label}</p>
                                        <p className="text-lg sm:text-xl font-bold" style={{ color }}>{value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Two-panel row */}
                            <div className="grid sm:grid-cols-2 gap-3">
                                {/* AI Recommendations panel */}
                                <div className="rounded-xl bg-card border border-border p-4">
                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                        <Zap size={11} className="text-amber-500" /> AI Recommendations
                                    </p>
                                    {[
                                        { fix: "Add index on orders.user_id", impact: "+40% query speed", status: "critical" },
                                        { fix: "Remove duplicate idx_email", impact: "Save 12 MB storage", status: "warning" },
                                        { fix: "Analyze slow query #4", impact: "3.2s → < 200ms", status: "info" },
                                    ].map(({ fix, impact, status }) => (
                                        <div key={fix} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                                            <div>
                                                <p className="text-xs font-medium text-foreground">{fix}</p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">{impact}</p>
                                            </div>
                                            <div className={`w-2 h-2 rounded-full shrink-0 ml-2 ${status === 'critical' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-500' : 'bg-violet-500'}`} />
                                        </div>
                                    ))}
                                </div>

                                {/* AI Chat panel */}
                                <div className="rounded-xl bg-card border border-border p-4">
                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                        <MessageSquare size={11} className="text-violet-500" /> Ask AI
                                    </p>
                                    <div className="space-y-2.5">
                                        <div className="flex justify-end">
                                            <div className="bg-violet-600 text-white text-xs rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%]">
                                                Which tables have the most rows?
                                            </div>
                                        </div>
                                        <div className="flex justify-start">
                                            <div className="bg-muted text-foreground text-xs rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%] leading-relaxed">
                                                The <strong>orders</strong> table has 1.2M rows, followed by <strong>events</strong> (890K) and <strong>users</strong> (142K).
                                            </div>
                                        </div>
                                        <div className="flex justify-end">
                                            <div className="bg-violet-600 text-white text-xs rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%]">
                                                Any missing indexes?
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-3 py-2.5 bg-muted rounded-xl rounded-tl-sm max-w-[50%]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
            <section id="how-it-works" className="py-24 px-4 sm:px-6 border-y border-border bg-muted/30">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <p className="text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-widest mb-3">Simple by design</p>
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
                                className="relative bg-card border border-border rounded-2xl p-7 hover:border-violet-500/30 hover:shadow-md hover:shadow-violet-500/5 transition-all duration-300 group"
                            >
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 group-hover:bg-violet-500/15 transition-colors duration-200">
                                        <Icon size={18} className="text-violet-600 dark:text-violet-400" strokeWidth={2} />
                                    </div>
                                    <span className="text-5xl font-black text-border leading-none">{step}</span>
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

            {/* ── FEATURES ───────────────────────────────────────────────────── */}
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
                                className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg hover:shadow-violet-500/5 hover:-translate-y-0.5 hover:border-violet-500/20 transition-all duration-300 group cursor-default"
                            >
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200" style={{ background: bg }}>
                                    <Icon size={19} style={{ color }} strokeWidth={2} />
                                </div>
                                <h3 className="font-bold text-foreground mb-2 text-[15px]">{title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── TESTIMONIALS ───────────────────────────────────────────────── */}
            <section className="py-24 px-4 sm:px-6 border-y border-border bg-muted/30">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <p className="text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-widest mb-3">Loved by engineers</p>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                            What teams are saying
                        </h2>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {TESTIMONIALS.map(({ quote, name, role, company, initials, color }, i) => (
                            <motion.div
                                key={name}
                                custom={i}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                variants={FADE_UP}
                                className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 hover:border-violet-500/20 hover:shadow-md hover:shadow-violet-500/5 transition-all duration-300"
                            >
                                <div className="flex gap-0.5">
                                    {Array.from({ length: 5 }).map((_, idx) => (
                                        <Star key={idx} size={13} fill="#f59e0b" className="text-amber-400" />
                                    ))}
                                </div>
                                <p className="text-sm text-foreground leading-relaxed flex-1">"{quote}"</p>
                                <div className="flex items-center gap-3 pt-3 border-t border-border">
                                    <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                        style={{ background: color }}
                                    >
                                        {initials}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">{name}</p>
                                        <p className="text-xs text-muted-foreground">{role} · {company}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── PRICING ────────────────────────────────────────────────────── */}
            <section id="pricing" className="py-24 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <p className="text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-widest mb-3">Pricing</p>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-4">
                            Start free, scale as you grow
                        </h2>
                        <p className="text-muted-foreground max-w-sm mx-auto text-base">
                            No credit card required. Upgrade when your team is ready.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-5 items-start">
                        {PRICING.map(({ name, price, period, description, features, unavailable, cta, highlighted, badge }, i) => (
                            <motion.div
                                key={name}
                                custom={i}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                variants={FADE_UP}
                                className={`relative rounded-2xl p-7 flex flex-col gap-6 transition-all duration-300 ${
                                    highlighted
                                        ? 'bg-violet-600 text-white shadow-2xl shadow-violet-500/30 border-0 md:-translate-y-2'
                                        : 'bg-card border border-border hover:border-violet-500/30'
                                }`}
                            >
                                {badge && (
                                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-white text-violet-700 text-xs font-bold rounded-full shadow-lg shadow-violet-500/20 whitespace-nowrap">
                                        {badge}
                                    </div>
                                )}

                                <div>
                                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${highlighted ? 'text-violet-200' : 'text-muted-foreground'}`}>
                                        {name}
                                    </p>
                                    <div className="flex items-end gap-1 mb-2">
                                        <span className={`text-4xl font-extrabold ${highlighted ? 'text-white' : 'text-foreground'}`}>{price}</span>
                                        {period && (
                                            <span className={`text-sm mb-2 ${highlighted ? 'text-violet-200' : 'text-muted-foreground'}`}>
                                                /{period}
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-sm leading-relaxed ${highlighted ? 'text-violet-100' : 'text-muted-foreground'}`}>
                                        {description}
                                    </p>
                                </div>

                                <button
                                    onClick={user ? () => router.push('/dashboard') : signInWithGoogle}
                                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                                        highlighted
                                            ? 'bg-white text-violet-700 hover:bg-violet-50'
                                            : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-500/20'
                                    }`}
                                >
                                    {cta}
                                </button>

                                <div className="flex flex-col gap-2.5">
                                    {features.map(f => (
                                        <div key={f} className="flex items-start gap-2.5 text-sm">
                                            <Check size={14} className={`mt-0.5 shrink-0 ${highlighted ? 'text-violet-200' : 'text-violet-500'}`} />
                                            <span className={highlighted ? 'text-violet-100' : 'text-foreground'}>{f}</span>
                                        </div>
                                    ))}
                                    {unavailable?.map(f => (
                                        <div key={f} className="flex items-start gap-2.5 text-sm opacity-40">
                                            <X size={14} className="mt-0.5 text-muted-foreground shrink-0" />
                                            <span className="text-muted-foreground">{f}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FAQ ────────────────────────────────────────────────────────── */}
            <section className="py-24 px-4 sm:px-6 border-t border-border bg-muted/30">
                <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-12">
                        <p className="text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-widest mb-3">FAQ</p>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                            Common questions
                        </h2>
                    </div>

                    <div className="flex flex-col gap-3">
                        {FAQ_ITEMS.map(({ question, answer }, i) => (
                            <motion.div
                                key={question}
                                custom={i}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                variants={FADE_UP}
                                className="bg-card border border-border rounded-2xl overflow-hidden"
                            >
                                <button
                                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                    className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer hover:bg-muted/40 transition-colors duration-150"
                                    aria-expanded={openFaq === i}
                                >
                                    <span className="font-semibold text-foreground text-sm pr-4">{question}</span>
                                    <ChevronDown
                                        size={16}
                                        className={`text-muted-foreground shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                <AnimatePresence initial={false}>
                                    {openFaq === i && (
                                        <motion.div
                                            key="content"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2, ease: 'easeInOut' }}
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

            {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
            <section className="py-28 px-4 sm:px-6 border-t border-border">
                <div className="max-w-2xl mx-auto text-center">
                    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 mb-7 shadow-xl shadow-violet-500/30">
                            <Database size={28} className="text-white" strokeWidth={2} />
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-4">
                            Ready to illuminate your database?
                        </h2>
                        <p className="text-muted-foreground text-lg mb-9 leading-relaxed">
                            Connect your PostgreSQL database for free. No credit card, no setup — just answers.
                        </p>
                        <button
                            onClick={user ? () => router.push('/dashboard') : signInWithGoogle}
                            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-lg transition-all duration-200 shadow-xl shadow-violet-500/20 hover:shadow-violet-500/40 hover:-translate-y-0.5 cursor-pointer"
                        >
                            {user ? 'Go to Dashboard' : 'Get Started Free'}
                            <ArrowRight size={18} />
                        </button>
                        <p className="mt-4 text-xs text-muted-foreground">No credit card required · Open source · Self-hostable</p>
                    </motion.div>
                </div>
            </section>

            {/* ── FOOTER ─────────────────────────────────────────────────────── */}
            <footer className="border-t border-border py-10 px-4 sm:px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                                <Database size={13} className="text-white" strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="font-bold text-sm text-foreground leading-tight">DB-Lighthouse AI</p>
                                <p className="text-xs text-muted-foreground">PostgreSQL Intelligence Platform</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
                            <a href="#features" className="hover:text-foreground transition-colors duration-150 cursor-pointer">Features</a>
                            <a href="#pricing" className="hover:text-foreground transition-colors duration-150 cursor-pointer">Pricing</a>
                            <a href="#" className="hover:text-foreground transition-colors duration-150 cursor-pointer">GitHub</a>
                            <a href="#" className="hover:text-foreground transition-colors duration-150 cursor-pointer">Docs</a>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-border">
                        <p className="text-xs text-muted-foreground">© 2025 DB-Lighthouse. All rights reserved.</p>
                        <div className="flex gap-5 text-xs text-muted-foreground">
                            <a href="#" className="hover:text-foreground transition-colors duration-150 cursor-pointer">Privacy Policy</a>
                            <a href="#" className="hover:text-foreground transition-colors duration-150 cursor-pointer">Terms of Service</a>
                        </div>
                    </div>
                </div>
            </footer>

        </div>
    );
}
