'use client';

import { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2, Database, AlertCircle, Sparkles, Wand2, Terminal, Info, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function VisionUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sqlResult, setSqlResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.startsWith('image/')) {
        setError('Please select a valid image file.');
        return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setError(null);
      setSqlResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (!droppedFile.type.startsWith('image/')) {
        setError('Please drop a valid image file.');
        return;
      }
      setFile(droppedFile);
      setPreview(URL.createObjectURL(droppedFile));
      setError(null);
      setSqlResult(null);
    }
  };

  const processImage = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vision/upload-schema`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Vision API failed');
      
      if (data.sql_ddl.startsWith("OFFLINE_DEMO_FALLBACK:")) {
        setSqlResult(data.sql_ddl.replace("OFFLINE_DEMO_FALLBACK: ", ""));
        setError("AI_OFFLINE_DEMO");
      } else {
        setSqlResult(data.sql_ddl);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8 }}
      className="bg-[#0a0c14] border border-violet-500/20 rounded-[32px] p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
          <Sparkles className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Vision Intelligence</h2>
          <p className="text-indigo-400/80 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Blueprint-to-Schema Engine</p>
        </div>
      </div>

      <div 
        className={`border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center cursor-pointer min-h-[200px] ${
          file ? 'border-violet-500/50 bg-violet-500/5' : 'border-indigo-900 bg-indigo-950/20 hover:bg-indigo-900/40 hover:border-indigo-600'
        }`}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !file && fileInputRef.current?.click()}
      >
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        
        {preview ? (
          <div className="relative w-full flex flex-col items-center gap-4">
            <img src={preview} alt="Schema Preview" className="max-h-64 rounded-lg shadow-xl border border-indigo-800" />
            <button 
              onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setSqlResult(null); }}
              className="px-4 py-1.5 rounded-full bg-indigo-900 text-indigo-300 text-xs font-bold hover:bg-indigo-800 transition"
            >
              Change Image
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-indigo-400">
            <div className="w-16 h-16 rounded-full bg-indigo-950/80 flex items-center justify-center mb-2">
              <ImageIcon className="w-8 h-8 text-indigo-500" />
            </div>
            <div className="text-center">
              <p className="font-black text-white text-xl tracking-tight">Drop Blueprint Here</p>
              <p className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.3em] mt-2">Whiteboard or ERD · MAX 10MB</p>
            </div>
          </div>
        )}
      </div>

      {(error || sqlResult) && error === "AI_OFFLINE_DEMO" && (
        <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-black text-amber-200">Running in Demo Mode</p>
              <p className="text-[11px] text-amber-200/70 mt-1 uppercase font-bold tracking-wider">Your Local AI server is offline. This is a sample result.</p>
            </div>
          </div>
          <div className="bg-indigo-950/60 p-3 rounded-lg border border-indigo-900/50">
             <p className="text-[10px] font-black text-indigo-400 uppercase mb-2">How to fix this:</p>
             <ol className="text-[11px] text-indigo-200 space-y-2 list-decimal list-inside font-bold">
                <li>Download Ollama from <a href="https://ollama.com" className="text-violet-400 underline">ollama.com</a></li>
                <li>Open PowerShell and run: <code className="text-violet-400 bg-indigo-900 px-1 rounded">ollama run llava</code></li>
                <li>Make sure Ollama is open in your system tray.</li>
             </ol>
          </div>
        </div>
      )}

      {error && error !== "AI_OFFLINE_DEMO" && (
        <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
            <p className="text-sm text-rose-200">{error.includes("Fetch") ? "Connection Timeout" : error}</p>
          </div>
          {error.includes("fetch") && (
             <div className="bg-rose-900/40 p-3 rounded-lg border border-rose-500/30">
                <p className="text-[10px] font-bold text-rose-200">PRO TIP: Your firewall might be blocking port 11434. Check your security settings!</p>
             </div>
          )}
        </div>
      )}

      {file && !sqlResult && (
        <button
          onClick={processImage}
          disabled={loading}
          className="w-full mt-6 py-3.5 px-4 rounded-xl font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Processing Blueprint...</>
          ) : (
            <><Sparkles className="w-5 h-5" /> Generate SQL Schema</>
          )}
        </button>
      )}

      {sqlResult && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <Database className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400/80">Compiled Payloads</h3>
            </div>
            <button 
              onClick={() => navigator.clipboard.writeText(sqlResult)}
              className="text-[10px] font-black uppercase tracking-widest text-indigo-300 hover:text-white px-4 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/20 transition-all"
            >
              Copy SQL
            </button>
          </div>
          <div className="bg-[#05070a] p-4 rounded-xl border border-emerald-500/30 overflow-x-auto">
            <pre className="text-xs font-mono text-emerald-300">
              <code>{sqlResult}</code>
            </pre>
          </div>
        </div>
      )}
    </motion.div>
  );
}
