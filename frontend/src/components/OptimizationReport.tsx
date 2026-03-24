'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle } from "lucide-react";

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
    onApplied?: () => void; // callback to refresh schema graph after applying a fix
}

const OptimizationReport: React.FC<OptimizationReportProps> = ({ connectionString, onApplied }) => {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(false);
    // Track by index (since backend has no id field)
    const [applying, setApplying] = useState<number | null>(null);
    const [applied, setApplied] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (!connectionString) return;
        const fetchRecommendations = async () => {
            setLoading(true);
            setApplied(new Set()); // reset applied state when connection changes
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/optimization/scan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ connection_string: connectionString }),
                });
                const data = await response.json();
                setRecommendations(data.recommendations || []);
            } catch (error) {
                console.error("Failed to fetch recommendations:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchRecommendations();
    }, [connectionString]);

    const handleApply = async (rec: Recommendation, idx: number) => {
        setApplying(idx);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/optimization/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connection_string: connectionString,
                    sql_command: rec.sql_command
                }),
            });

            if (res.ok) {
                setApplied(prev => new Set(prev).add(idx));
                // Notify dashboard to refresh the schema graph
                onApplied?.();
            } else {
                const err = await res.json();
                alert(`Failed to apply: ${err.detail}`);
            }
        } catch (error) {
            console.error("Failed to apply optimization:", error);
            alert("Failed to apply optimization due to network or server error.");
        } finally {
            setApplying(null);
        }
    };

    if (loading) {
        return (
            <Card style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                <CardContent className="pt-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: '#7c3aed' }} />
                    <p className="mt-2" style={{ color: '#6b7280' }}>Scanning schema for optimizations...</p>
                </CardContent>
            </Card>
        );
    }

    if (recommendations.length === 0) {
        return (
            <Card style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                <CardHeader><CardTitle style={{ color: '#4f46e5' }}>Optimization Report</CardTitle></CardHeader>
                <CardContent>
                    <Alert style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <CheckCircle className="h-4 w-4" style={{ color: '#16a34a' }} />
                        <AlertTitle style={{ color: '#166534', fontWeight: 'bold' }}>All Good!</AlertTitle>
                        <AlertDescription style={{ color: '#15803d' }}>
                            No obvious optimizations found. Your schema looks healthy.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <CardHeader>
                <CardTitle style={{ color: '#4f46e5' }}>
                    Optimization Recommendations ({recommendations.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {recommendations.map((rec, idx) => (
                    <div
                        key={`${rec.table}-${rec.type}-${idx}`}
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            padding: '14px 16px',
                            border: `1px solid ${applied.has(idx) ? '#86efac' : '#e5e7eb'}`,
                            borderRadius: 12,
                            background: applied.has(idx) ? '#f0fdf4' : '#f8fafc',
                            gap: 12,
                            boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
                            transition: 'border 0.2s, background 0.2s',
                        }}
                    >
                        <div style={{ flex: 1 }}>
                            {/* Impact badge + table */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span style={{
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: (rec.impact ?? 'Low') === 'High' ? '#fee2e2' : (rec.impact ?? 'Low') === 'Medium' ? '#ffedd5' : '#e0e7ff',
                                    color: (rec.impact ?? 'Low') === 'High' ? '#dc2626' : (rec.impact ?? 'Low') === 'Medium' ? '#ea580c' : '#4f46e5',
                                }}>
                                    {(rec.impact ?? 'Low').toUpperCase()}
                                </span>
                                <span style={{ color: '#4f46e5', fontSize: 13, fontWeight: 700 }}>
                                    {rec.table}{rec.column ? `.${rec.column}` : ''}
                                </span>
                            </div>
                            {/* Description */}
                            <p style={{ color: '#4b5563', fontSize: 13, margin: '0 0 8px 0', fontWeight: 500 }}>{rec.description}</p>
                            {/* SQL */}
                            <code style={{
                                display: 'block',
                                fontSize: 12,
                                color: '#059669',
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                padding: '8px 12px',
                                borderRadius: 8,
                                wordBreak: 'break-all',
                                fontFamily: 'monospace',
                            }}>
                                {rec.sql_command}
                            </code>
                        </div>

                        {/* Action button */}
                        <div style={{ flexShrink: 0 }}>
                            {applied.has(idx) ? (
                                <Button variant="outline" size="sm" disabled style={{ color: '#15803d', borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                                    <CheckCircle className="mr-1 h-4 w-4" /> Applied
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={() => handleApply(rec, idx)}
                                    disabled={applying === idx}
                                    style={{ background: '#7c3aed', color: 'white', minWidth: 90, borderRadius: 8 }}
                                    className="hover:bg-violet-500 shadow-md shadow-violet-500/20"
                                >
                                    {applying === idx
                                        ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Applying...</>
                                        : 'Apply Fix'
                                    }
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};

export default OptimizationReport;
