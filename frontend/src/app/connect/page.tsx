'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Database, FileCode2, Sparkles, Github, ArrowLeft, CheckCircle2, Loader2, Zap, Leaf, Flame, Share2 } from "lucide-react";
import { saveProject } from "@/lib/projectStorage";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "connection" | "file" | "ai" | "github" | "mongodb" | "firebase" | "neo4j";

const TABS: { id: Tab; icon: React.ReactNode; label: string; desc: string }[] = [
    { id: "connection", icon: <Database size={18} />, label: "PostgreSQL", desc: "Live connection string" },
    { id: "mongodb", icon: <Leaf size={18} />, label: "MongoDB", desc: "MongoDB URI" },
    { id: "neo4j", icon: <Share2 size={18} />, label: "Neo4j Graph", desc: "Graph DB Bolt URI" },
    { id: "firebase", icon: <Flame size={18} />, label: "Firebase", desc: "Firestore service account" },
    { id: "file", icon: <FileCode2 size={18} />, label: "SQL File", desc: "Upload a .sql schema" },
    { id: "ai", icon: <Sparkles size={18} />, label: "Generate AI", desc: "Describe your database" },
    { id: "github", icon: <Github size={18} />, label: "GitHub", desc: "Import from a repo" },
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
    const [sqlDialect, setSqlDialect] = useState("postgresql");

    const SQL_DIALECTS = [
        { value: "postgresql", label: "PostgreSQL", icon: "🐘" },
        { value: "mysql", label: "MySQL / MariaDB", icon: "🐬" },
        { value: "sqlite", label: "SQLite", icon: "🗃️" },
        { value: "mssql", label: "SQL Server (MSSQL)", icon: "🪟" },
        { value: "oracle", label: "Oracle", icon: "🔴" },
    ];

    const [mongoUri, setMongoUri] = useState("");
    const [firebaseJson, setFirebaseJson] = useState("");
    
    // Neo4j fields
    const [neo4jUri, setNeo4jUri] = useState("bolt://localhost:7687");
    const [neo4jUser, setNeo4jUser] = useState("neo4j");
    const [neo4jPassword, setNeo4jPassword] = useState("");

    const defaultNames: Record<Tab, string> = {
        connection: "My PostgreSQL DB",
        mongodb: "My MongoDB",
        neo4j: "My Neo4j Graph DB",
        firebase: "My Firestore",
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
            if (activeTab === "firebase") {
                if (!firebaseJson) throw new Error("Please paste your Firebase service account JSON.");
                let parsed: any;
                try { parsed = JSON.parse(firebaseJson); } catch { throw new Error("Invalid JSON — paste the full contents of your service account key file."); }
                if (!parsed.private_key || !parsed.project_id) throw new Error("JSON is missing required fields (private_key, project_id).");
                res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/connect-db/firebase`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        service_account_json: firebaseJson,
                        project_name: projectName || defaultNames.firebase,
                    }),
                });
            } else if (activeTab === "mongodb") {
                if (!mongoUri) throw new Error("Please enter your MongoDB URI.");
                res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/connect-db/mongodb`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        connection_string: mongoUri,
                        project_name: projectName || defaultNames.mongodb,
                    }),
                });
            } else if (activeTab === "neo4j") {
                if (!neo4jUri) throw new Error("Please enter your Neo4j Bolt URI.");
                res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/connect-db/neo4j`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        uri: neo4jUri,
                        user: neo4jUser,
                        password: neo4jPassword,
                        project_name: projectName || defaultNames.neo4j,
                    }),
                });
            } else if (activeTab === "connection") {
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
                url.searchParams.append("dialect", sqlDialect);
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
            const finalConnStr = data.connection_string || (
                activeTab === "mongodb" ? mongoUri : 
                activeTab === "firebase" ? firebaseJson : 
                activeTab === "neo4j" ? neo4jUri :
                connectionString
            );
            const finalName = projectName || defaultNames[activeTab];

            localStorage.setItem("db_connection_string", finalConnStr);
            localStorage.setItem("project_name", finalName);

            let sqlContent = "";

            if (activeTab === "file" && file) {
                try { sqlContent = await file.text(); } catch { }
            } else if (activeTab === "github") {
                try {
                    const rawUrl = githubUrl
                        .replace("github.com", "raw.githubusercontent.com")
                        .replace("/blob/", "/");
                    const rawRes = await fetch(rawUrl);
                    sqlContent = rawRes.ok ? await rawRes.text() : githubUrl;
                } catch {
                    sqlContent = githubUrl;
                }
            } else if (activeTab === "ai") {
                sqlContent = aiDescription;
            }

            // ── Build rich metadata ─────────────────────────────────────────
            let fileName: string | undefined;
            let fileType: string | undefined;
            let dialect: string | undefined;
            let dbHost: string | undefined;
            let dbName: string | undefined;
            let description: string | undefined;
            let savedGithubUrl: string | undefined;

            if (activeTab === "file" && file) {
                fileName = file.name;
                fileType = file.type || (file.name.endsWith(".sql") ? "text/x-sql" : "application/octet-stream");
                dialect  = sqlDialect;
            } else if (activeTab === "github") {
                fileName = githubUrl.split("/").pop() || "schema.sql";
                fileType = "text/x-sql";
                savedGithubUrl = githubUrl;
            } else if (activeTab === "ai") {
                description = aiDescription;
            } else if (activeTab === "connection") {
                dialect = "postgresql";
                try {
                    const u = new URL(finalConnStr);
                    dbHost = u.hostname;
                    dbName = u.pathname.replace(/^\//, "");
                } catch { /* non-parseable conn string — skip */ }
            } else if (activeTab === "mongodb") {
                try {
                    const u = new URL(finalConnStr);
                    dbHost = u.hostname;
                    dbName = u.pathname.replace(/^\//, "");
                } catch { /* non-parseable URI — skip */ }
            } else if (activeTab === "neo4j") {
                try {
                    const u = new URL(neo4jUri);
                    dbHost = u.hostname;
                } catch { /* non-parseable URI — skip */ }
            } else if (activeTab === "firebase") {
                try {
                    const parsed = JSON.parse(firebaseJson);
                    dbName = parsed.project_id;
                } catch { /* ignore */ }
            }

            try {
                await saveProject(user?.uid || null, {
                    projectName: finalName,
                    connectionType: activeTab,
                    sqlContent,
                    connectionString: finalConnStr,
                    // Rich metadata
                    fileName,
                    fileType,
                    dialect,
                    dbHost,
                    dbName,
                    description,
                    githubUrl: savedGithubUrl,
                });
            } catch (e) {
                console.warn("Could not persist project:", e);
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
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B0A0F] flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

            {/* Back button */}
            <button
                onClick={() => router.push("/dashboard")}
                className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 font-medium text-sm transition-colors z-20"
            >
                <ArrowLeft size={16} /> Dashboard
            </button>

            <motion.div 
                className="w-full max-w-2xl relative z-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
                {/* Header */}
                <div className="mb-10 text-center flex flex-col items-center">
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1, type: "spring", bounce: 0.4 }}
                        className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-white to-violet-50 border border-violet-100 shadow-sm mb-5 text-violet-600"
                    >
                        <Database size={26} />
                    </motion.div>
                    <motion.h1 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight"
                    >
                        Connect a Database
                    </motion.h1>
                    <motion.p 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-slate-500 dark:text-slate-400 font-medium"
                    >
                        Choose your data source to initialize the Lighthouse core.
                    </motion.p>
                </div>

                {/* Tab pills */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex flex-wrap items-center justify-center gap-3 mb-8"
                >
                    {TABS.map((t) => {
                        const isActive = activeTab === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => { setActiveTab(t.id); setError(null); }}
                                className={`relative flex items-center gap-2 py-3 px-5 rounded-2xl text-[13px] font-semibold transition-all duration-300
                                    ${isActive
                                        ? "text-violet-700"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5"
                                    }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTabPill"
                                        className="absolute inset-0 bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-slate-200/60 dark:border-white/10"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <span className={`relative z-10 transition-transform duration-300 ${isActive ? "scale-110" : ""}`}>
                                    {t.icon}
                                </span>
                                <span className="relative z-10">{t.label}</span>
                            </button>
                        );
                    })}
                </motion.div>

                {/* Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white/90 dark:bg-[#0B0A0F]/80 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-[32px] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/5 dark:ring-white/10"
                >
                    <form onSubmit={handleConnect} className="space-y-6">

                        {/* Project Name */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 pl-1">
                                Project Name
                            </label>
                            <input
                                type="text"
                                placeholder={defaultNames[activeTab]}
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="w-full bg-slate-50/50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-[14px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                            />
                        </div>

                        {/* Dynamic field container with animation */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                        {activeTab === "mongodb" && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    MongoDB URI
                                </label>
                                <input
                                    type="text"
                                    placeholder="mongodb+srv://user:pass@cluster.mongodb.net/dbname"
                                    value={mongoUri}
                                    onChange={(e) => setMongoUri(e.target.value)}
                                    required
                                    className="w-full bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors font-mono shadow-sm"
                                />
                                <p className="text-xs text-gray-500 mt-2 font-medium">
                                    Supports <code className="bg-gray-100 px-1 rounded">mongodb://</code> and <code className="bg-gray-100 px-1 rounded">mongodb+srv://</code> URIs.
                                </p>
                            </div>
                        )}

                        {activeTab === "neo4j" && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                        Neo4j Bolt URI
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="neo4j+s://xx.databases.neo4j.io"
                                        value={neo4jUri}
                                        onChange={(e) => setNeo4jUri(e.target.value)}
                                        required
                                        className="w-full bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors font-mono shadow-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-2 font-medium">
                                        Supports <code className="bg-gray-100 px-1 rounded">bolt://</code> and <code className="bg-gray-100 px-1 rounded">neo4j+s://</code> Aura URIs.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Username</label>
                                        <input
                                            type="text"
                                            placeholder="neo4j"
                                            value={neo4jUser}
                                            onChange={(e) => setNeo4jUser(e.target.value)}
                                            required
                                            className="w-full bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-violet-500 transition-colors shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Password</label>
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={neo4jPassword}
                                            onChange={(e) => setNeo4jPassword(e.target.value)}
                                            required
                                            className="w-full bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-violet-500 transition-colors shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "firebase" && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Service Account JSON
                                </label>
                                <textarea
                                    rows={7}
                                    placeholder={'{\n  "type": "service_account",\n  "project_id": "my-project",\n  "private_key": "-----BEGIN RSA PRIVATE KEY-----\\n...",\n  ...\n}'}
                                    value={firebaseJson}
                                    onChange={(e) => setFirebaseJson(e.target.value)}
                                    required
                                    className="w-full bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors font-mono resize-none shadow-sm"
                                />
                                <p className="text-xs text-gray-500 mt-2 font-medium">
                                    Paste the full contents of your Firebase{" "}
                                    <span className="text-gray-700 font-semibold">serviceAccountKey.json</span> file.
                                    Generate it in Firebase Console → Project Settings → Service Accounts.
                                </p>
                            </div>
                        )}

                        {activeTab === "connection" && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    PostgreSQL Connection String
                                </label>
                                <input
                                    type="text"
                                    placeholder="postgresql://user:pass@host:5432/dbname"
                                    value={connectionString}
                                    onChange={(e) => setConnectionString(e.target.value)}
                                    required
                                    className="w-full bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors font-mono shadow-sm"
                                />
                                <p className="text-xs text-gray-500 mt-2 font-medium">The connection string and DB name are saved securely to your account.</p>
                            </div>
                        )}

                        {activeTab === "file" && (
                            <div className="space-y-4">
                                {/* File picker */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                        SQL Schema File
                                    </label>
                                    <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${file ? "border-violet-400 bg-violet-50" : "border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100"}`}>
                                        <input type="file" accept=".sql" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
                                        {file ? (
                                            <div className="flex items-center gap-3 text-violet-700">
                                                <FileCode2 size={20} />
                                                <div>
                                                    <p className="text-sm font-bold">{file.name}</p>
                                                    <p className="text-xs text-violet-500 font-medium">{(file.size / 1024).toFixed(1)} KB — click to change</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <FileCode2 size={24} className="mx-auto mb-2 text-slate-600" />
                                                <p className="text-sm text-slate-400">Drop or click to select a <span className="text-violet-400 font-semibold">.sql</span> file</p>
                                            </div>
                                        )}
                                    </label>
                                </div>

                                {/* Dialect selector */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                        SQL Dialect
                                    </label>
                                    <div className="grid grid-cols-1 gap-2">
                                        <select
                                            value={sqlDialect}
                                            onChange={(e) => setSqlDialect(e.target.value)}
                                            className="w-full bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-violet-500 transition-colors appearance-none cursor-pointer shadow-sm"
                                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b8fa8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center' }}
                                        >
                                            {SQL_DIALECTS.map((d) => (
                                                <option key={d.value} value={d.value}>
                                                    {d.icon}  {d.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {sqlDialect !== "postgresql" && (
                                        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1 font-medium">
                                            <Zap size={12} className="shrink-0" />
                                            Your {SQL_DIALECTS.find(d => d.value === sqlDialect)?.label} SQL will be automatically converted to PostgreSQL before import.
                                        </p>
                                    )}
                                    {sqlDialect === "postgresql" && (
                                        <p className="text-xs text-gray-500 mt-2 font-medium">We will automatically create a secure, dedicated PostgreSQL database for this schema.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === "ai" && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Describe Your Database
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="e.g. An e-commerce store with products, orders, customers, and reviews. Products belong to categories."
                                    value={aiDescription}
                                    onChange={(e) => setAiDescription(e.target.value)}
                                    required
                                    className="w-full bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors resize-none shadow-sm"
                                />
                            </div>
                        )}

                        {activeTab === "github" && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    GitHub File URL
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://github.com/user/repo/blob/main/schema.sql"
                                    value={githubUrl}
                                    onChange={(e) => setGithubUrl(e.target.value)}
                                    required
                                    className="w-full bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors font-mono shadow-sm"
                                />
                                <p className="text-xs text-gray-500 mt-2 font-medium">Both blob and raw GitHub URLs are supported.</p>
                            </div>
                        )}

                            </motion.div>
                        </AnimatePresence>

                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 px-4 py-3 bg-red-50/80 border border-red-200 rounded-2xl text-red-600 text-[13px] font-semibold"
                            >
                                {error}
                            </motion.div>
                        )}
                        
                        {/* Submit Button */}
                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 rounded-2xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 mt-2
                                ${loading
                                    ? "bg-violet-100 text-violet-400 cursor-wait shadow-inner"
                                    : "bg-slate-900 dark:bg-violet-600 hover:bg-slate-800 dark:hover:bg-violet-500 text-white shadow-[0_4px_14px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_24px_rgba(124,58,237,0.3)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)]"
                                }`}
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                                    {["connection", "mongodb", "firebase", "neo4j"].includes(activeTab) ? "Connecting..." : "Creating Database..."}
                                </>
                            ) : (
                                ["connection", "mongodb", "firebase", "neo4j"].includes(activeTab) ? "Connect Database" : "Create Database"
                            )}
                        </motion.button>
                    </form>
                </motion.div>
            </motion.div>
        </div>
    );
}
