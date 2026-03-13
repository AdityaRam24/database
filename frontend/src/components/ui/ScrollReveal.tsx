'use client';
import { motion, useInView } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right' | 'scale';

interface ScrollRevealProps {
    children: ReactNode;
    direction?: Direction;
    delay?: number;
    duration?: number;
    once?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

const offsets: Record<Direction, { x?: number; y?: number; scale?: number }> = {
    up: { y: 40 },
    down: { y: -40 },
    left: { x: 40 },
    right: { x: -40 },
    scale: { scale: 0.85 },
};

export default function ScrollReveal({
    children,
    direction = 'up',
    delay = 0,
    duration = 0.65,
    once = true,
    className,
    style,
}: ScrollRevealProps) {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, { once, margin: '-60px 0px' });

    const offset = offsets[direction];

    return (
        <motion.div
            ref={ref}
            initial={{
                opacity: 0,
                x: offset.x ?? 0,
                y: offset.y ?? 0,
                scale: offset.scale ?? 1,
            }}
            animate={isInView ? {
                opacity: 1,
                x: 0,
                y: 0,
                scale: 1,
            } : {}}
            transition={{
                duration,
                delay,
                ease: [0.22, 1, 0.36, 1],
            }}
            className={className}
            style={style}
        >
            {children}
        </motion.div>
    );
}
