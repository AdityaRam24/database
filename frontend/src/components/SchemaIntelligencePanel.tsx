'use client';

import React, { useEffect, useState } from 'react';
import { X, Code, Key, Zap, Info, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface SchemaIntelligencePanelProps {
    tableName: string;
    connectionString: string;
    onClose: () => void;
}

interface TableIntelligence {
    table_name: string;
    rows: number;
    size_bytes: number;
    description: string;
    columns: any[];
    indexes: any[];
    ddl: string;
    msg?: string;
}

export default function SchemaIntelligencePanel({ tableName, connectionString, onClose }: SchemaIntelligencePanelProps) {
    const [data, setData] = useState<TableIntelligence | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'ddl' | 'indexes' | 'columns'>('ddl');

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        const fetchData = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/table-intelligence`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ connection_string: connectionString, table_name: tableName })
                });
                
                if (!res.ok) throw new Error('Failed to fetch intelligence');
                const json = await res.json();
                
                if (isMounted) {
                    setData(json);
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) setLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [tableName, connectionString]);

    const handleCopy = () => {
        if (!data?.ddl) return;
        navigator.clipboard.writeText(data.ddl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="absolute top-4 right-4 bottom-4 w-[400px] z-50 flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200 dark:border-white/[0.08] shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-8 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/[0.08] shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Info size={16} />
                    </div>
                    <div>
                        <h3 className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight">
                            {tableName}
                        </h3>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">
                            Table Intelligence
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                    <X size={16} />
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <Loader2 size={24} className="animate-spin text-indigo-500 mb-2" />
                    <span className="text-[12px] font-medium">Gathering intel...</span>
                </div>
            ) : data?.msg ? (
                <div className="flex-1 p-6 text-center text-[13px] text-gray-500 flex flex-col items-center justify-center">
                    <Info size={24} className="mb-2 opacity-50" />
                    {data.msg}
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                    
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-3 p-4 shrink-0">
                        <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05] p-3 rounded-xl flex items-center gap-3">
                            <div className="bg-indigo-100/50 dark:bg-indigo-500/10 p-1.5 rounded-md">
                                <Code size={14} className="text-indigo-600 dark:text-indigo-400"/>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Estimated Rows</div>
                                <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{(data?.rows ?? 0).toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05] p-3 rounded-xl flex items-center gap-3">
                            <div className="bg-emerald-100/50 dark:bg-emerald-500/10 p-1.5 rounded-md">
                                <Zap size={14} className="text-emerald-600 dark:text-emerald-400"/>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Disk Size</div>
                                <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{formatBytes(data?.size_bytes ?? 0)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex px-4 border-b border-gray-100 dark:border-white/[0.08] shrink-0 gap-4">
                        {(['ddl', 'indexes', 'columns'] as const).map(tab => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-2 text-[12px] font-bold uppercase tracking-wider border-b-2 transition-colors ${
                                    activeTab === tab 
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                                    : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 dark:bg-slate-900/50">
                        {activeTab === 'ddl' && (
                            <div className="relative group">
                                <button
                                    onClick={handleCopy}
                                    className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                                >
                                    {copied ? <CheckCircle2 size={14} className="text-emerald-400"/> : <Copy size={14} />}
                                </button>
                                <SyntaxHighlighter
                                    language="sql"
                                    style={vscDarkPlus}
                                    customStyle={{ margin: 0, borderRadius: '12px', fontSize: '11px', padding: '16px' }}
                                >
                                    {data?.ddl || '-- No DDL available'}
                                </SyntaxHighlighter>
                            </div>
                        )}

                        {activeTab === 'indexes' && (
                            <div className="flex flex-col gap-3">
                                {data?.indexes?.length === 0 ? (
                                    <div className="text-[12px] text-gray-500 text-center py-6">No indexes found.</div>
                                ) : (
                                    data?.indexes?.map((idx, i) => (
                                        <div key={i} className="bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.1] rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Key size={12} className={idx.is_unique ? "text-amber-500" : "text-gray-400"} />
                                                    <span className="text-[12px] font-bold text-gray-800 dark:text-slate-200 truncate">{idx.name}</span>
                                                </div>
                                                <span className="text-[9px] uppercase font-bold bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-slate-300 px-1.5 py-0.5 rounded">{idx.type}</span>
                                            </div>
                                            <div className="text-[10px] font-mono text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-black/20 p-2 rounded-lg mb-2 overflow-x-auto whitespace-nowrap">
                                                {idx.definition}
                                            </div>
                                            <div className="flex gap-4">
                                                <div>
                                                    <div className="text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">Scans</div>
                                                    <div className="text-[11px] font-medium text-gray-700 dark:text-slate-300">{idx.scans ?? 0}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">Hits</div>
                                                    <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{idx.tup_read ?? 0}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'columns' && (
                            <div className="flex flex-col gap-2">
                                {data?.columns?.map((c, i) => (
                                    <div key={i} className="flex flex-col bg-white dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.08] p-2.5 rounded-lg">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[12px] font-bold text-gray-800 dark:text-gray-200">{c.name}</span>
                                            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded">{c.type}{c.max_len ? `(${c.max_len})` : ''}</span>
                                        </div>
                                        <div className="flex gap-2 text-[10px] text-gray-500 dark:text-slate-400 font-medium">
                                            {c.nullable === 'NO' && <span className="text-rose-500">NOT NULL</span>}
                                            {c.default && <span className="truncate max-w-[200px]">DEFAULT {c.default}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
