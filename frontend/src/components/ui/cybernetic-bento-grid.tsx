"use client";
import React, { useEffect, useRef } from 'react';

// Reusable BentoItem component
const BentoItem = ({ className, children }: { className?: string, children: React.ReactNode }) => {
    const itemRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const item = itemRef.current;
        if (!item) return;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = item.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            item.style.setProperty('--mouse-x', `${x}px`);
            item.style.setProperty('--mouse-y', `${y}px`);
        };

        item.addEventListener('mousemove', handleMouseMove);

        return () => {
            item.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <div ref={itemRef} className={`bento-item ${className}`}>
            {children}
        </div>
    );
};

// Main Component
export const CyberneticBentoGrid = () => {
    return (
        <div className="main-container">
            <div className="w-full max-w-6xl z-10">
                <h1 className="text-4xl sm:text-5xl font-bold text-white text-center mb-8">Core Features</h1>
                <div className="bento-grid grid gap-4 lg:grid-cols-3 md:grid-cols-2 grid-cols-1">
                    <BentoItem className="col-span-1 lg:col-span-2 row-span-1 lg:row-span-2 flex flex-col justify-between p-6 bg-[#08080f]/40 backdrop-blur-md border border-white/5 rounded-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="relative z-10">
                            <h2 className="text-2xl font-bold text-white">Real-time Analytics</h2>
                            <p className="mt-2 text-gray-400">Monitor your application's performance with up-to-the-second data streams and visualizations.</p>
                        </div>
                        <div className="mt-4 h-48 bg-black/50 border border-white/10 rounded-lg flex items-center justify-center text-gray-500 relative z-10 overflow-hidden">
                            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-luminosity"></div>
                        </div>
                    </BentoItem>
                    <BentoItem className="p-6 bg-[#08080f]/40 backdrop-blur-md border border-white/5 rounded-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <h2 className="text-xl font-bold text-white relative z-10">Global CDN</h2>
                        <p className="mt-2 text-gray-400 text-sm relative z-10">Deliver content at lightning speed, no matter where your users are.</p>
                    </BentoItem>
                    <BentoItem className="p-6 bg-[#08080f]/40 backdrop-blur-md border border-white/5 rounded-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <h2 className="text-xl font-bold text-white relative z-10">Secure Auth</h2>
                        <p className="mt-2 text-gray-400 text-sm relative z-10">Enterprise-grade authentication and user management built-in.</p>
                    </BentoItem>
                    <BentoItem className="p-6 bg-[#08080f]/40 backdrop-blur-md border border-white/5 rounded-2xl row-span-1 lg:row-span-2 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <h2 className="text-xl font-bold text-white relative z-10">Automated Backups</h2>
                        <p className="mt-2 text-gray-400 text-sm relative z-10">Your data is always safe with automated, redundant backups.</p>
                    </BentoItem>
                    <BentoItem className="p-6 bg-[#08080f]/40 backdrop-blur-md border border-white/5 rounded-2xl col-span-1 lg:col-span-2 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <h2 className="text-xl font-bold text-white relative z-10">Serverless Functions</h2>
                        <p className="mt-2 text-gray-400 text-sm relative z-10">Run your backend code without managing servers. Scale infinitely with ease.</p>
                    </BentoItem>
                    <BentoItem className="p-6 bg-[#08080f]/40 backdrop-blur-md border border-white/5 rounded-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <h2 className="text-xl font-bold text-white relative z-10">CLI Tool</h2>
                        <p className="mt-2 text-gray-400 text-sm relative z-10">Manage your entire infrastructure from the command line.</p>
                    </BentoItem>
                </div>
            </div>
        </div>
    );
};
