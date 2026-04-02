'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Database, Table } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { motion } from "framer-motion";

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
    const [dbType, setDbType] = useState<string>('sql');

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
        const savedType = localStorage.getItem("db_type") || "sql";
        if (!connStr) { setTablesLoading(false); return; }
        setConnectionString(connStr);
        setProjectName(name);
        setDbType(savedType);
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
        <DashboardShell>
            {/* Page header */}
            <div className="px-6 py-5 flex items-center border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <Database size={18} className="text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 leading-tight">Data Explorer</h1>
                        <p className="text-xs text-gray-500 font-medium">Browse your {dbType === 'mongodb' ? 'collections and documents' : 'database tables and records'} safely</p>
                    </div>
                </div>
            </div>

            {/* Body - Split layout for tables and data */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-4 md:p-6 gap-4 w-full max-w-[1400px] mx-auto">
                {/* Inner Sidebar: Collections List */}
                <Card className="w-full lg:w-[280px] shrink-0 border border-gray-200 bg-white flex flex-col shadow-sm rounded-xl">
                    <CardHeader className="pb-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                        <CardTitle className="text-gray-900 text-lg flex items-center gap-2"><Database size={18} className="text-violet-500" /> {dbType === 'mongodb' ? 'Data Collections' : 'Database Tables'}</CardTitle>
                        <CardDescription className="text-gray-500">Select a {dbType === 'mongodb' ? 'collection' : 'table'} to view {dbType === 'mongodb' ? 'documents' : 'records'}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 overflow-y-auto w-full custom-scrollbar bg-white">
                            {tablesLoading ? (
                                <div className="p-4 text-gray-500 text-sm">Loading collections...</div>
                            ) : tables.length === 0 ? (
                                <div className="p-4 text-gray-500 text-sm">No collections found.</div>
                            ) : (
                                <ul className="flex flex-col">
                                    {tables.map(node => (
                                        <li key={node.data.label}>
                                            <button
                                                onClick={() => handleTableClick(node.data.label)}
                                                className={`w-full text-left px-5 py-3.5 text-sm transition-all border-l-2 ${selectedTable === node.data.label
                                                        ? 'bg-violet-50 border-violet-500 text-violet-700'
                                                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                                    }`}
                                            >
                                                <div className="font-medium flex items-center gap-2">
                                                    <Table size={14} className="text-gray-400" /> {node.data.label}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1 pl-6">{node.data.rows} {dbType === 'mongodb' ? 'documents' : 'records'}</div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    {/* Main Area: Animated Data Grid */}
                    <Card className="flex-1 relative border border-gray-200 rounded-2xl p-6 bg-white shadow-sm flex flex-col overflow-hidden min-w-0">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6 shrink-0 z-10">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                    <h1 className="text-xl font-bold text-gray-900">
                                        {selectedTable ? `${dbType === 'mongodb' ? 'Collection' : 'Table'}: ${selectedTable}` : 'Data Explorer'}
                                    </h1>
                                </div>
                                {selectedTable && (
                                    <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                                        Showing {tableData?.rows?.length || 0} {dbType === 'mongodb' ? 'documents' : 'records'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto custom-scrollbar relative z-0">
                            {!selectedTable ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                                    <Database size={48} className="text-gray-200" />
                                    <p className="font-medium text-gray-500">Select a {dbType === 'mongodb' ? 'collection' : 'table'} from the left sidebar to view data safely.</p>
                                </div>
                            ) : dataLoading ? (
                                <div className="flex items-center justify-center h-full text-violet-500 animate-pulse">
                                    Fetching {dbType === 'mongodb' ? 'documents' : 'records'}...
                                </div>
                            ) : error ? (
                                <div className="flex items-center justify-center h-full text-red-500">
                                    {error}
                                </div>
                            ) : tableData && tableData.columns.length > 0 ? (
                                <motion.div
                                    className="space-y-2 min-w-max pb-4"
                                    variants={{
                                        visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
                                    }}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    {/* Headers */}
                                    <div 
                                        className="grid gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sticky top-0 bg-gray-50/95 backdrop-blur-md z-10 border-b border-gray-200"
                                        style={{ gridTemplateColumns: `repeat(${tableData.columns.length}, minmax(150px, 1fr))` }}
                                    >
                                        {tableData.columns.map(col => (
                                            <div key={col} className="truncate">{col}</div>
                                        ))}
                                    </div>

                                    {/* Rows */}
                                    {tableData.rows.map((row, i) => (
                                        <motion.div
                                            key={i}
                                            variants={{
                                                hidden: { opacity: 0, x: -20, filter: "blur(4px)" },
                                                visible: { opacity: 1, x: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 400, damping: 28, mass: 0.6 } }
                                            }}
                                            className="relative cursor-pointer"
                                        >
                                            <motion.div
                                                className="relative bg-white hover:bg-gray-50 border border-gray-100 hover:border-violet-200 rounded-xl p-4 overflow-hidden transition-colors shadow-sm"
                                                whileHover={{ y: -1, transition: { type: "spring", stiffness: 400, damping: 25 } }}
                                            >
                                                <div 
                                                    className="relative grid gap-4 items-center"
                                                    style={{ gridTemplateColumns: `repeat(${tableData.columns.length}, minmax(150px, 1fr))` }}
                                                >
                                                    {tableData.columns.map((col, idx) => (
                                                        <div key={col} className={`truncate text-sm ${idx === 0 ? "font-medium text-gray-900" : "text-gray-600"}`} title={String(row[col])}>
                                                            {row[col] !== null ? String(row[col]) : <span className="text-gray-400 italic">NULL</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        </motion.div>
                                    ))}
                                    
                                    {tableData.rows.length === 0 && (
                                        <div className="px-6 py-10 text-center text-gray-500">
                                            This {dbType === 'mongodb' ? 'collection' : 'table'} is empty.
                                        </div>
                                    )}
                                </motion.div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    No data available.
                                </div>
                            )}
                        </div>
                    </Card>
            </div>
        </DashboardShell>
    );
}
