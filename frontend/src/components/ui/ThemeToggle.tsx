'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';

const OPTIONS = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
] as const;

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);
    // Avoid hydration mismatch — render placeholder until mounted
    if (!mounted) return <div className="w-[96px] h-8 rounded-full bg-black/5 dark:bg-white/5 animate-pulse" />;

    return (
        <div
            className="flex items-center gap-0.5 p-0.5 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 backdrop-blur-sm"
            role="group"
            aria-label="Theme selector"
        >
            {OPTIONS.map(({ value, icon: Icon, label }) => {
                const active = theme === value;
                return (
                    <button
                        key={value}
                        onClick={() => setTheme(value)}
                        title={`${label} mode`}
                        aria-pressed={active}
                        className={`relative flex items-center gap-1 px-2 py-1.5 rounded-full transition-all duration-200 text-[11px] font-medium ${
                            active
                                ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm shadow-black/10'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/8'
                        }`}
                    >
                        <Icon size={13} strokeWidth={2} />
                        <span className={`transition-all duration-200 hidden sm:inline-block ${active ? 'max-w-[40px] opacity-100' : 'max-w-0 opacity-0 overflow-hidden'}`}>
                            {label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
