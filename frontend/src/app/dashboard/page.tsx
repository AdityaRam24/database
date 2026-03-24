'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import SchemaGraph from "@/components/SchemaGraph";
import OptimizationReport from "@/components/OptimizationReport";
import AskAIPanel from "@/components/AskAIPanel";
import { useRouter } from "next/navigation";
import OrbitRing from "@/components/ui/OrbitRing";
import { Database, Folder, Key, Zap, GitMerge, Activity, ShieldAlert, Shield, BookOpen, ArrowRight, PlugZap, Plus } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";

const QUICK_ACTIONS = [
    { label: "Indexing", desc: "Fix slow queries", icon: Zap, color: "#f59e0b", textColor: "#fbbf24", path: "/dashboard/performance" },
    { label: "Governance", desc: "Query guardrails", icon: GitMerge, color: "#3b82f6", textColor: "#60a5fa", path: "/dashboard/governance" },
    { label: "Anomaly", desc: "Detect anomalies", icon: Activity, color: "#ef4444", textColor: "#f87171", path: "/dashboard/anomaly" },
    { label: "Incidents", desc: "View incidents", icon: ShieldAlert, color: "#f97316", textColor: "#fb923c", path: "/dashboard/incidents" },
    { label: "Security", desc: "Access control", icon: Shield, color: "#818cf8", textColor: "#818cf8", path: "/dashboard/security" },
    { label: "Semantic", desc: "Business rules", icon: BookOpen, color: "#a78bfa", textColor: "#c4b5fd", path: "/dashboard/semantic" },
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
            <div className="p-4 md:p-8 max-w-[1400px] mx-auto w-full">
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
                            <button onClick={() => { if(connectionString) fetchStats(connectionString); }} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-secondary hover:bg-secondary/80 border border-border text-foreground transition-all flex items-center gap-2">
                                <PlugZap size={14} /> Retry Connection
                            </button>
                        </div>
                    </div>
                ) : !stats ? (
                    /* ── Empty / Welcome State ── */
                    <div className="space-y-8 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
                                        <h2 className="text-xl font-bold text-foreground">Welcome to DB-Lighthouse AI</h2>
                                        <p className="text-muted-foreground text-sm">Connect a database to get started</p>
                                    </div>
                                </div>
                                <p className="text-muted-foreground text-sm mb-6 max-w-xl leading-relaxed">
                                    Your AI-powered PostgreSQL intelligence platform. Connect a database using the sidebar to unlock schema visualization, performance indexing, anomaly detection, and AI-powered insights.
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
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

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

                        {/* ── Stats cards ── */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {/* Storage */}
                            <Card className="glass glow-border card-hover relative overflow-hidden group border-0 bg-transparent">
                                <div className="absolute -right-12 -top-12 opacity-[0.07] group-hover:opacity-[0.14] transition-opacity">
                                    <OrbitRing size={200} iconCount={0} color="#8b5cf6" />
                                </div>
                                <CardHeader className="relative z-10 pb-2">
                                    <CardTitle className="text-violet-500 dark:text-violet-400 font-semibold text-xs uppercase tracking-wide flex items-center gap-1.5">
                                        <Database size={12} /> Total Storage
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="relative z-10">
                                    <p className="text-4xl font-bold tracking-tight text-foreground mb-1">{stats.total_size_mb} <span className="text-2xl font-semibold text-muted-foreground">MB</span></p>
                                    <p className="text-xs text-muted-foreground">PostgreSQL disk usage</p>
                                </CardContent>
                            </Card>

                            {/* Tables */}
                            <Card className="glass glow-border card-hover relative overflow-hidden group border-0 bg-transparent">
                                <div className="absolute -right-12 -top-12 opacity-[0.07] group-hover:opacity-[0.14] transition-opacity">
                                    <OrbitRing size={200} iconCount={0} color="#3b82f6" />
                                </div>
                                <CardHeader className="relative z-10 pb-2">
                                    <CardTitle className="text-blue-500 dark:text-blue-400 font-semibold text-xs uppercase tracking-wide flex items-center gap-1.5">
                                        <Folder size={12} /> Total Tables
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="relative z-10">
                                    <p className="text-4xl font-bold tracking-tight text-foreground mb-1">{stats.total_tables}</p>
                                    <p className="text-xs text-muted-foreground">Active in public schema</p>
                                </CardContent>
                            </Card>

                            {/* Optimization Score */}
                            <Card className="glass glow-border card-hover relative overflow-hidden group border-0 bg-transparent">
                                <div className="absolute -right-12 -top-12 opacity-[0.07] group-hover:opacity-[0.14] transition-opacity">
                                    <OrbitRing size={200} iconCount={0} color={stats.optimization_score > 80 ? '#10b981' : stats.optimization_score > 50 ? '#f59e0b' : '#ef4444'} />
                                </div>
                                <CardHeader className="relative z-10 pb-2">
                                    <CardTitle className="text-muted-foreground font-semibold text-xs uppercase tracking-wide flex items-center gap-1.5">
                                        <Key size={12} /> Health Score
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="relative z-10">
                                    <p className="text-4xl font-bold tracking-tight mb-2" style={{
                                        color: stats.optimization_score > 80 ? '#10b981' : stats.optimization_score > 50 ? '#f59e0b' : '#ef4444'
                                    }}>
                                        {stats.optimization_score}<span className="text-2xl font-semibold text-muted-foreground"> / 100</span>
                                    </p>
                                    {/* Progress bar */}
                                    <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-2">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{
                                                width: `${stats.optimization_score}%`,
                                                background: stats.optimization_score > 80 ? '#10b981' : stats.optimization_score > 50 ? '#f59e0b' : '#ef4444'
                                            }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {stats.optimization_score === 100 ? '✓ Perfect health' : stats.optimization_score > 80 ? 'Good — minor fixes available' : 'Review recommendations'}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Foreign Keys */}
                            <Card className="glass glow-border card-hover relative overflow-hidden group border-0 bg-transparent">
                                <div className="absolute -right-12 -top-12 opacity-[0.07] group-hover:opacity-[0.14] transition-opacity">
                                    <OrbitRing size={200} iconCount={0} color="#10b981" />
                                </div>
                                <CardHeader className="relative z-10 pb-2">
                                    <CardTitle className="text-emerald-500 dark:text-emerald-400 font-semibold text-xs uppercase tracking-wide flex items-center gap-1.5">
                                        <GitMerge size={12} /> Relationships
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="relative z-10">
                                    <p className="text-4xl font-bold tracking-tight text-foreground mb-1">
                                        {stats.total_fk_count ?? stats.total_foreign_keys ?? '—'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Foreign key constraints</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* ── Quick Actions ── */}
                        <div>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Quick Actions</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                {QUICK_ACTIONS.map((action) => (
                                    <button
                                        key={action.label}
                                        onClick={() => router.push(action.path)}
                                        className="quick-action text-left group"
                                    >
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300" style={{ background: `${action.color}15` }}>
                                            <action.icon size={18} style={{ color: action.textColor }} />
                                        </div>
                                        <div className="text-center w-full">
                                            <p className="text-xs font-semibold text-foreground">{action.label}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">{action.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Optimization Report ── */}
                        {connectionString && <OptimizationReport connectionString={connectionString} onApplied={handleFixApplied} />}

                        {/* ── Schema Visualization ── */}
                        <Card className="glass glow-border border-0 bg-transparent flex flex-col mt-4">
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
                            <CardContent className="flex-1 p-0 h-[700px] rounded-b-xl overflow-hidden -mt-4">
                                {connectionString && <SchemaGraph key={graphKey} connectionString={connectionString} />}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Floating Ask AI button */}
            {connectionString && <AskAIPanel connectionString={connectionString} businessRules={businessRules} />}
        </DashboardShell>
    );
}
