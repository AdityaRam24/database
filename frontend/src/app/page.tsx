'use client';

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Database, Zap, Shield, BarChart3, ArrowRight, Github, Twitter } from "lucide-react";

export default function Home() {
    const { user, signInWithGoogle } = useAuth();
    const router = useRouter();

    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans">

            {/* ── Navigation ─────────────────────────────────────────────────── */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-gray-900">
                        <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
                            <Database size={16} className="text-white" strokeWidth={2.5} />
                        </div>
                        <span>Lighthouse <span className="text-gray-400 font-normal">AI</span></span>
                    </div>

                    {/* Nav links */}
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
                        <a href="#" className="hover:text-gray-900 transition-colors">Schema</a>
                        <a href="#" className="hover:text-gray-900 transition-colors">Queries</a>
                        <Link href="/features" className="hover:text-gray-900 transition-colors">Features</Link>
                        <a href="#" className="hover:text-gray-900 transition-colors">API</a>
                    </div>

                    {/* CTA */}
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
                                <button
                                    onClick={signInWithGoogle}
                                    className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    Sign in
                                </button>
                                <button
                                    onClick={signInWithGoogle}
                                    className="px-5 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors"
                                >
                                    Get started
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* ── Hero Section ────────────────────────────────────────────────── */}
            <section className="relative overflow-hidden bg-white pt-24 pb-32">
                {/* Subtle grid background */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(to right, #000 1px, transparent 1px)`,
                        backgroundSize: '60px 60px'
                    }}
                />

                {/* Gradient orb */}
                <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-indigo-100 via-purple-50 to-transparent opacity-70 blur-3xl pointer-events-none" />

                <div className="relative max-w-7xl mx-auto px-6 md:px-12 text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide uppercase mb-8">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Now in public beta
                    </div>

                    {/* Headline */}
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 leading-[1.05] mb-6">
                        Orchestrate your<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600">
                            Information
                        </span>
                    </h1>

                    {/* Sub headline */}
                    <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-500 leading-relaxed mb-12">
                        Lighthouse AI transforms complex database structures into breathable, visual insights.
                        Optimize indexing, secure anomalies, and write queries with AI-assisted clarity.
                    </p>

                    {/* CTA buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => user ? router.push('/dashboard') : signInWithGoogle()}
                            className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-gray-900 text-white font-semibold text-base hover:bg-gray-700 transition-all shadow-xl shadow-gray-900/20 hover:shadow-gray-900/30"
                        >
                            Launch Dashboard
                            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                        <Link
                            href="/features"
                            className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-base hover:border-gray-300 hover:bg-gray-50 transition-all"
                        >
                            Explore Features
                        </Link>
                    </div>

                    {/* Social proof */}
                    <p className="mt-10 text-sm text-gray-400">
                        Trusted by <span className="font-semibold text-gray-600">2,400+</span> engineering teams worldwide
                    </p>
                </div>

                {/* Hero dashboard preview */}
                <div className="relative max-w-6xl mx-auto mt-20 px-6 md:px-12">
                    <div className="rounded-3xl overflow-hidden border border-gray-200 shadow-2xl shadow-gray-900/10 bg-gray-950">
                        {/* Mock toolbar */}
                        <div className="flex items-center gap-2 px-6 py-4 bg-gray-900 border-b border-white/5">
                            <div className="w-3 h-3 rounded-full bg-red-500/70" />
                            <div className="w-3 h-3 rounded-full bg-amber-400/70" />
                            <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                            <div className="flex-1 mx-4 h-7 rounded-lg bg-white/5 flex items-center px-3">
                                <span className="text-xs text-gray-500 font-mono">app.lighthouse.ai/dashboard</span>
                            </div>
                        </div>
                        {/* Mock dashboard body */}
                        <div className="grid grid-cols-3 gap-4 p-6 min-h-[280px] bg-gray-950">
                            {/* Sidebar */}
                            <div className="col-span-1 space-y-2">
                                {['Schema Graph', 'AI Queries', 'Indexing', 'Security', 'Performance'].map((item, i) => (
                                    <div key={i} className={`h-9 rounded-xl flex items-center px-4 text-xs font-medium ${i === 0 ? 'bg-indigo-600/20 text-indigo-400' : 'bg-white/5 text-gray-500'}`}>
                                        {item}
                                    </div>
                                ))}
                            </div>
                            {/* Main panel */}
                            <div className="col-span-2 space-y-3">
                                <div className="h-32 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border border-white/5 flex items-center justify-center">
                                    <span className="text-indigo-400 text-sm font-mono opacity-60">schema_graph.render()</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="h-20 rounded-2xl bg-white/5 border border-white/5" />
                                    <div className="h-20 rounded-2xl bg-white/5 border border-white/5" />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Shadow bottom fade */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                </div>
            </section>

            {/* ── Feature Modules ─────────────────────────────────────────────── */}
            <section className="bg-gray-50 py-28">
                <div className="max-w-7xl mx-auto px-6 md:px-12">
                    <div className="text-center mb-16">
                        <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Core Modules</p>
                        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
                            Powerful Core Modules
                        </h2>
                        <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
                            Everything you need to manage distributed clusters with surgical precision.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {/* Card 1 */}
                        <div className="group bg-white rounded-3xl p-8 border border-gray-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6 group-hover:bg-indigo-100 transition-colors">
                                <Zap size={22} className="text-indigo-600" strokeWidth={2} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">Auto-Indexing Engine</h3>
                            <p className="text-gray-500 leading-relaxed text-sm">
                                Our AI analyzes query patterns in real-time to suggest and implement optimal indexes, reducing latency by up to 85%.
                            </p>
                            <Link href="/features" className="inline-flex items-center gap-1 mt-6 text-sm font-semibold text-indigo-600 hover:gap-2 transition-all">
                                Learn More <ArrowRight size={14} />
                            </Link>
                        </div>

                        {/* Card 2 */}
                        <div className="group bg-white rounded-3xl p-8 border border-gray-100 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mb-6 group-hover:bg-purple-100 transition-colors">
                                <Shield size={22} className="text-purple-600" strokeWidth={2} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">Security Guard</h3>
                            <p className="text-gray-500 leading-relaxed text-sm">
                                Real-time anomaly detection using machine learning to block suspicious injection attempts before they reach the execution layer.
                            </p>
                            <Link href="/features" className="inline-flex items-center gap-1 mt-6 text-sm font-semibold text-purple-600 hover:gap-2 transition-all">
                                Learn More <ArrowRight size={14} />
                            </Link>
                        </div>

                        {/* Card 3 */}
                        <div className="group bg-white rounded-3xl p-8 border border-gray-100 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-6 group-hover:bg-violet-100 transition-colors">
                                <BarChart3 size={22} className="text-violet-600" strokeWidth={2} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">AI Optimization</h3>
                            <p className="text-gray-500 leading-relaxed text-sm">
                                Automated partition management and memory allocation for high-traffic relational nodes.
                            </p>
                            <Link href="/features" className="inline-flex items-center gap-1 mt-6 text-sm font-semibold text-violet-600 hover:gap-2 transition-all">
                                Learn More <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>

                    {/* SQL Playground card — full width */}
                    <div className="mt-6 bg-gray-900 rounded-3xl p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-8">
                        <div className="flex-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-gray-300 mb-4">
                                ✨ Powered by GPT-4
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-3">SQL Playground</h3>
                            <p className="text-gray-400 leading-relaxed">
                                Write complex SQL with natural language prompts. Our engine interprets intent and builds schema-aware queries in seconds.
                            </p>
                        </div>
                        <div className="shrink-0 w-full md:w-96 bg-black/40 rounded-2xl p-4 font-mono text-sm border border-white/10">
                            <p className="text-gray-500 text-xs mb-3">▶ Natural language → SQL</p>
                            <p className="text-emerald-400">"Show me users who churned last month"</p>
                            <p className="text-gray-600 mt-2">→ Generating query...</p>
                            <p className="text-blue-400 mt-1">SELECT * FROM users WHERE churned_at &gt;= ...</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── CTA Section ─────────────────────────────────────────────────── */}
            <section className="bg-white py-28">
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
                            href="/features"
                            className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-base hover:border-gray-300 hover:bg-gray-50 transition-all"
                        >
                            View all Features
                        </Link>
                    </div>
                    <p className="mt-6 text-sm text-gray-400">No credit card required · 14-day free trial · Cancel anytime</p>
                </div>
            </section>

            {/* ── Footer ──────────────────────────────────────────────────────── */}
            <footer className="bg-gray-50 border-t border-gray-100 py-12">
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
