'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import ProjectsSidebar from "@/components/ProjectsSidebar";
import AskAIPanel from "@/components/AskAIPanel";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { LogOut, LogIn, Zap, GitMerge, Database } from "lucide-react";

export default function DataExplorerPage() {
    const { user, signOut, signInWithGoogle, loading: authLoading } = useAuth();
    const router = useRouter();

    const [connectionString, setConnectionString] = useState<string | null>(null);
    const [projectName, setProjectName] = useState<string>("");

    // State for schema structure (to list tables)
    const [tables, setTables] = useState<any[]>([]);
    const [tablesLoading, setTablesLoading] = useState(true);

    // State for active table data
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [tableData, setTableData] = useState<{ columns: string[], rows: any[] } | null>(null);
    const [dataLoading, setDataLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTablesList = async (connStr: string) => {
        setTablesLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/graph`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ connection_string: connStr })
            });
            if (!res.ok) throw new Error("Failed to load schema");
            const data = await res.json();
            // Graph data nodes represent tables
            setTables(data.nodes || []);
        } catch (e: any) {
            console.error(e);
            setError(e.message);
        } finally {
            setTablesLoading(false);
        }
    };

    const fetchTableData = async (connStr: string, tableName: string) => {
        setDataLoading(true);
        setError(null);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/table-data`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ connection_string: connStr, table_name: tableName })
            });
            if (!res.ok) throw new Error(`Failed to load data for ${tableName}`);
            const data = await res.json();
            setTableData(data);
        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setTableData(null);
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        const connStr = localStorage.getItem("db_connection_string");
        const name = localStorage.getItem("project_name") || "Dashboard";
        if (!connStr) { setTablesLoading(false); return; }
        setConnectionString(connStr);
        setProjectName(name);
        fetchTablesList(connStr);
    }, []);

    const handleProjectLoad = (connStr: string, name: string) => {
        setConnectionString(connStr);
        setProjectName(name);
        setTableData(null);
        setSelectedTable(null);
        fetchTablesList(connStr);
    };

    const handleTableClick = (tableName: string) => {
        if (!connectionString) return;
        setSelectedTable(tableName);
        fetchTableData(connectionString, tableName);
    };

    if (authLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#08080f' }}>
            {/* Main Sidebar (Projects) */}
            <ProjectsSidebar onProjectLoad={handleProjectLoad} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Top bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid #1e1e2e', background: '#0f0f1a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        <div>
                            <h1 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 20, margin: 0 }}>🔦 DB-Lighthouse</h1>
                            {projectName && <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>{projectName}</p>}
                        </div>
                        <nav style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => router.push('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'transparent', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', color: '#6b7280', fontSize: 12, fontWeight: 600 }}>
                                Overview
                            </button>
                            <button onClick={() => router.push('/dashboard/performance')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'transparent', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', color: '#6b7280', fontSize: 12, fontWeight: 600 }}>
                                <Zap size={12} /> Indexing
                            </button>
                            <button onClick={() => router.push('/dashboard/governance')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'transparent', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', color: '#6b7280', fontSize: 12, fontWeight: 600 }}>
                                <GitMerge size={12} /> Governance
                            </button>
                            {/* Active Tab */}
                            <button onClick={() => router.push('/dashboard/data')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, cursor: 'pointer', color: '#34d399', fontSize: 12, fontWeight: 600 }}>
                                <Database size={12} /> Data
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Body - Split layout for tables and data */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '32px', gap: '24px' }}>
                    {/* Inner Sidebar: Tables List */}
                    <Card style={{ width: '280px', background: '#0f0f1a', border: '1px solid #2e2e4e', display: 'flex', flexDirection: 'column' }}>
                        <CardHeader className="pb-4 border-b border-[#2e2e4e]">
                            <CardTitle style={{ color: '#e2e8f0', fontSize: '16px' }}>Tables</CardTitle>
                            <CardDescription>Select a table to view its content</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 overflow-y-auto w-full">
                            {tablesLoading ? (
                                <div className="p-4 text-[#6b7280] text-sm">Loading schemas...</div>
                            ) : tables.length === 0 ? (
                                <div className="p-4 text-[#6b7280] text-sm">No tables found.</div>
                            ) : (
                                <ul className="flex flex-col">
                                    {tables.map(node => (
                                        <li key={node.data.label}>
                                            <button
                                                onClick={() => handleTableClick(node.data.label)}
                                                className={`w-full text-left px-4 py-3 text-sm transition-colors border-l-2 ${selectedTable === node.data.label
                                                        ? 'bg-[#10b981]/10 border-[#10b981] text-[#34d399]'
                                                        : 'border-transparent text-[#94a3b8] hover:bg-[#2e2e4e] hover:text-[#e2e8f0]'
                                                    }`}
                                            >
                                                <div className="font-medium">{node.data.label}</div>
                                                <div className="text-xs opacity-60 mt-1">{node.data.rows} rows</div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    {/* Main Area: Data Grid */}
                    <Card style={{ flex: 1, background: '#0f0f1a', border: '1px solid #2e2e4e', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <CardHeader className="border-b border-[#2e2e4e] flex flex-row items-center justify-between pb-4">
                            <div>
                                <CardTitle style={{ color: '#34d399' }}>
                                    {selectedTable ? `Data: ${selectedTable}` : 'Data Explorer'}
                                </CardTitle>
                                {selectedTable && <CardDescription>Showing top 100 rows</CardDescription>}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-auto bg-[#08080f]">
                            {!selectedTable ? (
                                <div className="flex items-center justify-center h-full text-[#6b7280]">
                                    Select a table from the left to view data.
                                </div>
                            ) : dataLoading ? (
                                <div className="flex items-center justify-center h-full text-[#10b981] animate-pulse">
                                    Fetching records...
                                </div>
                            ) : error ? (
                                <div className="flex items-center justify-center h-full text-[#ef4444]">
                                    {error}
                                </div>
                            ) : tableData && tableData.columns.length > 0 ? (
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="text-xs text-[#94a3b8] uppercase sticky top-0 bg-[#0f0f1a] border-b border-[#2e2e4e] z-10">
                                        <tr>
                                            {tableData.columns.map(col => (
                                                <th key={col} className="px-6 py-3 font-semibold tracking-wider">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#1e1e2e]">
                                        {tableData.rows.map((row, i) => (
                                            <tr key={i} className="hover:bg-[#1e1e2e]/50 transition-colors text-[#e2e8f0]">
                                                {tableData.columns.map(col => (
                                                    <td key={col} className="px-6 py-3 max-w-xs truncate" title={String(row[col])}>
                                                        {row[col] !== null ? String(row[col]) : <span className="text-[#6b7280] italic">NULL</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                        {tableData.rows.length === 0 && (
                                            <tr>
                                                <td colSpan={tableData.columns.length} className="px-6 py-8 text-center text-[#6b7280]">
                                                    This table is empty.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex items-center justify-center h-full text-[#6b7280]">
                                    No data available.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Floating Ask AI button */}
            {connectionString && <AskAIPanel connectionString={connectionString} />}
        </div>
    );
}
