'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, RefreshCcw, ShieldCheck, Database, GitMerge, Table } from "lucide-react";

interface Recommendation {
    type: string;
    table: string;
    column?: string;
    description: string;
    sql_command: string;
    impact: 'High' | 'Medium' | 'Low';
}

interface OptimizationReportProps {
    connectionString: string;
    onApplied?: () => void;
}

const OptimizationReport: React.FC<OptimizationReportProps> = ({ connectionString, onApplied }) => {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState<number | null>(null);
    const [applied, setApplied] = useState<Set<number>>(new Set());
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const [now, setNow] = useState<Date>(new Date());

    const getRelativeTime = (date: Date) => {
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (diffInSeconds < 60) return "just now";
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes === 1) return "1 minute ago";
        if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours === 1) return "1 hour ago";
        return `${diffInHours} hours ago`;
    };

    // Schema stats for empty state
    const [schemaStats, setSchemaStats] = useState<{ tables: number, rels: number, heaviest: { name: string, rows: number } | null } | null>(null);

    const fetchRecommendations = async () => {
        if (!connectionString) return;
        setLoading(true);
        setApplied(new Set());
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/optimization/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString }),
            });
            const data = await response.json();
            setRecommendations(data.recommendations || []);
            setLastChecked(new Date());

            // If zero recommendations, fetch schema graph to show stats
            if (!data.recommendations || data.recommendations.length === 0) {
                const graphRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/graph`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ connection_string: connectionString }),
                });
                const graphData = await graphRes.json();
                const nodes = graphData.nodes || [];
                const edges = graphData.edges || [];

                let heaviest = null;
                if (nodes.length > 0) {
                    const sorted = [...nodes].sort((a, b) => (b.data?.rows || 0) - (a.data?.rows || 0));
                    heaviest = { name: sorted[0].data.label, rows: sorted[0].data.rows };
                }
                setSchemaStats({ tables: nodes.length, rels: edges.length, heaviest });
            }

        } catch (error) {
            console.error("Failed to fetch recommendations:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecommendations();
    }, [connectionString]);

    // Force re-render of timestamp
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(interval);
    }, []);

    const handleApply = async (rec: Recommendation, idx: number) => {
        setApplying(idx);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/optimization/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_string: connectionString, sql_command: rec.sql_command }),
            });

            if (res.ok) {
                setApplied(prev => new Set(prev).add(idx));
                onApplied?.();
            } else {
                const err = await res.json();
                alert(`Failed to apply: ${err.detail}`);
            }
        } catch (error) {
            console.error("Failed to apply:", error);
            alert("Failed to apply optimization due to network or server error.");
        } finally {
            setApplying(null);
        }
    };

    const headerContent = (
        <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-violet-600 font-bold text-lg flex items-center gap-2">
                <ShieldCheck size={18} /> Optimization Report
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                {lastChecked ? `Last checked ${getRelativeTime(lastChecked)}` : 'Checking...'}
                <button onClick={fetchRecommendations} disabled={loading} className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50">
                    <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
                </button>
            </div>
        </CardHeader>
    );

    if (loading) {
        return (
            <Card className="bg-white border border-gray-200">
                {headerContent}
                <CardContent className="pt-2 pb-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-500" />
                    <p className="mt-2 text-gray-500 text-sm font-medium">Deep scanning schema for optimizations...</p>
                </CardContent>
            </Card>
        );
    }

    if (recommendations.length === 0) {
        return (
            <Card className="bg-white border border-green-200 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-green-500" />
                {headerContent}
                <CardContent className="pt-0">
                    <Alert className="bg-green-50/50 border-green-100 mb-4">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <AlertTitle className="text-green-800 font-bold ml-1 text-[15px]">All Good!</AlertTitle>
                        <AlertDescription className="text-green-700 ml-1 text-[13px] font-medium">
                            No obvious optimizations found. Your schema is fully optimized and healthy.
                        </AlertDescription>
                    </Alert>

                    {schemaStats && (
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <div className="flex gap-4 sm:gap-6 items-center flex-wrap justify-center">
                                <div className="text-center">
                                    <div className="text-[20px] font-bold text-gray-900 flex items-center justify-center gap-1.5">
                                        <Database size={14} className="text-blue-500" /> {schemaStats.tables}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Tables Analyzed</div>
                                </div>
                                <div className="w-px h-8 bg-gray-200" />
                                <div className="text-center">
                                    <div className="text-[20px] font-bold text-gray-900 flex items-center justify-center gap-1.5">
                                        <GitMerge size={14} className="text-teal-500" /> {schemaStats.rels}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Relationships</div>
                                </div>
                                <div className="w-px h-8 bg-gray-200 hidden sm:block" />
                                {schemaStats.heaviest && (
                                    <div className="text-center hidden sm:block">
                                        <div className="text-[14px] font-bold text-gray-900 truncate max-w-[120px] mx-auto flex items-center justify-center gap-1.5">
                                            <Table size={12} className="text-amber-500" /> {schemaStats.heaviest.name}
                                        </div>
                                        <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Heaviest Table ({schemaStats.heaviest.rows.toLocaleString()})</div>
                                    </div>
                                )}
                            </div>

                            <Button variant="outline" size="sm" className="bg-white hover:bg-gray-50 border-gray-200 text-gray-700 text-xs font-bold rounded-lg shadow-sm whitespace-nowrap">
                                <RefreshCcw size={12} className="mr-1.5" /> Run Deep Scan
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-white border border-gray-200 shadow-sm">
            {headerContent}
            <CardContent className="space-y-3 pt-0">
                {recommendations.map((rec, idx) => {
                    const isApplied = applied.has(idx);
                    return (
                        <div
                            key={`${rec.table}-${rec.type}-${idx}`}
                            className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-xl gap-4 transition-all duration-300 ${isApplied ? 'border-green-200 bg-green-50 shadow-none' : 'border-gray-200 bg-gray-50/50 hover:bg-white shadow-sm hover:shadow-md hover:border-violet-200'}`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider ${rec.impact === 'High' ? 'bg-red-100 text-red-600' : rec.impact === 'Medium' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                        {rec.impact || 'Low'}
                                    </span>
                                    <span className="text-indigo-600 text-[13px] font-bold truncate">
                                        {rec.table}{rec.column ? `.${rec.column}` : ''}
                                    </span>
                                </div>
                                <p className="text-gray-700 text-[13px] font-medium mb-2">{rec.description}</p>
                                <code className="block text-[11px] text-emerald-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg font-mono break-all font-semibold">
                                    {rec.sql_command}
                                </code>
                            </div>

                            <div className="shrink-0 w-full sm:w-auto flex justify-end">
                                {isApplied ? (
                                    <Button variant="outline" size="sm" disabled className="text-green-700 border-green-200 bg-green-50/50 font-bold opacity-100 min-w-[90px]">
                                        <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Applied
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        onClick={() => handleApply(rec, idx)}
                                        disabled={applying === idx}
                                        className="bg-violet-600 hover:bg-violet-500 text-white min-w-[100px] shadow-sm font-bold"
                                    >
                                        {applying === idx ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Applying</> : 'Apply Fix'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
};

export default OptimizationReport;
