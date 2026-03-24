'use client';

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Database, Zap, Shield, MessageSquare, Languages, Server, ArrowRight, ArrowLeft, Github, Twitter } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const FEATURES = [
    {
        icon: Zap,
        color: "indigo",
        title: "AI-Powered Indexing",
        description:
            "Eliminate latency. Our engine automatically caches frequently fired queries, serving results at lightning speeds without ever touching your primary database resources.",
    },
    {
        icon: Server,
        color: "violet",
        title: "Local AI Optimization",
        description:
            "Real-time scanning by edge-running AI suggests architectural improvements without your data leaving the premises.",
    },
    {
        icon: Shield,
        color: "purple",
        title: "Security & Anomalies",
        description:
            "Instant detection of unencrypted fields and query rate spikes. Identify security breaches before they escalate.",
    },
    {
        icon: MessageSquare,
        color: "blue",
        title: "AI Assistant Chat",
        description:
            "The \"Query Anything\" console. Ask complex questions about schema relationships or performance bottlenecks in plain language.",
    },
    {
        icon: Languages,
        color: "emerald",
        title: "Natural Language to SQL",
        description:
            "Convert complex business requirements into highly optimized SQL queries instantly. No more syntax debugging or join optimization headaches.",
    },
    {
        icon: Server,
        color: "amber",
        title: "Multi-Engine Connectivity",
        description:
            "Break the silos. Seamlessly connect, visualize, and query across both SQL (PostgreSQL, MySQL) and NoSQL (MongoDB, Redis) databases in a single view.",
    },
];

const COLOR_MAP: Record<string, { bg: string; icon: string; badge: string }> = {
    indigo:  { bg: "bg-indigo-50",  icon: "text-indigo-600",  badge: "bg-indigo-600" },
    violet:  { bg: "bg-violet-50",  icon: "text-violet-600",  badge: "bg-violet-600" },
    purple:  { bg: "bg-purple-50",  icon: "text-purple-600",  badge: "bg-purple-600" },
    blue:    { bg: "bg-blue-50",    icon: "text-blue-600",    badge: "bg-blue-600"   },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", badge: "bg-emerald-600"},
    amber:   { bg: "bg-amber-50",   icon: "text-amber-600",   badge: "bg-amber-500"  },
};

export default function FeaturesPage() {
    const { user, signInWithGoogle } = useAuth();
    const router = useRouter();

    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans">

            {/* ── Navigation ─────────────────────────────────────────────────── */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-gray-900">
                        <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
                            <Database size={16} className="text-white" strokeWidth={2.5} />
                        </div>
                        <span>Lighthouse <span className="text-gray-400 font-normal">AI</span></span>
                    </Link>

                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
                        <a href="#" className="hover:text-gray-900 transition-colors">Schema</a>
                        <a href="#" className="hover:text-gray-900 transition-colors">Queries</a>
                        <Link href="/features" className="text-gray-900 font-semibold">Features</Link>
                        <a href="#" className="hover:text-gray-900 transition-colors">API</a>
                    </div>

                    <div className="flex items-center gap-3">
                        {user ? (
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="px-5 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors"
                            >
                                Dashboard
                            </button>
                        ) : (
                            <>
                                <button onClick={signInWithGoogle} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                                    Sign in
                                </button>
                                <button onClick={signInWithGoogle} className="px-5 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors">
                                    Get started
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* ── Hero ────────────────────────────────────────────────────────── */}
            <section className="relative overflow-hidden bg-gray-50 pt-24 pb-20 border-b border-gray-100">
                <div className="absolute top-[-15%] left-[-5%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-indigo-100 via-purple-50 to-transparent opacity-80 blur-3xl pointer-events-none" />

                <div className="relative max-w-4xl mx-auto px-6 md:px-12 text-center">
                    <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors">
                        <ArrowLeft size={16} /> Back to Home
                    </Link>
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900 leading-tight mb-6">
                        Experience Database<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600">
                            Intelligence
                        </span>
                    </h1>
                    <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
                        Unlock unprecedented performance and security with our autonomous AI engine.
                        Move beyond spreadsheets into the era of liquid database management.
                    </p>
                </div>
            </section>

            {/* ── Feature Cards Grid ──────────────────────────────────────────── */}
            <section className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-6 md:px-12">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {FEATURES.map((feature, i) => {
                            const Icon = feature.icon;
                            const colors = COLOR_MAP[feature.color];
                            return (
                                <div
                                    key={i}
                                    className="group bg-white rounded-3xl p-8 border border-gray-100 hover:shadow-2xl hover:shadow-gray-900/8 hover:-translate-y-1 transition-all duration-300"
                                >
                                    <div className={`w-12 h-12 rounded-2xl ${colors.bg} flex items-center justify-center mb-6`}>
                                        <Icon size={22} className={colors.icon} strokeWidth={2} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                                    <p className="text-gray-500 leading-relaxed text-sm">{feature.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── CTA Section ─────────────────────────────────────────────────── */}
            <section className="bg-gray-50 border-t border-gray-100 py-28">
                <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
                    <h2 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-6">
                        Ready to illuminate<br />your data?
                    </h2>
                    <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
                        Join the elite engineering teams optimizing their infrastructure with Lighthouse AI. Free cluster for 14 days.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => user ? router.push('/dashboard') : signInWithGoogle()}
                            className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-gray-900 text-white font-semibold text-base hover:bg-gray-700 transition-all shadow-xl shadow-gray-900/20"
                        >
                            Launch Dashboard
                            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                        <Link
                            href="/"
                            className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-base hover:border-gray-300 hover:bg-gray-100 transition-all"
                        >
                            Back to Home
                        </Link>
                    </div>
                    <p className="mt-6 text-sm text-gray-400">No credit card required · 14-day free trial · Cancel anytime</p>
                </div>
            </section>

            {/* ── Footer ──────────────────────────────────────────────────────── */}
            <footer className="bg-white border-t border-gray-100 py-12">
                <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2 font-bold text-gray-900">
                        <div className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center">
                            <Database size={12} className="text-white" strokeWidth={2.5} />
                        </div>
                        Database Lighthouse AI
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                        <a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-gray-900 transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-gray-900 transition-colors">Status</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <a href="#" className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
                            <Github size={16} className="text-gray-600" />
                        </a>
                        <a href="#" className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
                            <Twitter size={16} className="text-gray-600" />
                        </a>
                    </div>
                    <p className="text-sm text-gray-400">© 2024 Database Lighthouse AI. Architecting clarity.</p>
                </div>
            </footer>

        </div>
    );
}
