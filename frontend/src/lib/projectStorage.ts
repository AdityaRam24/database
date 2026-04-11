export interface Project {
    id?: string;
    projectName: string;
    connectionType: 'connection' | 'file' | 'ai' | 'github' | 'mongodb' | 'firebase';
    connectionString: string;
    sqlContent: string;

    // ── Rich metadata fields saved to Firestore ────────────────────────────
    /** Original filename for file/github uploads, e.g. "chinook.sql" */
    fileName?: string;
    /** MIME type or extension, e.g. "text/x-sql", ".sql" */
    fileType?: string;
    /** SQL dialect chosen by the user, e.g. "postgresql", "mysql", "sqlite" */
    dialect?: string;
    /** Extracted DB hostname from connection string */
    dbHost?: string;
    /** Extracted DB name from connection string */
    dbName?: string;
    /** AI prompt used to generate the schema (ai tab) */
    description?: string;
    /** Original GitHub URL (github tab) */
    githubUrl?: string;
    /** ISO timestamp when the project was connected */
    connectedAt?: string;
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
    // Prevent duplicates by connection string
    const existing = projects.findIndex(p => p.connectionString === project.connectionString);
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
        // Fire again after a short delay to recover from navigation races
        // (the sidebar listener may not be mounted yet when navigating to /dashboard)
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('projects-updated'));
        }, 800);
    }
}

export async function saveProject(uid: string | null, project: Omit<Project, 'id'>) {
    // Stamp connectedAt if not already set
    const stamped: Omit<Project, 'id'> = {
        ...project,
        connectedAt: project.connectedAt ?? new Date().toISOString(),
    };

    if (!uid) {
        const id = saveLocalProject(stamped);
        notifyProjectsChanged();
        return id;
    }
    try {
        const res = await fetch(`${API_BASE}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, ...stamped }),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        // Also persist locally so the sidebar can show it immediately
        saveLocalProject(stamped);
        notifyProjectsChanged();
        return data.id as string;
    } catch (e: any) {
        console.warn('FastAPI unavailable, saving to localStorage:', e?.message);
        const id = saveLocalProject(stamped);
        notifyProjectsChanged();
        return id;
    }
}

export async function getUserProjects(uid: string | null): Promise<Project[]> {
    if (!uid) {
        return getLocalProjects();
    }
    // Always fetch local projects first — they are always authoritative for
    // newly-added projects that may not have reached Firestore/backend yet.
    const local = getLocalProjects();
    try {
        const res = await fetch(`${API_BASE}/projects/${uid}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        const backendProjects: Project[] = data.projects ?? [];

        // Merge: backend projects first, then local-only ones not yet in Firestore.
        // De-duplicate by connectionString only (name can differ between local/remote).
        const localOnly = local.filter(
            lp => !backendProjects.some(bp =>
                bp.connectionString === lp.connectionString
            )
        );
        return [...backendProjects, ...localOnly];
    } catch (e: any) {
        console.warn('FastAPI unavailable, loading from localStorage:', e?.message);
        // Backend unreachable — return local projects so the sidebar is never empty
        return local;
    }
}

export async function deleteProject(uid: string | null, projectId: string): Promise<void> {
    // Always remove from local cache first
    const purgeLocal = () => {
        const projects = getLocalProjects().filter(p => p.id !== projectId);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(projects));
    };

    if (!uid || projectId.startsWith('local_')) {
        purgeLocal();
        notifyProjectsChanged();
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/projects/${uid}/${projectId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        purgeLocal();
        notifyProjectsChanged();
    } catch (e: any) {
        console.warn('FastAPI delete failed, removing from localStorage:', e?.message);
        purgeLocal();
        notifyProjectsChanged();
    }
}
