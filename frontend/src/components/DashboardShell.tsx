'use client';

// ─────────────────────────────────────────────────────────────
//  FILE: frontend/src/components/DashboardShell.tsx
//  REDESIGNED: Cleaner glassmorphic header, tighter spacing,
//  better mobile menu, improved auth display
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import DualSidebar from '@/components/ui/sidebar-component';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  LogOut, LogIn, Zap, GitMerge, Database,
  BookOpen, Activity, Shield, ShieldAlert, Bot, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NavBar } from '@/components/ui/tubelight-navbar';
import { EtheralShadow } from '@/components/ui/etheral-shadow';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { MenuToggle } from '@/components/ui/menu-toggle';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Home', icon: Database, color: '#6366f1', textColor: '#818cf8' },
  { path: '/dashboard/performance', label: 'Speed', icon: Zap, color: '#f59e0b', textColor: '#fbbf24' },
  { path: '/dashboard/governance', label: 'Changes', icon: GitMerge, color: '#3b82f6', textColor: '#60a5fa' },
  { path: '/dashboard/data', label: 'Explorer', icon: Database, color: '#10b981', textColor: '#34d399' },
  { path: '/dashboard/semantic', label: 'Knowledge', icon: BookOpen, color: '#a78bfa', textColor: '#c4b5fd' },
  { path: '/dashboard/anomaly', label: 'Vitals', icon: Activity, color: '#ef4444', textColor: '#f87171' },
  { path: '/dashboard/incidents', label: 'Alerts', icon: ShieldAlert, color: '#f97316', textColor: '#fb923c' },
  { path: '/dashboard/security', label: 'Security', icon: Shield, color: '#818cf8', textColor: '#a5b4fc' },
  { path: '/dashboard/ai', label: 'Ask AI', icon: Bot, color: '#7c3aed', textColor: '#a78bfa' },
];

// ── User avatar / initials ─────────────────────────────────
function UserChip({ user, onSignOut }: { user: any; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const initials = user.displayName
    ? user.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user.email?.[0].toUpperCase() ?? '?';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt="avatar"
            referrerPolicy="no-referrer"
            className="w-6 h-6 rounded-full border border-black/10 dark:border-white/10"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-600 dark:text-violet-300">
            {initials}
          </div>
        )}
        <span className="hidden xl:block text-[12px] font-medium text-slate-600 dark:text-slate-300 max-w-[80px] truncate">
          {user.displayName ?? user.email}
        </span>
        <ChevronDown size={12} className="hidden xl:block text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl p-1">
            <div className="px-3 py-2 border-b border-black/[0.05] dark:border-white/[0.05] mb-1">
              <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                {user.displayName}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, signOut, signInWithGoogle, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [projectName, setProjectName] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setProjectName(localStorage.getItem('project_name') || '');
    update();
    window.addEventListener('project-changed', update);
    return () => window.removeEventListener('project-changed', update);
  }, []);

  const handleProjectLoad = (connStr: string, name: string) => {
    setProjectName(name);
    window.dispatchEvent(new CustomEvent('project-changed', { detail: { connStr, name } }));
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
          <span className="text-[12px] text-slate-400 font-medium">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <EtheralShadow
      className="w-full h-screen overflow-hidden font-sans text-slate-900 dark:text-slate-200"
      color={resolvedTheme === 'dark' ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.04)'}
      animation={{ scale: 60, speed: 40 }}
      noise={{ opacity: 0.08, scale: 1.5 }}
      sizing="fill"
      style={{ backgroundColor: resolvedTheme === 'dark' ? 'hsl(224 25% 5%)' : '#f8fafc' }}
    >
      {/* Layer 1: The Lock — full viewport, no scroll */}
      <div className="flex h-screen overflow-hidden">
        {/* Layer 2: The Anchor — sidebar pinned, own scroll */}
        <div className="hidden md:flex shrink-0" style={{ position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
          <DualSidebar onProjectLoad={handleProjectLoad} />
        </div>

        {/* Layer 3: The Scroller — main content scrolls independently */}
        <div className="flex-1 overflow-y-auto flex flex-col" style={{ zIndex: 10 }} data-lenis-prevent>

          {/* ── Floating header ── */}
          <header className="sticky top-3 z-40 w-full px-3 sm:px-4">
            <nav className="flex items-center justify-between px-3 sm:px-5 py-2 bg-white/90 dark:bg-slate-900/85 backdrop-blur-2xl border border-black/[0.07] dark:border-white/[0.07] rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.08)]">

              {/* Logo */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-md shadow-violet-500/25">
                  <Database size={13} className="text-white" strokeWidth={2.5} />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-slate-800 dark:text-slate-100 font-bold text-[13px] leading-tight">
                    DB-Lighthouse
                  </h1>
                  {projectName && (
                    <p className="text-slate-400 text-[9px] uppercase tracking-widest font-semibold">
                      {projectName}
                    </p>
                  )}
                </div>
              </div>

              {/* Desktop nav */}
              <div className="hidden xl:flex flex-1 justify-center px-2 min-w-0">
                <NavBar
                  items={NAV_ITEMS.map((item) => ({
                    name: item.label,
                    url: item.path,
                    icon: item.icon,
                    color: item.color,
                    textColor: item.textColor,
                  }))}
                  className="w-full"
                />
              </div>

              {/* Desktop auth */}
              <div className="hidden xl:flex items-center gap-1 shrink-0">
                {user ? (
                  <UserChip
                    user={user}
                    onSignOut={async () => {
                      await signOut();
                      router.push('/');
                    }}
                  />
                ) : (
                  <Button
                    size="sm"
                    onClick={signInWithGoogle}
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-xs h-7 px-3.5 shadow-sm rounded-full font-semibold"
                  >
                    <LogIn size={12} className="mr-1.5" /> Sign in
                  </Button>
                )}
              </div>

              {/* Mobile burger */}
              <div className="flex items-center gap-2 xl:hidden">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="xl:hidden w-8 h-8 rounded-lg"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  >
                    <MenuToggle
                      strokeWidth={2.5}
                      open={mobileMenuOpen}
                      onOpenChange={setMobileMenuOpen}
                      className="size-5 text-slate-700 dark:text-slate-300"
                    />
                  </Button>

                  <SheetContent
                    side="right"
                    className="bg-white/98 dark:bg-slate-950/98 border-l border-black/[0.06] dark:border-white/[0.06] backdrop-blur-xl sm:max-w-sm w-3/4 p-0"
                  >
                    <div className="flex flex-col h-full">
                      {/* Mobile header */}
                      <div className="p-5 border-b border-black/[0.05] dark:border-white/[0.05] flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                          <Database size={14} className="text-white" strokeWidth={2.5} />
                        </div>
                        <div>
                          <h1 className="text-slate-800 dark:text-slate-100 font-bold text-[13px]">
                            DB-Lighthouse
                          </h1>
                          {projectName && (
                            <p className="text-slate-400 text-[9px] uppercase tracking-wider">{projectName}</p>
                          )}
                        </div>
                      </div>

                      {/* Nav links */}
                      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">
                          Navigation
                        </p>
                        {NAV_ITEMS.map((item, idx) => {
                          const isActive = pathname === item.path;
                          return (
                            <a
                              key={idx}
                              href={item.path}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all border ${isActive
                                ? 'bg-black/[0.04] dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.06] text-slate-900 dark:text-white'
                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                                }`}
                            >
                              <item.icon size={17} style={{ color: item.color }} />
                              <span className="font-medium text-[13px]">{item.label}</span>
                            </a>
                          );
                        })}
                      </div>

                      {/* Mobile auth */}
                      <div className="p-5 border-t border-black/[0.05] dark:border-white/[0.05]">
                        {user ? (
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                              {user.photoURL ? (
                                <img
                                  src={user.photoURL}
                                  alt="avatar"
                                  className="w-9 h-9 rounded-full border border-black/10 dark:border-white/10"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-[12px] font-bold text-violet-600 dark:text-violet-300">
                                  {user.displayName?.[0] ?? '?'}
                                </div>
                              )}
                              <div>
                                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                                  {user.displayName}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate max-w-[160px]">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                setMobileMenuOpen(false);
                                await signOut();
                                router.push('/');
                              }}
                              className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-[12px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border border-red-100 dark:border-red-500/20 transition-colors"
                            >
                              <LogOut size={14} /> Sign out
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setMobileMenuOpen(false);
                              signInWithGoogle();
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 transition-all"
                          >
                            <LogIn size={15} /> Sign in with Google
                          </button>
                        )}
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </nav>
          </header>

          {/* ── Page body ── */}
          <div className="flex-1 relative flex flex-col mt-6 px-1 sm:px-2">
            {children}
          </div>
        </div>
      </div>
    </EtheralShadow>
  );
}
