'use client';

import { useState, useEffect } from "react";
import DashboardShell from "@/components/DashboardShell";
import { motion } from "framer-motion";
import { Play, FlaskConical, ShieldAlert, CheckCircle2, FlaskRound, Server, Code2, ArrowRight, Sparkles, Wand2 } from "lucide-react";

export default function LabPage() {
  const [sql, setSql] = useState("CREATE INDEX idx_users_active ON users(active);");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionString, setConnectionString] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("db_connection_string");
    if (saved) setConnectionString(saved);

    const handler = (e: any) => setConnectionString(e.detail.connStr);
    window.addEventListener("project-changed", handler);
    return () => window.removeEventListener("project-changed", handler);
  }, []);

  const runExperiment = async () => {
    if (!sql.trim()) return;
    if (!connectionString) {
      setError("Please connect to a database first (Go to Dashboard).");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lab/experiment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_string: connectionString, query: sql }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || "Experiment failed");
      
      if (data.status === "error") {
        setError(data.message);
      } else {
        setResult(data);
      }
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/generate-lab-sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_string: connectionString, prompt }),
      });
      const data = await res.json();
      if (data.sql) {
        setSql(data.sql);
        // Delay slightly for visual effect before auto-simulating
        setTimeout(() => {
           runExperiment();
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

  return (
    <DashboardShell>
      <div className="flex flex-col h-full bg-slate-50 min-h-0">
        <div className="px-6 py-5 border-b border-indigo-200 bg-white shadow-sm z-10 flex justify-between items-center" style={{ background: "linear-gradient(to right, #eff6ff, #ffffff)" }}>
          <div>
            <h1 className="text-xl font-black text-indigo-900 flex items-center gap-2">
              <FlaskConical className="text-indigo-600" /> The Simulation Chamber (Shadow Lab)
            </h1>
            <p className="text-sm font-bold text-indigo-500 mt-1">
              Safely run structural changes (CREATE/ALTER/DROP) against an isolated copy of your schema.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
            {/* Left side: Editor */}
            <div className="flex flex-col gap-4">
              {/* Magic Prompt Field */}
              <div className="bg-indigo-50/50 p-5 rounded-3xl border border-indigo-100 shadow-sm">
                 <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-900 tracking-tight">Experiment Prompt</h3>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Describe your change (e.g. "Add specific index")</p>
                    </div>
                 </div>
                 <div className="relative group">
                    <input 
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g. 'Optimize searching by customer email'..."
                        className="w-full h-12 pl-4 pr-12 rounded-xl border border-indigo-200 bg-white shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium transition-all group-hover:border-indigo-300"
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    />
                    <button 
                        onClick={handleGenerate}
                        disabled={generating || !prompt.trim()}
                        className="absolute right-1.5 top-1.5 h-9 px-4 rounded-lg bg-indigo-900 text-white flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer shadow-md group-active:scale-95"
                    >
                        {generating ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Wand2 size={14} className="text-indigo-400" />}
                        <span className="text-[11px] font-black uppercase tracking-wider">Generate</span>
                    </button>
                 </div>
              </div>

              <div className="rounded-2xl border border-indigo-200 bg-white overflow-hidden shadow-sm flex flex-col h-[400px]">
                <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                  <Code2 size={14} className="text-indigo-500" />
                  <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">Sandbox Query Editor</span>
                </div>
                <textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  className="flex-1 p-4 bg-slate-900 text-indigo-100 font-mono text-sm resize-none focus:outline-none leading-relaxed"
                  placeholder="CREATE INDEX ... or ALTER TABLE ..."
                  spellCheck={false}
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={runExperiment}
                disabled={loading || !sql.trim()}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white font-black shadow-md disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Play size={18} fill="currentColor" /> Run in Sandbox
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
                <div className="h-[400px] border-2 border-dashed border-indigo-200 rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-indigo-50/50">
                  <div className="w-16 h-16 bg-white border border-indigo-100 rounded-2xl flex items-center justify-center mb-4 text-indigo-300">
                    <FlaskRound size={32} />
                  </div>
                  <h3 className="text-lg font-black text-indigo-900">Lab is Standing By</h3>
                  <p className="text-sm font-medium text-indigo-500 mt-2 max-w-sm">
                    Modifying production tables is scary. Run it here first, and we'll tell you if it speeds things up or breaks things.
                  </p>
                </div>
              )}

              {loading && (
                <div className="h-[400px] border border-indigo-200 rounded-3xl flex flex-col items-center justify-center text-center bg-white shadow-sm animate-pulse">
                  <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
                  <p className="text-sm font-bold text-indigo-500">Cloning schema & applying changes...</p>
                </div>
              )}

              {result && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4 border border-emerald-200 bg-emerald-50 rounded-3xl p-6 shadow-sm overflow-hidden relative">
                  <div className="absolute -right-4 -top-4 opacity-10 pointer-events-none">
                     <CheckCircle2 size={120} className="text-emerald-500" />
                  </div>
                  
                  <div className="relative z-10 flex items-center gap-2 mb-6 border-b border-emerald-100 pb-4">
                     <CheckCircle2 size={24} className="text-emerald-500" />
                     <h3 className="text-xl font-black text-emerald-900">Structural Change Safe</h3>
                  </div>

                  <p className="text-sm font-bold text-emerald-700 mb-6 bg-white/60 p-4 rounded-xl relative z-10">
                    {result.message}
                  </p>

                  <div className="bg-white rounded-2xl p-5 shadow-sm relative z-10 border border-emerald-100">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                       <Server size={14} /> Global Workload Impact
                    </h4>
                    
                    <div className="flex items-center justify-between mb-2">
                       <div className="text-center">
                          <p className="text-xs font-bold text-slate-500 mb-1">Before Cost</p>
                          <p className="text-2xl font-black text-rose-500">{result.metrics.before_cost}</p>
                       </div>
                       <ArrowRight size={24} className="text-slate-300" />
                       <div className="text-center">
                          <p className="text-xs font-bold text-slate-500 mb-1">After Cost</p>
                          <p className="text-2xl font-black text-emerald-500">{result.metrics.after_cost}</p>
                       </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                       <span className="text-sm font-bold text-slate-600">Net Query Speedup:</span>
                       <span className={`px-3 py-1 bg-emerald-100 text-emerald-700 font-black rounded-lg text-lg ${result.metrics.improvement_pct > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                          {result.metrics.improvement_pct > 0 ? "+" : ""}{result.metrics.improvement_pct}%
                       </span>
                    </div>
                  </div>
                  
                  {result.metrics.improvement_pct > 0 && (
                      <button className="relative z-10 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full py-4 rounded-xl font-black transition-colors shadow-md shadow-emerald-600/20">
                          Deploy to Production
                      </button>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
