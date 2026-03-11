'use client';
import { useRef } from 'react';
import { useScroll } from 'framer-motion';
import Lighthouse from './Lighthouse';
import Beam from './Beam';
import FakeGraph from './FakeGraph';
import RevealContent from './RevealContent';

// Lighthouse lantern position in viewport (px), anchored to center-bottom of sticky container
// These match the lantern's SVG cx=100, cy=90 mapped into the DOM layout
const LANTERN_X = 0;   // beam origin is at the lighthouse element's local (0,0); see Beam positioning
const LANTERN_Y = 0;

interface HeroSectionProps {
    onGetStarted: () => void;
}

export default function HeroSection({ onGetStarted }: HeroSectionProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const maskTargetRef = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ['start start', 'end end'],
    });

    // Lighthouse lantern is centered horizontally, at ~32% from top of the sticky viewport
    // These are the pixel coords inside the sticky container where the lantern sits
    const lighthouseOffsetX = typeof window !== 'undefined' ? window.innerWidth / 2 - 10 : 700;
    const lighthouseOffsetY = typeof window !== 'undefined' ? window.innerHeight * 0.6 - 240 : 150;

    return (
        <div ref={containerRef} style={{ height: '200vh', position: 'relative' }}>
            {/* ─── Sticky viewport ─── */}
            <div style={{
                position: 'sticky',
                top: 0,
                height: '100vh',
                overflow: 'hidden',
                background: 'linear-gradient(to bottom, #0B0F14 0%, #0E1624 60%, #0B0F14 100%)',
            }}>

                {/* Stars */}
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    backgroundImage: `
                        radial-gradient(1px 1px at 10% 15%, rgba(255,255,255,0.6) 0%, transparent 100%),
                        radial-gradient(1px 1px at 28% 8%, rgba(255,255,255,0.5) 0%, transparent 100%),
                        radial-gradient(1px 1px at 54% 20%, rgba(255,255,255,0.45) 0%, transparent 100%),
                        radial-gradient(1px 1px at 76% 11%, rgba(255,255,255,0.55) 0%, transparent 100%),
                        radial-gradient(1px 1px at 91% 28%, rgba(255,255,255,0.4) 0%, transparent 100%),
                        radial-gradient(1px 1px at 20% 42%, rgba(255,255,255,0.35) 0%, transparent 100%),
                        radial-gradient(1px 1px at 62% 48%, rgba(255,255,255,0.3) 0%, transparent 100%),
                        radial-gradient(1px 1px at 44% 62%, rgba(255,255,255,0.28) 0%, transparent 100%),
                        radial-gradient(1px 1px at 87% 55%, rgba(255,255,255,0.25) 0%, transparent 100%),
                        radial-gradient(1px 1px at 5% 78%, rgba(255,255,255,0.22) 0%, transparent 100%),
                        radial-gradient(1px 1px at 38% 82%, rgba(255,255,255,0.2) 0%, transparent 100%),
                        radial-gradient(1px 1px at 72% 75%, rgba(255,255,255,0.18) 0%, transparent 100%)
                    `,
                }} />

                {/* Ocean horizon */}
                <div style={{
                    position: 'absolute', bottom: '29%', left: 0, right: 0, height: 1, pointerEvents: 'none',
                    background: 'linear-gradient(to right, transparent, rgba(59,130,246,0.2) 20%, rgba(59,130,246,0.2) 80%, transparent)',
                }} />

                {/* Fog */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '32%', pointerEvents: 'none',
                    background: 'linear-gradient(to top, rgba(11,15,20,0.9) 0%, transparent 100%)',
                }} />

                {/* ── Fake Graph (mask-revealed) ── */}
                {/* The graph sits behind with CSS mask that follows the beam */}
                <div
                    ref={maskTargetRef}
                    style={{
                        position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
                        maskImage: 'radial-gradient(circle at var(--beam-x, 50%) var(--beam-y, 50%), rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 25%, rgba(0,0,0,0) 55%)',
                        WebkitMaskImage: 'radial-gradient(circle at var(--beam-x, 50%) var(--beam-y, 50%), rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 25%, rgba(0,0,0,0) 55%)',
                    }}
                >
                    <FakeGraph scrollYProgress={scrollYProgress} />
                </div>

                {/* ── Beam ── */}
                <Beam
                    scrollYProgress={scrollYProgress}
                    originX={lighthouseOffsetX}
                    originY={lighthouseOffsetY}
                    maskTargetRef={maskTargetRef}
                />

                {/* ── Lighthouse ── */}
                <div style={{
                    position: 'absolute',
                    bottom: '28%',
                    left: '50%',
                    transform: 'translateX(-90px)',
                    zIndex: 15,
                }}>
                    <Lighthouse />
                </div>

                {/* ── Text reveals ── */}
                <RevealContent scrollYProgress={scrollYProgress} onGetStarted={onGetStarted} />
            </div>
        </div>
    );
}
