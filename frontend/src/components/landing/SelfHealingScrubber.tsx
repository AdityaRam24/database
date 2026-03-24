'use client';

import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';
import { useRef } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

const BAD_SQL = `
SELECT * FROM users u 
INNER JOIN orders o ON u.id = o.user_id 
INNER JOIN payments p ON o.id = p.order_id
WHERE u.status = 'active'
AND p.amount > 0
ORDER BY o.created_at DESC;
-- Warning: Full table scan detected
-- Warning: Missing indices on 'status'
-- Note: Selecting * transfers 4MB unnecessary data
`;

const GOOD_SQL = `
SELECT u.id, u.email, o.total, p.status 
FROM users u 
JOIN orders o ON u.id = o.user_id 
JOIN payments p ON o.id = p.order_id
WHERE u.status = 'active'
AND p.amount > 0
ORDER BY o.created_at DESC
LIMIT 100;
-- Fixed: Explicit column selection
-- Added: LIMIT clause prevents memory overflow
-- Optimized: Execution time reduced by 84%
`;

export default function SelfHealingScrubber({ scrollProgress }: { scrollProgress?: MotionValue<number> }) {
    const containerRef = useRef<HTMLDivElement>(null);
    
    // We make the container height 250vh so the user has time to scroll through the animation
    const { scrollYProgress: localScroll } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });
    const scrollYProgress = scrollProgress || localScroll;

    // We pull these in tighter so it starts scanning almost immediately and finishes earlier
    const clipHeight = useTransform(scrollYProgress, [0.1, 0.7], ["0%", "100%"]);
    const scannerY = useTransform(scrollYProgress, [0.1, 0.7], ["0%", "100%"]);
    
    // Fade in text (Slide up + cross-blur)
    const textOpacity = useTransform(scrollYProgress, [0, 0.15], [0, 1]);
    const textY = useTransform(scrollYProgress, [0, 0.15], [80, 0]);
    const textBlur = useTransform(scrollYProgress, [0, 0.15], ["blur(20px)", "blur(0px)"]);

    const content = (
        <>
                {/* Header Text */}
                <motion.div style={{ opacity: textOpacity, y: textY, filter: textBlur }} className="text-center mb-12 z-20 px-4">
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
                        The Self-Healing <span className="text-emerald-400">Security Loop</span>
                    </h2>
                    <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto">
                        DB-Lighthouse intercepts dangerous or highly inefficient queries in real-time, rewriting them before they hit your production database.
                    </p>
                </motion.div>

                {/* The Code Scrubber Container */}
                <div className="relative w-full max-w-4xl mx-auto h-[400px] border border-white/10 rounded-2xl bg-[#0a0a0f] shadow-2xl overflow-hidden font-mono text-sm md:text-base leading-relaxed">
                    
                    {/* BAD SQL (Background Layer) */}
                    <div className="absolute inset-0 p-8 text-rose-300/80 bg-rose-950/10">
                        <div className="flex items-center gap-2 mb-4 text-rose-500 font-bold font-sans text-xs tracking-wider uppercase border-b border-rose-500/20 pb-2">
                            <ShieldAlert size={16} /> Intercepted Raw Query
                        </div>
                        <pre className="whitespace-pre-wrap">{BAD_SQL}</pre>
                    </div>

                    {/* GOOD SQL (Foreground Masked Layer) */}
                    <motion.div 
                        className="absolute inset-x-0 top-0 overflow-hidden bg-[#0a0a0f] border-b-2 border-emerald-500 shadow-[0_5px_30px_rgba(16,185,129,0.3)] z-10"
                        style={{ height: clipHeight }}
                    >
                        <div className="absolute top-0 inset-x-0 h-[400px] p-8 text-emerald-300 bg-emerald-950/10">
                            <div className="flex items-center gap-2 mb-4 text-emerald-500 font-bold font-sans text-xs tracking-wider uppercase border-b border-emerald-500/20 pb-2">
                                <ShieldCheck size={16} /> Optimized Execution Plan
                            </div>
                            <pre className="whitespace-pre-wrap">{GOOD_SQL}</pre>
                        </div>
                    </motion.div>

                    {/* The Scanner Laser Line */}
                    <motion.div 
                        className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_20px_4px_rgba(52,211,153,0.5)] z-20"
                        style={{ top: scannerY, translateY: '-50%' }}
                    />
                </div>
                
                {/* Scroll hint */}
                <motion.div style={{ opacity: textOpacity }} className="absolute bottom-10 flex flex-col items-center gap-2 text-zinc-500 text-sm font-medium animate-pulse">
                    <span>Keep scrolling to scan</span>
                    <div className="w-[1px] h-8 bg-zinc-700"></div>
                </motion.div>
        </>
    );

    if (scrollProgress) {
        return <div ref={containerRef} className="absolute inset-0 w-full h-full flex flex-col items-center justify-center overflow-hidden pt-20">{content}</div>;
    }

    return (
        <div ref={containerRef} className="relative w-full h-[150vh] bg-black">
            <div className="sticky top-0 w-full h-screen flex flex-col items-center justify-center overflow-hidden pt-20">
                {content}
            </div>
        </div>
    );
}
