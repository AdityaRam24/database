'use client';

import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';
import { useRef } from 'react';
import { Sparkles } from 'lucide-react';

const NODES = [
    { id: 'users', label: 'users', startX: -400, startY: -300, endX: 20, endY: 30, color: '#c4b5fd' }, // violet-300
    { id: 'orders', label: 'orders', startX: 500, startY: -200, endX: -20, endY: -10, color: '#8b5cf6' }, // violet-500
    { id: 'products', label: 'products', startX: -300, startY: 400, endX: 40, endY: 60, color: '#8b5cf6' }, 
    { id: 'payments', label: 'payments', startX: 600, startY: 300, endX: -40, endY: 40, color: '#a78bfa' }, // violet-400
];

const EDGES = [
    ['users', 'orders'], 
    ['users', 'payments'],
    ['orders', 'products'],
];

function getPos(id: string, progress: number) {
    const n = NODES.find(n => n.id === id)!;
    // Interpret percentages as raw pixel offsets from center for the end state
    // and raw pixels for the start state
    const currentX = n.startX + (n.endX * 5 - n.startX) * progress;
    const currentY = n.startY + (n.endY * 4 - n.startY) * progress;
    return { x: currentX, y: currentY };
}

export default function SchemaAssemblyHero({ scrollProgress }: { scrollProgress?: MotionValue<number> }) {
    const containerRef = useRef<HTMLDivElement>(null);
    
    const { scrollYProgress: localScroll } = useScroll({
        target: containerRef,
        offset: ["start start", "end center"]
    });
    const scrollYProgress = scrollProgress || localScroll;

    // Hero Text Fade Out (Apple precision: dissolves, translates up, and blurs out)
    const textOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);
    const textY = useTransform(scrollYProgress, [0, 0.4], [0, -100]);
    const textBlur = useTransform(scrollYProgress, [0, 0.4], ["blur(0px)", "blur(20px)"]);
    const textScale = useTransform(scrollYProgress, [0, 0.4], [1, 0.95]);
    
    // Graph Assembly Progress
    const assemblyProgress = useTransform(scrollYProgress, [0.05, 0.4], [0, 1]); // Starts sooner, finishes by 40%
    const graphScale = useTransform(scrollYProgress, [0.4, 0.7], [1, 1.2]); // Scales right after assembly
    const graphOpacity = useTransform(scrollYProgress, [0.7, 0.9], [1, 0]); // Fades out before the end

    // Paths drawn
    const pathLength = useTransform(scrollYProgress, [0.2, 0.5], [0, 1]);

    const content = (
        <>
            {/* Hero Text */}
            <motion.div 
                style={{ opacity: textOpacity, y: textY, filter: textBlur, scale: textScale }}
                className="absolute z-30 flex flex-col items-center text-center px-4 pt-12"
            >
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-semibold mb-8 backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                    <Sparkles size={16} /> <span className="tracking-wide">NATURAL LANGUAGE TO SCHEMA</span>
                </div>
                <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white via-zinc-200 to-zinc-600 pb-2">
                    Bring order to<br />database chaos.
                </h1>
                <p className="text-xl text-zinc-400 font-medium max-w-2xl mx-auto leading-relaxed">
                    Scroll down to assemble your schema and illuminate the invisible structures of your data.
                </p>
            </motion.div>

            {/* Animated Graph Assembly */}
            <motion.div 
                style={{ scale: graphScale, opacity: graphOpacity }}
                className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
            >
                <svg width="100%" height="100%" viewBox="-500 -400 1000 800" className="overflow-visible">
                    {/* Animated Edges */}
                    {EDGES.map(([a, b]) => {
                        return (
                            <AnimatedEdge 
                                key={`${a}-${b}`} 
                                a={a} 
                                b={b} 
                                progress={assemblyProgress} 
                                pathLength={pathLength} 
                            />
                        );
                    })}

                    {/* Animated Nodes */}
                    {NODES.map(node => (
                        <AnimatedNode 
                            key={node.id} 
                            node={node} 
                            progress={assemblyProgress} 
                        />
                    ))}
                </svg>
            </motion.div>
            
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] z-0" />
        </>
    );

    if (scrollProgress) {
        return <div ref={containerRef} className="absolute inset-0 w-full h-full flex flex-col items-center justify-center overflow-hidden">{content}</div>;
    }

    return (
        <div ref={containerRef} className="relative w-full h-[150vh] bg-black">
            {/* Sticky Container for Hero Content */}
            <div className="sticky top-0 w-full h-screen flex flex-col items-center justify-center overflow-hidden">
                {content}
            </div>
        </div>
    );
}

// Subcomponents for tracking individual framer motion values cleanly

function AnimatedEdge({ a, b, progress, pathLength }: { a: string, b: string, progress: MotionValue<number>, pathLength: MotionValue<number> }) {
    const x1 = useTransform(progress, p => getPos(a, p).x);
    const y1 = useTransform(progress, p => getPos(a, p).y);
    const x2 = useTransform(progress, p => getPos(b, p).x);
    const y2 = useTransform(progress, p => getPos(b, p).y);

    return (
        <motion.line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#8b5cf6" 
            strokeWidth="3"
            strokeLinecap="round"
            style={{ pathLength }}
            opacity={0.6}
        />
    );
}

function AnimatedNode({ node, progress }: { node: any, progress: MotionValue<number> }) {
    const x = useTransform(progress, p => getPos(node.id, p).x);
    const y = useTransform(progress, p => getPos(node.id, p).y);
    const opacity = useTransform(progress, [0, 0.2], [0, 1]);

    return (
        <motion.g style={{ x, y, opacity }}>
            {/* outer glow */}
            <circle r={45} fill={node.color} opacity={0.15} style={{ filter: 'blur(10px)' }}/>
            {/* node body */}
            <circle r={35} fill="#0a0a0f" stroke={node.color} strokeWidth={2} />
            {/* inner solid */}
            <circle r={15} fill={node.color} opacity={0.9} />
            {/* label */}
            <text y={65} textAnchor="middle" fill="#e2e8f0" fontSize={16} fontWeight={600} fontFamily="system-ui, sans-serif">
                {node.label}
            </text>
        </motion.g>
    );
}
