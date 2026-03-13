'use client';

import React, { useEffect, useState } from 'react';
import DualSidebar from "@/components/ui/sidebar-component";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, LogIn, Zap, GitMerge, Database, BookOpen, Activity, Shield, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavBar } from "@/components/ui/tubelight-navbar";
import { EtheralShadow } from "@/components/ui/etheral-shadow";
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { MenuToggle } from '@/components/ui/menu-toggle';

const NAV_ITEMS = [
    { path: '/dashboard', label: 'Overview', icon: Database, color: '#7c3aed', textColor: '#a78bfa' },
    { path: '/dashboard/performance', label: 'Indexing', icon: Zap, color: '#f59e0b', textColor: '#fbbf24' },
    { path: '/dashboard/governance', label: 'Governance', icon: GitMerge, color: '#3b82f6', textColor: '#60a5fa' },
    { path: '/dashboard/data', label: 'Data', icon: Database, color: '#10b981', textColor: '#34d399' },
    { path: '/dashboard/semantic', label: 'Semantic', icon: BookOpen, color: '#f59e0b', textColor: '#fbbf24' },
    { path: '/dashboard/anomaly', label: 'Anomaly', icon: Activity, color: '#ef4444', textColor: '#f87171' },
    { path: '/dashboard/incidents', label: 'Incidents', icon: ShieldAlert, color: '#ef4444', textColor: '#fca5a5' },
    { path: '/dashboard/security', label: 'Security', icon: Shield, color: '#818cf8', textColor: '#818cf8' },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
    const { user, signOut, signInWithGoogle, loading: authLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [projectName, setProjectName] = useState<string>("");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const updateName = () => {
            setProjectName(localStorage.getItem("project_name") || "");
        };
        updateName();
        window.addEventListener('project-changed', updateName);
        return () => window.removeEventListener('project-changed', updateName);
    }, []);

    const handleProjectLoad = (connStr: string, name: string) => {
        setProjectName(name);
        window.dispatchEvent(new CustomEvent('project-changed', { detail: { connStr, name } }));
    };

    if (authLoading) return <div className="flex h-screen items-center justify-center" style={{background: '#08080f', color: '#64748b'}}>Loading...</div>;

    return (
        <EtheralShadow
            className="w-full h-screen overflow-hidden font-sans text-slate-200"
            color="rgba(139, 92, 246, 0.15)"
            animation={{ scale: 60, speed: 40 }}
            noise={{ opacity: 0.3, scale: 1.5 }}
            sizing="fill"
        >
            <div className="flex w-full h-full flex-1">
                <DualSidebar onProjectLoad={handleProjectLoad} />

                <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
                {/* Floating Glassmorphic Header */}
                <header className="sticky top-3 z-40 w-full max-w-[1400px] mx-auto px-3 sm:px-4">
                    <nav className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#0b0b14]/80 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                        {/* Logo */}
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs shadow-[0_0_15px_rgba(124,58,237,0.4)]">🔦</span>
                            <div className="hidden sm:block">
                                <h1 className="text-slate-200 font-bold text-sm whitespace-nowrap leading-tight">DB-Lighthouse</h1>
                                {projectName && <p className="text-slate-500 text-[9px] uppercase tracking-wider">{projectName}</p>}
                            </div>
                        </div>

                        {/* Desktop Links - Tubelight Navbar */}
                        <div className="hidden lg:flex flex-1 justify-center relative px-2">
                            <NavBar items={NAV_ITEMS.map(item => ({ name: item.label, url: item.path, icon: item.icon, color: item.color, textColor: item.textColor }))} />
                        </div>

                        {/* Desktop Auth */}
                        <div className="hidden lg:flex items-center gap-2 shrink-0">
                            {user ? (
                                <>
                                    {user.photoURL && <img src={user.photoURL} alt="avatar" className="w-7 h-7 rounded-full border-2 border-purple-500/30" referrerPolicy="no-referrer" />}
                                    <span className="text-purple-200 text-xs hidden xl:inline-block max-w-[80px] truncate">{user.displayName}</span>
                                    <Button variant="ghost" size="sm" onClick={async () => { await signOut(); router.push('/'); }} className="text-gray-400 hover:text-white text-xs h-7 px-2">
                                        <LogOut size={12} className="mr-1" /> Sign out
                                    </Button>
                                </>
                            ) : (
                                <Button size="sm" onClick={signInWithGoogle} className="bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0 shadow-[0_0_15px_rgba(124,58,237,0.4)] hover:shadow-[0_0_25px_rgba(124,58,237,0.6)] transition-all text-xs h-7 px-3">
                                    <LogIn size={12} className="mr-1" /> Sign in
                                </Button>
                            )}
                        </div>

                        {/* Mobile Menu */}
                        <div className="flex items-center gap-2 lg:hidden">
                            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                                <Button size="icon" variant="ghost" className="xl:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                                    <MenuToggle strokeWidth={2.5} open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} className="size-6 text-slate-300" />
                                </Button>
                                <SheetContent side="right" className="bg-[#0b0b14]/95 border-l border-white/5 backdrop-blur-xl sm:max-w-sm w-3/4 p-0">
                                    <div className="flex flex-col h-full bg-[#08080f]/50">
                                        <div className="p-6 border-b border-white/5 flex items-center gap-3">
                                            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm">🔦</span>
                                            <div>
                                                <h1 className="text-white font-bold text-sm">DB-Lighthouse</h1>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Navigation</div>
                                            {NAV_ITEMS.map((item, idx) => {
                                                const isActive = pathname === item.path;
                                                return (
                                                    <a key={idx} href={item.path} onClick={() => setMobileMenuOpen(false)} 
                                                       className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all border ${isActive ? 'bg-white/5 border-white/10 text-white' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                                        <item.icon size={18} style={{ color: item.color }} />
                                                        <span className="font-medium text-sm">{item.label}</span>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                        <div className="p-6 border-t border-white/5">
                                            {user ? (
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex items-center gap-3">
                                                        {user.photoURL && <img src={user.photoURL} alt="avatar" className="w-10 h-10 rounded-full border-2 border-purple-500/30" referrerPolicy="no-referrer" />}
                                                        <div className="flex flex-col">
                                                            <span className="text-white text-sm font-medium">{user.displayName}</span>
                                                            <span className="text-slate-500 text-xs truncate max-w-[150px]">{user.email}</span>
                                                        </div>
                                                    </div>
                                                    <Button variant="outline" className="w-full justify-start border-white/10 text-slate-300 hover:bg-white/5 hover:text-white" onClick={async () => { setMobileMenuOpen(false); await signOut(); router.push('/'); }}>
                                                        <LogOut size={16} className="mr-2" /> Sign out
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button className="w-full bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0" onClick={() => { setMobileMenuOpen(false); signInWithGoogle(); }}>
                                                    <LogIn size={16} className="mr-2" /> Sign in
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </nav>
                </header>

                {/* Body Content */}
                <div style={{ flex: 1, position: 'relative' }} className="mt-8">
                    {children}
                </div>
            </div>
            </div>
        </EtheralShadow>
    );
}

