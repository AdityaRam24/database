import { useState } from 'react';
import { ZombieIndex } from '@/app/dashboard/performance/page';

export function useZombieIndexes(zombies: ZombieIndex[], connectionString: string | null) {
    const [droppedZombies, setDroppedZombies] = useState<Set<string>>(new Set());
    const [droppingZombies, setDroppingZombies] = useState<Set<string>>(new Set());

    const handleDropZombie = async (z: ZombieIndex) => {
        if (!connectionString) return;
        if (!window.confirm(`Are you absolutely sure you want to drop index ${z.index_name}?`)) return;
        
        setDroppingZombies(prev => new Set(prev).add(z.index_name));
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/optimization/apply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ connection_string: connectionString, sql_command: z.drop_sql })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setDroppedZombies(prev => new Set(prev).add(z.index_name));
            } else {
                alert(`Error: ${data.message || 'Unknown error'}`);
            }
        } catch (e: any) {
            alert(`Execution failed: ${e.message}`);
        } finally {
            setDroppingZombies(prev => {
                const n = new Set(prev); n.delete(z.index_name); return n;
            });
        }
    };

    const handleDropAllZombies = async () => {
        if (!connectionString) return;
        const remaining = zombies.filter(z => !droppedZombies.has(z.index_name));
        if (remaining.length === 0) return;
        
        if (!window.confirm(`WARNING: You are about to drop ${remaining.length} unused indexes at once. Proceed?`)) return;
        
        for (const z of remaining) {
            setDroppingZombies(prev => new Set(prev).add(z.index_name));
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/optimization/apply`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ connection_string: connectionString, sql_command: z.drop_sql })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    setDroppedZombies(prev => new Set(prev).add(z.index_name));
                }
            } catch (e) {
                console.error("Batch drop failed for", z.index_name, e);
            } finally {
                setDroppingZombies(prev => {
                    const n = new Set(prev); n.delete(z.index_name); return n;
                });
            }
        }
    };

    return {
        droppedZombies,
        droppingZombies,
        handleDropZombie,
        handleDropAllZombies
    };
}
