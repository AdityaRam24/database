export interface Project {
    id?: string;
    projectName: string;
    connectionType: 'connection' | 'file' | 'ai' | 'github';
    sqlContent: string;
    connectionString: string;
}

const LOCAL_KEY = 'db_lighthouse_projects';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

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
        const res = await fetch(`${API}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, ...project }),
        });
        if (!res.ok) throw new Error(`Backend error: ${res.status}`);
        const data = await res.json();
        return data.id as string;
    } catch (e: any) {
        console.warn('Backend unavailable, saving to localStorage:', e?.message);
        return saveLocalProject(project);
    }
}

export async function getUserProjects(uid: string): Promise<Project[]> {
    try {
        const res = await fetch(`${API}/projects/${uid}`);
        if (!res.ok) throw new Error(`Backend error: ${res.status}`);
        const data = await res.json();
        const backendProjects: Project[] = data.projects ?? [];
        // Merge local-only projects (fallback entries not yet synced)
        const local = getLocalProjects().filter(
            lp => !backendProjects.some(bp => bp.projectName === lp.projectName)
        );
        return [...backendProjects, ...local];
    } catch (e: any) {
        console.warn('Backend unavailable, loading from localStorage:', e?.message);
        return getLocalProjects();
    }
}

export async function deleteProject(uid: string, projectId: string): Promise<void> {
    // Local-only entry — remove from localStorage directly
    if (projectId.startsWith('local_')) {
        const projects = getLocalProjects().filter(p => p.id !== projectId);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(projects));
        return;
    }
    try {
        const res = await fetch(`${API}/projects/${uid}/${projectId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    } catch (e: any) {
        console.warn('Backend delete failed, removing from localStorage fallback:', e?.message);
        const projects = getLocalProjects().filter(p => p.id !== projectId);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(projects));
    }
}
