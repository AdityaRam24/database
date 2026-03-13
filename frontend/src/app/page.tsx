'use client';

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { ChatInput, ChatInputTextArea, ChatInputSubmit } from "@/components/ui/chat-input";
import { GlowCard } from "@/components/ui/spotlight-card";
import { DitheringShader } from "@/components/ui/dithering-shader";
import { CyberneticBentoGrid } from "@/components/ui/cybernetic-bento-grid";
import { Sparkles, Database, Shield, Zap, Search, BarChart3 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Home() {
    const { user, signInWithGoogle } = useAuth();
    const router = useRouter();
    const [prompt, setPrompt] = useState("");
    const [isLoading, setIsLoading] = useState(false);

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

    return (
        <div className="relative w-full h-[100dvh] overflow-hidden bg-black text-white selection:bg-purple-500/30 font-sans">
            {/* Top Navigation */}
            <nav className="absolute top-0 w-full z-50 flex items-center justify-between px-6 py-5 md:px-12 backdrop-blur-sm border-b border-white/5">
                <div className="flex items-center gap-3 font-semibold text-xl tracking-tight">
                    <Database className="text-purple-500" strokeWidth={2.5} />
                    <span className="hidden sm:inline">DB-Lighthouse</span>
                </div>
                <div className="flex gap-4">
                    {user ? (
                        <button onClick={() => router.push('/dashboard')} className="px-5 py-2 rounded-full border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium">
                            Dashboard
                        </button>
                    ) : (
                        <button onClick={signInWithGoogle} className="px-5 py-2 rounded-full bg-white text-black hover:bg-zinc-200 transition-colors text-sm font-bold">
                            Sign In
                        </button>
                    )}
                </div>
            </nav>

            <BackgroundPaths>
                <div className="flex flex-col items-center justify-center w-full min-h-[80vh] pt-12">
                    
                    {/* Hero Text */}
                    <div className="text-center mb-16 max-w-4xl z-20 flex flex-col items-center mt-6">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-300 text-sm font-semibold mb-6 backdrop-blur-sm">
                            <Sparkles size={16} /> <span className="tracking-wide">THE AUTONOMOUS DATABASE AGENT</span>
                        </div>
                        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-br from-white via-zinc-200 to-zinc-500 pb-2">
                            Command your data<br />with natural language.
                        </h1>
                        <p className="text-lg md:text-xl text-zinc-400 font-medium max-w-2xl mx-auto leading-relaxed">
                            Stop writing complex SQL. Start conversing with your database using enterprise-grade AI, auto-healing queries, and real-time semantic analysis.
                        </p>
                    </div>

                    {/* Interactive Showcase */}
                    <div className="relative w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 items-center lg:items-center justify-center z-20 px-4">
                        
                        {/* Governance Card - Left */}
                        <div className="hidden lg:flex mt-8 drop-shadow-2xl">
                            <GlowCard size="sm" glowColor="purple" className="flex flex-col items-start gap-4 bg-zinc-950/80 border-white/10 p-6 rounded-[2rem]">
                                <div className="p-3 bg-purple-500/20 rounded-xl mb-2">
                                    <Shield className="text-purple-400" size={28} strokeWidth={2.5} />
                                </div>
                                <h3 className="font-bold text-lg text-zinc-100 uppercase tracking-wide">Governance</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed font-medium">Auto-limit rules, PII masking, and multi-factor execution controls keep your data safe.</p>
                            </GlowCard>
                        </div>

                        {/* Center Stage: Chat Input & Dithering */}
                        <div className="w-full max-w-2xl flex-1 relative flex flex-col items-center group perspective-1000">
                            {/* Accent Shader Behind Chat */}
                            <div 
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[250%] -z-10 opacity-40 group-hover:opacity-70 transition-opacity duration-1000 pointer-events-none mix-blend-screen"
                                style={{ maskImage: 'radial-gradient(circle at center, black, transparent 60%)', WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 60%)' }}
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
                                        placeholder="Ask your database anything... e.g., 'Show me users who churned last month'" 
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
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1 }}
                                className="mt-8 flex gap-6 sm:gap-8 text-xs sm:text-sm text-zinc-400 font-bold uppercase tracking-wider"
                            >
                                <span className="flex items-center gap-2"><Zap size={16} className="text-white/60"/> Instant Queries</span>
                                <span className="flex items-center gap-2"><Search size={16} className="text-white/60"/> Deep Insights</span>
                            </motion.div>
                        </div>

                        {/* Performance Card - Right */}
                        <div className="hidden lg:flex -mt-16 drop-shadow-2xl">
                            <GlowCard size="sm" glowColor="blue" className="flex flex-col items-start gap-4 bg-zinc-950/80 border-white/10 p-6 rounded-[2rem]">
                                <div className="p-3 bg-blue-500/20 rounded-xl mb-2">
                                    <BarChart3 className="text-blue-400" size={28} strokeWidth={2.5} />
                                </div>
                                <h3 className="font-bold text-lg text-zinc-100 uppercase tracking-wide">Performance</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed font-medium">Identify zombie indexes, fix bottleneck queries, and optimize storage instantly.</p>
                            </GlowCard>
                        </div>

                    </div>
                </div>
            </BackgroundPaths>

            <div className="relative z-20 w-full pb-24 border-t border-white/5 bg-gradient-to-b from-black to-[#050508] pt-20">
                <CyberneticBentoGrid />
            </div>
        </div>
    );
}
