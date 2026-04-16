'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

// ─── Central glowing database orb ─────────────────────────────────────────────
function CentralOrb() {
    const ring1 = useRef<THREE.Mesh>(null);
    const ring2 = useRef<THREE.Mesh>(null);
    const ring3 = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (ring1.current) ring1.current.rotation.z = t * 0.45;
        if (ring2.current) {
            ring2.current.rotation.z = -t * 0.3;
            ring2.current.rotation.x = Math.PI / 3 + t * 0.08;
        }
        if (ring3.current) {
            ring3.current.rotation.y = t * 0.22;
            ring3.current.rotation.x = Math.PI * 0.6 - t * 0.05;
        }
    });

    return (
        <Float speed={1.6} rotationIntensity={0.2} floatIntensity={0.55}>
            <group>
                {/* Main distorted orb */}
                <mesh>
                    <sphereGeometry args={[1.5, 64, 64]} />
                    <MeshDistortMaterial
                        color="#6d28d9"
                        distort={0.38}
                        speed={2.2}
                        roughness={0.05}
                        metalness={0.88}
                        emissive="#4c1d95"
                        emissiveIntensity={0.65}
                    />
                </mesh>

                {/* Soft inner halo */}
                <mesh>
                    <sphereGeometry args={[1.48, 32, 32]} />
                    <meshBasicMaterial color="#a855f7" transparent opacity={0.1} side={THREE.BackSide} />
                </mesh>

                {/* Orbital ring 1 — thin, bright */}
                <mesh ref={ring1}>
                    <torusGeometry args={[2.12, 0.013, 3, 128]} />
                    <meshBasicMaterial color="#a855f7" transparent opacity={0.55} />
                </mesh>

                {/* Orbital ring 2 — tilted */}
                <mesh ref={ring2} rotation={[Math.PI / 3, 0, 0]}>
                    <torusGeometry args={[2.55, 0.009, 3, 120]} />
                    <meshBasicMaterial color="#7c3aed" transparent opacity={0.38} />
                </mesh>

                {/* Orbital ring 3 — outer */}
                <mesh ref={ring3} rotation={[Math.PI * 0.6, Math.PI / 4, 0]}>
                    <torusGeometry args={[3.0, 0.007, 3, 100]} />
                    <meshBasicMaterial color="#6d28d9" transparent opacity={0.28} />
                </mesh>
            </group>
        </Float>
    );
}

// ─── Individual orbiting data-node ────────────────────────────────────────────
interface NodeConfig {
    radius: number;
    speed: number;
    phase: number;
    size: number;
    color: string;
    vAmp: number;
    vOff: number;
}

function OrbitingNode({ radius, speed, phase, size, color, vAmp, vOff }: NodeConfig) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!meshRef.current) return;
        const t = state.clock.elapsedTime;
        const angle = t * speed + phase;
        meshRef.current.position.x = Math.cos(angle) * radius;
        meshRef.current.position.y = Math.sin(angle * 0.8) * vAmp + vOff;
        meshRef.current.position.z = Math.sin(angle) * radius * 0.52;
        meshRef.current.rotation.y += 0.022;
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[size, 14, 14]} />
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={1.5}
                roughness={0.08}
                metalness={0.5}
            />
        </mesh>
    );
}

const NODES: NodeConfig[] = [
    { radius: 2.15, speed: 0.50, phase: 0, size: 0.165, color: '#a855f7', vAmp: 0.55, vOff: 0 },
    { radius: 2.55, speed: 0.35, phase: Math.PI * 0.65, size: 0.12, color: '#8b5cf6', vAmp: 0.45, vOff: 0.2 },
    { radius: 2.25, speed: 0.58, phase: Math.PI * 1.3, size: 0.185, color: '#7c3aed', vAmp: 0.65, vOff: -0.15 },
    { radius: 3.05, speed: 0.26, phase: Math.PI * 0.28, size: 0.10, color: '#c084fc', vAmp: 0.4, vOff: 0.35 },
    { radius: 2.85, speed: 0.43, phase: Math.PI, size: 0.14, color: '#6d28d9', vAmp: 0.5, vOff: -0.3 },
    { radius: 3.2, speed: 0.32, phase: Math.PI * 1.65, size: 0.115, color: '#a855f7', vAmp: 0.35, vOff: 0.1 },
];

// ─── Ambient particle field ────────────────────────────────────────────────────
function ParticleField() {
    const count = 650;
    const positions = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 4.5 + Math.random() * 7;
            arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.58;
            arr[i * 3 + 2] = r * Math.cos(phi) - 1.5;
        }
        return arr;
    }, []);

    const ref = useRef<THREE.Points>(null);
    useFrame((state) => {
        if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.011;
    });

    return (
        <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
            <PointMaterial
                transparent
                color="#a855f7"
                size={0.026}
                sizeAttenuation
                depthWrite={false}
                opacity={0.5}
            />
        </Points>
    );
}

// ─── Mouse-parallax scene wrapper ─────────────────────────────────────────────
function Scene() {
    const groupRef = useRef<THREE.Group>(null);
    const { mouse } = useThree();

    useFrame(() => {
        if (!groupRef.current) return;
        groupRef.current.rotation.y += (mouse.x * 0.28 - groupRef.current.rotation.y) * 0.04;
        groupRef.current.rotation.x += (-mouse.y * 0.18 - groupRef.current.rotation.x) * 0.04;
    });

    return (
        <group ref={groupRef}>
            <CentralOrb />
            {NODES.map((node, i) => <OrbitingNode key={i} {...node} />)}
            <ParticleField />
        </group>
    );
}

// ─── Default export ────────────────────────────────────────────────────────────
export default function HeroScene3D() {
    return (
        <Canvas
            camera={{ position: [0, 0, 7.5], fov: 42 }}
            gl={{ antialias: true, alpha: true }}
            dpr={[1, 1.5]}
            style={{ background: 'transparent', width: '100%', height: '100%' }}
        >
            <ambientLight intensity={0.38} />
            <pointLight position={[4, 5, 4]} color="#7c3aed" intensity={12} />
            <pointLight position={[-4, -4, -2]} color="#a855f7" intensity={5} />
            <pointLight position={[0, 0, 6]} color="#ffffff" intensity={0.8} />
            <Scene />
        </Canvas>
    );
}
