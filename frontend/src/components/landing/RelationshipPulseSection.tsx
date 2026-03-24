'use client';

import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

// Define "critical paths" that we want to pulse (light up)
const CRITICAL_PATH_EDGES = [
    { from: 5, to: 12 }, { from: 12, to: 18 }, { from: 18, to: 3 }, { from: 3, to: 25 }, { from: 25, to: 32 }
];

export default function RelationshipPulseSection({ scrollProgress }: { scrollProgress?: MotionValue<number> }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const [backgroundNodes, setBackgroundNodes] = useState<any[]>([]);
    const [backgroundEdges, setBackgroundEdges] = useState<any[]>([]);

    useEffect(() => {
        // Generate on client to avoid hydration mismatch
        const nodes = Array.from({ length: 40 }).map((_, i) => ({
            id: i,
            x: Math.random() * 1000 - 500,
            y: Math.random() * 800 - 400,
            r: Math.random() * 6 + 2,
        }));
        
        const edges = Array.from({ length: 60 }).map((_, i) => {
            const from = Math.floor(Math.random() * 40);
            const to = Math.floor(Math.random() * 40);
            return { id: i, from, to };
        });

        setBackgroundNodes(nodes);
        setBackgroundEdges(edges);
        setMounted(true);
    }, []);
    
    // Total height 250vh so the critical path text stays pinned while scrolling
    const { scrollYProgress: localScroll } = useScroll({
        target: containerRef,
        offset: ["start start", "end center"]
    });
    const scrollYProgress = scrollProgress || localScroll;

    // We pulse the specific critical edges instantly as the section comes into view
    const pulseIntensity = useTransform(scrollYProgress, 
        [0.05, 0.2, 0.6, 0.85], 
        [0.1, 1, 1, 0.1]
    );

    const textOpacity = useTransform(scrollYProgress, [0.05, 0.2], [0, 1]);
    const textY = useTransform(scrollYProgress, [0.05, 0.2], [80, 0]);
    const textBlur = useTransform(scrollYProgress, [0.05, 0.2], ["blur(20px)", "blur(0px)"]);

    const content = (
        <>
                {/* Background Chaotic Graph */}
                <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
                    <svg width="100%" height="100%" viewBox="-500 -400 1000 800" preserveAspectRatio="xMidYMid slice">
                        {/* Normal chaotic edges (dim) */}
                        {mounted && backgroundEdges.map(edge => {
                            const n1 = backgroundNodes[edge.from];
                            const n2 = backgroundNodes[edge.to];
                            if (!n1 || !n2) return null;
                            return (
                                <line 
                                    key={`edge-${edge.id}`} 
                                    x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} 
                                    stroke="#334155" strokeWidth="1" opacity="0.4"
                                />
                            );
                        })}

                        {/* Critical Path Edges (Pulse on scroll) */}
                        {mounted && CRITICAL_PATH_EDGES.map((edge, i) => {
                            const n1 = backgroundNodes[edge.from];
                            const n2 = backgroundNodes[edge.to];
                            if (!n1 || !n2) return null;
                            return (
                                <motion.line 
                                    key={`critical-${i}`} 
                                    x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} 
                                    stroke="#c084fc" /* purple-400 */
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    style={{ opacity: pulseIntensity, filter: 'drop-shadow(0 0 10px rgba(192, 132, 252, 0.8))' }}
                                />
                            );
                        })}

                        {/* Nodes */}
                        {mounted && backgroundNodes.map(node => (
                            <circle key={`node-${node.id}`} cx={node.x} cy={node.y} r={node.r} fill="#475569" />
                        ))}
                    </svg>
                </div>

                {/* Foreground Text */}
                <motion.div 
                    style={{ opacity: textOpacity, y: textY, filter: textBlur }}
                    className="z-20 flex flex-col items-center text-center px-4 max-w-3xl bg-black/50 backdrop-blur-md p-10 rounded-3xl border border-white/10 shadow-2xl"
                >
                    <div className="inline-flex items-center gap-2 p-3 bg-purple-500/20 rounded-2xl mb-6">
                        <Activity className="text-purple-400" size={32} />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-6">
                        Cut through the chaos.
                    </h2>
                    <p className="text-zinc-400 text-lg md:text-xl leading-relaxed">
                        Complex ERPs and microservice architectures create massive "spider web" schemas. 
                        DB-Lighthouse's Live Target Tracker isolates the critical JOIN paths dynamically, so you only see what matters.
                    </p>
                </motion.div>
        </>
    );

    if (scrollProgress) {
        return <div ref={containerRef} className="absolute inset-0 w-full h-full flex flex-col items-center justify-center overflow-hidden pointer-events-none">{content}</div>;
    }

    return (
        <div ref={containerRef} className="relative w-full h-[150vh] bg-black">
            <div className="sticky top-0 w-full h-screen flex flex-col items-center justify-center overflow-hidden">
                {content}
            </div>
        </div>
    );
}
