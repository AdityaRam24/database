'use client';

import { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2, Database, AlertCircle, Sparkles } from 'lucide-react';

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
      setSqlResult(data.sql_ddl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
          <Sparkles className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">Vision to Schema</h2>
          <p className="text-slate-400 text-sm">Upload a photo of your whiteboard ER diagram to generate live DDL.</p>
        </div>
      </div>

      <div 
        className={`border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center cursor-pointer min-h-[200px] ${
          file ? 'border-violet-500/50 bg-violet-500/5' : 'border-slate-700 bg-slate-800/20 hover:bg-slate-800/40 hover:border-slate-600'
        }`}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !file && fileInputRef.current?.click()}
      >
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        
        {preview ? (
          <div className="relative w-full flex flex-col items-center gap-4">
            <img src={preview} alt="Schema Preview" className="max-h-64 rounded-lg shadow-xl border border-slate-700" />
            <button 
              onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setSqlResult(null); }}
              className="px-4 py-1.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
            >
              Change Image
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mb-2">
              <ImageIcon className="w-8 h-8 text-slate-500" />
            </div>
            <p className="font-semibold text-slate-300">Drag & drop your diagram here</p>
            <p className="text-xs">Supports JPEG, PNG up to 10MB</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
          <p className="text-sm text-rose-200">{error}</p>
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
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
              <Database className="w-3.5 h-3.5" /> Generated SQL
            </h3>
            <button 
              onClick={() => navigator.clipboard.writeText(sqlResult)}
              className="text-[10px] text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded-md transition"
            >
              COPY
            </button>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 overflow-x-auto">
            <pre className="text-xs font-mono text-emerald-300">
              <code>{sqlResult}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
