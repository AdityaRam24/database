'use client';

import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';
import { useRef } from 'react';
import { Network } from 'lucide-react';

const SLOW_QUERIES = [
    "SELECT * FROM large_table WHERE non_indexed_col = 'val'",
    "UPDATE users SET last_login = NOW() -- missing WHERE cache",
    "SELECT count(*) FROM orders GROUP BY user_id -- full scan",
    "DELETE FROM logs WHERE created_at < '2023-01-01' -- blocking",
    "SELECT * FROM products p JOIN inventory i ON p.id = i.pid",
];

const FAST_QUERIES = [
    "SELECT id, name FROM large_table WHERE indexed_col = 'val'",
    "UPDATE users SET last_login = NOW() WHERE id IN (cached)",
    "SELECT cnt FROM agg_orders_mv -- using materialized view",
    "DELETE FROM logs_2022 -- dropped partition, 0ms",
    "SELECT p.id FROM products p JOIN inv i ON p.id = i.pid LIMIT 10",
];

export default function QueryStreamParallax({ scrollProgress }: { scrollProgress?: MotionValue<number> }) {
    const containerRef = useRef<HTMLDivElement>(null);
    
    const { scrollYProgress: localScroll } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    });
    const scrollYProgress = scrollProgress || localScroll;

    // The streams move vertically in parallax to the scroll
    const yRedStream = useTransform(scrollYProgress, [0, 1], ["0%", "-50%"]);
    const yGreenStream = useTransform(scrollYProgress, [0, 1], ["20%", "-80%"]); // Faster parallax

    // Foreground Text Animation
    const textOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);
    const textY = useTransform(scrollYProgress, [0, 0.2], [80, 0]);
    const textBlur = useTransform(scrollYProgress, [0, 0.2], ["blur(20px)", "blur(0px)"]);

    const content = (
        <>
            {/* The Background Streams */}
            <div className="absolute inset-0 flex justify-center gap-10 md:gap-32 opacity-30 font-mono text-xs md:text-sm whitespace-nowrap pointer-events-none">
                
                {/* Slow Red Query Stream */}
                <motion.div style={{ y: yRedStream }} className="flex flex-col gap-8 text-rose-500/50 mt-96 blur-[1px]">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div key={`red-${i}`}>{SLOW_QUERIES[i % SLOW_QUERIES.length]}</div>
                    ))}
                </motion.div>

                {/* AI Filter Glowing Divider line */}
                <div className="w-[2px] h-[300vh] bg-gradient-to-b from-transparent via-cyan-500 to-transparent relative -top-[100vh]">
                     <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-48 h-48 bg-cyan-500/20 blur-3xl rounded-full" />
                </div>

                {/* Fast Green Query Stream */}
                <motion.div style={{ y: yGreenStream }} className="flex flex-col gap-12 text-emerald-400 mt-20">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div key={`green-${i}`} className="font-bold tracking-tight">
                            {FAST_QUERIES[i % FAST_QUERIES.length]} <span className="text-emerald-500/50 ml-4">12ms</span>
                        </div>
                    ))}
                </motion.div>

            </div>

            {/* Foreground Content */}
            <motion.div style={{ opacity: textOpacity, y: textY, filter: textBlur }} className="z-10 text-center px-4 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-sm font-semibold mb-6 backdrop-blur-md">
                    <Network size={16} /> <span className="tracking-wide">PREDICTIVE INDEXING</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6 leading-tight">
                    Intercept anomalies.<br/>
                    Before downtime hits.
                </h2>
                <p className="text-zinc-400 text-lg md:text-xl leading-relaxed">
                    The Incident Detection Engine natively hooks into pg_stat_statements to identify Z-Score anomalies in real-time, filtering out toxic workloads automatically.
                </p>
            </motion.div>

            {/* Fade Out Gradients Top/Bottom */}
            <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black to-transparent z-20" />
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#050508] to-transparent z-20" />
        </>
    );

    if (scrollProgress) {
        return <div ref={containerRef} className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">{content}</div>;
    }

    return (
        <div ref={containerRef} className="relative w-full h-[120vh] bg-black overflow-hidden flex items-center justify-center">
            {content}
        </div>
    );
}
