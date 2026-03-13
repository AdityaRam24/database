'use client';
import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function CursorGlow() {
    const [visible, setVisible] = useState(false);
    const cursorX = useMotionValue(-200);
    const cursorY = useMotionValue(-200);

    const springX = useSpring(cursorX, { damping: 25, stiffness: 200 });
    const springY = useSpring(cursorY, { damping: 25, stiffness: 200 });

    useEffect(() => {
        // Hide on touch devices
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isTouchDevice) return;

        setVisible(true);

        const handleMove = (e: MouseEvent) => {
            cursorX.set(e.clientX);
            cursorY.set(e.clientY);
        };

        window.addEventListener('mousemove', handleMove);
        return () => window.removeEventListener('mousemove', handleMove);
    }, [cursorX, cursorY]);

    if (!visible) return null;

    return (
        <motion.div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: 400,
                height: 400,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, rgba(124,58,237,0.04) 40%, transparent 70%)',
                pointerEvents: 'none',
                zIndex: 2,
                x: springX,
                y: springY,
                translateX: '-50%',
                translateY: '-50%',
                willChange: 'transform',
            }}
        />
    );
}
