'use client';

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Database, Table, Zap, Network, ChevronRight, TerminalSquare, Box, ServerCrash, Loader2, GaugeCircle, Target, DatabaseZap } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { motion, AnimatePresence } from "framer-motion";

export default function DataExplorerPage() {
    const { user, loading: authLoading } = useAuth();
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
            if (!res.ok) throw new Error("Failed to load schema mapping.");
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
            if (!res.ok) throw new Error(`Failed to decode vector stream for ${tableName}`);
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

    const handleTableClick = (tableName: string) => {
        if (!connectionString) return;
        setSelectedTable(tableName);
        fetchTableData(connectionString, tableName);
    };

    const renderDataBadge = (val: any) => {
        if (val === null || val === undefined) {
             return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-400 border border-slate-200">NULL</span>;
        }
        if (typeof val === 'number') {
             return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">{val}</span>;
        }
        if (typeof val === 'boolean') {
             return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-violet-50 text-violet-700 border border-violet-200 shadow-sm">{val ? 'TRUE' : 'FALSE'}</span>;
        }
        // string
        const strVal = String(val);
        // Maybe it's a date string ISO?
        if (strVal.length > 10 && /^\d{4}-\d{2}-\d{2}T/.test(strVal)) {
            return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono tracking-widest bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm">{strVal}</span>;
        }
        return <span className="text-[13px] text-slate-700 font-medium whitespace-nowrap overflow-hidden text-ellipsis">{strVal}</span>;
    };

    if (authLoading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-violet-500" size={32} /></div>;

    return (
        <DashboardShell>
            <div className="flex flex-col h-full w-full max-w-[1500px] mx-auto bg-slate-50/50">
                {/* ── Page Header ── */}
                <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3 border-b border-gray-100 bg-white shadow-sm z-10 relative">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center relative shadow-inner ring-1 ring-violet-200">
                            <GaugeCircle size={22} className="text-violet-600" />
                            <div className="absolute top-0 right-0 -mr-1 -mt-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse border-2 border-white shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                Telemetry Data Matrix
                            </h1>
                            <p className="text-[13px] text-slate-500 font-bold mt-0.5 uppercase tracking-widest flex items-center gap-1.5">
                                <Network size={12}/> Live Event Stream & Node Registry
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Main Layout Split ── */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full relative">
                    
                    {/* Inner Sidebar: Entity Node Registry */}
                    <div className="w-full lg:w-[320px] shrink-0 border-r border-slate-200 bg-white flex flex-col z-10 relative shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 backdrop-blur-md">
                            <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <DatabaseZap size={15} className="text-violet-500" /> 
                                {dbType === 'mongodb' ? 'Mongo Clusters' : 'Entity Node Registry'}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">Intercepting Active Targets</p>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/50 px-3 py-4 space-y-1.5">
                            {tablesLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-violet-500 opacity-60">
                                    <Loader2 className="animate-spin" size={24} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Parsing Architecture...</span>
                                </div>
                            ) : tables.length === 0 ? (
                                <div className="p-6 text-center">
                                    <ServerCrash size={32} className="mx-auto text-slate-300 mb-2"/>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Zero Nodes Detected</p>
                                </div>
                            ) : (
                                <ul className="flex flex-col gap-1.5">
                                    {tables.map(node => {
                                        const active = selectedTable === node.data.label;
                                        return (
                                            <li key={node.data.label} className="relative group">
                                                <button
                                                    onClick={() => handleTableClick(node.data.label)}
                                                    className={`w-full text-left px-4 py-3 rounded-xl transition-all border flex items-center justify-between overflow-hidden relative outline-none
                                                        ${active 
                                                            ? 'bg-violet-50 border-violet-200 shadow-[0_2px_10px_rgba(139,92,246,0.1)]' 
                                                            : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50 shadow-sm'
                                                        }`}
                                                >
                                                    {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-r shadow-[0_0_8px_rgba(139,92,246,0.5)]"></div>}
                                                    
                                                    <div className="flex flex-col min-w-0 pr-3 z-10">
                                                        <div className="flex items-center gap-2">
                                                            <TerminalSquare size={13} className={active ? 'text-violet-600' : 'text-slate-400'} /> 
                                                            <span className={`font-black text-[13px] truncate tracking-tight ${active ? 'text-violet-900' : 'text-slate-700'}`}>
                                                                {node.data.label}
                                                            </span>
                                                        </div>
                                                        <span className="flex items-center gap-1 mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400 pl-5">
                                                            <Box size={10} /> {node.data.rows} blocks
                                                        </span>
                                                    </div>

                                                    <ChevronRight size={14} className={`shrink-0 transition-transform ${active ? 'text-violet-500 translate-x-1' : 'text-slate-300 group-hover:text-slate-400 group-hover:translate-x-0.5'}`} />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Main Area: Telemetry Matrix Grid */}
                    <div className="flex-1 flex flex-col min-w-0 relative bg-slate-50 overflow-hidden">
                        
                        {/* Header Output Log */}
                        <div className="h-16 shrink-0 border-b border-slate-200 bg-white flex items-center justify-between px-6 z-20 shadow-sm">
                            <div className="flex items-center gap-3">
                                {selectedTable ? (
                                    <>
                                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 border border-emerald-200">
                                            <Target size={12} />
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Stream:</span>
                                            <span className="text-sm font-black text-slate-800">{selectedTable}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 bg-slate-300 rounded-full"></div> Awaiting Node Selection</div>
                                )}
                            </div>

                            {selectedTable && tableData?.rows && (
                                <div className="flex items-center gap-3">
                                     <div className="bg-white border border-slate-200 shadow-sm rounded-lg flex items-center overflow-hidden">
                                        <div className="px-3 py-1.5 bg-slate-50 border-r border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-500">Volumetric Data</div>
                                        <div className="px-3 py-1.5 text-xs font-black font-mono text-violet-700">{tableData.rows.length} Packets</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Telemetry Grid Container */}
                        <div className="flex-1 overflow-auto custom-scrollbar relative p-4 md:p-6 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
                            
                            {!selectedTable ? (
                                <div className="h-full flex flex-col items-center justify-center pointer-events-none">
                                    <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-200 mb-6">
                                        <Database size={32} />
                                    </div>
                                    <p className="text-[13px] font-bold text-slate-600 tracking-tight">System standing by.</p>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Initiate connection via Node Registry to stream data vectors.</p>
                                </div>
                            ) : dataLoading ? (
                                <div className="h-full flex flex-col items-center justify-center">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-violet-400 blur-xl opacity-20 rounded-full"></div>
                                        <Loader2 size={32} className="relative text-violet-600 animate-spin" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 mt-4 animate-pulse">Decrypting Telemetry Vectors...</p>
                                </div>
                            ) : error ? (
                                <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl max-w-xl mx-auto mt-10 shadow-sm flex items-start gap-4">
                                     <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-rose-500 shadow-sm shrink-0"><ServerCrash size={18}/></div>
                                     <div>
                                        <h3 className="text-sm font-black text-rose-800">Stream Connection Failed</h3>
                                        <p className="text-xs font-bold text-rose-600 mt-1 uppercase tracking-widest">{error}</p>
                                     </div>
                                </div>
                            ) : tableData && tableData.columns.length > 0 ? (
                                <div className="min-w-max pb-10">
                                    
                                    {/* Sub-header Vectors */}
                                    <div className="grid gap-4 mb-3 sticky top-0 z-20 backdrop-blur-xl bg-white/80 py-3 px-4 rounded-xl shadow-sm border border-slate-200/50"
                                         style={{ gridTemplateColumns: `repeat(${tableData.columns.length}, minmax(180px, 1fr))` }}>
                                        {tableData.columns.map(col => (
                                            <div key={col} className="flex items-center gap-2 group">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-violet-400 transition-colors"></div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate" title={col}>Vector: {col}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Data Stream */}
                                    <div className="space-y-2 relative">
                                        {/* Left connection line tracker decoration */}
                                        <div className="absolute left-[7px] top-4 bottom-4 w-px bg-slate-200/50 z-0"></div>

                                        <AnimatePresence>
                                            {tableData.rows.map((row, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.2, delay: i < 20 ? i * 0.03 : 0 }}
                                                    className="relative z-10 pl-5 pr-1"
                                                >
                                                    {/* Node dot decoration */}
                                                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-[3px] border-slate-200 shadow-sm z-20"></div>

                                                    <div className="bg-white border border-slate-200/60 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-violet-300 transition-all group flex flex-col">
                                                        <div 
                                                            className="grid gap-4 items-center"
                                                            style={{ gridTemplateColumns: `repeat(${tableData.columns.length}, minmax(180px, 1fr))` }}
                                                        >
                                                            {tableData.columns.map((col, idx) => (
                                                                <div key={col} className="flex items-center overflow-hidden">
                                                                    {renderDataBadge(row[col])}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>

                                        {tableData.rows.length === 0 && (
                                            <div className="text-center py-20 relative z-10">
                                                 <div className="w-16 h-16 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-300 mx-auto mb-4">
                                                    <Box size={24} />
                                                 </div>
                                                 <p className="text-xs font-black uppercase tracking-widest text-slate-500">Zero object vectors mapped.</p>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Unreadable node payload.</p>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
