'use client';
import { MotionValue, motion, useTransform } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface BeamProps {
    scrollYProgress: MotionValue<number>;
    /** Pixel position of lighthouse lantern in the sticky viewport */
    originX: number;
    originY: number;
    /** Optional ref to an element that gets mask-image updated for physical reveal */
    maskTargetRef?: React.RefObject<HTMLDivElement | null>;
}

export default function Beam({ scrollYProgress, originX, originY, maskTargetRef }: BeamProps) {
    const rotate = useTransform(scrollYProgress, [0.2, 0.85], [-20, 160]);
    const opacity = useTransform(scrollYProgress, [0.1, 0.25], [0, 0.75]);

    // Update CSS mask on maskTarget whenever rotate changes
    useEffect(() => {
        if (!maskTargetRef?.current) return;
        const unsubscribe = rotate.on('change', (deg) => {
            const rad = deg * (Math.PI / 180);
            const radius = 900;
            const bx = originX + radius * Math.cos(rad);
            const by = originY + radius * Math.sin(rad);
            const el = maskTargetRef.current;
            if (el) {
                el.style.setProperty('--beam-x', `${bx}px`);
                el.style.setProperty('--beam-y', `${by}px`);
            }
        });
        return unsubscribe;
    }, [rotate, originX, originY, maskTargetRef]);

    return (
        <motion.div
            style={{
                position: 'absolute',
                top: originY,
                left: originX,
                transformOrigin: '0px 0px',
                rotate,
                opacity,
                zIndex: 10,
                pointerEvents: 'none',
                willChange: 'transform',
                transform: 'translateZ(0)',
            }}
        >
            <svg
                width="700"
                height="350"
                viewBox="0 0 700 350"
                style={{
                    filter: 'blur(7px)',
                    mixBlendMode: 'screen',
                    display: 'block',
                    willChange: 'transform',
                }}
            >
                <defs>
                    <radialGradient id="beamGradV2" cx="0%" cy="50%" r="100%">
                        <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.95" />
                        <stop offset="40%" stopColor="#3B82F6" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                    </radialGradient>
                </defs>
                <polygon points="0,175 700,0 700,350" fill="url(#beamGradV2)" />
            </svg>
        </motion.div>
    );
}
