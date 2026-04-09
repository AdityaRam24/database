export interface Project {
    id?: string;
    projectName: string;
    connectionType: 'connection' | 'file' | 'ai' | 'github' | 'mongodb' | 'firebase';
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
    // Prevent duplicates by connection string + name
    const existing = projects.findIndex(p => p.connectionString === project.connectionString && p.projectName === project.projectName);
    if (existing !== -1) {
        projects.splice(existing, 1); // Remove old one to move to top
    }
    const id = `local_${Date.now()}`;
    projects.unshift({ ...project, id });
    localStorage.setItem(LOCAL_KEY, JSON.stringify(projects));
    return id;
}

function notifyProjectsChanged() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('projects-updated'));
    }
}

export async function saveProject(uid: string | null, project: Omit<Project, 'id'>) {
    if (!uid) {
        const id = saveLocalProject(project);
        notifyProjectsChanged();
        return id;
    }
    try {
        const res = await fetch(`${API_BASE}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, ...project }),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        notifyProjectsChanged();
        return data.id as string;
    } catch (e: any) {
        console.warn('FastAPI unavailable, saving to localStorage:', e?.message);
        const id = saveLocalProject(project);
        notifyProjectsChanged();
        return id;
    }
}

export async function getUserProjects(uid: string | null): Promise<Project[]> {
    if (!uid) {
        return getLocalProjects();
    }
    try {
        const res = await fetch(`${API_BASE}/projects/${uid}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        const backendProjects: Project[] = data.projects ?? [];
        
        // Only filter out local projects if they are EXACT matches (Name AND Connection String)
        const local = getLocalProjects().filter(
            lp => !backendProjects.some(bp => 
                bp.projectName === lp.projectName && 
                bp.connectionString === lp.connectionString
            )
        );
        return [...backendProjects, ...local];
    } catch (e: any) {
        console.warn('FastAPI unavailable, loading from localStorage:', e?.message);
        return getLocalProjects();
    }
}

export async function deleteProject(uid: string | null, projectId: string): Promise<void> {
    if (!uid || projectId.startsWith('local_')) {
        const projects = getLocalProjects().filter(p => p.id !== projectId);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(projects));
        notifyProjectsChanged();
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/projects/${uid}/${projectId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        notifyProjectsChanged();
    } catch (e: any) {
        console.warn('FastAPI delete failed, removing from localStorage:', e?.message);
        const projects = getLocalProjects().filter(p => p.id !== projectId);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(projects));
        notifyProjectsChanged();
    }
}
