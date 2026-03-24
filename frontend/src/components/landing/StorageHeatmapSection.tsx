'use client';

import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';
import { useRef } from 'react';
import { Layers } from 'lucide-react';

const GRID_SIZE = 6;
const BLOCKS = Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
    // Determine random bloat size for marketing visual
    const col = i % GRID_SIZE;
    const row = Math.floor(i / GRID_SIZE);
    
    // Create a cluster of "bloated" tables in the center
    const isCenter = col > 1 && col < 4 && row > 1 && row < 4;
    const isEdge = col === 0 || col === GRID_SIZE - 1 || row === 0 || row === GRID_SIZE - 1;
    
    let baseHeight = 20;
    if (isCenter) baseHeight = 120 + Math.random() * 80;
    else if (!isEdge) baseHeight = 60 + Math.random() * 40;
    else baseHeight = 10 + Math.random() * 20;

    return { id: i, baseHeight, isBloated: baseHeight > 100 };
});

export default function StorageHeatmapSection({ scrollProgress }: { scrollProgress?: MotionValue<number> }) {
    const containerRef = useRef<HTMLDivElement>(null);
    
    const { scrollYProgress: localScroll } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });
    const scrollYProgress = scrollProgress || localScroll;

    // Animation orchestration
    // 0.0 -> 0.2: Fade in grid, rotate to isometric
    // 0.2 -> 0.4: Extrude heights (show bloat)
    // 0.5 -> 0.8: Shrink "bloated" heights (show optimization)
    
    const textOpacity = useTransform(scrollYProgress, [0.05, 0.2], [0, 1]);
    const textY = useTransform(scrollYProgress, [0.05, 0.2], [80, 0]);
    const textBlur = useTransform(scrollYProgress, [0.05, 0.2], ["blur(20px)", "blur(0px)"]);
    const gridRotateX = useTransform(scrollYProgress, [0.05, 0.2], [0, 60]);
    const gridRotateZ = useTransform(scrollYProgress, [0.05, 0.2], [0, -45]);
    const gridScale = useTransform(scrollYProgress, [0.05, 0.2], [1, 1.2]);
    const gridY = useTransform(scrollYProgress, [0.05, 0.2], [0, 100]);

    const extrudeProgress = useTransform(scrollYProgress, [0.2, 0.4], [0, 1]);
    const optimizeProgress = useTransform(scrollYProgress, [0.5, 0.8], [0, 1]);

    const content = (
        <>
                {/* Text Content - Left Side */}
                <motion.div 
                    style={{ opacity: textOpacity, y: textY, filter: textBlur }} 
                    className="w-full md:w-1/2 z-20 flex flex-col items-start pr-12 relative"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm font-semibold mb-6 backdrop-blur-md">
                        <Layers size={16} /> <span className="tracking-wide">STORAGE OPTIMIZATION</span>
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6 leading-tight">
                        Find the space <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                            you didn't know you had.
                        </span>
                    </h2>
                    <p className="text-zinc-400 text-lg md:text-xl max-w-lg leading-relaxed mb-8">
                        Our intelligent Storage Heatmap identifies redundant indexes, bloated text columns, and dead tuples across thousands of tables instantly.
                    </p>
                    
                    <div className="flex flex-col gap-4 w-full max-w-xs">
                        {/* Dynamic Stat Counters based on scroll */}
                        <StatBox 
                            label="Identified Bloat" 
                            valueProgress={useTransform(scrollYProgress, [0.2, 0.4], [0, 842])} 
                            suffix=" GB" 
                            color="text-rose-400" 
                        />
                        <StatBox 
                            label="Reclaimable Space" 
                            valueProgress={useTransform(scrollYProgress, [0.5, 0.8], [0, 615])} 
                            suffix=" GB" 
                            color="text-emerald-400" 
                        />
                    </div>
                </motion.div>

                {/* 3D Grid Visualization - Right Side */}
                <div className="w-full md:w-1/2 h-[600px] relative perspective-[2000px] flex items-center justify-center">
                    <motion.div
                        className="relative w-[300px] h-[300px] grid grid-cols-6 grid-rows-6 gap-2 transform-style-3d"
                        style={{
                            rotateX: gridRotateX,
                            rotateZ: gridRotateZ,
                            scale: gridScale,
                            y: gridY,
                        }}
                    >
                        {BLOCKS.map((block) => (
                            <AnimBlock 
                                key={block.id} 
                                block={block} 
                                extrude={extrudeProgress} 
                                optimize={optimizeProgress} 
                            />
                        ))}
                    </motion.div>
                </div>
        </>
    );

    if (scrollProgress) {
        return <div ref={containerRef} className="absolute inset-0 w-full h-full flex flex-col md:flex-row items-center justify-center overflow-hidden px-8">{content}</div>;
    }

    return (
        <div ref={containerRef} className="relative w-full h-[180vh] bg-black">
            <div className="sticky top-0 w-full h-screen flex flex-col md:flex-row items-center justify-center overflow-hidden px-8">
                {content}
            </div>
        </div>
    );
}

function AnimBlock({ block, extrude, optimize }: { block: any, extrude: MotionValue<number>, optimize: MotionValue<number> }) {
    // Math logic for the block heights
    const currentHeight = useTransform(() => {
        const ext = extrude.get();
        const opt = optimize.get();
        
        let h = 4 + (block.baseHeight * ext); // Extrude up
        
        if (block.isBloated && opt > 0) {
            // Shrink the bloated ones down
            const targetHeight = 40 + Math.random() * 20; 
            h = h - ((h - targetHeight) * opt);
        }
        return h;
    });

    const currentColor = useTransform(() => {
        const opt = optimize.get();
        if (!block.isBloated) return "bg-zinc-800 border-zinc-700"; // default small blocks
        
        // Bloated blocks start red/rose, turn green/emerald when optimized
        if (opt < 0.1) return "bg-rose-500/80 border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.4)]";
        if (opt > 0.9) return "bg-emerald-500/80 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]";
        return "bg-indigo-500/80 border-indigo-400"; // transition state
    });

    return (
        <div className="relative w-full h-full transform-style-3d">
            {/* The 3D Base Floor */}
            <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-sm" />
            
            {/* The Extruding Column */}
            <motion.div 
                className={`absolute bottom-0 w-full rounded-t-sm border-t border-l border-r transition-colors duration-200 ${currentColor.get()}`}
                style={{ 
                    height: currentHeight,
                    transformOrigin: "bottom",
                    // slight fake 3d shading trick:
                    backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 50%, rgba(255,255,255,0.1) 100%)'
                }}
            />
        </div>
    );
}

function StatBox({ label, valueProgress, suffix, color }: { label: string, valueProgress: MotionValue<number>, suffix: string, color: string }) {
    // Hook to force re-render on motion value change for text content
    const [val, setVal] = useRefState(valueProgress);

    return (
        <div className="bg-zinc-950/80 border border-white/10 rounded-xl p-4 backdrop-blur-md">
            <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-3xl font-black font-mono tracking-tighter ${color}`}>
                {Math.round(val)}{suffix}
            </div>
        </div>
    );
}

// Helper to bridge Framer Motion values to React text renders softly
function useRefState(motionValue: MotionValue<number>) {
    const [val, setVal] = require('react').useState(0);
    
    require('react').useEffect(() => {
        setVal(motionValue.get());
        return motionValue.onChange((v: number) => setVal(v));
    }, [motionValue]);
    
    return [Math.round(val), setVal] as const;
}
