import { db } from '@/lib/firebase';
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';

export interface Project {
    id?: string;
    projectName: string;
    connectionType: 'connection' | 'file' | 'ai' | 'github';
    sqlContent: string;
    connectionString: string; // "SHADOW_DB" or actual pg connection string
    createdAt?: Timestamp;
}

export async function saveProject(uid: string, project: Omit<Project, 'id' | 'createdAt'>) {
    try {
        const docRef = await addDoc(collection(db, 'users', uid, 'projects'), {
            ...project,
            createdAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (e) {
        console.error('Failed to save project to Firestore:', e);
        throw e;
    }
}

export async function getUserProjects(uid: string): Promise<Project[]> {
    try {
        // Temporarily bypassed for local testing to avoid Firestore permission errors
        // const q = query(
        //     collection(db, 'users', uid, 'projects'),
        //     orderBy('createdAt', 'desc')
        // );
        // const snapshot = await getDocs(q);
        // return snapshot.docs.map((doc) => ({
        //     id: doc.id,
        //     ...(doc.data() as Omit<Project, 'id'>),
        // }));
        console.log("Mock getUserProjects called, bypassing Firestore.");
        return [];
    } catch (e) {
        console.error('Failed to load projects from Firestore:', e);
        return [];
    }
}
