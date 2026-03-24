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
                    <div className="flex flex-col items-center justify-center h-64 gap-4 mt-6">
                        <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                        <div className="text-gray-500 font-medium text-sm animate-pulse">Connecting to database...</div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center gap-4 bg-red-50 border border-red-100 rounded-3xl p-8 mt-6 text-center shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-2">
                            <Database size={28} className="text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Connection Error</h3>
                        <p className="text-gray-500 text-sm max-w-md mx-auto">
                            {error}
                        </p>
                        <p className="text-gray-400 font-medium text-xs mt-2 max-w-md mx-auto">
                            The database might have been deleted from the server, or the connection string is invalid. You can try reconnecting or selecting another project from the sidebar.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
                            <button onClick={() => router.push('/connect')} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white transition-all shadow-md shadow-gray-900/10">
                                Connect New Database
                            </button>
                            <button onClick={() => { if(connectionString) fetchStats(connectionString); }} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 transition-all shadow-sm">
                                Retry Connection
                            </button>
                        </div>
                    </div>
                ) : !stats ? (
                    <div className="flex items-center gap-4 px-5 py-4 bg-white border border-gray-200 rounded-2xl mt-6 shadow-sm">
                        <Database size={22} className="text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-gray-900 font-bold text-sm">No database connected</p>
                            <p className="text-gray-500 font-medium text-xs mt-0.5">Use the sidebar to select a project or connect a new database.</p>
                        </div>
                        <button onClick={() => router.push('/connect')} className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold bg-gray-900 hover:bg-gray-800 text-white transition-all shadow-md shadow-gray-900/10">
                            Connect DB
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Summary Header */}
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">Overview</h2>
                            <p className="text-gray-500 font-medium text-sm">High-level metrics for your selected database.</p>
                        </div>

                        {/* Stats cards */}
                        <div className="grid gap-6 md:grid-cols-3">
                            <Card className="bg-white border border-gray-200 shadow-sm relative overflow-hidden group rounded-3xl">
                                <div className="absolute -right-12 -top-12 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <OrbitRing size={200} iconCount={0} color="#8b5cf6" />
                                </div>
                                <CardHeader className="relative z-10 pb-2"><CardTitle className="text-violet-600 font-bold text-sm">Total Storage</CardTitle></CardHeader>
                                <CardContent className="relative z-10">
                                    <p className="text-4xl font-bold tracking-tight text-gray-900 mb-1">{stats.total_size_mb} MB</p>
                                    <p className="text-xs text-gray-500 font-medium">PostgreSQL Disk Usage</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-white border border-gray-200 shadow-sm relative overflow-hidden group rounded-3xl">
                                <div className="absolute -right-12 -top-12 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <OrbitRing size={200} iconCount={0} color="#3b82f6" />
                                </div>
                                <CardHeader className="relative z-10 pb-2"><CardTitle className="text-blue-600 font-bold text-sm">Total Tables</CardTitle></CardHeader>
                                <CardContent className="relative z-10">
                                    <p className="text-4xl font-bold tracking-tight text-gray-900 mb-1">{stats.total_tables}</p>
                                    <p className="text-xs text-gray-500 font-medium">Active in 'public' schema</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-white border border-gray-200 shadow-sm relative overflow-hidden group rounded-3xl">
                                <div className="absolute -right-12 -top-12 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <OrbitRing size={200} iconCount={0} color={stats.optimization_score > 80 ? '#10b981' : stats.optimization_score > 50 ? '#f59e0b' : '#ef4444'} />
                                </div>
                                <CardHeader className="relative z-10 pb-2"><CardTitle className="text-gray-500 font-bold text-sm">Optimization Score</CardTitle></CardHeader>
                                <CardContent className="relative z-10">
                                    <p className="text-4xl font-bold tracking-tight mb-1" style={{
                                        color: stats.optimization_score > 80 ? '#059669' : stats.optimization_score > 50 ? '#d97706' : '#dc2626'
                                    }}>
                                        {stats.optimization_score} / 100
                                    </p>
                                    <p className="text-xs text-gray-400 font-medium">
                                        {stats.optimization_score === 100 ? 'Perfect health' : 'Review recommendations'}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {connectionString && <OptimizationReport connectionString={connectionString} onApplied={handleFixApplied} />}

                        <Card className="bg-white border border-gray-200 shadow-sm flex flex-col mt-4 rounded-3xl">
                            <CardHeader className="border-b border-gray-100 pb-4 mb-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-violet-700 font-bold flex items-center gap-2">
                                        <Database size={18} /> Schema Visualization
                                    </CardTitle>
                                    <div className="flex gap-4 text-xs text-gray-500 font-bold pt-1">
                                        <div className="flex items-center gap-1.5"><Key size={12} className="text-amber-500" /> Primary Key</div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-violet-400 rounded-full" /> Foreign Key</div>
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

