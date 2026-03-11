'use client';
import { motion } from 'framer-motion';

export default function Lighthouse() {
    return (
        <div style={{ position: 'relative' }}>
            <svg
                width="180"
                height="360"
                viewBox="0 0 200 400"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ filter: 'drop-shadow(0 0 32px rgba(59,130,246,0.3))' }}
            >
                <defs>
                    <linearGradient id="towerGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E5E7EB" />
                        <stop offset="100%" stopColor="#D1D5DB" />
                    </linearGradient>
                    <radialGradient id="lanternGlow">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="1" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                    </radialGradient>
                </defs>

                {/* Base Platform */}
                <rect x="40" y="360" width="120" height="20" rx="6" fill="#1F2937" />

                {/* Tower Body */}
                <polygon points="80,100 120,100 140,360 60,360" fill="url(#towerGradient)" />

                {/* Red/white stripe accents */}
                <polygon points="82,160 118,160 120,185 80,185" fill="#EF4444" opacity="0.6" />
                <polygon points="83,230 117,230 119,255 81,255" fill="#EF4444" opacity="0.6" />

                {/* Lantern Room */}
                <rect x="75" y="70" width="50" height="40" rx="6" fill="#1E293B" />

                {/* Lantern windows */}
                <rect x="82" y="75" width="10" height="28" rx="2" fill="#3B82F6" opacity="0.9" />
                <rect x="95" y="75" width="10" height="28" rx="2" fill="#3B82F6" opacity="0.9" />
                <rect x="108" y="75" width="10" height="28" rx="2" fill="#3B82F6" opacity="0.9" />

                {/* Lantern top */}
                <rect x="85" y="42" width="30" height="30" rx="4" fill="#D1D5DB" />

                {/* Dome */}
                <ellipse cx="100" cy="42" rx="30" ry="12" fill="#9CA3AF" />

                {/* Railing */}
                <rect x="72" y="66" width="56" height="6" rx="2" fill="#374151" />
                <rect x="72" y="108" width="56" height="5" rx="2" fill="#374151" />

                {/* Light Source Core — the beam pivot at (100, 90) */}
                <circle cx="100" cy="90" r="8" fill="#93C5FD" />

                {/* Glow halo */}
                <circle cx="100" cy="90" r="30" fill="url(#lanternGlow)" opacity="0.5" />
            </svg>

            {/* Animated pulsing glow (scale+opacity only, no blur) */}
            <motion.div
                animate={{ scale: [1, 1.35, 1], opacity: [0.3, 0.65, 0.3] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                    position: 'absolute',
                    top: 52,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 90,
                    height: 55,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)',
                    pointerEvents: 'none',
                    willChange: 'transform, opacity',
                }}
            />
        </div>
    );
}
