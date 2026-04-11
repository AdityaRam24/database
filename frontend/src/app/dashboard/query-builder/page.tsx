'use client';

import { useState, useEffect } from "react";
import DashboardShell from "@/components/DashboardShell";
import { motion } from "framer-motion";
import { Play, Zap, ShieldAlert, CheckCircle2, TrendingDown, Server, Database, Code2, Sparkles, Wand2, Bot, Info } from "lucide-react";

export default function QueryBuilderPage() {
  const [sql, setSql] = useState("SELECT * FROM users WHERE active = true;");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionString, setConnectionString] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("db_connection_string");
    if (saved) setConnectionString(saved);

    const handler = (e: any) => {
      setConnectionString(e.detail.connStr);
    };
    window.addEventListener("project-changed", handler);
    return () => window.removeEventListener("project-changed", handler);
  }, []);


  useEffect(() => {
    const s = sessionStorage.getItem("qb_sql"); if(s) setSql(s);
    const p = sessionStorage.getItem("qb_prompt"); if(p) setPrompt(p);
    const r = sessionStorage.getItem("qb_result"); if(r) try { setResult(JSON.parse(r)); } catch {}
  }, []);
  useEffect(() => { sessionStorage.setItem("qb_sql", sql); }, [sql]);
  useEffect(() => { sessionStorage.setItem("qb_prompt", prompt); }, [prompt]);
  useEffect(() => { if(result) sessionStorage.setItem("qb_result", JSON.stringify(result)); else sessionStorage.removeItem("qb_result"); }, [result]);

  const analyzeQuery = async () => {
    if (!sql.trim()) return;
    if (!connectionString) {
      setError("Please connect to a database first (Go to Dashboard).");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/query-cost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_string: connectionString, sql }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || "Failed to analyze query");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !connectionString) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/generate-sandbox-sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_string: connectionString, prompt }),
      });
      const data = await res.json();
      if (data.sql) {
        setSql(data.sql);
        // Delay slightly for visual effect before auto-analyzing
        setTimeout(() => {
           analyzeQuery();
        }, 300);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err: any) {
      setError("AI generation failed. Please check your connection.");
    } finally {
      setGenerating(false);
    }
  };

  const [isCheap, setIsCheap] = useState(false);
  const [guideMode, setGuideMode] = useState(false);

  useEffect(() => {
     if (result?.rating === "cheap") setIsCheap(true);
     else setIsCheap(false);
  }, [result]);

  const isExpensive = result?.rating === "expensive";

  return (
    <DashboardShell>
      <div className="flex flex-col h-full bg-slate-50 min-h-0">
        <div className="px-6 py-5 border-b border-slate-200 bg-white shadow-sm z-10 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Zap className="text-violet-500" /> Query Optimization Sandbox
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-1">
              Test queries and check their structural cost before pushing to production.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
                onClick={() => setGuideMode(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all shadow-sm ${guideMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
                <Info size={13} /> {guideMode ? 'Exit Guide' : 'Explain metrics'}
            </button>
            <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600 border border-violet-100 flex items-center gap-1.5">
                <Database size={14} /> {connectionString ? "Connected" : "No Database"}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
            {/* Left side: Editor */}
            <div className="flex flex-col gap-4">
              {/* Magic Prompt Field */}
              <div className="bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-violet-500/10 p-5 rounded-3xl border border-violet-100 shadow-sm">
                 <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-md">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-900 tracking-tight">Magic Prompt</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Natural Language to Query</p>
                    </div>
                 </div>
                 <div className="relative group">
                    <input 
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g. 'Show me the top 5 customers from last month'..."
                        className="w-full h-12 pl-4 pr-12 rounded-xl border border-violet-200 bg-white shadow-inner focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-sm font-medium transition-all group-hover:border-violet-300"
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    />
                    <button 
                        onClick={handleGenerate}
                        disabled={generating || !prompt.trim()}
                        className="absolute right-1.5 top-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer shadow-md group-active:scale-95"
                    >
                        {generating ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Wand2 size={14} className="text-violet-400" />}
                        <span className="text-[11px] font-black uppercase tracking-wider">Generate</span>
                    </button>
                 </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col h-[400px]">
                <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
                  <Code2 size={14} className="text-slate-500" />
                  <span className="text-xs font-black text-slate-600 uppercase tracking-wider">SQL Editor</span>
                </div>
                <textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  className="flex-1 p-4 bg-slate-900 text-slate-100 font-mono text-sm resize-none focus:outline-none focus:ring-0 leading-relaxed"
                  placeholder="Enter your SQL query here..."
                  spellCheck={false}
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={analyzeQuery}
                disabled={loading || !sql.trim()}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white font-black shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Play size={18} fill="currentColor" /> Analyze Query Cost
                  </>
                )}
              </motion.button>

              {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-bold flex items-start gap-2">
                  <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>

            {/* Right Side: Results */}
            <div className="flex flex-col gap-4">
              {!result && !loading && !error && (
                <div className="h-[400px] border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-white/50">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
                    <TrendingDown size={32} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">Ready to Benchmark</h3>
                  <p className="text-sm font-medium text-slate-400 mt-2 max-w-sm">
                    Enter a query and hit Analyze. We'll simulate its execution plan and tell you how much it costs in computation and real dollars.
                  </p>
                </div>
              )}

              {loading && (
                <div className="h-[400px] border border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center bg-white shadow-sm animate-pulse">
                  <div className="w-12 h-12 border-4 border-violet-100 border-t-violet-500 rounded-full animate-spin mb-4" />
                  <p className="text-sm font-bold text-slate-500">Simulating execution plan...</p>
                </div>
              )}

              {result && !result.supported && (
                 <div className="h-[400px] border border-amber-200 rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-amber-50">
                    <ShieldAlert size={48} className="text-amber-400 mb-4" />
                    <h3 className="text-lg font-black text-amber-800 mb-2">Not Supported by Current DB</h3>
                    <p className="text-sm font-bold text-amber-600 max-w-sm">{result.message}</p>
                 </div>
              )}

              {result && result.supported !== false && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-4"
                >
                  <div className={`p-6 rounded-3xl border ${isExpensive ? 'bg-rose-50 border-rose-200' : isCheap ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'} shadow-sm relative overflow-hidden`}>
                    <div className="absolute -right-4 -top-4 opacity-10">
                      {isExpensive ? <ShieldAlert size={120} /> : <CheckCircle2 size={120} />}
                    </div>
                    
                    <div className="relative z-10 flex items-center justify-between mb-6">
                      <h3 className="font-black text-lg" style={{ color: isExpensive ? '#be123c' : isCheap ? '#047857' : '#b45309' }}>
                         Optimization Score
                      </h3>
                      <div className={`px-4 py-1.5 rounded-full text-sm font-black text-white uppercase tracking-wider ${isExpensive ? 'bg-rose-500' : isCheap ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                        {result.rating}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 relative z-10">
                      <div className="bg-white/60 p-4 rounded-2xl group/tip relative">
                        <p className="text-xs font-bold mb-1 opacity-70 flex items-center gap-1">
                          Estimated Cost ($)
                          <Info size={10} className="text-slate-400" />
                        </p>
                        <p className="text-2xl font-black">{result.cost_estimate?.dollar_cost_display || "$0.00"}</p>
                        <div className="absolute top-full left-0 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 pointer-events-none mt-1 shadow-xl">
                          Calculated as scanned data size × cloud price ($0.10/GB).
                        </div>
                      </div>
                      <div className="bg-white/60 p-4 rounded-2xl group/tip relative">
                        <p className="text-xs font-bold mb-1 opacity-70 flex items-center gap-1">
                          Relative DB Cost
                          <Info size={10} className="text-slate-400" />
                        </p>
                        <p className="text-2xl font-black">{result.plan_summary?.total_cost || "N/A"}</p>
                        <div className="absolute top-full left-0 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 pointer-events-none mt-1 shadow-xl">
                          Internal units the database uses to weigh work (CPU/Disk).
                        </div>
                      </div>
                    </div>
                  </div>

                  {guideMode && (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl animate-in slide-in-from-top-2">
                        <p className="text-[10px] font-black text-amber-700 uppercase mb-1">How we calculate this</p>
                        <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                          We use the database's <strong>EXPLAIN</strong> engine to predict the future. We look at how many "pages" of data need to be read, map that to server energy usage (Environmental Impact), and then apply standard cloud pricing to guess your bill.
                        </p>
                      </div>
                  )}

                  <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="font-black text-slate-800 flex items-center gap-2 mb-4">
                      <Server size={18} className="text-slate-400" /> Deep Analytics
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold text-slate-500">Execution Plan Type</span>
                          <span className="font-black text-slate-800">{result.plan_summary?.node_type || "Unknown"}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className={`h-2 rounded-full ${result.plan_summary?.node_type?.includes('Seq Scan') ? 'bg-rose-400 w-full' : 'bg-emerald-400 w-1/3'}`}></div>
                        </div>
                        {result.plan_summary?.node_type?.includes('Seq Scan') && (
                          <p className="text-[10px] font-bold text-rose-500 mt-1">Sequential Scans slow down drastically as data grows. Consider adding an index.</p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold text-slate-500">Estimated Rows Scanned</span>
                          <span className="font-black text-slate-800">{result.plan_summary?.estimated_rows || 0}</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 group/tip relative">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold text-slate-500">Environmental Impact (CO2)</span>
                          <span className="font-black text-slate-800">{result.cost_estimate?.co2_display || "0g"}</span>
                        </div>
                        <div className="absolute top-0 right-0 p-2 bg-slate-900 text-white text-[9px] rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 pointer-events-none mt-6 shadow-xl">
                          Estimated Carbon footprint based on data processed and server heat.
                        </div>
                      </div>

                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
