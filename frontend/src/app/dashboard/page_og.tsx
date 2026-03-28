'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import SchemaGraph from "@/components/SchemaGraph";
import OptimizationReport from "@/components/OptimizationReport";
import { useRouter } from "next/navigation";
import OrbitRing from "@/components/ui/OrbitRing";
import { Database, Folder, Key, Zap, GitMerge, Activity, ShieldAlert, Shield, BookOpen, ArrowRight, PlugZap, Plus } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";

const QUICK_ACTIONS = [
    { label: "Speed Optimization", desc: "Make queries faster", icon: Zap, color: "#f59e0b", textColor: "#fbbf24", path: "/dashboard/performance" },
    { label: "Safe Changes", desc: "Modify schema safely", icon: GitMerge, color: "#3b82f6", textColor: "#60a5fa", path: "/dashboard/governance" },
    { label: "Vital Signs", desc: "Monitor traffic & health", icon: Activity, color: "#ef4444", textColor: "#f87171", path: "/dashboard/anomaly" },
    { label: "Alerts", desc: "View incident logs", icon: ShieldAlert, color: "#f97316", textColor: "#fb923c", path: "/dashboard/incidents" },
    { label: "Privacy & Security", desc: "Manage PII & access", icon: Shield, color: "#818cf8", textColor: "#818cf8", path: "/dashboard/security" },
    { label: "Company Knowledge", desc: "Teach the AI rules", icon: BookOpen, color: "#a78bfa", textColor: "#c4b5fd", path: "/dashboard/semantic" },
];

export default function DashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connectionString, setConnectionString] = useState<string | null>(null);
    const [graphKey, setGraphKey] = useState(0);
    const [businessRules, setBusinessRules] = useState<string>('');

    const handleFixApplied = () => {
        setGraphKey(k => k + 1);
        if (connectionString) fetchStats(connectionString);
    };

    const fetchStats = async (connStr: string) => {
        setStatsLoading(true);
        setStats(null);
        setError(null);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/dashboard`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ connection_string: connStr })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `Failed to connect or fetch stats (Status: ${res.status}).`);
            }
            const data = await res.json();
            setStats(data);
        } catch (e: any) {
            console.error(e);
            setError(e.message || "An error occurred while connecting to the database.");
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        const handleProjectLoad = (e: any) => {
            const { connStr } = e.detail;
            setConnectionString(connStr);
            fetchStats(connStr);
        };
        window.addEventListener('project-changed', handleProjectLoad);

        const connStr = localStorage.getItem("db_connection_string");
        if (!connStr) { setStatsLoading(false); return () => window.removeEventListener('project-changed', handleProjectLoad); }
        setConnectionString(connStr);
        fetchStats(connStr);

        // Load business rules
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/semantic/rules`)
            .then(res => res.json())
            .then(data => {
                if (data.rules && data.rules.length > 0) {
                    setBusinessRules(data.rules.map((r: any) => `${r.name}: ${r.definition}`).join('\n'));
                }
            })
            .catch(() => {
                const rules = localStorage.getItem('business_rules');
                if (rules) {
                    const parsed = JSON.parse(rules);
                    setBusinessRules(parsed.map((r: any) => `${r.name}: ${r.definition}`).join('\n'));
                }
            });

        return () => window.removeEventListener('project-changed', handleProjectLoad);
    }, []);

    return (
        <DashboardShell>
            <div className="p-4 md:p-6 w-full flex flex-col flex-1 min-h-0">
                {statsLoading ? (
                    /* ── Loading State ── */
                    <div className="flex flex-col items-center justify-center h-64 gap-4 mt-6">
                        <div className="relative">
                            <div className="w-12 h-12 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Database size={16} className="text-violet-500" />
                            </div>
                        </div>
                        <div className="text-muted-foreground text-sm animate-pulse">Connecting to database…</div>
                    </div>
                ) : error ? (
                    /* ── Error State ── */
                    <div className="flex flex-col items-center justify-center gap-4 bg-red-500/5 border border-red-500/20 rounded-2xl p-10 mt-6 text-center backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-2 ring-4 ring-red-500/10">
                            <Database size={28} className="text-red-400" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">Connection Error</h3>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto">
                            {error}
                        </p>
                        <p className="text-muted-foreground/60 text-xs mt-1 max-w-md mx-auto">
                            The database might have been deleted from the server, or the connection string is invalid. You can try reconnecting or selecting another project from the sidebar.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                            <button onClick={() => router.push('/connect')} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)] flex items-center gap-2">
                                <Plus size={14} /> Connect New Database
                            </button>
                            <button onClick={() => { if (connectionString) fetchStats(connectionString); }} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-secondary hover:bg-secondary/80 border border-border text-foreground transition-all flex items-center gap-2">
                                <PlugZap size={14} /> Retry Connection
                            </button>
                        </div>
                    </div>
                ) : !stats ? (
                    /* ── Empty / Welcome State ── */
                    <div className="space-y-8 mt-6 flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Welcome banner */}
                        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-violet-500/5 via-background to-indigo-500/5 p-8">
                            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />
                            <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                                        <Database size={22} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground">Welcome to your AI Database Assistant.</h2>
                                        <p className="text-muted-foreground text-sm">Connect a database to unlock your company's potential.</p>
                                    </div>
                                </div>
                                <p className="text-muted-foreground text-sm mb-6 max-w-xl leading-relaxed">
                                    I am your personal AI database expert. By connecting your database, I can instantly find ways to make your app run faster, guard against breaking changes, and help you understand your data in plain English.
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => router.push('/connect')} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-[0_0_15px_rgba(124,58,237,0.25)] flex items-center gap-2">
                                        Connect a Database <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Feature cards preview */}
                        <div>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">What you'll unlock</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {QUICK_ACTIONS.map((action) => (
                                    <div key={action.label} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card/50 opacity-60">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${action.color}15` }}>
                                            <action.icon size={16} style={{ color: action.textColor }} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{action.label}</p>
                                            <p className="text-xs text-muted-foreground">{action.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col flex-1 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 h-full">

                        {/* ── Page Header ── */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-foreground mb-1">Overview</h2>
                                <p className="text-muted-foreground text-sm">High-level metrics for your selected database.</p>
                            </div>
                            <button
                                onClick={() => router.push('/connect')}
                                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 border border-border text-foreground transition-all"
                            >
                                <Plus size={13} /> Connect Another
                            </button>
                        </div>

                        {/* ── Overview Stats ── */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {/* Optimization Score */}
                            <Card className="glass relative overflow-hidden group border-0 shadow-lg" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}>
                                <div className="absolute -right-8 -top-8 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <OrbitRing size={200} iconCount={0} color="#ffffff" />
                                </div>
                                <CardHeader className="relative z-10 pb-0 pt-5 px-6">
                                    <CardTitle className="text-white/80 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                                        <Activity size={14} /> Overall Health Score
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="relative z-10 px-6 pb-6 pt-3">
                                    <div className="flex items-end gap-2 mb-2">
                                        <p className="text-5xl font-extrabold tracking-tight text-white mb-0 leading-none">
                                            {stats.optimization_score}
                                        </p>
                                        <span className="text-xl font-bold text-white/60 mb-1">/ 100</span>
                                    </div>
                                    <p className="text-sm text-white/90 font-medium">
                                        {stats.optimization_score === 100 ? 'Perfect health! Your DB is flying.' : stats.optimization_score > 80 ? 'Good health — minor speedups available.' : 'Attention needed — let AI fix this.'}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Storage */}
                            <Card className="glass glow-border card-hover relative overflow-hidden group border border-border/50 bg-white/50 backdrop-blur-xl">
                                <CardHeader className="relative z-10 pb-2">
                                    <CardTitle className="text-violet-600 font-bold text-xs uppercase tracking-wide flex items-center gap-1.5">
                                        <Database size={12} /> Storage Used
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="relative z-10">
                                    <p className="text-3xl font-bold tracking-tight text-slate-800 mb-1">{stats.total_size_mb} <span className="text-lg font-semibold text-slate-400">MB</span></p>
                                    <p className="text-xs text-slate-500 font-medium">Total disk space consumed</p>
                                </CardContent>
                            </Card>

                            {/* Tables */}
                            <Card className="glass glow-border card-hover relative overflow-hidden group border border-border/50 bg-white/50 backdrop-blur-xl">
                                <CardHeader className="relative z-10 pb-2">
                                    <CardTitle className="text-blue-600 font-bold text-xs uppercase tracking-wide flex items-center gap-1.5">
                                        <Folder size={12} /> Data Collections
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="relative z-10">
                                    <p className="text-3xl font-bold tracking-tight text-slate-800 mb-1">{stats.total_tables}</p>
                                    <p className="text-xs text-slate-500 font-medium">Active database tables</p>
                                </CardContent>
                            </Card>

                            {/* Connections */}
                            <Card className="glass glow-border card-hover relative overflow-hidden group border border-border/50 bg-white/50 backdrop-blur-xl">
                                <CardHeader className="relative z-10 pb-2">
                                    <CardTitle className="text-emerald-600 font-bold text-xs uppercase tracking-wide flex items-center gap-1.5">
                                        <GitMerge size={12} /> Safe Connections
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="relative z-10">
                                    <p className="text-3xl font-bold tracking-tight text-slate-800 mb-1">
                                        {stats.total_fk_count ?? stats.total_foreign_keys ?? '—'}
                                    </p>
                                    <p className="text-xs text-slate-500 font-medium">Data relationships verified</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* ── Optimization Report ── */}
                        {connectionString && <OptimizationReport connectionString={connectionString} onApplied={handleFixApplied} />}

                        {/* ── Schema Visualization ── */}
                        <Card className="glass glow-border border-0 bg-transparent flex flex-col flex-1 min-h-[400px]">
                            <CardHeader className="border-b border-border pb-4 mb-4">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <CardTitle className="text-violet-500 dark:text-violet-400 font-semibold flex items-center gap-2">
                                        <Database size={18} /> Schema Visualization
                                    </CardTitle>
                                    <div className="flex gap-4 text-xs text-muted-foreground font-medium pt-1">
                                        <div className="flex items-center gap-1.5"><Key size={12} className="text-amber-500" /> Primary Key</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-violet-500 rounded-full" /> Foreign Key</div>
                                        <div className="flex items-center gap-1.5 text-muted-foreground/60">Scroll to zoom · Drag to pan</div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 p-0 relative w-full h-full min-h-[400px] rounded-b-xl overflow-hidden -mt-4">
                                {connectionString && <SchemaGraph key={graphKey} connectionString={connectionString} />}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

        </DashboardShell>
    );
}
