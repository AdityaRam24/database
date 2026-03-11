'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import SchemaGraph from "@/components/SchemaGraph";
import OptimizationReport from "@/components/OptimizationReport";
import AskAIPanel from "@/components/AskAIPanel";
import ProjectsSidebar from "@/components/ProjectsSidebar";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { LogOut, LogIn, Zap, GitMerge, Database } from "lucide-react";

export default function DashboardPage() {
    const { user, signOut, signInWithGoogle, loading: authLoading } = useAuth();
    const router = useRouter();

    const [stats, setStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [connectionString, setConnectionString] = useState<string | null>(null);
    const [projectName, setProjectName] = useState<string>("");
    const [graphKey, setGraphKey] = useState(0); // bump to force SchemaGraph refresh

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
        const connStr = localStorage.getItem("db_connection_string");
        const name = localStorage.getItem("project_name") || "Dashboard";
        if (!connStr) { setStatsLoading(false); return; }
        setConnectionString(connStr);
        setProjectName(name);
        fetchStats(connStr);
    }, []);

    // Called when user selects a project from the sidebar
    const handleProjectLoad = (connStr: string, name: string) => {
        setConnectionString(connStr);
        setProjectName(name);
        fetchStats(connStr);
    };

    if (authLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#08080f' }}>
            {/* Sidebar */}
            <ProjectsSidebar onProjectLoad={handleProjectLoad} />

            {/* Main content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {/* Top bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid #1e1e2e', background: '#0f0f1a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        <div>
                            <h1 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 20, margin: 0 }}>🔦 DB-Lighthouse</h1>
                            {projectName && <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>{projectName}</p>}
                        </div>
                        {/* Module navigation */}
                        <nav style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => router.push('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 6, cursor: 'pointer', color: '#a78bfa', fontSize: 12, fontWeight: 600 }}>
                                Overview
                            </button>
                            <button onClick={() => router.push('/dashboard/performance')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, cursor: 'pointer', color: '#fbbf24', fontSize: 12, fontWeight: 600 }}>
                                <Zap size={12} /> Indexing
                            </button>
                            <button onClick={() => router.push('/dashboard/governance')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, cursor: 'pointer', color: '#60a5fa', fontSize: 12, fontWeight: 600 }}>
                                <GitMerge size={12} /> Governance
                            </button>
                            <button onClick={() => router.push('/dashboard/data')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, cursor: 'pointer', color: '#34d399', fontSize: 12, fontWeight: 600 }}>
                                <Database size={12} /> Data
                            </button>
                        </nav>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {user ? (
                            <>
                                {user.photoURL && <img src={user.photoURL} alt="avatar" width={32} height={32} style={{ borderRadius: '50%' }} referrerPolicy="no-referrer" />}
                                <span style={{ color: '#c4b5fd', fontSize: 13 }}>{user.displayName}</span>
                                <Button variant="ghost" size="sm" onClick={async () => { await signOut(); router.push('/'); }} style={{ color: '#6b7280' }}>
                                    <LogOut size={14} className="mr-1" /> Sign out
                                </Button>
                            </>
                        ) : (
                            <Button size="sm" onClick={signInWithGoogle} style={{ background: '#7c3aed', color: 'white' }}>
                                <LogIn size={14} className="mr-1" /> Sign in with Google
                            </Button>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="p-8">
                    {statsLoading ? (
                        <div style={{ color: '#6b7280' }}>Loading stats...</div>
                    ) : !stats ? (
                        <div style={{ color: '#ef4444' }}>
                            No database connected.{" "}
                            <button onClick={() => router.push('/connect')} style={{ color: '#7c3aed', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                                Connect one
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Stats cards */}
                            <div className="grid gap-4 md:grid-cols-3">
                                <Card style={{ background: '#0f0f1a', border: '1px solid #2e2e4e' }}>
                                    <CardHeader><CardTitle style={{ color: '#a78bfa' }}>Total Storage</CardTitle></CardHeader>
                                    <CardContent>
                                        <p className="text-4xl font-bold" style={{ color: '#e2e8f0' }}>{stats.total_size_mb} MB</p>
                                        <p className="text-sm" style={{ color: '#6b7280' }}>PostgreSQL Disk Usage</p>
                                    </CardContent>
                                </Card>
                                <Card style={{ background: '#0f0f1a', border: '1px solid #2e2e4e' }}>
                                    <CardHeader><CardTitle style={{ color: '#a78bfa' }}>Total Tables</CardTitle></CardHeader>
                                    <CardContent>
                                        <p className="text-4xl font-bold" style={{ color: '#e2e8f0' }}>{stats.total_tables}</p>
                                        <p className="text-sm" style={{ color: '#6b7280' }}>Active in 'public' schema</p>
                                    </CardContent>
                                </Card>
                                <Card style={{ background: '#0f0f1a', border: '1px solid #2e2e4e' }}>
                                    <CardHeader><CardTitle style={{ color: '#a78bfa' }}>Optimization Score</CardTitle></CardHeader>
                                    <CardContent>
                                        <p className="text-4xl font-bold" style={{
                                            color: stats.optimization_score > 80 ? '#22c55e' : stats.optimization_score > 50 ? '#fbbf24' : '#ef4444'
                                        }}>
                                            {stats.optimization_score} / 100
                                        </p>
                                        <p className="text-sm" style={{ color: '#6b7280' }}>
                                            {stats.optimization_score === 100 ? 'Perfect health' : 'Fix recommendations to improve'}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            {connectionString && <OptimizationReport connectionString={connectionString} onApplied={handleFixApplied} />}

                            <Card style={{ background: '#0f0f1a', border: '1px solid #2e2e4e' }}>
                                <CardHeader><CardTitle style={{ color: '#a78bfa' }}>Schema Visualization</CardTitle></CardHeader>
                                <CardContent>
                                    {connectionString && <SchemaGraph key={graphKey} connectionString={connectionString} />}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Ask AI button */}
            {connectionString && <AskAIPanel connectionString={connectionString} />}
        </div>
    );
}
