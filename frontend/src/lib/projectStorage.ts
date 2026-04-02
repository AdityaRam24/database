export interface Project {
    id?: string;
    projectName: string;
    connectionType: 'connection' | 'file' | 'ai' | 'github' | 'mongodb';
    sqlContent: string;
    connectionString: string;
}

const LOCAL_KEY = 'db_lighthouse_projects';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

function getLocalProjects(): Project[] {
    try {
        const raw = localStorage.getItem(LOCAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveLocalProject(project: Omit<Project, 'id'>): string {
    const projects = getLocalProjects();
    const id = `local_${Date.now()}`;
    projects.unshift({ ...project, id });
    localStorage.setItem(LOCAL_KEY, JSON.stringify(projects));
    return id;
}

export async function saveProject(uid: string, project: Omit<Project, 'id'>) {
    try {
        const res = await fetch(`${API_BASE}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, ...project }),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        return data.id as string;
    } catch (e: any) {
        console.warn('FastAPI unavailable, saving to localStorage:', e?.message);
        return saveLocalProject(project);
    }
}

export async function getUserProjects(uid: string): Promise<Project[]> {
    try {
        const res = await fetch(`${API_BASE}/projects/${uid}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        const backendProjects: Project[] = data.projects ?? [];
        const local = getLocalProjects().filter(
            lp => !backendProjects.some(bp => bp.projectName === lp.projectName)
        );
        return [...backendProjects, ...local];
    } catch (e: any) {
        console.warn('FastAPI unavailable, loading from localStorage:', e?.message);
        return getLocalProjects();
    }
}

export async function deleteProject(uid: string, projectId: string): Promise<void> {
    if (projectId.startsWith('local_')) {
        const projects = getLocalProjects().filter(p => p.id !== projectId);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(projects));
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/projects/${uid}/${projectId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
    } catch (e: any) {
        console.warn('FastAPI delete failed, removing from localStorage:', e?.message);
        const projects = getLocalProjects().filter(p => p.id !== projectId);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(projects));
    }
}
