'use client';

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    Database, Table, Zap, Network, ChevronRight, TerminalSquare,
    Box, ServerCrash, Loader2, GaugeCircle, Target, DatabaseZap,
    Search, Filter, ArrowDownToLine, Eye, X, Cpu, Globe, Layers, Activity,
    RefreshCw
} from "lucide-react";
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

    // Search States
    const [rowSearch, setRowSearch] = useState("");
    const [tableSearch, setTableSearch] = useState("");

    // Row Inspector State
    const [inspectedRow, setInspectedRow] = useState<any | null>(null);
    const [inspectorSearch, setInspectorSearch] = useState("");

    // ... inside the return, the Inspector block ...

    // Insert Row State
    const [showInsertModal, setShowInsertModal] = useState(false);
    const [insertFormData, setInsertFormData] = useState<Record<string, any>>({});
    const [isInserting, setIsInserting] = useState(false);
    const [insertError, setInsertError] = useState<string | null>(null);

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
        setRowSearch("");
        setInspectedRow(null);
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

        // Session Persistence: Restore previous state for this DB
        const savedTable = localStorage.getItem(`last_table_${connStr}`);
        const savedSearch = localStorage.getItem(`last_search_${connStr}`);

        if (savedTable) {
            setSelectedTable(savedTable);
            fetchTableData(connStr, savedTable);
        }
        if (savedSearch) {
            setRowSearch(savedSearch);
        }
    }, []);

    // Also listen for event-based project changes (from sidebar)
    useEffect(() => {
        const handleProjectChanged = (e: any) => {
            const newConn = e.detail.connStr;
            const newName = e.detail.name || "Dashboard";

            setConnectionString(newConn);
            setProjectName(newName);
            fetchTablesList(newConn);

            // Restore state for the new DB
            const savedTable = localStorage.getItem(`last_table_${newConn}`);
            const savedSearch = localStorage.getItem(`last_search_${newConn}`);

            if (savedTable) {
                setSelectedTable(savedTable);
                fetchTableData(newConn, savedTable);
            } else {
                setSelectedTable(null);
                setTableData(null);
            }
            setRowSearch(savedSearch || "");
        };

        window.addEventListener("project-changed", handleProjectChanged);
        return () => window.removeEventListener("project-changed", handleProjectChanged);
    }, []);

    const handleTableClick = (tableName: string) => {
        if (!connectionString) return;
        setSelectedTable(tableName);
        fetchTableData(connectionString, tableName);
        // Persist selection
        localStorage.setItem(`last_table_${connectionString}`, tableName);
    };

    // Auto-persist row search
    useEffect(() => {
        if (connectionString && rowSearch !== undefined) {
            localStorage.setItem(`last_search_${connectionString}`, rowSearch);
        }
    }, [rowSearch, connectionString]);

    // Filter Logic
    const filteredTables = useMemo(() => {
        return tables.filter(t => t.data.label.toLowerCase().includes(tableSearch.toLowerCase()));
    }, [tables, tableSearch]);

    const filteredRows = useMemo(() => {
        if (!tableData || !rowSearch) return tableData?.rows || [];
        const lowSearch = rowSearch.toLowerCase();
        return tableData.rows.filter(row =>
            Object.values(row).some(val => String(val).toLowerCase().includes(lowSearch))
        );
    }, [tableData, rowSearch]);

    const exportToCSV = () => {
        if (!tableData || !selectedTable) return;
        const headers = tableData.columns.join(",");
        const rows = tableData.rows.map(r =>
            tableData.columns.map(col => `"${String(r[col]).replace(/"/g, '""')}"`).join(",")
        ).join("\n");
        const csv = `${headers}\n${rows}`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `${selectedTable}_export.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleInsertSubmit = async () => {
        if (!selectedTable || !connectionString) return;
        setIsInserting(true);
        setInsertError(null);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/insert-row`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    connection_string: connectionString,
                    table_name: selectedTable,
                    row_data: insertFormData
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Failed to insert row");
            
            // Refresh table data
            await fetchTableData(connectionString, selectedTable);
            setShowInsertModal(false);
            setInsertFormData({});
        } catch (e: any) {
            setInsertError(e.message);
        } finally {
            setIsInserting(false);
        }
    };

    const renderDataBadge = (val: any) => {
        if (val === null || val === undefined) {
            return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/10">NULL</span>;
        }
        if (typeof val === 'number') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-black bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shadow-sm">{val}</span>;
        }
        if (typeof val === 'boolean') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20 shadow-sm">{val ? 'TRUE' : 'FALSE'}</span>;
        }
        const strVal = String(val);
        if (strVal.length > 10 && /^\d{4}-\d{2}-\d{2}T/.test(strVal)) {
            return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono tracking-widest bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm">{strVal.split('T')[0]}</span>;
        }
        return <span className="text-[13px] text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap overflow-hidden text-ellipsis">{strVal}</span>;
    };

    if (authLoading) return <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-[#0B0A0F]"><Loader2 className="animate-spin text-violet-500" size={32} /></div>;

    return (
        <DashboardShell>
            <div className="flex flex-col h-full w-full max-w-[1600px] mx-auto bg-slate-50/50 dark:bg-transparent">
                {/* ── Page Header ── */}
                <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3 border-b border-gray-100 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] shadow-sm z-10 relative backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center relative shadow-inner ring-1 ring-violet-200 dark:ring-violet-500/20">
                            <GaugeCircle size={22} className="text-violet-600" />
                            <div className="absolute top-0 right-0 -mr-1 -mt-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse border-2 border-white shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                Telemetry Data Matrix
                            </h1>
                            <p className="text-[13px] text-slate-500 dark:text-slate-400 font-bold mt-0.5 uppercase tracking-widest flex items-center gap-1.5">
                                <Network size={12} /> Live Event Stream & Node Registry
                            </p>
                        </div>
                    </div>

                    {selectedTable && (
                        <div className="flex items-center gap-3">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Search size={14} className="text-slate-400 dark:text-slate-500" />
                                </div>
                                <input
                                    value={rowSearch}
                                    onChange={e => setRowSearch(e.target.value)}
                                    placeholder={`Search in ${selectedTable}...`}
                                    className="bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 w-64 outline-none focus:border-violet-500 focus:bg-white transition-all placeholder:text-slate-400 shadow-sm"
                                />
                                {rowSearch && (
                                    <button onClick={() => setRowSearch("")} className="absolute inset-y-0 right-3 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    setInsertFormData({});
                                    setInsertError(null);
                                    setShowInsertModal(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 border border-violet-500 text-white text-xs font-black uppercase tracking-widest transition-all hover:bg-violet-700 shadow-sm active:scale-95"
                            >
                                <DatabaseZap size={13} /> Insert Row
                            </button>
                            <button
                                onClick={exportToCSV}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest transition-all hover:bg-slate-50 dark:hover:bg-white/[0.08] shadow-sm active:scale-95"
                            >
                                <ArrowDownToLine size={13} /> Export
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Main Layout Split ── */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full relative">

                    {/* Inner Sidebar: Entity Node Registry */}
                    <div className="w-full lg:w-[320px] shrink-0 border-r border-slate-200 dark:border-white/[0.05] bg-white dark:bg-[#0B0A0F]/40 flex flex-col z-10 relative shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/80 dark:bg-white/[0.02] backdrop-blur-md">
                            <h2 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                                <DatabaseZap size={15} className="text-violet-500" />
                                Node Registry
                            </h2>
                            <div className="mt-3 relative">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <Filter size={12} className="text-slate-400 dark:text-slate-500" />
                                </div>
                                <input
                                    value={tableSearch}
                                    onChange={e => setTableSearch(e.target.value)}
                                    placeholder="Filter nodes..."
                                    className="w-full bg-slate-100 dark:bg-white/[0.05] border-none rounded-lg pl-9 pr-3 py-2 text-[10px] font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/20 transition-all uppercase tracking-widest"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/50 dark:bg-transparent px-3 py-4 space-y-1.5">
                            {tablesLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-violet-500 opacity-60">
                                    <Loader2 className="animate-spin" size={24} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Parsing Architecture...</span>
                                </div>
                            ) : filteredTables.length === 0 ? (
                                <div className="p-6 text-center">
                                    <ServerCrash size={32} className="mx-auto text-slate-300 mb-2" />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Zero Nodes Detected</p>
                                </div>
                            ) : (
                                <motion.ul 
                                    className="flex flex-col gap-1.5"
                                    initial="hidden"
                                    animate="show"
                                    variants={{
                                        hidden: { opacity: 0 },
                                        show: { opacity: 1, transition: { staggerChildren: 0.05 } }
                                    }}
                                >
                                    {filteredTables.map(node => {
                                        const active = selectedTable === node.data.label;
                                        return (
                                            <motion.li 
                                                key={node.data.label} 
                                                className="relative group"
                                                variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                                            >
                                                <motion.button
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => handleTableClick(node.data.label)}
                                                    className={`w-full text-left px-4 py-3 rounded-xl transition-all border flex items-center justify-between overflow-hidden relative outline-none
                                                        ${active
                                                            ? 'bg-violet-50 border-violet-200 shadow-[0_2px_10px_rgba(139,92,246,0.1)]'
                                                            : 'bg-white dark:bg-white/[0.02] border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.05] shadow-sm'
                                                        }`}
                                                >
                                                    {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-r shadow-[0_0_8px_rgba(139,92,246,0.5)]"></div>}

                                                    <div className="flex flex-col min-w-0 pr-3 z-10">
                                                        <div className="flex items-center gap-2">
                                                            <TerminalSquare size={13} className={active ? 'text-violet-600' : 'text-slate-400'} />
                                                            <span className={`font-black text-[13px] truncate tracking-tight ${active ? 'text-violet-900 dark:text-violet-200' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                {node.data.label}
                                                            </span>
                                                        </div>
                                                        <span className="flex items-center gap-1 mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 pl-5">
                                                            <Box size={10} /> {node.data.rows} blocks
                                                        </span>
                                                    </div>

                                                    <ChevronRight size={14} className={`shrink-0 transition-transform ${active ? 'text-violet-500 translate-x-1' : 'text-slate-300 group-hover:text-slate-400 group-hover:translate-x-0.5'}`} />
                                                </motion.button>
                                            </motion.li>
                                        );
                                    })}
                                </motion.ul>
                            )}
                        </div>
                    </div>

                    {/* Main Area: Telemetry Matrix Grid */}
                    <div className="flex-1 flex flex-col min-w-0 relative bg-slate-50 dark:bg-transparent overflow-hidden">

                        {/* Header Output Log */}
                        <div className="h-14 shrink-0 border-b border-slate-200 dark:border-white/[0.05] bg-white dark:bg-[#0B0A0F]/60 flex items-center justify-between px-6 z-20 shadow-sm backdrop-blur-xl">
                            <div className="flex items-center gap-3">
                                {selectedTable ? (
                                    <>
                                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 border border-emerald-200">
                                            <Target size={12} />
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Stream:</span>
                                            <span className="text-sm font-black text-slate-800 dark:text-white">{selectedTable}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 bg-slate-300 rounded-full"></div> Awaiting Node Selection</div>
                                )}
                            </div>

                            {selectedTable && tableData?.rows && (
                                <div className="flex items-center gap-3">
                                    <div className="bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 shadow-sm rounded-lg flex items-center overflow-hidden">
                                        <div className="px-3 py-1 bg-slate-50 dark:bg-white/[0.05] border-r border-slate-200 dark:border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Payload</div>
                                        <div className="px-3 py-1 text-xs font-black font-mono text-violet-700">{filteredRows.length} Active</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Telemetry Grid Container */}
                        <div className="flex-1 overflow-auto custom-scrollbar relative p-4 md:p-6 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">

                            {!selectedTable ? (
                                <div className="h-full flex flex-col items-center justify-center pointer-events-none opacity-40">
                                    <div className="w-20 h-20 rounded-2xl bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-center text-slate-200 dark:text-slate-700 mb-6">
                                        <Database size={32} />
                                    </div>
                                    <p className="text-[13px] font-bold text-slate-600 dark:text-slate-400 tracking-tight text-center">Neural Substrate: Idle</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 text-center">Initiate node synchronization to bridge data streams.</p>
                                </div>
                            ) : dataLoading ? (
                                <div className="h-full flex flex-col items-center justify-center">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-violet-400 blur-xl opacity-20 rounded-full"></div>
                                        <Loader2 size={32} className="relative text-violet-600 animate-spin" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400 mt-4 animate-pulse">Decrypting Telemetry Vectors...</p>
                                </div>
                            ) : error ? (
                                <div className="p-6 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl max-w-xl mx-auto mt-10 shadow-sm flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/[0.05] flex items-center justify-center text-rose-500 shadow-sm shrink-0"><ServerCrash size={18} /></div>
                                    <div>
                                        <h3 className="text-sm font-black text-rose-800 dark:text-rose-400">Stream Connection Failed</h3>
                                        <p className="text-xs font-bold text-rose-600 mt-1 uppercase tracking-widest">{error}</p>
                                    </div>
                                </div>
                            ) : tableData && tableData.columns.length > 0 ? (
                                <div className="min-w-max pb-32">

                                    {/* Sub-header Vectors */}
                                    <div className="grid gap-4 mb-3 sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 py-3 px-6 rounded-xl shadow-sm border border-slate-200/50 dark:border-white/10"
                                        style={{ gridTemplateColumns: `repeat(${tableData.columns.length}, minmax(180px, 1fr))` }}>
                                        {tableData.columns.map(col => (
                                            <div key={col} className="flex items-center gap-2 group">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-violet-400 transition-colors"></div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 truncate" title={col}>{col}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Data Stream */}
                                    <div className="space-y-1 relative">
                                        <AnimatePresence mode="popLayout">
                                            {filteredRows.map((row, i) => (
                                                <motion.div
                                                    key={i}
                                                    layout
                                                    initial={{ opacity: 0, y: 15 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    whileHover={{ scale: 1.01, zIndex: 10 }}
                                                    whileTap={{ scale: 0.99 }}
                                                    transition={{ duration: 0.2, delay: i < 30 ? i * 0.02 : 0 }}
                                                    onClick={() => setInspectedRow(row)}
                                                    className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500/50 hover:shadow-lg rounded-xl p-3 px-6 transition-all cursor-pointer group flex flex-col relative"
                                                >
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
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>

                                        {filteredRows.length === 0 && (
                                            <div className="text-center py-24">
                                                <Search size={32} className="mx-auto text-slate-300 mb-4" />
                                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Zero object vectors matched.</p>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* ── Deep Row Inspector (Slide-over) ── */}
                <AnimatePresence>
                    {inspectedRow && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setInspectedRow(null)}
                                className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm z-40 cursor-pointer"
                            />
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="absolute top-0 right-0 w-[600px] h-full bg-white dark:bg-[#0B0A0F] border-l border-slate-200 dark:border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.08)] z-50 flex flex-col overflow-hidden"
                            >
                                <div className="p-6 border-b border-slate-100 dark:border-white/10 bg-white dark:bg-transparent sticky top-0 z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center border border-violet-200 dark:border-violet-500/20 text-violet-600 shadow-inner">
                                                <Eye size={18} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight uppercase">Tuple Inspector</h3>
                                                <p className="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase mt-0.5">{selectedTable} Node</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setInspectedRow(null); setInspectorSearch(""); }}
                                            className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-all"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                            <Search size={14} className="text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <input
                                            value={inspectorSearch}
                                            onChange={e => setInspectorSearch(e.target.value)}
                                            placeholder="Find field in tuple..."
                                            className="w-full bg-slate-50 dark:bg-white/[0.05] border border-slate-100 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500/20 transition-all uppercase tracking-widest placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        {tableData?.columns
                                            .filter(col => col.toLowerCase().includes(inspectorSearch.toLowerCase()))
                                            .map(col => (
                                                <motion.div
                                                    key={col}
                                                    layout
                                                    className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-4 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col gap-2 hover:border-violet-300 dark:hover:border-violet-500/50 transition-colors"
                                                >
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                        <TerminalSquare size={10} className="text-violet-500" /> {col}
                                                    </span>
                                                    <div className="text-[12px] font-medium text-slate-700 dark:text-slate-300 break-words line-clamp-3">
                                                        {renderDataBadge(inspectedRow[col])}
                                                    </div>
                                                </motion.div>
                                            ))}
                                    </div>

                                    {tableData?.columns.filter(col => col.toLowerCase().includes(inspectorSearch.toLowerCase())).length === 0 && (
                                        <div className="py-20 text-center">
                                            <Search size={32} className="mx-auto text-slate-200 mb-4" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">No matching metadata vectors<br />found in current tuple.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
                                    <button
                                        onClick={() => { setInspectedRow(null); setInspectorSearch(""); }}
                                        className="w-full py-3.5 rounded-xl bg-slate-900 dark:bg-violet-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-violet-500 transition-all shadow-md active:scale-[0.98]"
                                    >
                                        Terminate Analysis
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* ── Insert Row Modal ── */}
                <AnimatePresence>
                    {showInsertModal && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowInsertModal(false)}
                                className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[60] cursor-pointer"
                            />
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed bottom-0 left-0 right-0 h-[60vh] max-h-[600px] bg-white rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.15)] z-[70] flex flex-col overflow-hidden"
                            >
                                <div className="p-6 border-b border-slate-100 bg-white sticky top-0 z-10 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center border border-violet-200 text-violet-600 shadow-inner">
                                            <DatabaseZap size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase">Insert New Tuple</h3>
                                            <p className="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase mt-0.5">{selectedTable} target</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowInsertModal(false)}
                                        className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 transition-all font-bold"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                                    {insertError && (
                                        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold leading-relaxed">
                                            {insertError}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        {tableData?.columns.map(col => (
                                            <div key={col} className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">{col}</label>
                                                <input
                                                    type="text"
                                                    disabled={isInserting}
                                                    placeholder="NULL (Default)"
                                                    value={insertFormData[col] || ''}
                                                    onChange={e => setInsertFormData({ ...insertFormData, [col]: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 focus:bg-white transition-all shadow-inner"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-6 border-t border-slate-100 bg-slate-50">
                                    <button
                                        onClick={handleInsertSubmit}
                                        disabled={isInserting}
                                        className="w-full py-4 rounded-xl bg-emerald-500 text-slate-900 text-[11px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isInserting ? <Loader2 size={16} className="animate-spin text-slate-900" /> : <DatabaseZap size={16} />} 
                                        {isInserting ? "Injecting Data..." : "Execute Tuple Injection"}
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </DashboardShell>
    );
}

// Simple Icon re-imports
// import { RefreshCw } from "lucide-react";
