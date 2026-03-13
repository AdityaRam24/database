'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { saveProject } from "@/lib/projectStorage";
import { Database, FileCode2, Sparkles, Github, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

type Tab = "connection" | "file" | "ai" | "github";

const TABS: { id: Tab; icon: React.ReactNode; label: string; desc: string }[] = [
    { id: "connection", icon: <Database size={18} />, label: "PostgreSQL", desc: "Live connection string" },
    { id: "file",       icon: <FileCode2 size={18} />, label: "SQL File",    desc: "Upload a .sql schema" },
    { id: "ai",         icon: <Sparkles size={18} />,  label: "Generate AI", desc: "Describe your database" },
    { id: "github",     icon: <Github size={18} />,    label: "GitHub",      desc: "Import from a repo" },
];

export default function ConnectPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>("connection");
    const [projectName, setProjectName] = useState("");
    const [connectionString, setConnectionString] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [aiDescription, setAiDescription] = useState("");
    const [githubUrl, setGithubUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const defaultNames: Record<Tab, string> = {
        connection: "My PostgreSQL DB",
        file: "SQL Schema",
        ai: "AI Generated DB",
        github: "GitHub Import",
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        let res;
        try {
            if (activeTab === "connection") {
                res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/connect-db/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        connection_string: connectionString,
                        project_name: projectName || defaultNames.connection,
                    }),
                });
            } else if (activeTab === "file") {
                if (!file) throw new Error("Please select a .sql file.");
                const formData = new FormData();
                formData.append("file", file);
                const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/connect-db/upload-sql`);
                url.searchParams.append("project_name", projectName || file.name.replace(".sql", ""));
                res = await fetch(url.toString(), { method: "POST", body: formData });
            } else if (activeTab === "ai") {
                if (!aiDescription) throw new Error("Please describe your database.");
                res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/connect-db/generate-schema`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        description: aiDescription,
                        project_name: projectName || defaultNames.ai,
                    }),
                });
            } else {
                if (!githubUrl) throw new Error("Please enter a GitHub URL.");
                res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/connect-db/import-github`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        github_url: githubUrl,
                        project_name: projectName || defaultNames.github,
                    }),
                });
            }

            if (!res || !res.ok) {
                const data = res ? await res.json() : {};
                throw new Error(data.detail || "Connection failed. Check your details.");
            }

            const data = await res.json();
            const finalConnStr = data.connection_string || connectionString;
            const finalName = projectName || defaultNames[activeTab];

            localStorage.setItem("db_connection_string", finalConnStr);
            localStorage.setItem("project_name", finalName);

            // Persist to backend (Firebase Admin → Firestore)
            if (user) {
                let sqlContent = "";

                if (activeTab === "file" && file) {
                    // Save full .sql file content
                    try { sqlContent = await file.text(); } catch { }

                } else if (activeTab === "github") {
                    // Convert GitHub blob URL → raw URL and fetch actual SQL content
                    try {
                        const rawUrl = githubUrl
                            .replace("github.com", "raw.githubusercontent.com")
                            .replace("/blob/", "/");
                        const rawRes = await fetch(rawUrl);
                        if (rawRes.ok) {
                            sqlContent = await rawRes.text();
                        } else {
                            // Fallback: save URL if fetch fails
                            sqlContent = githubUrl;
                        }
                    } catch {
                        sqlContent = githubUrl;
                    }

                } else if (activeTab === "ai") {
                    sqlContent = aiDescription;
                }

                try {
                    await saveProject(user.uid, {
                        projectName: finalName,
                        connectionType: activeTab,
                        sqlContent,
                        connectionString: finalConnStr,
                    });
                } catch (e) {
                    console.warn("Could not persist project:", e);
                }
            }

            setSuccess(true);
            setTimeout(() => router.push("/dashboard"), 1200);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#07070f] flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Back button */}
            <button
                onClick={() => router.push("/dashboard")}
                className="absolute top-6 left-6 flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
            >
                <ArrowLeft size={16} /> Dashboard
            </button>

            <div className="w-full max-w-lg relative z-10">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/30 mb-4">
                        <Database size={22} className="text-violet-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1">Connect a Database</h1>
                    <p className="text-slate-400 text-sm">Choose how you want to add your database to Lighthouse.</p>
                </div>

                {/* Tab pills */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => { setActiveTab(t.id); setError(null); }}
                            className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-medium transition-all duration-200
                                ${activeTab === t.id
                                    ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                                    : "bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/8"
                                }`}
                        >
                            <span className={activeTab === t.id ? "text-violet-400" : ""}>{t.icon}</span>
                            <span>{t.label}</span>
                        </button>
                    ))}
                </div>

                {/* Card */}
                <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 shadow-2xl">
                    <form onSubmit={handleConnect} className="space-y-5">

                        {/* Project Name */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                Project Name
                            </label>
                            <input
                                type="text"
                                placeholder={defaultNames[activeTab]}
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/8 transition-colors"
                            />
                        </div>

                        {/* Dynamic field */}
                        {activeTab === "connection" && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    PostgreSQL Connection String
                                </label>
                                <input
                                    type="text"
                                    placeholder="postgresql://user:pass@host:5432/dbname"
                                    value={connectionString}
                                    onChange={(e) => setConnectionString(e.target.value)}
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/8 transition-colors font-mono"
                                />
                                <p className="text-xs text-slate-600 mt-2">The connection string and DB name are saved securely to your account.</p>
                            </div>
                        )}

                        {activeTab === "file" && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    SQL Schema File
                                </label>
                                <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${file ? "border-violet-500/50 bg-violet-600/10" : "border-white/10 hover:border-white/20 bg-white/3"}`}>
                                    <input type="file" accept=".sql" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
                                    {file ? (
                                        <div className="flex items-center gap-3 text-violet-300">
                                            <FileCode2 size={20} />
                                            <div>
                                                <p className="text-sm font-semibold">{file.name}</p>
                                                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB — click to change</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <FileCode2 size={24} className="mx-auto mb-2 text-slate-600" />
                                            <p className="text-sm text-slate-400">Drop or click to select a <span className="text-violet-400 font-semibold">.sql</span> file</p>
                                        </div>
                                    )}
                                </label>
                                <p className="text-xs text-slate-400 mt-2 font-medium">Don't worry — we will automatically create a secure, dedicated PostgreSQL database to store and analyze this file for you.</p>
                            </div>
                        )}

                        {activeTab === "ai" && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    Describe Your Database
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="e.g. An e-commerce store with products, orders, customers, and reviews. Products belong to categories."
                                    value={aiDescription}
                                    onChange={(e) => setAiDescription(e.target.value)}
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/8 transition-colors resize-none"
                                />
                            </div>
                        )}

                        {activeTab === "github" && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    GitHub File URL
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://github.com/user/repo/blob/main/schema.sql"
                                    value={githubUrl}
                                    onChange={(e) => setGithubUrl(e.target.value)}
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/8 transition-colors font-mono"
                                />
                                <p className="text-xs text-slate-600 mt-2">Both blob and raw GitHub URLs are supported.</p>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 mt-4
                                ${loading
                                    ? "bg-violet-600/50 text-white/70 cursor-wait"
                                    : "bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)]"
                                }`}
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {activeTab === "connection" ? "Connecting..." : "Creating Database..."}
                                </>
                            ) : (
                                activeTab === "connection" ? "Connect Database" : "Create Database"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
