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
        <div style={{
            width: sidebarWidth,
            minHeight: '100vh',
            background: '#0f0f1a',
            borderRight: '1px solid #2e2e4e',
            transition: 'width 0.2s ease',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
        }}>
            {/* Header */}
            <div style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2e2e4e' }}>
                {!collapsed && <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>My Databases</span>}
                <button onClick={() => setCollapsed(!collapsed)} style={{ color: '#6b7280', cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* Project list */}
            {!collapsed && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                            <Loader2 size={20} className="animate-spin" style={{ color: '#7c3aed' }} />
                        </div>
                    ) : projects.length === 0 ? (
                        <p style={{ color: '#6b7280', fontSize: 12, padding: '12px 16px', textAlign: 'center' }}>
                            No saved databases yet.
                        </p>
                    ) : (
                        projects.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => handleProjectClick(p)}
                                style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 16px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #1a1a2e',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#1e1e2e')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Database size={14} style={{ color: '#7c3aed', flexShrink: 0 }} />
                                    <span style={{ color: '#c4b5fd', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {p.projectName}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, paddingLeft: 22 }}>
                                    <Clock size={10} style={{ color: '#4b5563' }} />
                                    <span style={{ color: '#4b5563', fontSize: 11 }}>
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
                <div style={{ padding: '12px', borderTop: '1px solid #2e2e4e' }}>
                    <button
                        onClick={() => router.push('/connect')}
                        style={{ width: '100%', padding: '8px', borderRadius: 8, background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                        + Add Database
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProjectsSidebar;
