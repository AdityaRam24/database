export interface Project {
    id?: string;
    projectName: string;
    connectionType: 'connection' | 'file' | 'ai' | 'github' | 'mongodb' | 'firebase' | 'neo4j';
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
    /** UID of the user who originally created/saved this project (owner/admin) */
    ownerUid?: string;
}

// ── Shared project type (from collaboration) ──────────────────────────────────
export interface SharedProject {
    invite_id: string;
    owner_uid: string;
    project_id: string;
    project_name: string;
    connection_string: string;
    connection_type: string;
    invited_email: string;
}

// ── Pending Invites (Needs Accept/Reject) ──────────────────────────────────
export interface PendingInvite {
    invite_id: string;
    owner_uid: string;
    project_id: string;
    project_name: string;
    invited_email: string;
}

// ── Audit Logs ───────────────────────────────────────────────────────────────
export interface AuditLog {
    log_id: string;
    action: string;
    details: string;
    user_email: string;
    created_at: string;
}

// ── Pending approval type ─────────────────────────────────────────────────────
export interface PendingApproval {
    approval_id: string;
    submitted_by_email: string;
    submitted_by_uid: string;
    sql_patch: string;
    description: string;
    connection_string: string;
    created_at: string | null;
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

// ══════════════════════════════════════════════════════════════════════════════
// COLLABORATION HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Invite a user by email to collaborate on a project. */
export async function inviteCollaborator(params: {
    ownerUid: string;
    projectId: string;
    projectName: string;
    connectionString: string;
    connectionType: string;
    invitedEmail: string;
}): Promise<{ status: string; invite_id?: string }> {
    try {
        const res = await fetch(`${API_BASE}/collaboration/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                owner_uid:         params.ownerUid,
                project_id:        params.projectId,
                project_name:      params.projectName,
                connection_string: params.connectionString,
                connection_type:   params.connectionType,
                invited_email:     params.invitedEmail,
            }),
        });
        return await res.json();
    } catch {
        return { status: 'error' };
    }
}

/** Fetch all projects shared with this user (by email). */
export async function getSharedProjects(uid: string, email: string): Promise<SharedProject[]> {
    try {
        const res = await fetch(
            `${API_BASE}/collaboration/shared/${uid}?email=${encodeURIComponent(email)}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.projects ?? [];
    } catch {
        return [];
    }
}

/** List all collaborators on a project (owner only). */
export async function getProjectMembers(ownerUid: string, projectId: string) {
    try {
        const res = await fetch(`${API_BASE}/collaboration/members/${ownerUid}/${projectId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.members ?? [];
    } catch {
        return [];
    }
}

/** Remove a collaborator invite (owner only). */
export async function removeCollaborator(params: {
    ownerUid: string;
    projectId: string;
    inviteId: string;
}): Promise<void> {
    try {
        await fetch(`${API_BASE}/collaboration/remove`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                owner_uid:  params.ownerUid,
                project_id: params.projectId,
                invite_id:  params.inviteId,
            }),
        });
    } catch { /* silent */ }
}

/** Collaborator submits a critical SQL change for admin approval. */
export async function submitPendingChange(params: {
    ownerUid: string;
    projectId: string;
    projectName: string;
    submittedByUid: string;
    submittedByEmail: string;
    sqlPatch: string;
    description?: string;
    connectionString: string;
}): Promise<{ status: string; approval_id?: string }> {
    try {
        const res = await fetch(`${API_BASE}/collaboration/pending-change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                owner_uid:          params.ownerUid,
                project_id:         params.projectId,
                project_name:       params.projectName,
                submitted_by_uid:   params.submittedByUid,
                submitted_by_email: params.submittedByEmail,
                sql_patch:          params.sqlPatch,
                description:        params.description ?? '',
                connection_string:  params.connectionString,
            }),
        });
        return await res.json();
    } catch {
        return { status: 'error' };
    }
}

/** Owner fetches all pending changes for a project. */
export async function getPendingApprovals(ownerUid: string, projectId: string): Promise<PendingApproval[]> {
    try {
        const res = await fetch(`${API_BASE}/collaboration/pending/${ownerUid}/${projectId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.pending ?? [];
    } catch {
        return [];
    }
}

/** Owner fetches total count of pending approvals across all projects. */
export async function getPendingCount(ownerUid: string): Promise<number> {
    try {
        const res = await fetch(`${API_BASE}/collaboration/pending-count/${ownerUid}`);
        if (!res.ok) return 0;
        const data = await res.json();
        return data.count ?? 0;
    } catch {
        return 0;
    }
}

/** Owner approves a pending change and applies it. */
export async function approveChange(params: {
    ownerUid: string;
    approvalId: string;
    connectionString: string;
    sqlPatch: string;
}): Promise<{ status: string; message?: string }> {
    try {
        const res = await fetch(`${API_BASE}/collaboration/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                owner_uid:         params.ownerUid,
                approval_id:       params.approvalId,
                connection_string: params.connectionString,
                sql_patch:         params.sqlPatch,
            }),
        });
        return await res.json();
    } catch {
        return { status: 'error' };
    }
}

/** Owner rejects a pending change. */
export async function rejectChange(params: {
    ownerUid: string;
    approvalId: string;
}): Promise<void> {
    try {
        await fetch(`${API_BASE}/collaboration/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                owner_uid:   params.ownerUid,
                approval_id: params.approvalId,
            }),
        });
    } catch { /* silent */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// INVITATION ACCEPT/REJECT & AUDIT LOGS
// ══════════════════════════════════════════════════════════════════════════════

export async function getPendingInvites(email: string): Promise<PendingInvite[]> {
    try {
        const res = await fetch(`${API_BASE}/collaboration/invites/${encodeURIComponent(email)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.invites ?? [];
    } catch {
        return [];
    }
}

export async function acceptInvite(inviteId: string): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/collaboration/invites/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invite_id: inviteId }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function rejectInvite(inviteId: string): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/collaboration/invites/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invite_id: inviteId }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function getAuditLogs(projectId: string): Promise<AuditLog[]> {
    try {
        const res = await fetch(`${API_BASE}/collaboration/audit-logs/${projectId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.logs ?? [];
    } catch {
        return [];
    }
}
