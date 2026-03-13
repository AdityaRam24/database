'use client';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useRef, type ReactNode, type CSSProperties } from 'react';

interface MagneticButtonProps {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
    style?: CSSProperties;
    strength?: number;
}

export default function MagneticButton({
    children,
    onClick,
    className = '',
    style,
    strength = 0.35,
}: MagneticButtonProps) {
    const ref = useRef<HTMLButtonElement>(null);

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const springConfig = { damping: 18, stiffness: 250, mass: 0.5 };
    const springX = useSpring(x, springConfig);
    const springY = useSpring(y, springConfig);

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        x.set((e.clientX - centerX) * strength);
        y.set((e.clientY - centerY) * strength);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.button
            ref={ref}
            style={{
                x: springX,
                y: springY,
                position: 'relative',
                overflow: 'hidden',
                padding: '16px 40px',
                fontSize: 17,
                fontWeight: 700,
                color: 'white',
                background: 'linear-gradient(135deg, #3B82F6 0%, #7C3AED 50%, #3B82F6 100%)',
                backgroundSize: '200% 200%',
                border: 'none',
                borderRadius: 14,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.01em',
                willChange: 'transform',
                ...style,
            }}
            className={`btn-glow animate-gradient ${className}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
            whileHover={{
                scale: 1.06,
                boxShadow: '0 8px 40px rgba(59,130,246,0.45), 0 0 80px rgba(124,58,237,0.2)',
            }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
        >
            {/* Animated shine overlay */}
            <motion.span
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
                    backgroundSize: '200% 100%',
                    pointerEvents: 'none',
                }}
                animate={{
                    backgroundPosition: ['200% 0', '-200% 0'],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatDelay: 2,
                    ease: 'linear',
                }}
            />
            {/* Content */}
            <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                {children}
            </span>
        </motion.button>
    );
}
