'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getUserProjects, Project } from '@/lib/projectStorage';
import { useRouter } from 'next/navigation';
import { Database, ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react';

interface ProjectsSidebarProps {
    onProjectLoad: (connectionString: string, projectName: string) => void;
}

const ProjectsSidebar: React.FC<ProjectsSidebarProps> = ({ onProjectLoad }) => {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            setLoading(true);
            const results = await getUserProjects(user.uid);
            setProjects(results);
            setLoading(false);
        };
        load();
    }, [user]);

    const handleProjectClick = async (project: Project) => {
        // Restore project to shadow DB via backend if it has SQL content
        if (project.sqlContent && project.connectionString === 'SHADOW_DB') {
            try {
                const blob = new Blob([project.sqlContent], { type: 'text/plain' });
                const formData = new FormData();
                formData.append('file', blob, 'schema.sql');

                const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/connect-db/upload-sql`);
                url.searchParams.append('project_name', project.projectName);

                await fetch(url.toString(), { method: 'POST', body: formData });
            } catch (e) {
                console.error('Failed to restore project:', e);
            }
        }

        localStorage.setItem('db_connection_string', project.connectionString);
        localStorage.setItem('project_name', project.projectName);
        onProjectLoad(project.connectionString, project.projectName);
    };

    if (!user) return null;

    const sidebarWidth = collapsed ? 48 : 240;

    return (
        <div 
            className="flex flex-col shrink-0 min-h-screen border-r border-white/5 bg-[#0b0b14]/60 backdrop-blur-xl relative z-20"
            style={{ width: sidebarWidth, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 h-[72px]">
                {!collapsed && <span className="text-purple-300 font-bold text-sm tracking-wide truncate">My Databases</span>}
                <button onClick={() => setCollapsed(!collapsed)} className="text-slate-400 hover:text-white hover:bg-white/5 p-1.5 rounded-lg transition-colors ml-auto">
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* Project list */}
            {!collapsed && (
                <div className="flex-1 overflow-y-auto py-2">
                    {loading ? (
                        <div className="flex justify-center p-6">
                            <Loader2 size={20} className="animate-spin text-purple-500" />
                        </div>
                    ) : projects.length === 0 ? (
                        <p className="text-slate-500 text-xs px-4 py-3 text-center">
                            No saved databases yet.
                        </p>
                    ) : (
                        projects.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => handleProjectClick(p)}
                                className="w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-all group flex flex-col gap-1"
                            >
                                <div className="flex items-center gap-2">
                                    <Database size={14} className="text-purple-500 shrink-0 group-hover:text-purple-400 transition-colors" />
                                    <span className="text-purple-200 text-sm font-medium truncate group-hover:text-white transition-colors">
                                        {p.projectName}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 pl-5">
                                    <Clock size={10} className="text-slate-500" />
                                    <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">
                                        {p.connectionType}
                                    </span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}

            {/* Add new */}
            {!collapsed && (
                <div className="p-4 mt-auto border-t border-white/5">
                    <button
                        onClick={() => router.push('/connect')}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 text-white text-xs font-bold hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all border border-white/10"
                    >
                        + Add Database
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProjectsSidebar;
