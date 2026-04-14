"use client";

import React, { useState, useEffect } from "react";
import { LogoGithub as GithubIcon } from "@carbon/icons-react";
import {
  Database, Trash2, FileCode, Sparkles, Table,
  Plus, ChevronDown, Search, Settings, Table2, Server,
  PanelLeftClose, PanelLeftOpen, ChevronsLeft, ChevronsRight,
  RefreshCw, Share2
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getUserProjects, deleteProject, saveProject, Project } from "@/lib/projectStorage";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";


/* ─── Logo ──────────────────────────────────────────────────── */
function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-100">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 12px rgba(124,58,237,0.35)" }}>
        <Database size={14} color="white" strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[14px] font-black text-slate-900 leading-tight tracking-tight">DB Lighthouse</p>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">AI Database Agent</p>
      </div>
    </div>
  );
}

/* ─── Avatar ────────────────────────────────────────────────── */
function Avatar({ user }: { user: any }) {
  if (user?.photoURL) {
    return (
      <img src={user.photoURL} alt="avatar" referrerPolicy="no-referrer"
        className="w-8 h-8 rounded-full border-2 border-white shadow-sm object-cover shrink-0" />
    );
  }
  const initials = user?.displayName
    ? user.displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0].toUpperCase() ?? "?";
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black text-white"
      style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
      {initials}
    </div>
  );
}

/* ─── Project delete button ─────────────────────────────────── */
function DeleteBtn({ project, onDeleted }: { project: Project; onDeleted: () => void }) {
  const { user } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm) { setConfirm(true); return; }
    if (!user || !project.id) return;
    setBusy(true);
    try { await deleteProject(user.uid, project.id); onDeleted(); }
    finally { setBusy(false); setConfirm(false); }
  };

  if (confirm) {
    return (
      <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={handle} disabled={busy}
          className="text-[9px] font-black px-1.5 py-0.5 rounded-lg bg-rose-500 text-white uppercase tracking-widest">
          {busy ? "…" : "Yes"}
        </button>
        <button onClick={e => { e.stopPropagation(); setConfirm(false); }}
          className="text-[9px] font-black px-1.5 py-0.5 rounded-lg bg-slate-100 text-slate-500 uppercase tracking-widest">
          No
        </button>
      </div>
    );
  }

  return (
    <button onClick={e => { e.stopPropagation(); setConfirm(true); }}
      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all shrink-0"
      title="Remove database">
      <Trash2 size={12} />
    </button>
  );
}

/* ─── Main Sidebar ──────────────────────────────────────────── */
interface SidebarProps {
  onProjectLoad: (connectionString: string, projectName: string, connectionType?: string) => void;
}

export function DualSidebar({ onProjectLoad }: SidebarProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeConn, setActiveConn] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<string>("");
  const [tables, setTables] = useState<string[]>([]);
  const [tablesExpanded, setTablesExpanded] = useState(true);
  const [searchVal, setSearchVal] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setActiveConn(localStorage.getItem("db_connection_string"));
    setActiveProject(localStorage.getItem("project_name") || "");
    const handler = (e: any) => {
      setActiveConn(e.detail.connStr);
      setActiveProject(e.detail.name || e.detail.projectName || "");
    };
    window.addEventListener("project-changed", handler);
    return () => window.removeEventListener("project-changed", handler);
  }, []);

  // Load tables for active connection
  useEffect(() => {
    if (!activeConn) { setTables([]); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/graph`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connection_string: activeConn }),
    }).then(r => r.json()).then(d => {
      setTables(d.nodes ? d.nodes.map((n: any) => n.data.label) : []);
    }).catch(() => setTables([]));
  }, [activeConn]);

  // Load user projects
  const fetchProjects = () => {
    getUserProjects(user?.uid || null).then(setProjects);
  };

  useEffect(() => {
    fetchProjects();

    const handleSync = () => {
      fetchProjects();
    };

    // Safety Pulse: re-fetch at 500ms and 1500ms after mount to handle cross-page
    // navigation races where the 'projects-updated' event fires before the sidebar
    // is mounted (e.g. navigating from /connect → /dashboard immediately after saving).
    const timer1 = setTimeout(fetchProjects, 500);
    const timer2 = setTimeout(fetchProjects, 1500);

    window.addEventListener('projects-updated', handleSync);
    return () => {
      window.removeEventListener('projects-updated', handleSync);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [user]);

  // Project Guardian: Auto-heal the registry if the active DB is missing from the list
  useEffect(() => {
    if (!activeConn || projects.length === 0) return;
    
    const exists = projects.some(p => p.connectionString === activeConn);
    if (!exists) {
      console.log(`[Guardian] Active connection ${activeProject} missing from registry. Auto-healing...`);
      saveProject(user?.uid || null, {
        projectName: activeProject || "Recovered Database",
        connectionType: localStorage.getItem("db_type") as any || "connection",
        sqlContent: "",
        connectionString: activeConn
      }).then(() => {
        fetchProjects(); // Refresh the list after healing
      });
    }
  }, [activeConn, projects, user, activeProject]);

  const handleProjectClick = async (project: Project) => {
    if (project.sqlContent && project.connectionString === "SHADOW_DB") {
      try {
        const blob = new Blob([project.sqlContent], { type: "text/plain" });
        const form = new FormData();
        form.append("file", blob, "schema.sql");
        const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/connect-db/upload-sql`);
        url.searchParams.append("project_name", project.projectName);
        await fetch(url.toString(), { method: "POST", body: form });
      } catch { }
    }
    localStorage.setItem("db_connection_string", project.connectionString);
    localStorage.setItem("project_name", project.projectName);
    setActiveConn(project.connectionString);
    setActiveProject(project.projectName);
    onProjectLoad(project.connectionString, project.projectName, project.connectionType);
  };

  const handleProjectDelete = (p: Project) => {
    setProjects(prev => prev.filter(x => x.id !== p.id));
    if (activeConn === p.connectionString) {
      localStorage.removeItem("db_connection_string");
      localStorage.removeItem("project_name");
      setActiveConn(null);
      setActiveProject("");
    }
  };

  const filteredProjects = projects.filter(p =>
    !searchVal || p.projectName.toLowerCase().includes(searchVal.toLowerCase())
  );

  const filteredTables = tables.filter(t =>
    !searchVal || t.toLowerCase().includes(searchVal.toLowerCase())
  );

  function getProjectIcon(p: Project) {
    if (p.connectionType === "file") return <FileCode size={13} className="text-amber-500 shrink-0" />;
    if (p.connectionType === "github") return <GithubIcon size={13} className="text-slate-500 shrink-0" />;
    if (p.connectionType === "ai") return <Sparkles size={13} className="text-rose-400 shrink-0" />;
    if (p.connectionType === "neo4j") return <Share2 size={13} className="text-teal-500 shrink-0" />;
    return <Server size={13} className="text-violet-500 shrink-0" />;
  }

  return (
    <motion.div
      animate={{ width: collapsed ? 64 : 260 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.4, 1] }}
      className="flex flex-col h-full bg-white/60 dark:bg-[#141418] border-r border-slate-100/80 dark:border-white/[0.06] overflow-hidden"
      style={{ boxShadow: "2px 0 24px rgba(0,0,0,0.04)", minWidth: collapsed ? 64 : 260 }}
    >
      {/* ── Logo header with collapse toggle ── */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              key="logo-full"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2.5 min-w-0"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 12px rgba(124,58,237,0.35)" }}>
                <Database size={14} color="white" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-slate-900 dark:text-slate-100 leading-tight tracking-tight truncate">DB Lighthouse</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">AI Database Agent</p>
              </div>
            </motion.div>
          )}
          {collapsed && (
            <motion.div
              key="logo-icon"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.18 }}
              className="w-8 h-8 rounded-xl flex items-center justify-center mx-auto"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 12px rgba(124,58,237,0.35)" }}
            >
              <Database size={14} color="white" strokeWidth={2.5} />
            </motion.div>
          )}
        </AnimatePresence>

        {!collapsed && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer shrink-0"
          >
            <ChevronsLeft size={15} />
          </motion.button>
        )}

        {collapsed && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            className="p-1.5 rounded-xl text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-all cursor-pointer mx-auto mt-1"
          >
            <ChevronsRight size={15} />
          </motion.button>
        )}
      </div>

      {/* ── Content scroll area (hidden when collapsed) ── */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-0 py-3 px-3 scrollbar-thin">

          {/* ── Active DB status pill ── */}
          {activeConn && (
            <div className="mb-3 px-2 py-2.5 rounded-2xl border border-violet-100 dark:border-violet-500/20 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-500/10 dark:to-indigo-500/10">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">Connected</span>
              </div>
              <p className="text-[12px] font-black text-slate-900 dark:text-slate-100 truncate pl-4">{activeProject || "Database"}</p>
              <p className="text-[10px] font-bold text-slate-400 pl-4 truncate">{activeConn.split("@").pop()?.split("/")[0] || "Local"}</p>
            </div>
          )}

          {/* ── Search ── */}
          <div className="relative mb-3">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchVal} onChange={e => setSearchVal(e.target.value)}
              placeholder="Search databases, tables…"
              className="w-full pl-8 pr-3 py-2 text-[12px] font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-xl outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 placeholder-slate-400 transition-all" />
          </div>



          {/* ── My Databases ── */}
          <div className="mb-1">
            <div className="flex items-center justify-between px-2 mb-1.5">
              <div className="flex items-center gap-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">My Databases</p>
                <button 
                  onClick={fetchProjects}
                  className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors"
                  title="Refresh registry"
                >
                  <RefreshCw size={10} />
                </button>
              </div>
              <motion.button whileTap={{ scale: 0.92 }}
                onClick={() => router.push("/connect")}
                className="w-5 h-5 rounded-lg flex items-center justify-center bg-violet-100 text-violet-600 hover:bg-violet-200 transition-colors cursor-pointer"
                title="Add new database">
                <Plus size={11} />
              </motion.button>
            </div>

            <AnimatePresence>
              {filteredProjects.length > 0 ? (
                <div className="space-y-0.5">
                  {filteredProjects.map(p => {
                    const isActive = p.connectionString === activeConn;
                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        className={`group w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all cursor-pointer ${isActive
                            ? "bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30"
                            : "hover:bg-slate-50 dark:hover:bg-white/[0.04] border border-transparent"
                          }`}
                        onClick={() => handleProjectClick(p)}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-violet-100 dark:bg-violet-500/20" : "bg-slate-100 dark:bg-white/[0.06]"
                          }`}>
                          {getProjectIcon(p)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] font-black truncate ${isActive ? "text-violet-800 dark:text-violet-300" : "text-slate-700 dark:text-slate-200"}`}>
                            {p.projectName}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {p.connectionType === "file" ? "SQL File" :
                              p.connectionType === "github" ? "GitHub" :
                                p.connectionType === "ai" ? "AI Gen" : "Database"}
                          </p>
                        </div>
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.7)] shrink-0 mr-1" />}
                        <DeleteBtn project={p} onDeleted={() => handleProjectDelete(p)} />
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="px-3 py-5 text-center">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-2">
                    <Database size={16} className="text-slate-300" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-400">No databases yet</p>
                  <p className="text-[10px] text-slate-300 font-medium mt-0.5">Click + to add one</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add New Button */}
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/connect")}
              className="w-full mt-2 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-violet-200 text-violet-600 hover:bg-violet-50 hover:border-violet-300 transition-all cursor-pointer group">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-violet-100 group-hover:bg-violet-200 transition-colors shrink-0">
                <Plus size={12} />
              </div>
              <span className="text-[12px] font-black">Connect Database</span>
            </motion.button>
          </div>

          {/* ── Tables (if connected) ── */}
          {activeConn && filteredTables.length > 0 && (
            <>
              <div className="h-px bg-slate-100 dark:bg-white/[0.06] mx-2 my-3" />
              <div>
                <button
                  onClick={() => setTablesExpanded(t => !t)}
                  className="w-full flex items-center justify-between px-2 mb-1.5 hover:bg-slate-50 rounded-lg py-1 transition-colors cursor-pointer">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Tables ({filteredTables.length})
                  </p>
                  <ChevronDown size={11} className={`text-slate-400 transition-transform ${tablesExpanded ? "" : "-rotate-90"}`} />
                </button>

                <AnimatePresence>
                  {tablesExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden space-y-0.5">
                      {filteredTables.map(t => (
                        <button key={t}
                          onClick={() => window.dispatchEvent(new CustomEvent("focus-schema-node", { detail: { tableName: t } }))}
                          className="group w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
                          <div className="w-5 h-5 rounded-md bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-violet-100 dark:group-hover:bg-violet-500/20 transition-colors">
                            <Table2 size={10} className="text-slate-400 group-hover:text-violet-500 transition-colors" />
                          </div>
                          <span className="text-[12px] font-bold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 truncate transition-colors">{t}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

        </div>
      )}

      {/* ── User footer (hidden when collapsed) ── */}
      {!collapsed && (
        <div className="shrink-0 border-t border-slate-100 dark:border-white/[0.06] p-3 relative">
          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full mb-2 left-3 right-3 p-2 rounded-2xl border border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] z-50 ring-1 ring-black/5 dark:ring-white/5"
                style={{ backgroundColor: theme === 'dark' ? '#16161b' : '#ffffff' }}
              >
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 py-1.5 mb-1">Theme Settings</p>
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => { setTheme('light'); setShowSettings(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-[11px] font-black transition-all ${theme === 'light' ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'}`}>Light Mode</button>
                  <button onClick={() => { setTheme('dark'); setShowSettings(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-[11px] font-black transition-all ${theme === 'dark' ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'}`}>Dark Mode</button>
                  <button onClick={() => { setTheme('system'); setShowSettings(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-[11px] font-black transition-all ${theme === 'system' ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'}`}>System Default</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {user ? (
            <div 
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer group"
            >
              <Avatar user={user} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-black text-slate-800 dark:text-slate-100 truncate">{user.displayName || "User"}</p>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.7)]" />
                  <p className="text-[10px] font-bold text-slate-400 truncate">{user.email}</p>
                </div>
              </div>
              <Settings size={13} className={`text-slate-400 transition-opacity shrink-0 ${showSettings ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
            </div>
          ) : (
            <button onClick={() => router.push("/")}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-[12px] font-black text-white cursor-pointer"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
              Sign In
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default DualSidebar;
