'use client';

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { ChatInput, ChatInputTextArea, ChatInputSubmit } from "@/components/ui/chat-input";
import { GlowCard } from "@/components/ui/spotlight-card";
import { DitheringShader } from "@/components/ui/dithering-shader";
import { CyberneticBentoGrid } from "@/components/ui/cybernetic-bento-grid";
import { Sparkles, Database, Shield, Zap, Search, BarChart3, ChevronDown } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { motion, useScroll, useTransform } from "framer-motion";

// Landing Page Modules
import SchemaAssemblyHero from "@/components/landing/SchemaAssemblyHero";
import SelfHealingScrubber from "@/components/landing/SelfHealingScrubber";
import StorageHeatmapSection from "@/components/landing/StorageHeatmapSection";
import RelationshipPulseSection from "@/components/landing/RelationshipPulseSection";
import QueryStreamParallax from "@/components/landing/QueryStreamParallax";

export default function Home() {
    const { user, signInWithGoogle } = useAuth();
    const router = useRouter();
    const [prompt, setPrompt] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // ── Apple-like unified scroll for 4 feature sections ──────────────────────
    const featuresRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress: featuresProgress } = useScroll({
        target: featuresRef,
        offset: ["start start", "end end"]
    });

    // Each section occupies 25 % of the 400 vh block.
    // Incoming: scales 1.1 → 1.0 + unblurs. Outgoing: scales 1.0 → 0.9 + blurs.
    const scrubberProgress = useTransform(featuresProgress, [0, 0.25], [0, 1]);
    const scrubberOpacity = useTransform(featuresProgress, [0, 0.15, 0.25], [1, 1, 0]);
    const scrubberScale = useTransform(featuresProgress, [0.2, 0.25], [1, 0.9]);
    const scrubberBlur = useTransform(featuresProgress, [0.2, 0.25], ["blur(0px)", "blur(20px)"]);

    const pulseProgress = useTransform(featuresProgress, [0.25, 0.5], [0, 1]);
    const pulseOpacity = useTransform(featuresProgress, [0.2, 0.25, 0.45, 0.5], [0, 1, 1, 0]);
    const pulseScale = useTransform(featuresProgress, [0.2, 0.25, 0.45, 0.5], [1.1, 1, 1, 0.9]);
    const pulseBlur = useTransform(featuresProgress, [0.2, 0.25, 0.45, 0.5], ["blur(20px)", "blur(0px)", "blur(0px)", "blur(20px)"]);

    const heatmapProgress = useTransform(featuresProgress, [0.5, 0.75], [0, 1]);
    const heatmapOpacity = useTransform(featuresProgress, [0.45, 0.5, 0.7, 0.75], [0, 1, 1, 0]);
    const heatmapScale = useTransform(featuresProgress, [0.45, 0.5, 0.7, 0.75], [1.1, 1, 1, 0.9]);
    const heatmapBlur = useTransform(featuresProgress, [0.45, 0.5, 0.7, 0.75], ["blur(20px)", "blur(0px)", "blur(0px)", "blur(20px)"]);

    const streamProgress = useTransform(featuresProgress, [0.75, 1], [0, 1]);
    const streamOpacity = useTransform(featuresProgress, [0.7, 0.75, 1], [0, 1, 1]);
    const streamScale = useTransform(featuresProgress, [0.7, 0.75, 1], [1.1, 1, 1]);
    const streamBlur = useTransform(featuresProgress, [0.7, 0.75, 1], ["blur(20px)", "blur(0px)", "blur(0px)"]);
    // ──────────────────────────────────────────────────────────────────────────

    const handlePromptSubmit = () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setTimeout(() => {
            toast.success("Query understood! Sign in to execute.", {
                description: "Connecting to the database engine..."
            });
            setIsLoading(false);
            if (!user) {
                setTimeout(signInWithGoogle, 1500);
            } else {
                router.push("/connect");
            }
        }, 1200);
    };

    const scrollToInteractive = () => {
        const el = document.getElementById("interactive-chat");
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="relative w-full overflow-hidden bg-black text-white selection:bg-purple-500/30 font-sans">

            {/* ── Fixed Navigation Bar ──────────────────────────────────────── */}
            <nav className="fixed top-0 w-full z-50 flex items-center justify-between px-6 py-5 md:px-12 backdrop-blur-md border-b border-white/5 bg-black/50">
                <div className="flex items-center gap-3 font-semibold text-xl tracking-tight">
                    <Database className="text-purple-500" strokeWidth={2.5} />
                    <span className="hidden sm:inline">DB-Lighthouse</span>
                </div>
                <div className="flex gap-4">
                    {user ? (
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-5 py-2 rounded-full border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium"
                        >
                            Dashboard
                        </button>
                    ) : (
                        <button
                            onClick={signInWithGoogle}
                            className="px-5 py-2 rounded-full bg-white text-black hover:bg-zinc-200 transition-colors text-sm font-bold"
                        >
                            Sign In
                        </button>
                    )}
                </div>
            </nav>

            {/* ── 1. Schema Assembly Hero (scroll-driven graph snap) ─────────── */}
            <SchemaAssemblyHero />

            {/* Animated scroll-down chevron */}
            <div
                className="flex justify-center -mt-[50vh] pb-[20vh] relative z-40 cursor-pointer pointer-events-auto"
                onClick={scrollToInteractive}
            >
                <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="p-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-colors"
                >
                    <ChevronDown size={24} className="text-zinc-400" />
                </motion.div>
            </div>

            {/* ── 2. Interactive Chat Prompt Showcase ───────────────────────── */}
            <section id="interactive-chat" className="relative w-full bg-black py-32 z-30">
                <BackgroundPaths>
                    <div className="flex flex-col items-center justify-center w-full min-h-[60vh]">
                        <div className="relative w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 items-center justify-center px-4">

                            {/* Governance card — Left */}
                            <div className="hidden lg:flex mt-8 drop-shadow-2xl">
                                <GlowCard size="sm" glowColor="purple" className="flex flex-col items-start gap-4 bg-zinc-950/80 border-white/10 p-6 rounded-[2rem]">
                                    <div className="p-3 bg-purple-500/20 rounded-xl mb-2">
                                        <Shield className="text-purple-400" size={28} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="font-bold text-lg text-zinc-100 uppercase tracking-wide">Governance</h3>
                                    <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                                        Auto-limit rules, PII masking, and multi-factor execution controls keep your data safe.
                                    </p>
                                </GlowCard>
                            </div>

                            {/* Centre: Chat input + dithering shader */}
                            <div className="w-full max-w-2xl flex-1 relative flex flex-col items-center group perspective-1000">
                                {/* Accent shader behind chat */}
                                <div
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[250%] -z-10 opacity-40 group-hover:opacity-70 transition-opacity duration-1000 pointer-events-none mix-blend-screen"
                                    style={{
                                        maskImage: 'radial-gradient(circle at center, black, transparent 60%)',
                                        WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 60%)',
                                    }}
                                >
                                    <DitheringShader
                                        shape="wave"
                                        type="8x8"
                                        colorBack="#000000"
                                        colorFront="#c084fc"
                                        pxSize={2}
                                        speed={0.3}
                                        className="w-full h-full"
                                    />
                                </div>

                                <div className="w-full bg-black/60 border border-white/20 p-2 sm:p-3 rounded-[2.5rem] shadow-[0_0_80px_rgba(168,85,247,0.15)] backdrop-blur-2xl transition-all duration-300 hover:shadow-[0_0_100px_rgba(168,85,247,0.25)] hover:border-purple-500/40">
                                    <ChatInput
                                        variant="unstyled"
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        onSubmit={handlePromptSubmit}
                                        loading={isLoading}
                                        onStop={() => setIsLoading(false)}
                                        className="px-4 py-3 sm:py-4 flex gap-3"
                                    >
                                        <ChatInputTextArea
                                            placeholder="Ask your database anything… e.g., 'Show me users who churned last month'"
                                            className="text-white placeholder:text-zinc-500 font-semibold text-lg sm:text-xl leading-relaxed bg-transparent border-none outline-none resize-none px-2"
                                            rows={2}
                                        />
                                        <div className="flex items-end h-full py-1">
                                            <ChatInputSubmit className="bg-white text-black hover:bg-zinc-200 transition-transform hover:scale-105 active:scale-95 w-12 h-12 shadow-xl shrink-0 rounded-full" />
                                        </div>
                                    </ChatInput>
                                </div>

                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    className="mt-8 flex gap-6 sm:gap-8 text-xs sm:text-sm text-zinc-400 font-bold uppercase tracking-wider"
                                >
                                    <span className="flex items-center gap-2"><Zap size={16} className="text-white/60" /> Instant Queries</span>
                                    <span className="flex items-center gap-2"><Search size={16} className="text-white/60" /> Deep Insights</span>
                                    <span className="flex items-center gap-2"><Sparkles size={16} className="text-white/60" /> AI-Powered</span>
                                </motion.div>
                            </div>

                            {/* Performance card — Right */}
                            <div className="hidden lg:flex -mt-16 drop-shadow-2xl">
                                <GlowCard size="sm" glowColor="blue" className="flex flex-col items-start gap-4 bg-zinc-950/80 border-white/10 p-6 rounded-[2rem]">
                                    <div className="p-3 bg-blue-500/20 rounded-xl mb-2">
                                        <BarChart3 className="text-blue-400" size={28} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="font-bold text-lg text-zinc-100 uppercase tracking-wide">Performance</h3>
                                    <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                                        Identify zombie indexes, fix bottleneck queries, and optimize storage instantly.
                                    </p>
                                </GlowCard>
                            </div>

                        </div>
                    </div>
                </BackgroundPaths>
            </section>

            {/* ── 3-6. Seamless Apple-style 4-section scroll sequence (400 vh) ── */}
            <div ref={featuresRef} className="relative w-full h-[400vh] bg-black">
                <div className="sticky top-0 w-full h-screen overflow-hidden bg-black">

                    {/* 3. Self-Healing Security Scrubber */}
                    <motion.div
                        style={{ opacity: scrubberOpacity, scale: scrubberScale, filter: scrubberBlur }}
                        className="absolute inset-0"
                    >
                        <SelfHealingScrubber scrollProgress={scrubberProgress} />
                    </motion.div>

                    {/* 4. Live Relationship Graph Pulse */}
                    <motion.div
                        style={{ opacity: pulseOpacity, scale: pulseScale, filter: pulseBlur }}
                        className="absolute inset-0 z-10"
                    >
                        <RelationshipPulseSection scrollProgress={pulseProgress} />
                    </motion.div>

                    {/* 5. Storage Heatmap / Space Shrinker */}
                    <motion.div
                        style={{ opacity: heatmapOpacity, scale: heatmapScale, filter: heatmapBlur }}
                        className="absolute inset-0 z-20"
                    >
                        <StorageHeatmapSection scrollProgress={heatmapProgress} />
                    </motion.div>

                    {/* 6. Incident Detection / Query Stream Parallax */}
                    <motion.div
                        style={{ opacity: streamOpacity, scale: streamScale, filter: streamBlur }}
                        className="absolute inset-0 z-30"
                    >
                        <QueryStreamParallax scrollProgress={streamProgress} />
                    </motion.div>

                </div>
            </div>

            {/* ── Footer / Bento Grid ───────────────────────────────────────── */}
            <div className="relative z-20 w-full pb-24 border-t border-white/5 bg-[#050508] pt-32">
                <CyberneticBentoGrid />
            </div>

        </div>
    );
}
