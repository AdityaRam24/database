'use client';
import { MotionValue, motion, useTransform } from 'framer-motion';

interface FakeGraphProps {
    scrollYProgress: MotionValue<number>;
}

const NODES = [
    { id: 'users', label: 'users', x: 55, y: 30, color: '#3B82F6' },
    { id: 'orders', label: 'orders', x: 25, y: 55, color: '#8B5CF6' },
    { id: 'products', label: 'products', x: 70, y: 60, color: '#8B5CF6' },
    { id: 'payments', label: 'payments', x: 20, y: 80, color: '#EF4444' }, // red = bottleneck
    { id: 'logs', label: 'logs', x: 60, y: 82, color: '#6B7280' },
    { id: 'sessions', label: 'sessions', x: 80, y: 40, color: '#6B7280' },
];

const EDGES = [
    ['users', 'orders'], ['users', 'sessions'],
    ['orders', 'products'], ['orders', 'payments'],
    ['products', 'logs'],
];

function getPos(id: string) {
    const n = NODES.find(n => n.id === id)!;
    return { x: (n.x / 100) * 500, y: (n.y / 100) * 380 };
}

export default function FakeGraph({ scrollYProgress }: FakeGraphProps) {
    const opacity = useTransform(scrollYProgress, [0.3, 0.65], [0, 1]);
    const scale = useTransform(scrollYProgress, [0.3, 0.65], [0.92, 1]);

    return (
        <motion.div
            style={{
                position: 'absolute',
                inset: 0,
                opacity,
                scale,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 5,
            }}
        >
            <svg width="500" height="380" viewBox="0 0 500 380" style={{ overflow: 'visible' }}>
                {/* Edges */}
                {EDGES.map(([a, b]) => {
                    const pa = getPos(a), pb = getPos(b);
                    return (
                        <line
                            key={`${a}-${b}`}
                            x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                            stroke="#3B82F6" strokeOpacity="0.25" strokeWidth="1.5"
                            strokeDasharray="5 4"
                        />
                    );
                })}
                {/* Nodes */}
                {NODES.map(node => {
                    const px = (node.x / 100) * 500;
                    const py = (node.y / 100) * 380;
                    return (
                        <g key={node.id}>
                            {/* Outer glow ring */}
                            <circle cx={px} cy={py} r={18} fill={node.color} opacity={0.12} />
                            {/* Main circle */}
                            <circle cx={px} cy={py} r={10} fill={node.color} opacity={0.85} />
                            {/* Label */}
                            <text x={px} y={py + 26} textAnchor="middle" fill="#94A3B8" fontSize={10} fontFamily="Inter, monospace">
                                {node.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </motion.div>
    );
}
