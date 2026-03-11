'use client';
import { MotionValue, motion, useTransform } from 'framer-motion';
import CountUp from 'react-countup';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

interface RevealContentProps {
    scrollYProgress: MotionValue<number>;
    onGetStarted: () => void;
}

export default function RevealContent({ scrollYProgress, onGetStarted }: RevealContentProps) {
    const headlineOpacity = useTransform(scrollYProgress, [0, 0.15], [0, 1]);
    const headlineY = useTransform(scrollYProgress, [0, 0.15], [30, 0]);
    const subOpacity = useTransform(scrollYProgress, [0.4, 0.6], [0, 1]);
    const subY = useTransform(scrollYProgress, [0.4, 0.6], [20, 0]);
    const counterOpacity = useTransform(scrollYProgress, [0.75, 0.95], [0, 1]);
    const counterY = useTransform(scrollYProgress, [0.75, 0.95], [20, 0]);

    const counterRef = useRef(null);
    const inView = useInView(counterRef, { once: true });

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 32px',
            zIndex: 20,
            pointerEvents: 'none',
        }}>
            {/* Stage 1: Headline */}
            <motion.div style={{ opacity: headlineOpacity, y: headlineY, pointerEvents: 'auto' }}>
                <p style={{ color: '#60A5FA', fontSize: 13, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
                    PostgreSQL Intelligence
                </p>
                <h1 style={{
                    fontSize: 'clamp(2.2rem, 5vw, 4rem)',
                    fontWeight: 800,
                    lineHeight: 1.15,
                    color: '#F1F5F9',
                    marginBottom: 20,
                    fontFamily: 'Inter, sans-serif',
                }}>
                    Every database has<br />
                    <span style={{ background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        blind spots.
                    </span>
                </h1>
            </motion.div>

            {/* Stage 3: subheading */}
            <motion.p style={{
                opacity: subOpacity,
                y: subY,
                color: '#94A3B8',
                fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                maxWidth: 540,
                lineHeight: 1.65,
                marginBottom: 32,
                pointerEvents: 'auto',
            }}>
                Hidden inefficiencies silently inflate your storage and slow your queries.
                <br />DB-Lighthouse illuminates them.
            </motion.p>

            {/* Stage 4: Counter + CTA */}
            <motion.div ref={counterRef} style={{ opacity: counterOpacity, y: counterY, pointerEvents: 'auto' }}>
                <div style={{
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: 16,
                    padding: '20px 36px',
                    marginBottom: 28,
                    backdropFilter: 'blur(12px)',
                }}>
                    <p style={{ color: '#64748B', fontSize: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Average storage recovered
                    </p>
                    <p style={{ fontSize: 48, fontWeight: 800, color: '#3B82F6', lineHeight: 1, fontFamily: 'Inter, monospace' }}>
                        {inView ? <CountUp end={18} duration={2} suffix="%" /> : '0%'}
                    </p>
                </div>

                <button
                    onClick={onGetStarted}
                    style={{
                        padding: '14px 36px',
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'white',
                        background: 'linear-gradient(135deg, #3B82F6, #6D28D9)',
                        border: 'none',
                        borderRadius: 10,
                        cursor: 'pointer',
                        boxShadow: '0 4px 30px rgba(59,130,246,0.35)',
                        fontFamily: 'Inter, sans-serif',
                        letterSpacing: '0.01em',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                    🔦 Run Your First Scan
                </button>
            </motion.div>
        </div>
    );
}
