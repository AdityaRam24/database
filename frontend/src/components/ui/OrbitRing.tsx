'use client';
import { motion } from 'framer-motion';

const ICONS = ['◆', '⬡', '◇', '⬢', '△', '○'];

interface OrbitRingProps {
    size?: number;
    duration?: number;
    reverse?: boolean;
    color?: string;
    iconCount?: number;
}

export default function OrbitRing({
    size = 300,
    duration = 20,
    reverse = false,
    color = 'rgba(59,130,246,0.15)',
    iconCount = 4,
}: OrbitRingProps) {
    return (
        <motion.div
            animate={{ rotate: reverse ? -360 : 360 }}
            transition={{ duration, repeat: Infinity, ease: 'linear' }}
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                border: `1px solid ${color}`,
                position: 'absolute',
                pointerEvents: 'none',
            }}
        >
            {Array.from({ length: iconCount }).map((_, i) => {
                const angle = (360 / iconCount) * i;
                const rad = (angle * Math.PI) / 180;
                const x = Math.cos(rad) * (size / 2);
                const y = Math.sin(rad) * (size / 2);
                return (
                    <motion.div
                        key={i}
                        animate={{ rotate: reverse ? 360 : -360 }}
                        transition={{ duration, repeat: Infinity, ease: 'linear' }}
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: 'rgba(15,15,30,0.8)',
                            border: `1px solid ${color}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            color: 'rgba(148,163,184,0.5)',
                        }}
                    >
                        {ICONS[i % ICONS.length]}
                    </motion.div>
                );
            })}
        </motion.div>
    );
}
