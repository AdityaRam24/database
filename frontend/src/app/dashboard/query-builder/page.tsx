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
        setTimeout(() => { analyzeQuery(); }, 300);
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
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 min-h-0">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm z-10 flex justify-between items-center relative overflow-hidden">
          {/* Floating 3D Background */}
          <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
              className="absolute -right-10 -top-20 w-64 h-64 border-[30px] border-violet-500/5 dark:border-violet-500/10 rounded-full pointer-events-none" 
              style={{ transformStyle: 'preserve-3d', transform: 'rotateX(60deg) rotateY(20deg)' }}
          />
          <motion.div 
              animate={{ y: [0, -15, 0] }} 
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
              className="absolute right-[20%] top-0 w-48 h-48 bg-violet-400/10 dark:bg-violet-600/20 rounded-full blur-[50px] pointer-events-none" 
          />
          
          <div className="relative z-10">
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="text-violet-500" /> Query Optimization Sandbox
            </h1>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
              Test queries and check their structural cost before pushing to production.
            </p>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <button
                onClick={() => setGuideMode(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all shadow-sm ${guideMode ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300' : 'bg-white dark:bg-white/[0.05] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.08]'}`}
            >
                <Info size={13} /> {guideMode ? 'Exit Guide' : 'Explain metrics'}
            </button>
            <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-100 dark:border-violet-500/20 flex items-center gap-1.5">
                <Database size={14} /> {connectionString ? "Connected" : "No Database"}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto"
            initial="hidden"
            animate="show"
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
          >
            {/* Left side: Editor */}
            <motion.div variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }} className="flex flex-col gap-4">
              {/* Magic Prompt Field */}
              <div className="bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-violet-500/10 p-5 rounded-3xl border border-violet-100 dark:border-violet-500/20 shadow-sm">
                 <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-md">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Magic Prompt</h3>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-violet-300 uppercase tracking-widest">Natural Language to Query</p>
                    </div>
                 </div>
                 <div className="relative group">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g. 'Show me the top 5 customers from last month'..."
                        className="w-full h-12 pl-4 pr-12 rounded-xl border border-violet-200 dark:border-violet-500/30 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-inner focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-sm font-medium transition-all group-hover:border-violet-300 dark:group-hover:border-violet-500/50"
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={generating || !prompt.trim()}
                        className="absolute right-1.5 top-1.5 h-9 px-4 rounded-lg bg-slate-900 dark:bg-violet-600 text-white flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-violet-700 transition-all disabled:opacity-50 cursor-pointer shadow-md group-active:scale-95"
                    >
                        {generating ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Wand2 size={14} className="text-violet-400 dark:text-white" />}
                        <span className="text-[11px] font-black uppercase tracking-wider">Generate</span>
                    </button>
                 </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 overflow-hidden shadow-sm flex flex-col h-[400px]">
                <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-white/10 flex items-center gap-2">
                  <Code2 size={14} className="text-slate-500 dark:text-slate-400" />
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">SQL Editor</span>
                </div>
                <textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  className="flex-1 p-4 bg-slate-900 dark:bg-[#0d0d1a] text-slate-100 font-mono text-sm resize-none focus:outline-none focus:ring-0 leading-relaxed"
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
                <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl text-sm font-bold flex items-start gap-2">
                  <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </motion.div>

            {/* Right Side: Results */}
            <motion.div variants={{ hidden: { opacity: 0, x: 10 }, show: { opacity: 1, x: 0 } }} className="flex flex-col gap-4">
              {!result && !loading && !error && (
                <div className="h-[400px] border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-white/50 dark:bg-white/[0.02] relative overflow-hidden group">
                  
                  {/* 3D Floating Geometry inside box */}
                  <motion.div 
                      animate={{ rotateX: [20, 60, 20], rotateY: [0, 45, 0], scale: [1, 1.1, 1] }} 
                      transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
                      className="absolute right-10 bottom-10 w-32 h-32 rounded-full border-8 border-violet-500/10 pointer-events-none group-hover:border-violet-500/20 transition-colors"
                      style={{ transformStyle: 'preserve-3d' }}
                  />
                  <motion.div 
                      animate={{ rotateX: [-20, -60, -20], rotateY: [45, 0, 45] }} 
                      transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
                      className="absolute -left-10 top-10 w-40 h-40 rounded-3xl border-4 border-emerald-500/10 pointer-events-none group-hover:border-emerald-500/20 transition-colors"
                      style={{ transformStyle: 'preserve-3d' }}
                  />

                  <div className="w-16 h-16 bg-white dark:bg-white/[0.05] shadow-lg rounded-2xl flex items-center justify-center mb-4 text-violet-500 dark:text-violet-400 relative z-10 hover:scale-110 transition-transform">
                    <TrendingDown size={32} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white relative z-10">Ready to Benchmark</h3>
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500 mt-2 max-w-sm">
                    Enter a query and hit Analyze. We'll simulate its execution plan and tell you how much it costs in computation and real dollars.
                  </p>
                </div>
              )}

              {loading && (
                <div className="h-[400px] border border-slate-200 dark:border-white/10 rounded-3xl flex flex-col items-center justify-center text-center bg-white dark:bg-white/[0.03] shadow-sm animate-pulse">
                  <div className="w-12 h-12 border-4 border-violet-100 dark:border-violet-500/20 border-t-violet-500 rounded-full animate-spin mb-4" />
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Simulating execution plan...</p>
                </div>
              )}

              {result && !result.supported && (
                 <div className="h-[400px] border border-amber-200 dark:border-amber-500/30 rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-amber-50 dark:bg-amber-500/5">
                    <ShieldAlert size={48} className="text-amber-400 mb-4" />
                    <h3 className="text-lg font-black text-amber-800 dark:text-amber-300 mb-2">Not Supported by Current DB</h3>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400 max-w-sm">{result.message}</p>
                 </div>
              )}

              {result && result.supported !== false && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", damping: 25, stiffness: 200 } }}
                  className="flex flex-col gap-4"
                >
                  <div className={`p-6 rounded-3xl border shadow-sm relative overflow-hidden ${
                    isExpensive
                      ? 'bg-rose-50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/20'
                      : isCheap
                      ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20'
                      : 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20'
                  }`}>
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
                      <div className="bg-white/60 dark:bg-white/[0.05] p-4 rounded-2xl group/tip relative">
                        <p className="text-xs font-bold mb-1 text-slate-600 dark:text-slate-400 opacity-70 flex items-center gap-1">
                          Estimated Cost ($)
                          <Info size={10} className="text-slate-400" />
                        </p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{result.cost_estimate?.dollar_cost_display || "$0.00"}</p>
                        <div className="absolute top-full left-0 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 pointer-events-none mt-1 shadow-xl">
                          Calculated as scanned data size × cloud price ($0.10/GB).
                        </div>
                      </div>
                      <div className="bg-white/60 dark:bg-white/[0.05] p-4 rounded-2xl group/tip relative">
                        <p className="text-xs font-bold mb-1 text-slate-600 dark:text-slate-400 opacity-70 flex items-center gap-1">
                          Relative DB Cost
                          <Info size={10} className="text-slate-400" />
                        </p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{result.plan_summary?.total_cost || "N/A"}</p>
                        <div className="absolute top-full left-0 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 pointer-events-none mt-1 shadow-xl">
                          Internal units the database uses to weigh work (CPU/Disk).
                        </div>
                      </div>
                    </div>
                  </div>

                  {guideMode && (
                      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 rounded-2xl animate-in slide-in-from-top-2">
                        <p className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase mb-1">How we calculate this</p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-200 font-medium leading-relaxed">
                          We use the database's <strong>EXPLAIN</strong> engine to predict the future. We look at how many "pages" of data need to be read, map that to server energy usage (Environmental Impact), and then apply standard cloud pricing to guess your bill.
                        </p>
                      </div>
                  )}

                  <div className="bg-white dark:bg-white/[0.03] rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
                    <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                      <Server size={18} className="text-slate-400 dark:text-slate-500" /> Deep Analytics
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold text-slate-500 dark:text-slate-400">Execution Plan Type</span>
                          <span className="font-black text-slate-800 dark:text-white">{result.plan_summary?.node_type || "Unknown"}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-white/[0.06] rounded-full h-2">
                          <div className={`h-2 rounded-full ${result.plan_summary?.node_type?.includes('Seq Scan') ? 'bg-rose-400 w-full' : 'bg-emerald-400 w-1/3'}`}></div>
                        </div>
                        {result.plan_summary?.node_type?.includes('Seq Scan') && (
                          <p className="text-[10px] font-bold text-rose-500 dark:text-rose-400 mt-1">Sequential Scans slow down drastically as data grows. Consider adding an index.</p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold text-slate-500 dark:text-slate-400">Estimated Rows Scanned</span>
                          <span className="font-black text-slate-800 dark:text-white">{result.plan_summary?.estimated_rows || 0}</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] group/tip relative">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold text-slate-500 dark:text-slate-400">Environmental Impact (CO2)</span>
                          <span className="font-black text-slate-800 dark:text-white">{result.cost_estimate?.co2_display || "0g"}</span>
                        </div>
                        <div className="absolute top-0 right-0 p-2 bg-slate-900 text-white text-[9px] rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 pointer-events-none mt-6 shadow-xl">
                          Estimated Carbon footprint based on data processed and server heat.
                        </div>
                      </div>

                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </DashboardShell>
  );
}
