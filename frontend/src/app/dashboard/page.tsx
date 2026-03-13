'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import SchemaGraph from "@/components/SchemaGraph";
import OptimizationReport from "@/components/OptimizationReport";
import AskAIPanel from "@/components/AskAIPanel";
import { useRouter } from "next/navigation";
import OrbitRing from "@/components/ui/OrbitRing";
import { Database, Folder, Key } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";

export default function DashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(true);
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
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/dashboard`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ connection_string: connStr })
            });
            const data = await res.json();
            setStats(data);
        } catch (e) {
            console.error(e);
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
                    <div style={{ color: '#6b7280', animation: 'pulse 2s infinite' }}>Loading stats...</div>
                ) : !stats ? (
                    <div className="flex items-center gap-4 px-5 py-4 bg-white/5 border border-white/10 rounded-2xl mt-6 backdrop-blur-sm">
                        <Database size={22} className="text-slate-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-slate-300 font-semibold text-sm">No database connected</p>
                            <p className="text-slate-500 text-xs">Use the sidebar to select a project or connect a new database.</p>
                        </div>
                        <button onClick={() => router.push('/connect')} className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)]">
                            Connect DB
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Summary Header */}
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-slate-100 mb-1">Overview</h2>
                            <p className="text-slate-400 text-sm">High-level metrics for your selected database.</p>
                        </div>

                        {/* Stats cards */}
                        <div className="grid gap-6 md:grid-cols-3">
                            <Card className="glass glow-border card-hover relative overflow-hidden group border-0 bg-transparent">
                                <div className="absolute -right-12 -top-12 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <OrbitRing size={200} iconCount={0} color="#8b5cf6" />
                                </div>
                                <CardHeader className="relative z-10 pb-2"><CardTitle className="text-violet-400 font-semibold text-sm">Total Storage</CardTitle></CardHeader>
                                <CardContent className="relative z-10">
                                    <p className="text-4xl font-bold tracking-tight text-white drop-shadow-md mb-1">{stats.total_size_mb} MB</p>
                                    <p className="text-xs text-slate-400">PostgreSQL Disk Usage</p>
                                </CardContent>
                            </Card>
                            <Card className="glass glow-border card-hover relative overflow-hidden group border-0 bg-transparent">
                                <div className="absolute -right-12 -top-12 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <OrbitRing size={200} iconCount={0} color="#3b82f6" />
                                </div>
                                <CardHeader className="relative z-10 pb-2"><CardTitle className="text-blue-400 font-semibold text-sm">Total Tables</CardTitle></CardHeader>
                                <CardContent className="relative z-10">
                                    <p className="text-4xl font-bold tracking-tight text-white drop-shadow-md mb-1">{stats.total_tables}</p>
                                    <p className="text-xs text-slate-400">Active in 'public' schema</p>
                                </CardContent>
                            </Card>
                            <Card className="glass glow-border card-hover relative overflow-hidden group border-0 bg-transparent">
                                <div className="absolute -right-12 -top-12 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <OrbitRing size={200} iconCount={0} color={stats.optimization_score > 80 ? '#10b981' : stats.optimization_score > 50 ? '#f59e0b' : '#ef4444'} />
                                </div>
                                <CardHeader className="relative z-10 pb-2"><CardTitle className="text-slate-300 font-semibold text-sm">Optimization Score</CardTitle></CardHeader>
                                <CardContent className="relative z-10">
                                    <p className="text-4xl font-bold tracking-tight drop-shadow-md mb-1" style={{
                                        color: stats.optimization_score > 80 ? '#34d399' : stats.optimization_score > 50 ? '#fbbf24' : '#f87171'
                                    }}>
                                        {stats.optimization_score} / 100
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {stats.optimization_score === 100 ? 'Perfect health' : 'Review recommendations'}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {connectionString && <OptimizationReport connectionString={connectionString} onApplied={handleFixApplied} />}

                        <Card className="glass glow-border border-0 bg-transparent flex flex-col mt-4">
                            <CardHeader className="border-b border-white/5 pb-4 mb-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-violet-400 font-semibold flex items-center gap-2">
                                        <Database size={18} /> Schema Visualization
                                    </CardTitle>
                                    <div className="flex gap-4 text-xs text-slate-400 font-medium pt-1">
                                        <div className="flex items-center gap-1.5"><Key size={12} className="text-amber-500" /> Primary Key</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-violet-500 rounded-full" /> Foreign Key</div>
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

